"""allow pending and on hold in course enrollments status

Revision ID: h3b4c5d6e7f8
Revises: g2a3b4c5d6e7
Create Date: 2026-10-07 14:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h3b4c5d6e7f8'
down_revision: Union[str, None] = 'g2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop existing CK_lms_course_enrollments_status constraint if present
    op.execute("""
        IF OBJECT_ID('dbo.CK_lms_course_enrollments_status', 'C') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments DROP CONSTRAINT CK_lms_course_enrollments_status;
        END
    """)

    # 2. Add new CK_lms_course_enrollments_status constraint allowing 'Pending' and 'On Hold'
    op.execute("""
        ALTER TABLE dbo.lms_course_enrollments
        ADD CONSTRAINT CK_lms_course_enrollments_status
        CHECK (status IN ('Assigned', 'Pending', 'On Hold', 'Not Started', 'In Progress', 'Completed'));
    """)

    # 3. Synchronize existing approved enrollment requests to 'Not Started' for 0% progress courses
    op.execute("""
        UPDATE ce
        SET ce.status = 'Not Started'
        FROM dbo.lms_course_enrollments ce
        JOIN dbo.lms_enrollment_requests er ON ce.course_id = er.course_id AND LOWER(ce.employee_id) = LOWER(er.employee_id)
        WHERE er.status = 'Approved' 
          AND ce.status IN ('Assigned', 'Pending')
          AND (ce.progress_percentage IS NULL OR ce.progress_percentage = 0);
    """)


def downgrade() -> None:
    op.execute("""
        IF OBJECT_ID('dbo.CK_lms_course_enrollments_status', 'C') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments DROP CONSTRAINT CK_lms_course_enrollments_status;
        END
        ALTER TABLE dbo.lms_course_enrollments
        ADD CONSTRAINT CK_lms_course_enrollments_status
        CHECK (status IN ('Assigned', 'Not Started', 'In Progress', 'Completed'));
    """)
