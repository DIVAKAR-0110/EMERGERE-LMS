"""create_certification_requests

Revision ID: 1684152d389c
Revises: 8ab8b4feed55
Create Date: 2026-09-21 15:38:42.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1684152d389c'
down_revision: Union[str, Sequence[str], None] = '8ab8b4feed55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create certification_requests table with constraints and foreign keys."""
    op.execute("""
    IF OBJECT_ID('certification_requests', 'U') IS NULL
    BEGIN
        CREATE TABLE certification_requests (
            request_id INT IDENTITY(1,1) PRIMARY KEY,

            request_code VARCHAR(20) NOT NULL,

            employee_id INT NOT NULL,

            certification_name VARCHAR(200) NOT NULL,

            provider_id INT NOT NULL,

            scheduled_exam_date DATE NULL,

            category_id INT NOT NULL,

            estimated_cost_inr DECIMAL(10,2) NOT NULL,

            purpose VARCHAR(500) NOT NULL,

            supporting_document VARCHAR(500) NULL,

            supporting_document_name VARCHAR(255) NULL,

            supporting_document_size BIGINT NULL,

            request_status VARCHAR(20) NOT NULL DEFAULT 'Pending',

            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT uq_certification_request_code
                UNIQUE (request_code),

            CONSTRAINT fk_certification_request_provider
                FOREIGN KEY (provider_id)
                REFERENCES course_providers(provider_id),

            CONSTRAINT fk_certification_request_category
                FOREIGN KEY (category_id)
                REFERENCES course_categories(category_id),

            CONSTRAINT chk_certification_request_cost
                CHECK (estimated_cost_inr > 0),

            CONSTRAINT chk_certification_request_status
                CHECK (
                    request_status IN (
                        'Pending',
                        'Approved',
                        'Rejected'
                    )
                ),

            CONSTRAINT chk_supporting_document_size
                CHECK (
                    supporting_document_size IS NULL
                    OR supporting_document_size <= 10485760
                )
        );
    END;
    """)


def downgrade() -> None:
    """Drop certification_requests table."""
    op.execute("IF OBJECT_ID('certification_requests', 'U') IS NOT NULL DROP TABLE certification_requests;")
