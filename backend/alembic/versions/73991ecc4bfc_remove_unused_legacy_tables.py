"""remove_unused_legacy_tables

Revision ID: 73991ecc4bfc
Revises: 6d3e2184e195
Create Date: 2026-09-29 10:15:50.184601

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '73991ecc4bfc'
down_revision: Union[str, Sequence[str], None] = '6d3e2184e195'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: drop 26 unused tables and retain only the 17 approved tables."""
    # 1. Drop foreign keys on retained tables referencing dropped tables
    op.execute("""
        IF OBJECT_ID('fk_lms_empcourse_certfile', 'F') IS NOT NULL
            ALTER TABLE lms_employee_course DROP CONSTRAINT fk_lms_empcourse_certfile;
        IF OBJECT_ID('fk_lms_timelog_req', 'F') IS NOT NULL
            ALTER TABLE lms_timelog DROP CONSTRAINT fk_lms_timelog_req;
    """)

    # 2. Drop all foreign keys attached to any of the 26 tables to be removed
    op.execute("""
        DECLARE @sql NVARCHAR(MAX) = N'';
        SELECT @sql += N'ALTER TABLE [' + OBJECT_SCHEMA_NAME(fk.parent_object_id) + N'].[' + OBJECT_NAME(fk.parent_object_id) + N'] DROP CONSTRAINT [' + fk.name + N'];' + CHAR(13)
        FROM sys.foreign_keys fk
        JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
        JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
        WHERE tp.name IN (
            'lms_approval_history', 'lms_budget', 'lms_budget_expense', 'lms_ceo_approval_action', 'lms_ceo_report_snapshot',
            'lms_certification', 'lms_certification_recommendation', 'lms_certification_recommendation_recipient',
            'lms_certification_request', 'lms_department', 'lms_department_budget', 'lms_employee_learning_path',
            'lms_file', 'lms_learning_activity', 'lms_learning_log', 'lms_learning_path', 'lms_learning_path_course',
            'lms_learning_points', 'lms_learningcategory', 'lms_manager_recommended_courses', 'lms_mandatory_learning',
            'lms_point_rule', 'lms_reimbursement', 'lms_reimbursement_claim', 'lms_reimbursement_request', 'lms_reportingmanager'
        ) OR tr.name IN (
            'lms_approval_history', 'lms_budget', 'lms_budget_expense', 'lms_ceo_approval_action', 'lms_ceo_report_snapshot',
            'lms_certification', 'lms_certification_recommendation', 'lms_certification_recommendation_recipient',
            'lms_certification_request', 'lms_department', 'lms_department_budget', 'lms_employee_learning_path',
            'lms_file', 'lms_learning_activity', 'lms_learning_log', 'lms_learning_path', 'lms_learning_path_course',
            'lms_learning_points', 'lms_learningcategory', 'lms_manager_recommended_courses', 'lms_mandatory_learning',
            'lms_point_rule', 'lms_reimbursement', 'lms_reimbursement_claim', 'lms_reimbursement_request', 'lms_reportingmanager'
        );
        IF LEN(@sql) > 0
            EXEC sp_executesql @sql;
    """)

    # 3. Drop the 26 unused tables
    op.execute("""
        DECLARE @dropSql NVARCHAR(MAX) = N'';
        SELECT @dropSql += N'DROP TABLE [' + OBJECT_SCHEMA_NAME(t.object_id) + N'].[' + t.name + N'];' + CHAR(13)
        FROM sys.tables t
        WHERE t.name IN (
            'lms_approval_history', 'lms_budget', 'lms_budget_expense', 'lms_ceo_approval_action', 'lms_ceo_report_snapshot',
            'lms_certification', 'lms_certification_recommendation', 'lms_certification_recommendation_recipient',
            'lms_certification_request', 'lms_department', 'lms_department_budget', 'lms_employee_learning_path',
            'lms_file', 'lms_learning_activity', 'lms_learning_log', 'lms_learning_path', 'lms_learning_path_course',
            'lms_learning_points', 'lms_learningcategory', 'lms_manager_recommended_courses', 'lms_mandatory_learning',
            'lms_point_rule', 'lms_reimbursement', 'lms_reimbursement_claim', 'lms_reimbursement_request', 'lms_reportingmanager'
        );
        IF LEN(@dropSql) > 0
            EXEC sp_executesql @dropSql;
    """)

    # 4. Ensure lms_course_enrollment and lms_LD_assign_course exist
    op.execute("""
        IF OBJECT_ID('lms_course_enrollment', 'U') IS NULL
        BEGIN
            CREATE TABLE lms_course_enrollment (
                enrollment_id INT IDENTITY(1,1) PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL,
                course_id INT NOT NULL,
                enrollment_date DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
                status VARCHAR(50) NOT NULL DEFAULT 'Enrolled',
                progress_percentage INT NOT NULL DEFAULT 0,
                completed_at DATETIME2 NULL,
                created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
                updated_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                CONSTRAINT fk_lms_enrollment_course FOREIGN KEY (course_id) REFERENCES lms_courses(course_id)
            );
        END;

        IF OBJECT_ID('lms_LD_assign_course', 'U') IS NULL
        BEGIN
            CREATE TABLE lms_LD_assign_course (
                assignment_id INT IDENTITY(1,1) PRIMARY KEY,
                course_id INT NOT NULL,
                employee_id VARCHAR(50) NOT NULL,
                assigned_by VARCHAR(100) NOT NULL DEFAULT 'L&D Admin',
                assigned_date DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
                due_date DATE NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Assigned',
                remarks NVARCHAR(500) NULL,
                created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
                updated_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                CONSTRAINT fk_lms_assign_course FOREIGN KEY (course_id) REFERENCES lms_courses(course_id)
            );
        END;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
        IF OBJECT_ID('lms_course_enrollment', 'U') IS NOT NULL DROP TABLE lms_course_enrollment;
        IF OBJECT_ID('lms_LD_assign_course', 'U') IS NOT NULL DROP TABLE lms_LD_assign_course;
    """)

