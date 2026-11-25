import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
} from "../../../utils/validationUtils";

export default function RejectRequestModal({
    isOpen,
    onClose,
    onConfirm,
    targetItem,
    isSubmitting = false,
}) {
    const [rejectReason, setRejectReason] = useState("");
    const [reasonError, setReasonError] = useState("");

    useEffect(() => {
        if (isOpen) {
            setRejectReason("");
            setReasonError("");
        }
    }, [isOpen, targetItem]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen && !isSubmitting) {
                onClose?.();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isSubmitting, onClose]);

    if (!isOpen || !targetItem) return null;

    const reqId =
        (typeof targetItem.id === "string" && (targetItem.id.startsWith("CLM-") || targetItem.id.startsWith("PUR-") || targetItem.id.startsWith("REQ-") || targetItem.id.startsWith("ERC-")) ? targetItem.id : null) ||
        targetItem.request_code ||
        targetItem.requestCode ||
        targetItem.requestId ||
        targetItem.raw?.request_code ||
        targetItem.id ||
        "—";
    const isCert = Boolean(
        targetItem.certification ||
        targetItem.certName ||
        targetItem.type === "Certification" ||
        targetItem.isCertification
    );
    const titleName =
        targetItem.course ||
        targetItem.courseName ||
        targetItem.certification ||
        targetItem.certName ||
        targetItem.detail ||
        "Request";
    const employeeName = targetItem.name || targetItem.employee || targetItem.employeeName || "—";
    const titleLabel = isCert ? "Certification Name:" : "Course Name:";

    const handleConfirmClick = () => {
        const trimmed = normalizeSingleSpacing(rejectReason, { trimEdges: true }).slice(0, 500);
        if (!trimmed) {
            setReasonError("Please enter a reason for rejecting this request.");
            return;
        }
        onConfirm?.(trimmed);
    };

    const modalContent = (
        <div className="ceo-aw-reject-modal-overlay">
            <div
                className="ceo-aw-reject-modal-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ceo-reject-modal-title"
            >
                {/* Close Button */}
                <button
                    type="button"
                    className="ceo-aw-reject-close-btn"
                    onClick={onClose}
                    aria-label="Close dialog"
                    disabled={isSubmitting}
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div className="ceo-aw-reject-modal-header">
                    <div className="ceo-aw-reject-header-text">
                        <h2 id="ceo-reject-modal-title" className="ceo-aw-reject-title">
                            Reject this request?
                        </h2>
                        <p className="ceo-aw-reject-message">
                            Please provide a reason for rejecting this request. This reason will be recorded and shared with the employee.
                        </p>
                    </div>
                </div>

                {/* Item Summary Pill */}
                <div className="ceo-aw-reject-info-box">
                    <div className="ceo-aw-reject-info-row">
                        <span className="ceo-aw-reject-info-label">Request ID:</span>
                        <span className="ceo-aw-reject-info-val">{reqId}</span>
                    </div>
                    <div className="ceo-aw-reject-info-row">
                        <span className="ceo-aw-reject-info-label">Employee Name:</span>
                        <span className="ceo-aw-reject-info-val">{employeeName}</span>
                    </div>
                    <div className="ceo-aw-reject-info-row">
                        <span className="ceo-aw-reject-info-label">{titleLabel}</span>
                        <span className="ceo-aw-reject-info-val" title={titleName}>
                            {titleName}
                        </span>
                    </div>
                </div>

                {/* Reason for Rejection Input Field */}
                <div className="ceo-aw-reject-reason-group">
                    <label htmlFor="ceo-reject-reason-textarea" className="ceo-aw-reject-reason-label">
                        Reason for Rejection <span className="ceo-aw-reject-reason-required">*</span>
                    </label>
                    <div className={`ceo-aw-reject-textarea-wrap ${reasonError ? "has-error" : ""}`}>
                        <textarea
                            id="ceo-reject-reason-textarea"
                            className="ceo-aw-reject-reason-input"
                            rows={3}
                            placeholder="Enter reason for rejection..."
                            value={rejectReason}
                            maxLength={500}
                            disabled={isSubmitting}
                            onKeyDown={handleSingleSpaceKeyDown}
                            onChange={(e) => {
                                setRejectReason(applySingleSpaceTextChange(e, 500));
                                if (reasonError) setReasonError("");
                            }}
                            onPaste={(e) =>
                                handleSingleSpacePaste(e, 500, (val) => {
                                    setRejectReason(val);
                                    if (reasonError) setReasonError("");
                                })
                            }
                            onBlur={() =>
                                setRejectReason((prev) =>
                                    normalizeSingleSpacing(prev, { trimEdges: true }).slice(0, 500)
                                )
                            }
                        />
                        <div className="ceo-aw-reject-char-count">
                            {rejectReason.length}/500
                        </div>
                    </div>
                    {reasonError && <p className="ceo-aw-reject-reason-error">{reasonError}</p>}
                </div>

                {/* Modal Footer Actions */}
                <div className="ceo-aw-reject-modal-footer">
                    <button
                        type="button"
                        className="ceo-aw-reject-btn-cancel"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="ceo-aw-reject-btn-confirm"
                        onClick={handleConfirmClick}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Rejecting..." : "Reject"}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
