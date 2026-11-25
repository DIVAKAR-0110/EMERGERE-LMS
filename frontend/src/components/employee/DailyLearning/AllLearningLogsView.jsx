import React, { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Search, Clock, BookOpen, Sparkles, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import blueEditIcon from "../../../assets/Daily_Learning_Log/blue_edit.svg";
import EditLearningLogModal from "./EditLearningLogModal";
import EmpDatePicker from "../Certification/EmpDatePicker";
import Pagination from "../CourseLibrary/Pagination";
import { formatDurationPill } from "../../../utils/dateUtils";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getLogDateObject(log) {
    if (!log) return null;
    if (log.learning_date) {
        const parts = String(log.learning_date).trim().split("-");
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d);
        }
    }
    if (log.created_at) {
        const dtStr = String(log.created_at).replace(" ", "T");
        const dt = new Date(dtStr);
        if (!isNaN(dt.getTime())) return dt;
    }
    if (log.updated_at) {
        const dtStr = String(log.updated_at).replace(" ", "T");
        const dt = new Date(dtStr);
        if (!isNaN(dt.getTime())) return dt;
    }
    if (log.date) {
        const parts = log.date.trim().split(" ");
        const day = parseInt(parts[0], 10) || 1;
        const monthIndex = SHORT_MONTHS.indexOf(parts[1]) >= 0 ? SHORT_MONTHS.indexOf(parts[1]) : 10;
        return new Date(2026, monthIndex, day);
    }
    return null;
}

function matchesDateRange(log, startDateStr, endDateStr) {
    if (!startDateStr && !endDateStr) return true;
    const logDate = getLogDateObject(log);
    if (!logDate) return true;

    const logMidnight = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate()).getTime();

    if (startDateStr) {
        const [sY, sM, sD] = startDateStr.split("-").map(Number);
        const startMidnight = new Date(sY, sM - 1, sD).getTime();
        if (logMidnight < startMidnight) return false;
    }

    if (endDateStr) {
        const [eY, eM, eD] = endDateStr.split("-").map(Number);
        const endMidnight = new Date(eY, eM - 1, eD).getTime();
        if (logMidnight > endMidnight) return false;
    }

    return true;
}

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

function parseDurationMinutes(log) {
    if (!log) return 0;
    if (log.video_learning_duration_min != null || log.practice_handson_min != null) {
        const v = parseInt(log.video_learning_duration_min, 10) || 0;
        const p = parseInt(log.practice_handson_min, 10) || 0;
        if (v > 0 || p > 0) return v + p;
    }
    const durStr = String(log.duration || "");
    const hMatch = durStr.match(/(\d+)\s*h/i);
    const mMatch = durStr.match(/(\d+)\s*m/i);
    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    const m = mMatch ? parseInt(mMatch[1], 10) : 0;
    if (h > 0 || m > 0) return h * 60 + m;
    const num = parseFloat(durStr);
    return !isNaN(num) ? num : 0;
}

function getBreakdownText(log) {
    if (!log) return "Self-directed study";
    const vMin = parseInt(log.video_learning_duration_min, 10) || 0;
    const pMin = parseInt(log.practice_handson_min, 10) || 0;
    if (vMin > 0 || pMin > 0) {
        const vH = Math.floor(vMin / 60);
        const vM = vMin % 60;
        const pH = Math.floor(pMin / 60);
        const pM = pMin % 60;

        const vStr = vH > 0 ? `${vH}h${vM > 0 ? ` ${vM}m` : ""}` : `${vM}m`;
        const pStr = pH > 0 ? `${pH}h${pM > 0 ? ` ${pM}m` : ""}` : `${pM}m`;
        return `Video: ${vStr} • Practice: ${pStr}`;
    }
    return "Self-directed study";
}

function getBreakdownMinutes(log) {
    if (!log) return { video: 0, practice: 0, total: 0 };
    const video = parseInt(log.video_learning_duration_min, 10) || 0;
    const practice = parseInt(log.practice_handson_min, 10) || 0;
    return { video, practice, total: video + practice };
}

const renderSortIcon = (key, sortConfig) => {
    if (sortConfig.key !== key || !sortConfig.direction) {
        return <ArrowUpDown size={12} className="all-logs-sort-icon inactive" />;
    }
    return sortConfig.direction === "asc" ? (
        <ArrowUp size={12} className="all-logs-sort-icon active" />
    ) : (
        <ArrowDown size={12} className="all-logs-sort-icon active" />
    );
};

export default function AllLearningLogsView({ logs = [], onBack, onUpdateLog, isLoading = false }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [editingLog, setEditingLog] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const itemsPerPage = 10;

    const handleSort = (key) => {
        setSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: "asc" };
            }
            if (prev.direction === "asc") {
                return { key, direction: "desc" };
            }
            return { key: null, direction: null };
        });
        setCurrentPage(1);
    };

    // Reset pagination on filter, sort, or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, startDate, endDate, sortConfig]);

    // Filter and sort logs
    const filteredLogs = useMemo(() => {
        let result = [...logs];

        if (startDate || endDate) {
            result = result.filter((log) => matchesDateRange(log, startDate, endDate));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((log) => {
                // Search ONLY Course / Activity and What did you learn columns
                const courseName = (log.title || log.course_name || log.courseTitle || log.topic || "").toLowerCase();
                const learned = (log.description || log.what_you_learned || log.notes || log.learned_today || log.key_takeaways || "").toLowerCase();

                return courseName.includes(q) || learned.includes(q);
            });
        }

        // Sorting
        if (sortConfig.key && sortConfig.direction) {
            const { key, direction } = sortConfig;
            result.sort((a, b) => {
                let res = 0;
                if (key === "dateTime") {
                    const timeA = getLogTimeValue(a);
                    const timeB = getLogTimeValue(b);
                    res = timeA - timeB;
                } else if (key === "course") {
                    const nameA = (a.title || a.course_name || a.courseTitle || "").trim();
                    const nameB = (b.title || b.course_name || b.courseTitle || "").trim();
                    res = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
                } else if (key === "learned") {
                    const descA = (a.description || a.what_you_learned || a.notes || "").trim();
                    const descB = (b.description || b.what_you_learned || b.notes || "").trim();
                    res = descA.localeCompare(descB, undefined, { sensitivity: "base" });
                } else if (key === "breakdown") {
                    const bMinA = getBreakdownMinutes(a).total;
                    const bMinB = getBreakdownMinutes(b).total;
                    if (bMinA !== bMinB) {
                        res = bMinA - bMinB;
                    } else {
                        res = getBreakdownText(a).localeCompare(getBreakdownText(b), undefined, { sensitivity: "base" });
                    }
                } else if (key === "duration") {
                    const durA = parseDurationMinutes(a);
                    const durB = parseDurationMinutes(b);
                    res = durA - durB;
                }
                return direction === "asc" ? res : -res;
            });
        } else {
            // Default chronological descending
            result.sort((a, b) => getLogTimeValue(b) - getLogTimeValue(a));
        }

        return result;
    }, [logs, startDate, endDate, searchQuery, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const paginatedLogs = useMemo(() => {
        const start = (safePage - 1) * itemsPerPage;
        return filteredLogs.slice(start, start + itemsPerPage);
    }, [filteredLogs, safePage, itemsPerPage]);

    // Stats calculations
    const stats = useMemo(() => {
        let totalMinutes = 0;
        let totalPoints = 0;

        logs.forEach((log) => {
            let durMin = 0;
            if (log.video_learning_duration_min || log.practice_handson_min) {
                durMin = (parseInt(log.video_learning_duration_min, 10) || 0) + (parseInt(log.practice_handson_min, 10) || 0);
            } else if (typeof log.duration === "string") {
                const hMatch = log.duration.match(/(\d+)\s*h/);
                const mMatch = log.duration.match(/(\d+)\s*m/);
                durMin = (hMatch ? parseInt(hMatch[1], 10) * 60 : 0) + (mMatch ? parseInt(mMatch[1], 10) : 0);
            }
            totalMinutes += durMin;

            if (log.points_earned) {
                totalPoints += parseInt(log.points_earned, 10) || 0;
            } else if (log.points) {
                totalPoints += parseInt(log.points, 10) || 0;
            }
        });

        const totalHours = (totalMinutes / 60).toFixed(1);
        return {
            totalLogs: logs.length,
            totalHours: totalHours.endsWith(".0") ? parseInt(totalHours, 10) : totalHours,
            totalPoints,
        };
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
        <div className="all-learning-logs-view">
            {/* Top Navigation & Header */}
            <div className="all-logs-top-header">
                <div className="all-logs-header-title-row">
                    <div className="all-logs-title-left-group">
                        <button
                            type="button"
                            className="all-logs-back-btn"
                            onClick={onBack}
                            title="Return to Daily Learning Log"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="all-logs-title-content">
                            <h1 className="all-logs-main-title">All Learning Logs</h1>
                            <p className="all-logs-subtitle">
                                Complete historical record of all your logged daily learning sessions and skill progress.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="all-logs-stats-badges">
                    <div className="all-logs-stat-badge">
                        <BookOpen size={16} className="all-logs-stat-icon" />
                        <span className="all-logs-stat-value">{stats.totalLogs}</span>
                        <span className="all-logs-stat-label">Total Logs</span>
                    </div>
                    <div className="all-logs-stat-badge">
                        <Clock size={16} className="all-logs-stat-icon" />
                        <span className="all-logs-stat-value">{stats.totalHours}h</span>
                        <span className="all-logs-stat-label">Hours Logged</span>
                    </div>
                    <div className="all-logs-stat-badge highlight">
                        <Sparkles size={16} className="all-logs-stat-icon" />
                        <span className="all-logs-stat-value">{stats.totalPoints}</span>
                        <span className="all-logs-stat-label">Points Earned</span>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="all-logs-toolbar">
                <div className="all-logs-search-wrapper">
                    <Search size={16} className="all-logs-search-icon" />
                    <input
                        type="text"
                        placeholder="Search by course, or what you learned..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="all-logs-search-input"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="all-logs-search-clear"
                            onClick={() => setSearchQuery("")}
                            title="Clear search"
                        >
                            ×
                        </button>
                    )}
                </div>

                <div className="all-logs-date-range-row">
                    <div className="all-logs-date-field">
                        <span className="all-logs-date-sublabel">Starting Date</span>
                        <EmpDatePicker
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            placeholder="dd/mm/yyyy"
                        />
                    </div>

                    <span className="all-logs-date-separator">to</span>

                    <div className="all-logs-date-field">
                        <span className="all-logs-date-sublabel">Ending Date</span>
                        <EmpDatePicker
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            placeholder="dd/mm/yyyy"
                            min={startDate || undefined}
                        />
                    </div>

                    {(startDate || endDate) && (
                        <button
                            type="button"
                            className="all-logs-date-clear-btn"
                            onClick={() => {
                                setStartDate("");
                                setEndDate("");
                            }}
                            title="Clear date filter"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Logs Table / List Container */}
            <div className="all-logs-table-card">
                {isLoading ? (
                    <div className="all-logs-loading">
                        <div className="all-logs-spinner" />
                        <span>Loading learning logs...</span>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="all-logs-empty-state">
                        <BookOpen size={48} className="all-logs-empty-icon" />
                        <h3>No learning logs found</h3>
                        <p>
                            {searchQuery || startDate || endDate
                                ? "No logs match your current search or date range criteria. Try resetting the filters."
                                : ""}
                        </p>
                        {(searchQuery || startDate || endDate) && (
                            <button
                                type="button"
                                className="all-logs-reset-filters-btn"
                                onClick={() => {
                                    setSearchQuery("");
                                    setStartDate("");
                                    setEndDate("");
                                }}
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="all-logs-table-wrapper">
                            <table className="all-logs-table">
                                <thead>
                                    <tr>
                                        <th
                                            className="all-logs-sortable-header"
                                            onClick={() => handleSort("dateTime")}
                                            style={{ width: "130px", cursor: "pointer" }}
                                            title="Sort by Date & Time"
                                        >
                                            <div className="all-logs-sortable-header-inner">
                                                <span>Date & Time</span>
                                                {renderSortIcon("dateTime", sortConfig)}
                                            </div>
                                        </th>
                                        <th
                                            className="all-logs-sortable-header"
                                            onClick={() => handleSort("course")}
                                            style={{ width: "220px", cursor: "pointer" }}
                                            title="Sort by Course / Activity"
                                        >
                                            <div className="all-logs-sortable-header-inner">
                                                <span>Course / Activity</span>
                                                {renderSortIcon("course", sortConfig)}
                                            </div>
                                        </th>
                                        <th
                                            className="all-logs-sortable-header"
                                            onClick={() => handleSort("learned")}
                                            style={{ minWidth: "180px", cursor: "pointer" }}
                                            title="Sort by What You Learned"
                                        >
                                            <div className="all-logs-sortable-header-inner">
                                                <span>What You Learned</span>
                                                {renderSortIcon("learned", sortConfig)}
                                            </div>
                                        </th>
                                        <th
                                            className="all-logs-sortable-header"
                                            onClick={() => handleSort("breakdown")}
                                            style={{ width: "190px", cursor: "pointer" }}
                                            title="Sort by Breakdown"
                                        >
                                            <div className="all-logs-sortable-header-inner">
                                                <span>Breakdown</span>
                                                {renderSortIcon("breakdown", sortConfig)}
                                            </div>
                                        </th>
                                        <th
                                            className="all-logs-sortable-header"
                                            onClick={() => handleSort("duration")}
                                            style={{ width: "120px", textAlign: "center", cursor: "pointer" }}
                                            title="Sort by Total Duration"
                                        >
                                            <div className="all-logs-sortable-header-inner center">
                                                <span>Total Duration</span>
                                                {renderSortIcon("duration", sortConfig)}
                                            </div>
                                        </th>
                                        <th style={{ width: "80px", textAlign: "center" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedLogs.map((log) => {
                                        const canEdit = isLogEditable(log);
                                        return (
                                            <tr key={log.id || log.daily_learning_id} className="all-logs-table-row">
                                                <td className="all-logs-cell-datetime" title={`${log.date || ""} ${log.time || ""}`}>
                                                    <div className="all-logs-date-text">{log.date || "—"}</div>
                                                    <div className="all-logs-time-text">{log.time || "—"}</div>
                                                </td>
                                                <td className="all-logs-cell-course">
                                                    <div className="all-logs-course-title" title={log.title}>
                                                        {log.title}
                                                    </div>
                                                </td>
                                                <td className="all-logs-cell-description">
                                                    <div className="all-logs-desc-text" title={log.description}>
                                                        {log.description}
                                                    </div>
                                                </td>
                                                <td className="all-logs-cell-breakdown" title={getBreakdownText(log)}>
                                                    <span className="all-logs-breakdown-tag" title={getBreakdownText(log)}>
                                                        {getBreakdownText(log)}
                                                    </span>
                                                </td>
                                                <td className="all-logs-cell-duration" title={formatDurationPill(log.duration)}>
                                                    <span className="emp-log-duration">
                                                        {formatDurationPill(log.duration)}
                                                    </span>
                                                </td>
                                                <td className="all-logs-cell-action">
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
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Tablet & Mobile Responsive Card View */}
                        <div className="all-logs-card-list">
                            <div className="all-logs-mobile-sort-bar">
                                <span className="all-logs-mobile-sort-label">Sort:</span>
                                <div className="all-logs-mobile-sort-select-wrap">
                                    <select
                                        className="all-logs-mobile-sort-select"
                                        value={sortConfig.key || ""}
                                        onChange={(e) => {
                                            const newKey = e.target.value || null;
                                            setSortConfig({ key: newKey, direction: newKey ? (sortConfig.direction || "asc") : null });
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="">Default (Newest)</option>
                                        <option value="dateTime">Date & Time</option>
                                        <option value="course">Course / Activity</option>
                                        <option value="learned">What You Learned</option>
                                        <option value="breakdown">Breakdown</option>
                                        <option value="duration">Total Duration</option>
                                    </select>
                                </div>
                                {sortConfig.key && (
                                    <button
                                        type="button"
                                        className="all-logs-mobile-sort-dir-btn"
                                        onClick={() => {
                                            setSortConfig((prev) => ({
                                                ...prev,
                                                direction: prev.direction === "asc" ? "desc" : "asc",
                                            }));
                                            setCurrentPage(1);
                                        }}
                                        title={sortConfig.direction === "asc" ? "Ascending order" : "Descending order"}
                                    >
                                        {sortConfig.direction === "asc" ? (
                                            <>
                                                <ArrowUp size={13} /> Asc
                                            </>
                                        ) : (
                                            <>
                                                <ArrowDown size={13} /> Desc
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {paginatedLogs.map((log) => {
                                const canEdit = isLogEditable(log);
                                return (
                                    <div key={log.id || log.daily_learning_id} className="all-logs-card-item">
                                        <div className="all-logs-card-header">
                                            <div className="all-logs-card-datetime">
                                                <span className="all-logs-card-date">{log.date || "—"}</span>
                                                {log.time && <span className="all-logs-card-time">{log.time}</span>}
                                            </div>
                                            <div className="all-logs-card-header-right">
                                                <span className="emp-log-duration">
                                                    {formatDurationPill(log.duration)}
                                                </span>
                                                <button
                                                    type="button"
                                                    className={`emp-edit-log-button ${!canEdit ? "disabled" : ""}`}
                                                    aria-label={canEdit ? `Edit ${log.title}` : `Editing is disabled after 24 hours for ${log.title}`}
                                                    title={canEdit ? "Edit learning log" : "Editing is disabled after 24 hours"}
                                                    onClick={() => canEdit && handleOpenEdit(log)}
                                                    disabled={!canEdit}
                                                >
                                                    <img src={blueEditIcon} alt="Edit" className="emp-edit-icon-img" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="all-logs-card-body">
                                            <div className="all-logs-card-course-title" title={log.title}>
                                                {log.title}
                                            </div>
                                            {log.description && (
                                                <div className="all-logs-card-desc-text">
                                                    {log.description}
                                                </div>
                                            )}
                                        </div>

                                        <div className="all-logs-card-footer">
                                            <span className="all-logs-breakdown-tag">
                                                {getBreakdownText(log)}
                                            </span>
                                            {(log.points_earned || log.points) && (
                                                <span className="all-logs-card-points">
                                                    +{log.points_earned || log.points} pts
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Pagination inside table card */}
                {!isLoading && filteredLogs.length > 0 && (
                    <Pagination
                        currentPage={safePage}
                        setCurrentPage={setCurrentPage}
                        total={filteredLogs.length}
                        itemsPerPage={itemsPerPage}
                        type="Logs"
                    />
                )}
            </div>

            {/* Reusable Edit Modal */}
            <EditLearningLogModal
                isOpen={Boolean(editingLog)}
                onClose={() => setEditingLog(null)}
                logData={editingLog}
                onSave={handleSaveEdit}
            />
        </div>
    );
}
