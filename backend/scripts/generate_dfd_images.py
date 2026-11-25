import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Configure styling
plt.rcParams['font.sans-serif'] = 'Arial'
plt.rcParams['font.family'] = 'sans-serif'

PRIMARY_NAVY = "#1A365D"
TEAL_ACCENT = "#0D9488"
SLATE_TEXT = "#1E293B"
MUTED_SLATE = "#475569"
BOX_BG_BLUE = "#EFF6FF"
BORDER_BLUE = "#3B82F6"
PROCESS_BG = "#1E3A8A"
STORE_BG = "#F8FAFC"
STORE_BORDER = "#64748B"
SUCCESS_GREEN = "#15803D"
LOCK_RED = "#B91C1C"

def draw_entity(ax, x, y, w, h, title, subtitle=""):
    """Draws an external entity (double rounded box)."""
    box = patches.FancyBboxPatch(
        (x - w/2, y - h/2), w, h,
        boxstyle="round,pad=0.04,rounding_size=0.15",
        facecolor=BOX_BG_BLUE,
        edgecolor=BORDER_BLUE,
        linewidth=2,
        zorder=3
    )
    ax.add_patch(box)
    txt = f"{title}\n({subtitle})" if subtitle else title
    ax.text(x, y, txt, ha='center', va='center', fontsize=9.5, fontweight='bold', color=PRIMARY_NAVY, zorder=4)

def draw_process(ax, x, y, r, p_num, title):
    """Draws a DFD process (circle or pill)."""
    circle = patches.Circle(
        (x, y), r,
        facecolor=PROCESS_BG,
        edgecolor="#60A5FA",
        linewidth=2,
        zorder=3
    )
    ax.add_patch(circle)
    ax.text(x, y + 0.12, p_num, ha='center', va='center', fontsize=11, fontweight='bold', color="#93C5FD", zorder=4)
    ax.text(x, y - 0.12, title, ha='center', va='center', fontsize=8.5, fontweight='bold', color="#FFFFFF", zorder=4)

def draw_store(ax, x, y, w, h, s_id, s_name):
    """Draws an open-ended DFD data store."""
    box = patches.Rectangle(
        (x - w/2, y - h/2), w, h,
        facecolor=STORE_BG,
        edgecolor="none",
        zorder=2
    )
    ax.add_patch(box)
    # Top and bottom borders only (open ends)
    ax.plot([x - w/2, x + w/2], [y + h/2, y + h/2], color=STORE_BORDER, lw=2, zorder=3)
    ax.plot([x - w/2, x + w/2], [y - h/2, y - h/2], color=STORE_BORDER, lw=2, zorder=3)
    # Left partition for ID
    ax.plot([x - w/2 + 0.55, x - w/2 + 0.55], [y - h/2, y + h/2], color=STORE_BORDER, lw=1.5, zorder=3)
    ax.text(x - w/2 + 0.275, y, s_id, ha='center', va='center', fontsize=8.5, fontweight='bold', color=TEAL_ACCENT, zorder=4)
    ax.text(x + 0.25, y, s_name, ha='center', va='center', fontsize=8.5, fontweight='bold', color=SLATE_TEXT, zorder=4)

def draw_arrow(ax, x1, y1, x2, y2, label="", rad=0.0, color="#2563EB", lw=1.6, label_offset=(0, 0)):
    """Draws an annotated arrow with a curved connection."""
    arrow = patches.FancyArrowPatch(
        (x1, y1), (x2, y2),
        connectionstyle=f"arc3,rad={rad}",
        arrowstyle="-|>",
        mutation_scale=14,
        color=color,
        linewidth=lw,
        zorder=2
    )
    ax.add_patch(arrow)
    if label:
        mx = (x1 + x2) / 2 + label_offset[0]
        my = (y1 + y2) / 2 + label_offset[1]
        ax.text(
            mx, my, label,
            ha='center', va='center',
            fontsize=7.5, fontweight='bold',
            color=color,
            bbox=dict(boxstyle="round,pad=0.2", fc="#FFFFFF", ec="#CBD5E1", lw=0.8, alpha=0.95),
            zorder=5
        )

# ==============================================================================
# 1. LEVEL 0 CONTEXT DIAGRAM (MODEL B)
# ==============================================================================
def generate_level_0():
    fig, ax = plt.subplots(figsize=(10.5, 6.5), dpi=300)
    ax.set_xlim(-5.5, 5.5)
    ax.set_ylim(-4.0, 4.0)
    ax.axis('off')

    # Central System
    center_box = patches.FancyBboxPatch(
        (-1.9, -1.25), 3.8, 2.5,
        boxstyle="round,pad=0.08,rounding_size=0.3",
        facecolor="#0F172A",
        edgecolor="#38BDF8",
        linewidth=2.5,
        zorder=3
    )
    ax.add_patch(center_box)
    ax.text(0, 0.5, "0.0: LMS COURSE ACCESS &", ha='center', va='center', fontsize=11, fontweight='bold', color="#38BDF8")
    ax.text(0, 0.18, "PLATFORM CONCURRENCY SYSTEM", ha='center', va='center', fontsize=11, fontweight='bold', color="#38BDF8")
    ax.text(0, -0.35, "• Model B: (Email + Provider) Scoping\n• Independent 4-Seat Pools per Platform\n• 100% Completion Gatekeeper Locking\n• Automatic Seat Recycling upon Finish", 
            ha='center', va='center', fontsize=7.8, color="#E2E8F0")

    # External Entities
    draw_entity(ax, -4.0, 2.3, 2.2, 1.0, "L&D Administrator", "HR / Course Operations")
    draw_entity(ax, -4.0, -2.3, 2.2, 1.0, "Employee / Learner", "Corporate Staff")
    draw_entity(ax, 4.0, -2.3, 2.2, 1.0, "LMS Browser Extension", "Proxy & Telemetry Client")
    draw_entity(ax, 4.0, 2.3, 2.2, 1.0, "Course Platforms", "Udemy / Coursera / AWS / edX")

    # L&D Admin Flows
    draw_arrow(ax, -2.9, 2.5, -1.9, 0.9, "1. Configure Email & Provider Mappings", rad=-0.08, label_offset=(-0.3, 0.2))
    draw_arrow(ax, -2.9, 2.0, -1.9, 0.3, "2. Query Platform Slot Capacity", rad=0.05, label_offset=(-0.2, -0.15))
    draw_arrow(ax, -1.9, -0.1, -2.9, 1.5, "3. Platform-Specific 4-Slot Badges", rad=0.1, color="#059669", label_offset=(-0.4, -0.2))

    # Employee Flows
    draw_arrow(ax, -2.9, -2.0, -1.9, -0.7, "4. Submit Course Request", rad=0.05, label_offset=(-0.3, 0.2))
    draw_arrow(ax, -1.9, -1.0, -2.9, -2.5, "5. Platform Seat Allocation & Token", rad=0.08, color="#059669", label_offset=(-0.4, -0.2))

    # Browser Extension Flows
    draw_arrow(ax, 2.9, -2.1, 1.9, -0.8, "6. Video Watch Time & Progress %", rad=-0.06, label_offset=(0.3, 0.2))
    draw_arrow(ax, 1.9, -1.1, 2.9, -2.6, "7. Enforce Lockdown (< 100% Progress)", rad=-0.08, color=LOCK_RED, label_offset=(0.4, -0.2))

    # Platform Flows
    draw_arrow(ax, 2.9, 2.3, 1.9, 0.8, "8. Video Stream & Session Auth", rad=0.08, label_offset=(0.3, 0.2))

    # Title & Banner
    ax.text(0, 3.65, "LEVEL 0: CONTEXT DATA FLOW DIAGRAM (MODEL B)", ha='center', va='center', fontsize=12, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(0, 3.35, "Platform-Specific (Email + Provider) Concurrency Architecture & System Boundary", ha='center', va='center', fontsize=9, color=MUTED_SLATE)

    plt.tight_layout()
    out = "backend/scripts/diagrams/dfd_level_0_context.png"
    plt.savefig(out, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")

# ==============================================================================
# 2. LEVEL 1 SYSTEM-WIDE DETAILED DFD (MODEL B)
# ==============================================================================
def generate_level_1():
    fig, ax = plt.subplots(figsize=(12.5, 9.0), dpi=300)
    ax.set_xlim(-6.5, 6.5)
    ax.set_ylim(-5.4, 5.4)
    ax.axis('off')

    # Header
    ax.text(0, 5.0, "LEVEL 1: SYSTEM-WIDE DETAILED DFD (MODEL B: EMAIL + PROVIDER PAIR CAP)", ha='center', va='center', fontsize=13, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(0, 4.65, "Decomposed Processes, Persistent Data Stores, and EmailProviders Junction Concurrency", ha='center', va='center', fontsize=9.5, color=MUTED_SLATE)

    # External Entities
    draw_entity(ax, -5.2, 3.2, 1.8, 0.8, "L&D Admin")
    draw_entity(ax, -5.2, -3.4, 1.8, 0.8, "Employee / Learner")
    draw_entity(ax, 5.2, -3.4, 1.8, 0.8, "Browser Extension")

    # 5 Processes
    draw_process(ax, -2.2, 3.2, 0.85, "1.0", "Mapping &\nCourse Ingestion")
    draw_process(ax, 1.8, 3.2, 0.85, "2.0", "Cascading Filter\n& Catalog Engine")
    draw_process(ax, -2.2, -0.6, 0.85, "3.0", "4-Seat Concurrency\n& Allocator")
    draw_process(ax, 3.8, -0.6, 0.85, "4.0", "Telemetry &\nProgress Tracker")
    draw_process(ax, 0.8, -3.4, 0.85, "5.0", "100% Progress\nGatekeeper & Release")

    # 6 Data Stores (Including EmailProviders!)
    draw_store(ax, -3.2, 1.5, 2.1, 0.55, "D1", "dbo.CourseEmails")
    draw_store(ax, -0.8, 1.5, 2.1, 0.55, "D2", "dbo.CourseProviders")
    draw_store(ax, 1.8, 1.5, 2.4, 0.55, "D3", "dbo.EmailProviders (Junction)")
    draw_store(ax, 4.7, 1.5, 2.1, 0.55, "D4", "dbo.lms_courses")
    draw_store(ax, 0.8, -1.8, 2.5, 0.55, "D5", "dbo.lms_active_slots (EP)")
    draw_store(ax, -3.8, -2.0, 2.5, 0.55, "D6", "lms_course_enrollments")

    # Process 1.0 Flows
    draw_arrow(ax, -4.3, 3.2, -3.05, 3.2, "Email + Provider Setup", label_offset=(0, 0.2))
    draw_arrow(ax, -2.2, 2.35, -2.9, 1.8, "Link Email (D1)", color="#059669")
    draw_arrow(ax, -2.2, 2.35, -1.1, 1.8, "Link Provider (D2)", color="#059669")
    draw_arrow(ax, -1.35, 3.0, 1.5, 1.8, "Create EmailProviderId (D3)", rad=-0.1, color="#059669", label_offset=(-0.1, 0.35))
    draw_arrow(ax, -1.35, 3.4, 4.4, 1.8, "Insert Course (D4)", rad=0.2, label_offset=(0.2, 0.35))
    draw_arrow(ax, -2.0, 2.35, 0.2, -1.5, "Init 4 Slots per EmailProviderId (D5)", rad=-0.25, label_offset=(-0.6, 0.3))

    # Process 2.0 Flows
    draw_arrow(ax, -4.3, 3.6, 1.0, 3.6, "1. Select Corporate Email", rad=-0.15, label_offset=(-1.2, 0.3))
    draw_arrow(ax, 1.8, 1.8, 1.8, 2.35, "Query EmailProviders (D3)", color="#059669")
    draw_arrow(ax, 1.0, 3.2, -4.3, 2.9, "Populate Providers for Email", rad=0.15, color="#059669", label_offset=(-1.2, -0.3))
    draw_arrow(ax, 2.65, 3.2, 4.7, 1.8, "Fetch Courses by EmailProviderId (D4)", rad=-0.1)
    draw_arrow(ax, 1.8, 2.35, 1.2, -1.5, "Read 4-Slot Capacity per EP (D5)", rad=-0.1, label_offset=(0.7, 0.5))

    # Process 3.0 Flows
    draw_arrow(ax, -5.2, -3.0, -2.8, -1.2, "Enrollment Request", label_offset=(-0.5, 0.25))
    draw_arrow(ax, -2.2, -1.45, -3.2, -1.7, "Create Enrollment (D6)", color="#059669")
    draw_arrow(ax, -1.35, -0.6, 0.0, -1.5, "Lock Slot (EmailProviderId) (D5)", color="#059669", label_offset=(0.2, 0.2))
    draw_arrow(ax, -1.7, -1.3, -4.3, -3.4, "Issue Platform Session Token", color="#059669", rad=0.1, label_offset=(-0.6, -0.3))

    # Process 4.0 Flows
    draw_arrow(ax, 5.2, -3.0, 4.3, -1.3, "Telemetry Watch Heartbeat", label_offset=(0.4, 0.3))
    draw_arrow(ax, 3.8, -1.45, 1.5, -1.8, "Sync Slot % (D5)", label_offset=(-0.2, 0.2))
    draw_arrow(ax, 3.0, -0.6, 1.2, -2.6, "Stream Progress to Gatekeeper", rad=0.1, color=PRIMARY_NAVY, label_offset=(0.4, 0.2))

    # Process 5.0 Flows
    draw_arrow(ax, 0.8, -2.55, 0.8, -2.1, "Evaluate == 100%? (D5)")
    draw_arrow(ax, 1.65, -3.4, 4.3, -3.4, "If < 100%: Enforce Platform Lock", color=LOCK_RED, label_offset=(0.0, 0.25))
    draw_arrow(ax, 0.3, -2.7, 0.5, -2.1, "If 100%: Free EP Slot (D5)", color=SUCCESS_GREEN, label_offset=(-0.7, 0.25))
    draw_arrow(ax, -0.05, -3.4, -3.0, -2.3, "Mark Completed (D6)", color=SUCCESS_GREEN, label_offset=(-0.8, -0.3))

    plt.tight_layout()
    out = "backend/scripts/diagrams/dfd_level_1_detailed.png"
    plt.savefig(out, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")

# ==============================================================================
# 3. LEVEL 2.1 CASCADING FILTER DFD (MODEL B)
# ==============================================================================
def generate_level_2_cascade():
    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=300)
    ax.set_xlim(-6.0, 6.0)
    ax.set_ylim(-3.8, 3.8)
    ax.axis('off')

    # Header
    ax.text(0, 3.45, "LEVEL 2.1: CASCADING FILTER & CATALOG DATA FLOW (MODEL B)", ha='center', va='center', fontsize=12.5, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(0, 3.15, "EmailProviders Junction Resolution: Email -> Providers -> EmailProviderId -> Platform Courses & 4-Slot Badge", ha='center', va='center', fontsize=8.8, color=MUTED_SLATE)

    # Actor
    draw_entity(ax, -4.8, 0, 1.8, 1.0, "L&D Admin / UI", "Course Purchase Screen")

    # Sub-Processes
    draw_process(ax, -2.0, 1.6, 0.8, "2.1", "Email-to-Provider\nResolver (D3)")
    draw_process(ax, 1.5, 1.6, 0.8, "2.2", "Catalog Resolver by\nEmailProviderId")
    draw_process(ax, 1.5, -1.6, 0.8, "2.3", "Platform Slot\nBadge Aggregator")

    # Data Stores
    draw_store(ax, -2.0, -0.1, 2.4, 0.55, "D1", "dbo.CourseEmails")
    draw_store(ax, -2.0, -1.6, 2.4, 0.55, "D3", "dbo.EmailProviders")
    draw_store(ax, 4.6, 1.6, 2.2, 0.55, "D4", "dbo.lms_courses")
    draw_store(ax, 4.6, -1.6, 2.2, 0.55, "D5", "dbo.lms_active_slots")

    # Data Flows
    draw_arrow(ax, -3.9, 0.5, -2.7, 1.2, "Step 1: Select Email\n(e.g. elearning1@gmail.com)", label_offset=(-0.6, 0.4))
    draw_arrow(ax, -2.0, 0.8, -2.0, 0.2, "Lookup CourseEmailId", color="#059669")
    draw_arrow(ax, -2.0, -0.4, -2.0, -1.3, "Join EmailProviders (D3)", color="#059669")
    draw_arrow(ax, -1.3, 1.6, -3.9, 0.8, "Return Linked Providers\n(e.g. [Udemy, Coursera])", rad=0.2, color="#059669", label_offset=(-0.7, 0.5))

    draw_arrow(ax, -3.9, 0.0, 0.7, 1.6, "Step 2: Select Provider (Udemy)\n-> Resolves EmailProviderId=1", rad=-0.1, label_offset=(-0.8, 0.3))
    draw_arrow(ax, 2.3, 1.6, 3.5, 1.6, "Query Courses where\nEmailProviderId = 1")
    draw_arrow(ax, 3.5, 1.4, 2.3, 1.4, "Return 3 Udemy Courses\n(Python, Docker, React)", color="#059669")

    draw_arrow(ax, 1.5, 0.8, 1.5, -0.8, "Pass EmailProviderId for Capacity Check")
    draw_arrow(ax, 2.3, -1.6, 3.5, -1.6, "Count Occupied Slots (D5)")
    draw_arrow(ax, 3.5, -1.8, 2.3, -1.8, "Udemy: 3/4 Occupied (1 Open)", color="#059669")

    draw_arrow(ax, 0.7, -1.6, -3.9, -0.5, "Step 3: Render Udemy Catalog +\nUdemy Slot Badge (1 Open)", rad=0.1, color="#059669", label_offset=(-0.8, -0.5))

    plt.tight_layout()
    out = "backend/scripts/diagrams/dfd_level_2_cascade.png"
    plt.savefig(out, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")

# ==============================================================================
# 4. LEVEL 2.2 GATEKEEPER & AUTO SEAT RELEASE DFD (MODEL B)
# ==============================================================================
def generate_level_2_gatekeeper():
    fig, ax = plt.subplots(figsize=(11, 6.5), dpi=300)
    ax.set_xlim(-6.0, 6.0)
    ax.set_ylim(-3.8, 3.8)
    ax.axis('off')

    # Header
    ax.text(0, 3.45, "LEVEL 2.2: 100% PROGRESS GATEKEEPER (MODEL B PLATFORM-SCOPED)", ha='center', va='center', fontsize=12.5, fontweight='bold', color=PRIMARY_NAVY)
    ax.text(0, 3.15, "Continuous Watch Time Telemetry: Strict Anti-Logout Lock vs. Independent Platform Slot Release", ha='center', va='center', fontsize=8.8, color=MUTED_SLATE)

    # Actor
    draw_entity(ax, -4.8, 0, 1.8, 1.0, "LMS Extension", "Client Telemetry Agent")

    # Process 5.1 & 5.2 & 5.3
    draw_process(ax, -2.0, 0, 0.85, "5.1", "Telemetry Ingest\n& Progress Sync")
    draw_process(ax, 1.0, 1.6, 0.85, "5.2", "Lock Engine\n(< 100% Progress)")
    draw_process(ax, 1.0, -1.6, 0.85, "5.3", "Platform Slot\nRecycler (100%)")

    # Data Stores
    draw_store(ax, -2.0, 2.2, 2.4, 0.55, "D6", "lms_course_enrollments")
    draw_store(ax, -2.0, -2.2, 2.4, 0.55, "D5", "lms_active_slots (EP)")
    draw_entity(ax, 4.6, -1.6, 1.8, 0.9, "Queued Employee", "Waiting for Platform Slot")

    # Data Flows
    draw_arrow(ax, -3.9, 0, -2.85, 0, "Video Progress Ping\n(e.g. 78.5% or 100.0%)", label_offset=(0, 0.25))
    draw_arrow(ax, -2.0, 0.85, -2.0, 1.9, "Update progress_percentage (D6)", color="#059669")
    draw_arrow(ax, -2.0, -0.85, -2.0, -1.9, "Update slot progress (D5)", color="#059669")

    # Decision Branch
    draw_arrow(ax, -1.3, 0.5, 0.2, 1.3, "IF Progress < 100.00%", color=LOCK_RED, rad=0.08, label_offset=(-0.4, 0.45))
    draw_arrow(ax, -1.3, -0.5, 0.2, -1.3, "IF Progress == 100.00%", color=SUCCESS_GREEN, rad=-0.08, label_offset=(-0.4, -0.45))

    # Lockout Path
    draw_arrow(ax, 0.2, 1.8, -3.9, 0.5, "Intercept Logout Attempt:\n'Seat Locked until 100% Complete'", color=LOCK_RED, rad=-0.15, label_offset=(-0.6, 0.6))
    
    # Release Path
    draw_arrow(ax, 1.0, -0.75, 1.0, 0.8, "Notify Lock Cleared", color=SUCCESS_GREEN)
    draw_arrow(ax, 1.0, -2.45, -0.8, -2.45, "Set status='Available', emp_id=NULL (D5)", color=SUCCESS_GREEN, label_offset=(-0.1, -0.2))
    draw_arrow(ax, 1.85, -1.6, 3.7, -1.6, "Frees Platform Seat ONLY:\nNotify Queued Candidate", color=SUCCESS_GREEN, label_offset=(0.0, 0.25))

    plt.tight_layout()
    out = "backend/scripts/diagrams/dfd_level_2_gatekeeper.png"
    plt.savefig(out, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")

# ==============================================================================
# 5. MODEL A VS MODEL B ARCHITECTURAL COMPARISON DIAGRAM
# ==============================================================================
def generate_model_comparison():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6.2), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')

    for ax in (ax1, ax2):
        ax.set_xlim(-0.5, 5.5)
        ax.set_ylim(-0.5, 6.5)
        ax.axis('off')

    # LEFT: MODEL A
    card1 = patches.FancyBboxPatch((-0.2, -0.2), 5.4, 6.4, boxstyle="round,pad=0.08,rounding_size=0.25", facecolor="#F8FAFC", edgecolor="#CBD5E1", lw=1.5, zorder=1)
    ax1.add_patch(card1)
    ax1.text(2.5, 5.8, "MODEL A: GLOBAL EMAIL CAP", ha='center', va='center', fontsize=11, fontweight='bold', color=PRIMARY_NAVY)
    ax1.text(2.5, 5.4, "(Single Shared 4-Seat Pool Across All Platforms)", ha='center', va='center', fontsize=8.5, color=MUTED_SLATE)

    m1 = patches.FancyBboxPatch((0.8, 4.3), 3.4, 0.7, boxstyle="round,pad=0.04,rounding_size=0.15", facecolor=BOX_BG_BLUE, edgecolor=BORDER_BLUE, lw=1.8, zorder=2)
    ax1.add_patch(m1)
    ax1.text(2.5, 4.65, "Corporate Mailbox: elearning1@gmail.com\n(MaxSlots = 4 Globally)", ha='center', va='center', fontsize=8.5, fontweight='bold', color=PRIMARY_NAVY)

    slots1_box = patches.FancyBboxPatch((0.4, 1.4), 4.2, 2.5, boxstyle="round,pad=0.05,rounding_size=0.15", facecolor="#FFFFFF", edgecolor="#94A3B8", lw=1.2, zorder=2)
    ax1.add_patch(slots1_box)
    ax1.text(2.5, 3.65, "Shared Concurrency Pool (4 Slots Max)", ha='center', va='center', fontsize=8.5, fontweight='bold', color=PRIMARY_NAVY)

    slot_items_a = [
        ("Slot 1", "Imran Khan", "Udemy (Python)", "65% -> LOCKED", "#FEE2E2", LOCK_RED),
        ("Slot 2", "Sarah Jenkins", "Udemy (Docker)", "82% -> LOCKED", "#FEE2E2", LOCK_RED),
        ("Slot 3", "Michael Chen", "Coursera (GCP)", "100% -> RELEASED", "#DCFCE7", SUCCESS_GREEN),
        ("Slot 4", "[OPEN SEAT]", "Available for any platform", "1 Seat Open", "#EFF6FF", "#2563EB")
    ]
    for idx, (s_num, emp, crs, prog, bg, fg) in enumerate(slot_items_a):
        sy = 3.2 - idx * 0.52
        s_box = patches.FancyBboxPatch((0.6, sy - 0.2), 3.8, 0.42, boxstyle="round,pad=0.03,rounding_size=0.1", facecolor=bg, edgecolor="none", zorder=3)
        ax1.add_patch(s_box)
        ax1.text(0.75, sy, f"{s_num}: {emp} — {crs}", ha='left', va='center', fontsize=7.2, fontweight='bold', color=SLATE_TEXT, zorder=4)
        ax1.text(4.2, sy, prog, ha='right', va='center', fontsize=7.0, fontweight='bold', color=fg, zorder=4)

    ax1.text(2.5, 0.6, "CAPACITY: 3/4 Occupied | 1 Slot Open\nTotal Capacity = 4 Learners Across All Providers", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#1E3A8A", bbox=dict(boxstyle="round,pad=0.3", fc="#DBEAFE", ec="#93C5FD", lw=1))

    # RIGHT: MODEL B (CONFIRMED STANDARD)
    card2 = patches.FancyBboxPatch((-0.2, -0.2), 5.4, 6.4, boxstyle="round,pad=0.08,rounding_size=0.25", facecolor="#F0FDF4", edgecolor="#16A34A", lw=2.2, zorder=1)
    ax2.add_patch(card2)
    ax2.text(2.5, 5.85, "MODEL B: (EMAIL + PROVIDER) PAIR CAP ⭐", ha='center', va='center', fontsize=11, fontweight='bold', color="#15803D")
    ax2.text(2.5, 5.45, "CONFIRMED IMPLEMENTATION STANDARD", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#166534")

    m2 = patches.FancyBboxPatch((0.8, 4.45), 3.4, 0.58, boxstyle="round,pad=0.04,rounding_size=0.15", facecolor="#DCFCE7", edgecolor="#22C55E", lw=1.8, zorder=2)
    ax2.add_patch(m2)
    ax2.text(2.5, 4.74, "Corporate Mailbox: elearning1@gmail.com", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#14532D")

    p1_box = patches.FancyBboxPatch((0.1, 1.4), 2.3, 2.7, boxstyle="round,pad=0.04,rounding_size=0.15", facecolor="#FFFFFF", edgecolor="#3B82F6", lw=1.4, zorder=2)
    ax2.add_patch(p1_box)
    ax2.text(1.25, 3.85, "Udemy Pool\n(4 Slots Independent)", ha='center', va='center', fontsize=8, fontweight='bold', color="#1E40AF")
    u_slots = [
        ("S1", "Imran (65%)", "#FEE2E2", LOCK_RED),
        ("S2", "Sarah (82%)", "#FEE2E2", LOCK_RED),
        ("S3", "Dave (30%)", "#FEE2E2", LOCK_RED),
        ("S4", "[OPEN]", "#EFF6FF", "#2563EB")
    ]
    for idx, (s, label, bg, fg) in enumerate(u_slots):
        sy = 3.3 - idx * 0.45
        sb = patches.FancyBboxPatch((0.2, sy - 0.18), 2.1, 0.36, boxstyle="round,pad=0.02,rounding_size=0.08", facecolor=bg, edgecolor="none", zorder=3)
        ax2.add_patch(sb)
        ax2.text(0.3, sy, f"{s}: {label}", ha='left', va='center', fontsize=6.8, fontweight='bold', color=fg, zorder=4)

    p2_box = patches.FancyBboxPatch((2.6, 1.4), 2.3, 2.7, boxstyle="round,pad=0.04,rounding_size=0.15", facecolor="#FFFFFF", edgecolor="#0D9488", lw=1.4, zorder=2)
    ax2.add_patch(p2_box)
    ax2.text(3.75, 3.85, "Coursera Pool\n(4 Slots Independent)", ha='center', va='center', fontsize=8, fontweight='bold', color="#0F766E")
    c_slots = [
        ("S1", "Michael (100%)", "#DCFCE7", SUCCESS_GREEN),
        ("S2", "Priya (15%)", "#FEE2E2", LOCK_RED),
        ("S3", "[OPEN]", "#F0FDFA", "#0D9488"),
        ("S4", "[OPEN]", "#F0FDFA", "#0D9488")
    ]
    for idx, (s, label, bg, fg) in enumerate(c_slots):
        sy = 3.3 - idx * 0.45
        sb = patches.FancyBboxPatch((2.7, sy - 0.18), 2.1, 0.36, boxstyle="round,pad=0.02,rounding_size=0.08", facecolor=bg, edgecolor="none", zorder=3)
        ax2.add_patch(sb)
        ax2.text(2.8, sy, f"{s}: {label}", ha='left', va='center', fontsize=6.8, fontweight='bold', color=fg, zorder=4)

    arrow1 = patches.FancyArrowPatch((2.0, 4.4), (1.25, 4.15), arrowstyle="-|>", mutation_scale=10, color="#3B82F6", lw=1.5, zorder=3)
    ax2.add_patch(arrow1)
    arrow2 = patches.FancyArrowPatch((3.0, 4.4), (3.75, 4.15), arrowstyle="-|>", mutation_scale=10, color="#0D9488", lw=1.5, zorder=3)
    ax2.add_patch(arrow2)

    ax2.text(2.5, 0.6, "CAPACITY: 3/4 Udemy + 2/4 Coursera\nTotal Mailbox Capacity = 8 Active Learners", ha='center', va='center', fontsize=8.5, fontweight='bold', color="#166534", bbox=dict(boxstyle="round,pad=0.3", fc="#DCFCE7", ec="#86EFAC", lw=1))

    plt.tight_layout()
    out = "backend/scripts/diagrams/dfd_model_a_vs_b_comparison.png"
    plt.savefig(out, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")

if __name__ == "__main__":
    generate_level_0()
    generate_level_1()
    generate_level_2_cascade()
    generate_level_2_gatekeeper()
    generate_model_comparison()
    print("All Model B diagrams generated successfully!")
