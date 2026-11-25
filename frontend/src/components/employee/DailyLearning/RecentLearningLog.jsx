import React, { useState, useRef, useEffect, useMemo } from "react";
import blueEditIcon from "../../../assets/Daily_Learning_Log/blue_edit.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import EditLearningLogModal from "./EditLearningLogModal";
import { formatDurationPill } from "../../../utils/dateUtils";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getLogTimeValue(log) {
    if (!log) return 0;
    if (log.created_at) {
        const dt = new Date(String(log.created_at).replace(" ", "T")).getTime();
        if (!isNaN(dt)) return dt;
    }
    if (log.updated_at) {
        const dt = new Date(String(log.updated_at).replace(" ", "T")).getTime();
        if (!isNaN(dt)) return dt;
    }
    const dateStr = log.date;
    const timeStr = log.time;
    if (!dateStr) return 0;
    const parts = dateStr.trim().split(" ");
    const day = parseInt(parts[0], 10) || 1;
    const monthIndex = SHORT_MONTHS.indexOf(parts[1]) >= 0 ? SHORT_MONTHS.indexOf(parts[1]) : 7;

    let hours = 0;
    let minutes = 0;
    if (timeStr) {
        const timeParts = timeStr.trim().split(" ");
        const [hStr, mStr] = (timeParts[0] || "0:0").split(":");
        let h = parseInt(hStr, 10) || 0;
        const m = parseInt(mStr, 10) || 0;
        const isPM = (timeParts[1] || "").toUpperCase() === "PM";
        if (isPM && h < 12) h += 12;
        if (!isPM && h === 12) h = 0;
        hours = h;
        minutes = m;
    }
    return new Date(2026, monthIndex, day, hours, minutes).getTime();
}

function isLogEditable(log) {
    if (!log) return false;
    let logTime = null;
    const rawTime = log.created_at || log.createdAt;
    if (rawTime) {
        const dt = new Date(String(rawTime).replace(" ", "T")).getTime();
        if (!isNaN(dt)) {
            logTime = dt;
        }
    }
    if (!logTime) {
        logTime = getLogTimeValue(log);
    }
    if (!logTime) return false;

    const diffHours = (Date.now() - logTime) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
}

export default function RecentLearningLog({ logs = [], onUpdateLog, isLoading = false, onViewAll }) {
    const [editingLog, setEditingLog] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const listRef = useRef(null);

    // Dynamic row count based on actual container height & zoom (80%, 90%, 100%, 110%, 125%)
    const resolveVisibleRows = (containerHeight = 0) => {
        if (containerHeight > 0) {
            // Fit whole rows cleanly (~52px per row) without vertical clipping
            return Math.max(3, Math.min(8, Math.floor((containerHeight + 2) / 52)));
        }
        if (typeof window === "undefined") return 4;
        const outerZoom = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
        const dpr = window.devicePixelRatio || 1;
        const zoom = Math.min(outerZoom, dpr);
        if (zoom <= 0.85 || window.innerWidth >= 1800) {
            return 6;
        }
        if (zoom <= 0.95 || window.innerWidth >= 1600) {
            return 5;
        }
        return 4;
    };

    const [visibleRows, setVisibleRows] = useState(() => resolveVisibleRows(0));

    useEffect(() => {
        const updateRows = () => {
            const height = listRef.current ? listRef.current.clientHeight : 0;
            const nextRows = resolveVisibleRows(height);
            setVisibleRows((prev) => (prev !== nextRows ? nextRows : prev));
        };

        updateRows();
        window.addEventListener("resize", updateRows);

        let ro = null;
        if (typeof ResizeObserver !== "undefined" && listRef.current) {
            ro = new ResizeObserver(updateRows);
            ro.observe(listRef.current);
        }

        return () => {
            window.removeEventListener("resize", updateRows);
            if (ro) ro.disconnect();
        };
    }, []);

    // Display all recent learning logs, sorted chronologically descending by latest timestamp
    const displayLogs = useMemo(() => {
        if (!logs || !logs.length) return [];
        return [...logs].sort((a, b) => getLogTimeValue(b) - getLogTimeValue(a));
    }, [logs]);

    const handleOpenEdit = (log) => {
        setEditingLog(log);
        setEditingId(log.id || log.daily_learning_id);
    };

    const handleSaveEdit = async (updatedLog) => {
        if (onUpdateLog && editingId) {
            await onUpdateLog(editingId, updatedLog);
        }
    };

    return (
        <section className="emp-learning-card emp-recent-log-card">
            <div className="emp-recent-log-header">
                <h2 className="emp-card-title">Recent Learning Log</h2>
                <button
                    type="button"
                    className="emp-show-all-logs-btn"
                    onClick={onViewAll}
                    title="View all learning logs"
                >
                    View All
                </button>
            </div>

            <div className="emp-recent-log-body">
                <div
                    className="emp-recent-log-list"
                    ref={listRef}
                    style={{ "--visible-rows": visibleRows }}
                >
                    {isLoading ? (
                        Array.from({ length: visibleRows }).map((_, n) => (
                            <div className="emp-learning-log-row" key={n} style={{ padding: "8px 10px", display: "flex", gap: 14, alignItems: "center" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 60 }}>
                                    <span className="ld-skeleton-block" style={{ width: 45, height: 14 }} />
                                    <span className="ld-skeleton-block" style={{ width: 35, height: 10 }} />
                                </div>
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                    <span className="ld-skeleton-block" style={{ width: "70%", height: 15 }} />
                                    <span className="ld-skeleton-block" style={{ width: "90%", height: 12 }} />
                                </div>
                                <span className="ld-skeleton-block" style={{ width: 50, height: 20, borderRadius: 10 }} />
                            </div>
                        ))
                    ) : displayLogs.length === 0 ? (
                        <div className="emp-recent-log-empty-state">
                            <img
                                src={openBookIcon}
                                alt="No learning activities"
                                className="emp-recent-log-empty-icon"
                            />
                            <span>No learning activities logged yet !</span>
                        </div>
                    ) : (
                        displayLogs.slice(0, visibleRows).map((log) => (
                            <div
                                className="emp-learning-log-row"
                                key={log.id || log.daily_learning_id}
                            >
                                <div className="emp-log-date">
                                    <strong>{log.date}</strong>
                                    <span>{log.time}</span>
                                </div>

                                <div className="emp-log-information">
                                    <h3 title={log.title}>{log.title}</h3>
                                    <p title={log.description}>{log.description}</p>
                                </div>

                                <div className="emp-log-action-side">
                                    <div className="emp-log-duration">
                                        {formatDurationPill(log.duration)}
                                    </div>

                                    {(() => {
                                        const canEdit = isLogEditable(log);
                                        return (
                                            <button
                                                type="button"
                                                className={`emp-edit-log-button ${!canEdit ? "disabled" : ""}`}
                                                aria-label={canEdit ? `Edit ${log.title}` : `Editing is disabled after 24 hours for ${log.title}`}
                                                title={canEdit ? "Edit learning log" : "Editing is disabled after 24 hours"}
                                                onClick={() => canEdit && handleOpenEdit(log)}
                                                disabled={!canEdit}
                                            >
                                                <img
                                                    src={blueEditIcon}
                                                    alt="Edit"
                                                    className="emp-edit-icon-img"
                                                />
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <EditLearningLogModal
                isOpen={Boolean(editingLog)}
                onClose={() => setEditingLog(null)}
                logData={editingLog}
                onSave={handleSaveEdit}
            />
        </section>
    );
}
