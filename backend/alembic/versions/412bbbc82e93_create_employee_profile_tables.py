"""create_employee_profile_tables

Revision ID: 412bbbc82e93
Revises: c17791c29e47
Create Date: 2026-09-22 13:05:58.675757

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '412bbbc82e93'
down_revision: Union[str, Sequence[str], None] = 'c17791c29e47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create employee_profiles and its sub-tables for skills, expertise, certifications, and learning interests."""
    # 1. Profile Master Table
    op.execute("""
    IF OBJECT_ID('employee_profiles', 'U') IS NULL
    BEGIN
        CREATE TABLE employee_profiles (
            profile_id INT IDENTITY(1,1) PRIMARY KEY,
            azure_ad_oid VARCHAR(64) NOT NULL,
            employee_code VARCHAR(30) NOT NULL,
            user_principal_name VARCHAR(255) NOT NULL,
            about_me VARCHAR(1000) NULL,
            linkedin_url VARCHAR(500) NULL,
            avatar_url VARCHAR(MAX) NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            CONSTRAINT uq_employee_profile_azure_oid UNIQUE (azure_ad_oid),
            CONSTRAINT uq_employee_profile_employee_code UNIQUE (employee_code)
        );
    END;
    """)

    # 2. Technical Skills Table
    op.execute("""
    IF OBJECT_ID('employee_technical_skills', 'U') IS NULL
    BEGIN
        CREATE TABLE employee_technical_skills (
            skill_id INT IDENTITY(1,1) PRIMARY KEY,
            profile_id INT NOT NULL,
            skill_name VARCHAR(100) NOT NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            CONSTRAINT fk_tech_skills_profile FOREIGN KEY (profile_id) REFERENCES employee_profiles(profile_id) ON DELETE CASCADE,
            CONSTRAINT uq_employee_technical_skill UNIQUE (profile_id, skill_name)
        );
    END;
    """)

    # 3. Professional Skills Table
    op.execute("""
    IF OBJECT_ID('employee_professional_skills', 'U') IS NULL
    BEGIN
        CREATE TABLE employee_professional_skills (
            skill_id INT IDENTITY(1,1) PRIMARY KEY,
            profile_id INT NOT NULL,
            skill_name VARCHAR(100) NOT NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            CONSTRAINT fk_prof_skills_profile FOREIGN KEY (profile_id) REFERENCES employee_profiles(profile_id) ON DELETE CASCADE,
            CONSTRAINT uq_employee_professional_skill UNIQUE (profile_id, skill_name)
        );
    END;
    """)

    # 4. Areas of Expertise Table
    op.execute("""
    IF OBJECT_ID('employee_areas_of_expertise', 'U') IS NULL
    BEGIN
        CREATE TABLE employee_areas_of_expertise (
            expertise_id INT IDENTITY(1,1) PRIMARY KEY,
            profile_id INT NOT NULL,
            area_name VARCHAR(150) NOT NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            CONSTRAINT fk_expertise_profile FOREIGN KEY (profile_id) REFERENCES employee_profiles(profile_id) ON DELETE CASCADE,
            CONSTRAINT uq_employee_area_of_expertise UNIQUE (profile_id, area_name)
        );
    END;
    """)

    # 5. Certifications Table
    op.execute("""
    IF OBJECT_ID('employee_certifications', 'U') IS NULL
    BEGIN
        CREATE TABLE employee_certifications (
            cert_id INT IDENTITY(1,1) PRIMARY KEY,
            profile_id INT NOT NULL,
            certification_name VARCHAR(200) NOT NULL,
            issuing_organization VARCHAR(200) NOT NULL,
            issue_date DATE NOT NULL,
            expiry_date DATE NULL,
            certificate_url VARCHAR(500) NULL,
            certificate_file_name VARCHAR(255) NULL,
            certificate_file_size BIGINT NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            CONSTRAINT fk_certifications_profile FOREIGN KEY (profile_id) REFERENCES employee_profiles(profile_id) ON DELETE CASCADE,
            CONSTRAINT chk_certification_dates CHECK (expiry_date IS NULL OR expiry_date >= issue_date),
            CONSTRAINT chk_certificate_file_size CHECK (certificate_file_size IS NULL OR certificate_file_size <= 10485760)
        );
    END;
    """)

    # 6. Learning Interests Table
    op.execute("""
    IF OBJECT_ID('employee_learning_interests', 'U') IS NULL
    BEGIN
        CREATE TABLE employee_learning_interests (
            interest_id INT IDENTITY(1,1) PRIMARY KEY,
            profile_id INT NOT NULL,
            interest_topic VARCHAR(150) NOT NULL,
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            CONSTRAINT fk_interests_profile FOREIGN KEY (profile_id) REFERENCES employee_profiles(profile_id) ON DELETE CASCADE,
            CONSTRAINT uq_employee_learning_interest UNIQUE (profile_id, interest_topic)
        );
    END;
    """)


def downgrade() -> None:
    """Drop profile tables in reverse dependency order."""
    op.execute("IF OBJECT_ID('employee_learning_interests', 'U') IS NOT NULL DROP TABLE employee_learning_interests;")
    op.execute("IF OBJECT_ID('employee_certifications', 'U') IS NOT NULL DROP TABLE employee_certifications;")
    op.execute("IF OBJECT_ID('employee_areas_of_expertise', 'U') IS NOT NULL DROP TABLE employee_areas_of_expertise;")
    op.execute("IF OBJECT_ID('employee_professional_skills', 'U') IS NOT NULL DROP TABLE employee_professional_skills;")
    op.execute("IF OBJECT_ID('employee_technical_skills', 'U') IS NOT NULL DROP TABLE employee_technical_skills;")
    op.execute("IF OBJECT_ID('employee_profiles', 'U') IS NOT NULL DROP TABLE employee_profiles;")

