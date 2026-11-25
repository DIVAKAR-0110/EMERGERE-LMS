"""
Alembic migration: update lms_course_recommendation_request schema
- Alter category_id from BIGINT to INT
- Add provider_id INT NULL with FK to lms_course_providers(provider_id)
- Add target_employee_id INT NULL with FK to lms_employee_profiles(profile_id)
- Add target_employee_ids VARCHAR(MAX) NULL
- Add FK for category_id to lms_course_categories(category_id)
- Drop redundant provider_platform column
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a92b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = '73991ecc4bfc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Add provider_id column if not exists
    op.execute("""
        IF COL_LENGTH('lms_course_recommendation_request', 'provider_id') IS NULL
        BEGIN
            ALTER TABLE lms_course_recommendation_request ADD provider_id INT NULL;
        END
    """)

    # 2. Add target_employee_id column if not exists
    op.execute("""
        IF COL_LENGTH('lms_course_recommendation_request', 'target_employee_id') IS NULL
        BEGIN
            ALTER TABLE lms_course_recommendation_request ADD target_employee_id INT NULL;
        END
    """)

    # 3. Add target_employee_ids column if not exists
    op.execute("""
        IF COL_LENGTH('lms_course_recommendation_request', 'target_employee_ids') IS NULL
        BEGIN
            ALTER TABLE lms_course_recommendation_request ADD target_employee_ids VARCHAR(MAX) NULL;
        END
    """)

    # 4. Alter category_id to INT to match lms_course_categories(category_id)
    op.execute("""
        ALTER TABLE lms_course_recommendation_request ALTER COLUMN category_id INT;
    """)

    # 5. Add Foreign Key constraints
    op.execute("""
        IF OBJECT_ID('fk_lms_crecreq_provider', 'F') IS NULL
        BEGIN
            ALTER TABLE lms_course_recommendation_request
            ADD CONSTRAINT fk_lms_crecreq_provider
            FOREIGN KEY (provider_id) REFERENCES lms_course_providers(provider_id);
        END

        IF OBJECT_ID('fk_lms_crecreq_category', 'F') IS NULL
        BEGIN
            ALTER TABLE lms_course_recommendation_request
            ADD CONSTRAINT fk_lms_crecreq_category
            FOREIGN KEY (category_id) REFERENCES lms_course_categories(category_id);
        END

        IF OBJECT_ID('fk_lms_crecreq_target_emp', 'F') IS NULL
        BEGIN
            ALTER TABLE lms_course_recommendation_request
            ADD CONSTRAINT fk_lms_crecreq_target_emp
            FOREIGN KEY (target_employee_id) REFERENCES lms_employee_profiles(profile_id);
        END
    """)

    # 6. Drop redundant provider_platform column if present
    op.execute("""
        IF COL_LENGTH('lms_course_recommendation_request', 'provider_platform') IS NOT NULL
        BEGIN
            ALTER TABLE lms_course_recommendation_request DROP COLUMN provider_platform;
        END
    """)

def downgrade() -> None:
    op.execute("""
        IF OBJECT_ID('fk_lms_crecreq_provider', 'F') IS NOT NULL
            ALTER TABLE lms_course_recommendation_request DROP CONSTRAINT fk_lms_crecreq_provider;
        IF OBJECT_ID('fk_lms_crecreq_category', 'F') IS NOT NULL
            ALTER TABLE lms_course_recommendation_request DROP CONSTRAINT fk_lms_crecreq_category;
        IF OBJECT_ID('fk_lms_crecreq_target_emp', 'F') IS NOT NULL
            ALTER TABLE lms_course_recommendation_request DROP CONSTRAINT fk_lms_crecreq_target_emp;
    """)
