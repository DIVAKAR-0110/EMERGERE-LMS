import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { X, Check, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import ApprovalDetailsModal from "./ApprovalDetailsModal";
import useCustomScrollbar from "../../../hooks/useCustomScrollbar";
import bookBg from "../../../assets/Approvals & Workflow/book.svg";
import bookSvg from "../../../assets/Approvals & Workflow/bookbackground.svg";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";
import blueCheckIcon from "../../../assets/course_library/bluecheck.svg";
import greenCheckIcon from "../../../assets/course_library/greencheck.svg";
import clockIcon from "../../../assets/course_library/clock.svg";
import circleDotIcon from "../../../assets/course_library/CircleDot.svg";

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ApprovalHistoryModal({
    isOpen,
    onClose,
    historyData = [],
    type = "Course",
}) {
    // Single accordion expansion: only one row expanded at a time
    const [expandedKey, setExpandedKey] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);

    const {
        containerRef,
        trackRef,
        thumbRef,
        thumbOffset,
        hasOverflow,
        isDragging,
        handleScroll,
        handlePointerDown,
        handleTrackClick,
    } = useCustomScrollbar({
        thumbHeight: 80,
        deps: [historyData, expandedKey, isOpen],
    });

    // Reset whenever the modal is reopened
    useEffect(() => {
        if (isOpen) {
            setExpandedKey(null);
            setSelectedDetail(null);
        }
    }, [isOpen]);

    const toggleExpand = (key) => {
        setExpandedKey((prevKey) => (prevKey === key ? null : key));
    };

    const handleViewDetails = async (e, item) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (item.new_course_id) {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/course-requests/${item.new_course_id}`);
                if (res.data) {
                    const db = res.data;
                    setSelectedDetail({
                        ...item,
                        type,
                        new_course_id: db.id,
                        id: db.request_code || item.id,
                        courseName: db.course_name,
                        course: db.course_name,
                        provider: db.provider,
                        platform: db.provider,
                        category: db.category,
                        courseCategory: db.category,
                        courseLink: db.course_link,
                        whyLearn: db.reason,
                        description: db.reason,
                        employee: db.employee_name,
                        name: db.employee_name,
                        raw: db
                    });
                    return;
                }
            } catch (err) {
                console.warn("[CEO ApprovalHistoryModal] Could not fetch request details by id:", err);
            }
        }
        setSelectedDetail({ ...item, type });
    };

    if (!isOpen) return null;

    const modalContent = (
        <>
            <div className="ceo-aw-history-modal-overlay">
                <div
                    className="ceo-aw-history-modal-card"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="ceo-aw-history-modal-header">
                        <div>
                            <h2 className="ceo-aw-history-title">
                                {type} Approval History
                            </h2>
                            <p className="ceo-aw-history-subtitle">
                                View the approval progress, request details, and purchase status for all submitted {type === "Certification" ? "certificate" : "course"} requests.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="ceo-aw-history-close-btn"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Table Header Row */}
                    <div className="ceo-aw-history-table-header">
                        <div className="ceo-aw-hcol-id">Claim ID</div>
                        <div className="ceo-aw-hcol-course">{type}</div>
                        <div className="ceo-aw-hcol-emp">Employee Name</div>
                        <div className="ceo-aw-hcol-date">Requested On</div>
                        <div className="ceo-aw-hcol-status">Status</div>
                        <div className="ceo-aw-hcol-action">Action</div>
                    </div>

                    {/* Body / List */}
                    <div className="ceo-aw-history-body-wrapper">
                        <div
                            className="ceo-aw-history-modal-body"
                            ref={containerRef}
                            onScroll={handleScroll}
                        >
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
                                        className={`ceo-aw-history-card-accordion ${isExpanded ? "expanded" : ""}`}
                                    >
                                        {/* Main Row Header */}
                                        <div className="ceo-aw-history-row-header">
                                            <div className="ceo-aw-hcol-id">
                                                <button
                                                    type="button"
                                                    className="ceo-aw-request-id-link"
                                                    onClick={(e) => handleViewDetails(e, item)}
                                                    title="View Course Approval Details"
                                                >
                                                    {item.id}
                                                </button>
                                            </div>

                                            <div className="ceo-aw-hcol-course">
                                                <div className="ceo-aw-history-course-wrap">
                                                    <div
                                                        className="ceo-aw-history-book-icon"
                                                        style={{ backgroundImage: `url("${bookBg}")` }}
                                                    >
                                                        <img
                                                            src={bookSvg}
                                                            alt=""
                                                            className="ceo-aw-history-book-svg"
                                                        />
                                                    </div>
                                                    <span className="ceo-aw-history-course-name" title={item.course}>
                                                        {item.course}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="ceo-aw-hcol-emp">
                                                <span className="ceo-aw-history-emp-text">{item.employee || item.name}</span>
                                            </div>

                                            <div className="ceo-aw-hcol-date">
                                                <span className="ceo-aw-history-date-text">{item.requestedOn || item.requestDate}</span>
                                            </div>

                                            <div className="ceo-aw-hcol-status">
                                                <span className={item.status === "Rejected" ? "ceo-aw-badge-rejected" : "ceo-aw-badge-approved"}>
                                                    {item.status}
                                                </span>
                                            </div>

                                            <div className="ceo-aw-hcol-action">
                                                <div className="ceo-aw-history-action-group">
                                                    <button
                                                        type="button"
                                                        className="ceo-aw-history-eye-btn"
                                                        title="View Details"
                                                        onClick={(e) => handleViewDetails(e, item)}
                                                    >
                                                        <img
                                                            src={blueEyeIcon}
                                                            alt="View"
                                                            style={{ width: "13px", height: "9px", display: "block" }}
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ceo-aw-history-chevron-btn"
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
                                        <div className="ceo-aw-history-card-mobile">
                                            <div className="ceo-aw-hcard-top">
                                                <button
                                                    type="button"
                                                    className="ceo-aw-request-id-link"
                                                    onClick={(e) => handleViewDetails(e, item)}
                                                    title="View Details"
                                                >
                                                    {item.id}
                                                </button>

                                                <div className="ceo-aw-hcard-top-right">
                                                    <span className={item.status === "Rejected" ? "ceo-aw-badge-rejected" : "ceo-aw-badge-approved"}>
                                                        {item.status}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="ceo-aw-history-eye-btn"
                                                        title="View Details"
                                                        onClick={(e) => handleViewDetails(e, item)}
                                                    >
                                                        <img
                                                            src={blueEyeIcon}
                                                            alt="View Details"
                                                            style={{ width: "13px", height: "9px", display: "block" }}
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ceo-aw-history-chevron-btn"
                                                        onClick={() => toggleExpand(itemKey)}
                                                        title={isExpanded ? "Collapse" : "Expand"}
                                                    >
                                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="ceo-aw-hcard-course">
                                                <div
                                                    className="ceo-aw-history-book-icon"
                                                    style={{ backgroundImage: `url("${bookBg}")` }}
                                                >
                                                    <img src={bookSvg} alt="" className="ceo-aw-history-book-svg" />
                                                </div>
                                                <span className="ceo-aw-hcard-course-title" title={item.course}>
                                                    {item.course}
                                                </span>
                                            </div>

                                            <div className="ceo-aw-hcard-meta-grid">
                                                <div className="ceo-aw-hcard-meta-item">
                                                    <span className="ceo-aw-hcard-meta-label">Employee</span>
                                                    <span className="ceo-aw-hcard-meta-val">{item.employee || item.name}</span>
                                                </div>
                                                <div className="ceo-aw-hcard-meta-item">
                                                    <span className="ceo-aw-hcard-meta-label">Amount</span>
                                                    <span className="ceo-aw-hcard-meta-val ceo-aw-hcard-val-amount">{item.amount || "₹1,000"}</span>
                                                </div>
                                                <div className="ceo-aw-hcard-meta-item">
                                                    <span className="ceo-aw-hcard-meta-label">Requested</span>
                                                    <span className="ceo-aw-hcard-meta-val">{item.requestedOn || item.requestDate}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expandable Drawer with Sub-card & Stepper */}
                                        {isExpanded && (
                                            <div className="ceo-aw-history-drawer">
                                                {/* Subcard (Left Info Box) */}
                                                <div className="ceo-aw-history-subcard">
                                                    <div className="ceo-aw-history-subcard-icon">
                                                        <CornerDownRight size={14} color="#215EF8" />
                                                    </div>
                                                    <div className="ceo-aw-history-subcard-details">
                                                        <span className="ceo-aw-history-subcard-name">
                                                            {item.employee || item.name}
                                                        </span>
                                                        <span className="ceo-aw-history-subcard-course">
                                                            {item.course} {item.platform ? `— ${item.platform}` : ""}
                                                        </span>
                                                        <span className="ceo-aw-history-subcard-date">
                                                            {item.steps?.[0]?.date || item.requestedOn || item.requestDate}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 5-Step Stepper (Right Pipeline) */}
                                                <div className="ceo-aw-history-stepper">
                                                    {item.steps?.map((step, idx) => {
                                                        const isLast = idx === item.steps.length - 1;
                                                        const isRejected = step.status === "rejected" || step.date?.toLowerCase() === "rejected";
                                                        let stepStatus = step.status;
                                                        if (!stepStatus) {
                                                            if (isRejected) {
                                                                stepStatus = "rejected";
                                                            } else if (step.done) {
                                                                stepStatus = isLast ? "completed_final" : "completed";
                                                            } else if (step.date?.toLowerCase() === "pending") {
                                                                stepStatus = "pending";
                                                            } else {
                                                                stepStatus = "upcoming";
                                                            }
                                                        }

                                                        return (
                                                            <React.Fragment key={step.label}>
                                                                <div className="ceo-aw-hstepper-node">
                                                                    <div className="ceo-aw-hstepper-icon-wrapper">
                                                                        {stepStatus === "rejected" ? (
                                                                            <div
                                                                                className="ceo-aw-hstepper-circle rejected"
                                                                                style={{
                                                                                    width: 22,
                                                                                    height: 22,
                                                                                    borderRadius: "50%",
                                                                                    background: "#EF4444",
                                                                                    border: "1.5px solid #DC2626",
                                                                                    display: "flex",
                                                                                    alignItems: "center",
                                                                                    justifyContent: "center",
                                                                                    color: "#FFFFFF",
                                                                                    fontSize: 11,
                                                                                    fontWeight: "bold",
                                                                                    margin: 0,
                                                                                    flexShrink: 0
                                                                                }}
                                                                                title="Rejected"
                                                                            >
                                                                                ✕
                                                                            </div>
                                                                        ) : (
                                                                            <img
                                                                                src={getTrackerStepIcon(stepStatus)}
                                                                                alt={stepStatus}
                                                                                className="ceo-aw-hstepper-icon-img"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <span className="ceo-aw-hstepper-label">
                                                                        {step.label}
                                                                    </span>
                                                                    <span className={`ceo-aw-hstepper-date ${(stepStatus === "rejected" || isRejected) && step.date !== "—" && step.date !== "-" ? "rejected" : ""}`}>
                                                                        {step.date}
                                                                    </span>
                                                                </div>

                                                                {!isLast && (
                                                                    <div className="ceo-aw-hstepper-dotted-line" />
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

                        {/* Custom 7px x 80px scrollbar (#D9D9D9) */}
                        {hasOverflow && (
                            <div
                                className="ceo-aw-history-scroll-track"
                                ref={trackRef}
                                onClick={handleTrackClick}
                                title="Scroll"
                            >
                                <div
                                    className={`ceo-aw-history-scroll-thumb ${isDragging ? "dragging" : ""}`}
                                    ref={thumbRef}
                                    style={{ transform: `translateY(${thumbOffset}px)` }}
                                    onPointerDown={handlePointerDown}
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="ceo-aw-history-modal-footer">
                        <button
                            type="button"
                            className="ceo-aw-history-ok-btn"
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
