"""reorder columns in lms_assign_course

Revision ID: j5d6e7f8a9b0
Revises: i4c5d6e7f8a9
Create Date: 2026-10-07 15:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j5d6e7f8a9b0'
down_revision: Union[str, None] = 'i4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reorder columns in dbo.lms_assign_course so selected_employees is placed between course_id and learning_start_date
    op.execute("""
        IF OBJECT_ID('dbo.lms_assign_course', 'U') IS NOT NULL
        BEGIN
            -- 1. Create temporary new table with exact desired column order
            CREATE TABLE dbo.tmp_lms_assign_course (
                id                      INT IDENTITY(1,1) NOT NULL,
                ld_id                   VARCHAR(7)   NOT NULL,
                course_id               INT          NOT NULL,
                selected_employees      VARCHAR(255) NULL,
                learning_start_date     DATE         NULL,
                target_completion_date  DATE         NULL,
                assignment_note         VARCHAR(250) NULL,
                created_at              DATETIME     NOT NULL CONSTRAINT DF_tmp_lms_assign_course_created_at DEFAULT GETDATE(),
                created_by              VARCHAR(7)   NULL
            );

            -- 2. Copy all data preserving IDs
            SET IDENTITY_INSERT dbo.tmp_lms_assign_course ON;

            INSERT INTO dbo.tmp_lms_assign_course (
                id,
                ld_id,
                course_id,
                selected_employees,
                learning_start_date,
                target_completion_date,
                assignment_note,
                created_at,
                created_by
            )
            SELECT 
                id,
                ld_id,
                course_id,
                selected_employees,
                learning_start_date,
                target_completion_date,
                assignment_note,
                created_at,
                created_by
            FROM dbo.lms_assign_course;

            SET IDENTITY_INSERT dbo.tmp_lms_assign_course OFF;

            -- 3. Drop existing table
            DROP TABLE dbo.lms_assign_course;

            -- 4. Rename temp table to dbo.lms_assign_course
            EXEC sp_rename 'dbo.tmp_lms_assign_course', 'lms_assign_course';
            EXEC sp_rename 'dbo.DF_tmp_lms_assign_course_created_at', 'DF_lms_assign_course_created_at', 'OBJECT';

            -- 5. Recreate Primary Key
            ALTER TABLE dbo.lms_assign_course 
            ADD CONSTRAINT PK_lms_assign_course PRIMARY KEY CLUSTERED (id ASC);

            -- 6. Recreate Index on course_id
            CREATE NONCLUSTERED INDEX IX_lms_assign_course_course_id 
            ON dbo.lms_assign_course (course_id ASC);

            -- 7. Recreate Foreign Keys
            ALTER TABLE dbo.lms_assign_course 
            ADD CONSTRAINT FK_lms_assign_course_ld 
            FOREIGN KEY (ld_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_assign_course 
            ADD CONSTRAINT FK_lms_assign_course_course 
            FOREIGN KEY (course_id) REFERENCES dbo.lms_courses (id);
        END
    """)


def downgrade() -> None:
    pass
