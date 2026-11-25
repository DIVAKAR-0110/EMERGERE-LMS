import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import "../../styles/common/AlertDialog.css";

/**
 * Reusable modal AlertDialog component replacing native browser window.alert().
 *
 * @param {boolean} isOpen - Whether the dialog is displayed
 * @param {Function} onClose - Handler called when dismissed (close button, backdrop, Escape)
 * @param {string} [title="Alert"] - Dialog title
 * @param {string|React.ReactNode} message - Dialog message description
 * @param {"error"|"warning"|"info"|"success"} [type="error"] - Visual style type
 * @param {string} [confirmText="OK"] - Confirm button label
 * @param {Function} [onConfirm] - Optional custom confirm handler (defaults to onClose)
 */
export default function AlertDialog({
    isOpen,
    onClose,
    title = "Alert",
    message = "",
    type = "error",
    confirmText = "OK",
    onConfirm,
}) {
    const confirmBtnRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
            } else if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        const timer = setTimeout(() => {
            confirmBtnRef.current?.focus();
        }, 50);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            clearTimeout(timer);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClose = () => {
        onClose?.();
    };

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        } else {
            onClose?.();
        }
    };

    const renderIcon = () => {
        switch (type) {
            case "warning":
                return (
                    <div className="lms-alert-dialog-icon-circle warning">
                        <AlertTriangle size={28} strokeWidth={2.2} />
                    </div>
                );
            case "info":
                return (
                    <div className="lms-alert-dialog-icon-circle info">
                        <Info size={28} strokeWidth={2.2} />
                    </div>
                );
            case "success":
                return (
                    <div className="lms-alert-dialog-icon-circle success">
                        <CheckCircle2 size={28} strokeWidth={2.2} />
                    </div>
                );
            case "error":
            default:
                return (
                    <div className="lms-alert-dialog-icon-circle error">
                        <AlertCircle size={28} strokeWidth={2.2} />
                    </div>
                );
        }
    };

    return createPortal(
        <div
            className="lms-alert-dialog-overlay"
            role="presentation"
        >
            <div
                className="lms-alert-dialog-card"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="lms-alert-dialog-title"
                aria-describedby="lms-alert-dialog-desc"
            >
                <button
                    type="button"
                    className="lms-alert-dialog-close"
                    onClick={handleClose}
                    aria-label="Close dialog"
                >
                    <X size={18} color="#64748B" />
                </button>

                <div className="lms-alert-dialog-header">
                    {renderIcon()}
                    {title && (
                        <h3 id="lms-alert-dialog-title" className="lms-alert-dialog-title">
                            {title}
                        </h3>
                    )}
                </div>

                <div className="lms-alert-dialog-body">
                    <p id="lms-alert-dialog-desc" className="lms-alert-dialog-message">
                        {message}
                    </p>
                </div>

                <div className="lms-alert-dialog-footer">
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        className={`lms-alert-dialog-btn ${type}`}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
