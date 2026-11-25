"""remove updated_at from lms_certification_requests

Revision ID: l7f8a9b0c1d2
Revises: k6e7f8a9b0c1
Create Date: 2026-10-07 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l7f8a9b0c1d2'
down_revision: Union[str, None] = 'k6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        IF COL_LENGTH('dbo.lms_certification_requests', 'updated_at') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_certification_requests DROP COLUMN updated_at;
        END
    """)


def downgrade() -> None:
    op.execute("""
        IF COL_LENGTH('dbo.lms_certification_requests', 'updated_at') IS NULL
        BEGIN
            ALTER TABLE dbo.lms_certification_requests ADD updated_at DATETIME NULL;
        END
    """)
