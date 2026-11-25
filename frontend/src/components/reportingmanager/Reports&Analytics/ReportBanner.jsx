import React from "react";
import docIcon from "../../../assets/reportsanalytics/doc.svg";
import downloadIcon from "../../../assets/reportsanalytics/download.svg";
import downarrowIcon from "../../../assets/reportsanalytics/downarrow.svg";
import eyeIcon from "../../../assets/reportsanalytics/eye.svg";

export default function ReportBanner({ onViewReport, onOpenDownloadModal }) {
    return (
        <div className="rm-ra-report-banner">
            <div className="rm-ra-banner-left">
                {/* Ellipse 891 (70px x 70px #F1F2F8 Circle) */}
                <div className="rm-ra-banner-icon-box">
                    <img
                        src={docIcon}
                        alt="Document Report"
                        className="rm-ra-banner-doc-icon"
                    />
                </div>
                <div className="rm-ra-banner-text">
                    <h2 className="rm-ra-banner-title">Overall Employee Learning Report</h2>
                    <p className="rm-ra-banner-subtitle">
                        View organization-wide learning insights, progress, and trends across all teams and departments.
                    </p>
                </div>
            </div>

            <div className="rm-ra-banner-actions">

                <button
                    type="button"
                    className="rm-ra-btn-download-report"
                    onClick={onOpenDownloadModal}
                >
                    <img src={downloadIcon} alt="Download" className="rm-ra-btn-dl-icon" />
                    <span>Download Report</span>
                    <img src={downarrowIcon} alt="Open Dropdown" className="rm-ra-btn-arrow-icon" />
                </button>
            </div>
        </div>
    );
}
