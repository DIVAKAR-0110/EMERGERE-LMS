import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../../context/AuthContext";
import useNotificationRowHighlight from "../../../hooks/useNotificationRowHighlight";
import { getApprovalHighlightKey } from "../../../utils/notificationHighlight";
import { fetchTeamMembers } from "../../../services/teamService";
import badgeSvg from "../../../assets/teammanagement/badge.svg";
import scrollingIcon from "../../../assets/teammanagement/scrolling.svg";
import bluecheckIcon from "../../../assets/course_library/bluecheck.svg";
import greencheckIcon from "../../../assets/course_library/greencheck.svg";
import circleDotIcon from "../../../assets/course_library/CircleDot.svg";
import clockIcon from "../../../assets/course_library/clock.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

const getTrackerStepIcon = (status) => {
    switch (status) {
        case "completed":
            return bluecheckIcon;
        case "completed_final":
            return greencheckIcon;
        case "pending":
            return clockIcon;
        case "upcoming":
        default:
            return circleDotIcon;
    }
};

const formatApprovalDate = (val) => {
    if (!val || val === "—" || val === "-") return "-";
    const s = String(val).trim();
    const nonDateWords = ["pending", "approved", "rejected", "bypassed", "recent", "ready for purchase...", "purchased"];
    if (nonDateWords.some(w => s.toLowerCase().includes(w))) {
        return s;
    }
    let d = new Date(s);
    if (isNaN(d.getTime()) && s.includes("-")) {
        const parts = s.split("-");
        if (parts.length === 3 && parts[0].length === 2) {
            d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
    }
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

export default function CourseApprovalStatus() {
    const { user, token } = useAuth();
    const location = useLocation();
    const [approvals, setApprovals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const highlightedCardRef = useRef(null);

    const { highlightedKey: highlightedItemId } = useNotificationRowHighlight({
        locationState: location.state,
        isReady: !isLoading,
        targetList: approvals,
        storageKey: "lms_completed_rm_aw_highlight_ts",
    });

    useEffect(() => {
        if (!highlightedItemId || !highlightedCardRef.current) return;
        const t = setTimeout(() => {
            highlightedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [highlightedItemId, approvals]);

    const [thumbOffset, setThumbOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [canScroll, setCanScroll] = useState(false);

    const listRef = useRef(null);
    const trackRef = useRef(null);
    const thumbRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragStartYRef = useRef(0);
    const dragStartThumbOffsetRef = useRef(0);

    const THUMB_HEIGHT = 80; // Matches scrolling.svg height

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

    const fetchApprovals = useCallback(async () => {
        try {
            setIsLoading(true);
            const authToken = token || localStorage.getItem("lms_token");
            const managerId = user?.employee_id || user?.id || user?.name || localStorage.getItem("lms_active_employee_id") || "EMP004";

            // Parallel fetch: course approval tracker and direct reports of this manager
            const [trackerRes, teamData] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/course-requests/tracker`, {
                    params: {
                        manager_id: managerId
                    },
                    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
                }),
                fetchTeamMembers(authToken).catch(() => [])
            ]);

            const rawList = Array.isArray(trackerRes.data) ? trackerRes.data : [];
            const teamIds = Array.isArray(teamData) && teamData.length > 0
                ? new Set(teamData.map(m => String(m.employee_id || "").trim().toUpperCase()).filter(Boolean))
                : null;

            // Strictly filter to team members only (never show manager's own requests or non-team requests)
            const teamOnlyItems = teamIds && teamIds.size > 0
                ? rawList.filter(item => {
                    const empId = String(item.employeeId || item.employee_id || "").trim().toUpperCase();
                    return teamIds.has(empId);
                })
                : rawList;

            if (teamOnlyItems.length > 0) {
                const mapped = teamOnlyItems.map((item) => ({
                    id: item.id,
                    courseRequestId: item.courseRequestId || item.requestCode || item.request_code || (item.id ? `CR-${item.id}` : ""),
                    employeeId: item.employeeId || item.employee_id,
                    employeeName: item.employeeName,
                    courseName: item.courseTitle,
                    platform: item.provider,
                    requestDate: formatApprovalDate(item.requestDate),
                    steps: (item.steps || []).map((s) => ({
                        id: s.id,
                        label: s.label,
                        status: s.status,
                        subtext: formatApprovalDate(s.subText || ""),
                        date: formatApprovalDate(s.date || s.subText || "")
                    }))
                }));
                setApprovals(mapped);
            } else {
                setApprovals([]);
            }
        } catch (err) {
            console.warn("[CourseApprovalStatus] Live fetch failed:", err);
            setApprovals([]);
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE_URL, token, user]);

    useEffect(() => {
        fetchApprovals();
        // Periodic refresh every 15 seconds to reflect approval steps in real-time
        const interval = setInterval(fetchApprovals, 15000);
        return () => clearInterval(interval);
    }, [fetchApprovals]);

    // Calculate thumb position based on scroll position
    const updateThumbFromScroll = useCallback(() => {
        const list = listRef.current;
        if (!list || approvals.length === 0) {
            setCanScroll(false);
            setThumbOffset(0);
            return;
        }

        const scrollHeight = list.scrollHeight;
        const clientHeight = list.clientHeight;
        const scrollTop = list.scrollTop;
        const maxScroll = scrollHeight - clientHeight;

        if (maxScroll <= 1) {
            setCanScroll(false);
            setThumbOffset(0);
            return;
        }

        setCanScroll(true);

        const track = trackRef.current;
        if (!track) {
            return;
        }

        const trackHeight = track.clientHeight;
        const maxTravel = Math.max(0, trackHeight - THUMB_HEIGHT);
        const scrollRatio = Math.min(1, Math.max(0, scrollTop / maxScroll));
        const newOffset = scrollRatio * maxTravel;

        setThumbOffset(newOffset);
    }, [approvals.length]);

    const handleScroll = () => {
        if (!isDraggingRef.current) {
            updateThumbFromScroll();
        }
    };

    // Drag handling for scrollbar thumb
    const handlePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartYRef.current = e.clientY;
        dragStartThumbOffsetRef.current = thumbOffset;

        const onGlobalPointerMove = (moveEvent) => {
            if (!isDraggingRef.current) return;
            moveEvent.preventDefault();

            const track = trackRef.current;
            const list = listRef.current;
            if (!track || !list) return;

            const deltaY = moveEvent.clientY - dragStartYRef.current;
            const trackHeight = track.clientHeight;
            const maxTravel = Math.max(0, trackHeight - THUMB_HEIGHT);

            if (maxTravel <= 0) return;

            const nextOffset = Math.max(0, Math.min(maxTravel, dragStartThumbOffsetRef.current + deltaY));
            setThumbOffset(nextOffset);

            const scrollRatio = nextOffset / maxTravel;
            const maxScroll = list.scrollHeight - list.clientHeight;
            list.scrollTop = scrollRatio * maxScroll;
        };

        const onGlobalPointerUp = () => {
            isDraggingRef.current = false;
            setIsDragging(false);
            window.removeEventListener("pointermove", onGlobalPointerMove);
            window.removeEventListener("pointerup", onGlobalPointerUp);
            window.removeEventListener("pointercancel", onGlobalPointerUp);
            window.removeEventListener("mousemove", onGlobalPointerMove);
            window.removeEventListener("mouseup", onGlobalPointerUp);
            updateThumbFromScroll();
        };

        window.addEventListener("pointermove", onGlobalPointerMove, { passive: false });
        window.addEventListener("pointerup", onGlobalPointerUp);
        window.addEventListener("pointercancel", onGlobalPointerUp);
        window.addEventListener("mousemove", onGlobalPointerMove, { passive: false });
        window.addEventListener("mouseup", onGlobalPointerUp);
    };

    const handleTrackClick = (e) => {
        if (e.target.closest(".rm-tm-card-scrollbar-thumb")) return;
        const track = trackRef.current;
        const list = listRef.current;
        if (!track || !list) return;

        const thumbH = THUMB_HEIGHT;
        const rect = track.getBoundingClientRect();
        const clickY = e.clientY - rect.top - thumbH / 2;
        const trackHeight = track.clientHeight;
        const maxTravel = Math.max(0, trackHeight - thumbH);
        const maxScroll = list.scrollHeight - list.clientHeight;

        if (maxTravel > 0 && maxScroll > 0) {
            const clampedY = Math.max(0, Math.min(maxTravel, clickY));
            const ratio = clampedY / maxTravel;
            list.scrollTop = ratio * maxScroll;
            updateThumbFromScroll();
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            updateThumbFromScroll();
        }, 80);

        window.addEventListener("resize", updateThumbFromScroll);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", updateThumbFromScroll);
        };
    }, [updateThumbFromScroll, approvals]);

    return (
        <div className="rm-tm-card rm-tm-approvals-card">
            <div className="rm-tm-card-header">
                <h2 className="rm-tm-card-title">Course Approval Status</h2>
            </div>

            {!isLoading && approvals.length === 0 ? (
                <div className="rm-empty-state rm-approvals-empty-box">
                    <img
                        src={openBookIcon}
                        alt="No course approval requests from your team yet."
                        className="rm-empty-state-icon"
                    />
                    <h3>No course approval requests from your team yet.</h3>
                </div>
            ) : (
                <div
                    className="rm-tm-approvals-list"
                    ref={listRef}
                    onScroll={handleScroll}
                >
                    {isLoading && approvals.length === 0 ? (
                        [1, 2, 3].map((i) => (
                            <div key={`approval-skel-${i}`} className="rm-tm-approval-row-card" style={{ opacity: 0.85 }}>
                                <div className="rm-approval-course-info">
                                    <span className="ld-skeleton-block" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                                    <div className="rm-approval-text-meta">
                                        <span className="ld-skeleton-block" style={{ width: 140, height: 16, borderRadius: 4, marginBottom: 6 }} />
                                        <span className="ld-skeleton-block" style={{ width: 220, height: 14, borderRadius: 4, marginBottom: 6 }} />
                                        <span className="ld-skeleton-block" style={{ width: 80, height: 12, borderRadius: 3 }} />
                                    </div>
                                </div>
                                <div className="rm-approval-stepper-container" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <div key={`step-skel-${s}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                            <span className="ld-skeleton-circle" style={{ width: 20, height: 20 }} />
                                            <span className="ld-skeleton-block" style={{ width: 50, height: 10, borderRadius: 3 }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        approvals.map((item) => {
                            const isHighlighted =
                                Boolean(highlightedItemId) &&
                                getApprovalHighlightKey(item) === String(highlightedItemId);
                            return (
                                <div
                                    key={item.id}
                                    ref={isHighlighted ? highlightedCardRef : null}
                                    data-request-id={item.id}
                                    className={`rm-tm-approval-row-card ${isHighlighted ? "aw-card-highlighted" : ""}`}
                                >
                                    {/* Left: Course & Member Info */}
                                    <div className="rm-approval-course-info">
                                        <img src={badgeSvg} alt="Badge" className="rm-approval-badge-img" />

                                        <div className="rm-approval-text-meta">
                                            <div className="aw-id-highlight-wrap">
                                                <div className="rm-approval-employee-header">
                                                    <h3 className="rm-approval-employee-name">{item.employeeName}</h3>
                                                    {item.courseRequestId && (
                                                        <span className="rm-approval-request-code">({item.courseRequestId})</span>
                                                    )}
                                                </div>
                                                {isHighlighted && (
                                                    <span className="aw-notif-highlight-badge">Selected Request</span>
                                                )}
                                            </div>
                                            <p className="rm-approval-course-name">
                                                {item.courseName} — {item.platform}
                                            </p>
                                            <span className="rm-approval-request-date">{formatApprovalDate(item.requestDate)}</span>
                                        </div>
                                    </div>

                                    {/* Right: 5-Step Stepper Pipeline */}
                                    <div className="rm-approval-stepper-container">
                                        {item.steps.map((step, idx) => {
                                            const isLast = idx === item.steps.length - 1;

                                            return (
                                                <React.Fragment key={step.id}>
                                                    <div className={`rm-stepper-node node-${step.status}`}>
                                                        {/* Stepper Circle Icon */}
                                                        <div className="rm-stepper-icon-wrapper">
                                                            {step.status === "rejected" ? (
                                                                <div
                                                                    style={{
                                                                        width: 22,
                                                                        height: 22,
                                                                        borderRadius: "50%",
                                                                        background: "#EF4444",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        color: "#FFFFFF",
                                                                        fontSize: 11,
                                                                        fontWeight: "bold"
                                                                    }}
                                                                    title="Rejected"
                                                                >
                                                                    ✕
                                                                </div>
                                                            ) : (
                                                                <img
                                                                    src={getTrackerStepIcon(step.status)}
                                                                    alt={step.status}
                                                                    className="rm-stepper-icon-img"
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Role Label */}
                                                        <span className="rm-node-role-label">{step.label}</span>

                                                        {/* Subtext */}
                                                        <span className="rm-node-sub-info">
                                                            {formatApprovalDate(step.date || step.subtext) || "\u00A0"}
                                                        </span>
                                                    </div>

                                                    {/* Dashed Line */}
                                                    {!isLast && <div className="rm-stepper-dashed-line" />}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Right Vertical Scrollbar Track with Draggable Thumb - only when rows present and scrollable */}
            {approvals.length > 0 && canScroll && (
                <div
                    className={`rm-tm-card-scrollbar-track ${canScroll ? "visible" : ""}`}
                    ref={trackRef}
                    onClick={handleTrackClick}
                    title="Drag to scroll approvals"
                    style={{ display: "flex", opacity: 1 }}
                >
                    <div
                        ref={thumbRef}
                        className={`rm-tm-card-scrollbar-thumb ${isDragging ? "dragging" : ""}`}
                        style={{
                            transform: `translateY(${thumbOffset}px)`,
                        }}
                        onPointerDown={handlePointerDown}
                        role="scrollbar"
                        aria-valuenow={thumbOffset}
                        aria-orientation="vertical"
                        tabIndex={0}
                        title="Drag to scroll"
                    >
                        <img src={scrollingIcon} alt="Scroll Indicator" />
                    </div>
                </div>
            )}
        </div>
    );
}
