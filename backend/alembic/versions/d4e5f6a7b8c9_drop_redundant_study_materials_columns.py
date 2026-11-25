"""drop_redundant_study_materials_columns

Revision ID: d4e5f6a7b8c9
Revises: a92b3c4d5e6f
Create Date: 2026-10-07 09:12:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'a92b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLS_TO_DROP = [
    'category_id',
    'file_type',
    'file_size',
    'reading_time',
    'author',
    'icon_type',
    'rating',
    'file_url',
    'thumbnail_url'
]

def upgrade() -> None:
    """Safely drop default constraints and remove redundant columns from lms_study_materials."""
    bind = op.get_bind()
    dialect_name = bind.dialect.name.lower()

    if 'mssql' in dialect_name or 'pyodbc' in dialect_name:
        # SQL Server dynamic constraint drop and column removal
        drop_sql = """
        DECLARE @tbl VARCHAR(100) = 'lms_study_materials';
        DECLARE @col VARCHAR(100);
        DECLARE @cname VARCHAR(200);
        DECLARE @sql NVARCHAR(MAX);

        -- Cursor over target columns to drop their default constraints first
        DECLARE col_cursor CURSOR FOR
        SELECT col_name FROM (
            VALUES 
                ('category_id'),
                ('file_type'),
                ('file_size'),
                ('reading_time'),
                ('author'),
                ('icon_type'),
                ('rating'),
                ('file_url'),
                ('thumbnail_url')
        ) AS TargetCols(col_name);

        OPEN col_cursor;
        FETCH NEXT FROM col_cursor INTO @col;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @cname = NULL;
            -- Find and drop default constraint if exists
            SELECT @cname = dc.name
            FROM sys.default_constraints dc
            JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
            WHERE dc.parent_object_id = OBJECT_ID('dbo.lms_study_materials')
              AND c.name = @col;

            IF @cname IS NOT NULL
            BEGIN
                SET @sql = 'ALTER TABLE dbo.lms_study_materials DROP CONSTRAINT [' + @cname + ']';
                EXEC sp_executesql @sql;
            END

            -- Drop column if it exists
            IF COL_LENGTH('dbo.lms_study_materials', @col) IS NOT NULL
            BEGIN
                SET @sql = 'ALTER TABLE dbo.lms_study_materials DROP COLUMN [' + @col + ']';
                EXEC sp_executesql @sql;
            END

            FETCH NEXT FROM col_cursor INTO @col;
        END

        CLOSE col_cursor;
        DEALLOCATE col_cursor;
        """
        op.execute(drop_sql)
    else:
        # SQLite / generic batch alter table
        try:
            with op.batch_alter_table('lms_study_materials') as batch_op:
                for col in COLS_TO_DROP:
                    try:
                        batch_op.drop_column(col)
                    except Exception:
                        pass
        except Exception:
            pass

def downgrade() -> None:
    """Re-add the dropped columns as nullable for safe rollback."""
    bind = op.get_bind()
    dialect_name = bind.dialect.name.lower()

    if 'mssql' in dialect_name or 'pyodbc' in dialect_name:
        op.execute("""
        IF COL_LENGTH('dbo.lms_study_materials', 'category_id') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD category_id INT NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'file_type') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD file_type VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'file_size') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD file_size VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'reading_time') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD reading_time VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'author') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD author VARCHAR(100) NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'icon_type') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD icon_type VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'rating') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD rating DECIMAL(3,1) NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'file_url') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD file_url VARCHAR(500) NULL;
        IF COL_LENGTH('dbo.lms_study_materials', 'thumbnail_url') IS NULL
            ALTER TABLE dbo.lms_study_materials ADD thumbnail_url VARCHAR(500) NULL;
        """)
    else:
        with op.batch_alter_table('lms_study_materials') as batch_op:
            batch_op.add_column(sa.Column('category_id', sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column('file_type', sa.String(50), nullable=True))
            batch_op.add_column(sa.Column('file_size', sa.String(50), nullable=True))
            batch_op.add_column(sa.Column('reading_time', sa.String(50), nullable=True))
            batch_op.add_column(sa.Column('author', sa.String(100), nullable=True))
            batch_op.add_column(sa.Column('icon_type', sa.String(50), nullable=True))
            batch_op.add_column(sa.Column('rating', sa.Numeric(3, 1), nullable=True))
            batch_op.add_column(sa.Column('file_url', sa.String(500), nullable=True))
            batch_op.add_column(sa.Column('thumbnail_url', sa.String(500), nullable=True))
