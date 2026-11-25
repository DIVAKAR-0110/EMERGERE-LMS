"""alter amount to int in lms_reimbursement_claims

Revision ID: r3f4a5b6c7d8
Revises: q2e3f4a5b6c7
Create Date: 2026-10-08 11:42:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'r3f4a5b6c7d8'
down_revision = 'q2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    # Alter amount from DECIMAL(10,2) to INT in dbo.lms_reimbursement_claims
    op.execute("""
        IF OBJECT_ID('dbo.lms_reimbursement_claims', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'amount') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_reimbursement_claims ALTER COLUMN amount INT NOT NULL;
            END
        END
    """)


def downgrade():
    op.execute("""
        IF OBJECT_ID('dbo.lms_reimbursement_claims', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.lms_reimbursement_claims', 'amount') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_reimbursement_claims ALTER COLUMN amount DECIMAL(10,2) NOT NULL;
            END
        END
    """)
