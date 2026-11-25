import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import calendarIcon from "../../../assets/reportsanalytics/calendar-copy.svg";
import downArrowIcon from "../../../assets/Profile/downarrow.svg";
import downloadIcon from "../../../assets/reportsanalytics/download.svg";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import "../../../styles/reportingmanager/DownloadReportModal.css";

export default function DownloadReportModal({
    isOpen,
    onClose,
    onDownload,
    onDownloadSuccess,
}) {
    const [dateRange, setDateRange] = useState("This Month");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState("PDF");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [includes, setIncludes] = useState({
        learningHours: true,
        courseProgress: true,
        certifications: true,
        leaderboardRankings: true,
    });

    const dropdownRef = useRef(null);

    const dateOptions = [
        "This Month",
        "Last Month",
        "Last 3 Months",
        "Last 6 Months",
        "This Year",
        "All Time",
    ];

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
        setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDownload = async () => {
        const payload = { dateRange, exportFormat, includes };
        if (onDownload) {
            try {
                setIsSubmitting(true);
                await onDownload(payload);
                onClose();
                onDownloadSuccess?.(payload);
            } catch (err) {
                console.error("Download failed:", err);
            } finally {
                setIsSubmitting(false);
            }
        } else {
            onClose();
            onDownloadSuccess?.(payload);
        }
    };

    const modalContent = (
        <div className="rm-modal-overlay">
            <div className="rm-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="rm-modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="Close" width={10} height={10} />
                </button>

                {/* Header */}
                <div className="rm-modal-header">
                    <h2 className="rm-modal-title">Download Learning Report</h2>
                    <p className="rm-modal-subtitle">
                        Choose the report type, format, and date range for export.
                    </p>
                </div>

                {/* Date Range Dropdown */}
                <div className="rm-form-group">
                    <label className="rm-form-label">Date Range</label>
                    <div className="rm-custom-dropdown-container" ref={dropdownRef}>
                        <button
                            type="button"
                            className={`rm-custom-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <div className="rm-dropdown-trigger-left">
                                <img src={calendarIcon} alt="Calendar" className="rm-select-icon" />
                                <span className="rm-selected-value-text">{dateRange}</span>
                            </div>
                            <img
                                src={downArrowIcon}
                                alt="Down"
                                className={`rm-dropdown-chevron ${isDropdownOpen ? "open" : ""}`}
                            />
                        </button>

                        {isDropdownOpen && (
                            <div className="rm-custom-dropdown-menu">
                                {dateOptions.map((opt) => (
                                    <div
                                        key={opt}
                                        className={`rm-custom-dropdown-item ${dateRange === opt ? "selected" : ""}`}
                                        onClick={() => {
                                            setDateRange(opt);
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        <span>{opt}</span>
                                        {dateRange === opt && <span className="rm-item-check">✓</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Export Format Radio Group */}
                <div className="rm-form-group">
                    <label className="rm-form-label">Export Format</label>
                    <div className="rm-radio-group">
                        {["PDF", "Excel", "CSV"].map((fmt) => (
                            <label key={fmt} className="rm-radio-label">
                                <input
                                    type="radio"
                                    name="rmExportFormat"
                                    value={fmt}
                                    checked={exportFormat === fmt}
                                    onChange={() => setExportFormat(fmt)}
                                    className="rm-radio-input"
                                />
                                <span>{fmt}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Include Checkbox Group */}
                <div className="rm-form-group">
                    <label className="rm-form-label">Include</label>
                    <div className="rm-checkbox-group">
                        <label className="rm-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.learningHours}
                                onChange={() => handleCheckboxChange("learningHours")}
                                className="rm-checkbox-input"
                            />
                            <span>Learning Hours</span>
                        </label>

                        <label className="rm-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.courseProgress}
                                onChange={() => handleCheckboxChange("courseProgress")}
                                className="rm-checkbox-input"
                            />
                            <span>Course Progress</span>
                        </label>

                        <label className="rm-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.certifications}
                                onChange={() => handleCheckboxChange("certifications")}
                                className="rm-checkbox-input"
                            />
                            <span>Certifications</span>
                        </label>

                        <label className="rm-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.leaderboardRankings}
                                onChange={() => handleCheckboxChange("leaderboardRankings")}
                                className="rm-checkbox-input"
                            />
                            <span>Leaderboard Rankings</span>
                        </label>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="rm-modal-actions">
                    <button type="button" className="rm-btn-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="rm-btn-download-action"
                        onClick={handleDownload}
                        disabled={isSubmitting}
                        style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}
                    >
                        <img src={downloadIcon} alt="Download" className="rm-action-btn-icon" />
                        <span>{isSubmitting ? "Generating Report..." : "Download"}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return typeof document !== "undefined"
        ? createPortal(modalContent, document.body)
        : modalContent;
}
