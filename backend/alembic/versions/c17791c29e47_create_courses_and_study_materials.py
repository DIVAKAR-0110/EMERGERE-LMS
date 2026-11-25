"""create_courses_and_study_materials

Revision ID: c17791c29e47
Revises: 75a8b9c3de4b
Create Date: 2026-09-21 16:47:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c17791c29e47'
down_revision: Union[str, Sequence[str], None] = '75a8b9c3de4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create courses and study_materials tables with constraints and foreign keys."""
    op.execute("""
    IF OBJECT_ID('courses', 'U') IS NULL
    BEGIN
        CREATE TABLE courses (
            course_id INT IDENTITY(1,1) PRIMARY KEY,

            course_code VARCHAR(20) NOT NULL,

            ld_id INT NOT NULL,

            course_url VARCHAR(500) NOT NULL,

            course_title VARCHAR(200) NOT NULL,

            provider_id INT NOT NULL,

            category_id INT NOT NULL,

            duration VARCHAR(50) NULL,

            course_account_email VARCHAR(255) NOT NULL,

            description VARCHAR(500) NULL,

            course_thumbnail VARCHAR(500) NULL,

            course_thumbnail_name VARCHAR(255) NULL,

            course_thumbnail_size BIGINT NULL,

            is_active BIT NOT NULL DEFAULT 1,

            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT uq_course_code
                UNIQUE (course_code),

            CONSTRAINT fk_course_provider
                FOREIGN KEY (provider_id)
                REFERENCES course_providers(provider_id),

            CONSTRAINT fk_course_category
                FOREIGN KEY (category_id)
                REFERENCES course_categories(category_id),

            CONSTRAINT chk_course_thumbnail_size
                CHECK (
                    course_thumbnail_size IS NULL
                    OR course_thumbnail_size <= 10485760
                )
        );
    END;
    """)

    op.execute("""
    IF OBJECT_ID('study_materials', 'U') IS NULL
    BEGIN
        CREATE TABLE study_materials (
            material_id INT IDENTITY(1,1) PRIMARY KEY,

            material_code VARCHAR(20) NOT NULL,

            ld_id INT NOT NULL,

            material_title VARCHAR(200) NOT NULL,

            material_type VARCHAR(50) NOT NULL,

            description VARCHAR(250) NULL,

            material_file VARCHAR(500) NOT NULL,

            material_file_name VARCHAR(255) NOT NULL,

            material_file_size BIGINT NOT NULL,

            is_active BIT NOT NULL DEFAULT 1,

            created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

            CONSTRAINT uq_study_material_code
                UNIQUE (material_code),

            CONSTRAINT chk_material_file_size
                CHECK (
                    material_file_size <= 52428800
                )
        );
    END;
    """)


def downgrade() -> None:
    """Drop courses and study_materials tables."""
    op.execute("IF OBJECT_ID('study_materials', 'U') IS NOT NULL DROP TABLE study_materials;")
    op.execute("IF OBJECT_ID('courses', 'U') IS NOT NULL DROP TABLE courses;")
