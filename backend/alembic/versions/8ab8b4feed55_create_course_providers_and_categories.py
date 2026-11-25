"""create_course_providers_and_categories

Revision ID: 8ab8b4feed55
Revises: 
Create Date: 2026-09-21 12:03:36.424692

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8ab8b4feed55'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include course_providers and course_categories."""
    
    # 1. Create course_providers
    op.execute("""
    IF OBJECT_ID('course_providers', 'U') IS NULL
    BEGIN
        CREATE TABLE course_providers (
            provider_id INT IDENTITY(1,1) PRIMARY KEY,

            provider_code VARCHAR(12) NOT NULL,
            provider_name VARCHAR(150) NOT NULL,
            description VARCHAR(MAX) NULL,

            website_url VARCHAR(255) NULL,
            logo_url VARCHAR(500) NULL,

            is_active BIT NOT NULL DEFAULT 1,

            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT uq_course_provider_code
                UNIQUE (provider_code),

            CONSTRAINT uq_course_provider_name
                UNIQUE (provider_name),

            CONSTRAINT chk_course_provider_code
                CHECK (
                    provider_code LIKE 'CRS-PROV-[0-9][0-9][0-9]'
                )
        );
    END;
    """)

    # 1b. Trigger for course_providers uppercase
    op.execute("""
    IF OBJECT_ID('trg_course_providers_uppercase', 'TR') IS NULL
    BEGIN
        EXEC('
        CREATE TRIGGER trg_course_providers_uppercase
        ON course_providers
        AFTER INSERT, UPDATE
        AS
        BEGIN
            SET NOCOUNT ON;
            IF UPDATE(provider_name)
            BEGIN
                UPDATE cp
                SET provider_name = UPPER(i.provider_name),
                    updated_at = SYSDATETIME()
                FROM course_providers cp
                INNER JOIN inserted i ON cp.provider_id = i.provider_id;
            END
        END
        ');
    END;
    """)

    # 2. Create course_categories
    op.execute("""
    IF OBJECT_ID('course_categories', 'U') IS NULL
    BEGIN
        CREATE TABLE course_categories (
            category_id INT IDENTITY(1,1) PRIMARY KEY,

            category_code AS (
                'CRS-CAT-' +
                RIGHT(
                    '000' + CAST(category_id AS VARCHAR(3)),
                    3
                )
            ) PERSISTED,

            category_name VARCHAR(100) NOT NULL,
            description VARCHAR(MAX) NULL,

            badge_bg_color VARCHAR(20) NOT NULL DEFAULT '#EBF3FF',
            badge_text_color VARCHAR(20) NOT NULL DEFAULT '#2563EB',

            icon_type VARCHAR(40) NOT NULL DEFAULT 'development',

            display_order INT NOT NULL DEFAULT 0,

            is_active BIT NOT NULL DEFAULT 1,

            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT uq_course_category_name
                UNIQUE (category_name)
        );
    END;
    """)

    # 2b. Trigger for course_categories uppercase
    op.execute("""
    IF OBJECT_ID('trg_course_categories_uppercase', 'TR') IS NULL
    BEGIN
        EXEC('
        CREATE TRIGGER trg_course_categories_uppercase
        ON course_categories
        AFTER INSERT, UPDATE
        AS
        BEGIN
            SET NOCOUNT ON;
            IF UPDATE(category_name)
            BEGIN
                UPDATE cc
                SET category_name = UPPER(i.category_name),
                    updated_at = SYSDATETIME()
                FROM course_categories cc
                INNER JOIN inserted i ON cc.category_id = i.category_id;
            END
        END
        ');
    END;
    """)


def downgrade() -> None:
    """Downgrade schema: drop triggers and tables."""
    op.execute("IF OBJECT_ID('trg_course_categories_uppercase', 'TR') IS NOT NULL DROP TRIGGER trg_course_categories_uppercase;")
    op.execute("IF OBJECT_ID('course_categories', 'U') IS NOT NULL DROP TABLE course_categories;")
    op.execute("IF OBJECT_ID('trg_course_providers_uppercase', 'TR') IS NOT NULL DROP TRIGGER trg_course_providers_uppercase;")
    op.execute("IF OBJECT_ID('course_providers', 'U') IS NOT NULL DROP TABLE course_providers;")
