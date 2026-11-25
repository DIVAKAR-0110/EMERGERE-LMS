import React from "react";
import { X, Clock, DollarSign, Calendar, BookOpen, User, Building } from "lucide-react";

export default function CourseDetailsModal({ isOpen, onClose, data, type = "course" }) {
    if (!isOpen || !data) return null;

    const courseTitle = data.courseTitle || data.course || "Course Details";
    const employee = data.employee || data.requestedBy || { name: "Employee", role: "Team Member", initials: "EM" };

    return (
        <div className="ld-cm-modal-overlay">
            <div className="ld-cm-modal-card" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="ld-cm-modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                <div className="ld-cm-modal-header">
                    <h2 className="ld-cm-modal-title">Course Information</h2>
                    <p className="ld-cm-modal-subtitle">
                        Comprehensive overview of the course and assignment records.
                    </p>
                </div>

                {/* Course Overview Card */}
                <div style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                                {courseTitle}
                            </h3>
                            <span style={{ fontSize: 13, color: "#64748B" }}>
                                Provider: <strong style={{ color: "#1E293B" }}>{data.provider || "—"}</strong>
                            </span>
                        </div>
                        {data.category && (
                            <span className="ld-cm-category-badge" style={{ backgroundColor: "#EBF3FF", color: "#2563EB" }}>
                                {data.category}
                            </span>
                        )}
                    </div>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                        gap: 12,
                        paddingTop: 8,
                        borderTop: "1px solid #E2E8F0"
                    }}>
                        {data.duration && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 11, color: "#64748B" }}>Duration</span>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>{data.duration}</span>
                            </div>
                        )}
                        {data.price && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 11, color: "#64748B" }}>Price</span>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2563EB" }}>{data.price}</span>
                            </div>
                        )}
                        {data.status && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 11, color: "#64748B" }}>Status</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>{data.status}</span>
                            </div>
                        )}
                        {data.activeUsers && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 11, color: "#64748B" }}>Active Users</span>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>{data.activeUsers}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Employee Info Card */}
                {employee && employee.name && (
                    <div style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 12
                    }}>
                        <div
                            className="ld-cm-avatar-circle"
                            style={{
                                width: 40,
                                height: 40,
                                fontSize: 14,
                                backgroundColor: employee.avatarBg || "#2563EB"
                            }}
                        >
                            {employee.initials || "EM"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A" }}>
                                {employee.name} {employee.empId ? `(${employee.empId})` : ""}
                            </span>
                            <span style={{ fontSize: 12, color: "#64748B" }}>
                                {employee.role || employee.department || "Organization Member"}
                            </span>
                        </div>
                    </div>
                )}

                {/* Additional Note or On Hold reason */}
                {data.onHoldReason && (
                    <div className="ld-cm-modal-alert" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600, fontSize: 12, color: "#1E40AF" }}>Hold Reason:</span>
                            <span style={{ fontSize: 12.5 }}>{data.onHoldReason}</span>
                        </div>
                    </div>
                )}

                <div className="ld-cm-modal-footer">
                    <button
                        type="button"
                        className="ld-cm-modal-submit-btn"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
