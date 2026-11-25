import React from "react";
import { createPortal } from "react-dom";
import closeIcon from "../../../assets/course_library/close.svg";
import alertIcon from "../../../assets/alert_icon.svg";

export default function ApprovalNoticeModal({
    isOpen,
    onClose,
    message = "Cannot approve: Maximum of 4 members already reached.",
}) {
    if (!isOpen) return null;

    return createPortal(
        <div className="ld-cm-notice-modal-overlay">
            <div className="ld-cm-notice-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="ld-cm-notice-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="Close" width={12} height={12} />
                </button>

                {/* Circular Success/Status Icon */}
                <div className="ld-cm-notice-icon-wrap">
                    <img
                        src={alertIcon}
                        alt="Status"
                        width={53}
                        height={53}
                    />
                </div>

                {/* Message Content */}
                <div className="ld-cm-notice-message-wrap">
                    <p className="ld-cm-notice-message-text">
                        {message}
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
}
