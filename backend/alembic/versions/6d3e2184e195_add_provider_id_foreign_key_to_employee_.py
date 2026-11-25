"""add_provider_id_foreign_key_to_employee_certifications

Revision ID: 6d3e2184e195
Revises: b1bfb82b0373
Create Date: 2026-09-28 17:45:40.612676

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d3e2184e195'
down_revision: Union[str, Sequence[str], None] = 'b1bfb82b0373'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add provider_id column and foreign key constraint."""
    # 1. Add provider_id column
    op.add_column(
        'lms_employee_certifications',
        sa.Column('provider_id', sa.Integer(), nullable=True)
    )

    # 2. Add foreign key constraint referencing lms_course_providers(provider_id)
    op.create_foreign_key(
        'fk_lms_employee_certifications_provider',
        'lms_employee_certifications',
        'lms_course_providers',
        ['provider_id'],
        ['provider_id']
    )

    # 3. Backfill provider_id by matching Issuer with provider_name
    op.execute("""
        UPDATE ec
        SET ec.provider_id = cp.provider_id
        FROM lms_employee_certifications ec
        INNER JOIN lms_course_providers cp
            ON UPPER(LTRIM(RTRIM(ec.[Issuer]))) = UPPER(LTRIM(RTRIM(cp.provider_name)))
    """)


def downgrade() -> None:
    """Downgrade schema: Drop foreign key and provider_id column."""
    op.drop_constraint(
        'fk_lms_employee_certifications_provider',
        'lms_employee_certifications',
        type_='foreignkey'
    )
    op.drop_column('lms_employee_certifications', 'provider_id')
