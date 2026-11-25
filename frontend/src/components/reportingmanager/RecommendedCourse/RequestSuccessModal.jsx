import React from "react";
import { createPortal } from "react-dom";
import closeIcon from "../../../assets/course_library/close.svg";
import successfullyIcon from "../../../assets/course_library/Successfully.svg";
import "../../../styles/reportingmanager/RequestSuccessModal.css";

const RequestSuccessModal = ({
    isOpen,
    onClose,
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="rm-custom-modal-overlay">
            <div className="rm-recommendation-success-modal" onClick={(e) => e.stopPropagation()}>
                {/* CLOSE BUTTON */}
                <button
                    type="button"
                    className="rm-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="close-icon" width={12} height={12} />
                </button>

                {/* GREEN CIRCLE CHECK ICON (53x53) */}
                <div className="rm-success-icon-wrapper">
                    <img
                        src={successfullyIcon}
                        alt="Success"
                        className="rm-success-icon-img"
                        width={53}
                        height={53}
                    />
                </div>

                {/* SUCCESS MESSAGE */}
                <h2 className="rm-recommendation-modal-title">
                    Recommendation Submitted
                </h2>
                <p className="rm-recommendation-modal-subtitle">
                    The employee have been notified successfully.
                </p>
            </div>
        </div>,
        document.body
    );
};

export default RequestSuccessModal;