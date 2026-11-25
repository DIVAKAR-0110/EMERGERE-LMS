import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function AssignmentDetailsModal({ isOpen, onClose, assignment }) {
    if (!isOpen || !assignment) return null;

    const courseTitle = assignment.course || "—";
    const provider = assignment.provider || "—";
    const courseType = assignment.courseType || "—";

    const assignmentId = assignment.assignmentId || assignment.enrollmentCode || assignment.enrollment_code || "—";
    const assignedOn = assignment.assignedOn || "—";
    const assignedBy = assignment.assignedBy || "—";
    const status = assignment.status || "—";
    const progress = assignment.progress ?? 0;

    const employee = assignment.employee || {};
    const rawEmpName = employee.name || assignment.employeeName || "—";
    const employeeName = String(rawEmpName).replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, "");
    const employeeId = employee.empId || assignment.employeeCode || assignment.employee_code || "—";
    const department =
        (employee.department && String(employee.department).toLowerCase() !== "employee")
            ? employee.department
            : (assignment.employeeDepartment || assignment.department || "—");
    const email = employee.email || employee.work_email || assignment.employeeEmail || assignment.employee_email || assignment.email || "—";

    const curEmpId = (employeeId !== "—" ? employeeId : employee.empId || "").trim().toUpperCase();
    const primaryEmpRole = (employee.role && String(employee.role).toLowerCase() !== "employee")
        ? employee.role
        : (department || "—");
    const primaryEmpInitials =
        employee.initials ||
        (employeeName !== "—"
            ? employeeName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
            : "—");

    const primaryEmployeeObj = {
        name: employeeName,
        empId: employeeId,
        role: primaryEmpRole,
        initials: primaryEmpInitials,
        avatarBg: employee.avatarBg || "#8B5CF6",
    };

    // Combine candidate sources: approvedEmployees from backend + otherEmployees
    const candidateEmployees = [
        ...(Array.isArray(assignment.approvedEmployees) ? assignment.approvedEmployees : []),
        ...(Array.isArray(assignment.otherEmployees) ? assignment.otherEmployees : []),
    ];

    const allAssignedEmployees = [];
    const seenEmpIds = new Set();

    // Place primary respective employee first (matching Figma design where primary employee is included in the 4-slot grid)
    if (curEmpId) {
        seenEmpIds.add(curEmpId);
        allAssignedEmployees.push(primaryEmployeeObj);
    }

    // Add remaining assigned colleagues
    for (const emp of candidateEmployees) {
        const id = String(emp.empId || emp.employee_id || emp.id || "").trim().toUpperCase();
        if (id && !seenEmpIds.has(id)) {
            seenEmpIds.add(id);
            const name = String(emp.name || emp.full_name || id).replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, "");
            const initials = emp.initials || name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            allAssignedEmployees.push({
                name: name,
                empId: emp.empId || emp.employee_id || id,
                role: emp.role || emp.job_title || "—",
                initials: initials,
                avatarBg: emp.avatarBg || null,
            });
        }
    }

    // Limit to max 4 license seats
    const displayedEmployees = allAssignedEmployees.slice(0, 4);

    // Apply distinctive palette colors matching Figma (Purple, Pink, Green, Orange)
    const avatarPalette = ["#8B5CF6", "#F43F5E", "#10B981", "#F59E0B"];
    const enrichedDisplayedEmployees = displayedEmployees.map((emp, idx) => ({
        ...emp,
        avatarBg: emp.avatarBg || avatarPalette[idx % avatarPalette.length],
    }));

    const leftEmployees = enrichedDisplayedEmployees.filter((_, idx) => idx % 2 === 0);
    const rightEmployees = enrichedDisplayedEmployees.filter((_, idx) => idx % 2 === 1);

    const statusStyle = (() => {
        if (status === "In Progress")
            return { background: "#F1F2F8", color: "#215EF8", border: "0.5px solid #A1BCFF" };
        if (status === "Completed")
            return { background: "#EEFBF5", color: "#0EAB61", border: "0.5px solid #AEEDBE" };
        if (status === "Not Started")
            return { background: "#F2F2F2", color: "#777879", border: "0.5px solid #B8B8B8" };
        if (status === "Overdue")
            return { background: "#FEF2F2", color: "#DC2626", border: "0.5px solid #FECACA" };
        if (status === "Assigned")
            return { background: "#F5F3FF", color: "#7C3AED", border: "0.5px solid #DDD6FE" };
        return { background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A" };
    })();

    const progressFill = progress === 100 ? "#0EAB61" : "#215EF8";

    const modalContent = (
        <div className="ld-cm-modal-overlay">
            <div className="ld-cm-asg-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="ld-cm-asg-modal-close"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div className="ld-cm-asg-header">
                    <h2 className="ld-cm-asg-title">Assignment Details</h2>
                    <p className="ld-cm-asg-subtitle">
                        View course assignment details and assigned employees.
                    </p>
                </div>

                {/* Main Content Box */}
                <div className="ld-cm-asg-container">
                    {/* Course Header (AWS Logo omitted as requested) */}
                    <div className="ld-cm-asg-course-header">
                        <div className="ld-cm-asg-course-meta">
                            <span className="ld-cm-asg-course-title">{courseTitle}</span>
                            <span className="ld-cm-asg-course-provider">{provider}</span>
                        </div>
                        {/* <span className="ld-cm-asg-badge-purchased">{courseType}</span> */}
                    </div>


                    {/* Section 1: Assignment Information */}
                    <div className="ld-cm-asg-section">
                        <h4 className="ld-cm-asg-sec-title">Assignment Information</h4>
                        <div className="ld-cm-asg-info-grid">
                            <div className="ld-cm-asg-info-col">
                                <div className="ld-cm-asg-row">
                                    <span className="ld-cm-asg-label">Assignment ID</span>
                                    <span className="ld-cm-asg-val">{assignmentId}</span>
                                </div>
                                <div className="ld-cm-asg-row">
                                    <span className="ld-cm-asg-label">Assigned On</span>
                                    <span className="ld-cm-asg-val">{assignedOn}</span>
                                </div>
                                <div className="ld-cm-asg-row">
                                    <span className="ld-cm-asg-label">Assigned By</span>
                                    <span className="ld-cm-asg-val">{assignedBy}</span>
                                </div>
                            </div>

                            <div className="ld-cm-asg-divider-v" />

                            <div className="ld-cm-asg-info-col" style={{ gap: 8 }}>
                                <div className="ld-cm-asg-status-row">
                                    <span className="ld-cm-asg-label" style={{ minWidth: 55 }}>Status</span>
                                    <span className="ld-cm-asg-status-badge" style={statusStyle}>
                                        {status}
                                    </span>
                                </div>
                                <div className="ld-cm-asg-progress-row">
                                    <span className="ld-cm-asg-label" style={{ minWidth: 55 }}>Progress</span>
                                    <div className="ld-cm-asg-progress-bar">
                                        <div
                                            className="ld-cm-asg-progress-fill"
                                            style={{ width: `${progress}%`, background: progressFill }}
                                        />
                                    </div>
                                    <span className="ld-cm-asg-progress-text">{progress}%</span>
                                </div>
                                {(assignment.startDate || assignment.learning_starting_date) && (
                                    <div className="ld-cm-asg-row" style={{ gridTemplateColumns: "55px 1fr" }}>
                                        <span className="ld-cm-asg-label">Start Date</span>
                                        <span className="ld-cm-asg-val">{assignment.startDate || assignment.learning_starting_date}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {(assignment.assignmentNote || assignment.assignment_note || assignment.note) && (
                            <div style={{ marginTop: 10, padding: "8px 12px", background: "#F1F5F9", borderRadius: 6, fontSize: 11.5, color: "#334155", width: "100%", boxSizing: "border-box" }}>
                                <strong style={{ color: "#0F172A" }}>Note:</strong> {assignment.assignmentNote || assignment.assignment_note || assignment.note}
                            </div>
                        )}
                    </div>

                    <div className="ld-cm-asg-divider-h" />

                    {/* Section 2: Employee Details */}
                    <div className="ld-cm-asg-section">
                        <h4 className="ld-cm-asg-sec-title">Employee Details</h4>
                        <div className="ld-cm-asg-info-col" style={{ gap: 10 }}>
                            <div className="ld-cm-asg-row">
                                <span className="ld-cm-asg-label">Employee</span>
                                <span className="ld-cm-asg-val">{employeeName} ({employeeId})</span>
                            </div>
                            <div className="ld-cm-asg-row">
                                <span className="ld-cm-asg-label">Department</span>
                                <span className="ld-cm-asg-val">{department}</span>
                            </div>
                            <div className="ld-cm-asg-row">
                                <span className="ld-cm-asg-label">Email ID</span>
                                <span className="ld-cm-asg-val">{email}</span>
                            </div>
                        </div>
                    </div>

                    <div className="ld-cm-asg-divider-h" />

                    {/* Section 3: Other Employees */}
                    <div className="ld-cm-asg-section">
                        <h4 className="ld-cm-asg-sec-title">
                            Other Employees ({enrichedDisplayedEmployees.length}/4)
                        </h4>
                        {enrichedDisplayedEmployees.length > 0 ? (
                            <div className="ld-cm-asg-employees-grid">
                                <div className="ld-cm-asg-emp-list">
                                    {leftEmployees.map((emp, i) => (
                                        <div key={i} className="ld-cm-asg-emp-card">
                                            <div
                                                className="ld-cm-asg-emp-avatar"
                                                style={{ background: emp.avatarBg || "#A87FFF" }}
                                            >
                                                {emp.initials}
                                            </div>
                                            <div className="ld-cm-asg-emp-info">
                                                <span className="ld-cm-asg-emp-name">{emp.name}</span>
                                                <span className="ld-cm-asg-emp-sub">{emp.empId} | {emp.role}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="ld-cm-asg-divider-v" />

                                <div className="ld-cm-asg-emp-list">
                                    {rightEmployees.map((emp, i) => (
                                        <div key={i} className="ld-cm-asg-emp-card">
                                            <div
                                                className="ld-cm-asg-emp-avatar"
                                                style={{ background: emp.avatarBg || "#5CDE8A" }}
                                            >
                                                {emp.initials}
                                            </div>
                                            <div className="ld-cm-asg-emp-info">
                                                <span className="ld-cm-asg-emp-name">{emp.name}</span>
                                                <span className="ld-cm-asg-emp-sub">{emp.empId} | {emp.role}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: "16px 12px", background: "#F8FAFC", borderRadius: 8, color: "#64748B", fontSize: 13, textAlign: "center" }}>
                                No other employees have been assigned to this course yet (4 license slots available).
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
