import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import scrollingIcon from "../../../assets/teammanagement/scrolling.svg";
import { fetchTeamMembers } from "../../../services/teamService";
import MonthlyHistoryModal from "../../employee/DailyLearning/MonthlyHistoryModal";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Month names array for header display (matches LearningCalendar)
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Min Date bound: January 2025 (matches LearningCalendar)
const MIN_YEAR = 2025;
const MIN_MONTH = 0; // January

export default function MembersLearningLog({ selectedMember: propSelectedMember, onSelectMember }) {
    const [teamMembers, setTeamMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);

    // Dynamic viewed month/year (matches LearningCalendar)
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [logs, setLogs] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [thumbOffset, setThumbOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [canScroll, setCanScroll] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const todayReal = new Date();
    const maxYear = todayReal.getFullYear();
    const maxMonth = todayReal.getMonth();

    // Check navigation boundaries (Min: Jan 2025, Max: Current Month)
    const canGoPrev = year > MIN_YEAR || (year === MIN_YEAR && month > MIN_MONTH);
    const canGoNext = year < maxYear || (year === maxYear && month < maxMonth);

    const listRef = useRef(null);
    const trackRef = useRef(null);
    const thumbRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragStartYRef = useRef(0);
    const dragStartThumbOffsetRef = useRef(0);

    const THUMB_HEIGHT = 60; // Matches scrollingIcon height

    // Sync when parent changes selected member
    useEffect(() => {
        if (propSelectedMember) {
            setSelectedMember(propSelectedMember);
        }
    }, [propSelectedMember]);

    // Fetch live direct reports for dropdown
    useEffect(() => {
        let isMounted = true;
        const loadMembers = async () => {
            try {
                const membersData = await fetchTeamMembers();
                if (isMounted && Array.isArray(membersData) && membersData.length > 0) {
                    const colors = ["#215EF8", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6"];
                    const mapped = membersData.map((m, idx) => {
                        const rawName = m.full_name || m.name || "Team Member";
                        const cleanName = rawName.split("(")[0].trim();
                        const initials = cleanName
                            .split(" ")
                            .map(w => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();
                        return {
                            id: m.employee_id || idx + 1,
                            employee_id: m.employee_id,
                            name: cleanName,
                            initials: initials,
                            avatarColor: colors[idx % colors.length],
                        };
                    });
                    setTeamMembers(mapped);
                    if (!propSelectedMember) {
                        setSelectedMember(mapped[0]);
                        if (typeof onSelectMember === "function") {
                            onSelectMember(mapped[0]);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load team members for learning log:", err);
            }
        };
        loadMembers();
        return () => { isMounted = false; };
    }, []);

    // Fetch live daily learning logs when selected member changes
    useEffect(() => {
        if (!selectedMember) {
            setIsLoadingLogs(false);
            setLogs([]);
            return;
        }
        let isMounted = true;
        const loadLogs = async () => {
            setIsLoadingLogs(true);
            try {
                const token = localStorage.getItem("lms_token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const empId = selectedMember.employee_id || selectedMember.id;
                const res = await axios.get(`${API_BASE_URL}/api/daily-learning?employee_id=${empId}`, { headers });
                if (isMounted && Array.isArray(res.data)) {
                    const mapped = res.data.map((l, idx) => {
                        let logYear = null;
                        let logMonth = null;
                        let logDay = null;
                        let dateObj = null;

                        if (l.learning_date) {
                            try {
                                const parts = String(l.learning_date).split("T")[0].split("-");
                                if (parts.length === 3) {
                                    logYear = parseInt(parts[0], 10);
                                    logMonth = parseInt(parts[1], 10) - 1;
                                    logDay = parseInt(parts[2], 10);
                                    dateObj = new Date(logYear, logMonth, logDay);
                                }
                            } catch (e) { }
                        }

                        if (dateObj === null && l.created_at) {
                            try {
                                const dt = new Date(String(l.created_at).replace(" ", "T"));
                                if (!isNaN(dt.getTime())) {
                                    dateObj = dt;
                                    logYear = dt.getFullYear();
                                    logMonth = dt.getMonth();
                                    logDay = dt.getDate();
                                }
                            } catch (e) { }
                        }

                        if (dateObj === null && l.date) {
                            const parts = l.date.trim().split(" ");
                            if (parts.length >= 2) {
                                const parsedDay = parseInt(parts[0], 10);
                                const mIdx = SHORT_MONTHS.indexOf(parts[1]);
                                if (!isNaN(parsedDay) && mIdx >= 0) {
                                    logDay = parsedDay;
                                    logMonth = mIdx;
                                    logYear = todayReal.getFullYear();
                                    dateObj = new Date(logYear, logMonth, logDay);
                                }
                            }
                        }

                        if (!dateObj || isNaN(dateObj.getTime())) {
                            dateObj = new Date();
                            logYear = dateObj.getFullYear();
                            logMonth = dateObj.getMonth();
                            logDay = dateObj.getDate();
                        }

                        const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                        const timeStr = l.time || (l.created_at ? new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "10:30 AM");
                        const hrs = l.learning_hours || 0;
                        const mins = l.learning_minutes || 0;
                        const durationStr = l.hours || l.duration || (hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`);

                        return {
                            id: l.daily_learning_id || l.id || idx + 1,
                            date: dateStr,
                            time: timeStr,
                            courseTitle: l.course_name || l.course_title || l.title || "Course Learning",
                            topic: l.learning_topic || l.topic || l.description || "Completed lessons",
                            hours: durationStr,
                            logYear,
                            logMonth,
                            logDay,
                        };
                    });
                    setLogs(mapped);
                } else if (isMounted) {
                    setLogs([]);
                }
            } catch (err) {
                console.warn("[MembersLearningLog] Error loading logs:", err);
                if (isMounted) setLogs([]);
            } finally {
                if (isMounted) setIsLoadingLogs(false);
            }
        };
        loadLogs();
        return () => { isMounted = false; };
    }, [selectedMember]);

    const handleSelectMember = (member) => {
        setSelectedMember(member);
        if (typeof onSelectMember === "function") {
            onSelectMember(member);
        }
        setIsDropdownOpen(false);
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
        setThumbOffset(0);
    };

    const handlePrevMonth = () => {
        if (canGoPrev) {
            setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
            if (listRef.current) listRef.current.scrollTop = 0;
            setThumbOffset(0);
        }
    };

    const handleNextMonth = () => {
        if (canGoNext) {
            setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
            if (listRef.current) listRef.current.scrollTop = 0;
            setThumbOffset(0);
        }
    };

    // Filter logs strictly for the active month and year
    const filteredLogs = useMemo(() => {
        return logs.filter(log => log.logYear === year && log.logMonth === month);
    }, [logs, year, month]);

    // Calculate item offsets relative to the top of list
    const getItemOffsets = useCallback(() => {
        if (!listRef.current) return [];
        const items = Array.from(listRef.current.querySelectorAll(".rm-tm-log-item"));
        if (items.length === 0) return [];

        let accumulatedHeight = 0;
        const offsets = [];
        for (let i = 0; i < items.length; i++) {
            offsets.push(accumulatedHeight);
            accumulatedHeight += items[i].offsetHeight || items[i].getBoundingClientRect().height || 42;
        }
        return offsets;
    }, []);

    const getThumbHeight = useCallback(() => {
        return thumbRef.current?.offsetHeight || THUMB_HEIGHT;
    }, []);

    // Update thumb position based on container scrollTop
    const updateThumbFromScroll = useCallback(() => {
        const list = listRef.current;
        if (!list || !selectedMember || filteredLogs.length === 0) {
            setCanScroll(false);
            setThumbOffset(0);
            return;
        }

        const maxScroll = list.scrollHeight - list.clientHeight;
        const canScrollNow = maxScroll > 1;
        setCanScroll(canScrollNow);

        const track = trackRef.current;
        if (!track || !canScrollNow) {
            setThumbOffset(0);
            return;
        }

        const thumbH = getThumbHeight();
        const trackHeight = track.clientHeight;
        const maxTravel = Math.max(0, trackHeight - thumbH);

        if (maxScroll > 0 && maxTravel > 0) {
            const currentOffset = (list.scrollTop / maxScroll) * maxTravel;
            setThumbOffset(Math.min(maxTravel, Math.max(0, currentOffset)));
        } else {
            setThumbOffset(0);
        }
    }, [getThumbHeight]);

    const handleScroll = () => {
        if (isDraggingRef.current) return;
        updateThumbFromScroll();
    };

    // Scroll to item based on drag position
    const scrollByThumbPosition = useCallback((newThumbOffset) => {
        const list = listRef.current;
        const track = trackRef.current;
        if (!list || !track) return;

        const thumbH = getThumbHeight();
        const itemOffsets = getItemOffsets();
        const totalItems = itemOffsets.length;
        const trackHeight = track.clientHeight;
        const maxTravel = Math.max(0, trackHeight - thumbH);
        const maxScroll = list.scrollHeight - list.clientHeight;

        if (maxTravel <= 0 || maxScroll <= 0 || totalItems <= 1) return;

        // Find max scrollable item index
        let maxScrollableIndex = totalItems - 1;
        for (let i = 0; i < totalItems; i++) {
            if (itemOffsets[i] >= maxScroll) {
                maxScrollableIndex = i;
                break;
            }
        }

        const clampedOffset = Math.max(0, Math.min(maxTravel, newThumbOffset));
        const ratio = clampedOffset / maxTravel;
        const targetIndex = Math.round(ratio * maxScrollableIndex);
        const targetScroll = Math.min(itemOffsets[targetIndex] || 0, maxScroll);
        list.scrollTop = targetScroll;
    }, [getItemOffsets, getThumbHeight]);

    // Pointer Down (Mouse / Touch)
    const handlePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const list = listRef.current;
        const track = trackRef.current;
        if (!list || !track) return;

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) { }

        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartYRef.current = e.clientY;
        dragStartThumbOffsetRef.current = thumbOffset;

        const thumbH = getThumbHeight();
        const trackHeight = track.clientHeight;
        const maxTravel = Math.max(0, trackHeight - thumbH);

        const onGlobalPointerMove = (moveEvent) => {
            if (!isDraggingRef.current) return;
            moveEvent.preventDefault();

            const deltaY = moveEvent.clientY - dragStartYRef.current;
            const newOffset = Math.max(0, Math.min(maxTravel, dragStartThumbOffsetRef.current + deltaY));
            setThumbOffset(newOffset);
            scrollByThumbPosition(newOffset);
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

    // Handle clicking directly on the scrollbar track to jump to that item
    const handleTrackClick = (e) => {
        if (e.target.closest(".rm-tm-card-scrollbar-thumb")) return;
        const track = trackRef.current;
        const list = listRef.current;
        if (!track || !list) return;

        const thumbH = getThumbHeight();
        const rect = track.getBoundingClientRect();
        const clickY = e.clientY - rect.top - thumbH / 2;
        const trackHeight = track.clientHeight;
        const maxTravel = Math.max(0, trackHeight - thumbH);
        const maxScroll = list.scrollHeight - list.clientHeight;
        const itemOffsets = getItemOffsets();

        if (maxTravel > 0 && itemOffsets.length > 1 && maxScroll > 0) {
            const clampedY = Math.max(0, Math.min(maxTravel, clickY));
            const ratio = clampedY / maxTravel;
            let maxScrollableIndex = itemOffsets.length - 1;
            for (let i = 0; i < itemOffsets.length; i++) {
                if (itemOffsets[i] >= maxScroll) {
                    maxScrollableIndex = i;
                    break;
                }
            }
            const targetIndex = Math.round(ratio * maxScrollableIndex);
            list.scrollTop = Math.min(itemOffsets[targetIndex] || 0, maxScroll);
            updateThumbFromScroll();
        }
    };

    // Handle keyboard accessibility (ArrowUp / ArrowDown / PageUp / PageDown)
    const handleKeyDown = (e) => {
        const list = listRef.current;
        if (!list) return;

        const itemOffsets = getItemOffsets();
        if (itemOffsets.length <= 1) return;

        const currentScroll = list.scrollTop;
        let currentIndex = 0;
        for (let i = 0; i < itemOffsets.length; i++) {
            if (itemOffsets[i] <= currentScroll + 5) {
                currentIndex = i;
            }
        }

        if (e.key === "ArrowDown" || e.key === "PageDown") {
            e.preventDefault();
            const nextIndex = Math.min(itemOffsets.length - 1, currentIndex + 1);
            list.scrollTop = itemOffsets[nextIndex];
            updateThumbFromScroll();
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
            e.preventDefault();
            const prevIndex = Math.max(0, currentIndex - 1);
            list.scrollTop = itemOffsets[prevIndex];
            updateThumbFromScroll();
        }
    };

    // Recalculate on mount, resize, member change, or logs change
    useEffect(() => {
        updateThumbFromScroll();
        const timer = setTimeout(() => {
            updateThumbFromScroll();
        }, 60);

        let resizeObserver;
        if (listRef.current && typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => {
                updateThumbFromScroll();
            });
            resizeObserver.observe(listRef.current);
        }

        window.addEventListener("resize", updateThumbFromScroll);
        return () => {
            clearTimeout(timer);
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener("resize", updateThumbFromScroll);
        };
    }, [updateThumbFromScroll, filteredLogs, selectedMember]);

    return (
        <div className="rm-tm-card rm-tm-logs-card">
            <div className="rm-tm-card-header rm-tm-logs-header">
                <h2 className="rm-tm-card-title">Members Learning Log</h2>

                <div className="rm-tm-logs-controls">
                    {/* Month Navigator */}
                    <div className="rm-month-navigator">
                        <button
                            type="button"
                            className={`rm-month-nav-btn ${!canGoPrev ? "disabled" : ""}`}
                            aria-label="Previous Month"
                            onClick={handlePrevMonth}
                            disabled={!canGoPrev}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            type="button"
                            className="rm-month-label rm-month-label-btn"
                            onClick={() => setIsMonthModalOpen(true)}
                            title="Click to view full month learning history"
                        >
                            {SHORT_MONTHS[month]} {year}
                        </button>
                        <button
                            type="button"
                            className={`rm-month-nav-btn ${!canGoNext ? "disabled" : ""}`}
                            aria-label="Next Month"
                            onClick={handleNextMonth}
                            disabled={!canGoNext}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    {/* Member Dropdown */}
                    <div className="rm-member-dropdown-container">
                        <button
                            type="button"
                            className="rm-member-dropdown-trigger"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            aria-haspopup="listbox"
                            aria-expanded={isDropdownOpen}
                        >
                            <span className="rm-dropdown-selected-name">{selectedMember?.name || "Select Member"}</span>
                            <ChevronDown size={14} className={`rm-chevron-icon ${isDropdownOpen ? "rotate" : ""}`} />
                        </button>

                        {isDropdownOpen && (
                            <div className="rm-member-dropdown-menu" role="listbox">
                                {teamMembers.map((m) => (
                                    <div
                                        key={m.id}
                                        className={`rm-member-dropdown-item ${m.name === selectedMember?.name ? "selected" : ""}`}
                                        onClick={() => handleSelectMember(m)}
                                        role="option"
                                        aria-selected={m.name === selectedMember?.name}
                                    >
                                        <div
                                            className="rm-dropdown-avatar"
                                            style={{ backgroundColor: m.avatarColor, color: "#FFFFFF" }}
                                        >
                                            {m.initials}
                                        </div>
                                        <span>{m.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Learning Log Items List */}
            {!selectedMember ? (
                <div className="rm-empty-state rm-tm-logs-empty-box">
                    <img
                        src={openBookIcon}
                        alt="Select team member to fetch learning logs"
                        className="rm-empty-state-icon"
                    />
                    <h3>Select team member to fetch learning logs</h3>
                </div>
            ) : !isLoadingLogs && filteredLogs.length === 0 ? (
                <div className="rm-empty-state rm-tm-logs-empty-box">
                    <img
                        src={openBookIcon}
                        alt="No learning logs recorded for this period."
                        className="rm-empty-state-icon"
                    />
                    <h3>No learning logs recorded for this period.</h3>
                </div>
            ) : (
                <div
                    className="rm-tm-logs-list"
                    ref={listRef}
                    onScroll={handleScroll}
                >
                    {isLoadingLogs ? (
                        [1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={`log-skel-${i}`} className="rm-tm-log-item" style={{ opacity: 0.85 }}>
                                <div className="rm-log-timestamp">
                                    <span className="ld-skeleton-block" style={{ width: 44, height: 12, borderRadius: 3, marginBottom: 4 }} />
                                    <span className="ld-skeleton-block" style={{ width: 36, height: 10, borderRadius: 3 }} />
                                </div>
                                <div className="rm-log-details">
                                    <span className="ld-skeleton-block" style={{ width: 140, height: 14, borderRadius: 4, marginBottom: 4 }} />
                                    <span className="ld-skeleton-block" style={{ width: 90, height: 12, borderRadius: 3 }} />
                                </div>
                                <div className="rm-log-duration-badge" style={{ background: "transparent" }}>
                                    <span className="ld-skeleton-block" style={{ width: 40, height: 20, borderRadius: 10 }} />
                                </div>
                            </div>
                        ))
                    ) : (
                        filteredLogs.map((log) => (
                            <div key={log.id} className="rm-tm-log-item">
                                <div className="rm-log-timestamp">
                                    <span className="rm-log-date">{log.date}</span>
                                    <span className="rm-log-time">{log.time}</span>
                                </div>

                                <div className="rm-log-details">
                                    <h4 className="rm-log-course-title">{log.courseTitle}</h4>
                                    <p className="rm-log-topic">{log.topic}</p>
                                </div>

                                <div className="rm-log-duration-badge">
                                    <span>{log.hours}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Right Vertical Scrollbar Track with Draggable Thumb - only when records present and scrollable */}
            {selectedMember && filteredLogs.length > 0 && canScroll && (
                <div
                    className={`rm-tm-card-scrollbar-track ${canScroll ? "visible" : ""}`}
                    ref={trackRef}
                    onClick={handleTrackClick}
                    title="Drag to scroll logs"
                    style={{
                        display: "flex",
                        opacity: 1,
                        pointerEvents: "auto"
                    }}
                >
                    <div
                        ref={thumbRef}
                        className={`rm-tm-card-scrollbar-thumb ${isDragging ? "dragging" : ""}`}
                        style={{
                            transform: `translateY(${thumbOffset}px)`,
                        }}
                        onPointerDown={handlePointerDown}
                        onKeyDown={handleKeyDown}
                        role="scrollbar"
                        aria-valuenow={thumbOffset}
                        aria-orientation="vertical"
                        tabIndex={0}
                        title="Drag to scroll by log item"
                    >
                        <img src={scrollingIcon} alt="Scroll Indicator" />
                    </div>
                </div>
            )}

            {/* Monthly Learning History Modal */}
            <MonthlyHistoryModal
                isOpen={isMonthModalOpen}
                onClose={() => setIsMonthModalOpen(false)}
                currentMonth={month}
                currentYear={year}
                logs={logs}
                memberName={selectedMember?.name}
            />
        </div>
    );
}
