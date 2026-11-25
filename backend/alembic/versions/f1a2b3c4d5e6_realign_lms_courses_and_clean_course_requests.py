"""realign lms_courses and clean course_requests

Revision ID: f1a2b3c4d5e6
Revises: e3f4a5b6c7d8
Create Date: 2026-10-07 12:22:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e3f4a5b6c7d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # =========================================================================
    # PART 1: RE-ALIGN dbo.lms_courses SCHEMA
    # =========================================================================

    # 1. Temporarily drop foreign keys referencing dbo.lms_courses(id)
    fk_drops = """
    IF OBJECT_ID('dbo.FK_lms_assign_course_course', 'F') IS NOT NULL
        ALTER TABLE dbo.lms_assign_course DROP CONSTRAINT FK_lms_assign_course_course;

    IF OBJECT_ID('dbo.FK_lms_course_enrollments_course', 'F') IS NOT NULL
        ALTER TABLE dbo.lms_course_enrollments DROP CONSTRAINT FK_lms_course_enrollments_course;

    IF OBJECT_ID('dbo.FK_lms_learning_logs_course', 'F') IS NOT NULL
        ALTER TABLE dbo.lms_learning_logs DROP CONSTRAINT FK_lms_learning_logs_course;

    IF OBJECT_ID('dbo.FK_lms_enrollment_requests_course', 'F') IS NOT NULL
        ALTER TABLE dbo.lms_enrollment_requests DROP CONSTRAINT FK_lms_enrollment_requests_course;

    IF OBJECT_ID('dbo.FK_lms_course_recommend_course', 'F') IS NOT NULL
        ALTER TABLE dbo.lms_course_recommend DROP CONSTRAINT FK_lms_course_recommend_course;
    """
    conn.execute(sa.text(fk_drops))

    # 2. Drop existing temp table if it was left from a previous run
    conn.execute(sa.text("IF OBJECT_ID('dbo.lms_courses_new', 'U') IS NOT NULL DROP TABLE dbo.lms_courses_new;"))

    # 3. Create dbo.lms_courses_new with the perfectly aligned 18-column schema
    create_new_table = """
    CREATE TABLE dbo.lms_courses_new (
        id                   INT IDENTITY(1,1) NOT NULL,
        course_name          VARCHAR(100)      NOT NULL,
        provider             VARCHAR(50)       NULL,
        category             VARCHAR(30)       NULL,
        duration_minutes     INT               NULL,
        price                DECIMAL(10, 2)    NULL,
        description          VARCHAR(500)      NULL,
        course_account_email VARCHAR(50)       NULL,
        support_document     VARCHAR(500)      NULL,
        request_id           INT               NULL,
        claim_id             VARCHAR(50)       NULL,
        hr_status            VARCHAR(20)       NOT NULL CONSTRAINT DF_lms_courses_new_hr_status DEFAULT 'Pending',
        hr_reviewed_at       DATETIME2         NULL,
        hr_id                INT               NULL,
        created_at           DATETIME          NOT NULL CONSTRAINT DF_lms_courses_new_created_at DEFAULT GETDATE(),
        created_by           VARCHAR(7)        NULL,
        updated_at           DATETIME          NULL,
        updated_by           VARCHAR(7)        NULL,
        CONSTRAINT PK_lms_courses_new PRIMARY KEY (id)
    );
    """
    conn.execute(sa.text(create_new_table))

    # 4. Migrate data from old dbo.lms_courses into dbo.lms_courses_new preserving identity IDs
    copy_data = """
    SET IDENTITY_INSERT dbo.lms_courses_new ON;

    INSERT INTO dbo.lms_courses_new (
        id,
        course_name,
        provider,
        category,
        duration_minutes,
        price,
        description,
        course_account_email,
        support_document,
        request_id,
        claim_id,
        hr_status,
        hr_reviewed_at,
        hr_id,
        created_at,
        created_by,
        updated_at,
        updated_by
    )
    SELECT
        id,
        course_name,
        COALESCE(provider, provider_name, 'Udemy'),
        COALESCE(category, category_name, 'Development'),
        duration,
        estimated_cost,
        description,
        course_account_email,
        support_document,
        request_id,
        claim_id,
        COALESCE(hr_status, 'Pending'),
        hr_reviewed_at,
        hr_id,
        created_at,
        created_by,
        created_at,
        created_by
    FROM dbo.lms_courses;

    SET IDENTITY_INSERT dbo.lms_courses_new OFF;
    """
    conn.execute(sa.text(copy_data))

    # 5. Drop old table and rename new table
    rename_table = """
    DROP TABLE dbo.lms_courses;
    EXEC sp_rename 'dbo.lms_courses_new', 'lms_courses';
    EXEC sp_rename 'dbo.PK_lms_courses_new', 'PK_lms_courses', 'OBJECT';
    EXEC sp_rename 'dbo.DF_lms_courses_new_hr_status', 'DF_lms_courses_hr_status', 'OBJECT';
    EXEC sp_rename 'dbo.DF_lms_courses_new_created_at', 'DF_lms_courses_created_at', 'OBJECT';
    """
    conn.execute(sa.text(rename_table))

    # 6. Re-create the 5 Foreign Key constraints
    recreate_fks = """
    ALTER TABLE dbo.lms_assign_course
        ADD CONSTRAINT FK_lms_assign_course_course FOREIGN KEY (course_id) REFERENCES dbo.lms_courses (id);

    ALTER TABLE dbo.lms_course_enrollments
        ADD CONSTRAINT FK_lms_course_enrollments_course FOREIGN KEY (course_id) REFERENCES dbo.lms_courses (id);

    ALTER TABLE dbo.lms_learning_logs
        ADD CONSTRAINT FK_lms_learning_logs_course FOREIGN KEY (course_id) REFERENCES dbo.lms_courses (id);

    ALTER TABLE dbo.lms_enrollment_requests
        ADD CONSTRAINT FK_lms_enrollment_requests_course FOREIGN KEY (course_id) REFERENCES dbo.lms_courses (id);

    ALTER TABLE dbo.lms_course_recommend
        ADD CONSTRAINT FK_lms_course_recommend_course FOREIGN KEY (course_id) REFERENCES dbo.lms_courses (id);
    """
    conn.execute(sa.text(recreate_fks))

    # =========================================================================
    # PART 2: CLEAN dbo.lms_course_requests (Drop duration_minutes and price)
    # =========================================================================
    clean_course_requests = """
    DECLARE @df_dur NVARCHAR(256);
    SELECT @df_dur = d.name
    FROM sys.default_constraints d
    INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
    WHERE d.parent_object_id = OBJECT_ID('dbo.lms_course_requests') AND c.name = 'duration_minutes';
    IF @df_dur IS NOT NULL EXEC('ALTER TABLE dbo.lms_course_requests DROP CONSTRAINT ' + @df_dur);

    DECLARE @df_pr NVARCHAR(256);
    SELECT @df_pr = d.name
    FROM sys.default_constraints d
    INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
    WHERE d.parent_object_id = OBJECT_ID('dbo.lms_course_requests') AND c.name = 'price';
    IF @df_pr IS NOT NULL EXEC('ALTER TABLE dbo.lms_course_requests DROP CONSTRAINT ' + @df_pr);

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.lms_course_requests') AND name = 'duration_minutes')
        ALTER TABLE dbo.lms_course_requests DROP COLUMN duration_minutes;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.lms_course_requests') AND name = 'price')
        ALTER TABLE dbo.lms_course_requests DROP COLUMN price;
    """
    conn.execute(sa.text(clean_course_requests))


def downgrade() -> None:
    conn = op.get_bind()

    # Re-add duration_minutes and price to lms_course_requests
    downgrade_course_requests = """
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.lms_course_requests') AND name = 'duration_minutes')
        ALTER TABLE dbo.lms_course_requests ADD duration_minutes INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.lms_course_requests') AND name = 'price')
        ALTER TABLE dbo.lms_course_requests ADD price DECIMAL(10, 2) NULL;
    """
    conn.execute(sa.text(downgrade_course_requests))
