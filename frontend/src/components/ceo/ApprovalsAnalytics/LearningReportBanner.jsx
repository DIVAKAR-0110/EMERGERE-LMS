import React from "react";
import docIcon from "../../../assets/Leaderboard/doc.svg";
import downloadIcon from "../../../assets/Leaderboard/download.svg";

export default function LearningReportBanner({ onDownloadReport }) {
    return (
        <div className="ceo-report-banner">
            {/* Left side: Icon + Title & Subtitle */}
            <div className="ceo-report-banner-left">
                <div className="ceo-report-banner-icon-box">
                    <img
                        src={docIcon}
                        alt="Report"
                        className="ceo-report-doc-img"
                        width={20}
                        height={24}
                    />
                </div>
                <div className="ceo-report-banner-text">
                    <h3 className="ceo-report-banner-title">Overall Employee Learning Report</h3>
                    <p className="ceo-report-banner-subtitle">
                        View organization-wide learning insights, progress, and trends across all teams and departments.
                    </p>
                </div>
            </div>

            {/* Right side: View Report & Download Report buttons */}
            <div className="ceo-report-banner-actions">

                <button
                    type="button"
                    className="ceo-btn-download-report"
                    onClick={onDownloadReport}
                >
                    <img
                        src={downloadIcon}
                        alt=""
                        width={15}
                        height={15}
                        style={{ display: "block" }}
                    />
                    <span>Download Report</span>
                    <svg
                        width="10"
                        height="6"
                        viewBox="0 0 10 6"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="ceo-btn-arrow-down"
                    >
                        <path
                            d="M1 1L5 5L9 1"
                            stroke="white"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
