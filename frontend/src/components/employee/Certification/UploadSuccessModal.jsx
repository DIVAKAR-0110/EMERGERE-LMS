import React from "react";
import closeIcon from "../../../assets/course_library/close.svg";
import greenCheckIcon from "../../../assets/Certification/greencheck.svg";

export default function UploadSuccessModal({ isOpen, onClose, title = "Certificate uploaded Successfully!" }) {
    if (!isOpen) return null;

    return (
        <div className="emp-cert-modal-overlay">
            <div className="emp-upload-success-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                    type="button"
                    className="emp-upload-success-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <img src={closeIcon} alt="Close" width={14} height={14} />
                </button>

                {/* Success Icon */}
                <div className="emp-upload-success-icon-container">
                    <img
                        src={greenCheckIcon}
                        alt="Success"
                        className="emp-upload-success-check-img"
                        width={60}
                        height={60}
                    />
                </div>

                {/* Success Title */}
                <h2 className="emp-upload-success-heading">
                    {title === "Request Submitted Successfully!" ? (
                        <>
                            Request Submitted
                            <br />
                            Successfully!
                        </>
                    ) : title === "Claim Submitted Successfully!" ? (
                        <>
                            Claim Submitted
                            <br />
                            Successfully!
                        </>
                    ) : (
                        <>
                            Certificate uploaded
                            <br />
                            Successfully!
                        </>
                    )}
                </h2>
            </div>
        </div>
    );
}
