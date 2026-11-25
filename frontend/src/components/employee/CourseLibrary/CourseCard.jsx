import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { COURSE_ICONS, STATUS_ICONS, getStatusIcon } from "../../../constants/courseIcons";
import durationIcon from "../../../assets/course_library/duration.svg";
import completedIcon from "../../../assets/course_library/completed.svg";
import remainingIcon from "../../../assets/course_library/remaining.svg";
import progressIcon from "../../../assets/course_library/progress.svg";
import "../../../styles/employee/CourseCard.css";

// ── Launch course via the LearningTracker browser extension ──
// For Udemy courses, dispatches `lt:startCourse` for lmsContent.ts, falling back to
// opening the course URL directly if the extension is not installed.
// Non-Udemy URLs open directly in a new tab with noopener,noreferrer.
const FALLBACK_UDEMY_URL = "https://www.udemy.com/join/passwordless-auth/?action=login&mode";

function normalizeCourseUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return FALLBACK_UDEMY_URL;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function isUdemyCourseUrl(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname === "udemy.com" || hostname.endsWith(".udemy.com");
    } catch {
        return false;
    }
}

function launchCourse(courseUrl, courseTitle, employeeEmail = "", courseId = null, employeeId = "EMP019", accountEmail = "") {
    const targetUrl = normalizeCourseUrl(courseUrl);
    const targetAccountEmail = accountEmail || "rdivakar0110@outlook.com";

    let sessionHandled = false;
    const onLaunched = () => {
        sessionHandled = true;
    };
    document.addEventListener("lt:sessionLaunched", onLaunched, { once: true });

    document.dispatchEvent(
        new CustomEvent("lt:startCourse", {
            detail: {
                employeeEmail,
                accountEmail: targetAccountEmail,
                courseUrl: targetUrl,
                courseTitle: courseTitle || "",
                courseId: courseId || 1,
                employeeId: employeeId || "EMP019",
            },
        })
    );

    // Fallback if LearningTracker extension does not respond within 1.5s
    setTimeout(() => {
        document.removeEventListener("lt:sessionLaunched", onLaunched);
        if (!sessionHandled) {
            window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
    }, 1500);
}

const CourseCard = ({ course, onEnroll, onUnenroll, isHighlighted = false }) => {
    const { user } = useAuth();
    const [showMobilePopover, setShowMobilePopover] = useState(false);
    const [popoverPlacement, setPopoverPlacement] = useState("bottom");
    const progressRef = useRef(null);
    const cardRef = useRef(null);

    // Smoothly scroll into view when navigated to from a notification
    useEffect(() => {
        if (!isHighlighted || !cardRef.current) return;
        const timer = setTimeout(() => {
            cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(timer);
    }, [isHighlighted]);

    // Dismiss mobile popover when tapping outside
    useEffect(() => {
        if (!showMobilePopover) return;
        const handleOutsideClick = (e) => {
            if (progressRef.current && !progressRef.current.contains(e.target)) {
                setShowMobilePopover(false);
            }
        };
        document.addEventListener("pointerdown", handleOutsideClick);
        return () => {
            document.removeEventListener("pointerdown", handleOutsideClick);
        };
    }, [showMobilePopover]);

    const togglePopover = (e) => {
        e.stopPropagation();
        if (!showMobilePopover && progressRef.current) {
            const rect = progressRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // Popover height is ~165px. If less than 185px space below, flip upwards
            if (spaceBelow < 185) {
                setPopoverPlacement("top");
            } else {
                setPopoverPlacement("bottom");
            }
            setShowMobilePopover(true);
        } else {
            setShowMobilePopover(false);
        }
    };

    // Theme class based on status: "in-progress" | "completed" | "assigned" | "available" | "requested" | "pending" | "on-hold"
    const statusTheme = (course.status || "available").toString().toLowerCase().trim().replace(/\s+/g, "-");

    // Dynamic common icon based on button / lifecycle status (replacing static category icons)
    const statusIcon = getStatusIcon(course.status || statusTheme);
    const providerIcon = course.providerIcon || COURSE_ICONS.webLogo;
    const crownIcon = course.crownIcon || COURSE_ICONS.premium;

    return (
        <div
            ref={cardRef}
            data-course-id={course.id}
            className={`emp-course-card emp-card-status-${statusTheme} ${showMobilePopover ? "emp-popover-active" : ""} ${isHighlighted ? "emp-course-card-highlighted" : ""}`}
        >
            {isHighlighted && (
                <span className="emp-notif-highlight-pill">Selected Course</span>
            )}
            <div
                className={`emp-course-thumbnail emp-thumbnail-theme-${statusTheme} ${statusTheme === "in-progress" ? "emp-clickable-thumbnail" : ""}`}
                style={statusTheme === "in-progress" ? { cursor: "pointer" } : undefined}
                title={statusTheme === "in-progress" ? "Click to resume learning video" : undefined}
                onClick={(e) => {
                    if (statusTheme === "in-progress" && course.courseUrl) {
                        e.stopPropagation();
                        launchCourse(
                            course.courseUrl,
                            course.title,
                            user?.email || user?.work_email || "",
                            course.id,
                            user?.employee_id || "EMP019",
                            course.course_account_email || course.accountEmail || "rdivakar0110@outlook.com"
                        );
                    }
                }}
            >
                <span className={`emp-category-badge emp-badge-theme-${statusTheme}`}>
                    {course.category}
                </span>

                {statusIcon && (
                    <img
                        src={statusIcon}
                        alt={course.status || course.category || "Course Icon"}
                        className={`emp-thumbnail-icon emp-icon-status-${statusTheme} emp-icon-theme-${statusTheme}`}
                    />
                )}

            </div>

            <div className="emp-course-card-body">
                <div className="emp-course-info">
                    <h3 className="emp-course-title" title={course.title}>
                        {course.title}
                    </h3>

                    <div className="emp-course-provider">
                        {providerIcon && (
                            <img
                                src={providerIcon}
                                alt={course.provider || "Provider"}
                            />
                        )}
                        <span>{course.provider}</span>
                    </div>
                </div>

                {/* ── 1. IN-PROGRESS: Show amber progress bar with Floating Progress Overview Popover ── */}
                {statusTheme === "in-progress" && (
                    <div
                        ref={progressRef}
                        className={`emp-card-progress-container ${showMobilePopover ? "is-active" : ""}`}
                        tabIndex={0}
                        aria-label="Course Progress Overview"
                        onClick={togglePopover}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                togglePopover(e);
                            }
                        }}
                    >
                        <div className="emp-card-progress-track">
                            <div
                                className="emp-card-progress-fill"
                                style={{ width: `${course.progress || 0}%` }}
                            />
                        </div>
                        <span className="emp-card-progress-text">
                            {course.progress || 0}%
                        </span>

                        {/* Floating Progress Overview Popover on Mouse Hover / Tap */}
                        <div className={`emp-progress-popover emp-popover-${popoverPlacement}`} role="tooltip">
                            <div className="emp-progress-popover-header">
                                Progress Overview
                            </div>
                            <div className="emp-progress-popover-divider" />
                            <div className="emp-progress-popover-content">
                                <div className="emp-progress-popover-row">
                                    <span className="emp-progress-popover-label">
                                        <img src={durationIcon} alt="Total Duration" className="emp-progress-svg-icon" /> Total Duration :
                                    </span>
                                    <span className="emp-progress-popover-value">
                                        {course.totalDurationText || course.duration || "0m"}
                                    </span>
                                </div>
                                <div className="emp-progress-popover-row">
                                    <span className="emp-progress-popover-label">
                                        <img src={completedIcon} alt="Completed" className="emp-progress-svg-icon" /> Completed :
                                    </span>
                                    <span className="emp-progress-popover-value">
                                        {course.completedDurationText || "0m"}
                                    </span>
                                </div>
                                <div className="emp-progress-popover-row">
                                    <span className="emp-progress-popover-label">
                                        <img src={remainingIcon} alt="Remaining" className="emp-progress-svg-icon" /> Remaining :
                                    </span>
                                    <span className="emp-progress-popover-value">
                                        {course.remainingDurationText || "0m"}
                                    </span>
                                </div>
                                <div className="emp-progress-popover-row">
                                    <span className="emp-progress-popover-label">
                                        <img src={progressIcon} alt="Progress" className="emp-progress-svg-icon" /> Progress :
                                    </span>
                                    <span className="emp-progress-popover-value emp-progress-popover-progress-num">
                                        {course.progress || 0}%
                                    </span>
                                </div>
                            </div>
                            <div className={`emp-progress-popover-arrow emp-arrow-${popoverPlacement}`} />
                        </div>
                    </div>
                )}

                {/* ── 2. COMPLETED: Show green outline Completed button ── */}
                {statusTheme === "completed" && (
                    <button
                        type="button"
                        className="emp-btn-course-status emp-btn-status-completed"
                        disabled
                    >
                        Completed
                    </button>
                )}

                {/* ── 3A. ASSIGNED (L&D Direct): Click triggers Enroll Request (same as Enroll Now) ── */}
                {/* Employee sees this when L&D directly pushed the course to their library.          */}
                {/* Clicking sends a course request → RM notified → L&D approves → Not Started       */}
                {statusTheme === "assigned" && (
                    <button
                        type="button"
                        className="emp-btn-course-status emp-btn-status-assigned"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEnroll?.(course); // Same flow as Enroll Now: RM notification → L&D Approval
                        }}
                    >
                        Assigned
                    </button>
                )}

                {/* ── 3B. NOT STARTED: Show cool slate Not Started button ── */}
                {(statusTheme === "not-started" || statusTheme === "not started") && (
                    <button
                        type="button"
                        className="emp-btn-course-status emp-btn-status-not-started"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (course.courseUrl) {
                                launchCourse(
                                    course.courseUrl,
                                    course.title,
                                    user?.email || user?.work_email || "",
                                    course.id,
                                    user?.employee_id || "EMP019",
                                    course.course_account_email || course.accountEmail || "rdivakar0110@outlook.com"
                                );
                            }
                        }}
                    >
                        Not Started
                    </button>
                )}

                {/* ── 4. PENDING / REQUESTED: Show blue outline Pending button ── */}
                {(statusTheme === "pending" || statusTheme === "requested") && (
                    <button
                        type="button"
                        className="emp-btn-course-status emp-btn-status-pending"
                        disabled
                    >
                        Pending
                    </button>
                )}

                {/* ── 5. ON HOLD: Show orange outline On Hold button ── */}
                {(statusTheme === "on-hold" || statusTheme === "on hold") && (
                    <button
                        type="button"
                        className="emp-btn-course-status emp-btn-status-onhold"
                        disabled
                    >
                        On Hold
                    </button>
                )}

                {/* ── 6. AVAILABLE: Show purple outline Enroll Now button (debounced to prevent duplicate requests) ── */}
                {(statusTheme === "available" || (![
                    "completed", "assigned", "not-started", "not started",
                    "pending", "requested", "on-hold", "on hold",
                    "in-progress"
                ].includes(statusTheme))) && (
                        <button
                            type="button"
                            className="emp-btn-course-status emp-btn-status-enroll"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEnroll?.(course);
                            }}
                        >
                            Enroll Now
                        </button>
                    )}

                {/* ── 7. COURSE ACTIONS: Unenrollment button with >50% completion protection (ENR-YYYY-021) ──
                {statusTheme === "in-progress" && onUnenroll && (
                    <div className="emp-course-card-actions" style={{ marginTop: "4px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                            type="button"
                            className={`emp-btn-course-unenroll ${Number(course.progress || 0) > 50 ? "disabled" : ""}`}
                            disabled={Number(course.progress || 0) > 50}
                            title={Number(course.progress || 0) > 50 ? "Unenrollment disabled: completion exceeds 50% threshold per corporate training audit policy." : "Drop course"}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (Number(course.progress || 0) > 50) return;
                                onUnenroll(course);
                            }}
                            style={{
                                background: "none",
                                border: "none",
                                padding: "0 2px",
                                fontSize: "11px",
                                color: Number(course.progress || 0) > 50 ? "#94A3B8" : "#EF4444",
                                cursor: Number(course.progress || 0) > 50 ? "not-allowed" : "pointer",
                                textDecoration: Number(course.progress || 0) > 50 ? "none" : "underline",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                            }}
                        >
                            {Number(course.progress || 0) > 50 ? "Unenroll (Disabled >50%)" : "Drop Course"}
                        </button>
                    </div>
                )} */}
            </div>
        </div>
    );
};

export default CourseCard;