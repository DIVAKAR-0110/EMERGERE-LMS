import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, CreditCard, CheckCircle, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import "../../../styles/hr/ApprovalsWorkflow.css";
import PaymentSlipForm from "./PaymentSlipForm";
import CertificateViewerModal from "../../Profile/CertificateViewerModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ApprovalDetailsModal({
    approval,
    requestType,
    readOnly = false,
    onClose,
    onApprove,
    onReject,
    onPaySuccess,
}) {
    const { role, primaryRole, user, isViewingAsEmployee } = useAuth?.() || {};
    const isHR = !readOnly && !isViewingAsEmployee && Boolean(
        role?.toLowerCase().includes("hr") ||
        primaryRole?.toLowerCase().includes("hr") ||
        user?.role?.toLowerCase().includes("hr")
    );

    const [previewModal, setPreviewModal] = useState({ isOpen: false, url: "", cert: null });
    const [showPayForm, setShowPayForm] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                if (previewModal.isOpen) {
                    setPreviewModal({ isOpen: false, url: "", cert: null });
                } else if (onClose) {
                    onClose();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [previewModal.isOpen, onClose]);

    useEffect(() => {
        setShowPayForm(false);
        setPreviewModal({ isOpen: false, url: "", cert: null });
    }, [approval]);

    if (!approval) return null;

    const requestId =
        approval.requestId ||
        approval.requestCode ||
        approval.courseRequestId ||
        approval.id ||
        approval.raw?.request_code ||
        approval.raw?.claim_id ||
        "—";

    const employeeName =
        approval.employeeName ||
        approval.name ||
        approval.employee ||
        approval.requestedBy?.name ||
        approval.raw?.employee_name ||
        "—";

    const rawDate =
        approval.requestDate ||
        approval.requestedOn ||
        approval.created_at ||
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

    // Fallbacks if data is missing or from legacy structure
    const courseName =
        approval.courseTitle ||
        approval.courseName ||
        approval.course ||
        approval.certificate ||
        (approval.detail?.includes("—")
            ? approval.detail.split("—")[0].trim()
            : approval.detail || "AWS Certified Data Analytics");

    const platform =
        approval.provider ||
        approval.provide ||
        approval.platform ||
        approval.raw?.provider_name ||
        approval.raw?.provider ||
        (approval.detail?.includes("—")
            ? approval.detail.split("—")[1].trim()
            : "AWS");

    const category =
        approval.category ||
        approval.category_name ||
        approval.courseCategory ||
        approval.raw?.category_name ||
        approval.raw?.category ||
        "Data Science";

    // Determine whether this request is a Certification Reimbursement or Course Request
    const isCertification = (() => {
        if (requestType === "course") return false;
        if (requestType === "cert") return true;
        // If approval explicitly has course identifiers, it is a course request
        if (approval.course_id || approval.raw?.course_title || approval.raw?.course_name || approval.course_request_code) {
            return false;
        }
        // If approval has certification-specific identifiers, it is a certification request
        if (approval.claimId || approval.raw?.certification_name || (!approval.course_id && Boolean(approval.scheduledExamDate))) {
            return true;
        }
        return approval.category === "Certification";
    })();

    const finalClaimType = isCertification ? "cert" : "course";
    const finalClaimId = isCertification
        ? (approval.claimId || (typeof approval.raw?.id === "number" ? approval.raw?.id : null) || approval.id)
        : (approval.course_id || (typeof approval.raw?.id === "number" ? approval.raw?.id : null) || approval.id);
    const finalClaimCode = approval.id || approval.claim_id || approval.raw?.claim_code;

    const supportingDoc =
        approval.supporting_document_path ||
        approval.raw?.supporting_document_path ||
        approval.support_document ||
        approval.raw?.support_document;

    const courseLink =
        approval.courseUrl ||
        approval.courseLink ||
        approval.link ||
        approval.raw?.course_url ||
        approval.raw?.course_link ||
        (!isCertification ? "https://www.udemy.com" : null);

    const whyLearn =
        approval.whyLearn ||
        approval.description ||
        approval.reason ||
        approval.purpose ||
        approval.raw?.why_learn ||
        approval.raw?.description ||
        approval.raw?.reason ||
        approval.raw?.purpose ||
        approval.raw?.learning_purpose ||
        "To strengthen my data analytics skills, improve data-driven decision-making, and apply advanced analytics techniques in my current role.";

    const isRejected =
        approval.status === "Rejected" ||
        approval.raw?.status === "Rejected" ||
        approval.raw?.hr_status === "Rejected";

    const rejectReason =
        approval.rejection_reason ||
        approval.rejectionReason ||
        approval.reject_reason ||
        approval.raw?.rejection_reason ||
        approval.raw?.reject_reason ||
        approval.raw?.reopen_reason ||
        approval.reopen_reason ||
        approval.comments ||
        approval.comment ||
        approval.raw?.comments ||
        approval.raw?.comment ||
        (isRejected ? "Course content does not align with current organizational skill priorities." : null);

    // Pay eligibility — for Approved course or certification claims
    const isApproved =
        approval.status === "Approved" ||
        approval.raw?.status === "Approved" ||
        approval.raw?.hr_status === "Approved" ||
        approval.purchase_status === "Purchased" ||
        approval.isPurchased;

    // Paid check: matches timeline logic and database records
    const isPaid = Boolean(
        String(approval.payment_status || approval.raw?.payment_status || "").toLowerCase() === "paid" ||
        String(approval.processing_status || approval.processingStatus || approval.raw?.processing_status || "").toLowerCase() === "paid" ||
        approval.paid_on ||
        approval.raw?.paid_on ||
        approval.payment_code ||
        approval.raw?.payment_code ||
        approval.paymentCode ||
        approval.payment_slip_path ||
        approval.raw?.payment_slip_path ||
        approval.raw?.stages?.some((s) => String(s.stage_name || "").toLowerCase() === "claimed" && String(s.stage_status || "").toLowerCase() === "completed") ||
        approval.stages?.some((s) => String(s.stage_name || "").toLowerCase() === "claimed" && String(s.stage_status || "").toLowerCase() === "completed")
    );

    // Raw cost resolution and formatting
    const rawCostVal =
        approval.price ||
        approval.amount ||
        approval.rawCost ||
        approval.estimatedCost ||
        approval.estimated_cost ||
        approval.raw?.price ||
        approval.raw?.amount;

    const formatCost = (val) => {
        if (!val || val === "—") return null;
        if (typeof val === "string" && val.startsWith("₹")) return val;
        const num = Number(String(val).replace(/[^0-9.-]+/g, ""));
        return isNaN(num) ? String(val) : `₹${num.toLocaleString()}`;
    };

    const reimbursementCost = formatCost(rawCostVal);

    // Has reimbursement amount (courses with price, or certification claims with amount)
    const hasAmount =
        Boolean(reimbursementCost && reimbursementCost !== "₹0") ||
        Boolean(approval.amount && approval.amount !== "—" && approval.amount !== "₹0") ||
        Boolean(approval.raw?.amount && Number(approval.raw?.amount) > 0) ||
        Boolean(approval.raw?.price && Number(approval.raw?.price) > 0) ||
        Boolean(approval.rawCost && Number(approval.rawCost) > 0) ||
        Boolean(approval.estimatedCost && Number(approval.estimatedCost) > 0);

    const canPay = isApproved && !isPaid && hasAmount;

    const paymentSlipPath =
        approval.payment_slip_path ||
        approval.raw?.payment_slip_path ||
        approval.paymentSlipPath;

    const paymentSlipName =
        approval.payment_slip_name ||
        approval.raw?.payment_slip_name ||
        approval.paymentSlipName ||
        (paymentSlipPath ? paymentSlipPath.split("/").pop() : "Payment_Slip.pdf");

    const paymentDescription =
        approval.payment_description ||
        approval.raw?.payment_description ||
        approval.paymentDescription ||
        approval.payment_note ||
        approval.raw?.payment_note;

    const paymentCode =
        approval.payment_code ||
        approval.raw?.payment_code ||
        approval.paymentCode;

    const paidOn =
        approval.paid_on ||
        approval.raw?.paid_on ||
        approval.paidDate;

    const handleViewReceipt = (e) => {
        if (e) e.preventDefault();
        if (!paymentSlipPath) return;
        const fullUrl = paymentSlipPath.startsWith("http")
            ? paymentSlipPath
            : `${API_BASE_URL}/${paymentSlipPath}`;

        const displayPaymentId =
            paymentCode ||
            approval.payment_code ||
            approval.raw?.payment_code ||
            approval.paymentCode ||
            approval.payment_id ||
            approval.raw?.payment_id ||
            approval.paymentId ||
            (paymentSlipPath && (paymentSlipPath.match(/PAY-\d{4}-\d+/i)?.[0])) ||
            (paymentSlipName && (paymentSlipName.match(/PAY-\d{4}-\d+/i)?.[0])) ||
            "PAY-2026-0008";

        setPreviewModal({
            isOpen: true,
            url: fullUrl,
            cert: {
                name: displayPaymentId,
                hideSubtitle: true,
                hideIcon: true,
                icon: null,
                certificateFileName: paymentSlipName || paymentSlipPath.split("/").pop() || "receipt.png",
            },
        });
    };

    const handleViewSupportingDoc = (e) => {
        if (e) e.preventDefault();
        if (!supportingDoc) return;
        const fullUrl = supportingDoc.startsWith("http")
            ? supportingDoc
            : `${API_BASE_URL}/${supportingDoc}`;
        setPreviewModal({
            isOpen: true,
            url: fullUrl,
            cert: {
                name: courseName || "Certificate Document",
                issuer: platform || "Certificate Provider",
                issueDate: requestDate !== "—" ? requestDate : "",
                certificateFileName: supportingDoc.split("/").pop() || "certificate.pdf",
            },
        });
    };

    const modalContent = (
        <div className="hr-cad-modal-overlay">
            <div
                className={`hr-cad-modal-card ${isPaid ? "is-paid-layout" : ""}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button Top-Right */}
                <button
                    type="button"
                    onClick={onClose}
                    className="hr-cad-close-btn"
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                {/* Modal Title & Subtitle */}
                <div className="hr-cad-header">
                    <h2 className="hr-cad-title">
                        {isCertification ? "Certification Claim Details" : "Course Approval Details"}
                    </h2>
                    <p className="hr-cad-subtitle">
                        {isCertification
                            ? "View the certification details, exam completion, and reimbursement information."
                            : "View the course details, learning purpose, and approval information."}
                    </p>
                </div>

                {/* Scrollable Body Content */}
                <div className="hr-cad-scroll-body">
                    {/* Top Meta Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", fontSize: "12px" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "5px 12px" }}>
                            <span style={{ color: "#7f7f7f", fontWeight: 500 }}>Request Date:</span>
                            <span style={{ color: "#000000", fontWeight: 600 }}>{requestDate}</span>
                        </div>
                    </div>

                    {/* Key-Value Details Grid */}
                    <div className={`hr-cad-grid ${isPaid ? "hr-cad-grid-paid" : ""}`}>
                        {/* Left Column: Course / Claim Details */}
                        <div className="hr-cad-left-col">
                            {/* Request ID */}
                            <div className="hr-cad-row">
                                <span className="hr-cad-label">Request ID</span>
                                <span className="hr-cad-value">{requestId}</span>
                            </div>

                            {/* Employee Name */}
                            <div className="hr-cad-row">
                                <span className="hr-cad-label">Employee Name</span>
                                <span className="hr-cad-value">{employeeName}</span>
                            </div>

                            {/* Course / Certification Name */}
                            <div className="hr-cad-row">
                                <span className="hr-cad-label">{isCertification ? "Certification Name" : "Course Name"}</span>
                                <span className="hr-cad-value">{courseName}</span>
                            </div>

                            {/* Provide / Platform */}
                            <div className="hr-cad-row">
                                <span className="hr-cad-label">Provider / Platform</span>
                                <span className="hr-cad-value">{platform}</span>
                            </div>

                            {/* Course Category */}
                            <div className="hr-cad-row">
                                <span className="hr-cad-label">{isCertification ? "Category" : "Course Category"}</span>
                                <span className="hr-cad-value">{category}</span>
                            </div>

                            {/* Supporting Document / Course Link */}
                            {isCertification ? (
                                supportingDoc ? (
                                    <div className="hr-cad-row">
                                        <span className="hr-cad-label">Supporting Document</span>
                                        <button
                                            type="button"
                                            onClick={handleViewSupportingDoc}
                                            className="hr-cad-link"
                                        >
                                            View Certificate Document
                                        </button>
                                    </div>
                                ) : null
                            ) : (
                                courseLink && (
                                    <div className="hr-cad-row">
                                        <span className="hr-cad-label">Course Link</span>
                                        <a
                                            href={courseLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hr-cad-link"
                                        >
                                            {courseLink}
                                        </a>
                                    </div>
                                )
                            )}

                            {/* Reimbursement Cost */}
                            {reimbursementCost && (
                                <div className="hr-cad-row">
                                    <span className="hr-cad-label">Reimbursement Cost</span>
                                    <span className="hr-cad-value" style={{ fontWeight: 600, color: "#4d4d4d" }}>
                                        {reimbursementCost}
                                    </span>
                                </div>
                            )}

                            {/* Why do you want to learn this course / purpose */}
                            <div className="hr-cad-row">
                                <span className="hr-cad-label">
                                    {isCertification ? "Learning Purpose" : "Why do you want to learn this course?"}
                                </span>
                                <span className="hr-cad-value">{whyLearn}</span>
                            </div>

                            {/* Reject Reason (shown below "Why do you want to learn this course?") */}
                            {(isRejected || rejectReason) && (
                                <div className="hr-cad-row">
                                    <span className="hr-cad-label">Reject Reason</span>
                                    <span className="hr-cad-value" style={isRejected ? { color: "#4d4d4d" } : undefined}>
                                        {rejectReason}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Right-Hand Payment Panel (Displayed after HR payment) */}
                        {isPaid && (
                            <div className="hr-cad-payment-panel">
                                <div className="hr-cad-pay-panel-header">
                                    <span className="hr-cad-pay-panel-title">Payment Information</span>
                                    {paymentCode && (
                                        <span className="hr-cad-pay-code-pill" title="Payment Reference Code">
                                            {paymentCode}
                                        </span>
                                    )}
                                </div>

                                {paidOn && (
                                    <div className="hr-cad-pay-meta-row">
                                        <span className="hr-cad-pay-meta-label">Payment Date</span>
                                        <span className="hr-cad-pay-meta-value">{formatReqDate(paidOn)}</span>
                                    </div>
                                )}

                                {/* Payment Receipt */}
                                {Boolean(paymentSlipPath) && (
                                    <div className="hr-cad-pay-block">
                                        <span className="hr-cad-pay-block-label">Payment Receipt</span>
                                        <div className="hr-cad-receipt-card">
                                            <div className="hr-cad-receipt-icon-wrap">
                                                <FileText size={18} className="hr-cad-receipt-icon" />
                                            </div>
                                            <div className="hr-cad-receipt-details">
                                                <span className="hr-cad-receipt-filename" title={paymentSlipName}>
                                                    {paymentSlipName}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleViewReceipt}
                                                    className="hr-cad-receipt-link"
                                                >
                                                    <span>View Receipt</span>
                                                    <ExternalLink size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Description */}
                                {Boolean(paymentDescription && paymentDescription.trim()) && (
                                    <div className="hr-cad-pay-block">
                                        <span className="hr-cad-pay-block-label">Payment Description</span>
                                        <div className="hr-cad-desc-box">
                                            <p className="hr-cad-desc-text">{paymentDescription.trim()}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Modal Footer (only when pending approval actions exist) */}
                    {approval.status === "Pending" && (onApprove || onReject) && !readOnly && (
                        <div className="hr-cad-footer">
                            <button
                                type="button"
                                className="hr-cad-reject-btn"
                                onClick={async () => {
                                    if (onReject) await onReject(approval);
                                    onClose();
                                }}
                            >
                                <X size={13} strokeWidth={2.5} />
                                <span>Reject</span>
                            </button>
                            <button
                                type="button"
                                className="hr-cad-approve-btn"
                                onClick={async () => {
                                    if (onApprove) await onApprove(approval);
                                    onClose();
                                }}
                            >
                                <Check size={13} strokeWidth={2.5} />
                                <span>Approve</span>
                            </button>
                        </div>
                    )}

                    {/* Pay button — Only rendered for HR when not yet paid; hidden once paid */}
                    {isHR && isApproved && !isPaid && hasAmount && !showPayForm && (
                        <div className="hr-cad-footer">
                            <button
                                type="button"
                                className="hr-cad-pay-btn"
                                onClick={() => setShowPayForm(true)}
                            >
                                <CreditCard size={13} strokeWidth={2.5} />
                                <span>Pay</span>
                            </button>
                        </div>
                    )}

                    {/* Payment Slip Sub-Form — inline inside this dialog */}
                    {isHR && isApproved && !isPaid && hasAmount && showPayForm && (
                        <PaymentSlipForm
                            claimId={finalClaimId}
                            claimCode={finalClaimCode}
                            claimType={finalClaimType}
                            amount={approval.amount || reimbursementCost}
                            employeeName={employeeName}
                            onSuccess={(updated) => {
                                setShowPayForm(false);
                                onClose();
                                if (onPaySuccess) onPaySuccess(updated);
                            }}
                            onCancel={() => setShowPayForm(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {createPortal(modalContent, document.body)}
            <CertificateViewerModal
                isOpen={previewModal.isOpen}
                onClose={() => setPreviewModal({ isOpen: false, url: "", cert: null })}
                cert={previewModal.cert}
                previewUrl={previewModal.url}
            />
        </>
    );
}
