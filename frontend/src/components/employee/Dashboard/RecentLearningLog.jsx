import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import eyeIcon from '../../../assets/Dashboard/eye.svg';
import openBookIcon from '../../../assets/course_library/open_book_icon.svg';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const FIXED_DOT_COLORS = [
    "#215EF8", // 1st item: Blue
    "#31C27E", // 2nd item: Green
    "#9E5DF9", // 3rd item: Purple
    "#FDAD33", // 4th item: Amber / Orange
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getLogTimeValue(log) {
    if (!log) return 0;
    if (log.created_at) {
        const dt = new Date(String(log.created_at).replace(" ", "T")).getTime();
        if (!isNaN(dt)) return dt;
    }
    if (log.learning_date) {
        const dt = new Date(String(log.learning_date).replace(" ", "T")).getTime();
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

const RecentLearningLog = ({ logs: propLogs }) => {
    const navigate = useNavigate();
    const { user, currentUser } = useAuth();
    const activeUser = user || currentUser;

    const getActiveEmpId = () => {
        if (activeUser?.employee_id) return activeUser.employee_id;
        if (activeUser?.empId) return activeUser.empId;
        const storedUser = localStorage.getItem("lms_user");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed?.employee_id) return parsed.employee_id;
                if (parsed?.empId) return parsed.empId;
            } catch (e) { }
        }
        return localStorage.getItem("lms_active_employee_id") || "EMP004";
    };

    const activeEmpId = getActiveEmpId();
    const [fetchedLogs, setFetchedLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(!propLogs);
    const [maxVisibleLogs, setMaxVisibleLogs] = useState(4);
    const listRef = useRef(null);

    // Measure available container height on desktop to dynamically fill without clipping or bottom space
    useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const updateCount = () => {
            if (window.innerWidth < 1024) {
                setMaxVisibleLogs(4);
                return;
            }
            const height = el.clientHeight;
            if (!height) return;
            const count = Math.max(4, Math.floor((height + 5) / 33));
            setMaxVisibleLogs((prev) => (prev !== count ? count : prev));
        };

        updateCount();
        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(updateCount);
            observer.observe(el);
            window.addEventListener("resize", updateCount);
            return () => {
                observer.disconnect();
                window.removeEventListener("resize", updateCount);
            };
        }
        window.addEventListener("resize", updateCount);
        return () => window.removeEventListener("resize", updateCount);
    }, []);

    // Fetch live logs if not passed via props (with AbortController + transient network retry)
    useEffect(() => {
        if (propLogs) {
            setFetchedLogs(propLogs);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const controller = new AbortController();

        const fetchWithRetry = async () => {
            const authToken = localStorage.getItem("lms_token");
            const currentEmpId = getActiveEmpId();
            if (!currentEmpId) {
                if (isMounted) setIsLoading(false);
                return;
            }

            const requestConfig = {
                params: { employee_id: currentEmpId },
                headers: {
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    "X-Employee-Id": currentEmpId,
                },
                signal: controller.signal,
            };

            const candidateUrls = Array.from(
                new Set([`${API_BASE_URL}/api/daily-learning`, "/api/daily-learning"])
            );

            let lastErr = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                const targetUrl = candidateUrls[Math.min(attempt, candidateUrls.length - 1)];
                try {
                    const res = await axios.get(targetUrl, requestConfig);
                    if (isMounted && Array.isArray(res.data)) {
                        setFetchedLogs(res.data);
                    }
                    lastErr = null;
                    break;
                } catch (err) {
                    if (axios.isCancel(err) || err?.code === "ERR_CANCELED" || !isMounted) {
                        return;
                    }
                    lastErr = err;
                    // Retry only on transient network/socket drops (e.g. ERR_NETWORK_CHANGED)
                    if (!err.response && attempt < 2) {
                        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
                        continue;
                    }
                    break;
                }
            }

            if (lastErr && isMounted) {
                console.warn("[Dashboard RecentLearningLog] Could not fetch logs:", lastErr?.message || lastErr);
            }
            if (isMounted) setIsLoading(false);
        };

        fetchWithRetry();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [activeEmpId, propLogs]);

    // Sort chronologically descending and dynamically fit logs to container height
    const displayLogs = useMemo(() => {
        const sourceLogs = propLogs || fetchedLogs;
        if (!sourceLogs || !sourceLogs.length) return [];

        const sorted = [...sourceLogs].sort((a, b) => getLogTimeValue(b) - getLogTimeValue(a));
        return sorted.slice(0, maxVisibleLogs).map((item, index) => {
            return {
                id: item.id || item.daily_learning_id || index + 1,
                subject: item.course_title || item.course_name || item.title || item.subject || "Learning Activity",
                description: item.description || item.learning_notes || item.topic || "Completed learning session",
                duration: item.duration || (item.learning_hours ? `${item.learning_hours}h` : "1h"),
                dotColor: FIXED_DOT_COLORS[index % FIXED_DOT_COLORS.length],
            };
        });
    }, [propLogs, fetchedLogs, maxVisibleLogs]);

    return (
        <div className="emp-dashboard-card emp-recent-learning-log-card">
            <div className="emp-dashboard-card-header-row">
                <h3 className="emp-dashboard-card-title">Recent Learning Log</h3>
                <button
                    type="button"
                    className="emp-view-more-action-btn"
                    onClick={() => navigate('/employee/daily-learning-log')}
                >
                    <img src={eyeIcon} alt="View" className="emp-view-more-eye-icon" />
                    <span>View All</span>
                </button>
            </div>

            <div className="emp-learning-log-items-list" ref={listRef}>
                {isLoading ? (
                    [1, 2, 3, 4].map((n) => (
                        <div className="emp-learning-log-item-row" key={n} style={{ alignItems: "center" }}>
                            <div className="emp-log-left-part" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                                <span className="ld-skeleton-circle" style={{ width: 10, height: 10, flexShrink: 0 }} />
                                <span className="ld-skeleton-block" style={{ width: "65%", height: 15 }} />
                            </div>
                            <span className="ld-skeleton-block" style={{ width: 48, height: 16, borderRadius: 4 }} />
                        </div>
                    ))
                ) : displayLogs.length === 0 ? (
                    <div className="emp-recent-log-empty-state" style={{ minHeight: 0, padding: "18px 8px" }}>
                        <img
                            src={openBookIcon}
                            alt="No learning activities"
                            className="emp-recent-log-empty-icon"
                        />
                        <span>No learning activities logged yet !</span>
                    </div>
                ) : (
                    displayLogs.map((log) => (
                        <div
                            className="emp-learning-log-item-row"
                            key={log.id}
                            title={`${log.subject} - ${log.description}`}
                        >
                            <div className="emp-log-left-part">
                                <span
                                    className="emp-log-bullet-dot"
                                    style={{ backgroundColor: log.dotColor }}
                                />
                                <div
                                    className="emp-log-text-snippet"
                                    title={`${log.subject} - ${log.description}`}
                                >
                                    <span className="emp-log-subject">{log.subject}</span>
                                    <span className="emp-log-sep"> - </span>
                                    <span className="emp-log-desc">{log.description}</span>
                                </div>
                            </div>

                            <div className="emp-log-duration-badge-wrapper">
                                <span className="emp-log-duration-badge">{log.duration}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RecentLearningLog;
