import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import closeIcon from "../../../assets/course_library/close.svg";
import leftArrowIcon from "../../../assets/course_library/leftarrow.svg";
import rightArrowIcon from "../../../assets/course_library/rightarrow.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import "../../../styles/employee/MonthlyHistoryModal.css";
import { formatDurationPill } from "../../../utils/dateUtils";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Min Date: January 2025
const MIN_YEAR = 2025;
const MIN_MONTH = 0; // January

export default function MonthlyHistoryModal({
    isOpen,
    onClose,
    currentMonth = 7,
    currentYear = 2026,
    logs = [],
    memberName,
}) {
    const [monthIndex, setMonthIndex] = useState(currentMonth);
    const [year, setYear] = useState(currentYear);

    const todayReal = new Date();
    const MAX_YEAR = Math.max(2026, todayReal.getFullYear());
    const MAX_MONTH = todayReal.getFullYear() > 2026 ? todayReal.getMonth() : Math.max(7, todayReal.getMonth());

    useEffect(() => {
        setMonthIndex(currentMonth);
        setYear(currentYear);
    }, [currentMonth, currentYear, isOpen]);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const canGoPrev = year > MIN_YEAR || (year === MIN_YEAR && monthIndex > MIN_MONTH);
    const canGoNext = year < MAX_YEAR || (year === MAX_YEAR && monthIndex < MAX_MONTH);

    const handlePrevMonth = () => {
        if (!canGoPrev) return;
        if (monthIndex === 0) {
            setMonthIndex(11);
            setYear(prev => prev - 1);
        } else {
            setMonthIndex(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (!canGoNext) return;
        if (monthIndex === 11) {
            setMonthIndex(0);
            setYear(prev => prev + 1);
        } else {
            setMonthIndex(prev => prev + 1);
        }
    };

    const monthName = MONTH_NAMES[monthIndex];
    const shortMonth = SHORT_MONTHS[monthIndex] || (monthName ? monthName.substring(0, 3) : "Aug");

    // Group real activities by date for the selected month
    const groupedActivities = useMemo(() => {
        if (!logs || !logs.length) return [];

        // Filter logs belonging to the active month & year
        const monthLogs = logs.filter(log => {
            let logMonth = null;
            let logYear = year;

            if (log.logMonth !== undefined && log.logMonth !== null) {
                logMonth = log.logMonth;
                if (log.logYear !== undefined && log.logYear !== null) {
                    logYear = log.logYear;
                }
            } else if (log.learning_date) {
                try {
                    const parts = String(log.learning_date).split("T")[0].split("-");
                    if (parts.length === 3) {
                        logYear = parseInt(parts[0], 10);
                        logMonth = parseInt(parts[1], 10) - 1;
                    }
                } catch (e) { }
            } else if (log.created_at) {
                try {
                    const dt = new Date(String(log.created_at).replace(" ", "T"));
                    if (!isNaN(dt.getTime())) {
                        logYear = dt.getFullYear();
                        logMonth = dt.getMonth();
                    }
                } catch (e) { }
            } else if (log.date) {
                const parts = log.date.trim().split(" ");
                if (parts.length >= 2) {
                    logMonth = SHORT_MONTHS.indexOf(parts[1]);
                }
                if (parts.length >= 3) {
                    const parsedYr = parseInt(parts[2], 10);
                    if (!isNaN(parsedYr)) logYear = parsedYr;
                }
            }

            return logMonth === monthIndex && logYear === year;
        });

        // Group by day number
        const groupsMap = new Map();

        monthLogs.forEach(log => {
            let dayNum = 1;
            if (log.logDay) {
                dayNum = log.logDay;
            } else if (log.learning_date) {
                try {
                    const parts = String(log.learning_date).split("T")[0].split("-");
                    if (parts.length === 3) {
                        dayNum = parseInt(parts[2], 10) || 1;
                    }
                } catch (e) { }
            } else if (log.created_at) {
                try {
                    const dt = new Date(String(log.created_at).replace(" ", "T"));
                    if (!isNaN(dt.getTime())) {
                        dayNum = dt.getDate();
                    }
                } catch (e) { }
            } else if (log.date) {
                const parts = log.date.trim().split(" ");
                dayNum = parseInt(parts[0], 10) || 1;
            }

            const dateKey = `${dayNum}`;

            if (!groupsMap.has(dateKey)) {
                const dayDate = new Date(year, monthIndex, dayNum);
                const dayOfWeek = dayDate.toLocaleDateString("en-US", { weekday: "long" });
                groupsMap.set(dateKey, {
                    dayNum,
                    dateHeader: `${shortMonth} ${String(dayNum).padStart(2, "0")}, ${year}`,
                    dayOfWeek: dayOfWeek,
                    items: [],
                });
            }

            // The item date string must match the day and month of this group
            const itemDateStr = `${String(dayNum).padStart(2, "0")} ${shortMonth}`;

            // Resolve proper display time (prefer original creation time if available)
            let itemTime = log.time || "12:00 PM";
            if (log.created_at) {
                try {
                    const dt = new Date(String(log.created_at).replace(" ", "T"));
                    if (!isNaN(dt.getTime())) {
                        itemTime = dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                    }
                } catch (e) { }
            }

            groupsMap.get(dateKey).items.push({
                id: log.id || log.daily_learning_id,
                dateStr: itemDateStr,
                time: itemTime,
                title: log.title || log.courseTitle || log.course_name || "Learning Session",
                description: log.description || log.topic || log.learning_topic || "Completed lessons",
                duration: formatDurationPill(log.duration || log.hours || "—"),
            });
        });

        // Sort groups descending by day number
        return Array.from(groupsMap.values()).sort((a, b) => b.dayNum - a.dayNum);
    }, [logs, monthIndex, year, shortMonth]);

    if (!isOpen) return null;

    return createPortal(
        <div className="emp-modal-backdrop-overlay">
            <div
                className="emp-monthly-history-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="emp-full-month-header">
                    <div className="emp-full-month-header-top">
                        <h2 className="emp-month-modal-blue-title">Learning History (Full Month)</h2>
                        <button
                            type="button"
                            className="emp-month-modal-close"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <img src={closeIcon} alt="Close" className="emp-modal-close-icon-img" />
                        </button>
                    </div>

                    <div className="emp-full-month-header-bottom">
                        <p className="emp-modal-subtitle">
                            {memberName ? `Review and track learning activities, progress, and outcomes for ${memberName}.` : "Review and track learning activities, progress, and outcomes for this session."}
                        </p>

                        <div className="emp-month-modal-nav">
                            <button
                                type="button"
                                className={`emp-calendar-nav-btn ${!canGoPrev ? "disabled" : ""}`}
                                onClick={handlePrevMonth}
                                disabled={!canGoPrev}
                                aria-label="Previous Month"
                            >
                                <img src={leftArrowIcon} alt="Previous Month" className="emp-nav-arrow-icon" />
                            </button>
                            <span className="emp-month-modal-nav-text">{shortMonth} {year}</span>
                            <button
                                type="button"
                                className={`emp-calendar-nav-btn ${!canGoNext ? "disabled" : ""}`}
                                onClick={handleNextMonth}
                                disabled={!canGoNext}
                                aria-label="Next Month"
                            >
                                <img src={rightArrowIcon} alt="Next Month" className="emp-nav-arrow-icon" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grouped Activities Content Body */}
                <div className="emp-monthly-history-scroll-body">
                    {groupedActivities.length > 0 ? (
                        groupedActivities.map((group, idx) => (
                            <div key={idx} className="emp-month-activity-group">
                                <div className="emp-month-group-banner">
                                    <span className="emp-group-date-header">{group.dateHeader}</span>
                                    <span className="emp-group-day-of-week">{group.dayOfWeek}</span>
                                </div>

                                <div className="emp-activities-list">
                                    {group.items.map((item) => (
                                        <div key={item.id} className="emp-activity-item-row">
                                            <div className="emp-activity-left">
                                                <div className="emp-activity-datetime-col">
                                                    <span className="emp-activity-date-str">{item.dateStr}</span>
                                                    <span className="emp-activity-time-str">{item.time}</span>
                                                </div>
                                                <div className="emp-activity-info-col">
                                                    <h4 className="emp-activity-title">{item.title}</h4>
                                                    <p className="emp-activity-desc">{item.description}</p>
                                                </div>
                                            </div>

                                            <div className="emp-activity-duration-badge">
                                                {formatDurationPill(item.duration)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="emp-recent-log-empty-state" style={{ minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "auto" }}>
                            <img
                                src={openBookIcon}
                                alt="No learning activities"
                                className="emp-recent-log-empty-icon"
                            />
                            <p className="emp-modal-subtitle" style={{ margin: 0, textAlign: "center", color: "#7f7f7f", fontSize: "13px", fontWeight: "500", }}>
                                No learning activities logged for this month.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
}
