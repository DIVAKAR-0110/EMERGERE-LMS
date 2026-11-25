"""
Database connection factory and utilities.
Supports Microsoft SQL Server with automatic local SQLite fallback.
Provides dictfetchall and dictfetchone for mapping database rows to dictionaries.
"""
 
import json
import os
import re
import sqlite3
from typing import List, Dict, Any, Optional
from config import config
 
DB_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_PATH = os.path.join(DB_DIR, "lms_local.db")
 
_db_mode = None  # 'sql_server' or 'sqlite'
_cached_server = None

def connect_db():
    """
    Creates and returns a new database connection.
    Connects to Microsoft SQL Server using pyodbc.
    """
    global _db_mode, _cached_server
    import pyodbc

    server_candidates = []
    if _cached_server:
        server_candidates.append(_cached_server)
    if config.DB_SERVER not in server_candidates:
        server_candidates.append(config.DB_SERVER)
    if ".\\SQL2008" not in server_candidates:
        server_candidates.append(".\\SQL2008")
    if "localhost\\SQL2008" not in server_candidates:
        server_candidates.append("localhost\\SQL2008")

    last_error = None
    for srv in server_candidates:
        try:
            parts = [
                f"DRIVER={{{config.DB_DRIVER}}}",
                f"SERVER={srv}",
                f"DATABASE={config.DB_NAME}",
                "TrustServerCertificate=yes",
            ]
            if getattr(config, "IS_TRUSTED_CONNECTION", config.DB_TRUSTED_CONNECTION == "yes"):
                parts.append("Trusted_Connection=yes")
            else:
                parts.append(f"UID={config.DB_USER}")
                parts.append(f"PWD={config.DB_PASSWORD}")

            conn_str = ";".join(parts) + ";"
            conn = pyodbc.connect(conn_str, timeout=4)
            _cached_server = srv
            if _db_mode != "sql_server":
                auth_desc = "Windows Trusted Authentication" if (config.DB_TRUSTED_CONNECTION == "yes") else f"SQL Authentication (UID={config.DB_USER})"
                print(f"[Database] Connected successfully to SQL Server [{srv}] Database [{config.DB_NAME}] using {auth_desc}.")
                _db_mode = "sql_server"
            return conn
        except Exception as e:
            last_error = e

    auth_desc = "Windows Trusted Authentication" if (config.DB_TRUSTED_CONNECTION == "yes") else f"SQL Authentication (UID={config.DB_USER})"
    print(f"[Database ERROR] SQL Server connection failed ({auth_desc} on server '{config.DB_SERVER}', database '{config.DB_NAME}'): {last_error}")
    raise RuntimeError(f"Database connection error: Unable to connect to Microsoft SQL Server [{config.DB_SERVER}]. {last_error}") from last_error

def is_sql_server():
    return True

def serialize_value(val):
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return val
 
def dictfetchall(cursor) -> List[Dict[str, Any]]:
    """Return all rows from a cursor as a list of dicts."""
    desc = cursor.description
    if not desc:
        return []
    columns = [col[0] for col in desc]
    rows = cursor.fetchall()
    return [{col: serialize_value(val) for col, val in zip(columns, row)} for row in rows]
 
def dictfetchone(cursor) -> Optional[Dict[str, Any]]:
    """Return one row from a cursor as a dict or None."""
    desc = cursor.description
    if not desc:
        return None
    columns = [col[0] for col in desc]
    row = cursor.fetchone()
    return {col: serialize_value(val) for col, val in zip(columns, row)} if row else None

def _sync_active_slots_sqlserver(conn, cursor):
    """
    Idempotently backfills/syncs active enrollments from dbo.lms_course_enrollments
    into the 4 physical concurrency slots of dbo.lms_active_slots.
    """
    try:
        cursor.execute("""
            -- 1. Ensure all EmailProviders have physical slots 1..4
            INSERT INTO dbo.lms_active_slots (EmailProviderId, slot_number, status)
            SELECT ep.EmailProviderId, n.num, 'Available'
            FROM dbo.EmailProviders ep
            CROSS JOIN (VALUES (1), (2), (3), (4)) AS n(num)
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.lms_active_slots s 
                WHERE s.EmailProviderId = ep.EmailProviderId AND s.slot_number = n.num
            );

            -- 2. Map active enrollments to slots up to 4 per EmailProviderId
            WITH ActiveEnrollments AS (
                SELECT 
                    c.EmailProviderId,
                    e.id AS enrollment_id,
                    e.employee_id,
                    e.created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY c.EmailProviderId 
                        ORDER BY 
                            CASE WHEN e.status = 'In Progress' THEN 1 ELSE 2 END,
                            e.id ASC
                    ) AS slot_pos
                FROM dbo.lms_course_enrollments e
                JOIN dbo.lms_courses c ON c.id = e.course_id
                WHERE c.EmailProviderId IS NOT NULL
                  AND e.status IN ('Assigned', 'Not Started', 'In Progress')
            )
            UPDATE s
            SET 
                s.enrollment_id = ae.enrollment_id,
                s.status = 'Occupied'
            FROM dbo.lms_active_slots s
            JOIN ActiveEnrollments ae 
                ON s.EmailProviderId = ae.EmailProviderId 
               AND s.slot_number = ae.slot_pos
            WHERE ae.slot_pos <= 4;

            -- 3. Synchronize occupied_slots, available_slots, enrollment_employee_ids
            WITH SlotAggregates AS (
                SELECT 
                    s.EmailProviderId,
                    SUM(CASE WHEN s.status = 'Occupied' THEN 1 ELSE 0 END) AS occ_count,
                    SUM(CASE WHEN s.status = 'Available' THEN 1 ELSE 0 END) AS avail_count,
                    COALESCE(
                        STUFF((
                            SELECT ', ' + e.employee_id
                            FROM dbo.lms_active_slots s2
                            JOIN dbo.lms_course_enrollments e ON e.id = s2.enrollment_id
                            WHERE s2.EmailProviderId = s.EmailProviderId AND s2.status = 'Occupied'
                            ORDER BY s2.slot_number ASC
                            FOR XML PATH(''), TYPE
                        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''),
                        'None'
                    ) AS emp_ids
                FROM dbo.lms_active_slots s
                GROUP BY s.EmailProviderId
            )
            UPDATE s
            SET 
                s.occupied_slots = sa.occ_count,
                s.available_slots = sa.avail_count,
                s.enrollment_employee_ids = sa.emp_ids
            FROM dbo.lms_active_slots s
            JOIN SlotAggregates sa ON sa.EmailProviderId = s.EmailProviderId;
        """)
        conn.commit()
    except Exception as e:
        print(f"[Database] Notice syncing active slots: {e}")

def _seed_initial_data(conn, cursor):
    """
    Synchronizes Microsoft Entra ID employee profiles into dbo.lms_employee_profiles.
    Idempotent and safe to run on every startup (does not seed mock providers/categories).
    """
    try:
        from services.common.auth_service import employee_service
        employees = employee_service.get_all_employees()
    except Exception as e:
        print(f"[Database] Notice fetching employees for seed: {e}")
        employees = []

    # 1. Sync all Microsoft Entra ID employees into lms_employee_profiles (linkedin_url stays NULL until user enters it)
    for emp in employees:
        emp_id = emp.get("employee_id")
        if emp_id:
            try:
                if is_sql_server():
                    cursor.execute("""
                        IF NOT EXISTS (SELECT 1 FROM dbo.lms_employee_profiles WHERE employee_id = ?)
                        BEGIN
                            INSERT INTO dbo.lms_employee_profiles (employee_id, created_by)
                            VALUES (?, 'SYSTEM');
                        END
                    """, (emp_id, emp_id))
                else:
                    cursor.execute("""
                        INSERT OR IGNORE INTO lms_employee_profiles (employee_id, created_by)
                        VALUES (?, 'SYSTEM')
                    """, (emp_id,))
            except Exception as e:
                print(f"[Database] Notice syncing employee {emp_id}: {e}")
    conn.commit()

    # 2. Keep CourseProviders & CourseCategories empty by default (no predefined mock data)
    default_providers = []
    default_categories = []
    try:
        providers_tbl = "dbo.CourseProviders" if is_sql_server() else "CourseProviders"
        categories_tbl = "dbo.CourseCategories" if is_sql_server() else "CourseCategories"

        cursor.execute(f"SELECT COUNT(1) FROM {providers_tbl}")
        if (cursor.fetchone() or [0])[0] == 0:
            for p_name in default_providers:
                cursor.execute(
                    f"INSERT INTO {providers_tbl} (ProviderName, IsActive) VALUES (?, 1)",
                    (p_name,),
                )

        cursor.execute(f"SELECT COUNT(1) FROM {categories_tbl}")
        if (cursor.fetchone() or [0])[0] == 0:
            for c_name in default_categories:
                cursor.execute(
                    f"INSERT INTO {categories_tbl} (CategoryName, IsActive) VALUES (?, 1)",
                    (c_name,),
                )
        conn.commit()
    except Exception as e:
        print(f"[Database] Notice seeding CourseProviders/CourseCategories: {e}")



def _backfill_profile_certifications(conn, cursor, table_prefix: str = "") -> None:
    """Idempotently backfills lms_employee_profiles.certifications in minimal bulk queries."""
    cursor.execute(f"SELECT employee_id, id FROM {table_prefix}lms_employee_certificates ORDER BY id ASC")
    certs_by_emp: Dict[str, List[int]] = {}
    for emp_id, cid in cursor.fetchall():
        if emp_id and cid is not None:
            certs_by_emp.setdefault(str(emp_id).strip().lower(), []).append(int(cid))

    cursor.execute(f"SELECT employee_id, certifications FROM {table_prefix}lms_employee_profiles")
    updates = []
    for emp_id, existing_val in cursor.fetchall():
        if not emp_id:
            continue
        cids = certs_by_emp.get(str(emp_id).strip().lower(), [])
        expected = json.dumps(cids) if cids else None
        if existing_val != expected:
            updates.append((expected, emp_id))

    if updates:
        for expected, emp_id in updates:
            cursor.execute(
                f"UPDATE {table_prefix}lms_employee_profiles SET certifications = ? WHERE employee_id = ?",
                (expected, emp_id),
            )
        conn.commit()


def _migrate_sqlite_schema(conn, cursor):
    """
    Performs idempotent migrations on existing SQLite databases to ensure all required
    columns and constraints exist across branch merges and schema updates.
    """
    try:
        # 1. Ensure request_code exists in lms_reimbursement_claim_stages
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lms_reimbursement_claim_stages'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(lms_reimbursement_claim_stages)")
            rc_cols = [r[1] for r in cursor.fetchall()]
            if "request_code" not in rc_cols:
                cursor.execute("ALTER TABLE lms_reimbursement_claim_stages ADD COLUMN request_code TEXT")
                if "claim_id" in rc_cols:
                    cursor.execute("""
                        UPDATE lms_reimbursement_claim_stages 
                        SET request_code = (
                            SELECT claim_code FROM lms_reimbursement_claims 
                            WHERE lms_reimbursement_claims.id = lms_reimbursement_claim_stages.claim_id
                        ) 
                        WHERE request_code IS NULL
                    """)
                    cursor.execute("UPDATE lms_reimbursement_claim_stages SET request_code = 'CLM-' || claim_id WHERE request_code IS NULL")
                conn.commit()
                print("[Database] Migrated lms_reimbursement_claim_stages to add request_code column.")

        # 2. Ensure request_code exists in lms_course_request_stages
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lms_course_request_stages'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(lms_course_request_stages)")
            crs_cols = [r[1] for r in cursor.fetchall()]
            if "request_code" not in crs_cols:
                cursor.execute("ALTER TABLE lms_course_request_stages ADD COLUMN request_code TEXT")
                if "request_id" in crs_cols:
                    cursor.execute("""
                        UPDATE lms_course_request_stages 
                        SET request_code = (
                            SELECT request_code FROM lms_course_requests 
                            WHERE lms_course_requests.id = lms_course_request_stages.request_id
                        ) 
                        WHERE request_code IS NULL
                    """)
                    cursor.execute("UPDATE lms_course_request_stages SET request_code = 'REQ-' || request_id WHERE request_code IS NULL")
                conn.commit()
                print("[Database] Migrated lms_course_request_stages to add request_code column.")

        # 3. Ensure learning_interests exists in lms_employee_profiles
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lms_employee_profiles'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(lms_employee_profiles)")
            emp_cols = [r[1] for r in cursor.fetchall()]
            if "learning_interests" not in emp_cols:
                cursor.execute("ALTER TABLE lms_employee_profiles ADD COLUMN learning_interests TEXT")
                conn.commit()
                print("[Database] Migrated lms_employee_profiles to add learning_interests column.")
            if "certifications" not in emp_cols:
                cursor.execute("ALTER TABLE lms_employee_profiles ADD COLUMN certifications TEXT")
                conn.commit()
                print("[Database] Migrated lms_employee_profiles to add certifications column.")
            _backfill_profile_certifications(conn, cursor, table_prefix="")

        # 4. Ensure lms_workshops_training matches form schema (remove college_name, ensure event_category)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lms_workshops_training'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(lms_workshops_training)")
            ws_cols = [r[1] for r in cursor.fetchall()]
            if "college_name" in ws_cols or "event_category" not in ws_cols:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS lms_workshops_training_migrated (
                        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_name          TEXT NOT NULL,
                        event_category      TEXT NOT NULL DEFAULT 'Workshop',
                        department          TEXT,
                        start_date          DATE NOT NULL,
                        end_date            DATE,
                        participants_count  INTEGER NOT NULL DEFAULT 0,
                        event_type          TEXT NOT NULL DEFAULT 'Paid',
                        actual_spent        REAL NOT NULL DEFAULT 0.0,
                        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        created_by          TEXT,
                        updated_at          DATETIME,
                        updated_by          TEXT
                    )
                """)
                cursor.execute("""
                    INSERT INTO lms_workshops_training_migrated
                    (id, event_name, event_category, department, start_date, end_date, participants_count, event_type, actual_spent, created_at, created_by, updated_at, updated_by)
                    SELECT 
                        id, 
                        event_name, 
                        COALESCE(
                            CASE 
                                WHEN event_type IN ('Workshop', 'Training') THEN event_type
                                WHEN LOWER(event_name) LIKE '%training%' THEN 'Training'
                                ELSE 'Workshop'
                            END, 
                            'Workshop'
                        ) AS event_category,
                        department, 
                        start_date, 
                        end_date, 
                        participants_count, 
                        CASE WHEN actual_spent > 0 THEN 'Paid' ELSE 'Unpaid' END AS event_type, 
                        actual_spent, 
                        created_at, 
                        created_by, 
                        updated_at, 
                        updated_by
                    FROM lms_workshops_training
                """)
                cursor.execute("DROP TABLE lms_workshops_training")
                cursor.execute("ALTER TABLE lms_workshops_training_migrated RENAME TO lms_workshops_training")
                conn.commit()
                print("[Database] Migrated lms_workshops_training to match form schema.")

        # 5. Ensure is_ceo_bypassed and reopen_reason exist in lms_certification_requests and lms_course_requests
        for tbl in ("lms_certification_requests", "lms_course_requests"):
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
            if cursor.fetchone():
                cursor.execute(f"PRAGMA table_info({tbl})")
                tbl_cols = [r[1] for r in cursor.fetchall()]
                if "is_ceo_bypassed" not in tbl_cols:
                    cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN is_ceo_bypassed INTEGER NOT NULL DEFAULT 0")
                    conn.commit()
                    print(f"[Database] Migrated {tbl} to add is_ceo_bypassed column.")
                if "reopen_reason" not in tbl_cols:
                    cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN reopen_reason TEXT")
                    conn.commit()
                    print(f"[Database] Migrated {tbl} to add reopen_reason column.")

        # 6. Ensure payment_status exists in lms_courses
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lms_courses'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(lms_courses)")
            c_cols = [r[1] for r in cursor.fetchall()]
            if "payment_status" not in c_cols:
                cursor.execute("ALTER TABLE lms_courses ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'Pending Payment'")
                conn.commit()
                print("[Database] Migrated lms_courses to add payment_status column.")

        # 8. Ensure domain_id exists in lms_employee_certificates and lms_certification_requests
        for tbl in ("lms_employee_certificates", "lms_certification_requests"):
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
            if cursor.fetchone():
                cursor.execute(f"PRAGMA table_info({tbl})")
                tbl_cols = [r[1] for r in cursor.fetchall()]
                if "domain_id" not in tbl_cols:
                    cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN domain_id INTEGER")
                    conn.commit()
                    print(f"[Database] Migrated {tbl} to add domain_id column.")
    except Exception as e:
        print(f"[Database] Notice during SQLite schema migration: {e}")


def _migrate_employee_profiles_sqlserver(conn, cursor):
    """
    Idempotently removes legacy `id` and `azure_user_id` columns from dbo.lms_employee_profiles
    and promotes `employee_id` to PRIMARY KEY, safely dropping and recreating child Foreign Keys.
    """
    try:
        cursor.execute("""
            SELECT
                CASE WHEN COL_LENGTH('dbo.lms_employee_profiles', 'id') IS NOT NULL THEN 1 ELSE 0 END,
                CASE WHEN COL_LENGTH('dbo.lms_employee_profiles', 'azure_user_id') IS NOT NULL THEN 1 ELSE 0 END
        """)
        flags = cursor.fetchone()
        has_id = bool(flags and flags[0])
        has_azure = bool(flags and flags[1])
        if not has_id and not has_azure:
            return

        # Snapshot all Foreign Keys referencing dbo.lms_employee_profiles
        cursor.execute("""
            SELECT
                fk.name AS fk_name,
                OBJECT_SCHEMA_NAME(fk.parent_object_id) AS child_schema,
                OBJECT_NAME(fk.parent_object_id) AS child_table,
                c1.name AS child_col,
                c2.name AS ref_col,
                fk.delete_referential_action_desc,
                fk.update_referential_action_desc
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
            JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
            WHERE fk.referenced_object_id = OBJECT_ID('dbo.lms_employee_profiles')
        """)
        fk_rows = cursor.fetchall()

        # Find current PK / UQ / index constraints on dbo.lms_employee_profiles
        cursor.execute("""
            SELECT name, type
            FROM sys.objects
            WHERE parent_object_id = OBJECT_ID('dbo.lms_employee_profiles')
              AND type IN ('PK', 'UQ')
        """)
        key_constraints = cursor.fetchall()

        # Drop child FKs referencing dbo.lms_employee_profiles
        for row in fk_rows:
            fk_name, child_schema, child_table = row[0], row[1], row[2]
            cursor.execute(f"ALTER TABLE [{child_schema}].[{child_table}] DROP CONSTRAINT [{fk_name}]")

        # Drop existing PK and UQ constraints on dbo.lms_employee_profiles
        for cname, _ in key_constraints:
            cursor.execute(f"ALTER TABLE dbo.lms_employee_profiles DROP CONSTRAINT [{cname}]")

        # Drop legacy columns if present
        cols_to_drop = []
        if has_id:
            cols_to_drop.append("[id]")
        if has_azure:
            cols_to_drop.append("[azure_user_id]")
        if cols_to_drop:
            cursor.execute(f"ALTER TABLE dbo.lms_employee_profiles DROP COLUMN {', '.join(cols_to_drop)}")

        # Ensure employee_id is NOT NULL and promote it to PRIMARY KEY
        cursor.execute("ALTER TABLE dbo.lms_employee_profiles ALTER COLUMN employee_id VARCHAR(7) NOT NULL")
        cursor.execute("ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT PK_lms_employee_profiles PRIMARY KEY (employee_id)")

        # Recreate all child Foreign Keys referencing dbo.lms_employee_profiles(employee_id)
        for row in fk_rows:
            fk_name, child_schema, child_table, child_col, ref_col, del_act, upd_act = row
            target_ref_col = "employee_id" if ref_col in ("id", "azure_user_id") else ref_col
            extra = ""
            if del_act and del_act != "NO_ACTION":
                extra += f" ON DELETE {del_act.replace('_', ' ')}"
            if upd_act and upd_act != "NO_ACTION":
                extra += f" ON UPDATE {upd_act.replace('_', ' ')}"
            cursor.execute(
                f"ALTER TABLE [{child_schema}].[{child_table}] ADD CONSTRAINT [{fk_name}] "
                f"FOREIGN KEY ([{child_col}]) REFERENCES dbo.lms_employee_profiles ([{target_ref_col}]){extra}"
            )

        conn.commit()
        print("[Database] Migrated dbo.lms_employee_profiles: removed id and azure_user_id, employee_id is now PRIMARY KEY.")
    except Exception as e:
        conn.rollback()
        print(f"[Database] Error migrating dbo.lms_employee_profiles: {e}")
        raise


def _reorder_employee_profiles_certifications_sqlserver(conn, cursor):
    """
    Idempotently positions `certifications` directly between `area_of_expertise`
    and `learning_interests` in dbo.lms_employee_profiles without losing data or FKs.
    """
    try:
        cursor.execute("""
            SELECT COLUMN_NAME, ORDINAL_POSITION
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'lms_employee_profiles'
              AND COLUMN_NAME IN ('area_of_expertise', 'certifications', 'learning_interests')
        """)
        pos_map = {r[0]: int(r[1]) for r in cursor.fetchall()}
        pos_area = pos_map.get("area_of_expertise")
        pos_cert = pos_map.get("certifications")
        pos_interests = pos_map.get("learning_interests")
        if pos_area is None or pos_cert is None or pos_interests is None:
            return
        if pos_cert == pos_area + 1 and pos_interests == pos_cert + 1:
            return

        cursor.execute("""
            SELECT
                fk.name AS fk_name,
                OBJECT_SCHEMA_NAME(fk.parent_object_id) AS child_schema,
                OBJECT_NAME(fk.parent_object_id) AS child_table,
                c1.name AS child_col,
                c2.name AS ref_col,
                fk.delete_referential_action_desc,
                fk.update_referential_action_desc
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
            JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
            WHERE fk.referenced_object_id = OBJECT_ID('dbo.lms_employee_profiles')
        """)
        fk_rows = cursor.fetchall()

        for row in fk_rows:
            fk_name, child_schema, child_table = row[0], row[1], row[2]
            cursor.execute(f"ALTER TABLE [{child_schema}].[{child_table}] DROP CONSTRAINT [{fk_name}]")

        cursor.execute("""
            IF OBJECT_ID('dbo.lms_employee_profiles_reordered', 'U') IS NOT NULL
                DROP TABLE dbo.lms_employee_profiles_reordered;

            CREATE TABLE dbo.lms_employee_profiles_reordered (
                employee_id           VARCHAR(7)    NOT NULL,
                profile_photo_url     VARCHAR(500)  NULL,
                linkedin_url          VARCHAR(255)  NULL,
                professional_summary  VARCHAR(250)  NULL,
                technical_skills      NVARCHAR(MAX) NULL,
                workplace_skills      NVARCHAR(MAX) NULL,
                area_of_expertise     NVARCHAR(MAX) NULL,
                certifications        NVARCHAR(MAX) NULL,
                learning_interests    NVARCHAR(MAX) NULL,
                created_at            DATETIME      NOT NULL CONSTRAINT DF_lms_employee_profiles_created_at_new DEFAULT GETDATE(),
                created_by            VARCHAR(7)    NULL,
                updated_at            DATETIME      NULL,
                CONSTRAINT PK_lms_employee_profiles_new PRIMARY KEY (employee_id)
            );

            INSERT INTO dbo.lms_employee_profiles_reordered (
                employee_id, profile_photo_url, linkedin_url, professional_summary,
                technical_skills, workplace_skills, area_of_expertise,
                certifications, learning_interests, created_at, created_by, updated_at
            )
            SELECT
                employee_id, profile_photo_url, linkedin_url, professional_summary,
                technical_skills, workplace_skills, area_of_expertise,
                certifications, learning_interests, created_at, created_by, updated_at
            FROM dbo.lms_employee_profiles;

            DROP TABLE dbo.lms_employee_profiles;

            EXEC sp_rename 'dbo.lms_employee_profiles_reordered', 'lms_employee_profiles';
            EXEC sp_rename 'dbo.PK_lms_employee_profiles_new', 'PK_lms_employee_profiles', 'OBJECT';
            EXEC sp_rename 'dbo.DF_lms_employee_profiles_created_at_new', 'DF_lms_employee_profiles_created_at', 'OBJECT';

            IF CAST(LEFT(CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)), CHARINDEX('.', CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50))) - 1) AS INT) >= 13
            BEGIN
                EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_tech_json CHECK (technical_skills IS NULL OR ISJSON(technical_skills) = 1)');
                EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_work_json CHECK (workplace_skills IS NULL OR ISJSON(workplace_skills) = 1)');
                EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_area_json CHECK (area_of_expertise IS NULL OR ISJSON(area_of_expertise) = 1)');
                EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_certs_json CHECK (certifications IS NULL OR ISJSON(certifications) = 1)');
            END
        """)

        for row in fk_rows:
            fk_name, child_schema, child_table, child_col, ref_col, del_act, upd_act = row
            extra = ""
            if del_act and del_act != "NO_ACTION":
                extra += f" ON DELETE {del_act.replace('_', ' ')}"
            if upd_act and upd_act != "NO_ACTION":
                extra += f" ON UPDATE {upd_act.replace('_', ' ')}"
            cursor.execute(
                f"ALTER TABLE [{child_schema}].[{child_table}] ADD CONSTRAINT [{fk_name}] "
                f"FOREIGN KEY ([{child_col}]) REFERENCES dbo.lms_employee_profiles ([{ref_col}]){extra}"
            )

        conn.commit()
        print("[Database] Reordered dbo.lms_employee_profiles so certifications is between area_of_expertise and learning_interests.")
    except Exception as e:
        conn.rollback()
        print(f"[Database] Error reordering dbo.lms_employee_profiles columns: {e}")
        raise


def _ensure_idempotency_and_unique_constraints_sqlserver(conn, cursor):
    """
    Idempotently creates dbo.lms_idempotency_keys and natural-key unique
    constraints/filtered unique indexes across SQL Server tables to prevent
    duplicate record creation under concurrent or slow-server requests.
    """
    try:
        cursor.execute("""
            IF OBJECT_ID('dbo.lms_idempotency_keys', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.lms_idempotency_keys (
                    idempotency_key  VARCHAR(128)  NOT NULL,
                    method           VARCHAR(10)   NOT NULL,
                    path             VARCHAR(255)  NOT NULL,
                    actor_id         VARCHAR(50)   NULL,
                    request_hash     VARCHAR(64)   NOT NULL,
                    status           VARCHAR(20)   NOT NULL CONSTRAINT DF_lms_idempotency_status DEFAULT 'IN_PROGRESS',
                    response_status  INT           NULL,
                    response_body    NVARCHAR(MAX) NULL,
                    created_at       DATETIME2     NOT NULL CONSTRAINT DF_lms_idempotency_created DEFAULT GETDATE(),
                    expires_at       DATETIME2     NOT NULL,
                    CONSTRAINT PK_lms_idempotency_keys PRIMARY KEY (idempotency_key)
                );
                CREATE INDEX IX_lms_idempotency_keys_expires_at ON dbo.lms_idempotency_keys (expires_at);
            END
        """)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[Database] Notice creating dbo.lms_idempotency_keys: {e}")

    index_statements = [
        (
            "UX_lms_courses_name_provider",
            "dbo.lms_courses",
            """
            CREATE UNIQUE NONCLUSTERED INDEX UX_lms_courses_name_provider
                ON dbo.lms_courses (course_name, provider_id)
                WHERE hr_status <> 'Rejected'
            """
        ),
        (
            "UX_lms_study_materials_title_type",
            "dbo.lms_study_materials",
            """
            CREATE UNIQUE NONCLUSTERED INDEX UX_lms_study_materials_title_type
                ON dbo.lms_study_materials (title, material_type)
                WHERE material_type IS NOT NULL
            """
        ),
        (
            "UQ_lms_course_enrollments_emp_course",
            "dbo.lms_course_enrollments",
            """
            ALTER TABLE dbo.lms_course_enrollments
                ADD CONSTRAINT UQ_lms_course_enrollments_emp_course UNIQUE (employee_id, course_id)
            """
        ),
        (
            "UX_lms_enrollment_requests_active",
            "dbo.lms_enrollment_requests",
            """
            CREATE UNIQUE NONCLUSTERED INDEX UX_lms_enrollment_requests_active
                ON dbo.lms_enrollment_requests (employee_id, course_id)
                WHERE status IN ('Pending', 'Approved', 'On Hold')
            """
        ),
        (
            "UX_lms_workshops_training_event",
            "dbo.lms_workshops_training",
            """
            CREATE UNIQUE NONCLUSTERED INDEX UX_lms_workshops_training_event
                ON dbo.lms_workshops_training (event_name, start_date, department)
                WHERE department IS NOT NULL
            """
        ),
        (
            "UX_lms_workshops_training_event_nodept",
            "dbo.lms_workshops_training",
            """
            CREATE UNIQUE NONCLUSTERED INDEX UX_lms_workshops_training_event_nodept
                ON dbo.lms_workshops_training (event_name, start_date)
                WHERE department IS NULL
            """
        ),
        (
            "UX_lms_employee_certificates_emp_cert_date",
            "dbo.lms_employee_certificates",
            """
            CREATE UNIQUE NONCLUSTERED INDEX UX_lms_employee_certificates_emp_cert_date
                ON dbo.lms_employee_certificates (employee_id, certification_name, issue_date)
                WHERE issue_date IS NOT NULL
            """
        ),
    ]

    for idx_name, table_name, ddl in index_statements:
        try:
            cursor.execute(
                "SELECT 1 FROM sys.indexes WHERE name = ? AND object_id = OBJECT_ID(?)",
                (idx_name, table_name),
            )
            if not cursor.fetchone():
                cursor.execute(ddl)
                conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"[Database] Notice ensuring {idx_name} on {table_name}: {e}")

    # Ensure dbo.lms_certification_domains table, seeds, and FKs on dbo.lms_employee_certificates & dbo.lms_certification_requests
    try:
        cursor.execute("""
            IF OBJECT_ID('dbo.lms_certification_domains', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.lms_certification_domains (
                    domain_id   INT IDENTITY(1,1) NOT NULL,
                    domain_name VARCHAR(150)      NOT NULL CONSTRAINT UQ_lms_certification_domains_name UNIQUE,
                    is_active   BIT               NOT NULL CONSTRAINT DF_lms_certification_domains_active DEFAULT 1,
                    created_at  DATETIME          NOT NULL CONSTRAINT DF_lms_certification_domains_created_at DEFAULT GETDATE(),
                    created_by  VARCHAR(7)        NULL,
                    CONSTRAINT PK_lms_certification_domains PRIMARY KEY (domain_id)
                );
                CREATE NONCLUSTERED INDEX IX_lms_certification_domains_active ON dbo.lms_certification_domains(is_active, domain_name);
            END

            IF COL_LENGTH('dbo.lms_employee_certificates', 'domain_id') IS NULL
            BEGIN
                ALTER TABLE dbo.lms_employee_certificates ADD domain_id INT NULL;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_lms_employee_certificates_domain')
            BEGIN
                ALTER TABLE dbo.lms_employee_certificates ADD CONSTRAINT FK_lms_employee_certificates_domain
                    FOREIGN KEY (domain_id) REFERENCES dbo.lms_certification_domains(domain_id);
            END

            IF COL_LENGTH('dbo.lms_certification_requests', 'domain_id') IS NULL
            BEGIN
                ALTER TABLE dbo.lms_certification_requests ADD domain_id INT NULL;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_lms_certification_requests_domain')
            BEGIN
                ALTER TABLE dbo.lms_certification_requests ADD CONSTRAINT FK_lms_certification_requests_domain
                    FOREIGN KEY (domain_id) REFERENCES dbo.lms_certification_domains(domain_id);
            END
        """)
        conn.commit()

        for d in [
            'DevOps & Kubernetes',
            'AI & Machine Learning',
            'Cybersecurity',
            'Data Science & Analytics',
            'Cloud Computing'
        ]:
            cursor.execute("""
                IF NOT EXISTS (SELECT 1 FROM dbo.lms_certification_domains WHERE LOWER(LTRIM(RTRIM(domain_name))) = LOWER(?))
                    INSERT INTO dbo.lms_certification_domains (domain_name, is_active, created_at) VALUES (?, 1, GETDATE());
            """, (d, d))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[Database] Notice ensuring lms_certification_domains: {e}")


def init_db():
    """
    Initializes database tables and ensures seed data.
    - SQL Server: Only creates tables from database/lms_schema.sql if they do NOT exist.
                  Preserves existing data and avoids destructive drop/re-create.
    - SQLite: Clean offline development fallback creating all lms_ tables with SQLite-compatible syntax.
    """
    conn = connect_db()
    cursor = conn.cursor()
    try:
        if is_sql_server():
            # Check if core tables already exist
            cursor.execute("SELECT OBJECT_ID('dbo.lms_employee_profiles', 'U')")
            row = cursor.fetchone()
            schema_exists = bool(row and row[0] is not None)

            if not schema_exists:
                schema_path = os.path.join(os.path.dirname(__file__), "lms_schema.sql")
                if os.path.exists(schema_path):
                    with open(schema_path, "r", encoding="utf-8") as f:
                        content = f.read()

                    batches = re.split(r"^\s*GO\s*$", content, flags=re.MULTILINE | re.IGNORECASE)
                    for batch in batches:
                        cleaned = batch.strip()
                        if cleaned:
                            try:
                                cursor.execute(cleaned)
                            except Exception as e:
                                err_str = str(e).lower()
                                if not any(phrase in err_str for phrase in ["already exists", "already an object", "there is already"]):
                                    print(f"[Database] Notice executing schema batch: {e}")
                    conn.commit()
                    print("[Database] Schema initialized from lms_schema.sql successfully.")
            else:
                print("[Database] Existing database schema detected. Preserving tables.")

            # Ensure learning_interests & certifications columns exist in dbo.lms_employee_profiles
            try:
                cursor.execute("""
                    IF COL_LENGTH('dbo.lms_employee_profiles', 'learning_interests') IS NULL
                    BEGIN
                        ALTER TABLE dbo.lms_employee_profiles ADD learning_interests NVARCHAR(MAX) NULL;
                    END
                    IF COL_LENGTH('dbo.lms_employee_profiles', 'certifications') IS NULL
                    BEGIN
                        ALTER TABLE dbo.lms_employee_profiles ADD certifications NVARCHAR(MAX) NULL;
                    END
                """)
                conn.commit()
                _reorder_employee_profiles_certifications_sqlserver(conn, cursor)
                cursor.execute("""
                    IF CAST(LEFT(CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)), CHARINDEX('.', CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50))) - 1) AS INT) >= 13
                       AND OBJECT_ID('dbo.CK_lms_employee_profiles_certs_json', 'C') IS NULL
                    BEGIN
                        EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_certs_json CHECK (certifications IS NULL OR ISJSON(certifications) = 1)');
                    END
                """)
                conn.commit()
                _backfill_profile_certifications(conn, cursor, table_prefix="dbo.")
            except Exception as e:
                print(f"[Database] Notice ensuring learning_interests/certifications columns: {e}")

            # Ensure dbo.lms_learning_logs.learning_notes supports up to 250 characters
            try:
                cursor.execute("""
                    IF OBJECT_ID('dbo.lms_learning_logs', 'U') IS NOT NULL
                       AND EXISTS (
                           SELECT 1
                           FROM INFORMATION_SCHEMA.COLUMNS
                           WHERE TABLE_SCHEMA = 'dbo'
                             AND TABLE_NAME = 'lms_learning_logs'
                             AND COLUMN_NAME = 'learning_notes'
                             AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                             AND CHARACTER_MAXIMUM_LENGTH <> -1
                             AND CHARACTER_MAXIMUM_LENGTH < 250
                       )
                    BEGIN
                        ALTER TABLE dbo.lms_learning_logs ALTER COLUMN learning_notes VARCHAR(250) NULL;
                    END
                """)
                conn.commit()
            except Exception as e:
                print(f"[Database] Notice expanding lms_learning_logs.learning_notes: {e}")

            # Ensure dbo.lms_employee_profiles.professional_summary supports up to 250 characters
            try:
                cursor.execute("""
                    IF OBJECT_ID('dbo.lms_employee_profiles', 'U') IS NOT NULL
                       AND EXISTS (
                           SELECT 1
                           FROM INFORMATION_SCHEMA.COLUMNS
                           WHERE TABLE_SCHEMA = 'dbo'
                             AND TABLE_NAME = 'lms_employee_profiles'
                             AND COLUMN_NAME = 'professional_summary'
                             AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                             AND CHARACTER_MAXIMUM_LENGTH <> -1
                             AND CHARACTER_MAXIMUM_LENGTH < 250
                       )
                    BEGIN
                        ALTER TABLE dbo.lms_employee_profiles ALTER COLUMN professional_summary VARCHAR(250) NULL;
                    END
                """)
                conn.commit()
            except Exception as e:
                print(f"[Database] Notice expanding lms_employee_profiles.professional_summary: {e}")

            # Run idempotent data synchronization and seeding
            # Ensure dbo.lms_workshops_training exists in SQL Server
            try:
                cursor.execute("""
                    IF OBJECT_ID('dbo.lms_workshops_training', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.lms_workshops_training (
                            id                  INT IDENTITY(1,1) NOT NULL,
                            event_name          NVARCHAR(255) NOT NULL,
                            event_category      NVARCHAR(100) NOT NULL CONSTRAINT DF_lms_workshops_training_event_category DEFAULT 'Workshop',
                            department          NVARCHAR(150) NULL,
                            start_date          DATE NOT NULL,
                            end_date            DATE NULL,
                            participants_count  INT NOT NULL CONSTRAINT DF_lms_workshops_training_participants DEFAULT 0,
                            event_type          NVARCHAR(50) NOT NULL CONSTRAINT DF_lms_workshops_training_event_type DEFAULT 'Paid',
                            actual_spent        DECIMAL(18,2) NOT NULL CONSTRAINT DF_lms_workshops_training_spent DEFAULT 0.0,
                            created_at          DATETIME NOT NULL CONSTRAINT DF_lms_workshops_training_created_at DEFAULT GETDATE(),
                            created_by          NVARCHAR(100) NULL,
                            updated_at          DATETIME NULL,
                            updated_by          NVARCHAR(100) NULL,
                            CONSTRAINT PK_lms_workshops_training PRIMARY KEY (id)
                        );
                        CREATE INDEX IX_lms_workshops_training_start_date ON dbo.lms_workshops_training (start_date);
                        CREATE INDEX IX_lms_workshops_training_event_category ON dbo.lms_workshops_training (event_category);
                        CREATE INDEX IX_lms_workshops_training_event_type ON dbo.lms_workshops_training (event_type);
                        CREATE INDEX IX_lms_workshops_training_department ON dbo.lms_workshops_training (department);
                    END
                    ELSE
                    BEGIN
                        -- Drop unwanted college_name column if exists
                        IF COL_LENGTH('dbo.lms_workshops_training', 'college_name') IS NOT NULL
                        BEGIN
                            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lms_workshops_training_college' AND object_id = OBJECT_ID('dbo.lms_workshops_training'))
                            BEGIN
                                DROP INDEX IX_lms_workshops_training_college ON dbo.lms_workshops_training;
                            END
                            ALTER TABLE dbo.lms_workshops_training DROP COLUMN college_name;
                        END

                        -- Add event_category column if not exists
                        IF COL_LENGTH('dbo.lms_workshops_training', 'event_category') IS NULL
                        BEGIN
                            ALTER TABLE dbo.lms_workshops_training ADD event_category NVARCHAR(100) NULL;
                        END

                        -- Populate event_category from legacy event_type
                        EXEC('
                            UPDATE dbo.lms_workshops_training
                            SET event_category = CASE 
                                WHEN event_type IN (''Workshop'', ''Training'') THEN event_type
                                WHEN LOWER(event_name) LIKE ''%training%'' THEN ''Training''
                                ELSE ''Workshop''
                            END
                            WHERE event_category IS NULL;

                            UPDATE dbo.lms_workshops_training
                            SET event_type = CASE 
                                WHEN actual_spent > 0 THEN ''Paid''
                                ELSE ''Unpaid''
                            END
                            WHERE event_type IN (''Workshop'', ''Training'') OR event_type IS NULL;
                        ');

                        -- Normalize legacy academic departments to enterprise IT company departments
                        UPDATE dbo.lms_workshops_training
                        SET department = 'Software Development'
                        WHERE department IN ('Computer Science', 'CSE', 'Information Technology', 'Electronics & Communication');

                        UPDATE dbo.lms_workshops_training
                        SET department = 'Data Engineering'
                        WHERE department = 'AI & DS';

                        UPDATE dbo.lms_workshops_training
                        SET department = 'Cybersecurity'
                        WHERE department = 'Cybersecurity & IT';
                    END
                """)
                conn.commit()
            except Exception as e:
                print(f"[Database] Notice ensuring lms_workshops_training table: {e}")

            # Ensure request_code exists in dbo.lms_reimbursement_claim_stages
            try:
                cursor.execute("""
                    IF OBJECT_ID('dbo.lms_reimbursement_claim_stages', 'U') IS NOT NULL
                       AND COL_LENGTH('dbo.lms_reimbursement_claim_stages', 'request_code') IS NULL
                    BEGIN
                        ALTER TABLE dbo.lms_reimbursement_claim_stages ADD request_code VARCHAR(20) NULL;
                        EXEC('UPDATE s SET s.request_code = c.claim_code FROM dbo.lms_reimbursement_claim_stages s INNER JOIN dbo.lms_reimbursement_claims c ON s.claim_id = c.id WHERE s.request_code IS NULL');
                    END
                """)
                conn.commit()
            except Exception as e:
                print(f"[Database] Notice ensuring reimbursement claim stages request_code: {e}")

            # Ensure dbo.CourseProviders and dbo.CourseCategories exist in SQL Server (without UpdatedAt)
            try:
                cursor.execute("""
                    IF OBJECT_ID('dbo.CourseProviders', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.CourseProviders (
                            ProviderId   INT IDENTITY(1,1) NOT NULL,
                            ProviderName NVARCHAR(150) NOT NULL,
                            IsActive     BIT NOT NULL CONSTRAINT DF_CourseProviders_IsActive DEFAULT 1,
                            CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_CourseProviders_CreatedAt DEFAULT GETDATE(),
                            CONSTRAINT PK_CourseProviders PRIMARY KEY (ProviderId),
                            CONSTRAINT UQ_CourseProviders_ProviderName UNIQUE (ProviderName)
                        );
                        CREATE INDEX IX_CourseProviders_IsActive ON dbo.CourseProviders (IsActive);
                    END
                    ELSE
                    BEGIN
                        IF COL_LENGTH('dbo.CourseProviders', 'UpdatedAt') IS NOT NULL
                            ALTER TABLE dbo.CourseProviders DROP COLUMN UpdatedAt;
                    END

                    IF OBJECT_ID('dbo.CourseCategories', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.CourseCategories (
                            CategoryId   INT IDENTITY(1,1) NOT NULL,
                            CategoryName NVARCHAR(150) NOT NULL,
                            IsActive     BIT NOT NULL CONSTRAINT DF_CourseCategories_IsActive DEFAULT 1,
                            CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_CourseCategories_CreatedAt DEFAULT GETDATE(),
                            CONSTRAINT PK_CourseCategories PRIMARY KEY (CategoryId),
                            CONSTRAINT UQ_CourseCategories_CategoryName UNIQUE (CategoryName)
                        );
                        CREATE INDEX IX_CourseCategories_IsActive ON dbo.CourseCategories (IsActive);
                    END
                    ELSE
                    BEGIN
                        IF COL_LENGTH('dbo.CourseCategories', 'UpdatedAt') IS NOT NULL
                            ALTER TABLE dbo.CourseCategories DROP COLUMN UpdatedAt;
                    END

                    IF OBJECT_ID('dbo.CourseEmails', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.CourseEmails (
                            CourseEmailId INT IDENTITY(1,1) NOT NULL,
                            CourseEmail   NVARCHAR(255)     NOT NULL,
                            IsActive      BIT               NOT NULL CONSTRAINT DF_CourseEmails_IsActive DEFAULT 1,
                            CreatedAt     DATETIME2         NOT NULL CONSTRAINT DF_CourseEmails_CreatedAt DEFAULT GETDATE(),
                            CONSTRAINT PK_CourseEmails PRIMARY KEY (CourseEmailId),
                            CONSTRAINT UQ_CourseEmails_CourseEmail UNIQUE (CourseEmail)
                        );
                        CREATE INDEX IX_CourseEmails_IsActive ON dbo.CourseEmails (IsActive);
                    END
                """)
                conn.commit()
            except Exception as e:
                print(f"[Database] Notice ensuring CourseProviders/CourseCategories/CourseEmails tables: {e}")

            # Ensure dbo.lms_payment_records and payment_status on dbo.lms_courses exist
            try:
                cursor.execute("""
                    IF OBJECT_ID('dbo.lms_payment_records', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.lms_payment_records (
                            id                  INT IDENTITY(1,1) NOT NULL,
                            payment_code        VARCHAR(30)   NOT NULL,
                            request_code        VARCHAR(50)   NOT NULL,
                            claim_type          VARCHAR(20)   NOT NULL,
                            employee_id         VARCHAR(7)    NOT NULL,
                            title               VARCHAR(200)  NOT NULL,
                            amount              INT           NOT NULL,
                            payment_slip_path   VARCHAR(500)  NULL,
                            payment_slip_name   VARCHAR(255)  NULL,
                            payment_description VARCHAR(500)  NULL,
                            paid_by             VARCHAR(7)    NOT NULL,
                            created_at          DATETIME2     NOT NULL CONSTRAINT DF_lms_payment_records_created_at DEFAULT GETDATE(),
                            CONSTRAINT PK_lms_payment_records PRIMARY KEY (id),
                            CONSTRAINT UQ_lms_payment_records_code UNIQUE (payment_code),
                            CONSTRAINT CK_lms_payment_records_type CHECK (claim_type IN ('Course', 'Certification'))
                        );
                        CREATE INDEX ix_payment_records_request_code ON dbo.lms_payment_records (request_code);
                        CREATE INDEX ix_payment_records_employee_id ON dbo.lms_payment_records (employee_id);
                    END
                    ELSE
                    BEGIN
                        -- Clean up obsolete index, default constraint, and columns if present
                        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_payment_records_paid_on' AND object_id = OBJECT_ID('dbo.lms_payment_records'))
                            DROP INDEX ix_payment_records_paid_on ON dbo.lms_payment_records;

                        DECLARE @PaidOnConstraint NVARCHAR(200);
                        SELECT @PaidOnConstraint = d.name
                        FROM sys.default_constraints d
                        JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
                        WHERE d.parent_object_id = OBJECT_ID('dbo.lms_payment_records') AND c.name = 'paid_on';

                        IF @PaidOnConstraint IS NOT NULL
                            EXEC('ALTER TABLE dbo.lms_payment_records DROP CONSTRAINT ' + @PaidOnConstraint);

                        IF COL_LENGTH('dbo.lms_payment_records', 'paid_on') IS NOT NULL
                            ALTER TABLE dbo.lms_payment_records DROP COLUMN paid_on;

                        IF COL_LENGTH('dbo.lms_payment_records', 'reference_id') IS NOT NULL
                            ALTER TABLE dbo.lms_payment_records DROP COLUMN reference_id;

                        IF COL_LENGTH('dbo.lms_payment_records', 'employee_name') IS NOT NULL
                            ALTER TABLE dbo.lms_payment_records DROP COLUMN employee_name;

                        -- Ensure payment slip fields allow NULL
                        ALTER TABLE dbo.lms_payment_records ALTER COLUMN payment_slip_path VARCHAR(500) NULL;
                        ALTER TABLE dbo.lms_payment_records ALTER COLUMN payment_slip_name VARCHAR(255) NULL;
                    END

                    IF OBJECT_ID('dbo.lms_courses', 'U') IS NOT NULL
                       AND COL_LENGTH('dbo.lms_courses', 'payment_status') IS NULL
                    BEGIN
                        ALTER TABLE dbo.lms_courses ADD payment_status VARCHAR(20) NOT NULL CONSTRAINT DF_lms_courses_payment_status DEFAULT 'Pending Payment';
                    END

                    IF OBJECT_ID('dbo.lms_employee_logs', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.lms_employee_logs (
                            id                INT IDENTITY(1,1) NOT NULL,
                            employee_id       VARCHAR(7)        NOT NULL,
                            last_logged_in    DATETIME          NOT NULL CONSTRAINT DF_lms_employee_logs_login DEFAULT GETDATE(),
                            last_logged_out   DATETIME          NULL,
                            created_at        DATETIME          NOT NULL CONSTRAINT DF_lms_employee_logs_created DEFAULT GETDATE(),
                            updated_at        DATETIME          NULL,
                            CONSTRAINT PK_lms_employee_logs PRIMARY KEY (id),
                            CONSTRAINT FK_lms_employee_logs_employee FOREIGN KEY (employee_id) 
                                REFERENCES dbo.lms_employee_profiles (employee_id) ON DELETE CASCADE
                        );
                        CREATE NONCLUSTERED INDEX IX_lms_employee_logs_emp_date 
                            ON dbo.lms_employee_logs (employee_id, last_logged_in DESC);
                    END

                    IF OBJECT_ID('dbo.CK_lms_reimbursement_claims_type', 'C') IS NOT NULL
                    BEGIN
                        ALTER TABLE dbo.lms_reimbursement_claims DROP CONSTRAINT CK_lms_reimbursement_claims_type;
                    END

                    IF COL_LENGTH('dbo.lms_reimbursement_claims', 'payment_slip_path') IS NOT NULL
                        ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN payment_slip_path;

                    IF COL_LENGTH('dbo.lms_reimbursement_claims', 'payment_description') IS NOT NULL
                        ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN payment_description;

                    IF COL_LENGTH('dbo.lms_reimbursement_claims', 'paid_on') IS NOT NULL
                        ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN paid_on;

                    IF COL_LENGTH('dbo.lms_reimbursement_claims', 'paid_by') IS NOT NULL
                        ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN paid_by;

                    IF COL_LENGTH('dbo.lms_reimbursement_claims', 'claim_type') IS NOT NULL
                        ALTER TABLE dbo.lms_reimbursement_claims DROP COLUMN claim_type;

                    IF OBJECT_ID('dbo.CK_lms_reimbursement_claims_proc', 'C') IS NOT NULL
                    BEGIN
                        ALTER TABLE dbo.lms_reimbursement_claims DROP CONSTRAINT CK_lms_reimbursement_claims_proc;
                        ALTER TABLE dbo.lms_reimbursement_claims ADD CONSTRAINT CK_lms_reimbursement_claims_proc CHECK (processing_status IS NULL OR processing_status IN ('In Progress', 'Submitted to HR', 'Approved', 'Paid'));
                    END

                    -- 19. Ensure dbo.lms_recommend_new_course has provider_id, category_id FKs
                    IF OBJECT_ID('dbo.lms_recommend_new_course', 'U') IS NOT NULL
                    BEGIN
                        IF COL_LENGTH('dbo.lms_recommend_new_course', 'provider_id') IS NULL
                            ALTER TABLE dbo.lms_recommend_new_course ADD provider_id INT NULL;

                        IF COL_LENGTH('dbo.lms_recommend_new_course', 'category_id') IS NULL
                            ALTER TABLE dbo.lms_recommend_new_course ADD category_id INT NULL;

                        IF OBJECT_ID('dbo.FK_lms_recommend_new_course_provider', 'F') IS NULL
                            ALTER TABLE dbo.lms_recommend_new_course ADD CONSTRAINT FK_lms_recommend_new_course_provider 
                                FOREIGN KEY (provider_id) REFERENCES dbo.CourseProviders (ProviderId);

                        IF OBJECT_ID('dbo.FK_lms_recommend_new_course_category', 'F') IS NULL
                            ALTER TABLE dbo.lms_recommend_new_course ADD CONSTRAINT FK_lms_recommend_new_course_category 
                                FOREIGN KEY (category_id) REFERENCES dbo.CourseCategories (CategoryId);

                        IF COL_LENGTH('dbo.lms_recommend_new_course', 'provider') IS NOT NULL
                            ALTER TABLE dbo.lms_recommend_new_course DROP COLUMN provider;

                        IF COL_LENGTH('dbo.lms_recommend_new_course', 'category') IS NOT NULL
                            ALTER TABLE dbo.lms_recommend_new_course DROP COLUMN category;
                    END

                    -- 1. Ensure profile_photo_url is removed from dbo.lms_employee_profiles
                    IF OBJECT_ID('dbo.lms_employee_profiles', 'U') IS NOT NULL
                    BEGIN
                        IF COL_LENGTH('dbo.lms_employee_profiles', 'profile_photo_url') IS NOT NULL
                            ALTER TABLE dbo.lms_employee_profiles DROP COLUMN profile_photo_url;
                    END

                    -- 27. EmailProviders (Corporate Email + Provider Junction Entity for Model B)
                    IF OBJECT_ID('dbo.EmailProviders', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.EmailProviders (
                            EmailProviderId INT IDENTITY(1,1) NOT NULL,
                            CourseEmailId   INT               NOT NULL,
                            ProviderId      INT               NOT NULL,
                            MaxSlots        INT               NOT NULL CONSTRAINT DF_EmailProviders_MaxSlots DEFAULT 4,
                            IsActive        BIT               NOT NULL CONSTRAINT DF_EmailProviders_IsActive DEFAULT 1,
                            CreatedAt       DATETIME          NOT NULL CONSTRAINT DF_EmailProviders_CreatedAt DEFAULT GETDATE(),
                            CONSTRAINT PK_EmailProviders PRIMARY KEY (EmailProviderId),
                            CONSTRAINT FK_EmailProviders_Email FOREIGN KEY (CourseEmailId) 
                                REFERENCES dbo.CourseEmails(CourseEmailId) ON DELETE CASCADE,
                            CONSTRAINT FK_EmailProviders_Provider FOREIGN KEY (ProviderId) 
                                REFERENCES dbo.CourseProviders(ProviderId) ON DELETE CASCADE,
                            CONSTRAINT UQ_EmailProviders_Email_Provider UNIQUE (CourseEmailId, ProviderId)
                        );
                        CREATE NONCLUSTERED INDEX IX_EmailProviders_Lookup 
                            ON dbo.EmailProviders(CourseEmailId, ProviderId);
                    END

                    -- 28. lms_active_slots (4 Concurrency Slots per EmailProviderId)
                    IF OBJECT_ID('dbo.lms_active_slots', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.lms_active_slots (
                            slot_id                  INT IDENTITY(1,1) NOT NULL,
                            EmailProviderId          INT               NOT NULL,
                            slot_number              INT               NOT NULL CHECK (slot_number BETWEEN 1 AND 4),
                            enrollment_id            INT               NULL,
                            status                   VARCHAR(20)       NOT NULL CONSTRAINT DF_lms_active_slots_status DEFAULT 'Available' 
                                CHECK (status IN ('Available', 'Occupied', 'Locked')),
                            occupied_slots           INT               NOT NULL CONSTRAINT DF_lms_active_slots_occupied DEFAULT 0,
                            available_slots          INT               NOT NULL CONSTRAINT DF_lms_active_slots_available DEFAULT 4,
                            enrollment_employee_ids  VARCHAR(255)      NULL CONSTRAINT DF_lms_active_slots_emp_ids DEFAULT 'None',
                            CONSTRAINT PK_lms_active_slots PRIMARY KEY (slot_id),
                            CONSTRAINT FK_Slots_EmailProvider FOREIGN KEY (EmailProviderId) 
                                REFERENCES dbo.EmailProviders(EmailProviderId) ON DELETE CASCADE,
                            CONSTRAINT FK_Slots_Enrollment FOREIGN KEY (enrollment_id) 
                                REFERENCES dbo.lms_course_enrollments(id) ON DELETE SET NULL,
                            CONSTRAINT UQ_EmailProvider_Slot UNIQUE (EmailProviderId, slot_number)
                        );
                        CREATE NONCLUSTERED INDEX IX_Slots_Availability 
                            ON dbo.lms_active_slots(EmailProviderId, status);
                    END

                    -- 29. Link dbo.lms_courses to EmailProviders
                    IF OBJECT_ID('dbo.lms_courses', 'U') IS NOT NULL
                       AND COL_LENGTH('dbo.lms_courses', 'EmailProviderId') IS NULL
                    BEGIN
                        ALTER TABLE dbo.lms_courses ADD EmailProviderId INT NULL;
                        ALTER TABLE dbo.lms_courses ADD CONSTRAINT FK_lms_courses_EmailProvider 
                            FOREIGN KEY (EmailProviderId) REFERENCES dbo.EmailProviders(EmailProviderId);
                    END

                    -- 31. lms_email_logs (Microsoft Graph Email Notification Audit)
                    IF OBJECT_ID('dbo.lms_email_logs', 'U') IS NULL
                    BEGIN
                        CREATE TABLE dbo.lms_email_logs (
                            id               BIGINT IDENTITY(1,1) NOT NULL,
                            recipient_email  VARCHAR(255)         NOT NULL,
                            recipient_name   VARCHAR(100)         NULL,
                            recipient_role   VARCHAR(50)          NULL,
                            subject          VARCHAR(255)         NOT NULL,
                            event_type       VARCHAR(60)          NOT NULL,
                            status           VARCHAR(20)          NOT NULL CONSTRAINT DF_lms_email_logs_status DEFAULT 'PENDING',
                            sent_at          DATETIME             NOT NULL CONSTRAINT DF_lms_email_logs_sent_at DEFAULT GETDATE(),
                            error_message    VARCHAR(MAX)         NULL,
                            reference_id     VARCHAR(50)          NULL,
                            reference_type   VARCHAR(50)          NULL,
                            CONSTRAINT PK_lms_email_logs PRIMARY KEY (id)
                        );
                        CREATE NONCLUSTERED INDEX IX_lms_email_logs_recipient ON dbo.lms_email_logs (recipient_email);
                        CREATE NONCLUSTERED INDEX IX_lms_email_logs_event     ON dbo.lms_email_logs (event_type);
                        CREATE NONCLUSTERED INDEX IX_lms_email_logs_status    ON dbo.lms_email_logs (status);
                    END

                    -- 30. Active Slots Tracking Views (Real-Time summary of available slots & active employee IDs)
                    IF OBJECT_ID('dbo.vw_active_slots_summary', 'V') IS NULL
                    BEGIN
                        EXEC('
                        CREATE VIEW dbo.vw_active_slots_summary AS
                        SELECT 
                            ep.EmailProviderId,
                            ep.IsActive,
                            ce.CourseEmailId,
                            ce.CourseEmail,
                            cp.ProviderId,
                            cp.ProviderName,
                            ep.MaxSlots,
                            SUM(CASE WHEN s.status = ''Occupied'' THEN 1 ELSE 0 END) AS occupied_slots,
                            SUM(CASE WHEN s.status = ''Available'' THEN 1 ELSE 0 END) AS available_slots,
                            COALESCE(
                                STUFF((
                                    SELECT '', '' + e.employee_id
                                    FROM dbo.lms_active_slots s2
                                    JOIN dbo.lms_course_enrollments e ON e.id = s2.enrollment_id
                                    WHERE s2.EmailProviderId = ep.EmailProviderId AND s2.status = ''Occupied''
                                    ORDER BY s2.slot_number ASC
                                    FOR XML PATH(''''), TYPE
                                ).value(''.'', ''NVARCHAR(MAX)''), 1, 2, ''''),
                                ''None''
                            ) AS enrollment_employee_ids
                        FROM dbo.EmailProviders ep
                        JOIN dbo.CourseEmails ce ON ce.CourseEmailId = ep.CourseEmailId
                        JOIN dbo.CourseProviders cp ON cp.ProviderId = ep.ProviderId
                        LEFT JOIN dbo.lms_active_slots s ON s.EmailProviderId = ep.EmailProviderId
                        GROUP BY ep.EmailProviderId, ep.IsActive, ce.CourseEmailId, ce.CourseEmail, cp.ProviderId, cp.ProviderName, ep.MaxSlots;
                        ');
                    END

                    IF OBJECT_ID('dbo.vw_lms_active_slots', 'V') IS NULL
                    BEGIN
                        EXEC('
                        CREATE VIEW dbo.vw_lms_active_slots AS
                        SELECT 
                            s.slot_id,
                            s.EmailProviderId,
                            ce.CourseEmail,
                            cp.ProviderName,
                            s.slot_number,
                            s.enrollment_id,
                            s.status,
                            e.employee_id AS current_slot_employee,
                            c.course_name,
                            e.progress_percentage,
                            s.occupied_slots,
                            s.available_slots,
                            s.enrollment_employee_ids
                        FROM dbo.lms_active_slots s
                        JOIN dbo.EmailProviders ep ON ep.EmailProviderId = s.EmailProviderId
                        JOIN dbo.CourseEmails ce ON ce.CourseEmailId = ep.CourseEmailId
                        JOIN dbo.CourseProviders cp ON cp.ProviderId = ep.ProviderId
                        LEFT JOIN dbo.lms_course_enrollments e ON e.id = s.enrollment_id
                        LEFT JOIN dbo.lms_courses c ON c.id = e.course_id;
                        ');
                    END
                """)
                conn.commit()
            except Exception as e:
                print(f"[Database] Notice ensuring lms_payment_records / payment_status: {e}")

            # Migrate legacy id and azure_user_id columns off dbo.lms_employee_profiles
            _migrate_employee_profiles_sqlserver(conn, cursor)

            # Ensure global idempotency store and natural-key unique constraints/indexes exist
            _ensure_idempotency_and_unique_constraints_sqlserver(conn, cursor)

            # Run idempotent data synchronization and seeding
            _seed_initial_data(conn, cursor)

            # Sync active course enrollments to Model B concurrency slots
            _sync_active_slots_sqlserver(conn, cursor)
        else:
            # SQLite fallback for offline local development
            _migrate_sqlite_schema(conn, cursor)
            sqlite_schema_ddl = """
                -- 1. lms_employee_profiles
                CREATE TABLE IF NOT EXISTS lms_employee_profiles (
                    employee_id           TEXT PRIMARY KEY,
                    linkedin_url          TEXT,
                    professional_summary  TEXT,
                    technical_skills      TEXT,
                    workplace_skills      TEXT,
                    area_of_expertise     TEXT,
                    certifications        TEXT,
                    learning_interests    TEXT,
                    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by            TEXT,
                    updated_at            DATETIME
                );

                -- 2. lms_courses
                CREATE TABLE IF NOT EXISTS lms_courses (
                    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                    course_name           TEXT NOT NULL,
                    course_url            TEXT,
                    provider_id           INTEGER,
                    category_id           INTEGER,
                    duration_minutes      INTEGER,
                    price                 INTEGER,
                    description           TEXT,
                    course_email_id       INTEGER,
                    support_document      TEXT,
                    request_id            INTEGER,
                    claim_id              TEXT,
                    hr_id                 INTEGER,
                    payment_status        TEXT DEFAULT 'Pending Payment' NOT NULL,
                    hr_status             TEXT DEFAULT 'Pending' NOT NULL,
                    hr_reviewed_at        DATETIME,
                    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by            TEXT,
                    updated_at            DATETIME,
                    updated_by            TEXT,
                    EmailProviderId       INTEGER,
                    FOREIGN KEY (provider_id) REFERENCES CourseProviders (ProviderId),
                    FOREIGN KEY (category_id) REFERENCES CourseCategories (CategoryId),
                    FOREIGN KEY (course_email_id) REFERENCES CourseEmails (CourseEmailId),
                    FOREIGN KEY (EmailProviderId) REFERENCES EmailProviders (EmailProviderId)
                );

                -- 3. lms_study_materials
                CREATE TABLE IF NOT EXISTS lms_study_materials (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    title          TEXT NOT NULL,
                    description    TEXT,
                    material_type  TEXT,
                    file_path      TEXT,
                    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by     TEXT
                );

                -- 17. lms_assign_course
                CREATE TABLE IF NOT EXISTS lms_assign_course (
                    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                    ld_id                   TEXT NOT NULL,
                    course_id               INTEGER NOT NULL,
                    selected_employees      TEXT,
                    learning_start_date     DATE,
                    target_completion_date  DATE,
                    assignment_note         TEXT,
                    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by              TEXT,
                    FOREIGN KEY (ld_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (course_id) REFERENCES lms_courses (id)
                );

                -- 4. lms_course_enrollments
                CREATE TABLE IF NOT EXISTS lms_course_enrollments (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    enrollment_code      TEXT NOT NULL UNIQUE,
                    employee_id          TEXT NOT NULL,
                    course_id            INTEGER NOT NULL,
                    status               TEXT DEFAULT 'Assigned' NOT NULL,
                    video_status         TEXT,
                    hours_log            INTEGER,
                    last_accessed        DATE,
                    progress_percentage  REAL DEFAULT 0 NOT NULL,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by           TEXT,
                    updated_at           DATETIME,
                    updated_by           TEXT,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (course_id) REFERENCES lms_courses (id)
                );

                -- 5. lms_course_requests
                CREATE TABLE IF NOT EXISTS lms_course_requests (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_code      TEXT NOT NULL UNIQUE,
                    employee_id       TEXT NOT NULL,
                    course_name       TEXT NOT NULL,
                    provider_id       INTEGER,
                    category_id       INTEGER,
                    course_link       TEXT,
                    reason            TEXT,
                    is_ceo_bypassed   INTEGER NOT NULL DEFAULT 0,
                    reopen_reason     TEXT,
                    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by        TEXT,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (provider_id) REFERENCES CourseProviders (ProviderId),
                    FOREIGN KEY (category_id) REFERENCES CourseCategories (CategoryId)
                );

                -- 6. lms_course_request_stages
                CREATE TABLE IF NOT EXISTS lms_course_request_stages (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_code  TEXT NOT NULL,
                    stage_name    TEXT NOT NULL,
                    stage_status  TEXT NOT NULL,
                    stage_date    DATE,
                    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by    TEXT,
                    updated_at    DATETIME,
                    updated_by    TEXT,
                    FOREIGN KEY (request_code) REFERENCES lms_course_requests (request_code) ON DELETE CASCADE
                );

                -- 7. lms_learning_logs
                CREATE TABLE IF NOT EXISTS lms_learning_logs (
                    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id                TEXT NOT NULL,
                    course_id                  INTEGER,
                    video_duration_minutes     INTEGER,
                    practice_duration_minutes  INTEGER,
                    learning_notes             TEXT,
                    points                     INTEGER DEFAULT 0,
                    created_at                 DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by                 TEXT,
                    updated_at                 DATETIME,
                    updated_by                 TEXT,
                    log_date                   DATE,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (course_id) REFERENCES lms_courses (id)
                );

                -- 8. lms_leaderboard_snapshots
                CREATE TABLE IF NOT EXISTS lms_leaderboard_snapshots (
                    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id             TEXT NOT NULL UNIQUE,
                    total_learning_minutes  INTEGER,
                    total_points            INTEGER,
                    rank_position           INTEGER,
                    percentile              REAL,
                    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id)
                );

                -- 8a. lms_certification_domains
                CREATE TABLE IF NOT EXISTS lms_certification_domains (
                    domain_id   INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain_name TEXT NOT NULL UNIQUE,
                    is_active   INTEGER NOT NULL DEFAULT 1,
                    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by  TEXT
                );

                -- 9. lms_employee_certificates
                CREATE TABLE IF NOT EXISTS lms_employee_certificates (
                    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id               TEXT NOT NULL,
                    certification_name        TEXT NOT NULL,
                    certificate_type          TEXT,
                    certificate_id            TEXT,
                    provider_id               INTEGER,
                    category_id               INTEGER,
                    domain_id                 INTEGER,
                    issue_date                DATE,
                    expiry_date               DATE,
                    certificate_file_path     TEXT,
                    supporting_document_path  TEXT,
                    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by                TEXT,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (provider_id) REFERENCES CourseProviders (ProviderId),
                    FOREIGN KEY (category_id) REFERENCES CourseCategories (CategoryId),
                    FOREIGN KEY (domain_id) REFERENCES lms_certification_domains (domain_id)
                );

                -- 10. lms_certification_requests
                CREATE TABLE IF NOT EXISTS lms_certification_requests (
                    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_code              TEXT NOT NULL UNIQUE,
                    employee_id               TEXT NOT NULL,
                    certification_name        TEXT NOT NULL,
                    provider_id               INTEGER,
                    category_id               INTEGER,
                    domain_id                 INTEGER,
                    exam_date                 DATE,
                    estimated_cost            INTEGER,
                    purpose                   TEXT,
                    supporting_document_path  TEXT,
                    status                    TEXT DEFAULT 'Pending' NOT NULL,
                    is_ceo_bypassed           INTEGER NOT NULL DEFAULT 0,
                    reopen_reason             TEXT,
                    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (provider_id) REFERENCES CourseProviders (ProviderId),
                    FOREIGN KEY (category_id) REFERENCES CourseCategories (CategoryId),
                    FOREIGN KEY (domain_id) REFERENCES lms_certification_domains (domain_id)
                );

                -- 10a. lms_certification_request_stages
                CREATE TABLE IF NOT EXISTS lms_certification_request_stages (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id    INTEGER NOT NULL,
                    stage_name    TEXT NOT NULL,
                    stage_status  TEXT NOT NULL,
                    stage_date    DATE,
                    updated_at    DATETIME,
                    updated_by    TEXT,
                    FOREIGN KEY (request_id) REFERENCES lms_certification_requests (id) ON DELETE CASCADE
                );

                -- 11. lms_reimbursement_claims
                CREATE TABLE IF NOT EXISTS lms_reimbursement_claims (
                    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
                    claim_code                TEXT NOT NULL UNIQUE,
                    employee_id               TEXT NOT NULL,
                    certification_name        TEXT,
                    provider_id               INTEGER,
                    category_id               INTEGER,
                    amount                    INTEGER NOT NULL,
                    purchase_date             DATE,
                    completion_exam_date      DATE,
                    validity_from             DATE,
                    validity_to               DATE,
                    supporting_document_path  TEXT,
                    status                    TEXT DEFAULT 'Pending' NOT NULL,
                    processing_status         TEXT,
                    submitted_on              DATE,
                    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (provider_id) REFERENCES CourseProviders (ProviderId),
                    FOREIGN KEY (category_id) REFERENCES CourseCategories (CategoryId)
                );

                -- 12. lms_reimbursement_claim_stages
                CREATE TABLE IF NOT EXISTS lms_reimbursement_claim_stages (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_code  TEXT NOT NULL,
                    stage_name    TEXT NOT NULL,
                    stage_status  TEXT NOT NULL,
                    stage_date    DATE,
                    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by    TEXT,
                    updated_at    DATETIME,
                    updated_by    TEXT,
                    FOREIGN KEY (request_code) REFERENCES lms_reimbursement_claims (claim_code) ON DELETE CASCADE
                );

                -- 13. lms_notifications
                CREATE TABLE IF NOT EXISTS lms_notifications (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id  TEXT NOT NULL,
                    message      TEXT NOT NULL,
                    is_read      INTEGER DEFAULT 0 NOT NULL,
                    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by   TEXT,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id)
                );

                -- 14. lms_enrollment_requests
                CREATE TABLE IF NOT EXISTS lms_enrollment_requests (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_code  TEXT NOT NULL UNIQUE,
                    employee_id   TEXT NOT NULL,
                    course_id     INTEGER NOT NULL,
                    status        TEXT DEFAULT 'Pending' NOT NULL,
                    onhold_reason TEXT,
                    on_hold_date  DATE,
                    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by    TEXT,
                    updated_at    DATETIME,
                    updated_by    TEXT,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (course_id) REFERENCES lms_courses (id)
                );

                -- 15. lms_department_budgets
                CREATE TABLE IF NOT EXISTS lms_department_budgets (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    department     TEXT NOT NULL,
                    budget_year    INTEGER NOT NULL,
                    budget_amount  REAL NOT NULL,
                    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by     TEXT,
                    UNIQUE (department, budget_year)
                );

                -- 16. lms_spend_category
                CREATE TABLE IF NOT EXISTS lms_spend_category (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    spend_category  TEXT NOT NULL,
                    department      TEXT NOT NULL,
                    amount          REAL NOT NULL,
                    spend_date      DATE NOT NULL,
                    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by      TEXT
                );

                -- 18. lms_course_recommend
                CREATE TABLE IF NOT EXISTS lms_course_recommend (
                    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id        TEXT NOT NULL,
                    course_id          INTEGER,
                    study_material_id  INTEGER,
                    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by         TEXT,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (course_id) REFERENCES lms_courses (id),
                    FOREIGN KEY (study_material_id) REFERENCES lms_study_materials (id)
                );

                -- 19. lms_recommend_new_course
                CREATE TABLE IF NOT EXISTS lms_recommend_new_course (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    rm_id        TEXT NOT NULL,
                    employee_id  TEXT NOT NULL,
                    course_name  TEXT NOT NULL,
                    provider_id  INTEGER,
                    category_id  INTEGER,
                    course_link  TEXT,
                    reason       TEXT,
                    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by   TEXT,
                    FOREIGN KEY (rm_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id),
                    FOREIGN KEY (provider_id) REFERENCES CourseProviders (ProviderId),
                    FOREIGN KEY (category_id) REFERENCES CourseCategories (CategoryId)
                );

                -- 20. lms_hr_activity_feed
                CREATE TABLE IF NOT EXISTS lms_hr_activity_feed (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    activity_type  TEXT NOT NULL,
                    message        TEXT NOT NULL,
                    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by     TEXT
                );

                -- 31. lms_email_logs
                CREATE TABLE IF NOT EXISTS lms_email_logs (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    recipient_email  TEXT NOT NULL,
                    recipient_name   TEXT,
                    recipient_role   TEXT,
                    subject          TEXT NOT NULL,
                    event_type       TEXT NOT NULL,
                    status           TEXT DEFAULT 'PENDING' NOT NULL,
                    sent_at          DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    error_message    TEXT,
                    reference_id     TEXT,
                    reference_type   TEXT
                );

                -- 21. lms_workshops_training
                CREATE TABLE IF NOT EXISTS lms_workshops_training (
                    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_name          TEXT NOT NULL,
                    event_category      TEXT NOT NULL DEFAULT 'Workshop',
                    department          TEXT,
                    start_date          DATE NOT NULL,
                    end_date            DATE,
                    participants_count  INTEGER NOT NULL DEFAULT 0,
                    event_type          TEXT NOT NULL DEFAULT 'Paid',
                    actual_spent        REAL NOT NULL DEFAULT 0.0,
                    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by          TEXT,
                    updated_at          DATETIME,
                    updated_by          TEXT
                );

                -- 22. CourseProviders
                CREATE TABLE IF NOT EXISTS CourseProviders (
                    ProviderId    INTEGER PRIMARY KEY AUTOINCREMENT,
                    ProviderName  TEXT NOT NULL UNIQUE,
                    IsActive      INTEGER NOT NULL DEFAULT 1,
                    CreatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
                );

                -- 23. CourseCategories
                CREATE TABLE IF NOT EXISTS CourseCategories (
                    CategoryId    INTEGER PRIMARY KEY AUTOINCREMENT,
                    CategoryName  TEXT NOT NULL UNIQUE,
                    IsActive      INTEGER NOT NULL DEFAULT 1,
                    CreatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
                );

                -- 24. CourseEmails
                CREATE TABLE IF NOT EXISTS CourseEmails (
                    CourseEmailId INTEGER PRIMARY KEY AUTOINCREMENT,
                    CourseEmail   TEXT NOT NULL UNIQUE,
                    IsActive      INTEGER NOT NULL DEFAULT 1,
                    CreatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
                );

                -- Supporting indexes
                CREATE INDEX IF NOT EXISTS IX_CourseProviders_IsActive ON CourseProviders (IsActive);
                CREATE INDEX IF NOT EXISTS IX_CourseCategories_IsActive ON CourseCategories (IsActive);
                CREATE INDEX IF NOT EXISTS IX_CourseEmails_IsActive ON CourseEmails (IsActive);
                CREATE INDEX IF NOT EXISTS IX_lms_assign_course_course_id ON lms_assign_course (course_id);
                CREATE INDEX IF NOT EXISTS IX_lms_course_enrollments_employee_id ON lms_course_enrollments (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_course_enrollments_course_id ON lms_course_enrollments (course_id);
                CREATE INDEX IF NOT EXISTS IX_lms_course_requests_employee_id ON lms_course_requests (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_course_request_stages_request_code ON lms_course_request_stages (request_code);
                CREATE INDEX IF NOT EXISTS IX_lms_learning_logs_employee_id ON lms_learning_logs (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_learning_logs_course_id ON lms_learning_logs (course_id);
                CREATE INDEX IF NOT EXISTS IX_lms_leaderboard_snapshots_employee_id ON lms_leaderboard_snapshots (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_employee_certificates_employee_id ON lms_employee_certificates (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_certification_requests_employee_id ON lms_certification_requests (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_reimbursement_claims_employee_id ON lms_reimbursement_claims (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_reimbursement_claim_stages_request_code ON lms_reimbursement_claim_stages (request_code);
                CREATE INDEX IF NOT EXISTS IX_lms_notifications_employee_unread ON lms_notifications (employee_id, is_read);
                CREATE INDEX IF NOT EXISTS IX_lms_enrollment_requests_employee_id ON lms_enrollment_requests (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_enrollment_requests_course_id ON lms_enrollment_requests (course_id);
                CREATE INDEX IF NOT EXISTS IX_lms_spend_category_dept_date ON lms_spend_category (department, spend_date);
                CREATE INDEX IF NOT EXISTS IX_lms_course_recommend_employee_id ON lms_course_recommend (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_recommend_new_course_employee_id ON lms_recommend_new_course (employee_id);
                CREATE INDEX IF NOT EXISTS IX_lms_recommend_new_course_rm_id ON lms_recommend_new_course (rm_id);

                -- 24. lms_idempotency_keys (Global API Idempotency Store)
                CREATE TABLE IF NOT EXISTS lms_idempotency_keys (
                    idempotency_key  TEXT PRIMARY KEY,
                    method           TEXT NOT NULL,
                    path             TEXT NOT NULL,
                    actor_id         TEXT,
                    request_hash     TEXT NOT NULL,
                    status           TEXT NOT NULL DEFAULT 'IN_PROGRESS',
                    response_status  INTEGER,
                    response_body    TEXT,
                    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    expires_at       DATETIME NOT NULL
                );
                CREATE INDEX IF NOT EXISTS IX_lms_idempotency_keys_expires_at ON lms_idempotency_keys (expires_at);

                -- 25. lms_payment_records (HR Disbursed Payment Records)
                CREATE TABLE IF NOT EXISTS lms_payment_records (
                    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                    payment_code        TEXT NOT NULL UNIQUE,
                    request_code        TEXT NOT NULL,
                    claim_type          TEXT NOT NULL,
                    employee_id         TEXT NOT NULL,
                    title               TEXT NOT NULL,
                    amount              INTEGER NOT NULL,
                    payment_slip_path   TEXT NOT NULL,
                    payment_slip_name   TEXT NOT NULL,
                    payment_description TEXT,
                    paid_by             TEXT NOT NULL,
                    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id)
                );
                CREATE INDEX IF NOT EXISTS ix_payment_records_request_code ON lms_payment_records (request_code);
                CREATE INDEX IF NOT EXISTS ix_payment_records_employee_id ON lms_payment_records (employee_id);

                -- 26. lms_employee_logs (Employee Login/Logout Session History)
                CREATE TABLE IF NOT EXISTS lms_employee_logs (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id     TEXT NOT NULL,
                    last_logged_in  DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    last_logged_out DATETIME,
                    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at      DATETIME,
                    FOREIGN KEY (employee_id) REFERENCES lms_employee_profiles (employee_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS IX_lms_employee_logs_emp_date ON lms_employee_logs (employee_id, last_logged_in DESC);

                -- 27. EmailProviders (Model B Email + Provider Junction)
                CREATE TABLE IF NOT EXISTS EmailProviders (
                    EmailProviderId INTEGER PRIMARY KEY AUTOINCREMENT,
                    CourseEmailId   INTEGER NOT NULL,
                    ProviderId      INTEGER NOT NULL,
                    MaxSlots        INTEGER NOT NULL DEFAULT 4,
                    IsActive        INTEGER NOT NULL DEFAULT 1,
                    CreatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    FOREIGN KEY (CourseEmailId) REFERENCES CourseEmails (CourseEmailId) ON DELETE CASCADE,
                    FOREIGN KEY (ProviderId) REFERENCES CourseProviders (ProviderId) ON DELETE CASCADE,
                    UNIQUE (CourseEmailId, ProviderId)
                );
                CREATE INDEX IF NOT EXISTS IX_EmailProviders_Lookup ON EmailProviders (CourseEmailId, ProviderId);

                -- 28. lms_active_slots (4 Concurrency Slots per EmailProviderId)
                CREATE TABLE IF NOT EXISTS lms_active_slots (
                    slot_id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                    EmailProviderId          INTEGER NOT NULL,
                    slot_number              INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 4),
                    enrollment_id            INTEGER,
                    status                   TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Locked')),
                    occupied_slots           INTEGER NOT NULL DEFAULT 0,
                    available_slots          INTEGER NOT NULL DEFAULT 4,
                    enrollment_employee_ids  TEXT DEFAULT 'None',
                    FOREIGN KEY (EmailProviderId) REFERENCES EmailProviders (EmailProviderId) ON DELETE CASCADE,
                    FOREIGN KEY (enrollment_id) REFERENCES lms_course_enrollments (id) ON DELETE SET NULL,
                    UNIQUE (EmailProviderId, slot_number)
                );
                CREATE INDEX IF NOT EXISTS IX_Slots_Availability ON lms_active_slots (EmailProviderId, status);

                -- Duplicate Prevention Unique Indexes
                CREATE UNIQUE INDEX IF NOT EXISTS UX_lms_courses_name_provider
                    ON lms_courses (LOWER(course_name), LOWER(COALESCE(provider, '')))
                    WHERE hr_status <> 'Rejected';
                CREATE UNIQUE INDEX IF NOT EXISTS UX_lms_study_materials_title_type
                    ON lms_study_materials (LOWER(title), LOWER(material_type))
                    WHERE material_type IS NOT NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS UX_lms_course_enrollments_emp_course
                    ON lms_course_enrollments (LOWER(employee_id), course_id);
                CREATE UNIQUE INDEX IF NOT EXISTS UX_lms_enrollment_requests_active
                    ON lms_enrollment_requests (LOWER(employee_id), course_id)
                    WHERE status IN ('Pending', 'Approved', 'On Hold');
                CREATE UNIQUE INDEX IF NOT EXISTS UX_lms_workshops_training_event
                    ON lms_workshops_training (LOWER(event_name), start_date, LOWER(COALESCE(department, '')));
                CREATE UNIQUE INDEX IF NOT EXISTS UX_lms_employee_certificates_emp_cert_date
                    ON lms_employee_certificates (LOWER(employee_id), LOWER(certification_name), issue_date)
                    WHERE issue_date IS NOT NULL;
            """
 
            cursor.executescript(sqlite_schema_ddl)
            conn.commit()
            print("[Database] Offline SQLite schema initialized successfully.")
    except Exception as e:
        conn.rollback()
        print(f"[Database] Notice during DB initialization: {e}")
    finally:
        conn.close()

def _init_sqlite_tables(cursor):
    """Preserved for backward compatibility."""
    init_db()
