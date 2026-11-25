import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import closeIcon from "../../../assets/course_library/close.svg";
import infoIcon from "../../../assets/Daily_Learning_Log/info.svg";
import upDownIcon from "../../../assets/Daily_Learning_Log/up_down.svg";
import downArrowIcon from "../../../assets/Daily_Learning_Log/down_arrow.svg";
import { Clock } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
} from "../../../utils/validationUtils";
import AlertDialog from "../../common/AlertDialog";

import "../../../styles/employee/EditLearningLogModal.css";

const MAX_DESCRIPTION_LENGTH = 250;

export default function EditLearningLogModal({ isOpen, onClose, logData, onSave }) {
    const { user, currentUser } = useAuth?.() || {};
    const activeUser = user || currentUser;

    const [coursesList, setCoursesList] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const [course, setCourse] = useState("");
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [videoHours, setVideoHours] = useState(0);
    const [videoMinutes, setVideoMinutes] = useState(0);
    const [practiceHours, setPracticeHours] = useState(0);
    const [practiceMinutes, setPracticeMinutes] = useState(0);
    const [description, setDescription] = useState("");

    const [courseError, setCourseError] = useState("");
    const [durationError, setDurationError] = useState("");
    const [descriptionError, setDescriptionError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: "", message: "", type: "error" });

    const getActiveEmpId = () => {
        if (logData?.employee_id) return logData.employee_id;
        if (logData?.emp_id) return logData.emp_id;
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

    const [isUserTyping, setIsUserTyping] = useState(false);

    // Fetch approved courses for employee to populate dropdown
    useEffect(() => {
        let isMounted = true;
        const fetchCourses = async () => {
            try {
                const authToken = localStorage.getItem("lms_token");
                const activeEmpId = getActiveEmpId();
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
                const res = await axios.get(`${API_BASE_URL}/api/daily-learning/my-courses`, {
                    params: { employee_id: activeEmpId },
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    }
                });
                if (isMounted && Array.isArray(res.data)) {
                    let list = [...res.data];
                    const currentTitle = (logData?.title || logData?.course || "").trim();
                    if (currentTitle && !list.some(c => (c.course_title || c.course_name || "").toLowerCase() === currentTitle.toLowerCase())) {
                        list.unshift({
                            course_id: logData?.course_id || null,
                            course_title: currentTitle,
                            status: "In Progress"
                        });
                    }
                    setCoursesList(list);
                }
            } catch (e) {
                console.warn("[EditLearningLogModal] Could not fetch courses:", e);
            }
        };
        if (isOpen) {
            fetchCourses();
        }
        return () => { isMounted = false; };
    }, [isOpen, logData, activeUser]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Load initial values from logData
    useEffect(() => {
        if (logData) {
            setCourse(logData.title || logData.course || "");
            setSelectedCourseId(logData.course_id || null);
            setIsUserTyping(false);
            setDescription(logData.description || "");
            setCourseError("");
            setDurationError("");
            setDescriptionError("");

            // Parse video durations
            if (logData.videoHours !== undefined) {
                setVideoHours(logData.videoHours);
                setVideoMinutes(logData.videoMinutes || 0);
            } else if (logData.video_learning_duration_min !== undefined) {
                setVideoHours(Math.floor(logData.video_learning_duration_min / 60));
                setVideoMinutes(logData.video_learning_duration_min % 60);
            } else {
                setVideoHours(0);
                setVideoMinutes(0);
            }

            // Parse practice durations
            if (logData.practiceHours !== undefined) {
                setPracticeHours(logData.practiceHours);
                setPracticeMinutes(logData.practiceMinutes || 0);
            } else if (logData.practice_handson_min !== undefined) {
                setPracticeHours(Math.floor(logData.practice_handson_min / 60));
                setPracticeMinutes(logData.practice_handson_min % 60);
            } else {
                setPracticeHours(0);
                setPracticeMinutes(0);
            }
        }
    }, [logData]);

    if (!isOpen) return null;

    // Numerical durations
    const vH = Math.max(0, parseInt(videoHours, 10) || 0);
    const vM = Math.max(0, parseInt(videoMinutes, 10) || 0);
    const pH = Math.max(0, parseInt(practiceHours, 10) || 0);
    const pM = Math.max(0, parseInt(practiceMinutes, 10) || 0);

    const videoDurationMin = vH * 60 + vM;
    const practiceDurationMin = pH * 60 + pM;
    const totalMinutes = videoDurationMin + practiceDurationMin;
    const totH = Math.floor(totalMinutes / 60);
    const totM = totalMinutes % 60;

    // Mathematical points algorithm: (video min / 3) + (practice min / 6)
    const autoPoints = Math.round((videoDurationMin * 20) / 60.0 + (practiceDurationMin * 10) / 60.0);

    const handleSelectCourse = (selectedItem) => {
        if (typeof selectedItem === "object" && selectedItem !== null) {
            setCourse(selectedItem.course_title || selectedItem.course_name || "");
            setSelectedCourseId(selectedItem.course_id || selectedItem.id);
        } else {
            setCourse(selectedItem);
            const found = coursesList.find(
                (c) => (c.course_title || c.course_name || "").toLowerCase() === String(selectedItem).toLowerCase()
            );
            if (found) setSelectedCourseId(found.course_id || found.id);
        }
        setIsUserTyping(false);
        setIsDropdownOpen(false);
        if (courseError) setCourseError("");
    };

    const filteredCourses = coursesList.filter((item) => {
        if (!isUserTyping) return true;
        if (!course.trim()) return true;
        if (coursesList.some((c) => (c.course_title || c.course_name || "").toLowerCase() === course.trim().toLowerCase())) {
            return true;
        }
        const title = (item.course_title || item.course_name || "").toLowerCase();
        return title.includes(course.trim().toLowerCase());
    });

    const makeTimeChangeHandler = (setter, maxVal) => (e) => {
        const raw = e.target.value;
        if (raw === "") {
            setter(0);
            if (durationError) setDurationError("");
            return;
        }
        const digits = raw.replace(/[^0-9]/g, "").slice(0, 2);
        if (digits === "") {
            setter(0);
            return;
        }
        const val = parseInt(digits, 10);
        if (isNaN(val)) {
            setter(0);
            return;
        }
        setter(Math.min(maxVal, Math.max(0, val)));
        if (durationError) setDurationError("");
    };

    const handleKeyDownPreventInvalid = (e) => {
        const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
        if (allowedKeys.includes(e.key)) return;
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    };

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

    const handleSubmit = async (e) => {
        e.preventDefault();

        let hasError = false;
        if (!course.trim()) {
            setCourseError("Please select or enter a course name");
            hasError = true;
        }
        if (totalMinutes <= 0) {
            setDurationError("Please enter a valid duration greater than 0 minutes");
            hasError = true;
        } else if (totalMinutes > 12 * 60) {
            setDurationError("Total learning duration cannot exceed 12 hours per day");
            hasError = true;
        }
        const cleanDesc = normalizeSingleSpacing(description, { trimEdges: true }).slice(0, MAX_DESCRIPTION_LENGTH);
        if (!cleanDesc) {
            setDescriptionError("This field is required");
            hasError = true;
        }

        if (hasError) return;

        const formattedDuration = totM === 30
            ? (totH > 0 ? `${totH}.5h` : "0.5h")
            : (totH > 0 && totM > 0
                ? `${totH}h ${totM}m`
                : (totH > 0 ? `${totH}h` : `${totM}m`));

        const updatedData = {
            ...logData,
            course_id: selectedCourseId,
            title: course.trim(),
            course: course.trim(),
            video_learning_duration_min: videoDurationMin,
            practice_handson_min: practiceDurationMin,
            videoHours: vH,
            videoMinutes: vM,
            practiceHours: pH,
            practiceMinutes: pM,
            duration: formattedDuration,
            description: cleanDesc,
            total_points: autoPoints,
        };

        try {
            setIsSaving(true);
            if (onSave) {
                await onSave(updatedData);
            }
            onClose();
        } catch (err) {
            console.error("[EditLearningLogModal] Error saving:", err);
            const msg = err.response?.data?.detail || "Failed to update learning log. Please try again.";
            setAlertDialog({
                isOpen: true,
                title: "Update Failed",
                message: typeof msg === "string" ? msg : JSON.stringify(msg),
                type: "error",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="emp-edit-modal-backdrop">
            <div
                className="emp-edit-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="emp-edit-modal-header">
                    <div>
                        <h2 className="emp-edit-modal-title">Edit Learning Log</h2>
                        <p className="emp-edit-modal-subtitle">
                            Modify learning outcomes and key takeaways for this session.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="emp-edit-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <img src={closeIcon} alt="Close" className="emp-edit-modal-close-icon" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="emp-edit-modal-form" noValidate>
                    {/* Course / Activity (Editable with Dropdown) */}
                    <div className="emp-edit-modal-field">
                        <label htmlFor="edit-course" className="emp-edit-modal-label">
                            Course / Activity <span className="emp-edit-modal-star">*</span>
                        </label>
                        <div className="emp-edit-modal-course-dropdown" ref={dropdownRef}>
                            <div className="emp-edit-modal-course-input-wrap">
                                <input
                                    id="edit-course"
                                    type="text"
                                    value={course}
                                    onChange={(event) => {
                                        setCourse(event.target.value);
                                        setSelectedCourseId(null);
                                        setIsUserTyping(true);
                                        setIsDropdownOpen(true);
                                        if (courseError) setCourseError("");
                                    }}
                                    onFocus={() => {
                                        setIsUserTyping(false);
                                        setIsDropdownOpen(true);
                                    }}
                                    onClick={() => {
                                        setIsUserTyping(false);
                                        setIsDropdownOpen(true);
                                    }}
                                    placeholder={coursesList.length === 0 ? "Select or enter course" : "Select or search in-progress course"}
                                    autoComplete="off"
                                    className="emp-edit-modal-course-input"
                                    style={{
                                        borderColor: courseError ? "#EF4444" : undefined,
                                        backgroundColor: courseError ? "#FFFDFD" : undefined,
                                    }}
                                />
                                <button
                                    type="button"
                                    className={`emp-edit-modal-dropdown-toggle ${isDropdownOpen ? "open" : ""}`}
                                    onClick={() => {
                                        setIsUserTyping(false);
                                        setIsDropdownOpen((prev) => !prev);
                                    }}
                                    aria-label="Toggle Course Dropdown"
                                >
                                    <img src={downArrowIcon} alt="Select course" className="emp-edit-modal-dropdown-arrow" />
                                </button>
                            </div>

                            {isDropdownOpen && (
                                <div className="emp-edit-modal-dropdown-menu">
                                    <div className="emp-edit-modal-dropdown-list">
                                        {filteredCourses.length > 0 ? (
                                            filteredCourses.map((cItem, idx) => (
                                                <button
                                                    key={cItem.course_id || idx}
                                                    type="button"
                                                    className={`emp-edit-modal-dropdown-item ${course === cItem.course_title ? "active" : ""}`}
                                                    onClick={() => handleSelectCourse(cItem)}
                                                >
                                                    {cItem.course_title}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="emp-edit-modal-dropdown-empty">
                                                No matching courses
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {courseError && (
                            <span className="emp-edit-modal-error-text">
                                {courseError}
                            </span>
                        )}
                    </div>

                    {/* Dual Duration Row (Video Learning + Practice & Hands-on) - Editable */}
                    <div className="emp-edit-modal-duration-row">
                        {/* Left: Video Learning Duration */}
                        <div className="emp-edit-modal-duration-block">
                            <label className="emp-edit-modal-duration-label">
                                Video Learning Duration <span className="emp-edit-modal-star">*</span>
                                <img src={infoIcon} alt="info" className="emp-edit-modal-info-icon" title="Time spent watching course videos. Daily combined limit: 12h." />
                            </label>
                            <div className="emp-edit-modal-duration-grid">
                                <div className="emp-edit-modal-time-subfield">
                                    <span className="emp-edit-modal-time-label">Hours</span>
                                    <div className="emp-edit-modal-time-input-wrap">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength="2"
                                            value={videoHours === 0 ? "0" : String(videoHours)}
                                            onChange={makeTimeChangeHandler(setVideoHours, 12)}
                                            onKeyDown={handleKeyDownPreventInvalid}
                                            onFocus={(e) => e.target.select()}
                                            className="emp-edit-modal-time-input"
                                        />
                                        <div className="emp-edit-modal-updown-controls">
                                            <button
                                                type="button"
                                                className="emp-edit-modal-updown-btn up"
                                                onClick={() => {
                                                    setVideoHours((prev) => Math.min(12, (parseInt(prev, 10) || 0) + 1));
                                                    if (durationError) setDurationError("");
                                                }}
                                                tabIndex={-1}
                                            />
                                            <button
                                                type="button"
                                                className="emp-edit-modal-updown-btn down"
                                                onClick={() => {
                                                    setVideoHours((prev) => Math.max(0, (parseInt(prev, 10) || 0) - 1));
                                                    if (durationError) setDurationError("");
                                                }}
                                                tabIndex={-1}
                                            />
                                            <img src={upDownIcon} alt="adjust" className="emp-edit-modal-updown-icon" />
                                        </div>
                                    </div>
                                </div>
                                <div className="emp-edit-modal-time-subfield">
                                    <span className="emp-edit-modal-time-label">Minutes</span>
                                    <div className="emp-edit-modal-minutes-wrap">
                                        <div className="emp-edit-modal-time-input-wrap">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength="2"
                                                value={videoMinutes === 0 ? "0" : String(videoMinutes)}
                                                onChange={makeTimeChangeHandler(setVideoMinutes, 59)}
                                                onKeyDown={handleKeyDownPreventInvalid}
                                                onFocus={(e) => e.target.select()}
                                                className="emp-edit-modal-time-input"
                                            />
                                            <div className="emp-edit-modal-updown-controls">
                                                <button
                                                    type="button"
                                                    className="emp-edit-modal-updown-btn up"
                                                    onClick={() => {
                                                        setVideoMinutes((prev) => Math.min(59, (parseInt(prev, 10) || 0) + 1));
                                                        if (durationError) setDurationError("");
                                                    }}
                                                    tabIndex={-1}
                                                />
                                                <button
                                                    type="button"
                                                    className="emp-edit-modal-updown-btn down"
                                                    onClick={() => {
                                                        setVideoMinutes((prev) => Math.max(0, (parseInt(prev, 10) || 0) - 1));
                                                        if (durationError) setDurationError("");
                                                    }}
                                                    tabIndex={-1}
                                                />
                                                <img src={upDownIcon} alt="adjust" className="emp-edit-modal-updown-icon" />
                                            </div>
                                        </div>
                                        <span className="emp-edit-modal-outside-suffix">min</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Blue Vertical Dashed Line Divider */}
                        <div className="emp-edit-modal-divider"></div>

                        {/* Right: Practice & Hands-on Duration */}
                        <div className="emp-edit-modal-duration-block">
                            <label className="emp-edit-modal-duration-label">
                                Practice & Hands-on Duration <span className="emp-edit-modal-star">*</span>
                                <img src={infoIcon} alt="info" className="emp-edit-modal-info-icon" title="Time spent doing exercises, labs, or coding. Daily combined limit: 12h." />
                            </label>
                            <div className="emp-edit-modal-duration-grid">
                                <div className="emp-edit-modal-time-subfield">
                                    <span className="emp-edit-modal-time-label">Hours</span>
                                    <div className="emp-edit-modal-time-input-wrap">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength="2"
                                            value={practiceHours === 0 ? "0" : String(practiceHours)}
                                            onChange={makeTimeChangeHandler(setPracticeHours, 12)}
                                            onKeyDown={handleKeyDownPreventInvalid}
                                            onFocus={(e) => e.target.select()}
                                            className="emp-edit-modal-time-input"
                                        />
                                        <div className="emp-edit-modal-updown-controls">
                                            <button
                                                type="button"
                                                className="emp-edit-modal-updown-btn up"
                                                onClick={() => {
                                                    setPracticeHours((prev) => Math.min(12, (parseInt(prev, 10) || 0) + 1));
                                                    if (durationError) setDurationError("");
                                                }}
                                                tabIndex={-1}
                                            />
                                            <button
                                                type="button"
                                                className="emp-edit-modal-updown-btn down"
                                                onClick={() => {
                                                    setPracticeHours((prev) => Math.max(0, (parseInt(prev, 10) || 0) - 1));
                                                    if (durationError) setDurationError("");
                                                }}
                                                tabIndex={-1}
                                            />
                                            <img src={upDownIcon} alt="adjust" className="emp-edit-modal-updown-icon" />
                                        </div>
                                    </div>
                                </div>
                                <div className="emp-edit-modal-time-subfield">
                                    <span className="emp-edit-modal-time-label">Minutes</span>
                                    <div className="emp-edit-modal-minutes-wrap">
                                        <div className="emp-edit-modal-time-input-wrap">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength="2"
                                                value={practiceMinutes === 0 ? "0" : String(practiceMinutes)}
                                                onChange={makeTimeChangeHandler(setPracticeMinutes, 59)}
                                                onKeyDown={handleKeyDownPreventInvalid}
                                                onFocus={(e) => e.target.select()}
                                                className="emp-edit-modal-time-input"
                                            />
                                            <div className="emp-edit-modal-updown-controls">
                                                <button
                                                    type="button"
                                                    className="emp-edit-modal-updown-btn up"
                                                    onClick={() => {
                                                        setPracticeMinutes((prev) => Math.min(59, (parseInt(prev, 10) || 0) + 1));
                                                        if (durationError) setDurationError("");
                                                    }}
                                                    tabIndex={-1}
                                                />
                                                <button
                                                    type="button"
                                                    className="emp-edit-modal-updown-btn down"
                                                    onClick={() => {
                                                        setPracticeMinutes((prev) => Math.max(0, (parseInt(prev, 10) || 0) - 1));
                                                        if (durationError) setDurationError("");
                                                    }}
                                                    tabIndex={-1}
                                                />
                                                <img src={upDownIcon} alt="adjust" className="emp-edit-modal-updown-icon" />
                                            </div>
                                        </div>
                                        <span className="emp-edit-modal-outside-suffix">min</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Duration Banner with Live Recalculation */}
                    <div className="emp-edit-modal-banner">
                        <div className="emp-edit-modal-banner-left">
                            <Clock size={16} className="emp-edit-modal-banner-clock" />
                            <span className="emp-edit-modal-banner-main">Total Duration: {totalStr}</span>
                            <span className="emp-edit-modal-banner-sub">
                                (Video: {videoStr} + Practice: {practiceStr})
                            </span>
                        </div>
                        <div className="emp-edit-modal-points-badge">
                            ⚡ {autoPoints} pts
                        </div>
                    </div>

                    {durationError && (
                        <span className="emp-edit-modal-error-text" style={{ marginTop: "-4px" }}>
                            {durationError}
                        </span>
                    )}

                    {/* What did you learn (Editable Field) */}
                    <div className="emp-edit-modal-textarea-field">
                        <label htmlFor="edit-description" className="emp-edit-modal-label">
                            What did you learn? <span className="emp-edit-modal-star">*</span>
                        </label>
                        <div className="emp-edit-modal-textarea-wrap">
                            <textarea
                                id="edit-description"
                                className={`emp-edit-modal-textarea ${descriptionError ? "has-error" : ""}`}
                                value={description}
                                onChange={handleDescriptionChange}
                                onKeyDown={handleSingleSpaceKeyDown}
                                onPaste={handleDescriptionPaste}
                                onBlur={handleDescriptionBlur}
                                maxLength={MAX_DESCRIPTION_LENGTH}
                                placeholder="Describe your learning activity and takeaways..."
                                rows={4}
                            />
                            <span className="emp-edit-modal-char-counter">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
                        </div>
                        {descriptionError && (
                            <span className="emp-edit-modal-error-text">
                                {descriptionError}
                            </span>
                        )}
                    </div>

                    {/* Modal Footer / Save Button */}
                    <div className="emp-edit-modal-footer">
                        <button type="submit" className="emp-edit-modal-save-btn" disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>

            {alertDialog.isOpen && (
                <AlertDialog
                    isOpen={alertDialog.isOpen}
                    onClose={() => setAlertDialog((prev) => ({ ...prev, isOpen: false }))}
                    title={alertDialog.title || "Alert"}
                    message={alertDialog.message}
                    type={alertDialog.type || "error"}
                />
            )}
        </div>,
        document.body
    );
}
