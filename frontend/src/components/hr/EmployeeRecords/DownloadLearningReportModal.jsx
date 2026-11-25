import React, { useState, useRef, useEffect } from "react";
import calendarIcon from "../../../assets/reportsanalytics/calendar-copy.svg";
import downArrowIcon from "../../../assets/profile/downarrow.svg";
import downloadIcon from "../../../assets/reportsanalytics/download.svg";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchAllEmployees,
  fetchHREmployeeRecordsAnalytics,
  fetchReimbursementClaims,
  fetchCourseRequests,
  fetchCEOBudgetStats,
  recordHRActivity,
} from "../../../services/teamService";
import { exportToCSV, exportToExcel, exportToPDF } from "../../../utils/reportExportUtil";

// Build Department Performance Aggregates
function buildDepartmentSummary(employees = [], claims = []) {
  const map = {};
  employees.forEach((emp) => {
    const dept = emp.department || "Other";
    if (!map[dept]) {
      map[dept] = {
        department: dept,
        teamSize: 0,
        activeLearners: 0,
        hours: 0,
        coursesDone: 0,
        certs: 0,
        spend: 0,
      };
    }
    map[dept].teamSize += 1;
    if ((emp.learning_status || emp.learningStatus) === "Active") {
      map[dept].activeLearners += 1;
    }
    const hrs = typeof emp.hours === "string" ? parseFloat(emp.hours) || 0 : (emp.total_learning_hours || 0);
    map[dept].hours += hrs;
    map[dept].coursesDone += (emp.courses ?? emp.courses_count ?? 0);
    map[dept].certs += (emp.certificates ?? emp.certificates_count ?? emp.certifications ?? 0);
  });

  claims.forEach((c) => {
    const dept = c.department || "Other";
    if (!map[dept]) {
      map[dept] = {
        department: dept,
        teamSize: 0,
        activeLearners: 0,
        hours: 0,
        coursesDone: 0,
        certs: 0,
        spend: 0,
      };
    }
    if (c.status === "Approved" || c.processing_status === "Paid") {
      map[dept].spend += (parseFloat(c.amount) || 0);
    }
  });

  return Object.values(map).sort((a, b) => b.teamSize - a.teamSize);
}

// Build Financials Aggregates
function buildFinancials(claims = [], courseReqs = [], budgetStats = null) {
  const approvedClaims = claims.filter((c) => c.status === "Approved" || c.processing_status === "Paid");
  const pendingClaims = claims.filter((c) => c.status === "Pending" || !c.status);
  const rejectedClaims = claims.filter((c) => c.status === "Rejected");

  const approvedCertSpend = approvedClaims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const pendingCertAmount = pendingClaims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  const purchasedCourses = courseReqs.filter((r) => r.purchase_status === "Purchased" || r.ceo_status === "Approved");
  const purchasedCourseSpend = purchasedCourses.reduce((sum, r) => sum + (parseFloat(r.estimated_cost ?? r.price) || 0), 0);

  const totalSpent = approvedCertSpend + purchasedCourseSpend;
  const totalInvestment = budgetStats?.total_investment_formatted || `₹ ${(totalSpent ? totalSpent * 2.5 : 1500000).toLocaleString("en-IN")}`;

  return {
    totalInvestment,
    totalSpentFormatted: `₹ ${totalSpent.toLocaleString("en-IN")}`,
    totalSpent,
    pendingAmountFormatted: `₹ ${pendingCertAmount.toLocaleString("en-IN")}`,
    approvedClaimsCount: approvedClaims.length,
    pendingClaimsCount: pendingClaims.length,
    rejectedClaimsCount: rejectedClaims.length,
    courseRequestsCount: courseReqs.length,
    coursePurchasedCount: purchasedCourses.length,
    courseSpendFormatted: budgetStats?.course_spend_formatted || `₹ ${purchasedCourseSpend.toLocaleString("en-IN")}`,
    certificationSpendFormatted: budgetStats?.certification_spend_formatted || `₹ ${approvedCertSpend.toLocaleString("en-IN")}`,
  };
}

export default function DownloadLearningReportModal({
  isOpen,
  onClose,
  onDownloadSuccess,
  employees: propEmployees,
  overviewData: propOverviewData,
}) {
  const { token } = useAuth();
  const [dateRange, setDateRange] = useState("This Month");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("PDF");
  const [isDownloading, setIsDownloading] = useState(false);
  const [includes, setIncludes] = useState({
    courseProgress: true,
    learningHours: true,
    certificates: true,
    departmentSummary: true,
    reimbursements: true,
    courseRequests: true,
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
    try {
      setIsDownloading(true);

      let emps = propEmployees;
      if (!emps || !emps.length) {
        emps = await fetchAllEmployees(token);
      }

      let overview = propOverviewData;
      if (!overview) {
        const res = await fetchHREmployeeRecordsAnalytics(token);
        overview = res?.overview || {};
      }

      // Fetch financial & reimbursement data if requested
      let claims = [];
      let courseRequests = [];
      let budgetStats = null;

      const promises = [];
      if (includes.reimbursements || includes.departmentSummary) {
        promises.push(
          fetchReimbursementClaims(token)
            .then((data) => { claims = data || []; })
            .catch((err) => console.warn("Failed to fetch claims:", err))
        );
        promises.push(
          fetchCEOBudgetStats(token)
            .then((data) => { budgetStats = data; })
            .catch((err) => console.warn("Failed to fetch budget stats:", err))
        );
      }
      if (includes.courseRequests) {
        promises.push(
          fetchCourseRequests(token)
            .then((data) => { courseRequests = data || []; })
            .catch((err) => console.warn("Failed to fetch course requests:", err))
        );
      }
      if (promises.length) {
        await Promise.all(promises);
      }

      const financials = buildFinancials(claims, courseRequests, budgetStats);
      const departmentSummary = buildDepartmentSummary(emps, claims);

      const reportPayload = {
        title: "Overall Employee Learning & Financial Report",
        dateRange,
        overview: {
          totalEmployees: emps.length,
          activeLearners:
            overview?.active_learners ??
            emps.filter(
              (e) => (e.learning_status || e.learningStatus) === "Active"
            ).length,
          learningHours: overview?.avg_learning_hours ?? overview?.learning_hours ?? "0h",
          avgLearningHours: overview?.avg_learning_hours ?? overview?.learning_hours ?? "0h",
          totalLearningHours: overview?.total_learning_hours ?? overview?.learning_hours ?? "0h",
          certificatesEarned:
            overview?.certificates_earned ??
            emps.reduce(
              (acc, e) =>
                acc + (e.certificates ?? e.certificates_count ?? 0),
              0
            ),
        },
        financials,
        departmentSummary,
        reimbursementClaims: claims,
        courseRequests,
        employees: emps,
        includes,
      };

      if (exportFormat === "CSV") {
        exportToCSV(reportPayload);
      } else if (exportFormat === "Excel") {
        exportToExcel(reportPayload);
      } else {
        exportToPDF(reportPayload);
      }

      // Record activity into dbo.lms_hr_activity_feed
      try {
        await recordHRActivity(
          {
            activity_type: "REPORT_GENERATED",
            message: "Monthly learning report generated",
          },
          token
        );
      } catch (logErr) {
        console.warn("[DownloadLearningReportModal] Failed to log activity:", logErr);
      }

      onClose();
      onDownloadSuccess?.();
    } catch (err) {
      console.error("[DownloadLearningReportModal] Export failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="hr-modal-overlay">
      <div className="hr-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          className="hr-modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <img src={closeIcon} alt="Close" width={10} height={10} />
        </button>

        {/* Header */}
        <div className="hr-modal-header">
          <h2 className="hr-modal-title">Download Learning Report</h2>
          <p className="hr-modal-subtitle">
            Choose the report sections, format, and date range for export.
          </p>
        </div>

        {/* Date Range Dropdown */}
        <div className="hr-form-group">
          <label className="hr-form-label">Date Range</label>
          <div className="hr-custom-dropdown-container" ref={dropdownRef}>
            <button
              type="button"
              className={`hr-custom-dropdown-trigger ${isDropdownOpen ? "active" : ""}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="hr-dropdown-trigger-left">
                <img src={calendarIcon} alt="Calendar" className="hr-select-icon" />
                <span className="hr-selected-value-text">{dateRange}</span>
              </div>
              <img
                src={downArrowIcon}
                alt="Down"
                className={`hr-dropdown-chevron ${isDropdownOpen ? "open" : ""}`}
              />
            </button>

            {isDropdownOpen && (
              <div className="hr-custom-dropdown-menu">
                {dateOptions.map((opt) => (
                  <div
                    key={opt}
                    className={`hr-custom-dropdown-item ${dateRange === opt ? "selected" : ""}`}
                    onClick={() => {
                      setDateRange(opt);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <span>{opt}</span>
                    {dateRange === opt && <span className="hr-item-check">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Export Format Radio Group */}
        <div className="hr-form-group">
          <label className="hr-form-label">Export Format</label>
          <div className="hr-radio-group">
            {["PDF", "Excel", "CSV"].map((fmt) => (
              <label key={fmt} className="hr-radio-label">
                <input
                  type="radio"
                  name="hrExportFormat"
                  value={fmt}
                  checked={exportFormat === fmt}
                  onChange={() => setExportFormat(fmt)}
                  className="hr-radio-input"
                />
                <span>{fmt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Include Checkbox Group */}
        <div className="hr-form-group">
          <label className="hr-form-label">Include</label>
          <div className="hr-checkbox-grid">
            <label className="hr-checkbox-label">
              <input
                type="checkbox"
                checked={includes.courseProgress}
                onChange={() => handleCheckboxChange("courseProgress")}
                className="hr-checkbox-input"
              />
              <span>Course Progress</span>
            </label>

            <label className="hr-checkbox-label">
              <input
                type="checkbox"
                checked={includes.learningHours}
                onChange={() => handleCheckboxChange("learningHours")}
                className="hr-checkbox-input"
              />
              <span>Learning Hours</span>
            </label>

            <label className="hr-checkbox-label">
              <input
                type="checkbox"
                checked={includes.certificates}
                onChange={() => handleCheckboxChange("certificates")}
                className="hr-checkbox-input"
              />
              <span>Certificates</span>
            </label>

            <label className="hr-checkbox-label">
              <input
                type="checkbox"
                checked={includes.departmentSummary}
                onChange={() => handleCheckboxChange("departmentSummary")}
                className="hr-checkbox-input"
              />
              <span>Department Summary</span>
            </label>

            <label className="hr-checkbox-label">
              <input
                type="checkbox"
                checked={includes.reimbursements}
                onChange={() => handleCheckboxChange("reimbursements")}
                className="hr-checkbox-input"
              />
              <span>Reimbursement Claims & Spend</span>
            </label>

            <label className="hr-checkbox-label">
              <input
                type="checkbox"
                checked={includes.courseRequests}
                onChange={() => handleCheckboxChange("courseRequests")}
                className="hr-checkbox-input"
              />
              <span>Course Request History</span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="hr-modal-actions">
          <button type="button" className="hr-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="hr-btn-download-action"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <img src={downloadIcon} alt="Download" className="hr-action-btn-icon" />
            <span>{isDownloading ? "Generating..." : "Download"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
