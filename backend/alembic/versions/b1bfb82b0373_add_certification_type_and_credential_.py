"""add_certification_type_and_credential_id_to_lms_employee_certifications

Revision ID: b1bfb82b0373
Revises: 0f825b2d2a10
Create Date: 2026-09-28 15:28:37.418760

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1bfb82b0373'
down_revision: Union[str, Sequence[str], None] = '0f825b2d2a10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade schema:
    Adds [Certification Type], [Credential ID], and [Supporting Documents]
    to lms_employee_certifications table so it supports both Employee Profile
    and Certification & Reimbursement upload workflows in a single table.
    """
    op.execute("""
    IF COL_LENGTH('lms_employee_certifications', 'Certification Type') IS NULL
    BEGIN
        ALTER TABLE lms_employee_certifications 
        ADD [Certification Type] VARCHAR(100) NULL DEFAULT 'Professional Certifications';
    END;
    """)

    op.execute("""
    IF COL_LENGTH('lms_employee_certifications', 'Credential ID') IS NULL
    BEGIN
        ALTER TABLE lms_employee_certifications 
        ADD [Credential ID] VARCHAR(100) NULL;
    END;
    """)

    op.execute("""
    IF COL_LENGTH('lms_employee_certifications', 'Supporting Documents') IS NULL
    BEGIN
        ALTER TABLE lms_employee_certifications 
        ADD [Supporting Documents] NVARCHAR(MAX) NULL;
    END;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
    IF COL_LENGTH('lms_employee_certifications', 'Supporting Documents') IS NOT NULL
    BEGIN
        ALTER TABLE lms_employee_certifications DROP COLUMN [Supporting Documents];
    END;
    """)

    op.execute("""
    IF COL_LENGTH('lms_employee_certifications', 'Credential ID') IS NOT NULL
    BEGIN
        ALTER TABLE lms_employee_certifications DROP COLUMN [Credential ID];
    END;
    """)

    op.execute("""
    IF COL_LENGTH('lms_employee_certifications', 'Certification Type') IS NOT NULL
    BEGIN
        DECLARE @ConstraintName NVARCHAR(200);
        SELECT @ConstraintName = d.name
        FROM sys.default_constraints d
        JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
        WHERE d.parent_object_id = OBJECT_ID('lms_employee_certifications') AND c.name = 'Certification Type';

        IF @ConstraintName IS NOT NULL
            EXEC('ALTER TABLE lms_employee_certifications DROP CONSTRAINT ' + @ConstraintName);

        ALTER TABLE lms_employee_certifications DROP COLUMN [Certification Type];
    END;
    """)
