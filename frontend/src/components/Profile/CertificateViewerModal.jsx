import React from "react";
import { createPortal } from "react-dom";
import { X, FileText, AlertCircle } from "lucide-react";
import "../../styles/Profile.css";

export default function CertificateViewerModal({
    isOpen,
    onClose,
    cert,
    previewUrl,
    isLoading = false,
    errorMessage = "",
}) {
    if (!isOpen) return null;

    const certName = cert?.name || cert?.certification_name || "Certification Document";
    const certIssuer = cert?.issuer || cert?.provider || cert?.provider_name || "";
    const fileName = cert?.certificateFileName || cert?.fileName || "";

    const isImage = Boolean(
        (previewUrl && previewUrl.startsWith("data:image/")) ||
        (previewUrl && /\.(png|jpg|jpeg|webp|gif)($|\?)/i.test(previewUrl)) ||
        /\.(png|jpg|jpeg|webp|gif)$/i.test(fileName) ||
        (cert?.certificateUrl && /\.(png|jpg|jpeg|webp|gif)($|\?)/i.test(cert.certificateUrl)) ||
        (cert?.certificate_file_path && /\.(png|jpg|jpeg|webp|gif)($|\?)/i.test(cert.certificate_file_path)) ||
        (cert?.mimeType && cert.mimeType.startsWith("image/"))
    );

    const iframePreviewUrl =
        previewUrl && !previewUrl.startsWith("data:")
            ? (previewUrl.includes("#")
                ? previewUrl
                : `${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`)
            : previewUrl;

    return createPortal(
        <div className="cert-viewer-modal-overlay" onClick={onClose}>
            <div
                className="cert-viewer-modal-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cert-viewer-title"
            >
                {/* Header */}
                <div className="cert-viewer-header">
                    <div className="cert-viewer-header-info">
                        <div>
                            <h3 id="cert-viewer-title" className="cert-viewer-title">
                                {certName}
                            </h3>
                            {!cert?.hideSubtitle && (
                                <p className="cert-viewer-subtitle">
                                    {certIssuer ? `${certIssuer}` : "Issued Certificate"}
                                    {cert?.issueDate ? ` • Issued: ${cert.issueDate}` : ""}
                                    {cert?.expiryDate ? ` • Expires: ${cert.expiryDate}` : ""}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="cert-viewer-header-actions">
                        <button
                            type="button"
                            className="cert-viewer-close-btn"
                            onClick={onClose}
                            title="Close"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="cert-viewer-body">
                    {isLoading ? (
                        <div className="cert-viewer-loading">
                            <div className="cert-viewer-spinner" />
                            <p>Loading certificate document...</p>
                        </div>
                    ) : errorMessage ? (
                        <div className="cert-viewer-empty-state">
                            <AlertCircle size={36} color="#EF4444" style={{ marginBottom: 12 }} />
                            <h4>Unable to load certificate</h4>
                            <p>{errorMessage}</p>
                        </div>
                    ) : !previewUrl || previewUrl === "#" ? (
                        <div className="cert-viewer-empty-state">
                            <AlertCircle size={36} color="#94A3B8" style={{ marginBottom: 12 }} />
                            <h4>No Document Available</h4>
                            <p>No certificate document was attached or uploaded for this item.</p>
                        </div>
                    ) : isImage ? (
                        <div className="cert-viewer-image-wrapper">
                            <img
                                src={previewUrl}
                                alt={certName}
                                className="cert-viewer-img"
                            />
                        </div>
                    ) : (
                        <div className="cert-viewer-iframe-wrapper">
                            <iframe
                                src={iframePreviewUrl}
                                title={certName}
                                className="cert-viewer-iframe"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
