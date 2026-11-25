import React, { useState, useRef, useEffect, useMemo } from "react";
import axios from "axios";
import { useAuth } from "../../../context/AuthContext";
import useSubmitLock, { extractApiErrorMessage } from "../../../hooks/useSubmitLock";
import downArrowIcon from "../../../assets/Daily_Learning_Log/down_arrow.svg";
import infoIcon from "../../../assets/Daily_Learning_Log/info.svg";
import upDownIcon from "../../../assets/Daily_Learning_Log/up_down.svg";
import clockSvg from "../../../assets/Daily_Learning_Log/clock.svg";
import ValidationNoticeModal from "./ValidationNoticeModal";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
} from "../../../utils/validationUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const MAX_DESCRIPTION_LENGTH = 250;

const parseDurationToMinutes = (durStr) => {
    if (!durStr) return 0;
    const s = String(durStr).trim();
    const hMatch = s.match(/(\d+)\s*(?:h|hr|hrs|hours)/i);
    const mMatch = s.match(/(\d+)\s*(?:m|min|mins|minutes)/i);
    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
    if (!hMatch && !mMatch) {
        const nums = s.match(/\d+/g);
        if (nums && nums.length > 0) return parseInt(nums[0], 10) * 60;
    }
    return hours * 60 + mins;
};

const formatDurationDisplay = (dur) => {
    if (dur === 0 || dur === "0") return "0m";
    if (!dur) return "0m";
    if (typeof dur === "number" || /^\d+$/.test(String(dur).trim())) {
        const totalMin = parseInt(dur, 10);
        if (totalMin <= 0) return "0m";
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }
    return String(dur);
};

export default function LearningForm({ onSaveLog, employeeId, onDurationErrorChange, logs = [] }) {
    const { user, currentUser } = useAuth();
    const activeUser = user || currentUser;

    const getActiveEmpId = () => {
        if (employeeId) return employeeId;
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

    const [coursesList, setCoursesList] = useState([]);
    const { isSubmitting, runWithLock } = useSubmitLock();
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [course, setCourse] = useState("");
    const [videoHours, setVideoHours] = useState(0);
    const [videoMinutes, setVideoMinutes] = useState(0);
    const [practiceHours, setPracticeHours] = useState(0);
    const [practiceMinutes, setPracticeMinutes] = useState(0);
    const [description, setDescription] = useState("");
    const [descriptionError, setDescriptionError] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [noticeModal, setNoticeModal] = useState({
        isOpen: false,
        message: "",
    });

    // Fetch live approved courses for this employee
    useEffect(() => {
        let isMounted = true;
        const fetchCoursesFromDB = async () => {
            try {
                const authToken = localStorage.getItem("lms_token");
                const activeEmpId = getActiveEmpId();
                const res = await axios.get(`${API_BASE_URL}/api/daily-learning/my-courses`, {
                    params: {
                        employee_id: activeEmpId,
                    },
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    }
                });
                if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
                    const formatted = res.data.map((c) => ({
                        course_id: c.course_id || c.id,
                        course_title: c.course_title || c.title || "",
                        duration: formatDurationDisplay(c.duration),
                        duration_minutes: c.duration_minutes || parseDurationToMinutes(c.duration),
                        completed_minutes: c.completed_minutes !== undefined ? Number(c.completed_minutes) : 0,
                        remaining_minutes: c.remaining_minutes !== undefined ? Number(c.remaining_minutes) : 0,
                        current_progress: c.current_progress !== undefined ? Number(c.current_progress) : 0.0,
                    })).filter((c) => c.course_title);
                    setCoursesList(formatted);
                } else if (isMounted) {
                    setCoursesList([]);
                }
            } catch (err) {
                console.warn("[LearningForm] Could not fetch approved courses for employee:", err);
            }
        };
        fetchCoursesFromDB();
        return () => { isMounted = false; };
    }, [employeeId, activeUser]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Course options: directly from database lms_courses
    const availableCourses = coursesList;

    const handleSelectCourse = (selectedItem) => {
        if (typeof selectedItem === "object" && selectedItem !== null) {
            setCourse(selectedItem.course_title);
            setSelectedCourseId(selectedItem.course_id);
        } else {
            setCourse(selectedItem);
            const found = availableCourses.find(
                (c) => c.course_title.toLowerCase() === String(selectedItem).toLowerCase()
            );
            if (found) setSelectedCourseId(found.course_id);
        }
        setIsDropdownOpen(false);
    };

    const filteredCourses = availableCourses.filter((item) => {
        if (!course.trim()) return true;
        if (selectedCourseId && availableCourses.some(c => c.course_id === selectedCourseId && c.course_title.toLowerCase() === course.trim().toLowerCase())) {
            return true;
        }
        return item.course_title.toLowerCase().includes(course.trim().toLowerCase());
    });

    // Strict change handler — physically enforces max 2 digits, then clamps to ceiling.
    // Uses type="text" + maxLength="2" so the browser prevents long pastes/typing.
    const makeTimeChangeHandler = (setter, maxVal) => (e) => {
        // Allow empty so the user can clear the field and retype
        const raw = e.target.value;
        if (raw === "") { setter(0); return; }
        // Keep only the first 2 digits; strip every non-digit character
        const digits = raw.replace(/[^0-9]/g, "").slice(0, 2);
        if (digits === "") { setter(0); return; }
        const val = parseInt(digits, 10);
        if (isNaN(val)) { setter(0); return; }
        setter(Math.min(maxVal, Math.max(0, val)));
    };

    // Prevent non-numeric keys (arrows, +, -, e, . etc.)
    const handleKeyDownPreventInvalid = (e) => {
        // Allow navigation / editing keys
        const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
        if (allowedKeys.includes(e.key)) return;
        // Only allow single digit characters 0-9
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    };

    // Convenience wrappers kept for readability at call-sites
    const handleHoursChange = (setter, maxVal = 24) => makeTimeChangeHandler(setter, maxVal);
    const handleMinutesChange = (setter, maxVal = 59) => makeTimeChangeHandler(setter, maxVal);

    const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const isLogFromToday = (log) => {
        if (!log) return false;
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        const curDate = now.getDate();

        if (log.created_at) {
            const dt = new Date(String(log.created_at).replace(" ", "T"));
            if (!isNaN(dt.getTime())) {
                return dt.getFullYear() === curYear && dt.getMonth() === curMonth && dt.getDate() === curDate;
            }
        }
        if (log.learning_date) {
            const parts = String(log.learning_date).trim().split("-");
            if (parts.length === 3) {
                return (
                    parseInt(parts[0], 10) === curYear &&
                    parseInt(parts[1], 10) === curMonth + 1 &&
                    parseInt(parts[2], 10) === curDate
                );
            }
        }
        if (log.date) {
            const parts = log.date.trim().split(" ");
            const d = parseInt(parts[0], 10);
            const m = SHORT_MONTHS.indexOf(parts[1]);
            if (d === curDate && m === curMonth) {
                return true;
            }
        }
        return false;
    };

    const todayLogs = useMemo(() => {
        return (logs || []).filter(isLogFromToday);
    }, [logs]);

    const todayVideoLoggedMin = useMemo(() => {
        return todayLogs.reduce((acc, log) => {
            const vMin = parseInt(log.video_learning_duration_min || log.video_duration_minutes, 10) || 0;
            return acc + vMin;
        }, 0);
    }, [todayLogs]);

    const todayPracticeLoggedMin = useMemo(() => {
        return todayLogs.reduce((acc, log) => {
            const pMin = parseInt(log.practice_handson_min || log.practice_duration_minutes, 10) || 0;
            return acc + pMin;
        }, 0);
    }, [todayLogs]);

    const MAX_DAILY_TOTAL_MIN = 12 * 60; // 720 minutes = 12 hours total across video and practice combined
    const todayTotalLoggedMin = todayVideoLoggedMin + todayPracticeLoggedMin;

    const remainingDailyTotalMin = Math.max(0, MAX_DAILY_TOTAL_MIN - todayTotalLoggedMin);

    const remDailyTotalH = Math.floor(remainingDailyTotalMin / 60);
    const remDailyTotalM = remainingDailyTotalMin % 60;
    const todayLoggedH = Math.floor(todayTotalLoggedMin / 60);
    const todayLoggedM = todayTotalLoggedMin % 60;

    // Dynamic duration computation
    const vH = Math.max(0, parseInt(videoHours) || 0);
    const vM = Math.max(0, parseInt(videoMinutes) || 0);
    const pH = Math.max(0, parseInt(practiceHours) || 0);
    const pM = Math.max(0, parseInt(practiceMinutes) || 0);

    const totalMinutes = vH * 60 + vM + pH * 60 + pM;
    const totH = Math.floor(totalMinutes / 60);
    const totM = totalMinutes % 60;

    // Mathematical points calculation:
    // Video: 20 pts per 60 min -> 45 min = 15 pts, 30 min = 10 pts (min / 3)
    // Practice: 10 pts per 60 min (min / 6)
    const videoDurationMin = vH * 60 + vM;
    const practiceDurationMin = pH * 60 + pM;
    const videoPts = (videoDurationMin * 20) / 60.0;
    const practicePts = (practiceDurationMin * 10) / 60.0;
    const autoPoints = Math.round(videoPts + practicePts);

    // Selected course object and mathematical progress computation
    const selectedCourseObj = availableCourses.find(
        (c) => (selectedCourseId && c.course_id === selectedCourseId) ||
            (course && c.course_title.toLowerCase() === course.trim().toLowerCase())
    );

    const courseDurationMinutes = selectedCourseObj?.duration_minutes ||
        (selectedCourseObj?.duration ? parseDurationToMinutes(selectedCourseObj.duration) : 0);
    const baseProgress = selectedCourseObj?.current_progress || 0.0;

    // ── Course-duration-based metrics ──────────────────────────────────────
    const baseCompletedMin = selectedCourseObj?.completed_minutes !== undefined && selectedCourseObj?.completed_minutes > 0
        ? Number(selectedCourseObj.completed_minutes)
        : (courseDurationMinutes > 0 ? Math.round((baseProgress / 100) * courseDurationMinutes) : 0);

    const baseRemainingMin = selectedCourseObj?.remaining_minutes !== undefined && selectedCourseObj?.remaining_minutes > 0
        ? Number(selectedCourseObj.remaining_minutes)
        : Math.max(0, courseDurationMinutes - baseCompletedMin);

    // Max hours/minutes the user can enter for video (bounded by 12h daily total limit AND course remaining duration)
    const remainingCourseMin = baseRemainingMin;
    const maxVideoHours = courseDurationMinutes > 0
        ? Math.min(remDailyTotalH, Math.floor(baseRemainingMin / 60))
        : remDailyTotalH;
    const maxVideoMinutes = (vH >= maxVideoHours && (maxVideoHours * 60 + 59 > remainingDailyTotalMin))
        ? (remainingDailyTotalMin % 60)
        : (courseDurationMinutes > 0 && maxVideoHours === 0 ? Math.min(baseRemainingMin, remainingDailyTotalMin) : 59);

    // Max hours/minutes for practice (bounded by 12h daily total limit)
    const maxPracticeHours = remDailyTotalH;
    const maxPracticeMinutes = (pH >= maxPracticeHours && (maxPracticeHours * 60 + 59 > remainingDailyTotalMin))
        ? (remainingDailyTotalMin % 60)
        : 59;

    // Dynamic metrics reflecting current form inputs in real time
    const dynamicCompletedMin = Math.min(courseDurationMinutes, baseCompletedMin + videoDurationMin);
    const dynamicRemainingMin = Math.max(0, courseDurationMinutes - dynamicCompletedMin);
    const dynamicProgress = courseDurationMinutes > 0
        ? Math.min(100.0, Math.round(((dynamicCompletedMin) / courseDurationMinutes) * 10000) / 100)
        : baseProgress;

    const projectedProgress = dynamicProgress;
    const sessionProgressGain = courseDurationMinutes > 0 ? (videoDurationMin / courseDurationMinutes) * 100.0 : 0.0;

    // Whether the currently entered video duration exceeds what's left in the course
    const videoDurationExceedsCourse =
        courseDurationMinutes > 0 && videoDurationMin > baseRemainingMin;

    // Whether current combined duration exceeds the remaining daily limit of 12 hours
    const combinedExceedsDaily = totalMinutes > remainingDailyTotalMin;

    useEffect(() => {
        onDurationErrorChange?.(Boolean(videoDurationExceedsCourse || combinedExceedsDaily));
        return () => {
            onDurationErrorChange?.(false);
        };
    }, [videoDurationExceedsCourse, combinedExceedsDaily, onDurationErrorChange]);

    // Human-readable remaining course time label (based on actual course remaining time before entry)
    const baseRemainingH = Math.floor(baseRemainingMin / 60);
    const baseRemainingM = baseRemainingMin % 60;
    const baseRemainingLabel = baseRemainingH > 0 && baseRemainingM > 0
        ? `${baseRemainingH}h ${baseRemainingM}m`
        : baseRemainingH > 0 ? `${baseRemainingH}h` : `${baseRemainingM}m`;
    const remainingLabel = baseRemainingLabel;
    const courseDurLabel = (() => {
        const h = Math.floor(courseDurationMinutes / 60);
        const m = courseDurationMinutes % 60;
        return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
    })();

    const handleDescriptionChange = (e) => {
        const nextVal = applySingleSpaceTextChange(e, MAX_DESCRIPTION_LENGTH);
        setDescription(nextVal);
        if (descriptionError && nextVal.trim()) {
            setDescriptionError("");
        }
    };

    const handleDescriptionPaste = (e) => {
        handleSingleSpacePaste(e, MAX_DESCRIPTION_LENGTH, (nextVal) => {
            setDescription(nextVal);
            if (descriptionError && nextVal.trim()) {
                setDescriptionError("");
            }
        });
    };

    const handleDescriptionBlur = () => {
        const cleaned = normalizeSingleSpacing(description, { trimEdges: true }).slice(0, MAX_DESCRIPTION_LENGTH);
        if (cleaned !== description) {
            setDescription(cleaned);
        }
    };

    const formatTimeStr = (h, m) => {
        if (h === 0 && m === 0) return "0m";
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    const totalStr = formatTimeStr(totH, totM);
    const videoStr = formatTimeStr(vH, vM);
    const practiceStr = formatTimeStr(pH, pM);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!course.trim()) {
            setNoticeModal({
                isOpen: true,
                message: "Please select or enter a course name!",
            });
            return;
        }
        if (!normalizeSingleSpacing(description, { trimEdges: true })) {
            setDescriptionError("This field is required");
            return;
        }
        if (totalMinutes <= 0) {
            setNoticeModal({
                isOpen: true,
                message: "Please enter a valid duration greater than 0 minutes!",
            });
            return;
        }
        if (totalMinutes > remainingDailyTotalMin) {
            setNoticeModal({
                isOpen: true,
                message: `Daily learning limit is 12 hours in total. You have already logged ${todayLoggedH}h ${todayLoggedM}m today (Video: ${Math.floor(todayVideoLoggedMin / 60)}h ${todayVideoLoggedMin % 60}m, Practice: ${Math.floor(todayPracticeLoggedMin / 60)}h ${todayPracticeLoggedMin % 60}m); you can only enter up to ${remDailyTotalH}h ${remDailyTotalM}m more in total across Video and Practice today.`,
            });
            return;
        }

        if (selectedCourseObj && courseDurationMinutes > 0 && videoDurationMin > remainingCourseMin) {
            setNoticeModal({
                isOpen: true,
                message: `Video learning duration (${videoStr}) exceeds the remaining course duration (${remainingLabel}). Please correct the hours/minutes.`,
            });
            return;
        }

        if (availableCourses.length === 0) {
            setNoticeModal({
                isOpen: true,
                message: "No approved courses found. You must have an approved course to log learning.",
            });
            return;
        }

        // Determine course_id from approved courses
        let resolvedCourseId = selectedCourseId;
        if (!resolvedCourseId) {
            const found = availableCourses.find(
                (c) => c.course_title.toLowerCase() === course.trim().toLowerCase()
            );
            if (found) {
                resolvedCourseId = found.course_id;
            } else {
                setNoticeModal({
                    isOpen: true,
                    message: "Please select an approved course from the list.",
                });
                return;
            }
        }

        const payload = {
            course_id: resolvedCourseId,
            course: course.trim(),
            video_learning_duration_min: videoDurationMin,
            practice_handson_min: practiceDurationMin,
            video_hours: vH,
            video_minutes: vM,
            practice_hours: pH,
            practice_minutes: pM,
            learning_description: normalizeSingleSpacing(description, { trimEdges: true }).slice(0, MAX_DESCRIPTION_LENGTH),
            video_learning_point: 20,
            practice_handson_point: 10,
            progress: projectedProgress
        };

        try {
            const { skipped } = await runWithLock(async (idemKey) => {
                const authToken = localStorage.getItem("lms_token");
                const activeEmpId = getActiveEmpId();

                const res = await axios.post(`${API_BASE_URL}/api/daily-learning`, {
                    ...payload,
                    employee_id: activeEmpId,
                }, {
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                        "X-Idempotency-Key": idemKey,
                    }
                });

                if (onSaveLog && res.data) {
                    onSaveLog(res.data);
                    // Update local course list progress for next submissions in this session
                    setCoursesList((prev) => prev.map((c) =>
                        c.course_id === resolvedCourseId
                            ? { ...c, current_progress: res.data.progress ?? projectedProgress }
                            : c
                    ));
                }
            });
            if (skipped) return;
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            if (err?.response?.status === 409) {
                setNoticeModal({
                    isOpen: true,
                    message: extractApiErrorMessage(err, "This learning log was already submitted."),
                });
                return;
            }
            console.error("Error saving daily learning log to database:", err);
            if (err.response?.data?.detail) {
                setNoticeModal({
                    isOpen: true,
                    message: err.response.data.detail,
                });
                return;
            }
            // Fallback optimistic log
            const now = new Date();
            const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]}`;
            const hours12 = now.getHours() % 12 || 12;
            const ampm = now.getHours() >= 12 ? "PM" : "AM";
            const formattedDuration = totM === 30
                ? (totH > 0 ? `${totH}.5h` : "0.5h")
                : (totH > 0 && totM > 0
                    ? `${totH}h ${totM}m`
                    : (totH > 0 ? `${totH}h` : `${totM}m`));

            const fallbackLog = {
                id: `log-${Date.now()}`,
                daily_learning_id: Date.now(),
                date: dateStr,
                time: timeStr,
                title: course.trim(),
                description: description.trim() || "Learning activity",
                duration: formattedDuration,
                videoHours: vH,
                videoMinutes: vM,
                practiceHours: pH,
                practiceMinutes: pM,
                total_points: autoPoints,
                progress: projectedProgress,
                course_duration: selectedCourseObj?.duration || "—"
            };
            if (onSaveLog) onSaveLog(fallbackLog);
        }

        // Reset form
        setCourse("");
        setSelectedCourseId(null);
        setVideoHours(0);
        setVideoMinutes(0);
        setPracticeHours(0);
        setPracticeMinutes(0);
        setDescription("");
        setDescriptionError("");
    };

    return (
        <section className="emp-learning-card emp-learning-form-card">
            <h2 className="emp-card-title">Log Today's Learning</h2>

            <form onSubmit={handleSubmit} className="emp-learning-form" noValidate>
                {/* Course Name */}
                <div className="emp-form-field">
                    <label htmlFor="course">Course / Activity <span>*</span></label>
                    <div className="emp-course-dropdown-container" ref={dropdownRef}>
                        <div className="emp-course-input-wrapper">
                            <input
                                id="course"
                                type="text"
                                value={course}
                                onChange={(event) => {
                                    setCourse(event.target.value);
                                    setSelectedCourseId(null);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                placeholder={coursesList.length === 0 ? "No approved courses available" : "Select or search approved course"}
                                required
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                className={`emp-course-dropdown-toggle-btn ${isDropdownOpen ? "open" : ""}`}
                                onClick={() => setIsDropdownOpen((prev) => !prev)}
                                aria-label="Toggle Course Library Dropdown"
                            >
                                <img src={downArrowIcon} alt="Select course" className="emp-course-dropdown-arrow" />
                            </button>
                        </div>

                        {isDropdownOpen && (
                            <div className="emp-course-dropdown-menu">
                                <div className="emp-course-dropdown-list">
                                    {filteredCourses.length > 0 ? (
                                        filteredCourses.map((cItem, idx) => (
                                            <button
                                                key={cItem.course_id || idx}
                                                type="button"
                                                className={`emp-course-dropdown-item ${course === cItem.course_title ? "active" : ""}`}
                                                onClick={() => handleSelectCourse(cItem)}
                                            >
                                                {cItem.course_title}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="emp-course-dropdown-empty">
                                            {coursesList.length === 0
                                                ? "No approved courses found for your account"
                                                : "No matching approved courses"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dual Duration Row (Video Learning + Practice & Hands-on) */}
                <div className="emp-dual-duration-row">
                    {/* Left: Video Learning Duration */}
                    <div className="emp-duration-block">
                        <label className="emp-duration-block-label">
                            Video Learning Duration <span className="emp-req-star">*</span>
                            <img
                                src={infoIcon}
                                alt="info"
                                className="emp-info-icon-img"
                                title={`Time spent watching course videos. Daily combined limit: 12h (Logged today: ${todayLoggedH}h ${todayLoggedM}m | Remaining: ${remDailyTotalH}h ${remDailyTotalM}m)`}
                            />
                        </label>
                        <div className="emp-duration-inputs-grid">
                            <div className="emp-time-subfield emp-hours-subfield">
                                <span className="emp-subfield-label">Hours</span>
                                <div className="emp-time-input-wrapper">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength="2"
                                        min="0"
                                        max={maxVideoHours}
                                        value={videoHours === 0 ? "0" : String(videoHours)}
                                        onChange={handleHoursChange(setVideoHours, maxVideoHours)}
                                        onKeyDown={handleKeyDownPreventInvalid}
                                        onFocus={(e) => e.target.select()}
                                        className={`emp-time-input-box${videoDurationExceedsCourse || combinedExceedsDaily ? " emp-input-error" : ""}`}
                                        title={selectedCourseObj ? `Max ${remainingLabel} based on remaining course duration, up to 12h daily total (${remDailyTotalH}h ${remDailyTotalM}m remaining today)` : `Daily combined limit: 12h (Remaining today: ${remDailyTotalH}h ${remDailyTotalM}m)`}
                                    />
                                    <div className="emp-up-down-controls">
                                        <button
                                            type="button"
                                            className="emp-up-down-btn emp-up-btn"
                                            onClick={() => setVideoHours((prev) => Math.min(maxVideoHours, (parseInt(prev) || 0) + 1))}
                                            tabIndex={-1}
                                        />
                                        <button
                                            type="button"
                                            className="emp-up-down-btn emp-down-btn"
                                            onClick={() => setVideoHours((prev) => Math.max(0, (parseInt(prev) || 0) - 1))}
                                            tabIndex={-1}
                                        />
                                        <img src={upDownIcon} alt="adjust" className="emp-up-down-icon-img" />
                                    </div>
                                </div>
                            </div>
                            <div className="emp-time-subfield emp-minutes-subfield">
                                <span className="emp-subfield-label">Minutes</span>
                                <div className="emp-minutes-input-wrapper">
                                    <div className="emp-time-input-wrapper">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength="2"
                                            min="0"
                                            max={maxVideoMinutes}
                                            value={videoMinutes === 0 ? "0" : String(videoMinutes)}
                                            onChange={handleMinutesChange(setVideoMinutes, maxVideoMinutes)}
                                            onKeyDown={handleKeyDownPreventInvalid}
                                            onFocus={(e) => e.target.select()}
                                            className={`emp-time-input-box${videoDurationExceedsCourse || combinedExceedsDaily ? " emp-input-error" : ""}`}
                                            title={`Daily combined limit: 12h (Remaining today: ${remDailyTotalH}h ${remDailyTotalM}m)`}
                                        />
                                        <div className="emp-up-down-controls">
                                            <button
                                                type="button"
                                                className="emp-up-down-btn emp-up-btn"
                                                onClick={() => setVideoMinutes((prev) => Math.min(maxVideoMinutes, (parseInt(prev) || 0) + 1))}
                                                tabIndex={-1}
                                            />
                                            <button
                                                type="button"
                                                className="emp-up-down-btn emp-down-btn"
                                                onClick={() => setVideoMinutes((prev) => Math.max(0, (parseInt(prev) || 0) - 1))}
                                                tabIndex={-1}
                                            />
                                            <img src={upDownIcon} alt="adjust" className="emp-up-down-icon-img" />
                                        </div>
                                    </div>
                                    <span className="emp-outside-suffix">min</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Blue Vertical Dashed Line Divider */}
                    <div className="emp-duration-divider-dashed"></div>

                    {/* Right: Practice & Hands-on Duration */}
                    <div className="emp-duration-block">
                        <label className="emp-duration-block-label">
                            Practice & Hands-on Duration <span className="emp-req-star">*</span>
                            <img
                                src={infoIcon}
                                alt="info"
                                className="emp-info-icon-img"
                                title={`Time spent doing exercises, labs, or coding. Daily combined limit: 12h (Logged today: ${todayLoggedH}h ${todayLoggedM}m | Remaining: ${remDailyTotalH}h ${remDailyTotalM}m)`}
                            />
                        </label>
                        <div className="emp-duration-inputs-grid">
                            <div className="emp-time-subfield emp-hours-subfield">
                                <span className="emp-subfield-label">Hours</span>
                                <div className="emp-time-input-wrapper">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength="2"
                                        min="0"
                                        max={maxPracticeHours}
                                        value={practiceHours === 0 ? "0" : String(practiceHours)}
                                        onChange={handleHoursChange(setPracticeHours, maxPracticeHours)}
                                        onKeyDown={handleKeyDownPreventInvalid}
                                        onFocus={(e) => e.target.select()}
                                        className={`emp-time-input-box${combinedExceedsDaily ? " emp-input-error" : ""}`}
                                        title={`Daily combined limit: 12h (Remaining today: ${remDailyTotalH}h ${remDailyTotalM}m)`}
                                    />
                                    <div className="emp-up-down-controls">
                                        <button
                                            type="button"
                                            className="emp-up-down-btn emp-up-btn"
                                            onClick={() => setPracticeHours((prev) => Math.min(maxPracticeHours, (parseInt(prev) || 0) + 1))}
                                            tabIndex={-1}
                                        />
                                        <button
                                            type="button"
                                            className="emp-up-down-btn emp-down-btn"
                                            onClick={() => setPracticeHours((prev) => Math.max(0, (parseInt(prev) || 0) - 1))}
                                            tabIndex={-1}
                                        />
                                        <img src={upDownIcon} alt="adjust" className="emp-up-down-icon-img" />
                                    </div>
                                </div>
                            </div>
                            <div className="emp-time-subfield emp-minutes-subfield">
                                <span className="emp-subfield-label">Minutes</span>
                                <div className="emp-minutes-input-wrapper">
                                    <div className="emp-time-input-wrapper">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength="2"
                                            min="0"
                                            max={maxPracticeMinutes}
                                            value={practiceMinutes === 0 ? "0" : String(practiceMinutes)}
                                            onChange={handleMinutesChange(setPracticeMinutes, maxPracticeMinutes)}
                                            onKeyDown={handleKeyDownPreventInvalid}
                                            onFocus={(e) => e.target.select()}
                                            className={`emp-time-input-box${combinedExceedsDaily ? " emp-input-error" : ""}`}
                                            title={`Daily combined limit: 12h (Remaining today: ${remDailyTotalH}h ${remDailyTotalM}m)`}
                                        />
                                        <div className="emp-up-down-controls">
                                            <button
                                                type="button"
                                                className="emp-up-down-btn emp-up-btn"
                                                onClick={() => setPracticeMinutes((prev) => Math.min(maxPracticeMinutes, (parseInt(prev) || 0) + 1))}
                                                tabIndex={-1}
                                            />
                                            <button
                                                type="button"
                                                className="emp-up-down-btn emp-down-btn"
                                                onClick={() => setPracticeMinutes((prev) => Math.max(0, (parseInt(prev) || 0) - 1))}
                                                tabIndex={-1}
                                            />
                                            <img src={upDownIcon} alt="adjust" className="emp-up-down-icon-img" />
                                        </div>
                                    </div>
                                    <span className="emp-outside-suffix">min</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Warning displayed cleanly with responsive wrapping */}
                {videoDurationExceedsCourse && (
                    <div className="emp-duration-warning-text">
                        <span className="emp-duration-warning-msg">
                            Exceeds remaining course time ({remainingLabel} left of {courseDurLabel}). Max: {remainingLabel}.
                        </span>
                    </div>
                )}
                {combinedExceedsDaily && (
                    <div className="emp-duration-warning-text">
                        <span className="emp-duration-warning-msg">
                            Combined duration exceeds daily limit of 12 hours ({remDailyTotalH}h {remDailyTotalM}m remaining today).
                        </span>
                    </div>
                )}

                {/* Total Duration Banner with Points Auto-Generation */}
                <div className="emp-total-duration-banner">
                    <img src={clockSvg} alt="Clock" className="emp-total-duration-clock-icon" />
                    <span className="emp-total-duration-main-text">Total Duration: {totalStr}</span>
                    <span className="emp-total-duration-sub-text">
                        (Video: {videoStr} + Practice & Hands-on: {practiceStr})
                    </span>
                    <span
                        className="emp-auto-points-badge"
                        style={{
                            marginLeft: "auto",
                            background: "#EFF6FF",
                            color: "#2563EB",
                            border: "1px solid #BFDBFE",
                            borderRadius: "16px",
                            padding: "3px 12px",
                            fontWeight: "600",
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                        }}
                        title={`Video: ${Math.round(videoPts)} pts + Practice: ${Math.round(practicePts)} pts`}
                    >
                        ⚡ {autoPoints} pts
                    </span>
                </div>

                {/* What did you learn */}
                <div className={`emp-form-field emp-textarea-field ${descriptionError ? "has-error" : ""}`}>
                    <label htmlFor="description">What did you learn? <span>*</span></label>
                    <div className="emp-textarea-wrapper">
                        <textarea
                            id="description"
                            className={descriptionError ? "emp-form-textarea-error" : ""}
                            value={description}
                            onChange={handleDescriptionChange}
                            onKeyDown={handleSingleSpaceKeyDown}
                            onPaste={handleDescriptionPaste}
                            onBlur={handleDescriptionBlur}
                            maxLength={MAX_DESCRIPTION_LENGTH}
                            placeholder="Describe your learning activity..."
                            style={{
                                fontSize: "12px",
                                fontWeight: "400",
                                borderColor: descriptionError ? "#EF4444" : undefined,
                                backgroundColor: descriptionError ? "#FFFDFD" : undefined,
                            }}
                        />
                        <span className="emp-char-count">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
                    </div>
                    {descriptionError && (
                        <span className="emp-form-error-text">
                            {descriptionError}
                        </span>
                    )}
                </div>

                <button
                    type="submit"
                    className="emp-save-learning-button"
                    disabled={isSubmitting}
                    style={isSubmitting ? { opacity: 0.7, cursor: "not-allowed" } : {}}
                >
                    {isSubmitting ? "Saving..." : "Save Learning Log"}
                </button>
            </form>

            <ValidationNoticeModal
                isOpen={noticeModal.isOpen}
                message={noticeModal.message}
                onClose={() => setNoticeModal({ isOpen: false, message: "" })}
            />
        </section>
    );
}
