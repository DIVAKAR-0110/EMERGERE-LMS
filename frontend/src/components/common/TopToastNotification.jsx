import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, AlertTriangle, X } from "lucide-react";
import "../../styles/common/TopToastNotification.css";

export default function TopToastNotification({
    isOpen,
    onClose,
    type = "error", // "error" | "success" | "warning"
    message = "",
    duration = 5000,
}) {
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            if (onClose) onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [isOpen, duration, onClose]);

    if (!isOpen) return null;

    const renderIcon = () => {
        switch (type) {
            case "success":
                return <Check size={18} strokeWidth={2.5} />;
            case "warning":
                return <AlertTriangle size={18} strokeWidth={2.5} />;
            case "error":
            default:
                return <AlertCircle size={18} strokeWidth={2.5} />;
        }
    };

    const toastMarkup = (
        <div className="top-toast-container" role="alert" aria-live="assertive">
            <div className={`top-toast-card ${type}`}>
                {/* 5-second countdown progress bar */}
                <div
                    className="top-toast-progress-bar"
                    style={{ animationDuration: `${duration}ms` }}
                />

                {/* Left circle badge */}
                <div className="top-toast-icon-circle">
                    {renderIcon()}
                </div>

                {/* Single straight line message */}
                <div className="top-toast-content">
                    <span className="top-toast-message">{message}</span>
                </div>

                {/* Close Button */}
                <button
                    type="button"
                    className="top-toast-close-btn"
                    onClick={onClose}
                    aria-label="Close notification"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );

    return typeof document !== "undefined"
        ? createPortal(toastMarkup, document.body)
        : toastMarkup;
}
