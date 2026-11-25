import React, { useState, useRef, useEffect } from "react";
import { X, Download, Calendar, ChevronDown, CheckCircle2, Check } from "lucide-react";

const DATE_RANGE_OPTIONS = [
    "This Month",
    "Last Month",
    "This Quarter",
    "This Financial Year (2026)",
    "All Time"
];

export default function BudgetAuditExportModal({
    isOpen,
    onClose,
    title = "Download Learning Report",
    subtitle = "Choose the report type, format, and date range for export.",
    coursePurchases = [],
    certClaims = [],
    workshops = [],
    departments = []
}) {
    const [dateRange, setDateRange] = useState("This Month");
    const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
    const dateRangeDropdownRef = useRef(null);
    const [exportFormat, setExportFormat] = useState("pdf"); // 'pdf' | 'excel' | 'csv'
    const [includeStreams, setIncludeStreams] = useState({
        courses: true,
        certifications: true,
        workshops: true,
        departments: true,
    });
    const [isExporting, setIsExporting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const handleOutsideClick = (e) => {
            if (dateRangeDropdownRef.current && !dateRangeDropdownRef.current.contains(e.target)) {
                setIsDateRangeOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setIsDateRangeOpen(false);
            }
        };
        if (isDateRangeOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, isDateRangeOpen]);

    const handleToggleStream = (key) => {
        setIncludeStreams((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const allStreamsSelected =
        includeStreams.courses &&
        includeStreams.certifications &&
        includeStreams.workshops &&
        includeStreams.departments;

    const handleToggleSelectAll = () => {
        const targetVal = !allStreamsSelected;
        setIncludeStreams({
            courses: targetVal,
            certifications: targetVal,
            workshops: targetVal,
            departments: targetVal,
        });
    };

    const handleClose = () => {
        setIsSuccess(false);
        setIsExporting(false);
        setIsDateRangeOpen(false);
        onClose();
    };

    const handleDownload = () => {
        setIsExporting(true);

        setTimeout(() => {
            // Build report content
            if (exportFormat === "csv" || exportFormat === "excel") {
                let csvRows = [];
                csvRows.push(["Emergere LMS Enterprise Budget & Spend Analytics Report"]);
                csvRows.push([`Generated on: ${new Date().toLocaleString("en-IN")}`]);
                csvRows.push([`Date Range: ${dateRange}`]);
                csvRows.push([""]);

                if (includeStreams.courses && coursePurchases.length > 0) {
                    csvRows.push(["--- STREAM 1: INDIVIDUAL COURSE PURCHASE HISTORY ---"]);
                    csvRows.push(["Transaction Code", "Request Code", "Timestamp", "Course Title", "Provider", "Learner", "Emp ID", "Department", "Unit Price", "Status"]);
                    coursePurchases.forEach((c) => {
                        csvRows.push([
                            c.transaction_code,
                            c.request_code,
                            c.timestamp,
                            `"${(c.course_name || "").replace(/"/g, '""')}"`,
                            c.provider,
                            `"${c.learner_name || ""}"`,
                            c.employee_id,
                            c.department,
                            c.price,
                            c.status
                        ]);
                    });
                    csvRows.push([""]);
                }

                if (includeStreams.certifications && certClaims.length > 0) {
                    csvRows.push(["--- STREAM 2: CERTIFICATION REIMBURSEMENT CLAIMS ---"]);
                    csvRows.push(["Claim Code", "Disbursement Time", "Employee", "Emp ID", "Department", "Certification", "Issuing Body", "Verification ID", "Amount", "Status"]);
                    certClaims.forEach((cl) => {
                        csvRows.push([
                            cl.claim_code,
                            cl.payment_time,
                            `"${(cl.employee_name || "").replace(/"/g, '""')}"`,
                            cl.employee_id,
                            cl.department,
                            `"${(cl.cert_title || "").replace(/"/g, '""')}"`,
                            cl.issuing_body,
                            cl.verification_id,
                            cl.claim_amount,
                            cl.status
                        ]);
                    });
                    csvRows.push([""]);
                }

                if (includeStreams.workshops && workshops.length > 0) {
                    csvRows.push(["--- STREAM 3: WORKSHOPS & TRAINING ---"]);
                    csvRows.push(["Event Code", "Department", "Event Title", "Event Type", "Dates", "Participants", "Amount", "Cost/Attendee", "Lead Trainer"]);
                    workshops.forEach((w) => {
                        csvRows.push([
                            w.event_code,
                            `"${(w.department || "").replace(/"/g, '""')}"`,
                            `"${(w.event_name || "").replace(/"/g, '""')}"`,
                            w.event_type,
                            `"${w.dates_formatted || ""}"`,
                            w.participants_count,
                            w.actual_spent,
                            `"${w.cost_per_participant || ""}"`,
                            `"${w.trainer || ""}"`
                        ]);
                    });
                    csvRows.push([""]);
                }

                if (includeStreams.departments && departments.length > 0) {
                    csvRows.push(["--- DEPARTMENTAL BUDGET ALLOCATIONS & CONSUMPTION ---"]);
                    csvRows.push(["Department", "Annual Budget", "YTD Spent", "Remaining Balance", "Utilization %", "Learners Count", "Status"]);
                    departments.forEach((d) => {
                        csvRows.push([
                            `"${d.department || ""}"`,
                            d.annual_budget,
                            d.ytd_spent,
                            d.remaining_balance,
                            `${d.utilization_pct}%`,
                            d.learners_count,
                            d.status
                        ]);
                    });
                }

                const csvString = csvRows.map((e) => e.join(",")).join("\n");
                const mimeType = exportFormat === "excel" ? "application/vnd.ms-excel;charset=utf-8;" : "text/csv;charset=utf-8;";
                const ext = exportFormat === "excel" ? "xls" : "csv";
                const blob = new Blob([csvString], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `Emergere_LMS_Report_${new Date().toISOString().slice(0, 10)}.${ext}`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (exportFormat === "pdf") {
                window.print();
            }

            setIsExporting(false);
            setIsSuccess(true);

            // Auto close after 2.5 seconds
            setTimeout(() => {
                setIsSuccess(false);
                onClose();
            }, 2500);
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <div className="budget-modal-overlay">
            {isSuccess ? (
                /* Success View Matching User Reference Image 2 */
                <div
                    className="budget-export-success-container"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="budget-export-close-btn"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                    <div className="budget-export-success-body">
                        <div className="budget-export-success-icon-wrap">
                            <CheckCircle2 size={80} color="#10B981" strokeWidth={2.4} />
                        </div>
                        <h2 className="budget-export-success-title">Report Downloaded Successfully!</h2>
                    </div>
                </div>
            ) : (
                /* Form View Matching User Reference Image 1 */
                <div
                    className="budget-export-modal-container"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="budget-export-modal-header">
                        <div>
                            <h2 className="budget-export-modal-title">{title}</h2>
                            <p className="budget-export-modal-subtitle">{subtitle}</p>
                        </div>
                        <button
                            type="button"
                            className="budget-export-close-btn"
                            onClick={handleClose}
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="budget-export-modal-body">
                        {/* 1. Date Range Dropdown */}
                        <div className="budget-export-field-section">
                            <label className="budget-export-section-label">Date Range</label>
                            <div className="budget-export-select-wrap" ref={dateRangeDropdownRef}>
                                <button
                                    type="button"
                                    className={`budget-export-select-trigger ${isDateRangeOpen ? "open" : ""}`}
                                    onClick={() => setIsDateRangeOpen((prev) => !prev)}
                                    aria-haspopup="listbox"
                                    aria-expanded={isDateRangeOpen}
                                >
                                    <div className="budget-export-trigger-left">
                                        <Calendar size={18} className="budget-export-cal-icon" />
                                        <span className="budget-export-selected-value">{dateRange}</span>
                                    </div>
                                    <ChevronDown size={18} className={`budget-export-chevron-icon ${isDateRangeOpen ? "rotated" : ""}`} />
                                </button>

                                {isDateRangeOpen && (
                                    <div className="budget-export-dropdown-menu" role="listbox">
                                        {DATE_RANGE_OPTIONS.map((opt) => {
                                            const isSelected = dateRange === opt;
                                            return (
                                                <div
                                                    key={opt}
                                                    role="option"
                                                    aria-selected={isSelected}
                                                    className={`budget-export-dropdown-item ${isSelected ? "selected" : ""}`}
                                                    onClick={() => {
                                                        setDateRange(opt);
                                                        setIsDateRangeOpen(false);
                                                    }}
                                                >
                                                    <span className="budget-export-item-text">{opt}</span>
                                                    {isSelected && <Check size={16} className="budget-export-item-check" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Export Format Radio Group */}
                        <div className="budget-export-field-section">
                            <label className="budget-export-section-label">Export Format</label>
                            <div className="budget-export-radio-group">
                                <label className="budget-export-radio-item">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="pdf"
                                        checked={exportFormat === "pdf"}
                                        onChange={() => setExportFormat("pdf")}
                                        className="budget-export-radio-input"
                                    />
                                    <span>PDF</span>
                                </label>
                                <label className="budget-export-radio-item">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="excel"
                                        checked={exportFormat === "excel"}
                                        onChange={() => setExportFormat("excel")}
                                        className="budget-export-radio-input"
                                    />
                                    <span>Excel</span>
                                </label>
                                <label className="budget-export-radio-item">
                                    <input
                                        type="radio"
                                        name="exportFormat"
                                        value="csv"
                                        checked={exportFormat === "csv"}
                                        onChange={() => setExportFormat("csv")}
                                        className="budget-export-radio-input"
                                    />
                                    <span>CSV</span>
                                </label>
                            </div>
                        </div>

                        {/* 3. Include Checkboxes */}
                        <div className="budget-export-field-section">
                            <div className="budget-export-checkbox-header-row">
                                <label className="budget-export-section-label">Include</label>
                                <button
                                    type="button"
                                    className="budget-export-select-all-btn"
                                    onClick={handleToggleSelectAll}
                                >
                                    {allStreamsSelected ? "Deselect All" : "Select All"}
                                </button>
                            </div>
                            <div className="budget-export-checkbox-list">
                                <label className="budget-export-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={includeStreams.courses}
                                        onChange={() => handleToggleStream("courses")}
                                        className="budget-export-checkbox-input"
                                    />
                                    <span>Course Purchases</span>
                                </label>
                                <label className="budget-export-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={includeStreams.certifications}
                                        onChange={() => handleToggleStream("certifications")}
                                        className="budget-export-checkbox-input"
                                    />
                                    <span>Certification Claims</span>
                                </label>
                                <label className="budget-export-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={includeStreams.workshops}
                                        onChange={() => handleToggleStream("workshops")}
                                        className="budget-export-checkbox-input"
                                    />
                                    <span>Workshops & Training</span>
                                </label>
                                <label className="budget-export-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={includeStreams.departments}
                                        onChange={() => handleToggleStream("departments")}
                                        className="budget-export-checkbox-input"
                                    />
                                    <span>Department Allocations</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="budget-export-modal-footer">
                        <button
                            type="button"
                            className="budget-export-cancel-btn"
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="budget-export-download-btn"
                            onClick={handleDownload}
                            disabled={isExporting}
                        >
                            <Download size={16} />
                            <span>{isExporting ? "Downloading..." : "Download"}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
