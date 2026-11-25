import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Eye, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import ApprovalDetailsModal from "../ApprovalsWorkflow/ApprovalDetailsModal";
import bookBg from "../../../assets/Approvals & Workflow/book.svg";
import bookSvg from "../../../assets/Approvals & Workflow/bookbackground.svg";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";

const isItemPaid = (item) => Boolean(
    !item ? false : (
        String(item.payment_status || item.processingStatus || item.processing_status || item.raw?.payment_status || item.raw?.processing_status || "").toLowerCase() === "paid" ||
        item.status === "Paid" ||
        item.raw?.status === "Paid" ||
        item.paid_on ||
        item.payment_code ||
        item.payment_slip_path ||
        item.raw?.paid_on ||
        item.raw?.payment_code ||
        item.raw?.payment_slip_path
    )
);

export default function ApprovalHistoryModal({
    isOpen,
    onClose,
    historyData = [],
    type = "Course",
}) {
    // Default all items collapsed (single accordion expansion)
    const [expandedKey, setExpandedKey] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);

    // Reset to all collapsed whenever the modal is reopened
    React.useEffect(() => {
        if (isOpen) {
            setExpandedKey(null);
            setSelectedDetail(null);
        }
    }, [isOpen]);

    const toggleExpand = (key) => {
        setExpandedKey((prevKey) => (prevKey === key ? null : key));
    };

    if (!isOpen) return null;

    const modalContent = (
        <>
            <div className="hr-aw-history-modal-overlay">
                <div
                    className="hr-aw-history-modal-card"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="hr-aw-history-modal-header">
                        <div>
                            <h2 className="hr-aw-history-title">
                                {type} Approval History
                            </h2>
                            <p className="hr-aw-history-subtitle">
                                View the approval progress, request details, and purchase status for all submitted {type === "Certification" ? "certificate" : "course"} requests.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="hr-aw-history-close-btn"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Table Header Row */}
                    <div className="hr-aw-history-table-header">
                        <div className="hr-aw-hcol-id">Claim ID</div>
                        <div className="hr-aw-hcol-course">{type}</div>
                        <div className="hr-aw-hcol-emp">Employee Name</div>
                        <div className="hr-aw-hcol-amount">Amount</div>
                        <div className="hr-aw-hcol-date">Requested On</div>
                        <div className="hr-aw-hcol-status">Status</div>
                        <div className="hr-aw-hcol-action">Action</div>
                    </div>

                    {/* Body / List */}
                    <div className="hr-aw-history-modal-body">
                        {historyData.length === 0 ? (
                            <div style={{ textAlign: "center", color: "#94A3B8", padding: "30px 0" }}>
                                No approval history available.
                            </div>
                        ) : (
                            historyData.map((item, idx) => {
                                const itemKey = item.uniqueId || (item.id ? `${item.id}-${idx}` : `hist-${idx}`);
                                const isExpanded = expandedKey === itemKey;

                                return (
                                    <div
                                        key={itemKey}
                                        className={`hr-aw-history-card-accordion ${isExpanded ? "expanded" : ""}`}
                                    >
                                        {/* Main Row Header (Desktop - Unchanged) */}
                                        <div className="hr-aw-history-row-header">
                                            <div className="hr-aw-hcol-id">
                                                <button
                                                    type="button"
                                                    className="hr-aw-request-id-link"
                                                    onClick={() => setSelectedDetail(item)}
                                                    title="View Course Approval Details"
                                                >
                                                    {item.id}
                                                </button>
                                            </div>

                                            <div className="hr-aw-hcol-course">
                                                <div className="hr-aw-history-course-wrap">
                                                    <div
                                                        className="hr-aw-history-book-icon"
                                                        style={{ backgroundImage: `url("${bookBg}")` }}
                                                    >
                                                        <img
                                                            src={bookSvg}
                                                            alt=""
                                                            className="hr-aw-history-book-svg"
                                                        />
                                                    </div>
                                                    <span className="hr-aw-history-course-name" title={item.course}>
                                                        {item.course}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="hr-aw-hcol-emp">
                                                <span className="hr-aw-history-emp-text">{item.employee || item.name}</span>
                                            </div>

                                            <div className="hr-aw-hcol-amount">
                                                <span className="hr-aw-history-amount-text">{item.amount || "₹1,000"}</span>
                                            </div>

                                            <div className="hr-aw-hcol-date">
                                                <span className="hr-aw-history-date-text">{item.requestedOn || item.requestDate}</span>
                                            </div>

                                            <div className="hr-aw-hcol-status">
                                                <span className={item.status === "Rejected" ? "hr-aw-badge-rejected" : isItemPaid(item) ? "hr-aw-badge-paid" : "hr-aw-badge-approved"}>
                                                    {item.status === "Rejected" ? "Rejected" : isItemPaid(item) ? "Paid" : (item.status || "Approved")}
                                                </span>
                                            </div>

                                            <div className="hr-aw-hcol-action">
                                                <div className="hr-aw-history-action-group">
                                                    <button
                                                        type="button"
                                                        className="hr-aw-history-eye-btn"
                                                        title="View Details"
                                                        onClick={() => setSelectedDetail(item)}
                                                    >
                                                        <img
                                                            src={blueEyeIcon}
                                                            alt="View Details"
                                                            style={{ width: "13px", height: "9px", display: "block" }}
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hr-aw-history-chevron-btn"
                                                        onClick={() => toggleExpand(itemKey)}
                                                        title={isExpanded ? "Collapse" : "Expand"}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown size={16} />
                                                        ) : (
                                                            <ChevronRight size={16} />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Responsive Card Header (Tablet & Mobile) */}
                                        <div className="hr-aw-history-card-mobile">
                                            <div className="hr-aw-hcard-top">
                                                <button
                                                    type="button"
                                                    className="hr-aw-request-id-link"
                                                    onClick={() => setSelectedDetail(item)}
                                                    title="View Details"
                                                >
                                                    {item.id}
                                                </button>

                                                <div className="hr-aw-hcard-top-right">
                                                    <span className={item.status === "Rejected" ? "hr-aw-badge-rejected" : isItemPaid(item) ? "hr-aw-badge-paid" : "hr-aw-badge-approved"}>
                                                        {item.status === "Rejected" ? "Rejected" : isItemPaid(item) ? "Paid" : (item.status || "Approved")}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="hr-aw-history-eye-btn"
                                                        title="View Details"
                                                        onClick={() => setSelectedDetail(item)}
                                                    >
                                                        <img
                                                            src={blueEyeIcon}
                                                            alt="View Details"
                                                            style={{ width: "13px", height: "9px", display: "block" }}
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hr-aw-history-chevron-btn"
                                                        onClick={() => toggleExpand(itemKey)}
                                                        title={isExpanded ? "Collapse" : "Expand"}
                                                    >
                                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="hr-aw-hcard-course">
                                                <div
                                                    className="hr-aw-history-book-icon"
                                                    style={{ backgroundImage: `url("${bookBg}")` }}
                                                >
                                                    <img src={bookSvg} alt="" className="hr-aw-history-book-svg" />
                                                </div>
                                                <span className="hr-aw-hcard-course-title" title={item.course}>
                                                    {item.course}
                                                </span>
                                            </div>

                                            <div className="hr-aw-hcard-meta-grid">
                                                <div className="hr-aw-hcard-meta-item">
                                                    <span className="hr-aw-hcard-meta-label">Employee</span>
                                                    <span className="hr-aw-hcard-meta-val">{item.employee || item.name}</span>
                                                </div>
                                                <div className="hr-aw-hcard-meta-item">
                                                    <span className="hr-aw-hcard-meta-label">Amount</span>
                                                    <span className="hr-aw-hcard-meta-val hr-aw-hcard-val-amount">{item.amount || "₹1,000"}</span>
                                                </div>
                                                <div className="hr-aw-hcard-meta-item">
                                                    <span className="hr-aw-hcard-meta-label">Requested</span>
                                                    <span className="hr-aw-hcard-meta-val">{item.requestedOn || item.requestDate}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expandable Drawer with Sub-card & Stepper */}
                                        {isExpanded && (
                                            <div className="hr-aw-history-drawer">
                                                {/* Subcard (Left Info Box) */}
                                                <div className="hr-aw-history-subcard">
                                                    <div className="hr-aw-history-subcard-icon">
                                                        <CornerDownRight size={14} color="#215EF8" />
                                                    </div>
                                                    <div className="hr-aw-history-subcard-details">
                                                        <span className="hr-aw-history-subcard-name">
                                                            {item.employee || item.name}
                                                        </span>
                                                        <span className="hr-aw-history-subcard-course">
                                                            {item.course}
                                                        </span>
                                                        <span className="hr-aw-history-subcard-date">
                                                            {item.steps?.[0]?.date || item.requestedOn || item.requestDate}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 5-Step Stepper (Right Pipeline) */}
                                                <div className="hr-aw-history-stepper">
                                                    {item.steps?.map((step, idx) => {
                                                        const isLast = idx === item.steps.length - 1;
                                                        const isDone = Boolean(step.done);
                                                        const isRejected = step.status === "rejected" || step.date?.toLowerCase() === "rejected" || Boolean(step.isRejected);
                                                        const isGreen = isLast && isDone && item.status !== "Rejected";

                                                        let circleClass = "pending";
                                                        if (isRejected) {
                                                            circleClass = "rejected";
                                                        } else if (isDone) {
                                                            circleClass = isGreen ? "green" : "blue";
                                                        }

                                                        return (
                                                            <React.Fragment key={step.label}>
                                                                <div className="hr-aw-hstepper-node">
                                                                    <div className={`hr-aw-hstepper-circle ${circleClass}`}>
                                                                        {isDone ? (
                                                                            <Check size={11} strokeWidth={3} />
                                                                        ) : isRejected ? (
                                                                            <X size={11} strokeWidth={3} />
                                                                        ) : (
                                                                            <div className="hr-aw-hstepper-pending-dot" />
                                                                        )}
                                                                    </div>
                                                                    <span className="hr-aw-hstepper-label">
                                                                        {step.label}
                                                                    </span>
                                                                    <span className="hr-aw-hstepper-date">
                                                                        {step.date}
                                                                    </span>
                                                                </div>

                                                                {!isLast && (
                                                                    <div className="hr-aw-hstepper-dotted-line" />
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="hr-aw-history-modal-footer">
                        <button
                            type="button"
                            className="hr-aw-history-ok-btn"
                            onClick={onClose}
                        >
                            Ok
                        </button>
                    </div>
                </div>
            </div>

            {/* Course Approval Details Modal */}
            {selectedDetail && (
                <ApprovalDetailsModal
                    approval={selectedDetail}
                    onClose={() => setSelectedDetail(null)}
                />
            )}
        </>
    );

    return createPortal(modalContent, document.body);
}
