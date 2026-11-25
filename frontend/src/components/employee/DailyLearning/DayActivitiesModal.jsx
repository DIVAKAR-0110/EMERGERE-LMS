import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import closeIcon from "../../../assets/course_library/close.svg";
import downArrowIcon from "../../../assets/Daily_Learning_Log/down_arrow.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { formatDurationPill } from "../../../utils/dateUtils";

// Short month name lookup for date parsing
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseTime(timeStr) {
    if (!timeStr) return 0;
    const timeParts = timeStr.trim().split(" ");
    const [hStr, mStr] = (timeParts[0] || "0:0").split(":");
    let h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const isPM = (timeParts[1] || "").toUpperCase() === "PM";
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h * 60 + m;
}

export default function DayActivitiesModal({ isOpen, onClose, selectedDate, logs = [] }) {
    const scrollRef = useRef(null);
    const [canScrollDown, setCanScrollDown] = useState(false);

    const { day, monthIndex, monthName, year } = selectedDate || {};

    // Short month name (e.g., "August" -> "Aug")
    const shortMonth = monthName ? monthName.substring(0, 3) : SHORT_MONTHS[monthIndex] || "Jan";
    const dateFormattedHeader = selectedDate ? `${day} ${monthName} ${year}` : "";
    const dateFormattedItem = selectedDate ? `${day} ${shortMonth}` : "";

    // Filter logs matching the selected date from shared learning logs and sort descending by time
    const activities = useMemo(() => {
        if (!logs || !logs.length || !selectedDate) return [];

        const targetDateStr = `${day} ${shortMonth}`;

        const matched = logs.filter((log) => {
            if (log.created_at) {
                try {
                    const dt = new Date(String(log.created_at).replace(" ", "T"));
                    if (!isNaN(dt.getTime())) {
                        return dt.getFullYear() === year && dt.getMonth() === monthIndex && dt.getDate() === day;
                    }
                } catch (e) { }
            }
            if (log.date) {
                return log.date.trim() === targetDateStr;
            }
            return false;
        });

        return matched.sort((a, b) => parseTime(b.time) - parseTime(a.time));
    }, [logs, day, monthIndex, year, shortMonth, selectedDate]);

    // Check if user can scroll down
    const checkScroll = useCallback(() => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            setCanScrollDown(scrollHeight - (scrollTop + clientHeight) > 12);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(checkScroll, 120);
            window.addEventListener("resize", checkScroll);
            return () => {
                clearTimeout(timer);
                window.removeEventListener("resize", checkScroll);
            };
        }
    }, [isOpen, activities, checkScroll]);

    const handleScrollDown = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ top: 140, behavior: "smooth" });
        }
    };

    if (!isOpen || !selectedDate) return null;

    return (
        <div className="emp-modal-backdrop-overlay">
            <div
                className="emp-day-activities-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="emp-modal-header-row">
                    <div>
                        <h2 className="emp-day-modal-blue-title">{dateFormattedHeader}</h2>
                        <p className="emp-modal-subtitle">
                            Your daily learning timeline and completed activities.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="emp-modal-close-button"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <img src={closeIcon} alt="Close" className="emp-modal-close-icon-img" />
                    </button>
                </div>

                {/* Activities Heading */}
                <h3 className="emp-activities-section-title">Activities</h3>

                {/* Scrollable Container with records */}
                <div
                    className="emp-day-activities-scroll-container"
                    ref={scrollRef}
                    onScroll={checkScroll}
                >
                    <div className="emp-activities-list">
                        {activities.length > 0 ? (
                            activities.map((item) => (
                                <div key={item.id} className="emp-activity-item-row">
                                    <div className="emp-activity-left">
                                        <div className="emp-activity-datetime-col">
                                            <span className="emp-activity-date-str">{dateFormattedItem}</span>
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
                            ))
                        ) : (
                            <div className="emp-recent-log-empty-state" style={{ minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "auto" }}>
                                <img
                                    src={openBookIcon}
                                    alt="No learning activities"
                                    className="emp-recent-log-empty-icon"
                                />
                                <p className="emp-modal-subtitle" style={{ textAlign: "center" }}>
                                    No learning activities logged for this day.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Down Arrow Floating Button for Scrolling */}
                {canScrollDown && (
                    <button
                        type="button"
                        className="emp-activities-scroll-down-btn"
                        onClick={handleScrollDown}
                        aria-label="Scroll down to view more activities"
                        title="Scroll down"
                    >
                        <img src={downArrowIcon} alt="Scroll down" className="emp-scroll-down-arrow-img" />
                    </button>
                )}
            </div>
        </div>
    );
}
