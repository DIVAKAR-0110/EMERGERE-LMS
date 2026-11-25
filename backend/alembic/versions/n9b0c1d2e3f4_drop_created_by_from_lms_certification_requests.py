"""drop created_by from lms_certification_requests

Revision ID: n9b0c1d2e3f4
Revises: m8a9b0c1d2e3
Create Date: 2026-10-07 17:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n9b0c1d2e3f4'
down_revision: Union[str, None] = 'm8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        IF OBJECT_ID('dbo.lms_certification_requests', 'U') IS NOT NULL
        BEGIN
            -- 1. Drop foreign key constraint on created_by if present
            IF OBJECT_ID('dbo.FK_lms_certification_requests_created_by', 'F') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_certification_requests 
                DROP CONSTRAINT FK_lms_certification_requests_created_by;
            END

            -- Also check alternative naming FK_lms_cert_req_created_by
            IF OBJECT_ID('dbo.FK_lms_cert_req_created_by', 'F') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_certification_requests 
                DROP CONSTRAINT FK_lms_cert_req_created_by;
            END

            -- 2. Drop column created_by
            IF COL_LENGTH('dbo.lms_certification_requests', 'created_by') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_certification_requests 
                DROP COLUMN created_by;
            END
        END
    """)


def downgrade() -> None:
    op.execute("""
        IF OBJECT_ID('dbo.lms_certification_requests', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.lms_certification_requests', 'created_by') IS NULL
            BEGIN
                ALTER TABLE dbo.lms_certification_requests ADD created_by VARCHAR(7) NULL;
            END
        END
    """)
