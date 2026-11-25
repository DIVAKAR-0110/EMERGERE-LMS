"""
Authentication utilities and FastAPI dependencies.
Validates Microsoft Entra ID JWT Bearer tokens and extracts authenticated employee profiles.
"""

import time
import requests
import jwt
from jwt.algorithms import RSAAlgorithm
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import config
from services.common.auth_service import employee_service

# Cache for Microsoft JWKS keys
_JWKS_CACHE = {
    "keys": [],
    "timestamp": 0
}
CACHE_TTL_SECONDS = 3600

bearer_scheme = HTTPBearer(auto_error=False)

def get_microsoft_jwks():
    """Fetches Microsoft public signing keys (JWKS) with caching."""
    global _JWKS_CACHE
    now = time.time()
    
    if _JWKS_CACHE["keys"] and (now - _JWKS_CACHE["timestamp"] < CACHE_TTL_SECONDS):
        return _JWKS_CACHE["keys"]
        
    try:
        response = requests.get(config.MICROSOFT_JWKS_URL, timeout=10)
        response.raise_for_status()
        data = response.json()
        keys = data.get("keys", [])
        if keys:
            _JWKS_CACHE["keys"] = keys
            _JWKS_CACHE["timestamp"] = now
            return keys
    except Exception as e:
        if _JWKS_CACHE["keys"]:
            return _JWKS_CACHE["keys"]
        raise RuntimeError(f"Failed to fetch Microsoft JWKS: {str(e)}")
        
    return _JWKS_CACHE["keys"]

def validate_microsoft_token(token: str) -> dict:
    """
    Validates a Microsoft JWT token (ID token or Access token from MSAL).
    Supports developer mock tokens when ENABLE_DEV_MOCK_AUTH is True.
    """
    if not token or not isinstance(token, str):
        raise ValueError("Missing or invalid token string")

    # Developer / Mock token shortcut
    if config.ENABLE_DEV_MOCK_AUTH and token.startswith("dev-token-"):
        identifier = token.replace("dev-token-", "").strip()
        return {
            "dev_mode": True,
            "preferred_username": identifier if "@" in identifier else f"{identifier.lower()}@company.com",
            "oid": f"mock-oid-{identifier}",
            "name": f"Mock {identifier}",
            "employee_id": identifier
        }

    # Step 1: Decode header to find Key ID (kid)
    try:
        header = jwt.get_unverified_header(token)
    except Exception as e:
        raise ValueError(f"Failed to read token header: {str(e)}")

    kid = header.get("kid")
    if not kid:
        raise ValueError("Token header does not contain 'kid'")

    # Step 2: Retrieve JWKS and locate matching public key
    keys = get_microsoft_jwks()
    matching_key = next((k for k in keys if k.get("kid") == kid), None)
    
    if not matching_key:
        _JWKS_CACHE["timestamp"] = 0
        keys = get_microsoft_jwks()
        matching_key = next((k for k in keys if k.get("kid") == kid), None)

    if not matching_key:
        raise ValueError(f"Matching signing key with kid '{kid}' not found in Microsoft JWKS")

    # Step 3: Construct RSA Public Key
    try:
        public_key = RSAAlgorithm.from_jwk(matching_key)
    except Exception as e:
        raise ValueError(f"Failed to construct RSA public key: {str(e)}")

    expected_audiences = [
        config.MICROSOFT_CLIENT_ID,
        f"api://{config.MICROSOFT_CLIENT_ID}",
        "00000003-0000-0000-c000-000000000000"
    ]

    last_error = None
    for audience in expected_audiences:
        try:
            payload = jwt.decode(
                token,
                key=public_key,
                algorithms=["RS256"],
                audience=audience,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": False,
                    "verify_nbf": True,
                }
            )
            token_issuer = payload.get("iss", "")
            valid_issuer = any(
                token_issuer.startswith(iss.rstrip("/"))
                for iss in config.VALID_ISSUERS
            )
            if not valid_issuer:
                last_error = ValueError(f"Token issuer '{token_issuer}' does not match configured Microsoft Tenant ID")
                continue

            oid = payload.get("oid") or payload.get("sub")
            if not oid:
                last_error = ValueError("Token does not contain 'oid' or 'sub' claim")
                continue

            return payload

        except jwt.ExpiredSignatureError:
            raise ValueError("Microsoft authentication token has expired. Please sign in again.")
        except jwt.InvalidAudienceError:
            last_error = None
            continue
        except jwt.InvalidTokenError as e:
            last_error = ValueError(f"Invalid Microsoft token: {str(e)}")
            continue

    if last_error:
        raise last_error
    raise ValueError("Token audience does not match any expected Microsoft Client ID")

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Dict[str, Any]:
    """
    FastAPI dependency that extracts and validates the Microsoft Entra ID JWT Bearer token,
    or resolves user via x-employee-id header (in dev/test mode),
    then resolves the corresponding user from Microsoft Entra ID via employee_service.
    """
    # 1. Check for X-Employee-Id header (for dev/test or explicit user context)
    x_emp = request.headers.get("x-employee-id") or request.headers.get("x-user-id")
    if x_emp:
        found_emp = employee_service.get_employee_by_id(x_emp)
        if not found_emp and "@" in x_emp:
            found_emp = employee_service.get_employee_by_email(x_emp)
        if found_emp:
            found_emp["access_profile"] = employee_service.get_access_profile(found_emp)
            return found_emp

    # 2. Check Bearer Token
    if credentials and credentials.credentials:
        token = credentials.credentials
        try:
            claims = validate_microsoft_token(token)
            user = employee_service.find_employee_by_claims(claims)
            if not user and claims.get("dev_mode"):
                emp_id = claims.get("employee_id")
                if emp_id:
                    user = employee_service.get_employee_by_id(emp_id)
            if user:
                user["access_profile"] = employee_service.get_access_profile(user)
                return user
        except Exception as e:
            if not config.ENABLE_DEV_MOCK_AUTH:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Token validation failed: {str(e)}",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_employee_id(
    current_user: Optional[Dict[str, Any]] = None,
    explicit_id: Optional[Any] = None,
) -> str:
    """
    Strictly resolves a valid employee_id from an explicit caller value or the
    authenticated current_user dict. Never falls back to a hardcoded employee.
    """
    candidate = None
    if explicit_id is not None and str(explicit_id).strip():
        raw = str(explicit_id).strip()
        if raw.upper() not in ("SYSTEM", "NONE", "NULL"):
            candidate = raw

    if not candidate and isinstance(current_user, dict):
        for key in ("employee_id", "Emp_Obj_Id", "emp_id"):
            val = current_user.get(key)
            if val and str(val).strip():
                candidate = str(val).strip()
                break

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated employee identifier is required.",
        )

    if candidate.isdigit():
        candidate = f"EMP{int(candidate):03d}"

    return candidate[:7]

def get_current_user_email(user: Dict[str, Any] = Depends(get_current_user)) -> str:
    """FastAPI dependency returning the current authenticated user's email address."""
    return user.get("work_email") or user.get("email") or ""
