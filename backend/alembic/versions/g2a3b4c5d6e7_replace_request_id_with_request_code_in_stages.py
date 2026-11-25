"""replace request_id with request_code in stages

Revision ID: g2a3b4c5d6e7
Revises: f1a2b3c4d5e6
Create Date: 2026-10-07 13:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g2a3b4c5d6e7'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create aligned staging table with request_code
    op.execute("""
        IF OBJECT_ID('dbo.lms_course_request_stages_new', 'U') IS NOT NULL
            DROP TABLE dbo.lms_course_request_stages_new;

        CREATE TABLE dbo.lms_course_request_stages_new (
            id            INT IDENTITY(1,1) NOT NULL,
            request_code  VARCHAR(20)       NOT NULL,
            stage_name    VARCHAR(30)       NOT NULL,
            stage_status  VARCHAR(20)       NOT NULL,
            stage_date    DATE              NULL,
            created_at    DATETIME          NOT NULL CONSTRAINT DF_lms_course_request_stages_new_created_at DEFAULT GETDATE(),
            created_by    VARCHAR(7)        NULL,
            updated_at    DATETIME          NULL,
            updated_by    VARCHAR(7)        NULL,
            CONSTRAINT PK_lms_course_request_stages_new PRIMARY KEY (id),
            CONSTRAINT CK_lms_course_request_stages_new_name   CHECK (stage_name   IN ('Employee','Notified to RM','L&D','CEO Approval','Course Purchase')),
            CONSTRAINT CK_lms_course_request_stages_new_status CHECK (stage_status IN ('Completed','Pending','Upcoming','Rejected'))
        );
    """)

    # 2. Copy existing records joining lms_course_requests to resolve request_code
    op.execute("""
        SET IDENTITY_INSERT dbo.lms_course_request_stages_new ON;

        INSERT INTO dbo.lms_course_request_stages_new (
            id, request_code, stage_name, stage_status, stage_date, created_at, created_by, updated_at, updated_by
        )
        SELECT 
            s.id,
            cr.request_code,
            s.stage_name,
            s.stage_status,
            s.stage_date,
            s.created_at,
            s.created_by,
            s.updated_at,
            s.updated_by
        FROM dbo.lms_course_request_stages s
        INNER JOIN dbo.lms_course_requests cr ON s.request_id = cr.id
        ORDER BY s.id ASC;

        SET IDENTITY_INSERT dbo.lms_course_request_stages_new OFF;
    """)

    # 3. Drop old table and rename new table
    op.execute("""
        IF OBJECT_ID('dbo.IX_lms_course_request_stages_request_id', 'I') IS NOT NULL
            DROP INDEX IX_lms_course_request_stages_request_id ON dbo.lms_course_request_stages;

        DROP TABLE dbo.lms_course_request_stages;

        EXEC sp_rename 'dbo.lms_course_request_stages_new', 'lms_course_request_stages';
        EXEC sp_rename 'dbo.PK_lms_course_request_stages_new', 'PK_lms_course_request_stages', 'OBJECT';
        EXEC sp_rename 'dbo.CK_lms_course_request_stages_new_name', 'CK_lms_course_request_stages_name', 'OBJECT';
        EXEC sp_rename 'dbo.CK_lms_course_request_stages_new_status', 'CK_lms_course_request_stages_status', 'OBJECT';
    """)

    # 4. Add foreign key referencing dbo.lms_course_requests(request_code)
    op.execute("""
        ALTER TABLE dbo.lms_course_request_stages
        ADD CONSTRAINT FK_lms_course_request_stages_request
        FOREIGN KEY (request_code) REFERENCES dbo.lms_course_requests (request_code) ON DELETE CASCADE;
    """)

    # 5. Add index on request_code
    op.execute("""
        CREATE INDEX IX_lms_course_request_stages_request_code
        ON dbo.lms_course_request_stages (request_code);
    """)


def downgrade() -> None:
    # Downgrade back to request_id
    op.execute("""
        IF OBJECT_ID('dbo.lms_course_request_stages_old', 'U') IS NOT NULL
            DROP TABLE dbo.lms_course_request_stages_old;

        CREATE TABLE dbo.lms_course_request_stages_old (
            id            INT IDENTITY(1,1) NOT NULL,
            request_id    INT               NOT NULL,
            stage_name    VARCHAR(30)       NOT NULL,
            stage_status  VARCHAR(20)       NOT NULL,
            stage_date    DATE              NULL,
            created_at    DATETIME          NOT NULL CONSTRAINT DF_lms_course_request_stages_old_created_at DEFAULT GETDATE(),
            created_by    VARCHAR(7)        NULL,
            updated_at    DATETIME          NULL,
            updated_by    VARCHAR(7)        NULL,
            CONSTRAINT PK_lms_course_request_stages_old PRIMARY KEY (id),
            CONSTRAINT CK_lms_course_request_stages_old_name   CHECK (stage_name   IN ('Employee','Notified to RM','L&D','CEO Approval','Course Purchase')),
            CONSTRAINT CK_lms_course_request_stages_old_status CHECK (stage_status IN ('Completed','Pending','Upcoming','Rejected'))
        );

        SET IDENTITY_INSERT dbo.lms_course_request_stages_old ON;

        INSERT INTO dbo.lms_course_request_stages_old (
            id, request_id, stage_name, stage_status, stage_date, created_at, created_by, updated_at, updated_by
        )
        SELECT 
            s.id,
            cr.id,
            s.stage_name,
            s.stage_status,
            s.stage_date,
            s.created_at,
            s.created_by,
            s.updated_at,
            s.updated_by
        FROM dbo.lms_course_request_stages s
        INNER JOIN dbo.lms_course_requests cr ON s.request_code = cr.request_code
        ORDER BY s.id ASC;

        SET IDENTITY_INSERT dbo.lms_course_request_stages_old OFF;

        IF OBJECT_ID('dbo.IX_lms_course_request_stages_request_code', 'I') IS NOT NULL
            DROP INDEX IX_lms_course_request_stages_request_code ON dbo.lms_course_request_stages;

        DROP TABLE dbo.lms_course_request_stages;

        EXEC sp_rename 'dbo.lms_course_request_stages_old', 'lms_course_request_stages';
        EXEC sp_rename 'dbo.PK_lms_course_request_stages_old', 'PK_lms_course_request_stages', 'OBJECT';
        EXEC sp_rename 'dbo.CK_lms_course_request_stages_old_name', 'CK_lms_course_request_stages_name', 'OBJECT';
        EXEC sp_rename 'dbo.CK_lms_course_request_stages_old_status', 'CK_lms_course_request_stages_status', 'OBJECT';

        ALTER TABLE dbo.lms_course_request_stages
        ADD CONSTRAINT FK_lms_course_request_stages_request
        FOREIGN KEY (request_id) REFERENCES dbo.lms_course_requests (id) ON DELETE CASCADE;

        CREATE INDEX IX_lms_course_request_stages_request_id
        ON dbo.lms_course_request_stages (request_id);
    """)
