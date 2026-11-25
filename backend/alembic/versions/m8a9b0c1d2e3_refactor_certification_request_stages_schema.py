"""refactor certification request stages schema

Revision ID: m8a9b0c1d2e3
Revises: l7f8a9b0c1d2
Create Date: 2026-10-07 16:47:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm8a9b0c1d2e3'
down_revision: Union[str, None] = 'l7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        IF OBJECT_ID('dbo.lms_certification_request_stages', 'U') IS NOT NULL
        BEGIN
            -- 1. Clean up existing data:
            -- A. For Stage 1 ('Employee'), backfill updated_by with the actual applicant employee_id
            UPDATE s
            SET s.updated_by = cr.employee_id
            FROM dbo.lms_certification_request_stages s
            JOIN dbo.lms_certification_requests cr ON s.request_id = cr.id
            WHERE s.stage_name = 'Employee' AND (s.updated_by = 'SYSTEM' OR s.updated_by IS NULL);

            -- B. For Pending/Upcoming stages that have NOT been completed, reset fake timestamps to NULL
            UPDATE dbo.lms_certification_request_stages
            SET updated_at = NULL,
                updated_by = NULL
            WHERE stage_status IN ('Pending', 'Upcoming') AND stage_date IS NULL;

            -- 2. Create temporary table with exact target column structure (7 clean columns)
            CREATE TABLE dbo.tmp_lms_certification_request_stages (
                id            INT IDENTITY(1,1) NOT NULL,
                request_id    INT               NOT NULL,
                stage_name    VARCHAR(30)       NOT NULL,
                stage_status  VARCHAR(20)       NOT NULL,
                stage_date    DATE              NULL,
                updated_at    DATETIME          NULL,
                updated_by    VARCHAR(20)       NULL
            );

            -- 3. Copy existing data preserving identities
            SET IDENTITY_INSERT dbo.tmp_lms_certification_request_stages ON;

            INSERT INTO dbo.tmp_lms_certification_request_stages (
                id, request_id, stage_name, stage_status, stage_date, updated_at, updated_by
            )
            SELECT 
                id, request_id, stage_name, stage_status, stage_date, updated_at, updated_by
            FROM dbo.lms_certification_request_stages;

            SET IDENTITY_INSERT dbo.tmp_lms_certification_request_stages OFF;

            -- 4. Drop existing table
            DROP TABLE dbo.lms_certification_request_stages;

            -- 5. Rename temp table to dbo.lms_certification_request_stages
            EXEC sp_rename 'dbo.tmp_lms_certification_request_stages', 'lms_certification_request_stages';

            -- 6. Recreate Primary Key
            ALTER TABLE dbo.lms_certification_request_stages
            ADD CONSTRAINT PK_lms_cert_req_stages PRIMARY KEY CLUSTERED (id ASC);

            -- 7. Recreate Foreign Key with ON DELETE CASCADE
            ALTER TABLE dbo.lms_certification_request_stages
            ADD CONSTRAINT FK_lms_cert_req_stages_request
            FOREIGN KEY (request_id) REFERENCES dbo.lms_certification_requests (id) ON DELETE CASCADE;

            -- 8. Recreate Index on request_id
            CREATE NONCLUSTERED INDEX IX_lms_cert_req_stages_request_id
            ON dbo.lms_certification_request_stages (request_id ASC);
        END
    """)


def downgrade() -> None:
    pass
