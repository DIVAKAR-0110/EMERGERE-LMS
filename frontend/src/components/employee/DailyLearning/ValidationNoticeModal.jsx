import React from "react";
import { createPortal } from "react-dom";
import closeIcon from "../../../assets/course_library/close.svg";
import alertIcon from "../../../assets/alert_icon.svg";
import "../../../styles/employee/ValidationNoticeModal.css";

export default function ValidationNoticeModal({
    isOpen,
    onClose,
    message = "Please check the entered values.",
}) {
    if (!isOpen) return null;

    return createPortal(
        <div className="emp-notice-modal-overlay">
            <div className="emp-notice-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="emp-notice-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="Close" width={12} height={12} />
                </button>

                {/* Circular Status/Alert Icon */}
                <div className="emp-notice-icon-wrap">
                    <img
                        src={alertIcon}
                        alt="Alert"
                        width={53}
                        height={53}
                    />
                </div>

                {/* Message Content */}
                <div className="emp-notice-message-wrap">
                    <p className="emp-notice-message-text">
                        {message}
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
}
