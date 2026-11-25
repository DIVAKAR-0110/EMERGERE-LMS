"""
Microsoft Graph API Service.
Handles delegated and application-level OAuth2 token acquisition and inbox message querying
for automated OTP retrieval on both personal (@outlook.com) and corporate Microsoft accounts.
"""

import os
import re
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
import urllib.request
import urllib.parse
from config import config

class MicrosoftGraphService:
    def __init__(self):
        self.tenant_id = getattr(config, "MICROSOFT_TENANT_ID", "ed46c376-8c4e-4be3-be8f-c8d60026c6b2")
        self.client_id = getattr(config, "MICROSOFT_CLIENT_ID", "c0f0ca41-d3de-4e5e-805f-694fb712c61d")
        self.client_secret = getattr(config, "MICROSOFT_CLIENT_SECRET", "")
        self.default_account = getattr(config, "TEST_MICROSOFT_ACCOUNT_EMAIL", "rdivakar0110@outlook.com")

        # Personal Outlook OAuth App configuration
        self.outlook_client_id = getattr(config, "OUTLOOK_CLIENT_ID", "91a87758-fad3-4d70-a8db-b1a486a7b9df")
        self.outlook_client_secret = getattr(config, "OUTLOOK_CLIENT_SECRET", "")
        self.outlook_tenant = getattr(config, "OUTLOOK_TENANT_ID", "common")
        self.outlook_redirect_uri = getattr(config, "OUTLOOK_REDIRECT_URI", "http://localhost:5000/api/auth/callback")

        # Secure local token persistence
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.tokens_dir = os.path.join(backend_dir, "tokens")
        self.token_file = os.path.join(self.tokens_dir, "outlook_token.json")

        self._cached_app_token = None
        self._app_token_expiry = 0
        self._manual_otps = {}

    def exchange_auth_code_for_token(self, code: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Exchanges OAuth authorization code for personal Microsoft account tokens,
        persisting the refresh token for automated background OTP polling.
        """
        token_url = f"https://login.microsoftonline.com/{self.outlook_tenant}/oauth2/v2.0/token"
        payload = urllib.parse.urlencode({
            "client_id": self.outlook_client_id,
            "client_secret": self.outlook_client_secret,
            "code": code,
            "redirect_uri": self.outlook_redirect_uri,
            "grant_type": "authorization_code",
            "scope": "offline_access User.Read Mail.Read Mail.Send"
        }).encode("utf-8")

        req = urllib.request.Request(token_url, data=payload, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                token_res = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as http_err:
            err_body = http_err.read().decode("utf-8")
            raise RuntimeError(f"Token exchange failed ({http_err.code}): {err_body}")

        access_token = token_res.get("access_token")
        refresh_token = token_res.get("refresh_token")
        expires_in = token_res.get("expires_in", 3600)
        expires_at = time.time() + expires_in

        # Fetch connected user profile
        profile = {}
        try:
            me_req = urllib.request.Request("https://graph.microsoft.com/v1.0/me", method="GET")
            me_req.add_header("Authorization", f"Bearer {access_token}")
            me_req.add_header("Accept", "application/json")
            with urllib.request.urlopen(me_req, timeout=10) as me_resp:
                profile = json.loads(me_resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[MSGraph] Notice querying /me profile: {e}")

        # Store token securely in JSON file
        os.makedirs(self.tokens_dir, exist_ok=True)
        token_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "account_email": profile.get("mail") or profile.get("userPrincipalName") or self.default_account,
            "display_name": profile.get("displayName", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        with open(self.token_file, "w", encoding="utf-8") as f:
            json.dump(token_data, f, indent=2)

        return token_data, profile

    def get_delegated_token(self) -> Optional[str]:
        """
        Retrieves a valid delegated OAuth access token for personal Outlook,
        automatically refreshing if expired using the saved refresh token.
        """
        if not os.path.exists(self.token_file):
            return None

        try:
            with open(self.token_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            return None

        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        expires_at = data.get("expires_at", 0)

        # Still valid for more than 60 seconds
        if access_token and time.time() < (expires_at - 60):
            return access_token

        # Need to refresh
        if not refresh_token:
            return None

        token_url = f"https://login.microsoftonline.com/{self.outlook_tenant}/oauth2/v2.0/token"
        payload = urllib.parse.urlencode({
            "client_id": self.outlook_client_id,
            "client_secret": self.outlook_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": "offline_access User.Read Mail.Read Mail.Send"
        }).encode("utf-8")

        req = urllib.request.Request(token_url, data=payload, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                new_token_res = json.loads(resp.read().decode("utf-8"))
                new_access_token = new_token_res.get("access_token")
                new_refresh = new_token_res.get("refresh_token") or refresh_token
                new_expires_in = new_token_res.get("expires_in", 3600)

                data["access_token"] = new_access_token
                data["refresh_token"] = new_refresh
                data["expires_at"] = time.time() + new_expires_in
                data["updated_at"] = datetime.now(timezone.utc).isoformat()

                with open(self.token_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)

                return new_access_token
        except Exception as e:
            print(f"[MSGraph] Failed to refresh delegated token: {e}")
            return None

    def get_delegated_account_info(self) -> Dict[str, Any]:
        """Returns details about the currently connected delegated Outlook account."""
        if not os.path.exists(self.token_file):
            return {
                "connected": False,
                "login_url": "http://localhost:5000/api/auth/outlook/login"
            }
        try:
            with open(self.token_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {
                "connected": True,
                "email": data.get("account_email", self.default_account),
                "name": data.get("display_name", ""),
                "expires_at": data.get("expires_at"),
                "is_expired": time.time() >= data.get("expires_at", 0)
            }
        except Exception:
            return {"connected": False, "login_url": "http://localhost:5000/api/auth/outlook/login"}

    def set_manual_otp(self, email: str, otp: str):
        """Sets a manual OTP override for testing."""
        clean_email = (email or self.default_account).strip().lower()
        self._manual_otps[clean_email] = {
            "otp": str(otp).strip(),
            "timestamp": time.time()
        }

    def get_access_token(self) -> str:
        """Acquires an app-only OAuth2 access token for Microsoft Graph using client credentials (corporate mailboxes)."""
        now = time.time()
        if self._cached_app_token and now < (self._app_token_expiry - 60):
            return self._cached_app_token

        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        data = urllib.parse.urlencode({
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }).encode("utf-8")

        req = urllib.request.Request(token_url, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_body = json.loads(resp.read().decode("utf-8"))
                self._cached_app_token = res_body.get("access_token")
                expires_in = res_body.get("expires_in", 3600)
                self._app_token_expiry = now + expires_in
                return self._cached_app_token
        except urllib.error.HTTPError as http_err:
            err_text = http_err.read().decode("utf-8")
            raise RuntimeError(f"Microsoft OAuth token error ({http_err.code}): {err_text}")
        except Exception as e:
            raise RuntimeError(f"Failed to acquire Microsoft Graph token: {str(e)}")

    def get_latest_inbox_messages(self, user_email: Optional[str] = None, top: int = 5) -> List[Dict[str, Any]]:
        """
        Fetches the latest inbox messages.
        Prioritizes Delegated OAuth token (supports personal @outlook.com and corporate),
        falling back to Application credentials if configured for corporate tenant.
        """
        target_email = (user_email or self.default_account).strip().lower()

        # 1. Try delegated token first (required for personal @outlook.com, works universally)
        delegated_token = self.get_delegated_token()
        if delegated_token:
            endpoints = [
                f"https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top={top}&$orderby=receivedDateTime%20desc",
                f"https://graph.microsoft.com/v1.0/me/messages?$top={top}&$orderby=receivedDateTime%20desc"
            ]
            last_err = None
            for url in endpoints:
                try:
                    req = urllib.request.Request(url, method="GET")
                    req.add_header("Authorization", f"Bearer {delegated_token}")
                    req.add_header("Accept", "application/json")
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        res_body = json.loads(resp.read().decode("utf-8"))
                        return res_body.get("value", [])
                except urllib.error.HTTPError as http_err:
                    last_err = http_err.read().decode("utf-8")
                except Exception as e:
                    last_err = str(e)

            if last_err:
                raise RuntimeError(f"Microsoft Graph API error reading messages via delegated token: {last_err}")

        # 2. If no delegated token, and target is personal account, inform user to authorize once
        if target_email.endswith("@outlook.com") or target_email.endswith("@hotmail.com") or target_email.endswith("@live.com"):
            raise RuntimeError(
                f"Account '{target_email}' is a personal Microsoft account and requires one-time OAuth authorization. "
                f"Please open http://localhost:5000/api/auth/outlook/login in your browser to connect your mailbox."
            )

        # 3. Fallback to Application token for corporate mailboxes
        token = self.get_access_token()
        graph_url = f"https://graph.microsoft.com/v1.0/users/{urllib.parse.quote(target_email)}/mailFolders/inbox/messages?$top={top}&$orderby=receivedDateTime%20desc"
        req = urllib.request.Request(graph_url, method="GET")
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Accept", "application/json")

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_body = json.loads(resp.read().decode("utf-8"))
                return res_body.get("value", [])
        except urllib.error.HTTPError as http_err:
            err_text = http_err.read().decode("utf-8")
            raise RuntimeError(f"Microsoft Graph API error reading inbox for '{target_email}' ({http_err.code}): {err_text}")
        except Exception as e:
            raise RuntimeError(f"Failed to fetch inbox messages for '{target_email}': {str(e)}")

    def extract_otp_from_text(self, text: str) -> Optional[str]:
        """Extracts OTP verification code from email body or subject."""
        if not text:
            return None

        clean_text = re.sub(r"<[^>]+>", " ", text)

        phrase_patterns = [
            r"(?:verification\s+code|security\s+code|login\s+code|passcode|one-time\s+password|otp)\s*(?:is|:|-)?\s*(\b\d{4,8}\b)",
            r"(?:code\s*[:\s-]\s*)(\b\d{4,8}\b)",
            r"(?:enter\s+)(\b\d{4,8}\b)",
            r"\b(\d{6})\b"  # Most common standard 6-digit verification code
        ]

        for pat in phrase_patterns:
            match = re.search(pat, clean_text, re.IGNORECASE)
            if match:
                return match.group(1)

        fallback = re.search(r"\b\d{4,8}\b", clean_text)
        return fallback.group(0) if fallback else None

    def get_latest_otp(
        self,
        user_email: Optional[str] = None,
        max_age_minutes: int = 5,
        since_iso: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Polls for the latest OTP sent to the target email within max_age_minutes.
        Returns: { "found": bool, "otp": str, "subject": str, "received_at": str, "email": str }
        """
        target_email = (user_email or self.default_account).strip().lower()

        # Check manual test override OTP first
        if target_email in self._manual_otps:
            entry = self._manual_otps[target_email]
            if time.time() - entry["timestamp"] < (max_age_minutes * 60):
                return {
                    "found": True,
                    "otp": entry["otp"],
                    "subject": "Manual / Test Override OTP",
                    "received_at": datetime.now(timezone.utc).isoformat(),
                    "email": target_email,
                    "sender": "lms-admin"
                }

        try:
            messages = self.get_latest_inbox_messages(target_email, top=5)
        except Exception as e:
            return {
                "found": False,
                "otp": None,
                "error": str(e),
                "message": f"Could not read inbox for '{target_email}': {str(e)}",
                "email": target_email
            }

        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
        if since_iso:
            try:
                parsed_since = datetime.fromisoformat(since_iso.replace("Z", "+00:00"))
                if parsed_since > cutoff_time:
                    cutoff_time = parsed_since
            except Exception:
                pass

        for msg in messages:
            received_str = msg.get("receivedDateTime")
            if not received_str:
                continue

            try:
                received_dt = datetime.fromisoformat(received_str.replace("Z", "+00:00"))
            except Exception:
                received_dt = datetime.now(timezone.utc)

            # Check if message is recent
            if received_dt >= cutoff_time:
                subject = msg.get("subject", "")
                body_content = msg.get("body", {}).get("content", "")
                body_preview = msg.get("bodyPreview", "")

                otp = (
                    self.extract_otp_from_text(subject) or
                    self.extract_otp_from_text(body_preview) or
                    self.extract_otp_from_text(body_content)
                )

                if otp:
                    return {
                        "found": True,
                        "otp": otp,
                        "subject": subject,
                        "received_at": received_str,
                        "email": target_email,
                        "sender": msg.get("from", {}).get("emailAddress", {}).get("address", "unknown")
                    }

        return {
            "found": False,
            "otp": None,
            "message": f"No recent OTP verification email found for '{target_email}' in the last {max_age_minutes} minutes.",
            "email": target_email
        }

    def send_mail(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        sender_email: Optional[str] = None,
        save_to_sent_items: bool = True
    ) -> Dict[str, Any]:
        """
        Sends an HTML email via Microsoft Graph API (/me/sendMail or /users/{sender}/sendMail).
        Attempts Delegated OAuth token first (personal/delegated Outlook), falling back
        to Application Client Credentials if configured for corporate Exchange Online.
        """
        if not to_email or "@" not in str(to_email):
            return {"success": False, "method": "none", "error": f"Invalid recipient email: '{to_email}'"}

        payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_body
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": str(to_email).strip()
                        }
                    }
                ]
            },
            "saveToSentItems": save_to_sent_items
        }
        body_bytes = json.dumps(payload).encode("utf-8")

        # 1. Try Delegated Token (/me/sendMail)
        delegated_token = self.get_delegated_token()
        if delegated_token:
            try:
                req = urllib.request.Request(
                    "https://graph.microsoft.com/v1.0/me/sendMail",
                    data=body_bytes,
                    method="POST"
                )
                req.add_header("Authorization", f"Bearer {delegated_token}")
                req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status in (200, 202, 204):
                        return {"success": True, "method": "delegated", "error": None}
            except urllib.error.HTTPError as http_err:
                err_txt = http_err.read().decode("utf-8", errors="ignore")
                print(f"[MSGraph] Delegated sendMail error ({http_err.code}): {err_txt}")
                # Fall through to application token if delegated lacks Mail.Send permission
            except Exception as ex:
                print(f"[MSGraph] Delegated sendMail failed: {ex}")

        # 2. Fallback to Application Token (/users/{sender}/sendMail)
        target_sender = (sender_email or self.default_account or "").strip()
        if target_sender:
            try:
                app_token = self.get_access_token()
                encoded_sender = urllib.parse.quote(target_sender)
                req = urllib.request.Request(
                    f"https://graph.microsoft.com/v1.0/users/{encoded_sender}/sendMail",
                    data=body_bytes,
                    method="POST"
                )
                req.add_header("Authorization", f"Bearer {app_token}")
                req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status in (200, 202, 204):
                        return {"success": True, "method": "application", "error": None}
            except urllib.error.HTTPError as http_err:
                err_txt = http_err.read().decode("utf-8", errors="ignore")
                return {
                    "success": False,
                    "method": "application",
                    "error": f"Graph API HTTP {http_err.code}: {err_txt}"
                }
            except Exception as ex:
                return {"success": False, "method": "application", "error": str(ex)}

        return {
            "success": False,
            "method": "none",
            "error": "No valid Microsoft Graph token or sender email available for sendMail."
        }

    def test_connection(self, user_email: Optional[str] = None) -> Dict[str, Any]:
        """Diagnostic method to verify Microsoft Graph API access for personal or corporate account."""
        target_email = (user_email or self.default_account).strip().lower()
        delegated_info = self.get_delegated_account_info()
        messages = self.get_latest_inbox_messages(target_email, top=3)
        return {
            "status": "success",
            "auth_type": "Delegated (Personal/Consumer OAuth)" if delegated_info.get("connected") else "Application (Client Credentials)",
            "message": f"Successfully authenticated with Microsoft Graph API and queried inbox for {target_email}",
            "delegated_account": delegated_info,
            "target_account": target_email,
            "messages_count": len(messages),
            "recent_subjects": [m.get("subject", "No Subject") for m in messages]
        }

ms_graph_service = MicrosoftGraphService()
