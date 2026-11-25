"""refactor assign_course and enrollments schema

Revision ID: i4c5d6e7f8a9
Revises: h3b4c5d6e7f8
Create Date: 2026-10-07 15:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i4c5d6e7f8a9'
down_revision: Union[str, None] = 'h3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add selected_employees column to dbo.lms_assign_course if not present
    op.execute("""
        IF COL_LENGTH('dbo.lms_assign_course', 'selected_employees') IS NULL
        BEGIN
            ALTER TABLE dbo.lms_assign_course ADD selected_employees VARCHAR(255) NULL;
        END
    """)

    # 2. Backfill selected_employees in dbo.lms_assign_course using existing dbo.lms_course_enrollments links
    op.execute("""
        IF COL_LENGTH('dbo.lms_course_enrollments', 'assignment_id') IS NOT NULL
        BEGIN
            UPDATE ac
            SET ac.selected_employees = ce.employee_id
            FROM dbo.lms_assign_course ac
            JOIN dbo.lms_course_enrollments ce ON ce.assignment_id = ac.id
            WHERE ac.selected_employees IS NULL;
        END
    """)

    # 3. Drop max_active_users from dbo.lms_assign_course
    op.execute("""
        IF COL_LENGTH('dbo.lms_assign_course', 'max_active_users') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_assign_course DROP COLUMN max_active_users;
        END
    """)

    # 4. Drop FK constraint on assignment_id in dbo.lms_course_enrollments
    op.execute("""
        IF OBJECT_ID('dbo.FK_lms_course_enrollments_assignment', 'F') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments DROP CONSTRAINT FK_lms_course_enrollments_assignment;
        END
    """)

    # 5. Drop index IX_lms_course_enrollments_assignment_id
    op.execute("""
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lms_course_enrollments_assignment_id' AND object_id = OBJECT_ID('dbo.lms_course_enrollments'))
        BEGIN
            DROP INDEX IX_lms_course_enrollments_assignment_id ON dbo.lms_course_enrollments;
        END
    """)

    # 6. Drop column assignment_id from dbo.lms_course_enrollments
    op.execute("""
        IF COL_LENGTH('dbo.lms_course_enrollments', 'assignment_id') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments DROP COLUMN assignment_id;
        END
    """)

    # 7. Add updated_at and updated_by to dbo.lms_course_enrollments
    op.execute("""
        IF COL_LENGTH('dbo.lms_course_enrollments', 'updated_at') IS NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments ADD updated_at DATETIME NULL;
        END
        IF COL_LENGTH('dbo.lms_course_enrollments', 'updated_by') IS NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments ADD updated_by VARCHAR(7) NULL;
        END
    """)

    # 8. Add foreign key for updated_by on dbo.lms_course_enrollments
    op.execute("""
        IF OBJECT_ID('dbo.FK_lms_course_enrollments_updated_by', 'F') IS NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments
            ADD CONSTRAINT FK_lms_course_enrollments_updated_by
            FOREIGN KEY (updated_by) REFERENCES dbo.lms_employee_profiles(employee_id);
        END
    """)


def downgrade() -> None:
    # Reverse changes if needed
    op.execute("""
        IF OBJECT_ID('dbo.FK_lms_course_enrollments_updated_by', 'F') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments DROP CONSTRAINT FK_lms_course_enrollments_updated_by;
        END
        IF COL_LENGTH('dbo.lms_course_enrollments', 'updated_at') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments DROP COLUMN updated_at;
        END
        IF COL_LENGTH('dbo.lms_course_enrollments', 'updated_by') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments DROP COLUMN updated_by;
        END
        IF COL_LENGTH('dbo.lms_course_enrollments', 'assignment_id') IS NULL
        BEGIN
            ALTER TABLE dbo.lms_course_enrollments ADD assignment_id INT NULL;
        END
        IF COL_LENGTH('dbo.lms_assign_course', 'max_active_users') IS NULL
        BEGIN
            ALTER TABLE dbo.lms_assign_course ADD max_active_users INT NULL;
        END
        IF COL_LENGTH('dbo.lms_assign_course', 'selected_employees') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.lms_assign_course DROP COLUMN selected_employees;
        END
    """)
