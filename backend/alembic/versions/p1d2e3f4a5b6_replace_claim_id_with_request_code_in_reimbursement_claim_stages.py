"""replace claim_id with request_code in reimbursement claim stages

Revision ID: p1d2e3f4a5b6
Revises: o0c1d2e3f4a5
Create Date: 2026-10-07 17:24:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p1d2e3f4a5b6'
down_revision: Union[str, None] = 'o0c1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        IF OBJECT_ID('dbo.lms_reimbursement_claim_stages', 'U') IS NOT NULL
        BEGIN
            -- 1. Create temporary staging table with request_code
            IF OBJECT_ID('dbo.tmp_lms_reimbursement_claim_stages', 'U') IS NOT NULL
                DROP TABLE dbo.tmp_lms_reimbursement_claim_stages;

            CREATE TABLE dbo.tmp_lms_reimbursement_claim_stages (
                id            INT IDENTITY(1,1) NOT NULL,
                request_code  VARCHAR(20)       NOT NULL,
                stage_name    VARCHAR(30)       NOT NULL,
                stage_status  VARCHAR(20)       NOT NULL,
                stage_date    DATE              NULL,
                created_at    DATETIME          NOT NULL CONSTRAINT DF_tmp_reimb_claim_stages_created_at DEFAULT GETDATE(),
                created_by    VARCHAR(7)        NULL,
                updated_at    DATETIME          NULL,
                updated_by    VARCHAR(7)        NULL
            );

            -- 2. Copy existing records resolving claim_code from lms_reimbursement_claims
            SET IDENTITY_INSERT dbo.tmp_lms_reimbursement_claim_stages ON;

            INSERT INTO dbo.tmp_lms_reimbursement_claim_stages (
                id, request_code, stage_name, stage_status, stage_date, created_at, created_by, updated_at, updated_by
            )
            SELECT 
                s.id,
                rc.claim_code,
                s.stage_name,
                s.stage_status,
                s.stage_date,
                s.created_at,
                s.created_by,
                s.updated_at,
                s.updated_by
            FROM dbo.lms_reimbursement_claim_stages s
            JOIN dbo.lms_reimbursement_claims rc ON s.claim_id = rc.id;

            SET IDENTITY_INSERT dbo.tmp_lms_reimbursement_claim_stages OFF;

            -- 3. Drop existing table
            DROP TABLE dbo.lms_reimbursement_claim_stages;

            -- 4. Rename temp table to dbo.lms_reimbursement_claim_stages
            EXEC sp_rename 'dbo.tmp_lms_reimbursement_claim_stages', 'lms_reimbursement_claim_stages';

            -- 5. Recreate Primary Key
            ALTER TABLE dbo.lms_reimbursement_claim_stages
            ADD CONSTRAINT PK_lms_reimbursement_claim_stages PRIMARY KEY CLUSTERED (id ASC);

            -- 6. Recreate Foreign Key referencing lms_reimbursement_claims (claim_code)
            ALTER TABLE dbo.lms_reimbursement_claim_stages
            ADD CONSTRAINT FK_lms_reimbursement_claim_stages_code
            FOREIGN KEY (request_code) REFERENCES dbo.lms_reimbursement_claims (claim_code) ON DELETE CASCADE;

            -- 7. Recreate Nonclustered Index on request_code
            CREATE NONCLUSTERED INDEX IX_lms_reimbursement_claim_stages_request_code
            ON dbo.lms_reimbursement_claim_stages (request_code ASC);
        END
    """)


def downgrade() -> None:
    pass
