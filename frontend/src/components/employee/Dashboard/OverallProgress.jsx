import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import circleSvg from '../../../assets/circle.svg';
import openBookIcon from '../../../assets/course_library/open_book_icon.svg';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";


/**
 * Duration-Weighted Average Progress Algorithm:
 * Overall Progress = SUM(course_progress × course_duration) / SUM(course_duration)
 */
function calculateDurationWeightedProgress(courseList) {
    if (!Array.isArray(courseList) || courseList.length === 0) return 0;
    let totalWeightedProduct = 0;
    let totalDuration = 0;

    for (const c of courseList) {
        if (c.isZeroModules) continue;
        const prog = Number(c.progress ?? c.current_progress ?? c.progress_percentage ?? 0);
        const dur = Number(c.durationMinutes ?? c.duration_minutes ?? c.duration ?? 0);
        if (dur > 0 && !isNaN(prog) && isFinite(prog)) {
            totalWeightedProduct += Math.max(0, Math.min(100, prog)) * dur;
            totalDuration += dur;
        }
    }

    if (totalDuration === 0) return 0;
    const result = Math.round(totalWeightedProduct / totalDuration);
    return isNaN(result) || !isFinite(result) ? 0 : Math.max(0, Math.min(100, result));
}


/**
 * Active validity evaluator matching Certification & Reimbursement -> My Certificates
 */
const isCertificateActive = (cert) => {
    if (!cert) return false;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const rawDate = cert.expiryDate || cert.scheduled_exam_date || cert.expiry_date;
    if (rawDate) {
        try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                return d >= now;
            }
        } catch { }
    }

    if (cert.status === "valid" || cert.status === "completed") {
        return true;
    }

    if (cert.validityText && typeof cert.validityText === "string") {
        const trimmed = cert.validityText.trim();
        if (/^completed\s+on/i.test(trimmed)) return true;
        if (/^valid\s+certificate/i.test(trimmed)) return true;
        if (/^valid\s+till/i.test(trimmed)) {
            const datePart = trimmed.replace(/^valid\s+till\s+/i, "").trim();
            const parsedMonth = Date.parse(datePart + " 01");
            if (!isNaN(parsedMonth)) {
                const exp = new Date(parsedMonth);
                exp.setMonth(exp.getMonth() + 1);
                exp.setDate(0);
                exp.setHours(23, 59, 59, 999);
                return exp >= now;
            }
            const parsedGeneral = Date.parse(datePart);
            if (!isNaN(parsedGeneral)) {
                return new Date(parsedGeneral) >= now;
            }
            return true;
        }
    }

    if (!rawDate) {
        return true;
    }

    return false;
};

/**
 * Evaluates whether an item is a Certification (Professional Certification),
 * strictly excluding Course Completion Certificates ("certificate").
 */
const isProfessionalCertification = (cert) => {
    if (!cert) return false;
    const typeStr = String(cert?.type || "").trim().toLowerCase();
    const certTypeStr = String(cert?.certificate_type || "").trim().toLowerCase();

    // Strictly exclude Course Completion Certificates
    if (typeStr.includes("course completion") || certTypeStr.includes("course completion")) {
        return false;
    }

    // Must be a Professional Certification and currently active
    const isProf = typeStr.includes("professional") || typeStr.includes("certification") ||
        certTypeStr.includes("professional") || certTypeStr.includes("certification");
    return isProf && isCertificateActive(cert);
};

const OverallProgress = () => {
    const { user, currentUser } = useAuth();
    const activeUser = user || currentUser;

    const getActiveEmpId = () => {
        if (activeUser?.employee_id) return activeUser.employee_id;
        if (activeUser?.empId) return activeUser.empId;
        const storedActive = localStorage.getItem("lms_active_employee_id");
        if (storedActive) return storedActive;
        const storedUser = localStorage.getItem("lms_user");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed?.employee_id) return parsed.employee_id;
                if (parsed?.empId) return parsed.empId;
            } catch (e) { }
        }
        return "EMP004";
    };

    const activeEmpId = getActiveEmpId();
    const [fetchedCourses, setFetchedCourses] = useState([]);
    const [certCount, setCertCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch live in-progress courses & active certifications from backend catalog
    useEffect(() => {
        let isMounted = true;
        const loadProgressData = async () => {
            try {
                const authToken = localStorage.getItem("lms_token");
                const currentEmpId = getActiveEmpId();

                const [coursesRes, certRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/daily-learning/my-courses`, {
                        params: { employee_id: currentEmpId },
                        headers: {
                            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                            "X-Employee-Id": currentEmpId,
                        }
                    }).catch(() => ({ data: [] })),
                    axios.get(`${API_BASE_URL}/api/employee/certifications`, {
                        params: { employee_id: currentEmpId },
                        headers: {
                            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                            "X-Employee-Id": currentEmpId,
                        }
                    }).catch(() => null),
                ]);

                if (isMounted) {
                    if (Array.isArray(coursesRes.data) && coursesRes.data.length > 0) {
                        const mapped = coursesRes.data.map((c) => {
                            const totalModules = c.total_modules !== undefined ? Number(c.total_modules) : (c.totalModules !== undefined ? Number(c.totalModules) : null);
                            const completedModules = Number(c.completed_modules ?? c.completedModules ?? 0);

                            // Check for zero modules breakdown (e.g. self-study course with 0 modules)
                            const isZeroModules = totalModules === 0;

                            let rawProg = 0;
                            if (isZeroModules) {
                                rawProg = 0;
                            } else if (totalModules !== null && totalModules > 0) {
                                if (completedModules >= totalModules) {
                                    rawProg = 100;
                                } else {
                                    const calculated = (completedModules / totalModules) * 100;
                                    rawProg = calculated >= 99.5 ? 100 : calculated;
                                }
                            } else {
                                const rawVal = Number(c.current_progress ?? c.progress_percentage ?? 0);
                                rawProg = rawVal >= 99.5 ? 100 : rawVal;
                            }

                            if (isNaN(rawProg) || !isFinite(rawProg)) {
                                rawProg = 0;
                            }

                            const finalProg = isZeroModules ? 0 : (rawProg >= 99.5 ? 100 : (rawProg % 1 === 0 ? rawProg : Number(rawProg.toFixed(1))));

                            return {
                                id: c.course_id || c.id,
                                name: c.course_name || c.course_title || "Course",
                                provider: c.provider || "—",
                                category: c.category || "General",
                                progress: finalProg,
                                isZeroModules,
                                durationMinutes: Number(c.duration_minutes || 0),
                                last_updated: c.last_updated || null,
                                status: c.status || (finalProg >= 100 ? "Completed" : (finalProg > 0 ? "In Progress" : "Not Started")),
                            };
                        });

                        // Filter to courses actively in progress or enrolled
                        const inProgressList = mapped.filter((c) => {
                            const isNotStarted = String(c.status || "").trim().toLowerCase() === "not started" && Number(c.progress || 0) === 0 && !c.isZeroModules;
                            const isInProgress = String(c.status || "").trim().toLowerCase() === "in progress" || Number(c.progress || 0) > 0 || c.isZeroModules;
                            return isInProgress && !isNotStarted;
                        });
                        setFetchedCourses(inProgressList);

                    } else {
                        setFetchedCourses([]);
                    }

                    // Count only active certifications (strictly excluding Course Completion Certificates)
                    if (certRes?.data) {
                        const cList = Array.isArray(certRes.data) ? certRes.data : certRes.data?.certifications || [];
                        const activeList = cList.filter(isProfessionalCertification);
                        setCertCount(activeList.length);
                    } else {
                        setCertCount(0);
                    }
                }
            } catch (err) {
                console.warn("[OverallProgress] Could not fetch courses or certifications:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadProgressData();
        return () => { isMounted = false; };
    }, [activeEmpId]);

    // All active courses
    const allCourses = useMemo(() => {
        return fetchedCourses;
    }, [fetchedCourses]);

    // 1. Course Completion: Calculate duration-weighted average across ALL in-progress courses
    const progressPercent = useMemo(() => {
        return calculateDurationWeightedProgress(allCourses);
    }, [allCourses]);

    // 2. Right-hand List: Display the TOP 3 LAST UPDATED courses
    const displayedCourses = useMemo(() => {
        return [...allCourses]
            .sort((a, b) => {
                const timeA = a.last_updated ? new Date(String(a.last_updated).replace(" ", "T")).getTime() : 0;
                const timeB = b.last_updated ? new Date(String(b.last_updated).replace(" ", "T")).getTime() : 0;
                return timeB - timeA;
            })
            .slice(0, 3);
    }, [allCourses]);

    // Circular donut stroke calculations for 126x126 SVG matching Figma Ellipse 640
    const radius = 51;
    const strokeWidth = 9;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <div className="emp-dashboard-card emp-overall-progress-card">
            <div className="emp-dashboard-card-header-row">
                <h3 className="emp-dashboard-card-title">Overall Progress</h3>

                <div className="emp-progress-pill-filters">
                    <div className="emp-progress-pill-btn emp-progress-pill-badge">
                        <span className="emp-pill-btn-text">Active Courses</span>
                        <span className="emp-pill-btn-number">{allCourses.length}</span>
                    </div>
                    <div className="emp-progress-pill-btn emp-progress-pill-badge">
                        <span className="emp-pill-btn-text">Active Certifications</span>
                        <span className="emp-pill-btn-number">{certCount}</span>
                    </div>
                </div>
            </div>

            <div className="emp-overall-progress-body">
                {/* Left Column: Donut Gauge calculating all in-progress courses */}
                <div className="emp-progress-gauge-section">
                    <div className="emp-donut-chart-wrapper">
                        {/* Figma Ellipse 640: White circle disk with drop shadow */}
                        <div className="emp-donut-shadow-circle">
                            <div className="emp-donut-center-text">
                                {isLoading ? (
                                    <span className="ld-skeleton-block" style={{ width: 38, height: 20, display: "inline-block", marginBottom: 2 }} />
                                ) : (
                                    <span className="emp-donut-percentage">{progressPercent}%</span>
                                )}
                                <span className="emp-donut-subtext">of goal</span>
                            </div>
                        </div>

                        <svg className="emp-donut-svg" width="126" height="126" viewBox="0 0 126 126">
                            {/* Outer White Border Ring matching Picture 1 */}
                            <circle
                                cx="63"
                                cy="63"
                                r="57"
                                className="emp-donut-outer-ring"
                                strokeWidth="8"
                                fill="none"
                            />
                            {/* Track Arc */}
                            <circle
                                cx="63"
                                cy="63"
                                r={radius}
                                className="emp-donut-track"
                                strokeWidth={strokeWidth}
                                fill="none"
                            />
                            {/* Progress Arc dynamically reflecting duration-weighted progress */}
                            <circle
                                cx="63"
                                cy="63"
                                r={radius}
                                className="emp-donut-progress"
                                strokeWidth={strokeWidth}
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                transform="rotate(-90 63 63)"
                            />
                        </svg>
                    </div>

                    <span className="emp-gauge-bottom-label">Course Completion</span>
                </div>

                {/* Right Column: Course Progress Bars or Empty State */}
                <div className="emp-course-progress-list">
                    {isLoading ? (
                        [1, 2, 3].map((n) => (
                            <div className="emp-course-progress-item" key={n} style={{ padding: "8px 0" }}>
                                <div className="emp-course-header-row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "60%" }}>
                                        <span className="ld-skeleton-block" style={{ width: "80%", height: 14 }} />
                                        <span className="ld-skeleton-block" style={{ width: "50%", height: 10 }} />
                                    </div>
                                    <span className="ld-skeleton-block" style={{ width: 60, height: 16, borderRadius: 12 }} />
                                </div>
                                <div className="emp-course-bar-row">
                                    <div className="emp-progress-track-bg">
                                        <div className="ld-skeleton-block" style={{ width: `${n * 30}%`, height: "100%", borderRadius: 4 }} />
                                    </div>
                                    <span className="ld-skeleton-block" style={{ width: 28, height: 12 }} />
                                </div>
                            </div>
                        ))
                    ) : displayedCourses.length === 0 ? (
                        <div className="emp-recent-log-empty-state" style={{ minHeight: 0, padding: "16px 8px" }}>
                            <img
                                src={openBookIcon}
                                alt="No course progress"
                                className="emp-recent-log-empty-icon"
                            />
                            <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>
                                No course progress started yet !
                            </span>
                        </div>
                    ) : (
                        displayedCourses.map((course) => (
                            <div className="emp-course-progress-item" key={course.id || course.name}>
                                <div className="emp-course-header-row">
                                    <div className="emp-course-title-provider">
                                        <h4 className="emp-course-name" title={course.name}>{course.name}</h4>
                                        <span className="emp-course-provider-name">{course.provider}</span>
                                    </div>
                                    <span className="emp-course-category-badge">{course.category}</span>
                                </div>

                                <div className="emp-course-bar-row">
                                    <div className="emp-progress-track-bg">
                                        <div
                                            className="emp-progress-fill-bar"
                                            style={{
                                                width: `${course.isZeroModules || isNaN(course.progress) ? 0 : Math.max(0, Math.min(100, course.progress))}%`,
                                                backgroundColor: course.isZeroModules ? "#94A3B8" : undefined
                                            }}
                                        />
                                    </div>
                                    <span className="emp-progress-percent-label">
                                        {course.isZeroModules ? "0% - No modules defined" : `${course.progress}%`}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default OverallProgress;