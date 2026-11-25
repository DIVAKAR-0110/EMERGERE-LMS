import React from "react";
import { X } from "lucide-react";

export default function CertificateDetailsModal({ selectedItem, onClose }) {
    if (!selectedItem) return null;

    return (
        <div className="ld-cm-modal-overlay">
            <div className="ld-cm-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="ld-cm-modal-header">
                    <div>
                        <h3 className="ld-cm-modal-title">Certificate Details</h3>
                        <p className="ld-cm-modal-subtitle">
                            Detailed information and examination schedule for this request.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="ld-cm-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="ld-cm-modal-body">
                    <div className="ld-cm-modal-row">
                        <span className="ld-cm-modal-label">Employee</span>
                        <span className="ld-cm-modal-val">{selectedItem.name || selectedItem.employee}</span>
                    </div>
                    <div className="ld-cm-modal-row">
                        <span className="ld-cm-modal-label">Certificate</span>
                        <span className="ld-cm-modal-val">{selectedItem.certificate}</span>
                    </div>
                    <div className="ld-cm-modal-row">
                        <span className="ld-cm-modal-label">Claim ID</span>
                        <span className="ld-cm-modal-val">{selectedItem.id}</span>
                    </div>
                    <div className="ld-cm-modal-row">
                        <span className="ld-cm-modal-label">Provider</span>
                        <span className="ld-cm-modal-val">{selectedItem.provider}</span>
                    </div>
                    <div className="ld-cm-modal-row">
                        <span className="ld-cm-modal-label">Amount</span>
                        <span className="ld-cm-modal-val">
                            {typeof selectedItem.amount === "number"
                                ? `₹${selectedItem.amount.toLocaleString("en-IN")}`
                                : selectedItem.amount}
                        </span>
                    </div>
                    {selectedItem.submittedOn && (
                        <div className="ld-cm-modal-row">
                            <span className="ld-cm-modal-label">Submitted On</span>
                            <span className="ld-cm-modal-val">{selectedItem.submittedOn}</span>
                        </div>
                    )}
                    {selectedItem.examScheduledOn && (
                        <div className="ld-cm-modal-row">
                            <span className="ld-cm-modal-label">Exam Scheduled On</span>
                            <span className="ld-cm-modal-val">{selectedItem.examScheduledOn}</span>
                        </div>
                    )}
                    <div className="ld-cm-modal-row">
                        <span className="ld-cm-modal-label">Status</span>
                        <span className="ld-cm-modal-val">{selectedItem.status || "—"}</span>
                    </div>
                </div>

                <div className="ld-cm-modal-footer">
                    <button
                        type="button"
                        className="ld-cm-modal-ok-btn"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
