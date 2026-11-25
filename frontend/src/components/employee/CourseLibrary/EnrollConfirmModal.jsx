import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, Loader2 } from "lucide-react";
import closeIcon from "../../../assets/course_library/close.svg";
import "../../../styles/employee/EnrollConfirmModal.css";

const EnrollConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    course,
    isSubmitting = false,
}) => {
    // Keyboard Escape key handler to close modal
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !isSubmitting) {
                onClose?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen || !course) return null;

    const courseTitle = course.title || course.course_name || "this";

    return createPortal(
        <div
            className="emp-enroll-confirm-overlay"
            role="presentation"
        >
            <div
                className="emp-enroll-confirm-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="emp-enroll-confirm-title"
            >
                {/* Close Button */}
                <button
                    type="button"
                    className="emp-enroll-confirm-close"
                    onClick={onClose}
                    disabled={isSubmitting}
                    aria-label="Close dialog"
                >
                    <img src={closeIcon} alt="Close" width={12} height={12} />
                </button>

                {/* Icon Header */}
                <div className="emp-enroll-confirm-icon-wrap">
                    <div className="emp-enroll-confirm-icon-circle">
                        <HelpCircle size={28} className="emp-enroll-confirm-icon" />
                    </div>
                </div>

                {/* Title & Prompt */}
                <h2 id="emp-enroll-confirm-title" className="emp-enroll-confirm-title">
                    Confirm Enrollment
                </h2>
                <p className="emp-enroll-confirm-prompt">
                    Are you sure you want to enroll <span className="emp-enroll-course-highlight">{courseTitle}</span> course?
                </p>

                {/* Action Buttons: Yes / No */}
                <div className="emp-enroll-confirm-actions">
                    <button
                        type="button"
                        className="emp-enroll-confirm-btn emp-btn-no"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        No
                    </button>
                    <button
                        type="button"
                        className="emp-enroll-confirm-btn emp-btn-yes"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="emp-btn-spinner" />
                                <span>Enrolling...</span>
                            </>
                        ) : (
                            "Yes"
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EnrollConfirmModal;
