import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import approveIcon from "../../../assets/coursemanagement/approve.svg";
import holdIcon from "../../../assets/coursemanagement/hold.svg";

export default function RequestDetailsModal({
    isOpen,
    onClose,
    course,
    onApprove,
    onOpenHoldModal,
    currentAdminId,
    currentUser,
}) {
    // Lock body scroll when modal is open to prevent underlying page from scrolling
    React.useEffect(() => {
        if (!isOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    if (!isOpen || !course) return null;

    const courseTitle = course.title || course.courseTitle || course.course || "AWS Certified Data Analytics";
    const provider = course.provider || "—";
    const requestId = course.requestId || "ENR-2026-0012";
    const requestedOn = course.requestedOn || "15 Aug 2026";

    const employee = course.employee || {};
    const employeeName = employee.name || course.employeeName || "Rohan K";
    const department = employee.department || course.department || "L&D";
    const email = employee.email || course.email || "rohan.k@emergertech.com";

    const isOnHold = String(course.status || "").trim().toLowerCase() === "on hold";
    const isApproved = String(course.status || "").trim().toLowerCase() === "approved";

    // Separation of Duties / Self-Approval Prevention Check
    const effectiveAdminId = (
        currentAdminId ||
        currentUser?.employee_id ||
        localStorage.getItem("lms_active_employee_id") ||
        ""
    ).toString().trim().toUpperCase();

    const effectiveUserName = (
        currentUser?.name ||
        ""
    ).toString().trim().toLowerCase();

    const requesterId = (
        course?.employee?.empId ||
        course?.employeeId ||
        course?.employee_id ||
        course?.raw?.employee_id ||
        ""
    ).toString().trim().toUpperCase();

    const requesterName = (
        employeeName ||
        course?.employee?.name ||
        course?.employeeName ||
        course?.raw?.employee_name ||
        ""
    ).toString().trim().toLowerCase();

    const isSelfRequest = Boolean(
        (effectiveAdminId && requesterId && requesterId === effectiveAdminId) ||
        (effectiveUserName && requesterName && requesterName === effectiveUserName)
    );

    const onHoldReason =
        course.onHoldReason ||
        course.on_hold_reason ||
        course.onholdReason ||
        course.holdReason ||
        course.hold_reason ||
        course.reason ||
        course.raw?.onhold_reason ||
        course.raw?.on_hold_reason;
    const showOnHoldReason = isOnHold || Boolean(onHoldReason);
    const displayHoldReason =
        (onHoldReason && String(onHoldReason).trim()) ||
        "Awaiting additional seat allocation.";

    // Format On Hold Date and calculate elapsed days: e.g. "11 Nov 2026 (2 days)"
    const rawOnHoldDate = course.onHoldDate || course.on_hold_date || course.onholdDate || course.raw?.on_hold_date;
    const computeOnHoldInfo = (dateVal) => {
        let d = null;
        if (dateVal) {
            const parsed = new Date(dateVal);
            if (!isNaN(parsed.getTime())) {
                d = parsed;
            }
        }
        if (!d) {
            d = new Date("2026-11-11");
        }
        const formattedDate = d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
        const now = new Date();
        const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.max(0, Math.round((nowMid.getTime() - dMid.getTime()) / (1000 * 60 * 60 * 24)));
        const daysText = diffDays === 1 ? "1 day" : `${diffDays} days`;
        return { formattedDate, daysText };
    };
    const onHoldInfo = computeOnHoldInfo(rawOnHoldDate);

    // Use real employees from backend (do not use hardcoded fake mocks)
    const rawEmployees = Array.isArray(course.otherEmployees) && course.otherEmployees.length > 0
        ? course.otherEmployees
        : (Array.isArray(course.approvedEmployees) && course.approvedEmployees.length > 0
            ? course.approvedEmployees
            : []);

    const reqEmpId = (employee.empId || course.employeeId || course.employee_id || "").trim();
    const reqEmpIdUpper = reqEmpId.toUpperCase();

    // Helper for initials
    const getInitials = (name) => {
        if (!name) return "EM";
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    // Construct the requesting applicant
    const requestingApplicant = {
        empId: reqEmpId || "-",
        name: employeeName || "-",
        department: department || employee.department || course.department || "-",
        avatarBg: employee.avatarBg || course.avatarBg || "-",
        initials: employee.initials || getInitials(employeeName),
        isRequestedBy: true,
    };

    // Filter out duplicate requester from rawEmployees if already present, ensure department is set
    const otherLearners = rawEmployees
        .filter(emp => (emp.empId || emp.employee_id || "").trim().toUpperCase() !== reqEmpIdUpper)
        .map(emp => ({
            ...emp,
            empId: emp.empId || emp.employee_id || "",
            name: emp.name || emp.full_name || "",
            department: emp.department || emp.domain || emp.role || "Engineering",
            avatarBg: emp.avatarBg || "#10B981",
            initials: emp.initials || getInitials(emp.name || emp.full_name || ""),
            isRequestedBy: false,
        }));

    // Combined list: Requester first, then other enrolled learners (up to 4 slots)
    const displayedEmployees = [requestingApplicant, ...otherLearners].slice(0, 4);

    const leftEmployees = displayedEmployees.filter((_, idx) => idx % 2 === 0);
    const rightEmployees = displayedEmployees.filter((_, idx) => idx % 2 === 1);

    const modalContent = (
        <div className="ld-cm-modal-overlay">
            <div className="ld-cm-req-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button
                    type="button"
                    className="ld-cm-req-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div className="ld-cm-req-header">
                    <h2 className="ld-cm-req-title">Request Details</h2>
                    <p className="ld-cm-req-subtitle">
                        View the requested course, employee details, and request information.
                    </p>
                </div>



                {/* Unified Outer Container */}
                <div className="ld-cm-req-container">
                    {/* Course Header (AWS Logo omitted as requested) */}
                    <div className="ld-cm-req-course-header">
                        <span className="ld-cm-req-course-title">{courseTitle}</span>
                        <span className="ld-cm-req-course-provider">{provider}</span>
                    </div>

                    {/* 1. Course Details */}
                    <div>
                        <h4 className="ld-cm-req-sec-title">Course Details</h4>
                        <div className="ld-cm-req-grid-2col">
                            <div className="ld-cm-req-col">
                                <div className="ld-cm-req-row">
                                    <span className="ld-cm-req-label">Request ID</span>
                                    <span className="ld-cm-req-val">{requestId}</span>
                                </div>
                                <div className="ld-cm-req-row">
                                    <span className="ld-cm-req-label">Employee</span>
                                    <span className="ld-cm-req-val">{employeeName}</span>
                                </div>
                                <div className="ld-cm-req-row">
                                    <span className="ld-cm-req-label">Course</span>
                                    <span className="ld-cm-req-val">{courseTitle}</span>
                                </div>
                            </div>

                            <div className="ld-cm-req-divider-v" />

                            <div className="ld-cm-req-col ld-cm-req-col-right">
                                <div className="ld-cm-req-row">
                                    <span className="ld-cm-req-label">Provider</span>
                                    <span className="ld-cm-req-val">{provider}</span>
                                </div>
                                <div className="ld-cm-req-row">
                                    <span className="ld-cm-req-label">Requested On</span>
                                    <span className="ld-cm-req-val">{requestedOn}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ld-cm-req-divider-h" />

                    {/* 2. Course Account Details */}
                    <div>
                        <h4 className="ld-cm-req-sec-title">Course Account Details</h4>
                        <div className="ld-cm-req-col">
                            <div className="ld-cm-req-row">
                                <span className="ld-cm-req-label">Department</span>
                                <span className="ld-cm-req-val">{department}</span>
                            </div>
                            <div className="ld-cm-req-row">
                                <span className="ld-cm-req-label">Account Email ID</span>
                                <span className="ld-cm-req-val">{email}</span>
                            </div>
                        </div>
                    </div>

                    <div className="ld-cm-req-divider-h" />

                    {/* 3. Other Employees */}
                    <div>
                        <h4 className="ld-cm-req-sec-title">
                            Other Employees ({displayedEmployees.length}/4)
                        </h4>
                        {displayedEmployees.length > 0 ? (
                            <div className="ld-cm-req-grid-2col ld-cm-req-employees-grid">
                                <div className="ld-cm-req-col ld-cm-req-emp-col-left" style={{ gap: 8 }}>
                                    {leftEmployees.map((emp, idx) => (
                                        <div key={idx} className="ld-cm-req-emp-card">
                                            <div
                                                className="ld-cm-req-emp-avatar"
                                                style={{ backgroundColor: emp.avatarBg || "#8B5CF6" }}
                                            >
                                                {emp.initials}
                                            </div>
                                            <div className="ld-cm-req-emp-info">
                                                <div className="ld-cm-req-emp-name-wrap">
                                                    <span className="ld-cm-req-emp-name" title={emp.name}>{emp.name}</span>
                                                    {emp.isRequestedBy && (
                                                        <span className="ld-cm-req-badge-reqby">(Requested by)</span>
                                                    )}
                                                </div>
                                                <span
                                                    className="ld-cm-req-emp-sub"
                                                    title={`${emp.empId} | ${emp.department || emp.role || "Department"}`}
                                                >
                                                    {emp.empId} | {emp.department || emp.role || "Department"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="ld-cm-req-divider-v" />

                                <div className="ld-cm-req-col ld-cm-req-emp-col-right" style={{ gap: 8 }}>
                                    {rightEmployees.map((emp, idx) => (
                                        <div key={idx} className="ld-cm-req-emp-card">
                                            <div
                                                className="ld-cm-req-emp-avatar"
                                                style={{ backgroundColor: emp.avatarBg || "#10B981" }}
                                            >
                                                {emp.initials}
                                            </div>
                                            <div className="ld-cm-req-emp-info">
                                                <div className="ld-cm-req-emp-name-wrap">
                                                    <span className="ld-cm-req-emp-name" title={emp.name}>{emp.name}</span>
                                                    {emp.isRequestedBy && (
                                                        <span className="ld-cm-req-badge-reqby">(Requested by)</span>
                                                    )}
                                                </div>
                                                <span
                                                    className="ld-cm-req-emp-sub"
                                                    title={`${emp.empId} | ${emp.department || emp.role || "Department"}`}
                                                >
                                                    {emp.empId} | {emp.department || emp.role || "Department"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: "16px 12px", background: "#F8FAFC", borderRadius: 8, color: "#7f7f7f", fontSize: 13, textAlign: "center" }}>
                                No other employees have been approved for this course yet (4 license slots available).
                            </div>
                        )}
                    </div>

                    {/* 4. On Hold Reason */}
                    {showOnHoldReason && (
                        <>
                            <div className="ld-cm-req-divider-h" />
                            <div>
                                <h4 className="ld-cm-req-sec-title">On Hold Reason</h4>
                                <div className="ld-cm-req-onhold-box">
                                    <span className="ld-cm-req-onhold-text">
                                        {displayHoldReason}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer (Hidden for self-requests as self-approval is not permitted) */}
                {!isApproved && !isSelfRequest && (
                    <div className="ld-cm-req-footer">
                        {isOnHold ? (
                            <>
                                <div className="ld-cm-onhold-info-group">
                                    <span className="ld-cm-onhold-label">On Hold Since:</span>
                                    <span className="ld-cm-onhold-date">
                                        {onHoldInfo.formattedDate} ({onHoldInfo.daysText})
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="ld-cm-approve-btn"
                                    onClick={() => {
                                        onClose();
                                        onApprove && onApprove(course);
                                    }}
                                >
                                    <img src={approveIcon} alt="approve" style={{ width: 10, height: 8 }} />
                                    <span>Approve</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="ld-cm-approve-btn"
                                    onClick={() => {
                                        onClose();
                                        onApprove && onApprove(course);
                                    }}
                                >
                                    <img src={approveIcon} alt="approve" style={{ width: 10, height: 8 }} />
                                    <span>Approve</span>
                                </button>
                                <button
                                    type="button"
                                    className="ld-cm-onhold-btn"
                                    onClick={() => {
                                        onClose();
                                        onOpenHoldModal && onOpenHoldModal(course);
                                    }}
                                >
                                    <img src={holdIcon} alt="hold" style={{ width: 10, height: 10 }} />
                                    <span>On Hold</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
