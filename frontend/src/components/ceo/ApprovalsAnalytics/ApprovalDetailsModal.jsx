import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import axios from "axios";
import "../../../styles/ceo/ApprovalsAnalytics.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ApprovalDetailsModal({
    approval,
    onClose,
    onApprove,
    onReject,
}) {
    const [liveData, setLiveData] = useState(null);

    const isCert =
        approval?.type === "Certification" ||
        approval?.isCertification ||
        Boolean(approval?.scheduledExamDate || approval?.raw?.scheduled_exam_date);

    useEffect(() => {
        if (!approval) return;
        let isMounted = true;
        const certId =
            approval.certId ||
            approval.raw?.id ||
            approval.requestId ||
            (typeof approval.id === "number" ? approval.id : null) ||
            approval.id;
        const courseId = approval.new_course_id || (typeof approval.id === "number" ? approval.id : null);

        if (isCert && certId && !liveData) {
            axios.get(`${API_BASE_URL}/api/certifications/requests/${certId}`)
                .then((res) => {
                    if (isMounted && res.data) {
                        setLiveData(res.data);
                    }
                })
                .catch((err) => {
                    console.warn("[CEO ApprovalDetailsModal] Fetch cert error:", err);
                });
        } else if (!isCert && courseId && (!approval.courseLink || !approval.whyLearn || approval.courseLink === "—")) {
            axios.get(`${API_BASE_URL}/api/course-requests/${courseId}`)
                .then((res) => {
                    if (isMounted && res.data) {
                        setLiveData(res.data);
                    }
                })
                .catch((err) => {
                    console.warn("[CEO ApprovalDetailsModal] Fetch course error:", err);
                });
        }
        return () => {
            isMounted = false;
        };
    }, [approval, isCert]);

    // Handle Escape key to close modal
    useEffect(() => {
        if (!approval) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [approval, onClose]);

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
        approval.certificate ||
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

    const isRejected =
        String(approval.status || "").toLowerCase() === "rejected" ||
        String(activeRecord.status || "").toLowerCase() === "rejected" ||
        String(activeRecord.ceo_status || "").toLowerCase() === "rejected" ||
        String(approval.raw?.status || "").toLowerCase() === "rejected" ||
        String(approval.raw?.ceo_status || "").toLowerCase() === "rejected";

    const rejectReason =
        approval.rejection_reason ||
        approval.rejectionReason ||
        approval.reject_reason ||
        approval.comment ||
        approval.comments ||
        activeRecord.rejection_reason ||
        activeRecord.comment ||
        activeRecord.comments ||
        approval.raw?.rejection_reason ||
        approval.raw?.comment ||
        approval.raw?.comments ||
        (isRejected ? "Course content does not align with current organizational skill priorities." : null);

    const modalTitle = isCert ? "Certification Approval Details" : "Course Approval Details";
    const modalSubtitle = isCert
        ? "View the certification details, scheduled exam date, and approval information."
        : "View the course details, learning purpose, and approval information.";

    const modalContent = (
        <div className="ceo-cad-modal-overlay">
            <div
                className="ceo-cad-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button Top-Right */}
                <button
                    type="button"
                    onClick={onClose}
                    className="ceo-cad-close-btn"
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                {/* Modal Title & Subtitle */}
                <div className="ceo-cad-header">
                    <h2 className="ceo-cad-title">{modalTitle}</h2>
                    <p className="ceo-cad-subtitle">{modalSubtitle}</p>
                </div>

                {/* Top Meta Bar */}
                <div className="ld-cad-bypass-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div className="ld-cad-request-date-wrap">
                        <span className="ld-cad-request-date-label">Request Date:</span>
                        <span className="ld-cad-request-date-value">{requestDate}</span>
                    </div>
                </div>

                {/* Key-Value Details Grid */}
                <div className="ceo-cad-grid">
                    {/* Request ID */}
                    <div className="ceo-cad-row">
                        <span className="ceo-cad-label">Request ID</span>
                        <span className="ceo-cad-value">{requestId}</span>
                    </div>

                    {/* Employee Name */}
                    <div className="ceo-cad-row">
                        <span className="ceo-cad-label">Employee Name</span>
                        <span className="ceo-cad-value">{employeeName}</span>
                    </div>

                    {/* Item Name */}
                    <div className="ceo-cad-row">
                        <span className="ceo-cad-label">{isCert ? "Certification Name" : "Course Name"}</span>
                        <span className="ceo-cad-value">{certOrCourseName}</span>
                    </div>

                    {/* Provide / Platform */}
                    <div className="ceo-cad-row">
                        <span className="ceo-cad-label">Provide / Platform</span>
                        <span className="ceo-cad-value">{platform}</span>
                    </div>

                    {/* Category */}
                    <div className="ceo-cad-row">
                        <span className="ceo-cad-label">{isCert ? "Certification Category" : "Course Category"}</span>
                        <span className="ceo-cad-value">{category}</span>
                    </div>

                    {/* Scheduled Date or Course Link */}
                    {isCert ? (
                        <div className="ceo-cad-row">
                            <span className="ceo-cad-label">Scheduled Exam Date</span>
                            <span className="ceo-cad-value">{scheduledDate || "Not Scheduled"}</span>
                        </div>
                    ) : (
                        <div className="ceo-cad-row">
                            <span className="ceo-cad-label">Course Link</span>
                            {courseLink && courseLink !== "—" ? (
                                <a
                                    href={courseLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ceo-cad-link"
                                >
                                    {courseLink}
                                </a>
                            ) : (
                                <span className="ceo-cad-value">—</span>
                            )}
                        </div>
                    )}

                    {/* Amount */}
                    {isCert && (
                        <div className="ceo-cad-row">
                            <span className="ceo-cad-label">Amount</span>
                            <span className="ceo-cad-value">{amount}</span>
                        </div>
                    )}

                    {/* Purpose / Why learn */}
                    <div className="ceo-cad-row">
                        <span className="ceo-cad-label">
                            {isCert ? "Purpose of Certification" : "Why do you want to learn this course?"}
                        </span>
                        <span className="ceo-cad-value">{whyLearn}</span>
                    </div>

                    {/* Reject Reason (shown when request is rejected or reason exists) */}
                    {(isRejected || rejectReason) && (
                        <div className="ceo-cad-row">
                            <span className="ceo-cad-label">Reject Reason</span>
                            <span className="ceo-cad-value" style={isRejected ? { color: "#4d4d4d" } : undefined}>
                                {rejectReason}
                            </span>
                        </div>
                    )}
                </div>

                {/* Modal Footer (only when pending approval actions exist) */}
                {approval.status === "Pending" && (onApprove || onReject) && (
                    <div className="ceo-cad-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button
                            type="button"
                            className="ceo-cad-reject-btn"
                            onClick={() => {
                                if (onReject) onReject(approval);
                                onClose();
                            }}
                        >
                            <X size={13} strokeWidth={2.5} />
                            <span>Reject</span>
                        </button>
                        <button
                            type="button"
                            className="ceo-cad-approve-btn"
                            onClick={() => {
                                if (onApprove) onApprove(approval);
                                onClose();
                            }}
                        >
                            <Check size={13} strokeWidth={2.5} />
                            <span>Approve</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
