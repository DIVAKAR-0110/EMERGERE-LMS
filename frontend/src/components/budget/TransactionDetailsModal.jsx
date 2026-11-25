import React from "react";
import { X, Calendar, Printer, Check } from "lucide-react";

export default function TransactionDetailsModal({ isOpen, onClose, transaction, type }) {
    if (!isOpen || !transaction) return null;

    const isCourse = type === "course";
    const isClaim = type === "claim";
    const isWorkshop = type === "workshop";

    const title = isCourse
        ? transaction.course_name
        : isClaim
            ? (transaction.cert_title || transaction.certification_name)
            : transaction.event_name;

    const amount = isCourse
        ? (transaction.price_formatted || (transaction.price ? `₹${transaction.price.toLocaleString("en-IN")}` : "—"))
        : isClaim
            ? (transaction.claim_amount_formatted || (transaction.claim_amount ? `₹${transaction.claim_amount.toLocaleString("en-IN")}` : (transaction.amount ? `₹${transaction.amount.toLocaleString("en-IN")}` : "—")))
            : transaction.actual_spent_formatted;

    const modalTitle = isWorkshop
        ? "Event Details"
        : isCourse
            ? "Course Purchase Details"
            : "Certification Claim Details";

    const modalSubtitle = isWorkshop
        ? "View workshop and training event expenditure details."
        : isCourse
            ? "View course procurement and license assignment details."
            : "View certification credential verification and reimbursement details.";

    // Course Approval Stages (5 Steps as requested)
    const getCourseSteps = () => {
        if (transaction.stages && Array.isArray(transaction.stages) && transaction.stages.length > 0) {
            return transaction.stages.map((st, idx) => ({
                label: st.label,
                date: st.date,
                done: st.done !== undefined ? Boolean(st.done) : (st.status === "Completed" || st.status === "Approved"),
                isFinal: Boolean(st.isFinal || idx === transaction.stages.length - 1)
            }));
        }
        const baseDate = transaction.date || (transaction.timestamp ? transaction.timestamp.split(" ")[0] : "—");
        return [
            { label: "Employee Request", date: transaction.request_date || "—", done: true },
            { label: "Notify RM", date: transaction.rm_notify_date || "—", done: true },
            { label: "L&D Approval", date: transaction.ld_approval_date || "—", done: true },
            { label: "CEO Approval", date: transaction.ceo_approval_date || "—", done: true },
            { label: "Course Purchased", date: transaction.purchased_date || baseDate, done: true, isFinal: true },
        ];
    };

    // Certification Claim Approval Stages
    const getClaimSteps = () => {
        if (transaction.stages && Array.isArray(transaction.stages) && transaction.stages.length > 0) {
            return transaction.stages.map((st, idx) => ({
                label: st.label,
                date: st.date,
                done: st.done !== undefined ? Boolean(st.done) : (st.status === "Completed" || st.status === "Approved"),
                isFinal: Boolean(st.isFinal || idx === transaction.stages.length - 1)
            }));
        }
        const reqDate = transaction.submission_time ? transaction.submission_time.split(" ")[0] : "—";
        const hrDate = transaction.approval_time ? transaction.approval_time.split(" ")[0] : "—";
        const purchaseDate = transaction.payment_time ? transaction.payment_time.split(" ")[0] : "—";
        return [
            { label: "Employee Request", date: reqDate, done: true },
            { label: "Notify L&D", date: transaction.ld_notify_date || "—", done: true },
            { label: "HR Approval", date: hrDate, done: true },
            { label: "Payment Completed", date: purchaseDate, done: true, isFinal: true },
        ];
    };

    const approvalSteps = isCourse ? getCourseSteps() : isClaim ? getClaimSteps() : null;

    return (
        <div className="budget-modal-overlay">
            <div className="budget-asg-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="budget-asg-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                {/* Modal Header */}
                <div className="budget-asg-header">
                    <h2 className="budget-asg-title">{modalTitle}</h2>
                    <p className="budget-asg-subtitle">{modalSubtitle}</p>
                </div>

                {/* Main Content Box - Single Unified Container */}
                <div className="budget-asg-container">
                    {/* Event / Course Header Row */}
                    <div className="budget-asg-course-header">
                        <div className="budget-asg-course-meta">
                            <span className="budget-asg-course-title" title={title}>{title}</span>
                            <span className="budget-asg-course-date">
                                <Calendar size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 4 }} />
                                {transaction.date || transaction.dates_formatted || transaction.timestamp || transaction.payment_time}
                            </span>
                        </div>
                        {/* Amount Badge on Top Right */}
                        <div className="budget-asg-badge-spent">
                            <span className="budget-asg-badge-spent-val">{amount}</span>
                        </div>
                    </div>

                    <div className="budget-asg-divider-h" />

                    {/* Section 1: Workshop Information */}
                    {isWorkshop && (
                        <div className="budget-asg-section">
                            <h4 className="budget-asg-sec-title">Event Information</h4>
                            <div className="budget-asg-info-grid">
                                <div className="budget-asg-info-col">
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Department</span>
                                        <span className="budget-asg-val">{transaction.department || "—"}</span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Event Name</span>
                                        <span className="budget-asg-val" title={transaction.event_name}>
                                            {transaction.event_name || "—"}
                                        </span>
                                    </div>

                                </div>

                                <div className="budget-asg-divider-v" />

                                <div className="budget-asg-info-col">
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Event Type</span>
                                        <span className="budget-asg-val">
                                            <span className={`budget-tag ${String(transaction.event_type || "workshop").toLowerCase() === "training" ? "training" : "workshop"}`}>
                                                {transaction.event_type || "—"}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Participants</span>
                                        <span className="budget-asg-val">{transaction.participants_count ?? "—"}</span>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 1: Course Purchase Information */}
                    {isCourse && (
                        <div className="budget-asg-section">
                            <h4 className="budget-asg-sec-title">Course Purchase Information</h4>
                            <div className="budget-asg-info-grid">
                                <div className="budget-asg-info-col">
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Provider</span>
                                        <span className="budget-asg-val">{transaction.provider || "—"}</span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Category</span>
                                        <span className="budget-asg-val">{transaction.category || "—"}</span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Request ID</span>
                                        <span className="budget-asg-val">{transaction.request_code || "—"}</span>
                                    </div>
                                </div>

                                <div className="budget-asg-divider-v" />

                                <div className="budget-asg-info-col">
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Employee</span>
                                        <span className="budget-asg-val">{transaction.learner_name} ({transaction.employee_id})</span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Department</span>
                                        <span className="budget-asg-val">{transaction.department}</span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Approved By</span>
                                        <span className="budget-asg-val">{transaction.approved_by || "—"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 1: Claim Information */}
                    {isClaim && (
                        <div className="budget-asg-section">
                            <h4 className="budget-asg-sec-title">Claim Information</h4>
                            <div className="budget-asg-info-grid">
                                <div className="budget-asg-info-col">
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Provider</span>
                                        <span className="budget-asg-val">{transaction.issuing_body || transaction.provider}</span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Claim ID</span>
                                        <span className="budget-asg-val">{transaction.claim_code || "—"}</span>
                                    </div>
                                </div>

                                <div className="budget-asg-divider-v" />

                                <div className="budget-asg-info-col">
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Employee</span>
                                        <span className="budget-asg-val">{transaction.employee_name} ({transaction.employee_id})</span>
                                    </div>
                                    <div className="budget-asg-row">
                                        <span className="budget-asg-label">Department</span>
                                        <span className="budget-asg-val">{transaction.department}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 2: Stages of Approval Pipeline (Course & Claim) */}
                    {approvalSteps && (
                        <>
                            <div className="budget-asg-divider-h" />
                            <div className="budget-asg-section">
                                <h4 className="budget-asg-sec-title">Approval Timeline</h4>
                                <div className="budget-asg-stepper-wrapper">
                                    <div className="budget-asg-stepper">
                                        {approvalSteps.map((step, idx) => {
                                            const isLast = idx === approvalSteps.length - 1;
                                            const isDone = Boolean(step.done);
                                            const circleClass = isDone ? (isLast ? "green" : "blue") : "pending";

                                            return (
                                                <React.Fragment key={step.label}>
                                                    <div className="budget-asg-stepper-node">
                                                        <div className={`budget-asg-stepper-circle ${circleClass}`}>
                                                            {isDone ? (
                                                                <Check size={11} strokeWidth={3} />
                                                            ) : (
                                                                <div className="budget-asg-stepper-pending-dot" />
                                                            )}
                                                        </div>
                                                        <span className="budget-asg-stepper-label">{step.label}</span>
                                                        <span className="budget-asg-stepper-date">{step.date}</span>
                                                    </div>
                                                    {!isLast && <div className="budget-asg-stepper-dotted-line" />}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
