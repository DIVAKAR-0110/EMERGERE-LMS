import React from "react";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import greentickIcon from "../../../assets/Leaderboard/greentick.svg";
import "../../../styles/employee/DownloadReportModal.css";

const DownloadSuccessModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="emp-custom-modal-overlay">
            <div className="emp-custom-modal emp-success-modal emp-download-success-modal" onClick={(e) => e.stopPropagation()}>
                {/* CLOSE BUTTON */}
                <button
                    type="button"
                    className="emp-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="close-icon" width={12} height={12} />
                </button>

                {/* GREEN CIRCLE CHECK ICON (53x53) */}
                <div className="emp-success-icon-wrapper">
                    <img
                        src={greentickIcon}
                        alt="Success"
                        className="emp-success-icon-img"
                        width={53}
                        height={53}
                    />
                </div>

                {/* SUCCESS MESSAGE (267x50) */}
                <h2 className="emp-success-modal-title">
                    Report Downloaded
                    <br />
                    Successfully!
                </h2>
            </div>
        </div>
    );
};

export default DownloadSuccessModal;
