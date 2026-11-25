"""
Build Comprehensive Word Document (.docx) for:
Course Purchase Provider & Email License Capacity Architecture:
100% Completion-Gated License Lock Model.

Includes styled headings, callout boxes, executive tables, shaded SQL/code blocks,
and 4 embedded high-resolution Mermaid diagrams.
"""

import os
import shutil
import urllib.request
import zlib
import base64
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def render_diagrams():
    """Renders 4 Mermaid diagrams via Kroki API into PNG files."""
    diag_dir = r"e:\newLMS\LMS\capacity_diagrams"
    os.makedirs(diag_dir, exist_ok=True)

    diags = {
        "diag_1_hierarchy.png": """flowchart TD
    subgraph ProviderLevel ["Provider Level: dbo.CourseProviders"]
        P["Udemy<br/>Max 4 Emails | Max 16 Total Seats<br/>ActiveUsersCount: 7 / 16<br/>CurrentUsersList: JSON Array"]
    end

    subgraph EmailAccounts ["Provider Email Accounts: dbo.CourseProviderAccounts"]
        E1["Account 1: rdivakar0110@outlook.com<br/>Active Learners: 3 / 4<br/>Status: 1 Slot Available"]
        E2["Account 2: elearninghub1@gmail.com<br/>Active Learners: 4 / 4<br/>Status: FULL (Locked)"]
        E3["Account 3: team.azure@emergere.com<br/>Active Learners: 0 / 4<br/>Status: 4 Slots Available"]
        E4["Account 4: udemy.dev@emergere.com<br/>Active Learners: 0 / 4<br/>Status: 4 Slots Available"]
    end

    subgraph LearnersAccount1 ["Locked Learners on Account 1"]
        L1["Learner 1: Imran Khan (EMP019)<br/>Course: AZ-900 | Progress: 45%<br/>Seat: LOCKED"]
        L2["Learner 2: Sneha Patel (EMP024)<br/>Course: Docker | Progress: 80%<br/>Seat: LOCKED"]
        L3["Learner 3: Vikram Malhotra (EMP003)<br/>Course: Kubernetes | Progress: 15%<br/>Seat: LOCKED"]
        L4["Slot 4: [AVAILABLE SEAT]<br/>Ready for next assignment"]
    end

    P --> E1
    P --> E2
    P --> E3
    P --> E4

    E1 --> L1
    E1 --> L2
    E1 --> L3
    E1 --> L4""",

        "diag_2_lifecycle.png": """stateDiagram-v2
    [*] --> Unassigned: Seat Available (0/4)
    Unassigned --> SeatLocked: L&D Assigns Course or Learner Starts
    
    state SeatLocked {
        [*] --> InProgress: progress < 100%
        InProgress --> OfflinePaused: Tab closed / PC turned off / paused
        OfflinePaused --> InProgress: Learner resumes video
    }

    SeatLocked --> MilestoneCompleted: Extension syncs progress = 100%
    
    state MilestoneCompleted {
        [*] --> UpdateDB: dbo.lms_course_enrollments status = 'Completed'
        UpdateDB --> DecrementEmailCount: Decrement ActiveLearnersCount (4 -> 3)
        DecrementEmailCount --> RemoveFromList: Remove employee from CurrentLearnersList
        RemoveFromList --> DecrementProviderCount: Decrement CourseProviders.ActiveUsersCount
    }

    MilestoneCompleted --> Unassigned: Seat liberated for next employee
    SeatLocked --> ForceRevoked: L&D Admin Force Revoke / Unassign
    ForceRevoked --> Unassigned: Seat liberated manually""",

        "diag_3_sequence.png": """sequenceDiagram
    autonumber
    actor Admin as L&D Administrator
    actor Employee as Employee (EMP019)
    participant UI as Course Management / Library
    participant Ext as Browser Extension
    participant API as FastAPI Backend
    participant DB as SQL Server (CourseProviders & Accounts)

    Admin->>UI: Opens AddCourseMaterialModal
    UI->>API: GET /api/course-metadata/providers
    API->>DB: Query providers and email accounts
    DB-->>API: Returns Udemy with 4 accounts & active learners
    API-->>UI: Displays live seats: rdivakar0110@outlook.com (3/4 Seats - Available)
    Admin->>UI: Selects rdivakar0110@outlook.com and purchases course

    Employee->>UI: Clicks Start Course (AZ-900)
    UI->>API: GET /api/extension/check-capacity?email=rdivakar0110@outlook.com
    API->>DB: Check ActiveLearnersCount < 4
    DB-->>API: 3 < 4 (Seat Available)
    API-->>UI: Capacity Approved -> Seat Locked to EMP019 (4/4)

    Employee->>Ext: Watches video (0% -> 45%)
    Ext->>API: Heartbeat sync (Progress: 45%)
    Employee->>Ext: Closes Udemy tab
    Ext->>API: Exit beacon (Progress: 45%)
    API->>DB: Save hours_log=2. Seat REMAINS LOCKED (4/4)

    Employee->>Ext: Resumes later and completes final video (100%)
    Ext->>API: POST /api/extension/sync-learning { progress: 100.0, is_completed: true }
    API->>DB: UPDATE enrollment status='Completed', progress=100.0
    API->>DB: Decrement ActiveLearnersCount (4 -> 3) & remove EMP019
    API->>DB: Decrement CourseProviders.ActiveUsersCount
    API-->>Ext: Return { success: true, seat_liberated: true }
    API-->>Admin: L&D Dashboard reflects liberated seat (3/4)""",

        "diag_4_er.png": """erDiagram
    CourseProviders ||--o{ CourseProviderAccounts : "has up to 4"
    CourseProviders ||--o{ lms_courses : "offers"
    CourseProviderAccounts ||--o{ lms_courses : "binds to"
    lms_courses ||--o{ lms_course_enrollments : "enrolls"

    CourseProviders {
        int ProviderId PK
        nvarchar ProviderName
        int ActiveUsersCount
        nvarchar CurrentUsersList
        int MaxEmails
        int MaxUsersPerEmail
    }

    CourseProviderAccounts {
        int AccountId PK
        int ProviderId FK
        nvarchar AccountEmail
        int MaxActiveLearners
        int ActiveLearnersCount
        nvarchar CurrentLearnersList
    }

    lms_courses {
        int id PK
        varchar course_name
        varchar provider
        varchar course_account_email
    }

    lms_course_enrollments {
        int id PK
        varchar employee_id FK
        int course_id FK
        varchar status
        float progress_percentage
    }"""
    }

    rendered_files = {}
    for filename, code in diags.items():
        out_path = os.path.join(diag_dir, filename)
        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            print(f"Diagram already cached: {out_path}")
            rendered_files[filename] = out_path
            continue

        compressed = zlib.compress(code.encode("utf-8"), 9)
        encoded = base64.urlsafe_b64encode(compressed).decode("ascii")
        url = f"https://kroki.io/mermaid/png/{encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                with open(out_path, "wb") as f:
                    f.write(data)
                print(f"Rendered: {filename} ({len(data)} bytes)")
                rendered_files[filename] = out_path
        except Exception as e:
            print(f"Error rendering {filename}: {e}")
            # Try mermaid.ink fallback
            try:
                b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")
                url2 = f"https://mermaid.ink/img/{b64}"
                req2 = urllib.request.Request(url2, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req2, timeout=15) as resp2:
                    data2 = resp2.read()
                    with open(out_path, "wb") as f2:
                        f2.write(data2)
                    print(f"Rendered via fallback: {filename} ({len(data2)} bytes)")
                    rendered_files[filename] = out_path
            except Exception as e2:
                print(f"Fallback also failed for {filename}: {e2}")

    return rendered_files

# --- Document Styler Helpers ---
def set_cell_background(cell, fill_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tc_pr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tc_pr.append(tc_mar)

def set_cell_borders(cell, color="CBD5E1", sz="4", val="single"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        </w:tcBorders>
    ''')
    tc_pr.append(borders)

def add_callout(doc, text, title="BUSINESS RULE", border_color="2563EB", fill_color="EFF6FF"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    set_cell_background(cell, fill_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:top w:val="none"/>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>
            <w:bottom w:val="none"/>
            <w:right w:val="none"/>
        </w:tcBorders>
    ''')
    tc_pr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    run_title = p.add_run(f"🔒 {title}: ")
    run_title.bold = True
    run_title.font.name = "Segoe UI"
    run_title.font.size = Pt(10)
    run_title.font.color.rgb = RGBColor(30, 58, 138)
    
    run_body = p.add_run(text)
    run_body.font.name = "Segoe UI"
    run_body.font.size = Pt(9.5)
    run_body.font.color.rgb = RGBColor(30, 41, 59)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_code_block(doc, code_str):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    set_cell_background(cell, "0F172A")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    set_cell_borders(cell, color="334155", sz="8")
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.1
    
    run = p.add_run(code_str.strip())
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(226, 232, 240)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_figure(doc, img_path, caption_text, width_inches=6.2):
    if os.path.exists(img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run_img = p_img.add_run()
        run_img.add_picture(img_path, width=Inches(width_inches))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(2)
        p_cap.paragraph_format.space_after = Pt(12)
        run_cap = p_cap.add_run(caption_text)
        run_cap.italic = True
        run_cap.font.name = "Segoe UI"
        run_cap.font.size = Pt(9)
        run_cap.font.color.rgb = RGBColor(100, 116, 139)

def format_table(table, col_widths, headers, rows_data):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    hdr_cells = table.rows[0].cells
    for i, h_text in enumerate(headers):
        hdr_cells[i].text = h_text
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], "0F172A")
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=150, right=150)
        set_cell_borders(hdr_cells[i], color="334155")
        
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        for r in p.runs:
            r.font.name = "Segoe UI"
            r.font.size = Pt(9.5)
            r.font.bold = True
            r.font.color.rgb = RGBColor(255, 255, 255)
            
    for r_idx, row_values in enumerate(rows_data):
        row = table.add_row()
        fill_color = "F8FAFC" if (r_idx % 2 == 1) else "FFFFFF"
        for c_idx, val in enumerate(row_values):
            cell = row.cells[c_idx]
            cell.text = str(val)
            cell.width = col_widths[c_idx]
            set_cell_background(cell, fill_color)
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            set_cell_borders(cell, color="E2E8F0")
            
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            for r in p.runs:
                r.font.name = "Segoe UI"
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(30, 41, 59)


def generate_word_document():
    images = render_diagrams()
    doc = Document()

    for s in doc.sections:
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.0)
        s.right_margin = Inches(1.0)

    NAVY = RGBColor(15, 23, 42)
    BLUE = RGBColor(37, 99, 235)
    SLATE = RGBColor(71, 85, 105)
    BODY_COLOR = RGBColor(30, 41, 59)

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.name = "Segoe UI"
        r.font.size = Pt(15)
        r.font.bold = True
        r.font.color.rgb = NAVY
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(13)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.name = "Segoe UI"
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = BLUE
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(9)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.name = "Segoe UI"
        r.font.size = Pt(10.5)
        r.font.bold = True
        r.font.color.rgb = SLATE
        return p

    def add_body(text, bold_prefix=""):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.2
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.name = "Segoe UI"
            r_pre.font.size = Pt(9.5)
            r_pre.font.bold = True
            r_pre.font.color.rgb = BODY_COLOR
        r = p.add_run(text)
        r.font.name = "Segoe UI"
        r.font.size = Pt(9.5)
        r.font.color.rgb = BODY_COLOR
        return p

    def add_bullet(text, bold_prefix=""):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.2
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.name = "Segoe UI"
            r_pre.font.size = Pt(9.5)
            r_pre.font.bold = True
            r_pre.font.color.rgb = BODY_COLOR
        r = p.add_run(text)
        r.font.name = "Segoe UI"
        r.font.size = Pt(9.5)
        r.font.color.rgb = BODY_COLOR
        return p

    # --- TITLE HEADER ---
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(10)
    title_p.paragraph_format.space_after = Pt(2)
    r_title = title_p.add_run("Course Purchase Provider & Email License Capacity Architecture")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = NAVY

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(6)
    r_sub = sub_p.add_run("100% Completion-Gated License Lock Model (1 Provider -> 4 Emails -> 4 Active Learners)")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = BLUE

    meta_p = doc.add_paragraph()
    meta_p.paragraph_format.space_before = Pt(0)
    meta_p.paragraph_format.space_after = Pt(14)
    r_meta = meta_p.add_run("Project: Emergere LMS  |  Module: L&D Course Management & Browser Extension  |  Target: SQL Server 2008 R2")
    r_meta.font.name = "Segoe UI"
    r_meta.font.size = Pt(9)
    r_meta.font.color.rgb = SLATE

    div_p = doc.add_paragraph()
    div_p.paragraph_format.space_before = Pt(0)
    div_p.paragraph_format.space_after = Pt(14)
    r_div = div_p.add_run("―" * 60)
    r_div.font.color.rgb = RGBColor(203, 213, 225)

    # --- SECTION 1 ---
    add_h1("1. Executive Summary & Core Business Rule")
    add_body(
        "In Emergere LMS, external learning providers (such as Udemy, Coursera, and AWS Training) are purchased through "
        "corporate email accounts. To prevent exceeding vendor concurrent seat agreements while guaranteeing that employees have "
        "dedicated study access, this architecture enforces the 100% Completion-Gated License Lock Model."
    )

    add_callout(
        doc,
        "An active employee assigned to a course under a provider corporate email locks 1 learner seat. "
        "Closing the browser tab, shutting down the computer, or pausing the video DOES NOT release the seat. "
        "The seat remains locked 24/7 until the employee reaches 100% learning hours progress (status = 'Completed'). "
        "ONLY upon 100% completion is the seat liberated back to the pool, allowing the next employee to begin.",
        title="THE 100% COMPLETION-GATED LICENSE LOCK RULE"
    )

    add_bullet(" Each external Course Provider (e.g. Udemy) can register up to 4 distinct corporate email accounts (e.g. rdivakar0110@outlook.com, elearninghub1@gmail.com).", "1. Multi-Email Provider Tier:")
    add_bullet(" Each corporate email account can hold up to 4 concurrent active learners.", "2. Strict Concurrency Ceiling:")
    add_bullet(" Total maximum concurrent learning capacity for any single provider = 4 emails × 4 learners = 16 concurrent learners.", "3. Total Provider Capacity:")
    add_bullet(" Once an employee takes a seat (1 of 4), their license reservation persists across days and weeks until 100% completion is achieved.", "4. Persistent License Reservation:")

    # --- SECTION 2 ---
    add_h1("2. Two-Tier Hierarchy Architecture")
    add_body(
        "The system decouples the high-level platform provider (Udemy) from the specific shared login mailboxes (Accounts), "
        "allowing granular seat tracking without conflating multiple corporate mailboxes."
    )

    add_figure(
        doc,
        r"e:\newLMS\LMS\capacity_diagrams\diag_1_hierarchy.png",
        "Figure 1: Two-Tier License Hierarchy — Provider Aggregates (16 Max) -> 4 Email Accounts -> 4 Active Learners Each",
        width_inches=6.2
    )

    # --- SECTION 3 ---
    add_h1("3. Database Schema Migration Plan")
    add_body("To implement this architecture in SQL Server 2008 R2, we update dbo.CourseProviders and add dbo.CourseProviderAccounts.")

    add_h2("3.1. Entity-Relationship (ER) Overview")
    add_figure(
        doc,
        r"e:\newLMS\LMS\capacity_diagrams\diag_4_er.png",
        "Figure 2: Entity-Relationship Diagram linking CourseProviders, CourseProviderAccounts, Courses, and Enrollments",
        width_inches=5.8
    )

    add_h2("3.2. Columns Added to Existing dbo.CourseProviders")
    prov_table = doc.add_table(rows=1, cols=3)
    p_widths = [Inches(1.8), Inches(1.2), Inches(3.5)]
    p_headers = ["Column Name", "Data Type", "Role & Description"]
    p_rows = [
        ["ActiveUsersCount", "INT DEFAULT 0", "Total active learners with < 100% progress across all 4 email accounts for this provider."],
        ["CurrentUsersList", "NVARCHAR(MAX) DEFAULT '[]'", "Denormalized JSON array of all active learners currently locking seats on this provider."],
        ["MaxEmails", "INT DEFAULT 4", "Ceiling of distinct email accounts allowed per provider (default 4)."],
        ["MaxUsersPerEmail", "INT DEFAULT 4", "Ceiling of concurrent learners allowed per email (default 4)."]
    ]
    format_table(prov_table, p_widths, p_headers, p_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_h2("3.3. New Child Table: dbo.CourseProviderAccounts")
    add_body("Stores each of the up to 4 corporate email accounts belonging to a provider:")
    add_code_block(doc, """CREATE TABLE dbo.CourseProviderAccounts (
    AccountId            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ProviderId           INT NOT NULL,                           -- Foreign Key to dbo.CourseProviders
    ProviderName         NVARCHAR(150) NOT NULL,                 -- e.g. 'Udemy'
    AccountEmail         NVARCHAR(255) NOT NULL,                 -- e.g. 'rdivakar0110@outlook.com'
    MaxActiveLearners    INT NOT NULL DEFAULT 4,                 -- Max 4 learners per email
    ActiveLearnersCount  INT NOT NULL DEFAULT 0,                 -- Current locked learners (< 100%)
    CurrentLearnersList  NVARCHAR(MAX) NULL DEFAULT '[]',        -- JSON: [{"id":"EMP019","name":"Imran Khan","progress":45.0}]
    IsActive             BIT NOT NULL DEFAULT 1,
    CreatedAt            DATETIME2 DEFAULT GETDATE(),

    CONSTRAINT UQ_Provider_AccountEmail UNIQUE (ProviderId, AccountEmail),
    CONSTRAINT FK_CourseProviderAccounts_Provider 
        FOREIGN KEY (ProviderId) REFERENCES dbo.CourseProviders(ProviderId) ON DELETE CASCADE
);
CREATE INDEX IX_ProviderAccounts_ProviderId ON dbo.CourseProviderAccounts(ProviderId);""")

    # --- SECTION 4 ---
    add_h1("4. Seat Lifecycle & State Machine")
    add_body(
        "A seat is locked upon course assignment or first video start. The state machine enforces that exiting "
        "or closing the browser preserves the lock, and only a verified 100% milestone triggers liberation."
    )

    add_figure(
        doc,
        r"e:\newLMS\LMS\capacity_diagrams\diag_2_lifecycle.png",
        "Figure 3: State Machine — Seat Reservation, Tab Closure Retention, and 100% Completion Liberation",
        width_inches=6.0
    )

    add_h2("4.1. Lifecycle State Definitions")
    life_table = doc.add_table(rows=1, cols=3)
    l_widths = [Inches(1.5), Inches(1.3), Inches(3.7)]
    l_headers = ["State", "Trigger Condition", "License Capacity Impact"]
    l_rows = [
        ["Unassigned", "Seat available (0/4)", "Slot is open for assignment. Any employee can take this seat."],
        ["Seat Locked", "L&D assigns or learner starts", "Seat is BOUND to employee. ActiveLearnersCount increments (e.g. 2 -> 3)."],
        ["Offline / Paused", "Tab closed or PC shutdown", "NO CHANGE in seat count. Seat remains reserved. Others cannot claim it."],
        ["100% Milestone", "Progress reaches 100.0%", "SEAT LIBERATED. ActiveLearnersCount decrements (3 -> 2). Slot freed."],
        ["Admin Force Revoke", "L&D manual unassignment", "ADMIN OVERRIDE. Manually frees seat if employee leaves company."]
    ]
    format_table(life_table, l_widths, l_headers, l_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # --- SECTION 5 ---
    add_h1("5. End-to-End System Workflow Sequence")
    add_body("The complete interaction flow across L&D Administrator, Employee, Browser Extension, Backend, and Database:")

    add_figure(
        doc,
        r"e:\newLMS\LMS\capacity_diagrams\diag_3_sequence.png",
        "Figure 4: Sequence Diagram — Course Purchase -> Extension Launch -> Watch Heartbeats -> 100% Milestone Sync",
        width_inches=6.2
    )

    add_h2("5.1. Workflow Step Breakdown")
    add_bullet(" L&D selects Provider (Udemy) in AddCourseMaterialModal. The modal queries /api/course-metadata/providers and lists the 4 email accounts with live capacity badges (e.g. 3/4 Seats - Available vs 4/4 Seats - FULL).", "Phase A — Purchase & Account Binding:")
    add_bullet(" When employee clicks 'Start Course', extension checks /api/extension/check-capacity. If < 4 active learners, seat is locked to employee. If 4/4, user is alerted that all seats are in use by colleagues.", "Phase B — Pre-Flight Concurrency Check:")
    add_bullet(" Extension sends heartbeats every 30s. Closing the tab saves hours_log but retains the seat lock.", "Phase C — Study Tracking & Tab Close:")
    add_bullet(" Upon reaching the final lecture, extension sends progress_percentage=100.0. Backend transitions enrollment to 'Completed', decrements ActiveLearnersCount (4 -> 3), and updates the provider aggregate.", "Phase D — 100% Completion Milestone:")

    # --- SECTION 6 ---
    add_h1("6. Backend Implementation Specifications")
    add_body(
        "A dedicated ProviderCapacityService manages license reservations, capacity checks, and automated liberation upon 100% completion."
    )

    add_h2("6.1. Core Service Implementation (provider_capacity_service.py)")
    add_code_block(doc, """class ProviderCapacityService:
    def check_and_lock_seat(self, provider_name: str, account_email: str, employee_id: str, course_id: int):
        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Check if employee already holds a locked seat on this course
            cursor.execute('''
                SELECT status, progress_percentage FROM dbo.lms_course_enrollments
                WHERE UPPER(RTRIM(LTRIM(employee_id))) = ? AND course_id = ?
            ''', (employee_id.upper(), course_id))
            row = cursor.fetchone()
            if row and row[0] != 'Completed' and (row[1] is None or row[1] < 100.0):
                return {"allowed": True, "reason": "Seat already locked by you"}

            # 2. Check current locked seats (< 100% progress) on this email account
            cursor.execute('''
                SELECT COUNT(DISTINCT e.employee_id)
                FROM dbo.lms_course_enrollments e
                JOIN dbo.lms_courses c ON c.id = e.course_id
                WHERE LOWER(RTRIM(LTRIM(c.course_account_email))) = LOWER(RTRIM(LTRIM(?)))
                  AND e.status != 'Completed'
                  AND (e.progress_percentage IS NULL OR e.progress_percentage < 100.0)
            ''', (account_email,))
            active_count = cursor.fetchone()[0] or 0

            if active_count >= 4:
                return {
                    "allowed": False,
                    "reason": f"All 4 learner seats on {account_email} are currently locked by colleagues. Available once a learner reaches 100%."
                }

            return {"allowed": True, "active_count": active_count}
        finally:
            conn.close()

    def handle_progress_sync(self, employee_id: str, course_id: int, progress: float, is_completed: bool):
        # Called inside learning_sync_service.py
        if is_completed or progress >= 100.0:
            self.liberate_seat(employee_id, course_id)""")

    add_h2("6.2. REST Endpoints Contract")
    api_table = doc.add_table(rows=1, cols=3)
    a_widths = [Inches(2.0), Inches(0.8), Inches(3.7)]
    a_headers = ["Endpoint", "Method", "Role & Description"]
    a_rows = [
        ["/api/course-metadata/providers", "GET", "Returns providers with total active users and their 4 email accounts with current learners."],
        ["/api/course-metadata/providers/{id}/accounts", "POST", "Allows L&D to register up to 4 corporate emails under a provider."],
        ["/api/extension/check-capacity", "GET", "Pre-flight check verifying if target email account has < 4 locked learners."],
        ["/api/extension/sync-learning", "POST", "Ingests watch progress; if 100% reached, triggers automated seat liberation."],
        ["/api/ld/revoke-seat", "POST", "Admin endpoint allowing L&D to force-unassign an employee and free a seat."]
    ]
    format_table(api_table, a_widths, a_headers, a_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # --- SECTION 7 ---
    add_h1("7. Frontend UI / UX Enhancements")
    add_body("Enhancements in L&D Course Management (AddCourseMaterialModal.jsx & PurchaseCourseTab.jsx):")
    add_bullet(" Displays live capacity next to each email: 'rdivakar0110@outlook.com (3 / 4 Seats Locked — 1 Available)'. If 4/4 seats are locked, the email is marked with a red chip 'FULL (At Capacity)'.", "1. Dynamic Capacity Chip:")
    add_bullet(" Hovering over the email chip displays a popover listing the currently locked learners, their active course, and their current progress (e.g. 'Imran Khan — 45%').", "2. Locked Learners Tooltip:")
    add_bullet(" If fewer than 4 emails exist, an inline '+ Add Corporate Email' option allows L&D to register another mailbox on the fly.", "3. Quick Email Registration:")

    # --- SECTION 8 ---
    add_h1("8. Implementation Roadmap & Verification Checklist")
    road_table = doc.add_table(rows=1, cols=4)
    r_widths = [Inches(0.9), Inches(1.8), Inches(2.6), Inches(1.2)]
    r_headers = ["Phase", "Task Name", "Detailed Deliverable", "Target Component"]
    r_rows = [
        ["Phase 1", "Database Migration", "Add columns to CourseProviders & create CourseProviderAccounts in connection.py.", "SQL Server"],
        ["Phase 2", "Capacity Service", "Build ProviderCapacityService with lock and 100% liberation logic.", "FastAPI Backend"],
        ["Phase 3", "Extension Hook", "Connect /api/extension/sync-learning to liberate seat when progress = 100%.", "Extension Sync"],
        ["Phase 4", "Metadata Endpoints", "Expose accounts and learner details in /api/course-metadata/providers.", "Metadata API"],
        ["Phase 5", "Frontend Integration", "Render live seat badges in AddCourseMaterialModal and CourseManagement.", "React Frontend"]
    ]
    format_table(road_table, r_widths, r_headers, r_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # Footer
    foot_p = doc.add_paragraph()
    foot_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_foot = foot_p.add_run("― End of Architecture Implementation Plan ―\nEmergere LMS Engineering Team")
    r_foot.font.name = "Segoe UI"
    r_foot.font.size = Pt(9)
    r_foot.font.italic = True
    r_foot.font.color.rgb = SLATE

    # Save
    out_project = r"e:\newLMS\LMS\Course_Purchase_Provider_License_Capacity_Implementation_Plan.docx"
    out_brain = r"C:\Users\rdiva\.gemini\antigravity\brain\0c801a44-6f4b-47b3-b64d-2a7d46eb4cdb\Course_Purchase_Provider_License_Capacity_Implementation_Plan.docx"

    doc.save(out_project)
    print(f"Document saved to project: {out_project}")
    shutil.copyfile(out_project, out_brain)
    print(f"Document copied to brain: {out_brain}")

if __name__ == "__main__":
    generate_word_document()
