import React from "react";
import { createPortal } from "react-dom";
import closeIcon from "../../../assets/course_library/close.svg";
import successfullyIcon from "../../../assets/course_library/Successfully.svg";
import "../../../styles/employee/RequestSuccessModal.css";

const RequestSuccessModal = ({
    isOpen,
    onClose,
    courseName = "",
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="emp-custom-modal-overlay">
            <div className="emp-success-modal" onClick={(e) => e.stopPropagation()}>
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
                        src={successfullyIcon}
                        alt="Success"
                        className="emp-success-icon-img"
                        width={53}
                        height={53}
                    />
                </div>

                {/* SUCCESS MESSAGE */}
                <h2 className="emp-success-modal-title">
                    Request Submitted
                    <br />
                    Successfully!
                </h2>

                {courseName ? (
                    <p className="emp-success-modal-course-text">
                        for <span className="emp-success-modal-course-name">"{courseName}"</span>
                    </p>
                ) : null}
            </div>
        </div>,
        document.body
    );
};

export default RequestSuccessModal;