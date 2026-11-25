import React, { useState, useRef, useCallback } from "react";
import { CreditCard, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import axios from "axios";
import docUploadIcon from "../../../assets/Certification/docuplode.svg";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
} from "../../../utils/validationUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const ALLOWED_EXTS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIMES = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * PaymentSlipForm
 *
 * Sub-form rendered **inside** ApprovalDetailsModal when a reimbursement claim
 * is Approved but not yet Paid.
 *
 * Props:
 *   claimId      {number}   - Internal DB id of the claim
 *   claimCode    {string}   - Readable code e.g. "CLM-2026-0003"
 *   amount       {string}   - Formatted amount string e.g. "₹12,000"
 *   employeeName {string}   - Employee display name
 *   onSuccess    {function} - Called with updated claim object on success
 *   onCancel     {function} - Called when HR clicks Cancel
 */
export default function PaymentSlipForm({
    claimId,
    claimCode,
    claimType = "cert",
    amount,
    employeeName,
    onSuccess,
    onCancel,
}) {
    const [file, setFile] = useState(null);
    const [description, setDescription] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const fileInputRef = useRef(null);
    const descTextareaRef = useRef(null);

    // ── Validation helpers ─────────────────────────────────────────────────────
    const validateFile = (f) => {
        if (!f) return "Please select a payment proof file.";
        const name = (f.name || "").toLowerCase();
        const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
        const isExtValid = ALLOWED_EXTS.includes(ext);
        const isMimeValid = ALLOWED_MIMES.includes(f.type);
        if (!isExtValid && !isMimeValid) {
            return "Supports PDF, DOC, DOCX, JPG, PNG (Max.5MB each)";
        }
        if (f.size > MAX_SIZE_BYTES) {
            return "File size must not exceed 5MB.";
        }
        return null;
    };

    // ── File selection ─────────────────────────────────────────────────────────
    const handleFileChosen = useCallback((chosen) => {
        setError(null);
        const err = validateFile(chosen);
        if (err) { setError(err); return; }
        setFile(chosen);
    }, []);

    const handleInputChange = (e) => {
        const chosen = e.target.files?.[0];
        if (chosen) handleFileChosen(chosen);
        // Reset input so same file can be re-selected after removal
        e.target.value = "";
    };

    // ── Drag & drop ────────────────────────────────────────────────────────────
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) handleFileChosen(dropped);
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = () => setIsDragOver(false);

    // ── Remove selected file ───────────────────────────────────────────────────
    const removeFile = () => { setFile(null); setError(null); };

    // ── Format file size ───────────────────────────────────────────────────────
    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // ── Submit ─────────────────────────────────────────────────────────────────
    const canSubmit = Boolean(file || (description && description.trim().length > 0));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!claimId) {
            setError("Invalid claim. Please close and re-open this dialog.");
            return;
        }

        if (!file && !description.trim()) {
            setError("Please provide either a payment proof file or a description.");
            return;
        }

        if (file) {
            const fileErr = validateFile(file);
            if (fileErr) { setError(fileErr); return; }
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            if (file) {
                formData.append("file", file);
            }
            if (description.trim()) {
                formData.append("description", description.trim());
            }

            const isCourse = String(claimType).toLowerCase().startsWith("course");
            const uploadUrl = isCourse
                ? `${API_BASE_URL}/api/courses/${claimId}/pay-slip`
                : `${API_BASE_URL}/api/reimbursements/claims/${claimId}/pay-slip`;

            const token = localStorage.getItem("lms_token");
            const reqHeaders = { "Content-Type": "multipart/form-data" };
            if (token) {
                reqHeaders["Authorization"] = `Bearer ${token}`;
            }

            const res = await axios.post(
                uploadUrl,
                formData,
                {
                    headers: reqHeaders
                }
            );

            const updated = res.data;
            setSuccess(true);

            // Brief success flash then call parent
            setTimeout(() => {
                if (onSuccess) onSuccess(updated);
            }, 900);

        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.message ||
                "Failed to upload payment proof. Please try again.";
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Success state ──────────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="hr-pay-form-wrap" style={{ textAlign: "center", padding: "24px" }}>
                <CheckCircle size={36} color="#16A34A" style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: "#15803D", margin: 0 }}>
                    Payment proof Uploaded Successfully!
                </p>
                <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                    Claim {claimCode} is now marked as <strong>Paid</strong>.
                </p>
            </div>
        );
    }

    return (
        <form
            className="hr-pay-form-wrap"
            onSubmit={handleSubmit}
            noValidate
        >
            {/* Section title */}
            <p className="hr-pay-form-title">
                <CreditCard size={15} color="#16A34A" strokeWidth={2.2} />
                Upload Payment proof
            </p>

            {/* File zone */}
            <div
                className={`hr-pay-dropzone${isDragOver ? " drag-over" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                aria-label="Upload payment proof file"
            >
                <img src={docUploadIcon} alt="" className="hr-pay-dropzone-icon-img" />
                <p className="hr-pay-dropzone-label">
                    {file ? (
                        <>
                            <span className="hr-pay-selected-filename" title={file.name}>
                                {file.name}
                            </span>
                            <span className="hr-pay-selected-filesize">
                                ({formatSize(file.size)})
                            </span>
                            <button
                                type="button"
                                className="hr-pay-remove-file-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile();
                                }}
                                title="Remove file"
                                aria-label="Remove file"
                            >
                                <X size={15} />
                            </button>
                        </>
                    ) : (
                        <>
                            Drag and drop files here or <span className="hr-pay-browse-link">Browse Files</span>
                        </>
                    )}
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    style={{ display: "none" }}
                    onChange={handleInputChange}
                />
            </div>

            <span className="hr-pay-supports-text">
                Upload invoice, payment receipt, course completion proof, etc.
            </span>
            <span className="hr-pay-supports-text" style={{ marginTop: 2 }}>
                Supports PDF, DOC, DOCX, JPG, PNG (Max.5MB each)
            </span>

            {/* Error message */}
            {error && (
                <p className="hr-pay-error-msg">
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    {error}
                </p>
            )}

            {/* Description textarea */}
            <div className="hr-pay-desc-field-group">
                <label className="hr-pay-desc-label" htmlFor="hr-pay-desc">
                    Description
                </label>
                <div
                    className="hr-pay-desc-wrapper"
                    onClick={() => descTextareaRef.current?.focus()}
                >
                    <textarea
                        ref={descTextareaRef}
                        id="hr-pay-desc"
                        className="hr-pay-desc-textarea"
                        placeholder="Course description will appear here..."
                        value={description}
                        maxLength={250}
                        rows={3}
                        onKeyDown={handleSingleSpaceKeyDown}
                        onChange={(e) => setDescription(applySingleSpaceTextChange(e, 500))}
                        onPaste={(e) =>
                            handleSingleSpacePaste(e, 250, (val) => {
                                setDescription(val);
                            })
                        }
                        onBlur={() =>
                            setDescription((prev) =>
                                normalizeSingleSpacing(prev, { trimEdges: true }).slice(0, 250)
                            )
                        }
                        disabled={isSubmitting}
                    />
                    <div className="hr-pay-desc-bottom-bar">
                        <span className="hr-pay-desc-char-count">{description.length}/250</span>
                    </div>
                </div>
            </div>

            {/* Footer buttons */}
            <div className="hr-pay-form-footer">
                <button
                    type="button"
                    className="hr-pay-cancel-btn"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="hr-pay-confirm-btn"
                    disabled={isSubmitting || !canSubmit}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                            Uploading…
                        </>
                    ) : (
                        <>
                            <CheckCircle size={13} strokeWidth={2.5} />
                            Confirm Payment
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
