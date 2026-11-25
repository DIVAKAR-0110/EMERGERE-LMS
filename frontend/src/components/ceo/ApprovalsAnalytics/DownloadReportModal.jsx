import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import calendarIcon from "../../../assets/reportsanalytics/calendar-copy.svg";
import downArrowIcon from "../../../assets/profile/downarrow.svg";
import downloadIcon from "../../../assets/reportsanalytics/download.svg";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import "../../../styles/ceo/DownloadReportModal.css";

export default function DownloadReportModal({
    isOpen,
    onClose,
    onDownload,
    onDownloadSuccess,
}) {
    const [dateRange, setDateRange] = useState("This Year");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState("PDF");
    const [isDownloading, setIsDownloading] = useState(false);
    const [includes, setIncludes] = useState({
        learningHours: true,
        courseProgress: true,
        certifications: true,
        budgetSpend: true,
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

    const handleConfirmDownload = async () => {
        setIsDownloading(true);
        try {
            await onDownload?.({ dateRange, format: exportFormat, includes });
            onDownloadSuccess?.();
        } catch (e) {
            console.error("Download error:", e);
        } finally {
            setIsDownloading(false);
        }
    };

    const modalContent = (
        <div className="ceo-modal-overlay">
            <div className="ceo-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="ceo-modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="Close" width={10} height={10} />
                </button>

                {/* Header */}
                <div className="ceo-modal-header">
                    <h2 className="ceo-modal-title">Download Learning Report</h2>
                    <p className="ceo-modal-subtitle">
                        Choose the report type, format, and date range for export.
                    </p>
                </div>

                {/* Date Range Dropdown */}
                <div className="ceo-form-group">
                    <label className="ceo-form-label">Date Range</label>
                    <div className="ceo-custom-dropdown-container" ref={dropdownRef}>
                        <button
                            type="button"
                            className={`ceo-custom-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <div className="ceo-dropdown-trigger-left">
                                <img src={calendarIcon} alt="Calendar" className="ceo-select-icon" />
                                <span className="ceo-selected-value-text">{dateRange}</span>
                            </div>
                            <img
                                src={downArrowIcon}
                                alt="Down"
                                className={`ceo-dropdown-chevron ${isDropdownOpen ? "open" : ""}`}
                            />
                        </button>

                        {isDropdownOpen && (
                            <div className="ceo-custom-dropdown-menu">
                                {dateOptions.map((opt) => (
                                    <div
                                        key={opt}
                                        className={`ceo-custom-dropdown-item ${dateRange === opt ? "selected" : ""}`}
                                        onClick={() => {
                                            setDateRange(opt);
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        <span>{opt}</span>
                                        {dateRange === opt && <span className="ceo-item-check">✓</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Export Format Radio Group */}
                <div className="ceo-form-group">
                    <label className="ceo-form-label">Export Format</label>
                    <div className="ceo-radio-group">
                        {["PDF", "Excel", "CSV"].map((fmt) => (
                            <label key={fmt} className="ceo-radio-label">
                                <input
                                    type="radio"
                                    name="ceoExportFormat"
                                    value={fmt}
                                    checked={exportFormat === fmt}
                                    onChange={() => setExportFormat(fmt)}
                                    className="ceo-radio-input"
                                />
                                <span>{fmt}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Include Checkbox Group */}
                <div className="ceo-form-group">
                    <label className="ceo-form-label">Include</label>
                    <div className="ceo-checkbox-group">
                        <label className="ceo-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.learningHours}
                                onChange={() => handleCheckboxChange("learningHours")}
                                className="ceo-checkbox-input"
                            />
                            <span>Learning Hours per Employee</span>
                        </label>

                        <label className="ceo-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.courseProgress}
                                onChange={() => handleCheckboxChange("courseProgress")}
                                className="ceo-checkbox-input"
                            />
                            <span>Course Approval Requests</span>
                        </label>

                        <label className="ceo-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.certifications}
                                onChange={() => handleCheckboxChange("certifications")}
                                className="ceo-checkbox-input"
                            />
                            <span>Certification Approval Requests</span>
                        </label>

                        <label className="ceo-checkbox-label">
                            <input
                                type="checkbox"
                                checked={includes.budgetSpend}
                                onChange={() => handleCheckboxChange("budgetSpend")}
                                className="ceo-checkbox-input"
                            />
                            <span>Department Budgets & Spend</span>
                        </label>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="ceo-modal-actions">
                    <button type="button" className="ceo-btn-cancel" onClick={onClose} disabled={isDownloading}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="ceo-btn-download-action"
                        onClick={handleConfirmDownload}
                        disabled={isDownloading}
                        style={isDownloading ? { opacity: 0.7, cursor: "not-allowed" } : {}}
                    >
                        <img src={downloadIcon} alt="Download" className="ceo-action-btn-icon" />
                        <span>{isDownloading ? "Downloading..." : "Download"}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return typeof document !== "undefined"
        ? createPortal(modalContent, document.body)
        : modalContent;
}
