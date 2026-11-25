import React, { useEffect, useRef, useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import badgeIcon from "../../../assets/Certification/badge.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import Pagination from "../CourseLibrary/Pagination";
import blackdownarrowIcon from "../../../assets/Certification/blackdownarrow.svg";
import blackrightarrowIcon from "../../../assets/Certification/blackrightarrow.svg";
import cornerDownRightIcon from "../../../assets/Certification/CornerDownRight.svg";
import blueCheckIcon from "../../../assets/course_library/bluecheck.svg";
import greenCheckIcon from "../../../assets/course_library/greencheck.svg";
import clockIcon from "../../../assets/course_library/clock.svg";
import circleDotIcon from "../../../assets/course_library/CircleDot.svg";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";

const getTrackerStepIcon = (status) => {
    switch (status) {
        case "completed":
            return blueCheckIcon;
        case "completed_final":
            return greenCheckIcon;
        case "pending":
            return clockIcon;
        case "upcoming":
        default:
            return circleDotIcon;
    }
};
import { getApprovalHighlightKey } from "../../../utils/notificationHighlight";
import { getCertSkeletonRowCount, useCertSkeletonRowCount } from "../../../utils/certSkeletonUtils";

// Parse date string to timestamp for chronological sorting
const parseDateMs = (dStr) => {
    if (!dStr || dStr === "—") return 0;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

const formatShortDate = (dStr) => {
    if (!dStr || dStr === "—" || dStr === "-") return "-";
    const s = String(dStr).trim();
    if (s.toLowerCase() === "paid" || s.toLowerCase() === "pending" || s.toLowerCase() === "rejected" || s.toLowerCase() === "upcoming") return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

// Parse amount string to number (e.g., "₹2,990" -> 2990)
const parseAmount = (val) => {
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.]/g, "");
    return parseFloat(clean) || 0;
};

const renderSortIcon = (columnKey, sortConfig) => {
    if (sortConfig.key !== columnKey) {
        return <ArrowUpDown size={12} className="emp-cert-sort-icon inactive" />;
    }
    return sortConfig.direction === "asc" ? (
        <ArrowUp size={12} className="emp-cert-sort-icon active" />
    ) : (
        <ArrowDown size={12} className="emp-cert-sort-icon active" />
    );
};

export default function ReimbursementClaimsTab({
    filteredClaims,
    reimbSubTab,
    setReimbSubTab,
    expandedClaimId,
    setExpandedClaimId,
    highlightedItemId = null,
    isLoading = false,
    onViewClaimDetails,
}) {
    const highlightedCardRef = useRef(null);
    const containerRef = useRef(null);
    const skeletonCount = useCertSkeletonRowCount();
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

    const handleSort = (key) => {
        setSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: "asc" };
            }
            if (prev.direction === "asc") {
                return { key, direction: "desc" };
            }
            return { key: null, direction: null };
        });
        setCurrentPage(1);
    };

    const sortedClaims = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) {
            return filteredClaims || [];
        }
        const { key, direction } = sortConfig;
        return [...(filteredClaims || [])].sort((a, b) => {
            let res = 0;
            if (key === "claimId") {
                const idA = String(a.id || a.claimId || "").trim();
                const idB = String(b.id || b.claimId || "").trim();
                res = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
            } else if (key === "certificateTitle") {
                const titleA = (a.certificateTitle || "").trim();
                const titleB = (b.certificateTitle || "").trim();
                res = titleA.localeCompare(titleB, undefined, { sensitivity: "base" });
            } else if (key === "amount") {
                res = parseAmount(a.amount) - parseAmount(b.amount);
            } else if (key === "purchaseDate") {
                const dateA = parseDateMs(a.purchaseDate || a.requestDate);
                const dateB = parseDateMs(b.purchaseDate || b.requestDate);
                res = dateA - dateB;
            } else if (key === "submittedOn") {
                const dateA = parseDateMs(a.submittedOn || a.requestDate);
                const dateB = parseDateMs(b.submittedOn || b.requestDate);
                res = dateA - dateB;
            } else if (key === "status") {
                const statusA = (a.status || "").trim();
                const statusB = (b.status || "").trim();
                res = statusA.localeCompare(statusB, undefined, { sensitivity: "base" });
            }
            return direction === "asc" ? res : -res;
        });
    }, [filteredClaims, sortConfig]);

    useEffect(() => {
        setCurrentPage(1);
    }, [reimbSubTab, filteredClaims?.length, sortConfig]);

    const totalPages = Math.max(1, Math.ceil((sortedClaims || []).length / itemsPerPage));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const paginatedClaims = useMemo(() => {
        const start = (safePage - 1) * itemsPerPage;
        return (sortedClaims || []).slice(start, start + itemsPerPage);
    }, [sortedClaims, safePage, itemsPerPage]);

    useEffect(() => {
        if (!highlightedItemId || !highlightedCardRef.current) return;
        const t = setTimeout(() => {
            highlightedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [highlightedItemId, filteredClaims]);
    return (
        <div className="emp-reimb-claims-outer-container" ref={containerRef}>
            {/* Subtabs Bar */}
            <div className="emp-reimb-subtabs-bar" style={{ flexShrink: 0 }}>
                {["My Claim", "Approved", "Pending", "Rejected"].map((tab) => (
                    <button
                        key={tab}
                        className={`emp-reimb-subtab-btn ${reimbSubTab === tab ? "active" : ""}`}
                        onClick={() => setReimbSubTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Claims Card Box */}
            <div className="emp-reimb-claims-container">
                {/* Header Row */}
                <div className="emp-reimb-header-row" style={{ flexShrink: 0 }}>
                    <span
                        className={`emp-col-claim-id emp-sortable-header ${sortConfig.key === "claimId" ? "active-sort" : ""}`}
                        onClick={() => handleSort("claimId")}
                        title="Sort by Claim ID"
                    >
                        <span>Claim ID</span>
                        {renderSortIcon("claimId", sortConfig)}
                    </span>
                    <span
                        className={`emp-col-cert-title emp-sortable-header ${sortConfig.key === "certificateTitle" ? "active-sort" : ""}`}
                        onClick={() => handleSort("certificateTitle")}
                        title="Sort by Certification/Exam"
                    >
                        <span>Certification/Exam</span>
                        {renderSortIcon("certificateTitle", sortConfig)}
                    </span>
                    <span
                        className={`emp-col-amount emp-sortable-header ${sortConfig.key === "amount" ? "active-sort" : ""}`}
                        onClick={() => handleSort("amount")}
                        title="Sort by Amount"
                    >
                        <span>Amount</span>
                        {renderSortIcon("amount", sortConfig)}
                    </span>
                    <span
                        className={`emp-col-purchase-date emp-sortable-header ${sortConfig.key === "purchaseDate" ? "active-sort" : ""}`}
                        onClick={() => handleSort("purchaseDate")}
                        title="Sort by Date of Purchase"
                    >
                        <span>Date of Purchase</span>
                        {renderSortIcon("purchaseDate", sortConfig)}
                    </span>
                    <span
                        className={`emp-col-submitted-on emp-sortable-header ${sortConfig.key === "submittedOn" ? "active-sort" : ""}`}
                        onClick={() => handleSort("submittedOn")}
                        title="Sort by Submitted On"
                    >
                        <span>Submitted On</span>
                        {renderSortIcon("submittedOn", sortConfig)}
                    </span>
                    <span
                        className={`emp-col-status emp-sortable-header ${sortConfig.key === "status" ? "active-sort" : ""}`}
                        onClick={() => handleSort("status")}
                        title="Sort by Status"
                    >
                        <span>Status</span>
                        {renderSortIcon("status", sortConfig)}
                    </span>
                    <span className="emp-col-action" style={{ textAlign: "center" }}>Action</span>
                </div>

                {/* Cards List */}
                <div className="emp-reimb-cards-list">
                    {isLoading ? (
                        Array.from({ length: skeletonCount }).map((_, idx) => (
                            <div key={`reimb-skel-${idx}`} className="emp-reimb-card-wrapper" style={{ opacity: 0.85 }}>
                                <div className="emp-reimb-card-row">
                                    <div className="emp-col-claim-id">
                                        <span className="emp-reimb-mobile-label">Claim ID</span>
                                        <span className="ld-skeleton-block" style={{ width: '70px', height: '14px', borderRadius: '4px' }} />
                                    </div>
                                    <div className="emp-col-cert-title">
                                        <span className="emp-reimb-mobile-label">Certification/Exam</span>
                                        <div className="emp-claim-cert-value-wrap">
                                            <span className="ld-skeleton-block" style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0 }} />
                                            <span className="ld-skeleton-block" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
                                        </div>
                                    </div>
                                    <div className="emp-col-amount">
                                        <span className="emp-reimb-mobile-label">Amount</span>
                                        <span className="ld-skeleton-block" style={{ width: '60px', height: '14px', borderRadius: '4px' }} />
                                    </div>
                                    <div className="emp-col-purchase-date">
                                        <span className="emp-reimb-mobile-label">Date of Purchase</span>
                                        <span className="ld-skeleton-block" style={{ width: '75px', height: '14px', borderRadius: '4px' }} />
                                    </div>
                                    <div className="emp-col-submitted-on">
                                        <span className="emp-reimb-mobile-label">Submitted On</span>
                                        <span className="ld-skeleton-block" style={{ width: '75px', height: '14px', borderRadius: '4px' }} />
                                    </div>
                                    <div className="emp-col-status">
                                        <span className="emp-reimb-mobile-label">Status</span>
                                        <span className="ld-skeleton-block" style={{ width: '68px', height: '22px', borderRadius: '12px' }} />
                                    </div>
                                    <div className="emp-col-action emp-reimb-action-group">
                                        <span className="emp-reimb-mobile-label">Action</span>
                                        <span className="ld-skeleton-block" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
                                        <span className="ld-skeleton-block" style={{ width: '16px', height: '16px', borderRadius: '4px' }} />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : filteredClaims.length === 0 ? (
                        <div className="emp-empty-cert-state" style={{ minHeight: "220px" }}>
                            <img
                                src={openBookIcon}
                                alt="No claims found"
                                className="emp-empty-cert-icon"
                            />
                            <h3>No claims found.</h3>
                        </div>
                    ) : (
                        paginatedClaims.map((claim) => {
                            const isExpanded = expandedClaimId === claim.id;
                            const isHighlighted =
                                Boolean(highlightedItemId) &&
                                getApprovalHighlightKey(claim) === String(highlightedItemId);
                            return (
                                <div
                                    key={claim.id}
                                    ref={isHighlighted ? highlightedCardRef : null}
                                    data-request-id={claim.id}
                                    className={`emp-reimb-card-wrapper ${isHighlighted ? "aw-card-highlighted" : ""}`}
                                >
                                    <div className="emp-reimb-card-row">
                                        <div className="emp-col-claim-id">
                                            <span className="emp-reimb-mobile-label">Claim ID</span>
                                            <div className="aw-id-highlight-wrap">
                                                <span className="emp-claim-id-text" title={claim.id}>{claim.id}</span>
                                                {isHighlighted && (
                                                    <span className="aw-notif-highlight-badge">Selected Claim</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="emp-col-cert-title">
                                            <span className="emp-reimb-mobile-label">Certification/Exam</span>
                                            <div className="emp-claim-cert-value-wrap">
                                                <div className="emp-cert-type-icon-box emp-badge-blue mini">
                                                    <img src={badgeIcon} alt="" style={{ width: 30, height: 30 }} />
                                                </div>
                                                <span className="emp-claim-cert-name" title={claim.certificateTitle}>
                                                    {claim.certificateTitle}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="emp-col-amount">
                                            <span className="emp-reimb-mobile-label">Amount</span>
                                            <span className="emp-claim-amount-text">
                                                {typeof claim.amount === "string" && claim.amount.startsWith("₹")
                                                    ? claim.amount
                                                    : `₹${Number(claim.amount || claim.rawCost || 0).toLocaleString("en-IN")}`}
                                            </span>
                                        </div>

                                        <div className="emp-col-purchase-date">
                                            <span className="emp-reimb-mobile-label">Date of Purchase</span>
                                            <span className="emp-claim-date-text">
                                                {formatShortDate(claim.purchaseDate || claim.requestDate)}
                                            </span>
                                        </div>

                                        <div className="emp-col-submitted-on">
                                            <span className="emp-reimb-mobile-label">Submitted On</span>
                                            <span className="emp-claim-date-text">
                                                {formatShortDate(claim.submittedOn || claim.requestDate)}
                                            </span>
                                        </div>

                                        <div className="emp-col-status">
                                            <span className="emp-reimb-mobile-label">Status</span>
                                            <div className="emp-claim-status-box">
                                                <span className={`emp-reimb-status-pill ${claim.status.toLowerCase()}`}>
                                                    {claim.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="emp-col-action emp-reimb-action-group">
                                            <span className="emp-reimb-mobile-label">Action</span>
                                            <button
                                                type="button"
                                                className="emp-reimb-eye-btn"
                                                title="View Reimbursement Claim Details"
                                                aria-label="View Reimbursement Claim Details"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onViewClaimDetails) {
                                                        onViewClaimDetails(claim);
                                                    }
                                                }}
                                            >
                                                <img
                                                    src={blueEyeIcon}
                                                    alt="View Details"
                                                    style={{ width: "13px", height: "9px", display: "block" }}
                                                />
                                            </button>
                                            <button
                                                className="emp-icon-action-btn"
                                                title={isExpanded ? "Hide Timeline" : "Show Approval Timeline"}
                                                onClick={() => setExpandedClaimId(isExpanded ? null : claim.id)}
                                            >
                                                <span className="emp-reimb-action-toggle-label">{isExpanded ? "Hide" : "View"}</span>
                                                <img
                                                    src={isExpanded ? blackdownarrowIcon : blackrightarrowIcon}
                                                    alt="Toggle Timeline"
                                                    style={isExpanded ? { width: 9, height: 5 } : { width: 5, height: 9 }}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Collapsible Approval Timeline */}
                                    {isExpanded && (() => {
                                        const isPaid =
                                            String(claim.processingStatus || claim.processing_status || claim.raw?.processing_status || "").toLowerCase() === "paid" ||
                                            Boolean(claim.payment_slip_path || claim.raw?.payment_slip_path) ||
                                            Boolean(claim.payment_code || claim.raw?.payment_code) ||
                                            Boolean(claim.paid_on || claim.raw?.paid_on) ||
                                            claim.stages?.some((s) => String(s.stage_name || "").toLowerCase() === "claimed" && String(s.stage_status || "").toLowerCase() === "completed");

                                        const paidDate = claim.paid_on || claim.raw?.paid_on || claim.raw?.payment_date;
                                        const isApproved = String(claim.status || "").toLowerCase() === "approved";
                                        const isRejected = String(claim.status || "").toLowerCase() === "rejected";
                                        const isCeoBypassed = Boolean(claim.is_ceo_bypassed || claim.raw?.is_ceo_bypassed);

                                        const liveSteps = (claim.stages && claim.stages.length > 0)
                                            ? (() => {
                                                return claim.stages.map((st, idx) => {
                                                    const isFinal = idx === claim.stages.length - 1;
                                                    let normName = st.stage_name;
                                                    if (normName === "Employee") normName = "Employee Request";
                                                    if (normName === "CEO Approval" && isCeoBypassed) normName = "CEO Bypass";

                                                    const rawStatus = String(st.stage_status || "").toLowerCase();
                                                    const isFinalStage = isFinal || normName === "Claimed" || normName === "Reimbursed";

                                                    let status = "upcoming";
                                                    let date = "-";

                                                    if (isFinalStage) {
                                                        if (isPaid) {
                                                            status = "completed_final";
                                                            date = formatShortDate(paidDate || st.stage_date) || "Paid";
                                                        } else if (isApproved) {
                                                            status = "pending";
                                                            date = "Pending";
                                                        } else if (isRejected) {
                                                            status = "rejected";
                                                            date = "-";
                                                        } else {
                                                            status = "upcoming";
                                                            date = "-";
                                                        }
                                                    } else if (normName === "HR Approval" || normName === "HR Claim Approval") {
                                                        if (isApproved || rawStatus === "completed" || rawStatus === "approved") {
                                                            status = "completed";
                                                            date = formatShortDate(st.stage_date || claim.approved_on || claim.raw?.approved_on || claim.submittedOn);
                                                        } else if (isRejected || rawStatus === "rejected") {
                                                            status = "rejected";
                                                            date = "Rejected";
                                                        } else {
                                                            status = "pending";
                                                            date = "Pending";
                                                        }
                                                    } else {
                                                        if (rawStatus === "completed" || rawStatus === "approved") {
                                                            status = "completed";
                                                            date = formatShortDate(st.stage_date || claim.submittedOn || "-");
                                                        } else if (rawStatus === "rejected") {
                                                            status = "rejected";
                                                            date = "Rejected";
                                                        } else if (rawStatus === "pending") {
                                                            status = "pending";
                                                            date = "Pending";
                                                        } else {
                                                            status = "upcoming";
                                                            date = "-";
                                                        }
                                                    }

                                                    return {
                                                        label: normName,
                                                        date: date,
                                                        status: status,
                                                    };
                                                });
                                            })()
                                            : [
                                                { label: "Employee Request", date: formatShortDate(claim.submittedOn), status: "completed" },
                                                { label: "Notified to RM", date: formatShortDate(claim.submittedOn), status: "completed" },
                                                { label: "L&D status", date: formatShortDate(claim.submittedOn), status: "completed" },
                                                {
                                                    label: "HR Claim Approval",
                                                    date: isApproved ? formatShortDate(claim.approved_on || claim.submittedOn) : (isRejected ? "Rejected" : "Pending"),
                                                    status: isApproved ? "completed" : (isRejected ? "rejected" : "pending"),
                                                },
                                                {
                                                    label: "Claimed",
                                                    date: isPaid ? (formatShortDate(paidDate) || "Paid") : (isApproved ? "Pending" : "-"),
                                                    status: isPaid ? "completed_final" : (isApproved ? "pending" : (isRejected ? "rejected" : "upcoming")),
                                                },
                                            ];

                                        return (
                                            <div className="emp-cert-timeline-expanded-container">
                                                <div className="emp-timeline-header-box">
                                                    <div className="emp-corner-icon-square">
                                                        <img src={cornerDownRightIcon} alt="" style={{ width: 19, height: 15 }} />
                                                    </div>
                                                    <span className="emp-timeline-title-text">Claim Approval Timeline</span>
                                                </div>

                                                <div className="emp-timeline-stepper-row">
                                                    {liveSteps.map((step, idx) => (
                                                        <React.Fragment key={idx}>
                                                            <div className="emp-timeline-step-item">
                                                                {step.status === "rejected" ? (
                                                                    <div className="emp-step-circle red" title="Rejected" style={{ width: 24, height: 24, marginBottom: 6 }}>
                                                                        <X size={13} strokeWidth={2.5} />
                                                                    </div>
                                                                ) : (
                                                                    <img
                                                                        src={getTrackerStepIcon(step.status)}
                                                                        alt={step.status}
                                                                        style={{ width: 24, height: 24, marginBottom: 6 }}
                                                                    />
                                                                )}
                                                                <span className="emp-step-label">{step.label}</span>
                                                                <span className={`emp-step-date ${step.status === "rejected" ? "rejected" : ""}`}>{step.date}</span>
                                                            </div>
                                                            {idx < liveSteps.length - 1 && (
                                                                <div className="emp-tracker-timeline-connector" />
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination placed inside table card */}
                {!isLoading && sortedClaims.length > 0 && (
                    <Pagination
                        currentPage={safePage}
                        setCurrentPage={setCurrentPage}
                        total={sortedClaims.length}
                        itemsPerPage={itemsPerPage}
                        type="Claims"
                    />
                )}
            </div>
        </div>
    );
}
