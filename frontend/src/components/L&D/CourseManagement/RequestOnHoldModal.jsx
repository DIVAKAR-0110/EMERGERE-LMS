import React, { useState, useEffect } from "react";
import { X, Info } from "lucide-react";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
} from "../../../utils/validationUtils";

export default function RequestOnHoldModal({ isOpen, onClose, request, onSubmit }) {
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState("");
    const maxChars = 250;

    useEffect(() => {
        if (isOpen) {
            setReason("");
            setReasonError("");
        }
    }, [isOpen]);

    if (!isOpen || !request) return null;

    const employee = request.employee;

    const courseTitle = request.course || request.courseTitle || "-";
    const provider = request.provider || "—";

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanReason = normalizeSingleSpacing(reason, { trimEdges: true }).slice(0, maxChars);
        if (!cleanReason) {
            setReasonError("Please enter a reason for holding this request.");
            return;
        }
        if (onSubmit) {
            onSubmit(request, cleanReason);
        }
        onClose();
    };

    return (
        <div className="ld-cm-modal-overlay">
            <div className="ld-cm-hold-modal-card" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="ld-cm-hold-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                <div className="ld-cm-hold-header">
                    <h2 className="ld-cm-hold-title">Request On Hold</h2>
                    <p className="ld-cm-hold-subtitle">
                        You are putting the following request on hold
                    </p>
                </div>

                {/* Details Box */}
                <div className="ld-cm-hold-info-box">
                    <div className="ld-cm-hold-employee-col">
                        <div
                            className="ld-cm-hold-avatar"
                            style={{ backgroundColor: employee.avatarBg || "#A87FFF" }}
                        >
                            {employee.initials || "-"}
                        </div>
                        <div className="ld-cm-hold-employee-details">
                            <span className="ld-cm-hold-emp-name">
                                {employee.name}
                                {employee.empId && (
                                    <span className="ld-cm-hold-emp-id">({employee.empId})</span>
                                )}
                            </span>
                            <span className="ld-cm-hold-emp-role">{employee.role}</span>
                        </div>
                    </div>

                    <div className="ld-cm-hold-divider" />

                    <div className="ld-cm-hold-course-col">
                        <h4 className="ld-cm-hold-course-title">{courseTitle}</h4>
                        <p className="ld-cm-hold-course-provider">{provider}</p>
                    </div>
                </div>

                {/* Reason Textarea */}
                <form onSubmit={handleSubmit} className="ld-cm-hold-form">
                    <div className="ld-cm-hold-form-group">
                        <label className="ld-cm-hold-label">
                            Reason for holding the request <span className="required">*</span>
                        </label>
                        <div className="ld-cm-hold-textarea-wrap">
                            <textarea
                                className={`ld-cm-hold-textarea ${reasonError ? "has-error" : ""}`}
                                placeholder="Add reason..."
                                maxLength={maxChars}
                                value={reason}
                                onKeyDown={handleSingleSpaceKeyDown}
                                onChange={(e) => {
                                    setReason(applySingleSpaceTextChange(e, maxChars));
                                    if (reasonError) setReasonError("");
                                }}
                                onPaste={(e) =>
                                    handleSingleSpacePaste(e, maxChars, (val) => {
                                        setReason(val);
                                        if (reasonError) setReasonError("");
                                    })
                                }
                                onBlur={() =>
                                    setReason((prev) =>
                                        normalizeSingleSpacing(prev, { trimEdges: true }).slice(0, maxChars)
                                    )
                                }
                            />
                            <span className="ld-cm-hold-char-count">
                                {reason.length}/{maxChars}
                            </span>
                        </div>
                        {reasonError && (
                            <p className="ld-cm-hold-reason-error">{reasonError}</p>
                        )}
                    </div>

                    {/* Notice Alert */}
                    <div className="ld-cm-hold-alert">
                        <Info size={15} className="ld-cm-hold-alert-icon" />
                        <span>The employee will be notified that this request is on hold.</span>
                    </div>

                    {/* Actions */}
                    <div className="ld-cm-hold-footer">
                        <button
                            type="button"
                            className="ld-cm-hold-cancel-btn"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="ld-cm-hold-submit-btn"
                        >
                            On Hold
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
