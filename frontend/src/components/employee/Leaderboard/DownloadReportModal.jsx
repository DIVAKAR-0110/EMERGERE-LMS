import React, { useState, useRef, useEffect, useMemo } from "react";
import calendarIcon from "../../../assets/reportsanalytics/calendar-copy.svg";
import downArrowIcon from "../../../assets/Profile/downarrow.svg";
import downloadIcon from "../../../assets/reportsanalytics/download.svg";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import { downloadEmployeeLearningReport } from "../../../services/leaderboardService";
import "../../../styles/employee/DownloadReportModal.css";

export default function DownloadLearningReportModal({
    isOpen,
    onClose,
    onDownload,
    onDownloadSuccess,
    timeFilter = "All Time",
}) {
    const isDateRangeDisabled = timeFilter === "This Week" || timeFilter === "This Month";

    const dateOptions = useMemo(() => {
        if (timeFilter === "This Week") {
            return ["This Week"];
        }
        if (timeFilter === "This Month") {
            return ["This Month"];
        }
        return [
            "Last 3 Months",
            "Last 6 Months",
            "This Year",
            "All Time",
        ];
    }, [timeFilter]);

    const [dateRange, setDateRange] = useState(() => {
        if (timeFilter === "This Week") return "This Week";
        if (timeFilter === "This Month") return "This Month";
        return "All Time";
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState("PDF");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (isOpen) {
            if (timeFilter === "This Week") {
                setDateRange("This Week");
            } else if (timeFilter === "This Month") {
                setDateRange("This Month");
            } else {
                setDateRange("All Time");
            }
            setIsDropdownOpen(false);
        }
    }, [isOpen, timeFilter]);

    const [includes, setIncludes] = useState({
        profileSummary: true,
        courseEnrollments: true,
        completedCourses: true,
        inProgressCourses: true,
        assignedCourses: true,
        certifications: true,
        reimbursementClaims: true,
        dailyLearningLog: true,
        leaderboardRankings: true,
        // Legacy keys for compatibility:
        learningHours: true,
        courseProgress: true,
    });

    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
        }
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [isDropdownOpen]);

    if (!isOpen) return null;

    const handleCheckboxChange = (key) => {
        setIncludes((prev) => {
            const nextVal = !prev[key];
            const updated = { ...prev, [key]: nextVal };

            // When toggling courseEnrollments master checkbox
            if (key === "courseEnrollments") {
                updated.completedCourses = nextVal;
                updated.inProgressCourses = nextVal;
                updated.assignedCourses = nextVal;
                updated.courseProgress = nextVal;
            }

            // If toggling a course sub-item, ensure master checkbox reflects state
            if (["completedCourses", "inProgressCourses", "assignedCourses"].includes(key)) {
                const anySubChecked =
                    (key === "completedCourses" ? nextVal : prev.completedCourses) ||
                    (key === "inProgressCourses" ? nextVal : prev.inProgressCourses) ||
                    (key === "assignedCourses" ? nextVal : prev.assignedCourses);
                updated.courseEnrollments = anySubChecked;
                updated.courseProgress = anySubChecked;
            }

            if (key === "dailyLearningLog") {
                updated.learningHours = nextVal;
            }

            return updated;
        });
    };

    // Toggle Select All / Deselect All
    const allSelected =
        includes.profileSummary &&
        includes.courseEnrollments &&
        includes.certifications &&
        includes.reimbursementClaims &&
        includes.dailyLearningLog &&
        includes.leaderboardRankings;

    const handleToggleSelectAll = () => {
        const targetVal = !allSelected;
        setIncludes({
            profileSummary: targetVal,
            courseEnrollments: targetVal,
            completedCourses: targetVal,
            inProgressCourses: targetVal,
            assignedCourses: targetVal,
            certifications: targetVal,
            reimbursementClaims: targetVal,
            dailyLearningLog: targetVal,
            leaderboardRankings: targetVal,
            learningHours: targetVal,
            courseProgress: targetVal,
        });
    };

    const handleDownload = async () => {
        const payload = {
            dateRange,
            exportFormat,
            includes: {
                ...includes,
                learningHours: includes.dailyLearningLog,
                courseProgress: includes.courseEnrollments,
            },
        };

        try {
            setIsSubmitting(true);
            setErrorMessage("");
            if (onDownload) {
                await onDownload(payload);
            } else {
                await downloadEmployeeLearningReport(payload);
            }
            onClose();
            onDownloadSuccess?.(payload);
        } catch (err) {
            console.error("Employee report download failed:", err);
            setErrorMessage("Failed to generate report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="emp-modal-overlay">
            <div className="emp-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Fixed Header */}
                <div className="emp-modal-header">
                    <button
                        type="button"
                        className="emp-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close modal"
                        disabled={isSubmitting}
                    >
                        <img src={closeIcon} alt="Close" width={10} height={10} />
                    </button>
                    <h2 className="emp-modal-title">Download Learning Report</h2>
                    <p className="emp-modal-subtitle">
                        Choose the report type, format, and date range for export.
                    </p>
                </div>

                {/* Scrollable Body */}
                <div className="emp-modal-scroll-body">
                    {/* Date Range Dropdown */}
                    <div className="emp-form-group">
                        <label className="emp-form-label">Date Range</label>
                        <div className="emp-custom-dropdown-container" ref={dropdownRef}>
                            <button
                                type="button"
                                className={`emp-custom-dropdown-trigger ${isDropdownOpen ? "active" : ""} ${isDateRangeDisabled ? "disabled" : ""}`}
                                onClick={() => {
                                    if (!isDateRangeDisabled && !isSubmitting) {
                                        setIsDropdownOpen(!isDropdownOpen);
                                    }
                                }}
                                disabled={isDateRangeDisabled || isSubmitting}
                            >
                                <div className="emp-dropdown-trigger-left">
                                    <img src={calendarIcon} alt="Calendar" className="emp-select-icon" />
                                    <span className="emp-selected-value-text">{dateRange}</span>
                                </div>
                                <img
                                    src={downArrowIcon}
                                    alt="Down"
                                    className={`emp-dropdown-chevron ${isDropdownOpen ? "open" : ""} ${isDateRangeDisabled ? "disabled" : ""}`}
                                />
                            </button>

                            {isDropdownOpen && (
                                <div className="emp-custom-dropdown-menu">
                                    {dateOptions.map((opt) => (
                                        <div
                                            key={opt}
                                            className={`emp-custom-dropdown-item ${dateRange === opt ? "selected" : ""}`}
                                            onClick={() => {
                                                setDateRange(opt);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            <span>{opt}</span>
                                            {dateRange === opt && <span className="emp-item-check">✓</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Export Format Radio Group */}
                    <div className="emp-form-group">
                        <label className="emp-form-label">Export Format</label>
                        <div className="emp-radio-group">
                            {["PDF", "Excel", "CSV"].map((fmt) => (
                                <label key={fmt} className="emp-radio-label">
                                    <input
                                        type="radio"
                                        name="empExportFormat"
                                        value={fmt}
                                        checked={exportFormat === fmt}
                                        onChange={() => setExportFormat(fmt)}
                                        className="emp-radio-input"
                                        disabled={isSubmitting}
                                    />
                                    <span>{fmt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Include Checkbox Group */}
                    <div className="emp-form-group">
                        <div className="emp-checkbox-header-row">
                            <label className="emp-form-label">Include</label>
                            <button
                                type="button"
                                className="emp-select-all-btn"
                                onClick={handleToggleSelectAll}
                                disabled={isSubmitting}
                            >
                                {allSelected ? "Deselect All" : "Select All"}
                            </button>
                        </div>

                        <div className="emp-checkbox-group">
                            {/* 1. Employee Profile Summary */}
                            <label className="emp-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includes.profileSummary}
                                    onChange={() => handleCheckboxChange("profileSummary")}
                                    className="emp-checkbox-input"
                                    disabled={isSubmitting}
                                />
                                <span>Employee Profile Summary</span>
                            </label>

                            {/* 2. Course Enrollments (with Sub-options) */}
                            <label className="emp-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includes.courseEnrollments}
                                    onChange={() => handleCheckboxChange("courseEnrollments")}
                                    className="emp-checkbox-input"
                                    disabled={isSubmitting}
                                />
                                <span>Course Enrollments</span>
                            </label>

                            {includes.courseEnrollments && (
                                <div className="emp-checkbox-subgroup">
                                    <label className="emp-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={includes.completedCourses}
                                            onChange={() => handleCheckboxChange("completedCourses")}
                                            className="emp-checkbox-input"
                                            disabled={isSubmitting}
                                        />
                                        <span>Completed Courses</span>
                                    </label>
                                    <label className="emp-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={includes.inProgressCourses}
                                            onChange={() => handleCheckboxChange("inProgressCourses")}
                                            className="emp-checkbox-input"
                                            disabled={isSubmitting}
                                        />
                                        <span>In Progress</span>
                                    </label>
                                    <label className="emp-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={includes.assignedCourses}
                                            onChange={() => handleCheckboxChange("assignedCourses")}
                                            className="emp-checkbox-input"
                                            disabled={isSubmitting}
                                        />
                                        <span>Assigned / Not Started</span>
                                    </label>
                                </div>
                            )}

                            {/* 3. Certifications & Certificates */}
                            <label className="emp-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includes.certifications}
                                    onChange={() => handleCheckboxChange("certifications")}
                                    className="emp-checkbox-input"
                                    disabled={isSubmitting}
                                />
                                <span>Certifications & Certificates</span>
                            </label>

                            {/* 4. Reimbursement Claims */}
                            <label className="emp-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includes.reimbursementClaims}
                                    onChange={() => handleCheckboxChange("reimbursementClaims")}
                                    className="emp-checkbox-input"
                                    disabled={isSubmitting}
                                />
                                <span>Reimbursement Claims</span>
                            </label>

                            {/* 5. Daily Learning Log */}
                            <label className="emp-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includes.dailyLearningLog}
                                    onChange={() => handleCheckboxChange("dailyLearningLog")}
                                    className="emp-checkbox-input"
                                    disabled={isSubmitting}
                                />
                                <span>Daily Learning Log & Notes</span>
                            </label>

                            {/* 6. Leaderboard & Rankings */}
                            <label className="emp-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includes.leaderboardRankings}
                                    onChange={() => handleCheckboxChange("leaderboardRankings")}
                                    className="emp-checkbox-input"
                                    disabled={isSubmitting}
                                />
                                <span>Leaderboard & Rankings</span>
                            </label>
                        </div>

                        {errorMessage && (
                            <p className="emp-download-error-msg">{errorMessage}</p>
                        )}
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="emp-modal-actions">
                    <button
                        type="button"
                        className="emp-btn-cancel"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="emp-btn-download-action"
                        onClick={handleDownload}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="emp-spinner" />
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <img src={downloadIcon} alt="Download" className="emp-action-btn-icon" />
                                <span>Download</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
