"""alter estimated_cost to int in lms_certification_requests

Revision ID: q2e3f4a5b6c7
Revises: p1d2e3f4a5b6
Create Date: 2026-10-08 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'q2e3f4a5b6c7'
down_revision = 'p1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    # Alter estimated_cost from DECIMAL(10,2) to INT in dbo.lms_certification_requests
    op.execute("""
        IF OBJECT_ID('dbo.lms_certification_requests', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.lms_certification_requests', 'estimated_cost') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_certification_requests ALTER COLUMN estimated_cost INT NULL;
            END
        END
    """)


def downgrade():
    op.execute("""
        IF OBJECT_ID('dbo.lms_certification_requests', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.lms_certification_requests', 'estimated_cost') IS NOT NULL
            BEGIN
                ALTER TABLE dbo.lms_certification_requests ALTER COLUMN estimated_cost DECIMAL(10,2) NULL;
            END
        END
    """)
