import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, Undo2 } from "lucide-react";
import axios from "axios";
import "../../../styles/L&D/dashboard.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ApprovalDetailsModal({
    approval,
    onClose,
    onApprove,
    onReject,
    onUndoReject,
    readOnly = false,
    currentAdminId,
    currentUser,
}) {
    const [liveData, setLiveData] = useState(null);
    const [bypassCeo, setBypassCeo] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isCert =
        approval?.type === "Certification" ||
        approval?.isCertification ||
        Boolean(approval?.scheduledExamDate || approval?.raw?.scheduled_exam_date);

    useEffect(() => {
        if (!approval) return;
        setLiveData(null);
        setBypassCeo(false);
        setIsSubmitting(false);

        let isMounted = true;
        const certId =
            approval.certId ||
            approval.raw?.id ||
            approval.requestId ||
            (typeof approval.id === "number" ? approval.id : null) ||
            approval.id;
        const courseId = approval.new_course_id || (typeof approval.id === "number" ? approval.id : null);

        if (isCert && certId) {
            axios.get(`${API_BASE_URL}/api/certifications/requests/${certId}`)
                .then((res) => {
                    if (isMounted && res.data) {
                        setLiveData(res.data);
                    }
                })
                .catch((err) => {
                    console.warn("[ApprovalDetailsModal] Fetch cert error:", err);
                });
        } else if (!isCert && courseId) {
            axios.get(`${API_BASE_URL}/api/course-requests/${courseId}`)
                .then((res) => {
                    if (isMounted && res.data) {
                        setLiveData(res.data);
                    }
                })
                .catch((err) => {
                    console.warn("[ApprovalDetailsModal] Fetch course error:", err);
                });
        }
        return () => {
            isMounted = false;
        };
    }, [approval, isCert]);

    if (!approval) return null;

    const activeRecord = liveData || {};

    const requestId =
        approval.id ||
        approval.requestId ||
        approval.raw?.request_code ||
        activeRecord.request_code ||
        (typeof activeRecord.id === "number" ? `CLM-2026-${String(activeRecord.id).padStart(4, "0")}` : activeRecord.id) ||
        "—";

    const employeeName =
        approval.name ||
        approval.employee ||
        approval.employeeName ||
        activeRecord.employee_name ||
        approval.raw?.employee_name ||
        "—";

    const rawDate =
        approval.requestDate ||
        approval.requestedOn ||
        approval.created_at ||
        activeRecord.created_at ||
        activeRecord.request_date ||
        approval.raw?.created_at;

    const formatReqDate = (d) => {
        if (!d || d === "—") return "—";
        if (typeof d === "string" && !d.includes("T") && !d.includes("-")) return d;
        try {
            const parsed = new Date(d);
            if (isNaN(parsed.getTime())) return d;
            return parsed.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        } catch {
            return d;
        }
    };

    const requestDate = approval.requestDate || formatReqDate(rawDate) || "—";

    const rawAmount =
        approval.amount ||
        activeRecord.amount ||
        (activeRecord.estimated_cost_inr != null
            ? `₹${Number(activeRecord.estimated_cost_inr).toLocaleString()}`
            : null) ||
        (approval.raw?.estimated_cost_inr != null
            ? `₹${Number(approval.raw.estimated_cost_inr).toLocaleString()}`
            : null) ||
        "—";

    const amount =
        typeof rawAmount === "string" && !rawAmount.startsWith("₹") && !isNaN(Number(rawAmount))
            ? `₹${Number(rawAmount).toLocaleString()}`
            : rawAmount;

    const certOrCourseName =
        activeRecord.certification_name ||
        activeRecord.course_name ||
        approval.courseName ||
        approval.course ||
        (approval.detail?.includes("—")
            ? approval.detail.split("—")[0].trim()
            : approval.detail) ||
        "—";

    const platform =
        activeRecord.provider_name ||
        activeRecord.provider ||
        approval.provide ||
        approval.platform ||
        approval.provider ||
        (approval.detail?.includes("—")
            ? approval.detail.split("—")[1].trim()
            : null) ||
        "—";

    const category =
        activeRecord.category_name ||
        activeRecord.category ||
        approval.category ||
        approval.courseCategory ||
        "—";

    const scheduledDate =
        activeRecord.scheduled_exam_date ||
        approval.scheduledExamDate ||
        approval.raw?.scheduled_exam_date;

    const courseLink =
        activeRecord.course_link ||
        approval.courseLink ||
        approval.link ||
        "—";

    const whyLearn =
        activeRecord.purpose ||
        activeRecord.reason ||
        approval.whyLearn ||
        approval.reason ||
        approval.description ||
        "—";

    const currentStatus = approval.status || activeRecord.ld_status || "Pending";
    const isRejected = currentStatus === "Rejected" || approval.status === "Rejected" || activeRecord.ld_status === "Rejected";
    const canTakeAction = !readOnly && currentStatus === "Pending" && Boolean(onApprove && onReject);
    const canUndoReject = !readOnly && isRejected && Boolean(onUndoReject);

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
        approval?.empId ||
        approval?.employeeId ||
        approval?.employee_id ||
        approval?.raw?.employee_id ||
        activeRecord?.employee_id ||
        ""
    ).toString().trim().toUpperCase();

    const requesterName = (
        approval?.name ||
        approval?.employee ||
        approval?.employeeName ||
        approval?.raw?.employee_name ||
        activeRecord?.employee_name ||
        ""
    ).toString().trim().toLowerCase();

    const isSelfRequest = Boolean(
        (effectiveAdminId && requesterId && requesterId === effectiveAdminId) ||
        (effectiveUserName && requesterName && requesterName === effectiveUserName)
    );

    const rejectReason =
        activeRecord.rejection_reason ||
        activeRecord.reject_reason ||
        approval.rejection_reason ||
        approval.reject_reason ||
        approval.raw?.rejection_reason ||
        approval.raw?.reject_reason ||
        (isRejected ? (activeRecord.reopen_reason || approval.reopen_reason || approval.raw?.reopen_reason) : null);

    const undoReason =
        (!isRejected && (
            activeRecord.undo_reason ||
            activeRecord.reopen_reason ||
            approval.undo_reason ||
            approval.reopen_reason ||
            approval.raw?.undo_reason ||
            approval.raw?.reopen_reason
        )) || null;

    const modalTitle = isCert ? "Certification Approval Details" : "Course Approval Details";
    const modalSubtitle = isCert
        ? "View the certification details, scheduled exam date, and approval information."
        : "View the course details, learning purpose, and approval information.";

    const modalContent = (
        <div className="ld-cad-modal-overlay">
            <div
                className="ld-cad-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button Top-Right */}
                <button
                    type="button"
                    onClick={onClose}
                    className="ld-cad-close-btn"
                    aria-label="Close modal"
                    disabled={isSubmitting}
                >
                    <X size={18} />
                </button>

                {/* Modal Title & Subtitle */}
                <div className="ld-cad-header">
                    <h2 className="ld-cad-title">{modalTitle}</h2>
                    <p className="ld-cad-subtitle">{modalSubtitle}</p>
                </div>

                {/* Top Meta Bar: Request Date (Left) & Bypass CEO Approval Toggle (Right) */}
                <div className="ld-cad-bypass-bar">
                    <div className="ld-cad-request-date-wrap">
                        <span className="ld-cad-request-date-label">Request Date:</span>
                        <span className="ld-cad-request-date-value">{requestDate}</span>
                    </div>

                    {!isSelfRequest && canTakeAction ? (
                        <label className="ld-cad-bypass-toggle-label">
                            <span className="ld-cad-bypass-text">Bypass CEO Approval</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={bypassCeo}
                                className={`ld-cad-bypass-switch ${bypassCeo ? "on" : "off"}`}
                                onClick={() => setBypassCeo((prev) => !prev)}
                                disabled={isSubmitting}
                            >
                                <span className="ld-cad-bypass-knob" />
                                <span className="ld-cad-bypass-state-text">
                                    {bypassCeo ? "ON" : "OFF"}
                                </span>
                            </button>
                        </label>
                    ) : (
                        <div />
                    )}
                </div>



                {/* Key-Value Details Grid */}
                <div className="ld-cad-grid">
                    {/* Request ID */}
                    <div className="ld-cad-row">
                        <span className="ld-cad-label">Request ID</span>
                        <span className="ld-cad-value">{requestId}</span>
                    </div>

                    {/* Employee Name */}
                    <div className="ld-cad-row">
                        <span className="ld-cad-label">Employee Name</span>
                        <span className="ld-cad-value">{employeeName}</span>
                    </div>

                    {/* Item Name */}
                    <div className="ld-cad-row">
                        <span className="ld-cad-label">{isCert ? "Certification Name" : "Course Name"}</span>
                        <span className="ld-cad-value">{certOrCourseName}</span>
                    </div>

                    {/* Provide / Platform */}
                    <div className="ld-cad-row">
                        <span className="ld-cad-label">Provide / Platform</span>
                        <span className="ld-cad-value">{platform}</span>
                    </div>

                    {/* Category */}
                    <div className="ld-cad-row">
                        <span className="ld-cad-label">{isCert ? "Certification Category" : "Course Category"}</span>
                        <span className="ld-cad-value">{category}</span>
                    </div>

                    {/* Scheduled Date or Course Link */}
                    {isCert ? (
                        <div className="ld-cad-row">
                            <span className="ld-cad-label">Scheduled Exam Date</span>
                            <span className="ld-cad-value">{scheduledDate || "Not Scheduled"}</span>
                        </div>
                    ) : (
                        <div className="ld-cad-row">
                            <span className="ld-cad-label">Course Link</span>
                            {courseLink && courseLink !== "—" ? (
                                <a
                                    href={courseLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ld-cad-link"
                                >
                                    {courseLink}
                                </a>
                            ) : (
                                <span className="ld-cad-value">—</span>
                            )}
                        </div>
                    )}

                    {/* Amount */}
                    {isCert && (
                        <div className="ld-cad-row">
                            <span className="ld-cad-label">Amount</span>
                            <span className="ld-cad-value">{amount}</span>
                        </div>
                    )}

                    {/* Purpose / Why learn */}
                    <div className="ld-cad-row">
                        <span className="ld-cad-label">
                            {isCert ? "Purpose of Certification" : "Reason for Course Request?"}
                        </span>
                        <span className="ld-cad-value">{whyLearn}</span>
                    </div>

                    {/* Reject Reason (shown when request is Rejected) */}
                    {isRejected && (
                        <div className="ld-cad-row">
                            <span className="ld-cad-label">Reject Reason</span>
                            <span className="ld-cad-value">
                                {rejectReason || "Course content does not align with current project requirements."}
                            </span>
                        </div>
                    )}

                    {/* Undo Reason (shown when request was reopened/undone) */}
                    {!isRejected && undoReason && (
                        <div className="ld-cad-row">
                            <span className="ld-cad-label">Undo Reason</span>
                            <span className="ld-cad-value">{undoReason}</span>
                        </div>
                    )}
                </div>

                {/* Modal Footer (Hidden for self-requests as self-approval is not permitted) */}
                {!isSelfRequest && (canTakeAction || canUndoReject) && (
                    <div className="ld-cad-footer">
                        {canTakeAction ? (
                            <>
                                <button
                                    type="button"
                                    className="ld-cad-reject-btn"
                                    disabled={isSubmitting}
                                    onClick={() => {
                                        onReject && onReject(approval);
                                    }}
                                >
                                    <X size={13} strokeWidth={2.5} />
                                    <span>Reject</span>
                                </button>
                                <button
                                    type="button"
                                    className="ld-cad-approve-btn"
                                    disabled={isSubmitting}
                                    onClick={async () => {
                                        setIsSubmitting(true);
                                        try {
                                            await onApprove(approval, bypassCeo);
                                        } finally {
                                            setIsSubmitting(false);
                                        }
                                    }}
                                >
                                    <Check size={13} strokeWidth={2.5} />
                                    <span>Approve</span>
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="ld-cad-undo-btn"
                                disabled={isSubmitting}
                                onClick={() => {
                                    onClose && onClose();
                                    onUndoReject && onUndoReject(approval);
                                }}
                                title="Reopen request (Undo Rejection)"
                            >
                                <Undo2 size={13} strokeWidth={2.4} />
                                <span>Undo</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
