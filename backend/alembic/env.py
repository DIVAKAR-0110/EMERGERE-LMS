import os
import sys
import urllib.parse
from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from alembic import context

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from config import config as app_config

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Build SQL Server connection string
is_trusted = getattr(app_config, "IS_TRUSTED_CONNECTION", app_config.DB_TRUSTED_CONNECTION == "yes")
if is_trusted:
    conn_str = f"DRIVER={{{app_config.DB_DRIVER}}};SERVER={app_config.DB_SERVER};DATABASE={app_config.DB_NAME};Trusted_Connection=yes;TrustServerCertificate=yes;"
else:
    conn_str = f"DRIVER={{{app_config.DB_DRIVER}}};SERVER={app_config.DB_SERVER};DATABASE={app_config.DB_NAME};UID={app_config.DB_USER};PWD={app_config.DB_PASSWORD};TrustServerCertificate=yes;"

params = urllib.parse.quote_plus(conn_str)
db_url = f"mssql+pyodbc:///?odbc_connect={params}"

config.set_main_option("sqlalchemy.url", db_url.replace("%", "%%"))

target_metadata = None

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(
        db_url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
