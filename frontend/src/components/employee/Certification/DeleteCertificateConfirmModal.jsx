import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, Loader2, X } from "lucide-react";
import "../../../styles/employee/EnrollConfirmModal.css";

const DeleteCertificateConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    certificateTitle = "",
    certificateType = "certification",
    isDeleting = false,
}) => {
    // Keyboard Escape key handler to close modal
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !isDeleting) {
                onClose?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isDeleting, onClose]);

    if (!isOpen) return null;

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
                aria-labelledby="emp-delete-cert-confirm-title"
            >
                {/* Close Button */}
                <button
                    type="button"
                    className="emp-enroll-confirm-close"
                    onClick={onClose}
                    disabled={isDeleting}
                    aria-label="Close dialog"
                >
                    <X size={16} color="#64748B" />
                </button>

                {/* Icon Header */}
                <div className="emp-enroll-confirm-icon-wrap">
                    <div className="emp-enroll-confirm-icon-circle emp-delete-confirm-icon-circle">
                        <Trash2 size={26} strokeWidth={2.2} className="emp-enroll-confirm-icon emp-delete-confirm-icon" color="#EF4444" />
                    </div>
                </div>

                {/* Title & Prompt */}
                <h2
                    id="emp-delete-cert-confirm-title"
                    className="emp-enroll-confirm-title"
                    style={{ fontWeight: 600 }}
                >
                    Confirm to Delete
                </h2>
                <p className="emp-enroll-confirm-prompt">
                    Are you sure you want to delete{" "}
                    <span className="emp-enroll-course-highlight" style={{ fontWeight: 700 }}>
                        "{certificateTitle}"
                    </span>{" "}
                    {certificateType}?
                </p>

                {/* Action Buttons: Cancel / Delete */}
                <div className="emp-enroll-confirm-actions">
                    <button
                        type="button"
                        className="emp-enroll-confirm-btn emp-btn-no"
                        style={{ minWidth: 84, fontWeight: 500 }}
                        onClick={onClose}
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="emp-enroll-confirm-btn emp-btn-delete-red"
                        style={{ minWidth: 84, fontWeight: 500 }}
                        onClick={onConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 size={16} className="emp-btn-spinner" />
                                <span>Deleting...</span>
                            </>
                        ) : (
                            "Delete"
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DeleteCertificateConfirmModal;
