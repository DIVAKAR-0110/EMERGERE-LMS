import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function LearningHistoryModal({ isOpen, onClose, selectedMember }) {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
    const [monthsList, setMonthsList] = useState([]);

    useEffect(() => {
        if (!isOpen || !selectedMember) return;

        let isMounted = true;
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem("lms_token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const empId = selectedMember.employee_id || selectedMember.id;
                const res = await axios.get(`${API_BASE_URL}/api/daily-learning`, {
                    params: { employee_id: empId, limit: 100 },
                    headers,
                });

                if (isMounted && Array.isArray(res.data)) {
                    setLogs(res.data);

                    // Extract unique months (e.g. ["October 2026", "September 2026"])
                    const monthsSet = new Set();
                    res.data.forEach((l) => {
                        const rawDate = l.learning_date || l.created_at;
                        if (rawDate) {
                            try {
                                const d = new Date(rawDate);
                                if (!isNaN(d.getTime())) {
                                    const mStr = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                                    monthsSet.add(mStr);
                                }
                            } catch {}
                        }
                    });

                    // Ensure at least current month is present
                    const nowMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    monthsSet.add(nowMonth);

                    const sortedMonths = Array.from(monthsSet).sort((a, b) => {
                        const dateA = new Date(Date.parse(`01 ${a}`));
                        const dateB = new Date(Date.parse(`01 ${b}`));
                        return dateB - dateA; // latest first
                    });

                    setMonthsList(sortedMonths);
                    setCurrentMonthIndex(0); // Select latest month
                } else if (isMounted) {
                    setLogs([]);
                    const nowMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    setMonthsList([nowMonth]);
                    setCurrentMonthIndex(0);
                }
            } catch (err) {
                console.warn("[LearningHistoryModal] Error fetching member learning history:", err);
                if (isMounted) {
                    setLogs([]);
                    const nowMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    setMonthsList([nowMonth]);
                    setCurrentMonthIndex(0);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchHistory();
        return () => { isMounted = false; };
    }, [isOpen, selectedMember]);

    if (!isOpen) return null;

    const currentMonth = monthsList[currentMonthIndex] || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Filter logs for the selected month and group by date
    const filteredLogs = logs.filter((l) => {
        const rawDate = l.learning_date || l.created_at;
        if (!rawDate) return false;
        try {
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return false;
            const mStr = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            return mStr === currentMonth;
        } catch {
            return false;
        }
    });

    // Group logs by date
    const dateMap = {};
    filteredLogs.forEach((item, idx) => {
        const dObj = item.learning_date ? new Date(item.learning_date) : (item.created_at ? new Date(item.created_at) : new Date());
        const fullDateStr = dObj.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        const dayStr = dObj.toLocaleDateString("en-US", { weekday: "long" });
        const shortDate = dObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        const timeStr = item.time || (item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "10:00 AM");

        const hrs = item.learning_hours || item.videoHours || 0;
        const mins = item.learning_minutes || item.videoMinutes || 0;
        const durStr = item.duration || (hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`);

        if (!dateMap[fullDateStr]) {
            dateMap[fullDateStr] = {
                date: fullDateStr,
                day: dayStr,
                timestamp: dObj.getTime(),
                sessions: [],
            };
        }

        dateMap[fullDateStr].sessions.push({
            id: item.daily_learning_id || item.id || idx + 1,
            dateStr: shortDate,
            timeStr: timeStr,
            title: item.course_name || item.course_title || item.title || "Course Learning",
            description: item.learning_description || item.description || item.topic || "Completed learning session",
            duration: durStr,
        });
    });

    const historyGroups = Object.values(dateMap).sort((a, b) => b.timestamp - a.timestamp);

    const handlePrevMonth = () => {
        if (currentMonthIndex < monthsList.length - 1) {
            setCurrentMonthIndex(currentMonthIndex + 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonthIndex > 0) {
            setCurrentMonthIndex(currentMonthIndex - 1);
        }
    };

    return (
        <div className="rm-modal-overlay" role="dialog" aria-modal="true">
            <div className="rm-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="rm-modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                {/* Header Row */}
                <div className="rm-modal-header-row">
                    <div>
                        <h2 className="rm-modal-title">Learning History</h2>
                        <p className="rm-modal-subtitle">
                            Review and track learning activities, progress, and outcomes
                            {selectedMember ? ` for ${selectedMember.name}` : ""}.
                        </p>
                    </div>

                    {/* Month Navigator */}
                    <div className="rm-month-nav">
                        <button
                            type="button"
                            className="rm-month-nav-btn"
                            onClick={handlePrevMonth}
                            disabled={currentMonthIndex >= monthsList.length - 1}
                            aria-label="Previous month"
                            style={{ opacity: currentMonthIndex >= monthsList.length - 1 ? 0.35 : 1 }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="rm-month-nav-label">{currentMonth}</span>
                        <button
                            type="button"
                            className="rm-month-nav-btn"
                            onClick={handleNextMonth}
                            disabled={currentMonthIndex === 0}
                            aria-label="Next month"
                            style={{ opacity: currentMonthIndex === 0 ? 0.35 : 1 }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Modal Body: Daily Grouping */}
                <div className="rm-learning-history-body">
                    {isLoading ? (
                        <div className="rm-history-date-group" style={{ opacity: 0.85 }}>
                            <div className="rm-history-date-banner" style={{ display: 'flex', gap: '8px' }}>
                                <span className="ld-skeleton-block" style={{ width: '100px', height: '14px', borderRadius: '4px' }} />
                                <span className="ld-skeleton-block" style={{ width: '40px', height: '14px', borderRadius: '4px' }} />
                            </div>
                            <div className="rm-history-items-list">
                                {[1, 2, 3].map((i) => (
                                    <div key={`hist-skel-${i}`} className="rm-history-item-row">
                                        <div className="rm-history-left">
                                            <div className="rm-history-datetime">
                                                <span className="ld-skeleton-block" style={{ width: '50px', height: '12px', borderRadius: '3px', marginBottom: '4px' }} />
                                                <span className="ld-skeleton-block" style={{ width: '40px', height: '10px', borderRadius: '3px' }} />
                                            </div>
                                            <div className="rm-history-info">
                                                <span className="ld-skeleton-block" style={{ width: '160px', height: '14px', borderRadius: '4px', marginBottom: '4px' }} />
                                                <span className="ld-skeleton-block" style={{ width: '120px', height: '12px', borderRadius: '3px' }} />
                                            </div>
                                        </div>
                                        <span className="ld-skeleton-block" style={{ width: '50px', height: '22px', borderRadius: '12px' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : historyGroups.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B", fontSize: "13px" }}>
                            No learning history records found for {currentMonth}.
                        </div>
                    ) : (
                        historyGroups.map((group) => (
                            <div key={group.date} className="rm-history-date-group">
                                {/* Date Banner */}
                                <div className="rm-history-date-banner">
                                    <span className="rm-history-date-text">{group.date}</span>
                                    <span className="rm-history-day-text">{group.day}</span>
                                </div>

                                {/* Sessions List */}
                                <div className="rm-history-items-list">
                                    {group.sessions.map((item) => (
                                        <div key={item.id} className="rm-history-item-row">
                                            <div className="rm-history-left">
                                                <div className="rm-history-datetime">
                                                    <span className="rm-history-item-date">{item.dateStr}</span>
                                                    <span className="rm-history-item-time">{item.timeStr}</span>
                                                </div>
                                                <div className="rm-history-info">
                                                    <h4 className="rm-history-item-title">{item.title}</h4>
                                                    <p className="rm-history-item-desc">{item.description}</p>
                                                </div>
                                            </div>
                                            <span className="rm-duration-pill">{item.duration}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal Footer */}
                <div className="rm-modal-footer">
                    <button
                        type="button"
                        className="rm-btn-cancel-flat"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
