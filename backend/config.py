import os
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
else:
    root_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(root_env):
        load_dotenv(root_env, override=True)
    else:
        load_dotenv(override=True)

class Config:
    MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "c0f0ca41-d3de-4e5e-805f-694fb712c61d")
    MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "ed46c376-8c4e-4be3-be8f-c8d60026c6b2")
    MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
    TEST_MICROSOFT_ACCOUNT_EMAIL = os.getenv("TEST_MICROSOFT_ACCOUNT_EMAIL", "rdivakar0110@outlook.com")
    
    # Personal Outlook Delegated OAuth Configuration
    OUTLOOK_CLIENT_ID = os.getenv("OUTLOOK_CLIENT_ID", "91a87758-fad3-4d70-a8db-b1a486a7b9df")
    OUTLOOK_CLIENT_SECRET = os.getenv("OUTLOOK_CLIENT_SECRET", "")
    OUTLOOK_TENANT_ID = os.getenv("OUTLOOK_TENANT_ID", "common")
    OUTLOOK_REDIRECT_URI = os.getenv("OUTLOOK_REDIRECT_URI", "http://localhost:5000/api/auth/callback")
    
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    ALLOWED_ORIGINS = [
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:5000",
        "http://localhost:3000",
        "http://127.0.0.1:5000",
        "http://127.0.0.1:3000",
    ]
    
    SECRET_KEY = os.getenv("SECRET_KEY", "lms-super-secret-key-change-in-production")
    
    # Discovery endpoints
    MICROSOFT_OPENID_CONFIG_URL = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/v2.0/.well-known/openid-configuration"
    MICROSOFT_JWKS_URL = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/discovery/v2.0/keys"
    
    # Expected token issuers
    VALID_ISSUERS = [
        f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/v2.0",
        f"https://sts.windows.net/{MICROSOFT_TENANT_ID}/"
    ]
    
    # Dev / Test token support
    ENABLE_DEV_MOCK_AUTH = os.getenv("ENABLE_DEV_MOCK_AUTH", "true").lower() in ("true", "1", "yes")

    # MS SQL Server Database Configuration
    DB_SERVER = os.getenv("DB_SERVER", ".\\SQL2008")
    DB_NAME = os.getenv("DB_NAME", "LMS")
    DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
    _raw_trusted = os.getenv("DB_TRUSTED_CONNECTION", "yes").strip().lower()
    DB_TRUSTED_CONNECTION = "yes" if _raw_trusted in ("yes", "true", "1") else "no"
    IS_TRUSTED_CONNECTION = (DB_TRUSTED_CONNECTION == "yes")
    DB_USER = os.getenv("DB_USER", "sa")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")

    # L&D Team Emails for dynamic role assignment
    LD_TEAM_EMAILS = [
        e.strip().lower()
        for e in os.getenv("LD_TEAM_EMAILS", "").split(",")
        if e.strip()
    ]

    # OpenRouter AI Assistant Configuration
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
    OPENROUTER_FALLBACK_MODEL = os.getenv("OPENROUTER_FALLBACK_MODEL", "cohere/north-mini-code:free")
    OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000")
    OPENROUTER_SITE_NAME = os.getenv("OPENROUTER_SITE_NAME", "Emergere_LMS_Assistant")

config = Config()
