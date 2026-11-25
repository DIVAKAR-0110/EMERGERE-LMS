import React from "react";
import docIcon from "../../../assets/Leaderboard/doc.svg";
import eyeIcon from "../../../assets/Leaderboard/eye.svg";
import downloadIcon from "../../../assets/Leaderboard/download.svg";

const LearningReportBanner = ({ onViewReport, onDownloadReport }) => {
    return (
        <div className="emp-learning-report-banner">
            {/* LEFT SIDE: ICON + TITLES */}
            <div className="emp-report-banner-left">
                <div className="emp-report-banner-icon-box">
                    <img src={docIcon} alt="Report Doc" className="emp-report-doc-img" width={26} height={33} />
                </div>
                <div className="emp-report-banner-text">
                    <h3 className="emp-report-banner-title">Overall Employee Learning Report</h3>
                    <p className="emp-report-banner-subtitle">
                        View organization-wide learning insights, progress, and trends across all teams and departments.
                    </p>
                </div>
            </div>

            {/* RIGHT SIDE: VIEW REPORT & DOWNLOAD REPORT BUTTONS */}
            <div className="emp-report-banner-actions">
                <button
                    type="button"
                    className="emp-btn-download-report"
                    onClick={onDownloadReport}
                >
                    <img src={downloadIcon} alt="Download" className="emp-btn-download-icon" width={19} height={19} />
                    <span>Download Report</span>
                    <svg width="11" height="6" viewBox="0 0 11 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="emp-btn-arrow-down">
                        <path fillRule="evenodd" clipRule="evenodd" d="M4.88898 5.76144L0 1.15212L1.22203 0L5.5 4.03325L9.77797 0L11 1.15212L6.11102 5.76144C5.94895 5.91419 5.72916 6 5.5 6C5.27084 6 5.05105 5.91419 4.88898 5.76144Z" fill="white" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default LearningReportBanner;
