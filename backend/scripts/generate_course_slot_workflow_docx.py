import os
import shutil
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def create_workflow_docx(output_path):
    doc = Document()

    # Set Margins (0.75 in)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Corporate Color Palette
    PRIMARY = RGBColor(26, 54, 93)       # Deep Corporate Navy #1A365D
    SECONDARY = RGBColor(13, 148, 136)   # Modern Teal #0D9488
    DARK_NEUTRAL = RGBColor(51, 65, 85)  # Slate #334155
    LIGHT_BG = "F1F5F9"                  # Slate 100
    HIGHLIGHT_BG = "EFF6FF"              # Blue 50
    ACCENT_BORDER = "3B82F6"             # Blue 500
    SUCCESS_COLOR = RGBColor(21, 128, 61) # Forest Green #15803D

    def style_heading(p, text, level=1):
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = "Arial"
        if level == 1:
            run.font.size = Pt(17)
            run.font.color.rgb = PRIMARY
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
        elif level == 2:
            run.font.size = Pt(13)
            run.font.color.rgb = SECONDARY
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
        elif level == 3:
            run.font.size = Pt(10.5)
            run.font.color.rgb = PRIMARY
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
        return p

    def add_body_p(text="", bold_prefix="", italic=False):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            b_run = p.add_run(bold_prefix)
            b_run.bold = True
            b_run.font.name = "Arial"
            b_run.font.size = Pt(9.5)
            b_run.font.color.rgb = PRIMARY
        if text:
            r = p.add_run(text)
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            r.font.color.rgb = DARK_NEUTRAL
            r.italic = italic
        return p

    def add_bullet_p(bold_prefix, text):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        b_run = p.add_run(bold_prefix)
        b_run.bold = True
        b_run.font.name = "Arial"
        b_run.font.size = Pt(9.5)
        b_run.font.color.rgb = PRIMARY
        r = p.add_run(text)
        r.font.name = "Arial"
        r.font.size = Pt(9.5)
        r.font.color.rgb = DARK_NEUTRAL
        return p

    def add_callout(title, text, is_success=False):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        cell = tbl.rows[0].cells[0]
        cell.width = Inches(7.0)

        tcPr = cell._tc.get_or_add_tcPr()
        bg_col = "F0FDF4" if is_success else HIGHLIGHT_BG
        border_col = "22C55E" if is_success else ACCENT_BORDER
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg_col}"/>')
        tcPr.append(shd)

        borders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="none"/>'
            f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_col}"/>'
            f'<w:bottom w:val="none"/>'
            f'<w:right w:val="none"/>'
            f'</w:tcBorders>'
        )
        tcPr.append(borders)

        cp = cell.paragraphs[0]
        cp.paragraph_format.space_before = Pt(4)
        cp.paragraph_format.space_after = Pt(2)
        r_title = cp.add_run(title)
        r_title.bold = True
        r_title.font.name = "Arial"
        r_title.font.size = Pt(10)
        r_title.font.color.rgb = SUCCESS_COLOR if is_success else PRIMARY

        cp2 = cell.add_paragraph()
        cp2.paragraph_format.space_before = Pt(2)
        cp2.paragraph_format.space_after = Pt(4)
        r_text = cp2.add_run(text)
        r_text.font.name = "Arial"
        r_text.font.size = Pt(9)
        r_text.font.color.rgb = DARK_NEUTRAL

        p_after = doc.add_paragraph()
        p_after.paragraph_format.space_before = Pt(2)
        p_after.paragraph_format.space_after = Pt(2)

    def add_diagram_image(image_path, caption=""):
        if os.path.exists(image_path):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run()
            run.add_picture(image_path, width=Inches(6.8))

            if caption:
                cap_p = doc.add_paragraph()
                cap_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                cap_p.paragraph_format.space_before = Pt(2)
                cap_p.paragraph_format.space_after = Pt(8)
                cap_run = cap_p.add_run(caption)
                cap_run.font.name = "Arial"
                cap_run.font.size = Pt(8.5)
                cap_run.font.color.rgb = SECONDARY
                cap_run.italic = True
        else:
            add_callout("Diagram Placeholder", f"Image file not found at: {image_path}")

    def format_table(table, col_widths, headers, data):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False

        # Header Row
        hdr_row = table.rows[0]
        trPr = hdr_row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

        for i, h_text in enumerate(headers):
            cell = hdr_row.cells[i]
            cell.width = Inches(col_widths[i])
            tcPr = cell._tc.get_or_add_tcPr()
            tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="1E3A8A"/>'))
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(h_text)
            run.bold = True
            run.font.name = "Arial"
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(255, 255, 255)

        # Data Rows
        for r_idx, row_data in enumerate(data):
            row = table.add_row()
            bg_color = "FFFFFF" if r_idx % 2 == 0 else LIGHT_BG
            for c_idx, val in enumerate(row_data):
                cell = row.cells[c_idx]
                cell.width = Inches(col_widths[c_idx])
                tcPr = cell._tc.get_or_add_tcPr()
                tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg_color}"/>'))
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(3.5)
                p.paragraph_format.space_after = Pt(3.5)
                run = p.add_run(str(val))
                run.font.name = "Arial"
                run.font.size = Pt(8.5)
                run.font.color.rgb = DARK_NEUTRAL

        # Subtle Table Borders
        for row in table.rows:
            for cell in row.cells:
                tcPr = cell._tc.get_or_add_tcPr()
                tcBorders = parse_xml(
                    f'<w:tcBorders {nsdecls("w")}>'
                    f'<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
                    f'<w:left w:val="none"/>'
                    f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
                    f'<w:right w:val="none"/>'
                    f'</w:tcBorders>'
                )
                tcPr.append(tcBorders)

    # -------------------------------------------------------------
    # DOCUMENT COVER / TITLE
    # -------------------------------------------------------------
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(20)
    title_p.paragraph_format.space_after = Pt(4)
    t_run = title_p.add_run("EMERGERE LMS TECHNICAL SPECIFICATION")
    t_run.bold = True
    t_run.font.name = "Arial"
    t_run.font.size = Pt(11)
    t_run.font.color.rgb = SECONDARY

    h1_p = doc.add_paragraph()
    h1_p.paragraph_format.space_before = Pt(0)
    h1_p.paragraph_format.space_after = Pt(6)
    h1_run = h1_p.add_run("Course Purchase Provider License & Email Slot Workflow")
    h1_run.bold = True
    h1_run.font.name = "Arial"
    h1_run.font.size = Pt(22)
    h1_run.font.color.rgb = PRIMARY

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(14)
    sub_run = sub_p.add_run("Model B Architecture Standard: Independent (Email + Provider) Concurrency Scoping, Junction Table Relational Design, Level 0/1/2 DFDs, and 100% Completion Gating")
    sub_run.font.name = "Arial"
    sub_run.font.size = Pt(10.5)
    sub_run.font.color.rgb = DARK_NEUTRAL

    # Metadata Banner
    meta_tbl = doc.add_table(rows=1, cols=4)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_widths = [1.75, 1.75, 1.75, 1.75]
    meta_data = [
        ("Architecture Model", "Model B (Platform Scoped)"),
        ("System Target", "Emergere LMS Platform"),
        ("Database Engine", "MS SQL Server 2008 R2 / 2019+"),
        ("Date", "November 2026")
    ]
    for i, (label, val) in enumerate(meta_data):
        cell = meta_tbl.rows[0].cells[i]
        cell.width = Inches(meta_widths[i])
        tcPr = cell._tc.get_or_add_tcPr()
        tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{LIGHT_BG}"/>'))
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(3)
        lbl_r = p.add_run(f"{label}\n")
        lbl_r.bold = True
        lbl_r.font.name = "Arial"
        lbl_r.font.size = Pt(8.5)
        lbl_r.font.color.rgb = SECONDARY
        val_r = p.add_run(val)
        val_r.font.name = "Arial"
        val_r.font.size = Pt(9.5)
        val_r.font.color.rgb = DARK_NEUTRAL

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # -------------------------------------------------------------
    # 1. THE HUMAN STORY: MODEL B IN THE REAL WORLD
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "1. The Human Story: Model B in the Real World", level=1)

    add_body_p(
        "Under the confirmed Model B architecture standard, an enterprise purchases external training licenses across multiple platforms "
        "(e.g., Udemy, Coursera, LinkedIn Learning, edX) using corporate learning mailboxes (such as elearning1@gmail.com, elearning2@gmail.com). "
        "Crucially, each unique (Email + Provider) mapping operates as an independent four-seat concurrency pool."
    )

    add_callout(
        "The Operational Scenario at Emergere Technologies",
        "Your Learning & Development (L&D) team registers elearning1@gmail.com and links it to both Udemy and Coursera. "
        "Because Udemy and Coursera run on completely separate websites and authentication servers, your company enjoys:\n"
        "• Up to 4 active learners on Udemy simultaneously (e.g., Imran, Sarah, Dave, + 1 open seat).\n"
        "• Up to 4 active learners on Coursera simultaneously (e.g., Michael, Priya, + 2 open seats).\n"
        "• Total Capacity = 8 Concurrent Learners across that single corporate email mailbox!",
        is_success=True
    )

    add_body_p(
        "Here is the day-to-day human journey of L&D administrators and learners under Model B:",
        bold_prefix="The Daily Flow: "
    )

    add_bullet_p(
        "Step 1: Account Mapping & Course Ingestion — ",
        "L&D purchases courses on Udemy (e.g., 'Mastering Python', 'Docker for DevOps') and on Coursera (e.g., 'Google Cloud Architect') "
        "under elearning1@gmail.com. In the LMS, the system creates two EmailProviders junction records: EmailProviderId 1 (elearning1 + Udemy, 4 slots) "
        "and EmailProviderId 2 (elearning1 + Coursera, 4 slots)."
    )

    add_bullet_p(
        "Step 2: Cascading Course Selection — ",
        "When assigning an employee, the L&D manager selects elearning1@gmail.com. The LMS instantly resolves all linked providers (Udemy, Coursera). "
        "Selecting Udemy resolves EmailProviderId 1 and displays the 3 Udemy courses alongside its live platform capacity badge: 'Udemy Capacity: 3/4 Occupied | 1 Slot Open'."
    )

    add_bullet_p(
        "Step 3: Independent Seat Assignment — ",
        "New engineer Alex is assigned the open 4th Udemy slot. Meanwhile, Michael Chen is actively studying on Coursera. "
        "Alex's assignment on Udemy does not consume or affect Coursera's capacity!"
    )

    add_bullet_p(
        "Step 4: The 100% Progress Gatekeeper (Strict Enforcement) — ",
        "Learners are locked into their seats until verified progress reaches exactly 100%. If Imran has completed 65% of his Udemy course, "
        "he cannot logout or be unassigned. The exact moment Michael Chen hits 100% on Coursera, his Coursera seat is automatically recycled to Available, "
        "leaving Udemy seats locked and unaffected."
    )

    # -------------------------------------------------------------
    # 2. RELATIONAL HIERARCHY & JUNCTION ARCHITECTURE
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "2. Relational Hierarchy: Email × Provider → EmailProviders → Courses → Slots", level=1)

    add_body_p(
        "Model B organizes the enterprise learning catalog into a clean relational hierarchy centered on the dbo.EmailProviders junction entity. "
        "Each mapping represents one active account integration on an external provider website, hosting purchased courses and managing an independent 4-seat pool:"
    )

    add_body_p(
        "Corporate Learning Mailbox (e.g. elearning1@gmail.com)\n"
        "   ├── EmailProviders Mapping #1: [elearning1@gmail.com + Udemy] (MaxSlots = 4)\n"
        "   │     ├── Purchased Course: Mastering Python [Course #101]\n"
        "   │     ├── Purchased Course: Docker for DevOps [Course #102]\n"
        "   │     └── Concurrency Pool (4 Slots): S1: Imran (65% Locked), S2: Sarah (82% Locked), S3: Dave (30% Locked), S4: [OPEN]\n"
        "   └── EmailProviders Mapping #2: [elearning1@gmail.com + Coursera] (MaxSlots = 4)\n"
        "         ├── Purchased Course: Google Cloud Architect [Course #201]\n"
        "         └── Concurrency Pool (4 Slots): S1: Michael (100% Released), S2: Priya (15% Locked), S3: [OPEN], S4: [OPEN]",
        bold_prefix="Hierarchy Blueprint (Model B):\n",
        italic=True
    )

    add_body_p(
        "This relational structure is implemented across five core tables in SQL Server:",
        bold_prefix="Table Interrelation: "
    )

    t_headers = ["Table Name", "Role in Hierarchy", "Primary Key", "Foreign Key Connections"]
    t_widths = [1.7, 1.8, 1.4, 2.1]
    t_data = [
        ["CourseEmails", "Master Account Hub (Corporate Email)", "CourseEmailId (INT)", "Referenced by EmailProviders.CourseEmailId"],
        ["CourseProviders", "Platform Registry (Udemy, Coursera)", "ProviderId (INT)", "Referenced by EmailProviders.ProviderId"],
        ["EmailProviders (Model B)", "Platform Account Integration & Concurrency Hub", "EmailProviderId (INT)", "FK -> CourseEmails, CourseProviders; Referenced by lms_active_slots, lms_courses"],
        ["lms_courses", "Purchased Course Catalog", "id (INT)", "FK -> EmailProviders.EmailProviderId (and direct provider/email FKs)"],
        ["lms_active_slots (Model B)", "Independent 4-Seat Concurrency Engine", "slot_id (INT)", "FK -> EmailProviders.EmailProviderId, course_id, employee_id"],
        ["lms_course_enrollments", "Learner Progress & Study Hours Log", "id (INT)", "FK -> lms_courses.id, lms_employee_profiles"]
    ]
    format_table(doc.add_table(rows=1, cols=4), t_widths, t_headers, t_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # -------------------------------------------------------------
    # 3. END-TO-END DATA FLOW DIAGRAMS (LEVEL 0, LEVEL 1, LEVEL 2)
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "3. End-to-End Data Flow Diagrams (DFD Architecture)", level=1)

    add_body_p(
        "This section illustrates the complete Data Flow Diagram (DFD) hierarchy reflecting the confirmed Model B standard: "
        "Context Boundary (Level 0), System-Wide Processes and Persistent Stores (Level 1), and Operational Deep-Dives (Level 2.1 & 2.2)."
    )

    # 3.1 LEVEL 0 CONTEXT DIAGRAM
    style_heading(doc.add_paragraph(), "3.1 Level 0: Context Data Flow Diagram (System Boundary)", level=2)
    add_body_p(
        "The Level 0 Context Diagram establishes the operational boundary of the LMS Course Access & Concurrency Management Subsystem, "
        "tracking all data exchanged with external stakeholders and third-party platform providers:"
    )
    add_bullet_p("L&D Administrator: ", "Creates email-provider mappings, procures courses, and monitors platform-specific 4-seat capacity badges.")
    add_bullet_p("Employee / Learner: ", "Requests courses and receives authenticated session credentials allocated from the platform's open slot pool.")
    add_bullet_p("LMS Browser Extension: ", "Transmits high-frequency video duration heartbeats and enforces the anti-logout lockdown while progress is under 100%.")
    add_bullet_p("Course Provider Platforms: ", "Third-party servers (Udemy, Coursera, AWS, edX) that stream curriculum video and authenticate browser sessions.")

    add_diagram_image(
        "backend/scripts/diagrams/dfd_level_0_context.png",
        "Figure 1: Level 0 Context Data Flow Diagram (Model B) — External Entities, System Boundary, and High-Level Exchanges"
    )

    # 3.2 LEVEL 1 DETAILED SYSTEM-WIDE DFD
    style_heading(doc.add_paragraph(), "3.2 Level 1: System-Wide Detailed Data Flow Diagram", level=2)
    add_body_p(
        "The Level 1 diagram decomposes the system into 5 functional processes and 6 persistent database stores, featuring the central "
        "dbo.EmailProviders junction entity that scopes course catalogs and concurrency pools:"
    )
    add_bullet_p("Process 1.0 (Mapping & Course Ingestion): ", "Creates EmailProviders junction records and initializes exactly 4 available slot records for each unique EmailProviderId.")
    add_bullet_p("Process 2.0 (Cascading Filter & Catalog Engine): ", "Resolves EmailProviders mappings to dynamically populate provider dropdowns and compute real-time occupancy counts (e.g., 3/4 Udemy Slots Occupied).")
    add_bullet_p("Process 3.0 (4-Seat Concurrency & Allocator): ", "Uses SQL Server row locks (UPDLOCK) scoped to EmailProviderId to reserve open seats without race conditions.")
    add_bullet_p("Process 4.0 (Telemetry & Progress Tracker): ", "Ingests watch duration pings from the extension, writing live progress to both enrollments (D6) and active slots (D5).")
    add_bullet_p("Process 5.0 (100% Progress Gatekeeper & Release): ", "Blocks logouts when < 100%, and automatically frees the platform seat when progress reaches exactly 100.00%.")

    add_diagram_image(
        "backend/scripts/diagrams/dfd_level_1_detailed.png",
        "Figure 2: Level 1 System-Wide Detailed DFD (Model B) — 5 Core Processes, 6 Persistent Data Stores, and EmailProviders Junction Architecture"
    )

    # 3.3 LEVEL 2.1 CASCADING FILTER DFD
    style_heading(doc.add_paragraph(), "3.3 Level 2.1: Cascading Filter & Catalog Engine (Deep-Dive)", level=2)
    add_body_p(
        "This Level 2 deep-dive details the three-step data resolution pipeline executed in the UI and backend when browsing courses:"
    )
    add_bullet_p("Sub-Process 2.1 (Email-to-Provider Resolver): ", "Takes selected CourseEmailId and queries dbo.EmailProviders to return only the platform providers linked to that mailbox.")
    add_bullet_p("Sub-Process 2.2 (Catalog Resolver by EmailProviderId): ", "Takes both email and provider to resolve the unique EmailProviderId, fetching only the courses belonging to that platform mapping.")
    add_bullet_p("Sub-Process 2.3 (Platform Slot Badge Aggregator): ", "Counts occupied slots in dbo.lms_active_slots for that specific EmailProviderId, outputting the platform-scoped capacity badge (e.g., 'Udemy: 3/4 Occupied | 1 Open').")

    add_diagram_image(
        "backend/scripts/diagrams/dfd_level_2_cascade.png",
        "Figure 3: Level 2.1 Cascading Filter DFD (Model B) — Sequential Pipeline from Mailbox Selection to Platform-Specific Capacity Badges"
    )

    # 3.4 LEVEL 2.2 100% PROGRESS GATEKEEPER DFD
    style_heading(doc.add_paragraph(), "3.4 Level 2.2: 100% Progress Gatekeeper & Auto Seat Recovery (Deep-Dive)", level=2)
    add_body_p(
        "This Level 2 diagram specifies the real-time gating decision logic enforced on each platform seat:"
    )
    add_bullet_p("Strict Lockdown State (< 100.00%): ", "The extension and backend intercept any logout, disconnect, or unassign request. The learner remains locked in their seat until all curriculum requirements are satisfied.")
    add_bullet_p("Instant Automated Seat Recovery (== 100.00%): ", "The millisecond watch progress hits 100%, the backend sets enrollment to 'Completed', clears employee_id in lms_active_slots, records released_at, and frees the seat exclusively for that provider without touching other platforms.")

    add_diagram_image(
        "backend/scripts/diagrams/dfd_level_2_gatekeeper.png",
        "Figure 4: Level 2.2 Gatekeeper DFD (Model B) — Telemetry Ingestion, Anti-Logout Lockdown, and Platform-Scoped Slot Recycling"
    )

    # 3.5 DATA FLOW SPECIFICATIONS / DATA DICTIONARY
    style_heading(doc.add_paragraph(), "3.5 Data Flow Specifications & Data Dictionary (Model B)", level=2)
    add_body_p("The table below documents the precise data structures, source/destination mappings, and operational payloads across all DFD channels:")

    dfd_headers = ["Data Flow Name", "Source", "Destination", "Key Data Attributes / Payload", "Operational Purpose"]
    dfd_widths = [1.5, 1.2, 1.2, 1.8, 1.3]
    dfd_data = [
        ["Email-Provider Mapping Setup", "L&D Admin", "1.0 Ingestion", "CourseEmailId, ProviderId, MaxSlots=4", "Establishes account link in dbo.EmailProviders"],
        ["Course Purchase Ingestion", "L&D Admin", "1.0 Ingestion", "course_name, EmailProviderId, price, duration", "Registers course under the specific mapping"],
        ["Slot Pre-Allocation (EP)", "1.0 Ingestion", "D5: lms_active_slots", "EmailProviderId, slot_number (1..4), status='Available'", "Provisions 4 seats for that EmailProviderId"],
        ["Email Filter Query", "UI Dropdown", "2.0 Filter Engine", "CourseEmailId", "Requests platform providers linked to mailbox"],
        ["Filtered Providers Payload", "2.0 Filter Engine", "UI Display", "EmailProviderId[], ProviderId[], ProviderName[]", "Populates provider dropdown dynamically"],
        ["Catalog & Capacity Payload", "2.0 Filter Engine", "UI Display", "course_id[], occupied_slots, available_slots, active_learners[]", "Renders platform courses + live capacity badge"],
        ["Seat Assignment Request", "L&D Admin", "3.0 Concurrency", "EmailProviderId, slot_number, employee_id, course_id", "Reserves seat and locks slot with UPDLOCK"],
        ["Platform Session Token", "3.0 Concurrency", "Employee", "session_token, email, provider_url", "Authorizes learner to access course account"],
        ["Telemetry Watch Heartbeat", "Extension", "4.0 Telemetry", "enrollment_id, employee_id, progress_percentage, video_seconds", "Real-time watch progress reporting"],
        ["Lockout Enforcement Intercept", "5.0 Gatekeeper", "Extension", "is_locked: true, reason: 'Progress < 100%'", "Prevents learner logout or seat revocation"],
        ["Platform Slot Release", "5.0 Gatekeeper", "D5: lms_active_slots", "slot_id, status='Available', employee_id=NULL, released_at=NOW", "Immediately frees seat for next platform candidate"]
    ]
    format_table(doc.add_table(rows=1, cols=5), dfd_widths, dfd_headers, dfd_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # -------------------------------------------------------------
    # 4. ARCHITECTURAL EVALUATION & MODEL B JUSTIFICATION
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "4. Architectural Evaluation: Why Model B is the Confirmed Standard", level=1)

    add_body_p(
        "During technical discovery, two architectural scoping approaches were evaluated. Management has formally approved "
        "Model B (Email + Provider Pair Cap) as the production implementation standard. Below is the side-by-side technical evaluation:"
    )

    style_heading(doc.add_paragraph(), "4.1 Comparative Matrix: Model A vs. Model B", level=2)

    scope_headers = ["Architectural Dimension", "Model A: Global Corporate Email Cap\n(Legacy / Alternative)", "Model B: (Email + Provider) Pair Cap\n(APPROVED PRODUCTION STANDARD ⭐)"]
    scope_widths = [1.8, 2.6, 2.6]
    scope_data = [
        [
            "Where 4 Slots are Capped",
            "Per Corporate Email Account (Global mailbox limit across all platforms)",
            "Per unique (Email + Provider) Combination (Independent platform limits)"
        ],
        [
            "Database Table for Slots",
            "dbo.lms_active_slots references course_email_id",
            "dbo.lms_active_slots references EmailProviderId (via junction table dbo.EmailProviders)"
        ],
        [
            "Database Relationship",
            "CourseEmails (1) ──> lms_active_slots (4)",
            "EmailProviders (1) ──> lms_active_slots (4)"
        ],
        [
            "Example Scenario:\nelearning1@gmail.com with\n5 Udemy & 6 Coursera courses",
            "Max 4 Active Learners TOTAL across both platforms combined.\n(e.g., 2 on Udemy + 2 on Coursera = Capacity Full! A 3rd Udemy learner must wait).",
            "Max 4 Active Learners on Udemy + Max 4 on Coursera = 8 Learners Total.\n(Udemy capacity is completely independent of Coursera)."
        ],
        [
            "Slot Release Impact",
            "Releasing Michael Chen's slot on Coursera frees up a slot that could immediately be claimed by a Udemy learner.",
            "Releasing Michael Chen's slot on Coursera ONLY frees up a seat in Coursera. Udemy seats remain unaffected."
        ],
        [
            "Real-World Platform Alignment",
            "Artificial cross-platform constraint not enforced by external websites.",
            "100% aligned with real-world website session mechanics (Udemy login cookies do not clash with Coursera)."
        ]
    ]
    format_table(doc.add_table(rows=1, cols=3), scope_widths, scope_headers, scope_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Embed Figure 5: Model A vs Model B Graphic
    add_diagram_image(
        "backend/scripts/diagrams/dfd_model_a_vs_b_comparison.png",
        "Figure 5: Architectural Comparison — Model A (Global Email Cap: 4 Total) vs. Model B (Platform Pair Cap: 8 Total)"
    )

    style_heading(doc.add_paragraph(), "4.2 Technical Justification for Model B", level=2)

    add_body_p(
        "The decision to implement Model B is based on four compelling technical and business reasons:"
    )
    add_bullet_p("1. Independent Website Sessions: ", "Udemy and Coursera run on distinct domains with separate authentication tokens. Concurrency on Udemy has zero technical interaction with Coursera.")
    add_bullet_p("2. Elimination of Learning Bottlenecks: ", "Under Model A, four employees studying Udemy courses would lock the entire mailbox, leaving paid Coursera licenses sitting completely idle. Model B eliminates this blockage.")
    add_bullet_p("3. Maximized Training ROI: ", "A single corporate mailbox (e.g. elearning1@gmail.com) can support 4 active learners per provider, doubling or tripling training throughput without purchasing extra email licenses.")
    add_bullet_p("4. Isolated Slot Recycling: ", "When a learner finishes a Coursera course at 100%, their slot is recycled strictly for waiting Coursera candidates, preventing cross-domain license starvation.")

    style_heading(doc.add_paragraph(), "4.3 Concurrency Engine Storage: Option A (Normalized) Standard", level=2)

    add_body_p(
        "Under Model B, concurrency is managed using Option A (Normalized Concurrency Table in dbo.lms_active_slots):"
    )
    add_bullet_p("ACID Row Locking: ", "When assigning a seat, the backend executes SELECT ... WITH (UPDLOCK, HOLDLOCK) on dbo.lms_active_slots where EmailProviderId = @EPID AND status = 'Available'. This prevents simultaneous race conditions.")
    add_bullet_p("Zero Data Drift: ", "Available capacity is always 4 - COUNT(occupied slots). There are no de-synchronized integer counters or corrupted comma-separated strings.")

    # -------------------------------------------------------------
    # 5. DATABASE SCHEMAS & FIELD SPECIFICATIONS (MODEL B DDL)
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "5. Database Schemas & Field Specifications (Model B)", level=1)

    add_body_p("Below are the complete, production-ready SQL Server DDL definitions for the confirmed Model B architecture:")

    # Table 1: CourseEmails
    style_heading(doc.add_paragraph(), "A. Master Table: dbo.CourseEmails", level=2)
    ce_headers = ["Column Name", "Data Type", "Nullable", "Key / Default", "Description"]
    ce_widths = [1.8, 1.2, 1.0, 1.3, 1.7]
    ce_data = [
        ["CourseEmailId", "INT IDENTITY(1,1)", "No", "PRIMARY KEY", "Unique ID of corporate email account"],
        ["CourseEmail", "NVARCHAR(255)", "No", "UNIQUE", "Full email address (e.g. elearning1@gmail.com)"],
        ["IsActive", "BIT", "No", "DEFAULT 1", "Account operational status (1 = Active, 0 = Disabled)"],
        ["CreatedAt", "DATETIME2", "No", "DEFAULT GETDATE()", "Account onboarding timestamp"]
    ]
    format_table(doc.add_table(rows=1, cols=5), ce_widths, ce_headers, ce_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Table 2: CourseProviders
    style_heading(doc.add_paragraph(), "B. Platform Registry: dbo.CourseProviders", level=2)
    cp_headers = ["Column Name", "Data Type", "Nullable", "Key / Default", "Description"]
    cp_widths = [1.8, 1.2, 1.0, 1.3, 1.7]
    cp_data = [
        ["ProviderId", "INT IDENTITY(1,1)", "No", "PRIMARY KEY", "Unique provider platform ID"],
        ["ProviderName", "NVARCHAR(150)", "No", "UNIQUE", "Platform name (Udemy, Coursera, AWS, edX)"],
        ["IsActive", "BIT", "No", "DEFAULT 1", "Active platform flag"],
        ["CreatedAt", "DATETIME2", "No", "DEFAULT GETDATE()", "Onboarding timestamp"]
    ]
    format_table(doc.add_table(rows=1, cols=5), cp_widths, cp_headers, cp_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Table 3: EmailProviders (Core Junction Table)
    style_heading(doc.add_paragraph(), "C. Core Junction Table: dbo.EmailProviders (Model B Anchor)", level=2)
    ep_headers = ["Column Name", "Data Type", "Nullable", "Key / Default", "Description"]
    ep_widths = [1.8, 1.2, 1.0, 1.3, 1.7]
    ep_data = [
        ["EmailProviderId", "INT IDENTITY(1,1)", "No", "PRIMARY KEY", "Unique ID for each (Email + Provider) pair"],
        ["CourseEmailId", "INT", "No", "FK -> CourseEmails", "Corporate mailbox reference"],
        ["ProviderId", "INT", "No", "FK -> CourseProviders", "Platform reference (Udemy, Coursera, etc.)"],
        ["MaxSlots", "INT", "No", "DEFAULT 4", "Independent slot capacity for this platform (default 4)"],
        ["IsActive", "BIT", "No", "DEFAULT 1", "Active status of this platform account integration"],
        ["CreatedAt", "DATETIME2", "No", "DEFAULT GETDATE()", "Creation timestamp (UNIQUE on CourseEmailId, ProviderId)"]
    ]
    format_table(doc.add_table(rows=1, cols=5), ep_widths, ep_headers, ep_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Table 4: lms_courses
    style_heading(doc.add_paragraph(), "D. Purchased Course Catalog: dbo.lms_courses", level=2)
    lc_headers = ["Column Name", "Data Type", "Nullable", "Key / Default", "Description"]
    lc_widths = [1.8, 1.2, 1.0, 1.3, 1.7]
    lc_data = [
        ["id", "INT IDENTITY(1,1)", "No", "PRIMARY KEY", "Unique course ID"],
        ["course_name", "VARCHAR(150)", "No", "NOT NULL", "Official course title"],
        ["course_url", "VARCHAR(255)", "Yes", "NULL", "Link to launch course on provider platform"],
        ["EmailProviderId", "INT", "Yes", "FK -> EmailProviders", "Model B platform mapping junction reference"],
        ["course_email_id", "INT", "Yes", "FK -> CourseEmails", "Direct email FK (for reporting / backward compat)"],
        ["provider_id", "INT", "Yes", "FK -> CourseProviders", "Direct provider FK (for reporting / backward compat)"],
        ["category_id", "INT", "Yes", "FK -> CourseCategories", "Domain category (DevOps, Cloud, AI)"],
        ["price", "INT", "No", "NOT NULL", "Purchase cost in INR"],
        ["duration_minutes", "INT", "Yes", "NULL", "Total curriculum length in minutes"],
        ["payment_status", "VARCHAR(20)", "No", "DEFAULT 'Paid'", "Payment status ('Paid', 'Pending')"],
        ["hr_status", "VARCHAR(20)", "No", "DEFAULT 'Approved'", "L&D/HR approval status"]
    ]
    format_table(doc.add_table(rows=1, cols=5), lc_widths, lc_headers, lc_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Table 5: lms_active_slots
    style_heading(doc.add_paragraph(), "E. Concurrency Engine Table: dbo.lms_active_slots", level=2)
    as_headers = ["Column Name", "Data Type", "Nullable", "Key / Default", "Description"]
    as_widths = [1.8, 1.2, 1.0, 1.3, 1.7]
    as_data = [
        ["slot_id", "INT IDENTITY(1,1)", "No", "PRIMARY KEY", "Unique seat allocation ID"],
        ["EmailProviderId", "INT", "No", "FK -> EmailProviders", "Platform mapping this slot pool belongs to"],
        ["slot_number", "INT", "No", "CHECK (1..4)", "Slot position index (1, 2, 3, or 4)"],
        ["course_id", "INT", "Yes", "FK -> lms_courses", "Course currently being studied in this slot"],
        ["employee_id", "VARCHAR(7)", "Yes", "FK -> profiles", "Employee occupying the slot (e.g. EMP019)"],
        ["enrollment_id", "INT", "Yes", "FK -> enrollments", "Associated student enrollment record"],
        ["status", "VARCHAR(20)", "No", "DEFAULT 'Available'", "Status: 'Available', 'Occupied', 'Locked'"],
        ["progress_percentage", "DECIMAL(5,2)", "No", "DEFAULT 0.00", "Current live course progress (0.00 to 100.00)"],
        ["occupied_at", "DATETIME", "Yes", "NULL", "Timestamp when employee began using this seat"],
        ["released_at", "DATETIME", "Yes", "NULL", "Timestamp when 100% completed & seat released"]
    ]
    format_table(doc.add_table(rows=1, cols=5), as_widths, as_headers, as_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # -------------------------------------------------------------
    # 6. CASCADING FILTER WORKFLOW
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "6. Cascading Filter Workflow in UI & Backend (Model B)", level=1)

    add_body_p(
        "When an administrator browses or assigns courses in the LMS Course Management interface, the system executes "
        "a clean three-step resolution pipeline based on EmailProviders:"
    )

    add_bullet_p(
        "Action 1: Select Corporate Email — ",
        "L&D selects elearning1@gmail.com from the dropdown. "
        "The backend queries: SELECT DISTINCT ep.EmailProviderId, cp.ProviderId, cp.ProviderName FROM dbo.EmailProviders ep JOIN dbo.CourseProviders cp ON ep.ProviderId = cp.ProviderId WHERE ep.CourseEmailId = @EmailId AND ep.IsActive = 1. "
        "The Provider dropdown dynamically populates with Udemy and Coursera."
    )

    add_bullet_p(
        "Action 2: Select Provider — ",
        "L&D selects Udemy. This resolves EmailProviderId = 1. "
        "The backend queries: SELECT * FROM dbo.lms_courses WHERE EmailProviderId = 1. "
        "The catalog displays the Udemy courses purchased under that email: 'Mastering Python', 'Docker for DevOps', and 'React Pro'."
    )

    add_bullet_p(
        "Action 3: Platform Capacity Badge Display — ",
        "The backend counts occupied slots where EmailProviderId = 1. "
        "The UI displays: 'Udemy Capacity: 3/4 Occupied | 1 Slot Open'. "
        "Selecting Coursera resolves EmailProviderId = 2 and independently displays: 'Coursera Capacity: 1/4 Occupied | 3 Slots Open'."
    )

    # -------------------------------------------------------------
    # 7. THE 100% PROGRESS COMPLETION GATEKEEPER
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "7. The 100% Progress Completion Gatekeeper Rule", level=1)

    add_body_p(
        "Under Model B, the strict 100% progress completion gatekeeper operates with platform isolation:"
    )

    add_callout(
        "Enforcement Mechanism in Backend & Extension",
        "• Progress < 100.00%: The browser extension prevents credential revocation or account switching. If L&D attempts to manually reassign the seat, "
        "the backend rejects the request with HTTP 400: 'Cannot release active slot: Employee EMP019 is currently at 72.5% progress. "
        "Seats can only be released upon 100% course completion.'\n"
        "• Progress = 100.00%: The moment the employee finishes the last video lecture or module, progress hits 100%. "
        "The LMS marks enrollment status as 'Completed', triggers certificate generation, "
        "and automatically resets the slot status in dbo.lms_active_slots from 'Occupied' to 'Available' for that specific EmailProviderId.\n"
        "• Platform Isolation: Freeing a seat on Coursera does NOT alter the occupancy or availability of Udemy seats.",
        is_success=True
    )

    # -------------------------------------------------------------
    # 8. IMPLEMENTATION ROADMAP
    # -------------------------------------------------------------
    style_heading(doc.add_paragraph(), "8. Implementation Roadmap & Milestones (Model B)", level=1)

    steps_headers = ["Phase", "Milestone Task", "Key Deliverables", "Validation Check"]
    steps_widths = [1.2, 2.2, 2.1, 1.5]
    steps_data = [
        ["Phase 1", "Database Schema Evolution (Alembic)", "Create dbo.EmailProviders junction table, link lms_courses.EmailProviderId, and build dbo.lms_active_slots with EmailProviderId FK", "Alembic upgrade head with zero data loss"],
        ["Phase 2", "Backend Seat Service & Gating API", "Build slot_service.py with acquire_slot(EmailProviderId), release_slot(), and 100% progress lock", "Unit tests: 4 slots per platform enforced; Coursera release doesn't touch Udemy"],
        ["Phase 3", "Bidirectional Filtering Router", "Implement GET /api/courses/filter-by-email and GET /api/courses/platform-slots-summary", "JSON payload verifies email -> provider -> EmailProviderId cascade"],
        ["Phase 4", "Frontend Course Purchase UI", "Update AddCourseModal & FilterDrawer with live platform 4-slot badges and dynamic cascading dropdowns", "UI visual inspection & responsive checks"],
        ["Phase 5", "Browser Extension Verification", "Sync browser extension OTP & learner tracker with 100% completion trigger", "Full end-to-end user learning flow test"]
    ]
    format_table(doc.add_table(rows=1, cols=4), steps_widths, steps_headers, steps_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # Sign-off footer
    end_p = doc.add_paragraph()
    end_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_end = end_p.add_run("— End of Specification Document (Model B Standard) —")
    r_end.font.name = "Arial"
    r_end.font.size = Pt(9.5)
    r_end.font.color.rgb = SECONDARY
    r_end.italic = True

    saved_path = output_path
    try:
        doc.save(output_path)
        print(f"Successfully generated Word document at: {output_path}")
    except PermissionError:
        saved_path = output_path.replace(".docx", "_Updated.docx")
        doc.save(saved_path)
        print(f"Original file was locked by Word. Successfully saved updated Word document to: {saved_path}")

    # Also sync to workspace root and brain artifacts directory
    workspace_copy = os.path.abspath("Course_Purchase_Provider_and_Email_Slot_Workflow_Plan.docx")
    artifact_copy = os.path.abspath(r"C:\Users\rdiva\.gemini\antigravity\brain\0c801a44-6f4b-47b3-b64d-2a7d46eb4cdb\Course_Purchase_Provider_and_Email_Slot_Workflow_Plan.docx")
    
    if os.path.abspath(saved_path).lower() != workspace_copy.lower():
        try:
            shutil.copyfile(saved_path, workspace_copy)
            print(f"Copied to workspace root: {workspace_copy}")
        except PermissionError:
            print(f"Workspace file {workspace_copy} is locked by Word. Available at {saved_path}")

    if os.path.exists(os.path.dirname(artifact_copy)):
        try:
            shutil.copyfile(saved_path, artifact_copy)
            print(f"Copied to artifact directory: {artifact_copy}")
        except Exception as e:
            print(f"Could not copy to artifact directory: {e}")

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "Course_Purchase_Provider_and_Email_Slot_Workflow_Plan.docx"
    create_workflow_docx(out)
