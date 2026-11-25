"""consolidate_profile_tables_with_lms_prefix

Revision ID: 0f825b2d2a10
Revises: 412bbbc82e93
Create Date: 2026-09-23 09:59:13.103561

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f825b2d2a10'
down_revision: Union[str, Sequence[str], None] = '412bbbc82e93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Consolidates skills/interests tables into lms_employee_profiles,
    creates lms_employee_certifications, migrates existing data,
    and drops redundant individual sub-tables.
    """
    # 1. Create lms_employee_profiles table
    op.execute("""
    IF OBJECT_ID('lms_employee_profiles', 'U') IS NULL
    BEGIN
        CREATE TABLE lms_employee_profiles (
            profile_id INT IDENTITY(1,1) PRIMARY KEY,

            -- Azure AD Identifiers
            azure_ad_oid VARCHAR(64) NOT NULL,
            employee_code VARCHAR(30) NOT NULL,
            user_principal_name VARCHAR(255) NOT NULL,

            -- Profile Bio & Assets
            about_me VARCHAR(MAX) NULL,
            linkedin_url VARCHAR(500) NULL,
            avatar_url VARCHAR(MAX) NULL,

            -- Consolidated Skills & Expertise (JSON Array Strings)
            technical_skills NVARCHAR(MAX) NULL,
            professional_skills NVARCHAR(MAX) NULL,
            areas_of_expertise NVARCHAR(MAX) NULL,
            learning_interests NVARCHAR(MAX) NULL,

            -- Audit Columns
            created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
            updated_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT uq_lms_employee_profile_azure_oid UNIQUE (azure_ad_oid),
            CONSTRAINT uq_lms_employee_profile_employee_code UNIQUE (employee_code)
        );
    END;
    """)

    # 2. Create lms_employee_certifications table
    op.execute("""
    IF OBJECT_ID('lms_employee_certifications', 'U') IS NULL
    BEGIN
        CREATE TABLE lms_employee_certifications (
            certification_id INT IDENTITY(1,1) PRIMARY KEY,
            profile_id INT NOT NULL,

            certification_name VARCHAR(200) NOT NULL,
            issuing_organization VARCHAR(200) NOT NULL,
            issue_date DATE NOT NULL,
            expiry_date DATE NULL,

            certificate_url VARCHAR(MAX) NULL,
            certificate_file_name VARCHAR(255) NULL,
            certificate_file_size INT NULL,

            -- Audit Columns
            created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
            updated_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT fk_lms_cert_profile FOREIGN KEY (profile_id) 
                REFERENCES lms_employee_profiles(profile_id) ON DELETE CASCADE,
            CONSTRAINT chk_lms_cert_dates CHECK (expiry_date IS NULL OR expiry_date >= issue_date)
        );
    END;
    """)

    # 3. Migrate existing records from old tables if present
    bind = op.get_bind()
    has_old_profiles = bind.execute(sa.text(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_profiles'"
    )).scalar()

    if has_old_profiles:
        old_rows = bind.execute(sa.text("""
            SELECT profile_id, azure_ad_oid, employee_code, user_principal_name,
                   about_me, linkedin_url, avatar_url
            FROM employee_profiles
        """)).fetchall()

        for r in old_rows:
            old_pid = r[0]

            # Gather technical skills
            tech_skills = []
            has_tech = bind.execute(sa.text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_technical_skills'"
            )).scalar()
            if has_tech:
                rows_tech = bind.execute(sa.text(
                    "SELECT skill_name FROM employee_technical_skills WHERE profile_id = :pid ORDER BY skill_name"
                ), {"pid": old_pid}).fetchall()
                tech_skills = [row[0] for row in rows_tech if row and row[0]]

            # Gather professional skills
            prof_skills = []
            has_prof = bind.execute(sa.text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_professional_skills'"
            )).scalar()
            if has_prof:
                rows_prof = bind.execute(sa.text(
                    "SELECT skill_name FROM employee_professional_skills WHERE profile_id = :pid ORDER BY skill_name"
                ), {"pid": old_pid}).fetchall()
                prof_skills = [row[0] for row in rows_prof if row and row[0]]

            # Gather areas of expertise
            areas = []
            has_areas = bind.execute(sa.text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_areas_of_expertise'"
            )).scalar()
            if has_areas:
                rows_areas = bind.execute(sa.text(
                    "SELECT area_name FROM employee_areas_of_expertise WHERE profile_id = :pid ORDER BY area_name"
                ), {"pid": old_pid}).fetchall()
                areas = [row[0] for row in rows_areas if row and row[0]]

            # Gather learning interests
            interests = []
            has_interests = bind.execute(sa.text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_learning_interests'"
            )).scalar()
            if has_interests:
                rows_interests = bind.execute(sa.text(
                    "SELECT interest_topic FROM employee_learning_interests WHERE profile_id = :pid ORDER BY interest_topic"
                ), {"pid": old_pid}).fetchall()
                interests = [row[0] for row in rows_interests if row and row[0]]

            # Insert consolidated row into lms_employee_profiles
            res = bind.execute(sa.text("""
                SET NOCOUNT ON;
                INSERT INTO lms_employee_profiles (
                    azure_ad_oid, employee_code, user_principal_name,
                    about_me, linkedin_url, avatar_url,
                    technical_skills, professional_skills, areas_of_expertise, learning_interests,
                    created_by, updated_by
                )
                VALUES (
                    :oid, :code, :upn, :about, :linkedin, :avatar,
                    :tech, :prof, :area, :interests,
                    'SYSTEM_MIGRATION', 'SYSTEM_MIGRATION'
                );
                SELECT SCOPE_IDENTITY();
            """), {
                "oid": r[1],
                "code": r[2],
                "upn": r[3],
                "about": r[4],
                "linkedin": r[5],
                "avatar": r[6],
                "tech": json.dumps(tech_skills),
                "prof": json.dumps(prof_skills),
                "area": json.dumps(areas),
                "interests": json.dumps(interests),
            })
            new_pid = res.scalar()

            # Migrate certifications
            has_certs = bind.execute(sa.text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_certifications'"
            )).scalar()
            if has_certs and new_pid:
                cert_rows = bind.execute(sa.text("""
                    SELECT certification_name, issuing_organization, issue_date, expiry_date,
                           certificate_url, certificate_file_name, certificate_file_size
                    FROM employee_certifications
                    WHERE profile_id = :pid
                """), {"pid": old_pid}).fetchall()

                for c in cert_rows:
                    bind.execute(sa.text("""
                        INSERT INTO lms_employee_certifications (
                            profile_id, certification_name, issuing_organization,
                            issue_date, expiry_date, certificate_url, certificate_file_name, certificate_file_size,
                            created_by, updated_by
                        )
                        VALUES (
                            :pid, :name, :issuer, :issue, :expiry, :url, :fname, :fsize,
                            'SYSTEM_MIGRATION', 'SYSTEM_MIGRATION'
                        )
                    """), {
                        "pid": new_pid,
                        "name": c[0],
                        "issuer": c[1],
                        "issue": c[2],
                        "expiry": c[3],
                        "url": c[4],
                        "fname": c[5],
                        "fsize": c[6],
                    })

    # 4. Drop old individual tables
    op.execute("""
    IF OBJECT_ID('employee_technical_skills', 'U') IS NOT NULL DROP TABLE employee_technical_skills;
    IF OBJECT_ID('employee_professional_skills', 'U') IS NOT NULL DROP TABLE employee_professional_skills;
    IF OBJECT_ID('employee_areas_of_expertise', 'U') IS NOT NULL DROP TABLE employee_areas_of_expertise;
    IF OBJECT_ID('employee_learning_interests', 'U') IS NOT NULL DROP TABLE employee_learning_interests;
    IF OBJECT_ID('employee_certifications', 'U') IS NOT NULL DROP TABLE employee_certifications;
    IF OBJECT_ID('employee_profiles', 'U') IS NOT NULL DROP TABLE employee_profiles;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
    IF OBJECT_ID('lms_employee_certifications', 'U') IS NOT NULL DROP TABLE lms_employee_certifications;
    IF OBJECT_ID('lms_employee_profiles', 'U') IS NOT NULL DROP TABLE lms_employee_profiles;
    """)
