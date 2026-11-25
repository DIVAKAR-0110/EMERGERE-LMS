"""create_reimbursement_claims

Revision ID: 75a8b9c3de4b
Revises: 1684152d389c
Create Date: 2026-09-21 16:01:50.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75a8b9c3de4b'
down_revision: Union[str, Sequence[str], None] = '1684152d389c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create reimbursement_claims table with constraints and foreign keys."""
    op.execute("""
    IF OBJECT_ID('reimbursement_claims', 'U') IS NULL
    BEGIN
        CREATE TABLE reimbursement_claims (
            claim_id INT IDENTITY(1,1) PRIMARY KEY,

            claim_code VARCHAR(20) NOT NULL,

            employee_id INT NOT NULL,

            certification_name VARCHAR(200) NOT NULL,

            provider_id INT NOT NULL,

            amount_inr DECIMAL(10,2) NOT NULL,

            purchase_date DATE NOT NULL,

            completion_date DATE NOT NULL,

            validity_from DATE NULL,

            validity_to DATE NULL,

            supporting_document VARCHAR(500) NOT NULL,

            supporting_document_name VARCHAR(255) NOT NULL,

            supporting_document_size BIGINT NOT NULL,

            claim_status VARCHAR(20) NOT NULL DEFAULT 'Pending',

            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT uq_reimbursement_claim_code
                UNIQUE (claim_code),

            CONSTRAINT fk_reimbursement_claim_provider
                FOREIGN KEY (provider_id)
                REFERENCES course_providers(provider_id),

            CONSTRAINT chk_reimbursement_amount
                CHECK (amount_inr > 0),

            CONSTRAINT chk_reimbursement_document_size
                CHECK (supporting_document_size <= 10485760),

            CONSTRAINT chk_reimbursement_validity_date
                CHECK (
                    validity_to IS NULL
                    OR validity_from IS NULL
                    OR validity_to >= validity_from
                ),

            CONSTRAINT chk_reimbursement_claim_status
                CHECK (
                    claim_status IN (
                        'Pending',
                        'Approved',
                        'Rejected'
                    )
                )
        );
    END;
    """)


def downgrade() -> None:
    """Drop reimbursement_claims table."""
    op.execute("IF OBJECT_ID('reimbursement_claims', 'U') IS NOT NULL DROP TABLE reimbursement_claims;")
