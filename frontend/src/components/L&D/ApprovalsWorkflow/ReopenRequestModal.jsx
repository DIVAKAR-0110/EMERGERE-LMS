import React, { useState, useEffect } from "react";
import { X, RotateCcw } from "lucide-react";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
} from "../../../utils/validationUtils";

export default function ReopenRequestModal({
    isOpen,
    onClose,
    onConfirm,
    targetItem,
    isSubmitting = false,
}) {
    const [reopenReason, setReopenReason] = useState("");
    const [reasonError, setReasonError] = useState("");

    useEffect(() => {
        if (isOpen) {
            setReopenReason("");
            setReasonError("");
        }
    }, [isOpen, targetItem]);

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
        "Request";
    const employeeName = targetItem.name || targetItem.employee || targetItem.employeeName || "—";
    const titleLabel = isCert ? "Certification Name:" : "Course Name:";

    const handleConfirmClick = () => {
        const trimmed = normalizeSingleSpacing(reopenReason, { trimEdges: true }).slice(0, 500);
        if (!trimmed) {
            setReasonError("Please enter a reason to reopen this request.");
            return;
        }
        onConfirm?.(trimmed);
    };

    return (
        <div className="ld-aw-reopen-modal-overlay">
            <div
                className="ld-aw-reopen-modal-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ld-reopen-modal-title"
            >
                {/* Close Button */}
                <button
                    type="button"
                    className="ld-aw-reopen-close-btn"
                    onClick={onClose}
                    aria-label="Close dialog"
                    disabled={isSubmitting}
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div className="ld-aw-reopen-modal-header">
                    <div className="ld-aw-reopen-header-text">
                        <h2 id="ld-reopen-modal-title" className="ld-aw-reopen-title">
                            Reopen this request?
                        </h2>
                        <p className="ld-aw-reopen-message">
                            This request will return to Pending for L&D review. It will not be approved automatically.
                        </p>
                    </div>
                </div>

                {/* Item Summary Pill */}
                <div className="ld-aw-reopen-info-box">
                    <div className="ld-aw-reopen-info-row">
                        <span className="ld-aw-reopen-info-label">Request ID:</span>
                        <span className="ld-aw-reopen-info-val">{reqId}</span>
                    </div>
                    <div className="ld-aw-reopen-info-row">
                        <span className="ld-aw-reopen-info-label">Employee Name:</span>
                        <span className="ld-aw-reopen-info-val">{employeeName}</span>
                    </div>
                    <div className="ld-aw-reopen-info-row">
                        <span className="ld-aw-reopen-info-label">{titleLabel}</span>
                        <span className="ld-aw-reopen-info-val" title={titleName}>
                            {titleName}
                        </span>
                    </div>
                </div>

                {/* Reason for Undoing Rejection */}
                <div className="ld-aw-reopen-reason-group">
                    <label htmlFor="ld-reopen-reason-input" className="ld-aw-reopen-reason-label">
                        Reason to Undo Rejection <span className="ld-aw-reopen-reason-required">*</span>
                    </label>
                    <div className={`ld-aw-reopen-textarea-wrap ${reasonError ? "has-error" : ""}`}>
                        <textarea
                            id="ld-reopen-reason-input"
                            className="ld-aw-reopen-reason-input"
                            placeholder="Enter reason for reopening this rejected request..."
                            value={reopenReason}
                            maxLength={500}
                            disabled={isSubmitting}
                            onKeyDown={handleSingleSpaceKeyDown}
                            onChange={(e) => {
                                setReopenReason(applySingleSpaceTextChange(e, 500));
                                if (reasonError) setReasonError("");
                            }}
                            onPaste={(e) =>
                                handleSingleSpacePaste(e, 500, (val) => {
                                    setReopenReason(val);
                                    if (reasonError) setReasonError("");
                                })
                            }
                            onBlur={() =>
                                setReopenReason((prev) =>
                                    normalizeSingleSpacing(prev, { trimEdges: true }).slice(0, 500)
                                )
                            }
                        />
                        <div className="ld-aw-reopen-char-count">
                            {reopenReason.length}/500
                        </div>
                    </div>
                    {reasonError && <p className="ld-aw-reopen-reason-error">{reasonError}</p>}
                </div>

                {/* Modal Footer Actions */}
                <div className="ld-aw-reopen-modal-footer">
                    <button
                        type="button"
                        className="ld-aw-reopen-btn-cancel"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="ld-aw-reopen-btn-confirm"
                        onClick={handleConfirmClick}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="ld-aw-reopen-btn-loading">Reopening...</span>
                        ) : (
                            <>
                                <RotateCcw size={14} strokeWidth={2.4} />
                                Confirm Undo
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
