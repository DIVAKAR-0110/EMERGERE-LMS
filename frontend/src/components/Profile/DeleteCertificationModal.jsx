import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import "../../styles/Profile.css";

export default function DeleteCertificationModal({
    isOpen,
    onClose,
    onConfirm,
    certName,
    isDeleting = false,
}) {
    // ESC key listener to cancel
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

    const displayName = certName || "this certification";

    return createPortal(
        <div
            className="delete-cert-overlay"
            role="presentation"
        >
            <div
                className="delete-cert-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-cert-title"
            >
                {/* Close Button */}
                <button
                    type="button"
                    className="delete-cert-close-btn"
                    onClick={onClose}
                    disabled={isDeleting}
                    aria-label="Close"
                >
                    <X size={16} />
                </button>

                {/* Warning Trash Icon Circle */}
                <div className="delete-cert-icon-wrap">
                    <div className="delete-cert-icon-circle">
                        <Trash2 size={24} color="#EF4444" />
                    </div>
                </div>

                {/* Title */}
                <h3 id="delete-cert-title" className="delete-cert-title">
                    Confirm to Delete
                </h3>

                {/* Confirmation Prompt */}
                <p className="delete-cert-prompt">
                    Are you sure you want to delete &quot;<span className="delete-cert-name-highlight">{displayName}</span>&quot; certification?
                </p>

                {/* Action Buttons: Cancel and OK */}
                <div className="delete-cert-actions">
                    <button
                        type="button"
                        className="delete-cert-btn-cancel"
                        onClick={onClose}
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="delete-cert-btn-ok"
                        onClick={onConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting ? "Deleting..." : "OK"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
