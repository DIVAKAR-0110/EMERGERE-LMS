-- =============================================================================
-- LMS Database Schema Definition
-- Target Database: Microsoft SQL Server
-- Single source of truth for LMS database schema (Synchronized with live DB)
-- Total active core tables: 22
-- =============================================================================

-- =============================================================================
-- 0. CLEANUP EXISTING TABLES (Reverse Dependency Order)
-- =============================================================================
IF OBJECT_ID('dbo.vw_lms_active_slots', 'V') IS NOT NULL DROP VIEW dbo.vw_lms_active_slots;
IF OBJECT_ID('dbo.vw_active_slots_summary', 'V') IS NOT NULL DROP VIEW dbo.vw_active_slots_summary;
IF OBJECT_ID('dbo.lms_active_slots', 'U') IS NOT NULL DROP TABLE dbo.lms_active_slots;
IF OBJECT_ID('dbo.EmailProviders', 'U') IS NOT NULL DROP TABLE dbo.EmailProviders;
IF OBJECT_ID('dbo.IX_CourseCategories_IsActive', 'I') IS NOT NULL DROP INDEX IX_CourseCategories_IsActive ON dbo.CourseCategories;
IF OBJECT_ID('dbo.IX_CourseProviders_IsActive', 'I') IS NOT NULL DROP INDEX IX_CourseProviders_IsActive ON dbo.CourseProviders;
IF OBJECT_ID('dbo.IX_CourseEmails_IsActive', 'I') IS NOT NULL DROP INDEX IX_CourseEmails_IsActive ON dbo.CourseEmails;
IF OBJECT_ID('dbo.IX_lms_recommend_new_course_rm_id', 'I') IS NOT NULL DROP INDEX IX_lms_recommend_new_course_rm_id ON dbo.lms_recommend_new_course;
IF OBJECT_ID('dbo.IX_lms_recommend_new_course_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_recommend_new_course_employee_id ON dbo.lms_recommend_new_course;
IF OBJECT_ID('dbo.IX_lms_course_recommend_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_course_recommend_employee_id ON dbo.lms_course_recommend;
IF OBJECT_ID('dbo.IX_lms_spend_category_dept_date', 'I') IS NOT NULL DROP INDEX IX_lms_spend_category_dept_date ON dbo.lms_spend_category;
IF OBJECT_ID('dbo.IX_lms_enrollment_requests_course_id', 'I') IS NOT NULL DROP INDEX IX_lms_enrollment_requests_course_id ON dbo.lms_enrollment_requests;
IF OBJECT_ID('dbo.IX_lms_enrollment_requests_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_enrollment_requests_employee_id ON dbo.lms_enrollment_requests;
IF OBJECT_ID('dbo.IX_lms_notifications_employee_unread', 'I') IS NOT NULL DROP INDEX IX_lms_notifications_employee_unread ON dbo.lms_notifications;
IF OBJECT_ID('dbo.IX_lms_reimbursement_claim_stages_claim', 'I') IS NOT NULL DROP INDEX IX_lms_reimbursement_claim_stages_claim ON dbo.lms_reimbursement_claim_stages;
IF OBJECT_ID('dbo.IX_lms_reimbursement_claims_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_reimbursement_claims_employee_id ON dbo.lms_reimbursement_claims;
IF OBJECT_ID('dbo.IX_lms_certification_requests_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_certification_requests_employee_id ON dbo.lms_certification_requests;
IF OBJECT_ID('dbo.IX_lms_employee_certificates_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_employee_certificates_employee_id ON dbo.lms_employee_certificates;
IF OBJECT_ID('dbo.IX_lms_leaderboard_snapshots_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_leaderboard_snapshots_employee_id ON dbo.lms_leaderboard_snapshots;
IF OBJECT_ID('dbo.IX_lms_learning_logs_course_id', 'I') IS NOT NULL DROP INDEX IX_lms_learning_logs_course_id ON dbo.lms_learning_logs;
IF OBJECT_ID('dbo.IX_lms_learning_logs_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_learning_logs_employee_id ON dbo.lms_learning_logs;
IF OBJECT_ID('dbo.IX_lms_course_request_stages_request_code', 'I') IS NOT NULL DROP INDEX IX_lms_course_request_stages_request_code ON dbo.lms_course_request_stages;
IF OBJECT_ID('dbo.IX_lms_course_requests_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_course_requests_employee_id ON dbo.lms_course_requests;
IF OBJECT_ID('dbo.IX_lms_course_enrollments_assignment_id', 'I') IS NOT NULL DROP INDEX IX_lms_course_enrollments_assignment_id ON dbo.lms_course_enrollments;
IF OBJECT_ID('dbo.IX_lms_course_enrollments_course_id', 'I') IS NOT NULL DROP INDEX IX_lms_course_enrollments_course_id ON dbo.lms_course_enrollments;
IF OBJECT_ID('dbo.IX_lms_course_enrollments_employee_id', 'I') IS NOT NULL DROP INDEX IX_lms_course_enrollments_employee_id ON dbo.lms_course_enrollments;
IF OBJECT_ID('dbo.IX_lms_assign_course_course_id', 'I') IS NOT NULL DROP INDEX IX_lms_assign_course_course_id ON dbo.lms_assign_course;
GO

IF OBJECT_ID('dbo.CourseCategories', 'U') IS NOT NULL DROP TABLE dbo.CourseCategories;
IF OBJECT_ID('dbo.CourseProviders', 'U') IS NOT NULL DROP TABLE dbo.CourseProviders;
IF OBJECT_ID('dbo.CourseEmails', 'U') IS NOT NULL DROP TABLE dbo.CourseEmails;
IF OBJECT_ID('dbo.lms_workshops_training', 'U') IS NOT NULL DROP TABLE dbo.lms_workshops_training;
IF OBJECT_ID('dbo.lms_hr_activity_feed', 'U') IS NOT NULL DROP TABLE dbo.lms_hr_activity_feed;
IF OBJECT_ID('dbo.lms_recommend_new_course', 'U') IS NOT NULL DROP TABLE dbo.lms_recommend_new_course;
IF OBJECT_ID('dbo.lms_course_recommend', 'U') IS NOT NULL DROP TABLE dbo.lms_course_recommend;
IF OBJECT_ID('dbo.lms_spend_category', 'U') IS NOT NULL DROP TABLE dbo.lms_spend_category;
IF OBJECT_ID('dbo.lms_department_budgets', 'U') IS NOT NULL DROP TABLE dbo.lms_department_budgets;
IF OBJECT_ID('dbo.lms_enrollment_requests', 'U') IS NOT NULL DROP TABLE dbo.lms_enrollment_requests;
IF OBJECT_ID('dbo.lms_notifications', 'U') IS NOT NULL DROP TABLE dbo.lms_notifications;
IF OBJECT_ID('dbo.lms_reimbursement_claim_stages', 'U') IS NOT NULL DROP TABLE dbo.lms_reimbursement_claim_stages;
IF OBJECT_ID('dbo.lms_reimbursement_claims', 'U') IS NOT NULL DROP TABLE dbo.lms_reimbursement_claims;
IF OBJECT_ID('dbo.lms_certification_requests', 'U') IS NOT NULL DROP TABLE dbo.lms_certification_requests;
IF OBJECT_ID('dbo.lms_employee_certificates', 'U') IS NOT NULL DROP TABLE dbo.lms_employee_certificates;
IF OBJECT_ID('dbo.lms_leaderboard_snapshots', 'U') IS NOT NULL DROP TABLE dbo.lms_leaderboard_snapshots;
IF OBJECT_ID('dbo.lms_learning_logs', 'U') IS NOT NULL DROP TABLE dbo.lms_learning_logs;
IF OBJECT_ID('dbo.lms_course_request_stages', 'U') IS NOT NULL DROP TABLE dbo.lms_course_request_stages;
IF OBJECT_ID('dbo.lms_course_requests', 'U') IS NOT NULL DROP TABLE dbo.lms_course_requests;
IF OBJECT_ID('dbo.lms_course_enrollments', 'U') IS NOT NULL DROP TABLE dbo.lms_course_enrollments;
IF OBJECT_ID('dbo.lms_assign_course', 'U') IS NOT NULL DROP TABLE dbo.lms_assign_course;
IF OBJECT_ID('dbo.lms_study_materials', 'U') IS NOT NULL DROP TABLE dbo.lms_study_materials;
IF OBJECT_ID('dbo.lms_courses', 'U') IS NOT NULL DROP TABLE dbo.lms_courses;
IF OBJECT_ID('dbo.lms_employee_profiles', 'U') IS NOT NULL DROP TABLE dbo.lms_employee_profiles;

-- Legacy tables cleanup
IF OBJECT_ID('dbo.LMS_DAILY_LEARNING', 'U') IS NOT NULL DROP TABLE dbo.LMS_DAILY_LEARNING;
IF OBJECT_ID('dbo.LMS_EMPLOYEE_LEARNING_STATS', 'U') IS NOT NULL DROP TABLE dbo.LMS_EMPLOYEE_LEARNING_STATS;
IF OBJECT_ID('dbo.lms_timelog', 'U') IS NOT NULL DROP TABLE dbo.lms_timelog;
IF OBJECT_ID('dbo.lms_course_recommendation_request', 'U') IS NOT NULL DROP TABLE dbo.lms_course_recommendation_request;
IF OBJECT_ID('dbo.lms_course_recommendation', 'U') IS NOT NULL DROP TABLE dbo.lms_course_recommendation;
IF OBJECT_ID('dbo.lms_course_enrollment', 'U') IS NOT NULL DROP TABLE dbo.lms_course_enrollment;
IF OBJECT_ID('dbo.lms_LD_assign_course', 'U') IS NOT NULL DROP TABLE dbo.lms_LD_assign_course;
IF OBJECT_ID('dbo.lms_employee_course', 'U') IS NOT NULL DROP TABLE dbo.lms_employee_course;
IF OBJECT_ID('dbo.lms_employee_certifications', 'U') IS NOT NULL DROP TABLE dbo.lms_employee_certifications;
IF OBJECT_ID('dbo.lms_request_new_course', 'U') IS NOT NULL DROP TABLE dbo.lms_request_new_course;
IF OBJECT_ID('dbo.lms_notification', 'U') IS NOT NULL DROP TABLE dbo.lms_notification;
IF OBJECT_ID('dbo.lms_budget_transactions', 'U') IS NOT NULL DROP TABLE dbo.lms_budget_transactions;
IF OBJECT_ID('dbo.lms_budgets', 'U') IS NOT NULL DROP TABLE dbo.lms_budgets;
GO

-- =============================================================================
-- 1. lms_employee_profiles
-- =============================================================================
CREATE TABLE dbo.lms_employee_profiles (
    employee_id           VARCHAR(7)    NOT NULL,
    linkedin_url          VARCHAR(255)  NULL,
    professional_summary  VARCHAR(150)  NULL,
    technical_skills      NVARCHAR(MAX) NULL,
    workplace_skills      NVARCHAR(MAX) NULL,
    area_of_expertise     NVARCHAR(MAX) NULL,
    certifications        NVARCHAR(MAX) NULL,
    learning_interests    NVARCHAR(MAX) NULL,
    created_at            DATETIME      NOT NULL CONSTRAINT DF_lms_employee_profiles_created_at DEFAULT GETDATE(),
    created_by            VARCHAR(7)    NULL,
    updated_at            DATETIME      NULL,
    CONSTRAINT PK_lms_employee_profiles PRIMARY KEY (employee_id)
);
GO

-- Add JSON validation constraints if supported by SQL Server engine (2016+ / v13+)
IF CAST(LEFT(CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50)), CHARINDEX('.', CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(50))) - 1) AS INT) >= 13
BEGIN
    EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_tech_json CHECK (technical_skills IS NULL OR ISJSON(technical_skills) = 1)');
    EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_work_json CHECK (workplace_skills IS NULL OR ISJSON(workplace_skills) = 1)');
    EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_area_json CHECK (area_of_expertise IS NULL OR ISJSON(area_of_expertise) = 1)');
    EXEC('ALTER TABLE dbo.lms_employee_profiles ADD CONSTRAINT CK_lms_employee_profiles_certs_json CHECK (certifications IS NULL OR ISJSON(certifications) = 1)');
END
GO

-- =============================================================================
-- 2. lms_courses
-- =============================================================================
CREATE TABLE dbo.lms_courses (
    id                    INT IDENTITY(1,1) NOT NULL,
    course_name           VARCHAR(100)      NOT NULL,
    course_url            VARCHAR(255)      NULL,
    provider_id           INT               NULL,
    category_id           INT               NULL,
    duration_minutes      INT               NULL,
    price                 INT               NULL,
    description           VARCHAR(500)      NULL,
    course_email_id       INT               NULL,
    support_document      VARCHAR(500)      NULL,
    request_id            INT               NULL,
    claim_id              VARCHAR(50)       NULL,
    hr_id                 INT               NULL,
    payment_status        VARCHAR(20)       NOT NULL CONSTRAINT DF_lms_courses_payment_status DEFAULT 'Pending Payment',
    hr_status             VARCHAR(20)       NOT NULL CONSTRAINT DF_lms_courses_hr_status DEFAULT 'Pending',
    hr_reviewed_at        DATETIME2         NULL,
    created_at            DATETIME          NOT NULL CONSTRAINT DF_lms_courses_created_at DEFAULT GETDATE(),
    created_by            VARCHAR(7)        NULL,
    updated_at            DATETIME          NULL,
    updated_by            VARCHAR(7)        NULL,
    EmailProviderId       INT               NULL,
    CONSTRAINT PK_lms_courses PRIMARY KEY (id)
);
GO

-- =============================================================================
-- 3. lms_study_materials
-- =============================================================================
CREATE TABLE dbo.lms_study_materials (
    id             INT IDENTITY(1,1) NOT NULL,
    title          VARCHAR(100) NOT NULL,
    description    VARCHAR(250) NULL,
    material_type  VARCHAR(50)  NULL,
    file_path      VARCHAR(500) NULL,
    created_at     DATETIME     NOT NULL CONSTRAINT DF_lms_study_materials_created_at DEFAULT GETDATE(),
    created_by     VARCHAR(7)   NULL,
    CONSTRAINT PK_lms_study_materials PRIMARY KEY (id)
);
GO

-- =============================================================================
-- 17. lms_assign_course (created early: referenced by lms_course_enrollments)
-- =============================================================================
CREATE TABLE dbo.lms_assign_course (
    id                      INT IDENTITY(1,1) NOT NULL,
    ld_id                   VARCHAR(7)   NOT NULL,
    course_id               INT          NOT NULL,
    selected_employees      VARCHAR(255) NULL,
    learning_start_date     DATE         NULL,
    target_completion_date  DATE         NULL,
    assignment_note         VARCHAR(250) NULL,
    created_at              DATETIME     NOT NULL CONSTRAINT DF_lms_assign_course_created_at DEFAULT GETDATE(),
    created_by              VARCHAR(7)   NULL,
    CONSTRAINT PK_lms_assign_course PRIMARY KEY (id),
    CONSTRAINT FK_lms_assign_course_ld     FOREIGN KEY (ld_id)     REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_assign_course_course FOREIGN KEY (course_id) REFERENCES dbo.lms_courses (id)
);
GO

-- =============================================================================
-- 4. lms_course_enrollments
-- =============================================================================
CREATE TABLE dbo.lms_course_enrollments (
    id                   INT IDENTITY(1,1) NOT NULL,
    enrollment_code      VARCHAR(20)  NOT NULL,
    employee_id          VARCHAR(7)   NOT NULL,
    course_id            INT          NOT NULL,
    status               VARCHAR(20)  NOT NULL CONSTRAINT DF_lms_course_enrollments_status DEFAULT 'Assigned',
    video_status         VARCHAR(20)  NULL,
    hours_log            INT          NULL,    -- minutes
    last_accessed        DATE         NULL,
    progress_percentage  DECIMAL(5,2) NOT NULL CONSTRAINT DF_lms_course_enrollments_progress DEFAULT 0,
    created_at           DATETIME     NOT NULL CONSTRAINT DF_lms_course_enrollments_created_at DEFAULT GETDATE(),
    created_by           VARCHAR(7)   NULL,
    updated_at           DATETIME     NULL,
    updated_by           VARCHAR(7)   NULL,
    CONSTRAINT PK_lms_course_enrollments PRIMARY KEY (id),
    CONSTRAINT UQ_lms_course_enrollments_code UNIQUE (enrollment_code),
    CONSTRAINT FK_lms_course_enrollments_employee   FOREIGN KEY (employee_id)   REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_course_enrollments_course     FOREIGN KEY (course_id)     REFERENCES dbo.lms_courses (id),
    CONSTRAINT CK_lms_course_enrollments_status   CHECK (status IN ('Assigned','Not Started','In Progress','Completed','Pending','On Hold')),
    CONSTRAINT CK_lms_course_enrollments_video    CHECK (video_status IS NULL OR video_status IN ('ON TRACK','Excellent','Low Progress','Completed')),
    CONSTRAINT CK_lms_course_enrollments_progress CHECK (progress_percentage BETWEEN 0 AND 100)
);
GO

-- =============================================================================
-- 5. lms_course_requests
-- =============================================================================
CREATE TABLE dbo.lms_course_requests (
    id                INT IDENTITY(1,1) NOT NULL,
    request_code      VARCHAR(20)   NOT NULL,
    employee_id       VARCHAR(7)    NOT NULL,
    course_name       VARCHAR(100)  NOT NULL,
    provider_id       INT           NULL,
    category_id       INT           NULL,
    course_link       VARCHAR(255)  NULL,
    reason            VARCHAR(500)  NULL,
    is_ceo_bypassed   BIT           NOT NULL CONSTRAINT DF_lms_course_requests_is_ceo_bypassed DEFAULT 0,
    reopen_reason     VARCHAR(500)  NULL,
    created_at        DATETIME      NOT NULL CONSTRAINT DF_lms_course_requests_created_at DEFAULT GETDATE(),
    created_by        VARCHAR(7)    NULL,
    CONSTRAINT PK_lms_course_requests PRIMARY KEY (id),
    CONSTRAINT UQ_lms_course_requests_code UNIQUE (request_code),
    CONSTRAINT FK_lms_course_requests_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_course_requests_provider FOREIGN KEY (provider_id) REFERENCES dbo.CourseProviders (ProviderId),
    CONSTRAINT FK_lms_course_requests_category FOREIGN KEY (category_id) REFERENCES dbo.CourseCategories (CategoryId)
);
GO

-- =============================================================================
-- 6. lms_course_request_stages
-- =============================================================================
CREATE TABLE dbo.lms_course_request_stages (
    id            INT IDENTITY(1,1) NOT NULL,
    request_code  VARCHAR(20) NOT NULL,
    stage_name    VARCHAR(30) NOT NULL,
    stage_status  VARCHAR(20) NOT NULL,
    stage_date    DATE        NULL,
    created_at    DATETIME    NOT NULL CONSTRAINT DF_lms_course_request_stages_created_at DEFAULT GETDATE(),
    created_by    VARCHAR(7)  NULL,
    updated_at    DATETIME    NULL,
    updated_by    VARCHAR(7)  NULL,
    CONSTRAINT PK_lms_course_request_stages PRIMARY KEY (id),
    CONSTRAINT FK_lms_course_request_stages_request FOREIGN KEY (request_code) REFERENCES dbo.lms_course_requests (request_code) ON DELETE CASCADE,
    CONSTRAINT CK_lms_course_request_stages_name   CHECK (stage_name   IN ('Employee','Notified to RM','L&D','CEO Approval','Course Purchase')),
    CONSTRAINT CK_lms_course_request_stages_status CHECK (stage_status IN ('Completed','Pending','Upcoming','Rejected'))
);
GO

-- =============================================================================
-- 7. lms_learning_logs
-- =============================================================================
CREATE TABLE dbo.lms_learning_logs (
    id                         INT IDENTITY(1,1) NOT NULL,
    employee_id                VARCHAR(7)   NOT NULL,
    course_id                  INT          NULL,
    video_duration_minutes     INT          NULL,
    practice_duration_minutes  INT          NULL,
    learning_notes             VARCHAR(250) NULL,
    points                     INT          NULL CONSTRAINT DF_lms_learning_logs_points DEFAULT 0,
    created_at                 DATETIME     NOT NULL CONSTRAINT DF_lms_learning_logs_created_at DEFAULT GETDATE(),
    created_by                 VARCHAR(7)   NULL,
    updated_at                 DATETIME     NULL,
    updated_by                 VARCHAR(7)   NULL,
    log_date                   DATE         NULL,
    CONSTRAINT PK_lms_learning_logs PRIMARY KEY (id),
    CONSTRAINT FK_lms_learning_logs_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_learning_logs_course   FOREIGN KEY (course_id)   REFERENCES dbo.lms_courses (id)
);
GO

-- =============================================================================
-- 8. lms_leaderboard_snapshots
-- =============================================================================
CREATE TABLE dbo.lms_leaderboard_snapshots (
    id                      INT IDENTITY(1,1) NOT NULL,
    employee_id             VARCHAR(7)   NOT NULL,
    total_learning_minutes  INT          NULL,
    total_points            INT          NULL,
    rank_position           INT          NULL,
    percentile              DECIMAL(5,2) NULL,
    updated_at              DATETIME     NOT NULL CONSTRAINT DF_lms_leaderboard_snapshots_updated_at DEFAULT GETDATE(),
    CONSTRAINT PK_lms_leaderboard_snapshots PRIMARY KEY (id),
    CONSTRAINT UQ_lms_leaderboard_snapshots_employee UNIQUE (employee_id),
    CONSTRAINT FK_lms_leaderboard_snapshots_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id)
);
GO

-- =============================================================================
-- 8a. lms_certification_domains
-- =============================================================================
CREATE TABLE dbo.lms_certification_domains (
    domain_id   INT IDENTITY(1,1) NOT NULL,
    domain_name VARCHAR(150)      NOT NULL CONSTRAINT UQ_lms_certification_domains_name UNIQUE,
    is_active   BIT               NOT NULL CONSTRAINT DF_lms_certification_domains_active DEFAULT 1,
    created_at  DATETIME          NOT NULL CONSTRAINT DF_lms_certification_domains_created_at DEFAULT GETDATE(),
    created_by  VARCHAR(7)        NULL,
    CONSTRAINT PK_lms_certification_domains PRIMARY KEY (domain_id)
);
GO
CREATE NONCLUSTERED INDEX IX_lms_certification_domains_active ON dbo.lms_certification_domains(is_active, domain_name);
GO

-- =============================================================================
-- 9. lms_employee_certificates
-- =============================================================================
CREATE TABLE dbo.lms_employee_certificates (
    id                        INT IDENTITY(1,1) NOT NULL,
    employee_id               VARCHAR(7)   NOT NULL,
    certification_name        VARCHAR(150) NOT NULL,
    certificate_type          VARCHAR(50)  NULL,
    certificate_id            VARCHAR(50)  NULL,
    provider_id               INT          NULL,
    category_id               INT          NULL,
    domain_id                 INT          NULL,
    issue_date                DATE         NULL,
    expiry_date               DATE         NULL,
    certificate_file_path     VARCHAR(500) NULL,
    supporting_document_path  VARCHAR(500) NULL,
    
    created_at                DATETIME     NOT NULL CONSTRAINT DF_lms_employee_certificates_created_at DEFAULT GETDATE(),
    created_by                VARCHAR(7)   NULL,
    CONSTRAINT PK_lms_employee_certificates PRIMARY KEY (id),
    CONSTRAINT FK_lms_employee_certificates_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_employee_certificates_provider FOREIGN KEY (provider_id) REFERENCES dbo.CourseProviders (ProviderId),
    CONSTRAINT FK_lms_employee_certificates_category FOREIGN KEY (category_id) REFERENCES dbo.CourseCategories (CategoryId),
    CONSTRAINT FK_lms_employee_certificates_domain FOREIGN KEY (domain_id) REFERENCES dbo.lms_certification_domains (domain_id),
    CONSTRAINT CK_lms_employee_certificates_dates CHECK (expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date)
);
GO

-- =============================================================================
-- 10. lms_certification_requests
-- =============================================================================
CREATE TABLE dbo.lms_certification_requests (
    id                        INT IDENTITY(1,1) NOT NULL,
    request_code              VARCHAR(20)   NOT NULL,
    employee_id               VARCHAR(7)    NOT NULL,
    certification_name        VARCHAR(150)  NOT NULL,
    provider_id               INT           NULL,
    category_id               INT           NULL,
    domain_id                 INT           NULL,
    exam_date                 DATE          NULL,
    estimated_cost            INT           NULL,
    purpose                   VARCHAR(500)  NULL,
    supporting_document_path  VARCHAR(500)  NULL,
    status                    VARCHAR(20)   NOT NULL CONSTRAINT DF_lms_certification_requests_status DEFAULT 'Pending',
    is_ceo_bypassed           BIT           NOT NULL CONSTRAINT DF_lms_certification_requests_is_ceo_bypassed DEFAULT 0,
    reopen_reason             VARCHAR(500)  NULL,
    created_at                DATETIME      NOT NULL CONSTRAINT DF_lms_certification_requests_created_at DEFAULT GETDATE(),
    CONSTRAINT PK_lms_certification_requests PRIMARY KEY (id),
    CONSTRAINT UQ_lms_certification_requests_code UNIQUE (request_code),
    CONSTRAINT FK_lms_certification_requests_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_certification_requests_provider FOREIGN KEY (provider_id) REFERENCES dbo.CourseProviders (ProviderId),
    CONSTRAINT FK_lms_certification_requests_category FOREIGN KEY (category_id) REFERENCES dbo.CourseCategories (CategoryId),
    CONSTRAINT FK_lms_certification_requests_domain FOREIGN KEY (domain_id) REFERENCES dbo.lms_certification_domains (domain_id),
    CONSTRAINT CK_lms_certification_requests_status CHECK (status IN ('Pending','Approved','Rejected'))
);
GO

-- =============================================================================
-- 10a. lms_certification_request_stages
-- =============================================================================
CREATE TABLE dbo.lms_certification_request_stages (
    id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    request_id    INT         NOT NULL,
    stage_name    VARCHAR(30) NOT NULL,
    stage_status  VARCHAR(20) NOT NULL,
    stage_date    DATE        NULL,
    updated_at    DATETIME    NULL,
    updated_by    VARCHAR(20) NULL,
    CONSTRAINT FK_lms_cert_req_stages_request FOREIGN KEY (request_id) REFERENCES dbo.lms_certification_requests (id) ON DELETE CASCADE,
    CONSTRAINT CK_lms_cert_req_stages_name   CHECK (stage_name IN ('Employee', 'L&D Approval', 'CEO Approval', 'Certificate Approved')),
    CONSTRAINT CK_lms_cert_req_stages_status CHECK (stage_status IN ('Completed', 'Pending', 'Upcoming', 'Rejected'))
);
GO
CREATE INDEX IX_lms_cert_req_stages_request_id ON dbo.lms_certification_request_stages (request_id);
GO

-- =============================================================================
-- 11. lms_reimbursement_claims
-- =============================================================================
CREATE TABLE dbo.lms_reimbursement_claims (
    id                        INT IDENTITY(1,1) NOT NULL,
    claim_code                VARCHAR(20)   NOT NULL,
    employee_id               VARCHAR(7)    NOT NULL,
    certification_name        VARCHAR(150)  NULL,
    provider_id               INT           NULL,
    category_id               INT           NULL,
    amount                    INT           NOT NULL,
    purchase_date             DATE          NULL,
    completion_exam_date      DATE          NULL,
    validity_from             DATE          NULL,
    validity_to               DATE          NULL,
    supporting_document_path  VARCHAR(500)  NULL,
    status                    VARCHAR(20)   NOT NULL CONSTRAINT DF_lms_reimbursement_claims_status DEFAULT 'Pending',
    processing_status         VARCHAR(20)   NULL,
    submitted_on              DATE          NULL,
    created_at                DATETIME      NOT NULL CONSTRAINT DF_lms_reimbursement_claims_created_at DEFAULT GETDATE(),
    CONSTRAINT PK_lms_reimbursement_claims PRIMARY KEY (id),
    CONSTRAINT UQ_lms_reimbursement_claims_code UNIQUE (claim_code),
    CONSTRAINT FK_lms_reimbursement_claims_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_reimbursement_claims_provider FOREIGN KEY (provider_id) REFERENCES dbo.CourseProviders (ProviderId),
    CONSTRAINT FK_lms_reimbursement_claims_category FOREIGN KEY (category_id) REFERENCES dbo.CourseCategories (CategoryId),
    CONSTRAINT CK_lms_reimbursement_claims_status CHECK (status IN ('Pending','Approved','Rejected')),
    CONSTRAINT CK_lms_reimbursement_claims_proc   CHECK (processing_status IS NULL OR processing_status IN ('In Progress','Submitted to HR','Approved','Paid'))
);
GO

-- =============================================================================
-- 12. lms_reimbursement_claim_stages
-- =============================================================================
CREATE TABLE dbo.lms_reimbursement_claim_stages (
    id            INT IDENTITY(1,1) NOT NULL,
    request_code  VARCHAR(20) NOT NULL,
    stage_name    VARCHAR(30) NOT NULL,
    stage_status  VARCHAR(20) NOT NULL,
    stage_date    DATE        NULL,
    created_at    DATETIME    NOT NULL CONSTRAINT DF_lms_reimbursement_claim_stages_created_at DEFAULT GETDATE(),
    created_by    VARCHAR(7)  NULL,
    updated_at    DATETIME    NULL,
    updated_by    VARCHAR(7)  NULL,
    CONSTRAINT PK_lms_reimbursement_claim_stages PRIMARY KEY (id),
    CONSTRAINT FK_lms_reimbursement_claim_stages_code FOREIGN KEY (request_code) REFERENCES dbo.lms_reimbursement_claims (claim_code) ON DELETE CASCADE,
    CONSTRAINT CK_lms_reimbursement_claim_stages_name   CHECK (stage_name   IN ('Employee Request','Notified to RM','L&D status','HR Approval','Reimbursed')),
    CONSTRAINT CK_lms_reimbursement_claim_stages_status CHECK (stage_status IN ('Completed','Pending','Upcoming','Rejected'))
);
GO

-- =============================================================================
-- 13. lms_notifications
-- =============================================================================
CREATE TABLE dbo.lms_notifications (
    id           INT IDENTITY(1,1) NOT NULL,
    employee_id  VARCHAR(7)    NOT NULL,
    message      NVARCHAR(MAX) NOT NULL,
    is_read      BIT           NOT NULL CONSTRAINT DF_lms_notifications_is_read DEFAULT 0,
    created_at   DATETIME      NOT NULL CONSTRAINT DF_lms_notifications_created_at DEFAULT GETDATE(),
    created_by   VARCHAR(7)    NULL,
    CONSTRAINT PK_lms_notifications PRIMARY KEY (id),
    CONSTRAINT FK_lms_notifications_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id)
);
GO

-- =============================================================================
-- 14. lms_enrollment_requests
-- =============================================================================
CREATE TABLE dbo.lms_enrollment_requests (
    id            INT IDENTITY(1,1) NOT NULL,
    request_code  VARCHAR(20) NOT NULL,
    employee_id   VARCHAR(7)  NOT NULL,
    course_id     INT         NOT NULL,
    status        VARCHAR(20)  NOT NULL CONSTRAINT DF_lms_enrollment_requests_status DEFAULT 'Pending',
    onhold_reason VARCHAR(250) NULL,
    on_hold_date  DATE         NULL,
    created_at    DATETIME    NOT NULL CONSTRAINT DF_lms_enrollment_requests_created_at DEFAULT GETDATE(),
    created_by    VARCHAR(7)  NULL,
    updated_at    DATETIME    NULL,
    updated_by    VARCHAR(7)  NULL,
    CONSTRAINT PK_lms_enrollment_requests PRIMARY KEY (id),
    CONSTRAINT UQ_lms_enrollment_requests_code UNIQUE (request_code),
    CONSTRAINT FK_lms_enrollment_requests_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_enrollment_requests_course   FOREIGN KEY (course_id)   REFERENCES dbo.lms_courses (id),
    CONSTRAINT CK_lms_enrollment_requests_status CHECK (status IN ('Pending','Approved','On Hold'))
);
GO

-- =============================================================================
-- 15. lms_department_budgets
-- =============================================================================
CREATE TABLE dbo.lms_department_budgets (
    id             INT IDENTITY(1,1) NOT NULL,
    department     VARCHAR(100)  NOT NULL,
    budget_year    INT           NOT NULL,
    budget_amount  DECIMAL(12,2) NOT NULL,
    created_at     DATETIME      NOT NULL CONSTRAINT DF_lms_department_budgets_created_at DEFAULT GETDATE(),
    created_by     VARCHAR(7)    NULL,
    CONSTRAINT PK_lms_department_budgets PRIMARY KEY (id),
    CONSTRAINT UQ_lms_department_budgets_dept_year UNIQUE (department, budget_year)
);
GO

-- =============================================================================
-- 16. lms_spend_category
-- =============================================================================
CREATE TABLE dbo.lms_spend_category (
    id              INT IDENTITY(1,1) NOT NULL,
    spend_category  VARCHAR(30)   NOT NULL,
    department      VARCHAR(100)  NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    spend_date      DATE          NOT NULL,
    created_at      DATETIME      NOT NULL CONSTRAINT DF_lms_spend_category_created_at DEFAULT GETDATE(),
    created_by      VARCHAR(7)    NULL,
    CONSTRAINT PK_lms_spend_category PRIMARY KEY (id)
);
GO

-- =============================================================================
-- 18. lms_course_recommend
-- =============================================================================
CREATE TABLE dbo.lms_course_recommend (
    id                 INT IDENTITY(1,1) NOT NULL,
    employee_id        VARCHAR(7) NOT NULL,
    course_id          INT        NULL,
    study_material_id  INT        NULL,
    created_at         DATETIME   NOT NULL CONSTRAINT DF_lms_course_recommend_created_at DEFAULT GETDATE(),
    created_by         VARCHAR(7) NULL,
    CONSTRAINT PK_lms_course_recommend PRIMARY KEY (id),
    CONSTRAINT FK_lms_course_recommend_employee FOREIGN KEY (employee_id)       REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_course_recommend_course   FOREIGN KEY (course_id)         REFERENCES dbo.lms_courses (id),
    CONSTRAINT FK_lms_course_recommend_material FOREIGN KEY (study_material_id) REFERENCES dbo.lms_study_materials (id),
    CONSTRAINT CK_lms_course_recommend_target   CHECK (course_id IS NOT NULL OR study_material_id IS NOT NULL)
);
GO

-- =============================================================================
-- 19. lms_recommend_new_course
-- =============================================================================
CREATE TABLE dbo.lms_recommend_new_course (
    id           INT IDENTITY(1,1) NOT NULL,
    rm_id        VARCHAR(7)   NOT NULL,
    employee_id  VARCHAR(7)   NOT NULL,
    course_name  VARCHAR(100) NOT NULL,
    provider_id  INT          NULL,
    category_id  INT          NULL,
    course_link  VARCHAR(255) NULL,
    reason       VARCHAR(500) NULL,
    created_at   DATETIME     NOT NULL CONSTRAINT DF_lms_recommend_new_course_created_at DEFAULT GETDATE(),
    created_by   VARCHAR(7)   NULL,
    CONSTRAINT PK_lms_recommend_new_course PRIMARY KEY (id),
    CONSTRAINT FK_lms_recommend_new_course_rm       FOREIGN KEY (rm_id)       REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_recommend_new_course_employee FOREIGN KEY (employee_id) REFERENCES dbo.lms_employee_profiles (employee_id),
    CONSTRAINT FK_lms_recommend_new_course_provider FOREIGN KEY (provider_id) REFERENCES dbo.CourseProviders (ProviderId),
    CONSTRAINT FK_lms_recommend_new_course_category FOREIGN KEY (category_id) REFERENCES dbo.CourseCategories (CategoryId)
);
GO

-- =============================================================================
-- 20. lms_hr_activity_feed
-- =============================================================================
CREATE TABLE dbo.lms_hr_activity_feed (
    id             INT IDENTITY(1,1) NOT NULL,
    activity_type  VARCHAR(30)  NOT NULL,
    message        VARCHAR(255) NOT NULL,
    created_at     DATETIME     NOT NULL CONSTRAINT DF_lms_hr_activity_feed_created_at DEFAULT GETDATE(),
    created_by     VARCHAR(7)   NULL,
    CONSTRAINT PK_lms_hr_activity_feed PRIMARY KEY (id)
);
GO

-- =============================================================================
-- Supporting indexes
-- =============================================================================
CREATE NONCLUSTERED INDEX IX_lms_courses_course_name   ON dbo.lms_courses (course_name) INCLUDE (provider, category, duration_minutes, price, hr_status);
CREATE INDEX IX_lms_assign_course_course_id            ON dbo.lms_assign_course (course_id);
CREATE INDEX IX_lms_course_enrollments_employee_id     ON dbo.lms_course_enrollments (employee_id);
CREATE INDEX IX_lms_course_enrollments_course_id       ON dbo.lms_course_enrollments (course_id);
CREATE INDEX IX_lms_course_enrollments_assignment_id   ON dbo.lms_course_enrollments (assignment_id);
CREATE INDEX IX_lms_course_requests_employee_id        ON dbo.lms_course_requests (employee_id);
CREATE INDEX IX_lms_course_request_stages_request_code ON dbo.lms_course_request_stages (request_code);
CREATE INDEX IX_lms_learning_logs_employee_id          ON dbo.lms_learning_logs (employee_id);
CREATE INDEX IX_lms_learning_logs_course_id            ON dbo.lms_learning_logs (course_id);
CREATE INDEX IX_lms_leaderboard_snapshots_employee_id  ON dbo.lms_leaderboard_snapshots (employee_id);
CREATE INDEX IX_lms_employee_certificates_employee_id  ON dbo.lms_employee_certificates (employee_id);
CREATE INDEX IX_lms_certification_requests_employee_id ON dbo.lms_certification_requests (employee_id);
CREATE INDEX IX_lms_reimbursement_claims_employee_id   ON dbo.lms_reimbursement_claims (employee_id);
CREATE INDEX IX_lms_reimbursement_claim_stages_request_code ON dbo.lms_reimbursement_claim_stages (request_code);
CREATE INDEX IX_lms_notifications_employee_unread      ON dbo.lms_notifications (employee_id, is_read);
CREATE INDEX IX_lms_enrollment_requests_employee_id    ON dbo.lms_enrollment_requests (employee_id);
CREATE INDEX IX_lms_enrollment_requests_course_id      ON dbo.lms_enrollment_requests (course_id);
CREATE INDEX IX_lms_spend_category_dept_date           ON dbo.lms_spend_category (department, spend_date);
CREATE INDEX IX_lms_course_recommend_employee_id       ON dbo.lms_course_recommend (employee_id);
CREATE INDEX IX_lms_recommend_new_course_employee_id   ON dbo.lms_recommend_new_course (employee_id);
CREATE INDEX IX_lms_recommend_new_course_rm_id         ON dbo.lms_recommend_new_course (rm_id);
CREATE INDEX IX_lms_recommend_new_course_provider_id   ON dbo.lms_recommend_new_course (provider_id);
CREATE INDEX IX_lms_recommend_new_course_category_id   ON dbo.lms_recommend_new_course (category_id);
GO

-- =============================================================================
-- 21. lms_workshops_training
-- =============================================================================
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
GO

CREATE INDEX IX_lms_workshops_training_start_date      ON dbo.lms_workshops_training (start_date);
CREATE INDEX IX_lms_workshops_training_event_category  ON dbo.lms_workshops_training (event_category);
CREATE INDEX IX_lms_workshops_training_event_type      ON dbo.lms_workshops_training (event_type);
CREATE INDEX IX_lms_workshops_training_department      ON dbo.lms_workshops_training (department);
GO

-- =============================================================================
-- 22. CourseProviders
-- =============================================================================
CREATE TABLE dbo.CourseProviders
(
    ProviderId   INT IDENTITY(1,1) NOT NULL,
    ProviderName NVARCHAR(150) NOT NULL,
    IsActive     BIT NOT NULL CONSTRAINT DF_CourseProviders_IsActive DEFAULT 1,
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_CourseProviders_CreatedAt DEFAULT GETDATE(),

    CONSTRAINT PK_CourseProviders
        PRIMARY KEY (ProviderId),

    CONSTRAINT UQ_CourseProviders_ProviderName
        UNIQUE (ProviderName)
);
GO

CREATE INDEX IX_CourseProviders_IsActive ON dbo.CourseProviders (IsActive);
GO

-- =============================================================================
-- 23. CourseCategories
-- =============================================================================
CREATE TABLE dbo.CourseCategories
(
    CategoryId   INT IDENTITY(1,1) NOT NULL,
    CategoryName NVARCHAR(150) NOT NULL,
    IsActive     BIT NOT NULL CONSTRAINT DF_CourseCategories_IsActive DEFAULT 1,
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_CourseCategories_CreatedAt DEFAULT GETDATE(),

    CONSTRAINT PK_CourseCategories
        PRIMARY KEY (CategoryId),

    CONSTRAINT UQ_CourseCategories_CategoryName
        UNIQUE (CategoryName)
);
GO

CREATE INDEX IX_CourseCategories_IsActive ON dbo.CourseCategories (IsActive);
GO

-- =============================================================================
-- 24. CourseEmails (Master Corporate Course Account Emails)
-- =============================================================================
CREATE TABLE dbo.CourseEmails
(
    CourseEmailId INT IDENTITY(1,1) NOT NULL,
    CourseEmail   NVARCHAR(255)     NOT NULL,
    IsActive      BIT               NOT NULL CONSTRAINT DF_CourseEmails_IsActive DEFAULT 1,
    CreatedAt     DATETIME2         NOT NULL CONSTRAINT DF_CourseEmails_CreatedAt DEFAULT GETDATE(),

    CONSTRAINT PK_CourseEmails
        PRIMARY KEY (CourseEmailId),

    CONSTRAINT UQ_CourseEmails_CourseEmail
        UNIQUE (CourseEmail)
);
GO

CREATE INDEX IX_CourseEmails_IsActive ON dbo.CourseEmails (IsActive);
GO

-- =============================================================================
-- 25. lms_idempotency_keys (Global API Idempotency Store)
-- =============================================================================
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
GO

-- =============================================================================
-- 25. lms_payment_records (HR Disbursed Payment Records)
-- =============================================================================
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
GO

-- =============================================================================
-- Duplicate Prevention Constraints & Filtered Unique Indexes
-- =============================================================================
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_lms_courses_name_provider' AND object_id = OBJECT_ID('dbo.lms_courses'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_lms_courses_name_provider
        ON dbo.lms_courses (course_name, provider_id)
        WHERE hr_status <> 'Rejected';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_lms_study_materials_title_type' AND object_id = OBJECT_ID('dbo.lms_study_materials'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_lms_study_materials_title_type
        ON dbo.lms_study_materials (title, material_type)
        WHERE material_type IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_lms_course_enrollments_emp_course' AND object_id = OBJECT_ID('dbo.lms_course_enrollments'))
    ALTER TABLE dbo.lms_course_enrollments
        ADD CONSTRAINT UQ_lms_course_enrollments_emp_course UNIQUE (employee_id, course_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_lms_enrollment_requests_active' AND object_id = OBJECT_ID('dbo.lms_enrollment_requests'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_lms_enrollment_requests_active
        ON dbo.lms_enrollment_requests (employee_id, course_id)
        WHERE status IN ('Pending', 'Approved', 'On Hold');
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_lms_workshops_training_event' AND object_id = OBJECT_ID('dbo.lms_workshops_training'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_lms_workshops_training_event
        ON dbo.lms_workshops_training (event_name, start_date, department)
        WHERE department IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_lms_workshops_training_event_nodept' AND object_id = OBJECT_ID('dbo.lms_workshops_training'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_lms_workshops_training_event_nodept
        ON dbo.lms_workshops_training (event_name, start_date)
        WHERE department IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_lms_employee_certificates_emp_cert_date' AND object_id = OBJECT_ID('dbo.lms_employee_certificates'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_lms_employee_certificates_emp_cert_date
        ON dbo.lms_employee_certificates (employee_id, certification_name, issue_date)
        WHERE issue_date IS NOT NULL;
GO

-- =============================================================================
-- 26. lms_employee_logs (Employee Login & Logout Session History Ledger)
-- =============================================================================
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
GO

-- =============================================================================
-- 27. EmailProviders (Model B: Corporate Email + Course Provider Junction Table)
-- =============================================================================
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
        CONSTRAINT FK_EmailProviders_CourseEmail FOREIGN KEY (CourseEmailId) 
            REFERENCES dbo.CourseEmails(CourseEmailId) ON DELETE CASCADE,
        CONSTRAINT FK_EmailProviders_CourseProvider FOREIGN KEY (ProviderId) 
            REFERENCES dbo.CourseProviders(ProviderId) ON DELETE CASCADE,
        CONSTRAINT UQ_EmailProviders_Email_Provider UNIQUE (CourseEmailId, ProviderId)
    );

    CREATE NONCLUSTERED INDEX IX_EmailProviders_Lookup 
        ON dbo.EmailProviders(CourseEmailId, ProviderId);
END
GO

-- =============================================================================
-- 28. lms_active_slots (Lean 4-Seat Concurrency Engine per EmailProviderId)
-- =============================================================================
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
GO

-- =============================================================================
-- 29. Foreign Keys on dbo.lms_courses
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_lms_courses_EmailProvider')
    ALTER TABLE dbo.lms_courses 
        ADD CONSTRAINT FK_lms_courses_EmailProvider FOREIGN KEY (EmailProviderId) 
            REFERENCES dbo.EmailProviders(EmailProviderId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_lms_courses_provider')
    ALTER TABLE dbo.lms_courses 
        ADD CONSTRAINT FK_lms_courses_provider FOREIGN KEY (provider_id) 
            REFERENCES dbo.CourseProviders(ProviderId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_lms_courses_category')
    ALTER TABLE dbo.lms_courses 
        ADD CONSTRAINT FK_lms_courses_category FOREIGN KEY (category_id) 
            REFERENCES dbo.CourseCategories(CategoryId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_lms_courses_course_email')
    ALTER TABLE dbo.lms_courses 
        ADD CONSTRAINT FK_lms_courses_course_email FOREIGN KEY (course_email_id) 
            REFERENCES dbo.CourseEmails(CourseEmailId);
GO

-- =============================================================================
-- 30. Active Slots Tracking Views (Real-Time summary of available slots & active employee IDs)
-- =============================================================================
IF OBJECT_ID('dbo.vw_active_slots_summary', 'V') IS NOT NULL
    DROP VIEW dbo.vw_active_slots_summary;
GO

CREATE VIEW dbo.vw_active_slots_summary AS
SELECT 
    ep.EmailProviderId,
    ep.IsActive,
    ce.CourseEmailId,
    ce.CourseEmail,
    cp.ProviderId,
    cp.ProviderName,
    ep.MaxSlots,
    SUM(CASE WHEN s.status = 'Occupied' THEN 1 ELSE 0 END) AS occupied_slots,
    SUM(CASE WHEN s.status = 'Available' THEN 1 ELSE 0 END) AS available_slots,
    COALESCE(
        STUFF((
            SELECT ', ' + e.employee_id
            FROM dbo.lms_active_slots s2
            JOIN dbo.lms_course_enrollments e ON e.id = s2.enrollment_id
            WHERE s2.EmailProviderId = ep.EmailProviderId AND s2.status = 'Occupied'
            ORDER BY s2.slot_number ASC
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''),
        'None'
    ) AS enrollment_employee_ids
FROM dbo.EmailProviders ep
JOIN dbo.CourseEmails ce ON ce.CourseEmailId = ep.CourseEmailId
JOIN dbo.CourseProviders cp ON cp.ProviderId = ep.ProviderId
LEFT JOIN dbo.lms_active_slots s ON s.EmailProviderId = ep.EmailProviderId
GROUP BY ep.EmailProviderId, ep.IsActive, ce.CourseEmailId, ce.CourseEmail, cp.ProviderId, cp.ProviderName, ep.MaxSlots;
GO

IF OBJECT_ID('dbo.vw_lms_active_slots', 'V') IS NOT NULL
    DROP VIEW dbo.vw_lms_active_slots;
GO

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
GO

-- =============================================================================
-- 31. AI Analytics & Reporting Views
-- =============================================================================
IF OBJECT_ID('dbo.vw_ai_department_learning_summary', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_department_learning_summary;
GO
CREATE VIEW dbo.vw_ai_department_learning_summary AS
SELECT 
    b.department,
    COALESCE(b.budget_year, 2026) AS budget_year,
    COALESCE(b.budget_amount, 0.0) AS allocated_budget,
    COALESCE(agg.total_enrollments, 0) AS total_enrollments,
    COALESCE(agg.completed_count, 0) AS completed_count,
    COALESCE(agg.in_progress_count, 0) AS in_progress_count,
    COALESCE(agg.active_learners, 0) AS active_learners,
    COALESCE(agg.avg_progress, 0.0) AS avg_progress
FROM dbo.lms_department_budgets b
LEFT JOIN (
    SELECT 
        ce.employee_id,
        COUNT(ce.id) AS total_enrollments,
        SUM(CASE WHEN ce.status = 'Completed' OR ce.progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN ce.status IN ('In Progress', 'Active') THEN 1 ELSE 0 END) AS in_progress_count,
        COUNT(DISTINCT ce.employee_id) AS active_learners,
        AVG(COALESCE(ce.progress_percentage, 0.0)) AS avg_progress
    FROM dbo.lms_course_enrollments ce
    GROUP BY ce.employee_id
) agg ON 1=0;
GO

IF OBJECT_ID('dbo.vw_ai_ld_assigned_courses', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_ld_assigned_courses;
GO
CREATE VIEW dbo.vw_ai_ld_assigned_courses AS
SELECT 
    ac.id AS assignment_id,
    ac.ld_id,
    ac.course_id,
    c.course_name,
    c.provider_id,
    COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
    c.category_id,
    COALESCE(cc.CategoryName, 'General') AS category,
    COALESCE(c.price, 0.0) AS price,
    ac.selected_employees,
    ac.learning_start_date,
    ac.target_completion_date,
    ac.assignment_note,
    ac.created_at AS assigned_at,
    ac.created_by
FROM dbo.lms_assign_course ac
INNER JOIN dbo.lms_courses c ON ac.course_id = c.id
LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId;
GO

IF OBJECT_ID('dbo.vw_ai_learner_360_profile', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_learner_360_profile;
GO
CREATE VIEW dbo.vw_ai_learner_360_profile AS
SELECT 
    p.employee_id,
    COALESCE(p.technical_skills, '') AS technical_skills,
    COALESCE(p.workplace_skills, '') AS workplace_skills,
    COALESCE(p.area_of_expertise, '') AS area_of_expertise,
    COALESCE(p.learning_interests, '') AS learning_interests,
    COALESCE(p.professional_summary, '') AS professional_summary,
    COALESCE(enr.total_enrolled, 0) AS total_enrolled,
    COALESCE(enr.completed_courses, 0) AS completed_courses,
    COALESCE(enr.in_progress_courses, 0) AS in_progress_courses,
    COALESCE(enr.not_started_courses, 0) AS not_started_courses,
    COALESCE(enr.total_study_minutes, 0) AS total_study_minutes,
    COALESCE(enr.avg_progress_pct, 0.0) AS avg_progress_pct,
    COALESCE(crt.total_certificates, 0) AS total_certificates,
    COALESCE(req.total_course_requests, 0) AS total_course_requests,
    COALESCE(req.pending_course_requests, 0) AS pending_course_requests,
    COALESCE(rmb.total_reimbursement_claims, 0) AS total_reimbursement_claims,
    COALESCE(rmb.pending_reimbursement_claims, 0) AS pending_reimbursement_claims,
    COALESCE(rmb.total_claimed_amount, 0.0) AS total_claimed_amount,
    COALESCE(rmb.approved_claimed_amount, 0.0) AS approved_claimed_amount,
    COALESCE(rmb.pending_claimed_amount, 0.0) AS pending_claimed_amount
FROM dbo.lms_employee_profiles p
LEFT JOIN (
    SELECT 
        employee_id,
        COUNT(id) AS total_enrolled,
        SUM(CASE WHEN status = 'Completed' OR progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_courses,
        SUM(CASE WHEN status IN ('In Progress', 'Active') AND progress_percentage < 100 THEN 1 ELSE 0 END) AS in_progress_courses,
        SUM(CASE WHEN status IN ('Not Started', 'Assigned') THEN 1 ELSE 0 END) AS not_started_courses,
        SUM(COALESCE(hours_log, 0)) AS total_study_minutes,
        AVG(COALESCE(progress_percentage, 0.0)) AS avg_progress_pct
    FROM dbo.lms_course_enrollments
    GROUP BY employee_id
) enr ON p.employee_id = enr.employee_id
LEFT JOIN (
    SELECT employee_id, COUNT(id) AS total_certificates
    FROM dbo.lms_employee_certificates
    GROUP BY employee_id
) crt ON p.employee_id = crt.employee_id
LEFT JOIN (
    SELECT 
        employee_id,
        COUNT(id) AS total_course_requests,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_course_requests
    FROM dbo.lms_course_requests
    GROUP BY employee_id
) req ON p.employee_id = req.employee_id
LEFT JOIN (
    SELECT 
        employee_id,
        COUNT(id) AS total_reimbursement_claims,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_reimbursement_claims,
        SUM(COALESCE(amount, 0.0)) AS total_claimed_amount,
        SUM(CASE WHEN status = 'Approved' THEN COALESCE(amount, 0.0) ELSE 0.0 END) AS approved_claimed_amount,
        SUM(CASE WHEN status = 'Pending' THEN COALESCE(amount, 0.0) ELSE 0.0 END) AS pending_claimed_amount
    FROM dbo.lms_reimbursement_claims
    GROUP BY employee_id
) rmb ON p.employee_id = rmb.employee_id;
GO

IF OBJECT_ID('dbo.vw_ai_learner_cert_requests', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_learner_cert_requests;
GO
CREATE VIEW dbo.vw_ai_learner_cert_requests AS
SELECT 
    cr.id AS request_id,
    cr.request_code,
    cr.employee_id,
    cr.certification_name,
    cr.provider_id,
    COALESCE(cp.ProviderName, 'Unknown Provider') AS provider,
    cr.category_id,
    COALESCE(cc.CategoryName, 'General') AS category,
    cr.exam_date,
    COALESCE(cr.estimated_cost, 0.0) AS estimated_cost,
    cr.purpose,
    cr.status,
    cr.created_at,
    COALESCE(
        (SELECT TOP 1 s.stage_name FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id AND s.stage_status = 'Pending' ORDER BY s.id ASC),
        (SELECT TOP 1 'Rejected at ' + s.stage_name FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id AND s.stage_status = 'Rejected' ORDER BY s.id DESC),
        'Completed'
    ) AS current_pending_stage,
    (SELECT COUNT(*) FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id) AS total_stages,
    (SELECT COUNT(*) FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id AND s.stage_status = 'Completed') AS completed_stages
FROM dbo.lms_certification_requests cr
LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId;
GO

IF OBJECT_ID('dbo.vw_ai_learner_certifications', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_learner_certifications;
GO
CREATE VIEW dbo.vw_ai_learner_certifications AS
SELECT 
    c.id AS certificate_id,
    c.employee_id,
    c.certification_name,
    c.certificate_type,
    c.provider_id,
    COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
    c.category_id,
    COALESCE(cc.CategoryName, 'General') AS category,
    c.issue_date,
    c.expiry_date,
    c.created_at,
    CASE 
        WHEN c.expiry_date IS NOT NULL AND c.expiry_date < CAST(GETDATE() AS DATE) THEN 'Expired'
        ELSE 'Active'
    END AS validity_status
FROM dbo.lms_employee_certificates c
LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId;
GO

IF OBJECT_ID('dbo.vw_ai_learner_course_requests', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_learner_course_requests;
GO
CREATE VIEW dbo.vw_ai_learner_course_requests AS
SELECT 
    cr.id AS request_id,
    cr.request_code,
    cr.employee_id,
    cr.course_name,
    cr.provider_id,
    COALESCE(cp.ProviderName, 'External Provider') AS provider,
    cr.category_id,
    COALESCE(cc.CategoryName, 'General') AS category,
    cr.course_link,
    cr.reason,
    COALESCE(cr.status, 'Pending') AS status,
    cr.created_at,
    COALESCE(
        (SELECT TOP 1 s.stage_name FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Pending' ORDER BY s.id ASC),
        (SELECT TOP 1 'Rejected at ' + s.stage_name FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Rejected' ORDER BY s.id DESC),
        'Completed'
    ) AS current_pending_stage,
    (SELECT COUNT(*) FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code) AS total_stages,
    (SELECT COUNT(*) FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Completed') AS completed_stages
FROM dbo.lms_course_requests cr
LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId;
GO

IF OBJECT_ID('dbo.vw_ai_learner_enrollments', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_learner_enrollments;
GO
CREATE VIEW dbo.vw_ai_learner_enrollments AS
SELECT 
    ce.id AS enrollment_id,
    ce.enrollment_code,
    ce.employee_id,
    ce.course_id,
    c.course_name,
    c.provider_id,
    COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
    c.category_id,
    COALESCE(cc.CategoryName, 'General') AS category,
    COALESCE(c.price, 0.0) AS price,
    ce.status AS enrollment_status,
    COALESCE(ce.progress_percentage, 0.0) AS progress_percentage,
    ce.last_accessed,
    COALESCE(ce.hours_log, 0) AS total_study_minutes,
    ce.created_at AS enrolled_at,
    ce.updated_at
FROM dbo.lms_course_enrollments ce
INNER JOIN dbo.lms_courses c ON ce.course_id = c.id
LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId;
GO

IF OBJECT_ID('dbo.vw_ai_learner_reimbursements', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_learner_reimbursements;
GO
CREATE VIEW dbo.vw_ai_learner_reimbursements AS
SELECT 
    rc.id AS claim_id,
    rc.claim_code,
    rc.employee_id,
    CAST('Certification' AS VARCHAR(20)) AS claim_type,
    rc.certification_name,
    rc.provider_id,
    COALESCE(cp.ProviderName, 'Unknown Provider') AS provider,
    rc.category_id,
    COALESCE(cc.CategoryName, 'General') AS category,
    COALESCE(rc.amount, 0.0) AS amount,
    rc.status AS claim_status,
    COALESCE(rc.processing_status, 'Submitted') AS processing_status,
    rc.submitted_on,
    rc.created_at,
    COALESCE(
        (SELECT TOP 1 s.stage_name 
         FROM dbo.lms_reimbursement_claim_stages s 
         WHERE s.request_code = rc.claim_code AND s.stage_status = 'Pending' 
         ORDER BY s.id ASC),
        (SELECT TOP 1 'Rejected at ' + s.stage_name 
         FROM dbo.lms_reimbursement_claim_stages s 
         WHERE s.request_code = rc.claim_code AND s.stage_status = 'Rejected' 
         ORDER BY s.id DESC),
        'Completed'
    ) AS current_pending_stage,
    (SELECT COUNT(*) FROM dbo.lms_reimbursement_claim_stages s WHERE s.request_code = rc.claim_code) AS total_stages,
    (SELECT COUNT(*) FROM dbo.lms_reimbursement_claim_stages s WHERE s.request_code = rc.claim_code AND s.stage_status = 'Approved') AS approved_stages
FROM dbo.lms_reimbursement_claims rc
LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId;
GO

IF OBJECT_ID('dbo.vw_ai_org_approvals_queue', 'V') IS NOT NULL DROP VIEW dbo.vw_ai_org_approvals_queue;
GO
CREATE VIEW dbo.vw_ai_org_approvals_queue AS
SELECT 
    'Course Request' AS approval_type,
    cr.request_code,
    cr.employee_id,
    cr.course_name AS item_name,
    COALESCE(cp.ProviderName, 'External Provider') AS provider,
    0.0 AS amount,
    COALESCE(
        (SELECT TOP 1 s.stage_name FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Pending' ORDER BY s.id ASC),
        'Pending Review'
    ) AS pending_stage,
    cr.created_at AS submitted_at
FROM dbo.lms_course_requests cr
LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
WHERE EXISTS (
    SELECT 1 FROM dbo.lms_course_request_stages s 
    WHERE s.request_code = cr.request_code AND s.stage_status = 'Pending'
)

UNION ALL

SELECT 
    'Reimbursement Claim' AS approval_type,
    rc.claim_code AS request_code,
    rc.employee_id,
    rc.certification_name AS item_name,
    COALESCE(cp.ProviderName, 'External Provider') AS provider,
    COALESCE(rc.amount, 0.0) AS amount,
    COALESCE(
        (SELECT TOP 1 s.stage_name FROM dbo.lms_reimbursement_claim_stages s WHERE s.request_code = rc.claim_code AND s.stage_status = 'Pending' ORDER BY s.id ASC),
        'Pending Review'
    ) AS pending_stage,
    rc.created_at AS submitted_at
FROM dbo.lms_reimbursement_claims rc
LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
WHERE rc.status = 'Pending' OR EXISTS (
    SELECT 1 FROM dbo.lms_reimbursement_claim_stages s 
    WHERE s.request_code = rc.claim_code AND s.stage_status = 'Pending'
)

UNION ALL

SELECT 
    'Certification Request' AS approval_type,
    cr.request_code,
    cr.employee_id,
    cr.certification_name AS item_name,
    COALESCE(cp.ProviderName, 'External Provider') AS provider,
    COALESCE(cr.estimated_cost, 0.0) AS amount,
    COALESCE(
        (SELECT TOP 1 s.stage_name FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id AND s.stage_status = 'Pending' ORDER BY s.id ASC),
        'Pending Review'
    ) AS pending_stage,
    cr.created_at AS submitted_at
FROM dbo.lms_certification_requests cr
LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
WHERE cr.status = 'Pending' OR EXISTS (
    SELECT 1 FROM dbo.lms_certification_request_stages s 
    WHERE s.request_id = cr.id AND s.stage_status = 'Pending'
);
GO

-- =============================================================================
-- Seed Initial Records for lms_certification_domains
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.lms_certification_domains WHERE domain_name = 'DevOps & Kubernetes')
    INSERT INTO dbo.lms_certification_domains (domain_name, is_active, created_at) VALUES ('DevOps & Kubernetes', 1, GETDATE());
IF NOT EXISTS (SELECT 1 FROM dbo.lms_certification_domains WHERE domain_name = 'AI & Machine Learning')
    INSERT INTO dbo.lms_certification_domains (domain_name, is_active, created_at) VALUES ('AI & Machine Learning', 1, GETDATE());
IF NOT EXISTS (SELECT 1 FROM dbo.lms_certification_domains WHERE domain_name = 'Cybersecurity')
    INSERT INTO dbo.lms_certification_domains (domain_name, is_active, created_at) VALUES ('Cybersecurity', 1, GETDATE());
IF NOT EXISTS (SELECT 1 FROM dbo.lms_certification_domains WHERE domain_name = 'Data Science & Analytics')
    INSERT INTO dbo.lms_certification_domains (domain_name, is_active, created_at) VALUES ('Data Science & Analytics', 1, GETDATE());
IF NOT EXISTS (SELECT 1 FROM dbo.lms_certification_domains WHERE domain_name = 'Cloud Computing')
    INSERT INTO dbo.lms_certification_domains (domain_name, is_active, created_at) VALUES ('Cloud Computing', 1, GETDATE());
GO

-- =============================================================================
-- 31. lms_email_logs (Microsoft Graph Email Notification Audit)
-- =============================================================================
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
GO
