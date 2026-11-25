"""refactor certification requests schema

Revision ID: k6e7f8a9b0c1
Revises: j5d6e7f8a9b0
Create Date: 2026-10-07 16:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k6e7f8a9b0c1'
down_revision: Union[str, None] = 'j5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        IF OBJECT_ID('dbo.lms_certification_requests', 'U') IS NOT NULL
        BEGIN
            -- 1. Preserve and consolidate duplicate data in existing table
            IF COL_LENGTH('dbo.lms_certification_requests', 'provider_name') IS NOT NULL
            BEGIN
                UPDATE dbo.lms_certification_requests
                SET provider = COALESCE(NULLIF(provider_name, ''), provider)
                WHERE provider IS NULL OR provider = '';
            END;

            IF COL_LENGTH('dbo.lms_certification_requests', 'category_name') IS NOT NULL
            BEGIN
                UPDATE dbo.lms_certification_requests
                SET category = COALESCE(NULLIF(category_name, ''), category)
                WHERE category IS NULL OR category = '';
            END;

            -- 2. Backfill created_by from employee_id where currently set to 'SYSTEM' or NULL
            UPDATE dbo.lms_certification_requests
            SET created_by = employee_id
            WHERE created_by = 'SYSTEM' OR created_by IS NULL OR created_by = '';

            -- 3. Create temporary staging table with exact target column order and data types
            CREATE TABLE dbo.tmp_lms_certification_requests (
                id                          INT IDENTITY(1,1) NOT NULL,
                request_code                VARCHAR(20)       NOT NULL,
                employee_id                 VARCHAR(7)        NOT NULL,
                certification_name          VARCHAR(150)      NOT NULL,
                provider                    VARCHAR(150)      NULL,
                category                    VARCHAR(100)      NULL,
                exam_date                   DATE              NULL,
                estimated_cost              DECIMAL(10,2)     NULL,
                purpose                     VARCHAR(500)      NULL,
                supporting_document_path    VARCHAR(500)      NULL,
                status                      VARCHAR(20)       NOT NULL CONSTRAINT DF_tmp_cert_req_status DEFAULT 'Pending',
                created_at                  DATETIME          NOT NULL CONSTRAINT DF_tmp_cert_req_created_at DEFAULT GETDATE(),
                created_by                  VARCHAR(7)        NULL,
                updated_at                  DATETIME          NULL
            );

            -- 4. Copy all existing rows with IDENTITY_INSERT ON
            SET IDENTITY_INSERT dbo.tmp_lms_certification_requests ON;

            INSERT INTO dbo.tmp_lms_certification_requests (
                id, request_code, employee_id, certification_name, provider, category,
                exam_date, estimated_cost, purpose, supporting_document_path,
                status, created_at, created_by, updated_at
            )
            SELECT 
                id, request_code, employee_id, certification_name, provider, category,
                exam_date, estimated_cost, purpose, supporting_document_path,
                status, created_at, created_by, updated_at
            FROM dbo.lms_certification_requests;

            SET IDENTITY_INSERT dbo.tmp_lms_certification_requests OFF;

            -- 5. Drop child FK constraint from lms_certification_request_stages
            IF OBJECT_ID('dbo.FK_lms_cert_req_stages_request', 'F') IS NOT NULL
                ALTER TABLE dbo.lms_certification_request_stages DROP CONSTRAINT FK_lms_cert_req_stages_request;

            -- 6. Drop existing table
            DROP TABLE dbo.lms_certification_requests;

            -- 7. Rename temp table to dbo.lms_certification_requests
            EXEC sp_rename 'dbo.tmp_lms_certification_requests', 'lms_certification_requests';
            EXEC sp_rename 'dbo.DF_tmp_cert_req_status', 'DF_lms_certification_requests_status', 'OBJECT';
            EXEC sp_rename 'dbo.DF_tmp_cert_req_created_at', 'DF_lms_certification_requests_created_at', 'OBJECT';

            -- 8. Recreate Constraints & Indexes
            ALTER TABLE dbo.lms_certification_requests
            ADD CONSTRAINT PK_lms_certification_requests PRIMARY KEY CLUSTERED (id ASC);

            ALTER TABLE dbo.lms_certification_requests
            ADD CONSTRAINT UQ_lms_certification_requests_code UNIQUE (request_code ASC);

            ALTER TABLE dbo.lms_certification_requests
            ADD CONSTRAINT FK_lms_certification_requests_employee
            FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_certification_requests
            ADD CONSTRAINT FK_lms_certification_requests_created_by
            FOREIGN KEY (created_by) REFERENCES dbo.lms_employee_profiles (employee_id);

            ALTER TABLE dbo.lms_certification_requests
            ADD CONSTRAINT CK_lms_certification_requests_status 
            CHECK (status IN ('Pending', 'Approved', 'Rejected'));

            CREATE NONCLUSTERED INDEX IX_lms_certification_requests_employee_id
            ON dbo.lms_certification_requests (employee_id ASC);

            -- 9. Recreate child FK constraint on lms_certification_request_stages
            ALTER TABLE dbo.lms_certification_request_stages
            ADD CONSTRAINT FK_lms_cert_req_stages_request
            FOREIGN KEY (request_id) REFERENCES dbo.lms_certification_requests (id) ON DELETE CASCADE;
        END
    """)


def downgrade() -> None:
    pass
