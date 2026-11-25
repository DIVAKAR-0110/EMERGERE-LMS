"""
Global API Idempotency Guard & Unique-Constraint Helpers.

Provides:
1. ASGI IdempotencyMiddleware backed by dbo.lms_idempotency_keys (and SQLite fallback)
   for slow-server / double-click / network-retry deduplication across workers.
2. is_unique_violation(exc) helper to translate SQL Server 2601/2627 or SQLite
   IntegrityError constraint failures into clean HTTP 409 Conflict responses.
"""

import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi.responses import JSONResponse, Response
from database.connection import connect_db, is_sql_server


MUTATING_METHODS = {"POST", "PUT", "PATCH"}

# Endpoints that perform read/compute actions over POST and should not be idempotency-blocked
EXCLUDED_PATHS = {
    "/api/ai-assistant/chat",
    "/api/daily-learning/calculate-points",
    "/api/auth/dev-login",
    "/api/auth/switch-role",
}

def is_idempotency_excluded(path: str) -> bool:
    """Returns True if the endpoint is excluded from idempotency enforcement."""
    norm = (path or "").rstrip("/") or "/"
    if norm in EXCLUDED_PATHS:
        return True
    # Exclude report generation, data fetching, export and download endpoints
    if "/api/reports/" in norm or "/download" in norm or "/export" in norm or "/data" in norm:
        return True
    return False

STALE_IN_PROGRESS_SECONDS = 120
KEY_TTL_HOURS = 24
MAX_CACHED_BODY_BYTES = 512 * 1024


def is_unique_violation(exc: Exception) -> bool:
    """Detects SQL Server 2601/2627 or SQLite UNIQUE/PRIMARY KEY constraint violations."""
    msg = str(exc)
    msg_lower = msg.lower()
    return (
        "2627" in msg
        or "2601" in msg
        or "unique constraint" in msg_lower
        or "unique index" in msg_lower
        or "duplicate key" in msg_lower
        or "primary key constraint" in msg_lower
    )


def _compute_request_hash(method: str, path: str, content_type: str, body: bytes) -> str:
    """Computes a stable SHA-256 fingerprint for an HTTP request payload."""
    normalized_body = body
    if "multipart/form-data" in content_type.lower():
        # Strip random multipart boundary tokens so a retried FormData hashes deterministically
        match = re.search(r"boundary=([^;\s]+)", content_type, flags=re.IGNORECASE)
        if match:
            boundary_bytes = match.group(1).strip('"').encode("utf-8", errors="ignore")
            if boundary_bytes:
                normalized_body = normalized_body.replace(boundary_bytes, b"BOUNDARY")
    hasher = hashlib.sha256()
    hasher.update(method.upper().encode("utf-8"))
    hasher.update(b":")
    hasher.update(path.encode("utf-8"))
    hasher.update(b":")
    hasher.update(normalized_body)
    return hasher.hexdigest()


def _acquire_key(key: str, method: str, path: str, actor_id: Optional[str], req_hash: str) -> dict:
    """
    Attempts to acquire an idempotency lock row in dbo.lms_idempotency_keys.
    Returns:
      {"action": "PROCEED"}
      {"action": "REPLAY", "status_code": int, "body": str}
      {"action": "CONFLICT", "detail": str}
    """
    conn = connect_db()
    cur = conn.cursor()
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    expires_at = now_utc + timedelta(hours=KEY_TTL_HOURS)
    stale_cutoff = now_utc - timedelta(seconds=STALE_IN_PROGRESS_SECONDS)
    tbl = "dbo.lms_idempotency_keys" if is_sql_server() else "lms_idempotency_keys"

    try:
        # Remove expired or abandoned stale IN_PROGRESS entries for this key
        cur.execute(
            f"""
            DELETE FROM {tbl}
            WHERE idempotency_key = ?
              AND (
                  expires_at < ?
                  OR (status = 'IN_PROGRESS' AND created_at < ?)
              )
            """,
            (key, now_utc, stale_cutoff),
        )
        conn.commit()

        # Opportunistic lightweight cleanup of expired keys (bounded)
        try:
            if is_sql_server():
                cur.execute(f"DELETE TOP (50) FROM {tbl} WHERE expires_at < ?", (now_utc,))
            else:
                cur.execute(
                    f"DELETE FROM {tbl} WHERE idempotency_key IN (SELECT idempotency_key FROM {tbl} WHERE expires_at < ? LIMIT 50)",
                    (now_utc,),
                )
            conn.commit()
        except Exception:
            conn.rollback()

        try:
            cur.execute(
                f"""
                INSERT INTO {tbl} (
                    idempotency_key, method, path, actor_id, request_hash, status, created_at, expires_at
                )
                VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?)
                """,
                (
                    key[:128],
                    method[:10],
                    path[:255],
                    (actor_id or "")[:50] or None,
                    req_hash,
                    now_utc,
                    expires_at,
                ),
            )
            conn.commit()
            return {"action": "PROCEED"}
        except Exception as ins_exc:
            conn.rollback()
            if not is_unique_violation(ins_exc):
                # Do not block normal requests if idempotency table isn't ready
                return {"action": "PROCEED"}

            cur.execute(
                f"""
                SELECT status, request_hash, response_status, response_body
                FROM {tbl}
                WHERE idempotency_key = ?
                """,
                (key[:128],),
            )
            existing = cur.fetchone()
            if not existing:
                return {"action": "CONFLICT", "detail": "Duplicate submission already in progress. Please wait."}

            ex_status, ex_hash, ex_resp_status, ex_resp_body = existing[0], existing[1], existing[2], existing[3]
            if ex_hash != req_hash:
                return {
                    "action": "CONFLICT",
                    "detail": "Idempotency key conflict: request payload differs from the original submission.",
                }
            if ex_status == "IN_PROGRESS":
                return {
                    "action": "CONFLICT",
                    "detail": "Your previous submission is still processing on the server. Please wait.",
                }
            return {
                "action": "REPLAY",
                "status_code": int(ex_resp_status or 200),
                "body": ex_resp_body or "{}",
            }
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"[Idempotency] Warning acquiring key: {e}")
        return {"action": "PROCEED"}
    finally:
        conn.close()


def _complete_key(key: str, status_code: int, body_bytes: bytes) -> None:
    """Marks key COMPLETED and stores response if 2xx, otherwise releases the lock so retries are possible."""
    conn = connect_db()
    cur = conn.cursor()
    tbl = "dbo.lms_idempotency_keys" if is_sql_server() else "lms_idempotency_keys"
    try:
        if 200 <= status_code < 300:
            body_text = None
            if len(body_bytes) <= MAX_CACHED_BODY_BYTES:
                try:
                    body_text = body_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    body_text = json.dumps({"status": "ok"})
            else:
                body_text = json.dumps({"status": "ok"})

            cur.execute(
                f"""
                UPDATE {tbl}
                SET status = 'COMPLETED',
                    response_status = ?,
                    response_body = ?
                WHERE idempotency_key = ?
                """,
                (status_code, body_text, key[:128]),
            )
        else:
            cur.execute(f"DELETE FROM {tbl} WHERE idempotency_key = ?", (key[:128],))
        conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"[Idempotency] Warning finalizing key: {e}")
    finally:
        conn.close()


def _release_key(key: str) -> None:
    """Deletes an in-progress key after an unhandled server exception."""
    conn = connect_db()
    cur = conn.cursor()
    tbl = "dbo.lms_idempotency_keys" if is_sql_server() else "lms_idempotency_keys"
    try:
        cur.execute(f"DELETE FROM {tbl} WHERE idempotency_key = ? AND status = 'IN_PROGRESS'", (key[:128],))
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()


class IdempotencyMiddleware:
    """
    Pure ASGI middleware that enforces X-Idempotency-Key across all mutating endpoints
    without interfering with CORS or multipart/form-data parsing.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = (scope.get("method") or "GET").upper()
        path = (scope.get("path") or "").rstrip("/") or "/"
        if method not in MUTATING_METHODS or is_idempotency_excluded(path):
            await self.app(scope, receive, send)
            return

        headers_map = {
            k.decode("latin-1").lower(): v.decode("latin-1")
            for k, v in (scope.get("headers") or [])
        }
        idem_key = (headers_map.get("x-idempotency-key") or "").strip()
        if not idem_key:
            await self.app(scope, receive, send)
            return

        # Buffer request body once so we can hash it and replay cleanly to FastAPI
        body_chunks = []
        while True:
            message = await receive()
            if message["type"] == "http.request":
                chunk = message.get("body", b"")
                if chunk:
                    body_chunks.append(chunk)
                if not message.get("more_body", False):
                    break
            elif message["type"] == "http.disconnect":
                break
        body_bytes = b"".join(body_chunks)

        content_type = headers_map.get("content-type", "")
        actor_id = headers_map.get("x-employee-id")
        req_hash = _compute_request_hash(method, path, content_type, body_bytes)

        scoped_key = f"{method}:{path}:{idem_key}"[:128]
        outcome = _acquire_key(scoped_key, method, path, actor_id, req_hash)

        if outcome["action"] == "CONFLICT":
            resp = JSONResponse(
                status_code=409,
                content={"detail": outcome["detail"]},
            )
            await resp(scope, receive, send)
            return

        if outcome["action"] == "REPLAY":
            resp = Response(
                content=outcome["body"],
                status_code=outcome["status_code"],
                media_type="application/json",
                headers={"X-Idempotent-Replay": "true"},
            )
            await resp(scope, receive, send)
            return

        # Replay buffered body to downstream FastAPI app while capturing response status & body
        body_sent = False

        async def replay_receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            return await receive()

        response_status = 500
        response_body_parts = []

        async def capture_send(message):
            nonlocal response_status
            if message["type"] == "http.response.start":
                response_status = message.get("status", 500)
            elif message["type"] == "http.response.body":
                part = message.get("body", b"")
                if part and sum(len(p) for p in response_body_parts) <= MAX_CACHED_BODY_BYTES:
                    response_body_parts.append(part)
            await send(message)

        try:
            await self.app(scope, replay_receive, capture_send)
            _complete_key(scoped_key, response_status, b"".join(response_body_parts))
        except Exception:
            _release_key(scoped_key)
            raise

