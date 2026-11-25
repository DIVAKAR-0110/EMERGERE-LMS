"""refactor lms_reimbursement_claims schema

Revision ID: o0c1d2e3f4a5
Revises: n9b0c1d2e3f4
Create Date: 2026-10-07 17:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'o0c1d2e3f4a5'
down_revision: Union[str, None] = 'n9b0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        IF OBJECT_ID('dbo.lms_reimbursement_claims', 'U') IS NOT NULL
        BEGIN
            -- 1. Ensure provider has latest data from provider_name before dropping provider_name
            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'provider_name') IS NOT NULL
            BEGIN
                UPDATE dbo.lms_reimbursement_claims
                SET provider = COALESCE(NULLIF(provider_name, ''), provider)
                WHERE provider IS NULL OR provider = '';
            END

            -- 2. Widen provider column to VARCHAR(150)
            ALTER TABLE dbo.lms_reimbursement_claims
            ALTER COLUMN provider VARCHAR(150) NULL;

            -- 3. Drop redundant columns
            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'created_by') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN created_by;
            END

            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'updated_at') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN updated_at;
            END

            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'updated_by') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN updated_by;
            END

            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'provider_name') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN provider_name;
            END

            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'comments') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN comments;
            END
        END
    """)


def downgrade() -> None:
    pass
