"""reorder_employee_profiles_columns

Revision ID: e3f4a5b6c7d8
Revises: d4e5f6a7b8c9
Create Date: 2026-10-07 09:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Reorders columns in dbo.lms_employee_profiles so learning_interests
    is positioned after area_of_expertise and before created_at.
    """
    bind = op.get_bind()
    dialect_name = bind.dialect.name.lower()

    if 'mssql' in dialect_name or 'pyodbc' in dialect_name:
        # Check current ordinal position of learning_interests
        reorder_sql = """
        DECLARE @pos INT;
        SELECT @pos = ORDINAL_POSITION 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'lms_employee_profiles' AND COLUMN_NAME = 'learning_interests';

        -- Only run reorder if learning_interests is after created_at (pos > 10)
        IF @pos > 10
        BEGIN
            -- 1. Drop referencing foreign keys if they exist
            IF OBJECT_ID('dbo.FK_lms_assign_course_ld', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_assign_course DROP CONSTRAINT FK_lms_assign_course_ld;
            IF OBJECT_ID('dbo.FK_lms_course_enrollments_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_course_enrollments DROP CONSTRAINT FK_lms_course_enrollments_employee;
            IF OBJECT_ID('dbo.FK_lms_course_requests_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_course_requests DROP CONSTRAINT FK_lms_course_requests_employee;
            IF OBJECT_ID('dbo.FK_lms_learning_logs_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_learning_logs DROP CONSTRAINT FK_lms_learning_logs_employee;
            IF OBJECT_ID('dbo.FK_lms_leaderboard_snapshots_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_leaderboard_snapshots DROP CONSTRAINT FK_lms_leaderboard_snapshots_employee;
            IF OBJECT_ID('dbo.FK_lms_employee_certificates_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_employee_certificates DROP CONSTRAINT FK_lms_employee_certificates_employee;
            IF OBJECT_ID('dbo.FK_lms_certification_requests_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_certification_requests DROP CONSTRAINT FK_lms_certification_requests_employee;
            IF OBJECT_ID('dbo.FK_lms_reimbursement_claims_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_reimbursement_claims DROP CONSTRAINT FK_lms_reimbursement_claims_employee;
            IF OBJECT_ID('dbo.FK_lms_notifications_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_notifications DROP CONSTRAINT FK_lms_notifications_employee;
            IF OBJECT_ID('dbo.FK_lms_enrollment_requests_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_enrollment_requests DROP CONSTRAINT FK_lms_enrollment_requests_employee;
            IF OBJECT_ID('dbo.FK_lms_course_recommend_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_course_recommend DROP CONSTRAINT FK_lms_course_recommend_employee;
            IF OBJECT_ID('dbo.FK_lms_recommend_new_course_rm', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_recommend_new_course DROP CONSTRAINT FK_lms_recommend_new_course_rm;
            IF OBJECT_ID('dbo.FK_lms_recommend_new_course_employee', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_recommend_new_course DROP CONSTRAINT FK_lms_recommend_new_course_employee;

            -- 2. Drop temporary table if leftover
            IF OBJECT_ID('dbo.lms_employee_profiles_reordered', 'U') IS NOT NULL
                DROP TABLE dbo.lms_employee_profiles_reordered;

            -- 3. Create reordered table
            CREATE TABLE dbo.lms_employee_profiles_reordered (
                id                   INT IDENTITY(1,1) NOT NULL,
                employee_id          VARCHAR(7)    NOT NULL,
                azure_user_id        VARCHAR(100)  NULL,
                profile_photo_url    VARCHAR(500)  NULL,
                linkedin_url         VARCHAR(255)  NULL,
                professional_summary VARCHAR(150)  NULL,
                technical_skills     NVARCHAR(MAX) NULL,
                workplace_skills     NVARCHAR(MAX) NULL,
                area_of_expertise    NVARCHAR(MAX) NULL,
                learning_interests   NVARCHAR(MAX) NULL,
                created_at           DATETIME      NOT NULL CONSTRAINT DF_lms_employee_profiles_created_at_new DEFAULT GETDATE(),
                created_by           VARCHAR(7)    NULL,
                updated_at           DATETIME      NULL,
                CONSTRAINT PK_lms_employee_profiles_new PRIMARY KEY (id),
                CONSTRAINT UQ_lms_employee_profiles_employee_id_new UNIQUE (employee_id)
            );

            -- 4. Copy existing data preserving identities
            SET IDENTITY_INSERT dbo.lms_employee_profiles_reordered ON;

            INSERT INTO dbo.lms_employee_profiles_reordered (
                id,
                employee_id,
                azure_user_id,
                profile_photo_url,
                linkedin_url,
                professional_summary,
                technical_skills,
                workplace_skills,
                area_of_expertise,
                learning_interests,
                created_at,
                created_by,
                updated_at
            )
            SELECT 
                id,
                employee_id,
                azure_user_id,
                profile_photo_url,
                linkedin_url,
                professional_summary,
                technical_skills,
                workplace_skills,
                area_of_expertise,
                learning_interests,
                created_at,
                created_by,
                updated_at
            FROM dbo.lms_employee_profiles;

            SET IDENTITY_INSERT dbo.lms_employee_profiles_reordered OFF;

            -- 5. Drop original table
            DROP TABLE dbo.lms_employee_profiles;

            -- 6. Rename new table to original name
            EXEC sp_rename 'dbo.lms_employee_profiles_reordered', 'lms_employee_profiles';
            EXEC sp_rename 'dbo.PK_lms_employee_profiles_new', 'PK_lms_employee_profiles', 'OBJECT';
            EXEC sp_rename 'dbo.UQ_lms_employee_profiles_employee_id_new', 'UQ_lms_employee_profiles_employee_id', 'OBJECT';
            EXEC sp_rename 'dbo.DF_lms_employee_profiles_created_at_new', 'DF_lms_employee_profiles_created_at', 'OBJECT';

            -- 7. Re-create all 13 referencing foreign keys
            ALTER TABLE dbo.lms_assign_course ADD CONSTRAINT FK_lms_assign_course_ld 
                FOREIGN KEY (ld_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_course_enrollments ADD CONSTRAINT FK_lms_course_enrollments_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_course_requests ADD CONSTRAINT FK_lms_course_requests_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_learning_logs ADD CONSTRAINT FK_lms_learning_logs_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_leaderboard_snapshots ADD CONSTRAINT FK_lms_leaderboard_snapshots_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_employee_certificates ADD CONSTRAINT FK_lms_employee_certificates_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_certification_requests ADD CONSTRAINT FK_lms_certification_requests_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_reimbursement_claims ADD CONSTRAINT FK_lms_reimbursement_claims_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_notifications ADD CONSTRAINT FK_lms_notifications_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_enrollment_requests ADD CONSTRAINT FK_lms_enrollment_requests_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_course_recommend ADD CONSTRAINT FK_lms_course_recommend_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_recommend_new_course ADD CONSTRAINT FK_lms_recommend_new_course_rm 
                FOREIGN KEY (rm_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_recommend_new_course ADD CONSTRAINT FK_lms_recommend_new_course_employee 
                FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);
        END
        """
        op.execute(reorder_sql)


def downgrade() -> None:
    pass
