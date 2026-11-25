import React from "react";
import docIcon from "../../../assets/reportsanalytics/doc.svg";
import downloadIcon from "../../../assets/reportsanalytics/download.svg";
import downArrowIcon from "../../../assets/reportsanalytics/downarrow.svg";

export default function OverallLearningReportBanner({
  onOpenDownload,
}) {
  return (
    <div className="hr-report-banner">
      <div className="hr-report-banner-left">
        <div className="hr-report-banner-icon-wrapper">
          <img src={docIcon} alt="Report Document" className="hr-report-banner-icon" />
        </div>
        <div className="hr-report-banner-text">
          <h2 className="hr-report-banner-title">Overall Employee Learning Report</h2>
          <p className="hr-report-banner-subtitle">
            View organization-wide learning insights, progress, and trends across all teams and departments.
          </p>
        </div>
      </div>

      <div className="hr-report-banner-actions">

        <button
          type="button"
          className="hr-btn-download-report"
          onClick={onOpenDownload}
        >
          <img src={downloadIcon} alt="Download" className="hr-btn-action-icon" />
          <span>Download Report</span>
          <img src={downArrowIcon} alt="Options" className="hr-btn-chevron-icon" />
        </button>
      </div>
    </div>
  );
}
