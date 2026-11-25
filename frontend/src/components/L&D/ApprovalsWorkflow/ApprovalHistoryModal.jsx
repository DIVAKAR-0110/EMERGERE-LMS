import React, { useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { X, Check, Eye, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import ApprovalDetailsModal from "../Dashboard/ApprovalDetailsModal";
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
        case "approved":
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

    const handleViewDetails = async (e, item) => {
        e.stopPropagation();
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
                console.warn("[ApprovalHistoryModal] Could not fetch course request details by id:", err);
            }
        }
        setSelectedDetail({ ...item, type });
    };

    if (!isOpen) return null;

    const modalContent = (
        <>
            <div className="ld-aw-history-modal-overlay">
                <div
                    className="ld-aw-history-modal-card"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="ld-aw-history-modal-header">
                        <div>
                            <h2 className="ld-aw-history-title">
                                {type} Approval History
                            </h2>
                            <p className="ld-aw-history-subtitle">
                                View the approval progress, request details, and purchase status for all submitted {type === "Certification" ? "certificate" : "course"} requests.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="ld-aw-history-close-btn"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Table Header Row */}
                    <div className="ld-aw-history-table-header">
                        <div className="ld-aw-hcol-id">Claim ID</div>
                        <div className="ld-aw-hcol-course">{type}</div>
                        <div className="ld-aw-hcol-emp">Employee Name</div>
                        <div className="ld-aw-hcol-date">Requested On</div>
                        <div className="ld-aw-hcol-status">Status</div>
                        <div className="ld-aw-hcol-action">Action</div>
                    </div>

                    {/* Body / List */}
                    <div className="ld-aw-history-modal-body">
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
                                        className={`ld-aw-history-card-accordion ${isExpanded ? "expanded" : ""}`}
                                    >
                                        {/* Main Row Header */}
                                        <div className="ld-aw-history-row-header">
                                            <div className="ld-aw-hcol-id">
                                                <span className="ld-aw-history-id-text">{item.id}</span>
                                            </div>

                                            <div className="ld-aw-hcol-course">
                                                <div className="ld-aw-history-course-wrap">
                                                    <div
                                                        className="ld-aw-history-book-icon"
                                                        style={{ backgroundImage: `url("${bookBg}")` }}
                                                    >
                                                        <img
                                                            src={bookSvg}
                                                            alt=""
                                                            className="ld-aw-history-book-svg"
                                                        />
                                                    </div>
                                                    <span className="ld-aw-history-course-name" title={item.course}>
                                                        {item.course}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="ld-aw-hcol-emp">
                                                <span className="ld-aw-history-emp-text">{item.employee || item.name}</span>
                                            </div>


                                            <div className="ld-aw-hcol-date">
                                                <span className="ld-aw-history-date-text">{item.requestedOn || item.requestDate}</span>
                                            </div>

                                            <div className="ld-aw-hcol-status">
                                                <span className={item.status === "Rejected" ? "ld-aw-badge-rejected" : "ld-aw-badge-approved"}>
                                                    {item.status}
                                                </span>
                                            </div>

                                            <div className="ld-aw-hcol-action">
                                                <div className="ld-aw-history-action-group">
                                                    <button
                                                        type="button"
                                                        className="ld-aw-history-eye-btn"
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
                                                        className="ld-aw-history-chevron-btn"
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

                                        {/* Expandable Drawer with Sub-card & Stepper */}
                                        {isExpanded && (
                                            <div className="ld-aw-history-drawer">
                                                {/* Subcard (Left Info Box) */}
                                                <div className="ld-aw-history-subcard">
                                                    <div className="ld-aw-history-subcard-icon">
                                                        <CornerDownRight size={14} color="#215EF8" />
                                                    </div>
                                                    <div className="ld-aw-history-subcard-details">
                                                        <span className="ld-aw-history-subcard-name" title={item.employee || item.name}>
                                                            {item.employee || item.name}
                                                        </span>
                                                        <span className="ld-aw-history-subcard-course" title={item.course}>
                                                            {item.course}
                                                        </span>
                                                        <span className="ld-aw-history-subcard-date">
                                                            {item.steps?.[0]?.date || item.requestedOn || item.requestDate}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 5-Step Stepper (Right Pipeline) */}
                                                <div className="ld-aw-history-stepper">
                                                    {item.steps?.map((step, idx) => {
                                                        const isLast = idx === item.steps.length - 1;
                                                        const isRejected = step.status === "rejected" || step.date?.toLowerCase() === "rejected";
                                                        let stepStatus = step.status;
                                                        if (!stepStatus) {
                                                            if (isRejected) {
                                                                stepStatus = "rejected";
                                                            } else if (step.done) {
                                                                stepStatus = isLast ? "completed_final" : "completed";
                                                            } else {
                                                                stepStatus = "upcoming";
                                                            }
                                                        }

                                                        return (
                                                            <React.Fragment key={step.label}>
                                                                <div className="ld-aw-hstepper-node">
                                                                    <div className="ld-aw-hstepper-icon-wrapper">
                                                                        {stepStatus === "rejected" ? (
                                                                            <div
                                                                                className="ld-aw-hstepper-circle rejected"
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
                                                                                className="ld-aw-hstepper-icon-img"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <span className="ld-aw-hstepper-label">
                                                                        {step.label}
                                                                    </span>
                                                                    <span className={`ld-aw-hstepper-date ${(stepStatus === "rejected" || isRejected) && step.date !== "—" && step.date !== "-" ? "rejected" : ""}`}>
                                                                        {step.date}
                                                                    </span>
                                                                </div>

                                                                {!isLast && (
                                                                    <div className="ld-aw-hstepper-dotted-line" />
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
                    <div className="ld-aw-history-modal-footer">
                        <button
                            type="button"
                            className="ld-aw-history-ok-btn"
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
                    readOnly={true}
                />
            )}
        </>
    );

    return createPortal(modalContent, document.body);
}
