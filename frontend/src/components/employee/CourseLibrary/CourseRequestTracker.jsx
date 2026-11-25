import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import closeIcon from "../../../assets/course_library/close.svg";
import badgeIcon from "../../../assets/course_library/badge.svg";
import blueCheckIcon from "../../../assets/course_library/bluecheck.svg";
import clockIcon from "../../../assets/course_library/clock.svg";
import circleDotIcon from "../../../assets/course_library/CircleDot.svg";
import greenCheckIcon from "../../../assets/course_library/greencheck.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { getApprovalHighlightKey } from "../../../utils/notificationHighlight";

import "../../../styles/employee/CourseRequestTracker.css";

const CourseRequestTrackerSkeleton = ({ count = 3 }) => {
    return (
        <div className="emp-tracker-skeleton-list">
            {Array.from({ length: count }).map((_, idx) => (
                <div className="emp-tracker-card emp-tracker-card-skeleton" key={`tracker-skel-${idx}`}>
                    {/* LEFT SIDE SKELETON */}
                    <div className="emp-tracker-info-side">
                        <div className="emp-tracker-icon-box emp-tracker-skeleton-shimmer" />
                        <div className="emp-tracker-text-info">
                            <span className="emp-tracker-skeleton-line emp-tracker-skel-code emp-tracker-skeleton-shimmer" />
                            <span className="emp-tracker-skeleton-line emp-tracker-skel-title emp-tracker-skeleton-shimmer" />
                            <span className="emp-tracker-skeleton-line emp-tracker-skel-date emp-tracker-skeleton-shimmer" />
                        </div>
                    </div>

                    {/* RIGHT SIDE SKELETON TIMELINE */}
                    <div className="emp-tracker-timeline">
                        {Array.from({ length: 5 }).map((_, stepIdx) => (
                            <React.Fragment key={`skel-step-${idx}-${stepIdx}`}>
                                <div className="emp-tracker-timeline-step">
                                    <div className="emp-tracker-step-icon-wrapper">
                                        <div className="emp-tracker-skeleton-circle emp-tracker-skeleton-shimmer" />
                                    </div>
                                    <span className="emp-tracker-skeleton-line emp-tracker-skel-label emp-tracker-skeleton-shimmer" />
                                    <span className="emp-tracker-skeleton-line emp-tracker-skel-sub emp-tracker-skeleton-shimmer" />
                                </div>
                                {stepIdx < 4 && (
                                    <div className="emp-tracker-timeline-connector emp-tracker-skel-connector" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const CourseRequestTracker = ({
    isOpen,
    onClose,
    trackerItems = [],
    highlightedItemId = null,
    isLoading = false,
}) => {
    const highlightedCardRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !highlightedItemId || !highlightedCardRef.current) return;
        const t = setTimeout(() => {
            highlightedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [isOpen, highlightedItemId, trackerItems]);

    if (!isOpen) return null;

    const getStepIcon = (status) => {
        switch (status) {
            case "completed":
                return blueCheckIcon;
            case "completed_final":
                return greenCheckIcon;
            case "pending":
                return clockIcon;
            case "rejected":
                return closeIcon;
            case "upcoming":
            default:
                return circleDotIcon;
        }
    };

    return createPortal(
        <div className="emp-custom-modal-overlay">
            <div className="emp-tracker-modal" onClick={(e) => e.stopPropagation()}>
                {/* CLOSE BUTTON */}
                <button
                    type="button"
                    className="emp-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="close-icon" width={12} height={12} />
                </button>

                {/* HEADER */}
                <div className="emp-tracker-modal-header">
                    <h2 className="emp-tracker-modal-blue-title">Course Request Tracker</h2>
                    <p>Submit a request for a course you want to learn</p>
                </div>

                {/* TRACKER LIST */}
                <div className="emp-tracker-list">
                    {isLoading ? (
                        <CourseRequestTrackerSkeleton count={3} />
                    ) : trackerItems.length === 0 ? (
                        <div className="emp-tracker-empty-state">
                            <img
                                src={openBookIcon}
                                alt="No course requests submitted yet"
                                className="emp-tracker-empty-icon"
                            />
                            <p className="emp-tracker-empty-text">No course requests submitted yet.</p>
                        </div>
                    ) : (
                        trackerItems.map((item) => {
                            const isHighlighted =
                                Boolean(highlightedItemId) &&
                                getApprovalHighlightKey(item) === String(highlightedItemId);
                            return (
                                <div
                                    className={`emp-tracker-card ${isHighlighted ? "aw-card-highlighted" : ""}`}
                                    key={item.id}
                                    ref={isHighlighted ? highlightedCardRef : null}
                                    data-request-id={item.id}
                                >
                                    {/* COURSE & EMPLOYEE INFO (LEFT SIDE) */}
                                    <div className="emp-tracker-info-side">
                                        <div className="emp-tracker-icon-box">
                                            <img
                                                src={badgeIcon}
                                                alt="Badge"
                                                className="emp-tracker-badge-icon"
                                                width={15}
                                                height={21}
                                            />
                                        </div>

                                        <div className="emp-tracker-text-info">
                                            <div className="aw-id-highlight-wrap">
                                                <span className="emp-tracker-employee-name">
                                                    {item.courseRequestId || item.requestCode || item.request_code || item.requestId || item.id}
                                                </span>
                                                {isHighlighted && (
                                                    <span className="aw-notif-highlight-badge">Selected Request</span>
                                                )}
                                            </div>
                                            <span
                                                className="emp-tracker-course-title"
                                                title={`${item.courseTitle} ${item.provider}`}
                                            >
                                                {item.courseTitle} — {item.provider}
                                            </span>
                                            <span className="emp-tracker-request-date">
                                                {item.requestDate}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 5-STEP HORIZONTAL TIMELINE (RIGHT SIDE) */}
                                    <div className="emp-tracker-timeline">
                                        {item.steps?.map((step, index) => (
                                            <React.Fragment key={step.id}>
                                                <div className="emp-tracker-timeline-step">
                                                    {/* STEP CIRCLE */}
                                                    <div className="emp-tracker-step-icon-wrapper">
                                                        {step.status === "rejected" ? (
                                                            <div className="emp-tracker-step-circle red" title="Rejected">
                                                                <X size={14} strokeWidth={2.5} />
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={getStepIcon(step.status)}
                                                                alt={step.status}
                                                                className="emp-tracker-step-svg"
                                                                width={28}
                                                                height={28}
                                                            />
                                                        )}
                                                    </div>

                                                    {/* STEP NAME */}
                                                    <span className="emp-tracker-step-label">
                                                        {step.label}
                                                    </span>

                                                    {/* STEP SUBTEXT / DATE */}
                                                    {(() => {
                                                        const isPriorStageRejected = item.steps.slice(0, index).some(
                                                            (prevStep) => prevStep.status === "rejected" || prevStep.subText?.toLowerCase() === "rejected"
                                                        );
                                                        const isCurrentStageRejected = step.status === "rejected" && !isPriorStageRejected && step.subText !== "-";
                                                        const displaySubtext = isPriorStageRejected || step.subText === "-" || step.date === "-"
                                                            ? "-"
                                                            : step.subText === "Approval Pending..."
                                                            ? "Pending"
                                                            : (step.subText || (isCurrentStageRejected ? "Rejected" : "\u00A0"));

                                                        return (
                                                            <span
                                                                className={`emp-tracker-step-sub ${
                                                                    step.status === "pending"
                                                                        ? "emp-pending-text"
                                                                        : isCurrentStageRejected
                                                                        ? "emp-rejected-text"
                                                                        : ""
                                                                } ${!displaySubtext ? "emp-empty-sub" : ""}`}
                                                            >
                                                                {displaySubtext}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>

                                                {/* CONNECTOR DASHED LINE BETWEEN STEPS */}
                                                {index < item.steps.length - 1 && (
                                                    <div className="emp-tracker-timeline-connector" />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            );
                        }))}
                </div>


            </div>
        </div >,
        document.body
    );
};

export default CourseRequestTracker;