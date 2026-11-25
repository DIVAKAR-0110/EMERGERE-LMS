import React, { useEffect } from "react";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import greentickIcon from "../../../assets/Leaderboard/greentick.svg";

export default function DownloadSuccessModal({ isOpen, onClose }) {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose?.();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="rm-ra-modal-overlay">
            <div className="rm-ra-success-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="rm-ra-modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="close-icon" width={16} height={16} />
                </button>

                {/* Big Green Check Circle */}
                <div className="rm-ra-success-icon-circle">
                    <img
                        src={greentickIcon}
                        alt="Success"
                        className="rm-ra-success-icon-img"
                        width={53}
                        height={53}
                    />
                </div>

                {/* Title */}
                <h3 className="rm-ra-success-title">
                    Report Downloaded
                    <br />
                    Successfully!
                </h3>
            </div>
        </div>
    );
}
