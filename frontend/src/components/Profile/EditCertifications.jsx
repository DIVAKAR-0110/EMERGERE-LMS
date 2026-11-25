import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Plus, Check, X, ChevronDown, Search } from "lucide-react";
import viewIcon from "../../assets/coursemanagement/eye.svg";
import CertificateViewerModal from "./CertificateViewerModal";
import deleteIcon from "../../assets/Profile/delete.svg";
import AddCertificationModal from "./AddCertificationModal";
import DeleteCertificationModal from "./DeleteCertificationModal";
import AlertDialog from "../common/AlertDialog";
import { deleteCertificateRecord } from "../../services/profileService";
import "../../styles/Profile.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const LEARNING_TOPIC_OPTIONS = [
    "Software Development",
    "Data & Analytics",
    "AI & Machine Learning",
    "Cloud Computing",
    "Cybersecurity",
    "DevOps & Infrastructure",
    "Project Management",
    "Leadership & Management",
    "Communication & Collaboration",
    "Business & Domain Skills"
];

function capitalizeFirstLetter(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const formatCertDate = (dateVal) => {
    if (!dateVal || dateVal === "—" || dateVal === "-") return "";
    try {
        const str = String(dateVal).trim();
        if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return "";
        if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(str)) return str;

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const year = isoMatch[1];
            const monthIdx = parseInt(isoMatch[2], 10) - 1;
            const day = isoMatch[3];
            const mon = months[monthIdx];
            if (mon) {
                return `${day} ${mon} ${year}`;
            }
        }

        const d = new Date(str.includes("-") && !str.includes("T") ? str.replace(/-/g, "/") : str);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, "0");
            const mon = months[d.getMonth()];
            const year = d.getFullYear();
            return `${day} ${mon} ${year}`;
        }
    } catch { }
    return String(dateVal);
};

export default function EditCertifications({
    learningCertifications,
    onChange,
    errors = {},
}) {
    const displayCertifications = (learningCertifications?.certifications || []).filter((cert) => {
        const rawType = String(
            cert.certificateType ||
            cert.type ||
            ""
        ).toLowerCase();
        return !rawType.includes("course completion") && !rawType.includes("course certificate");
    });

    const [isAddCertOpen, setIsAddCertOpen] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [certToDelete, setCertToDelete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: "", message: "", type: "error" });

    /* -- Certificate Viewer State -- */
    const [viewingCert, setViewingCert] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerUrl, setViewerUrl] = useState("");
    const [isViewerLoading, setIsViewerLoading] = useState(false);
    const [viewerError, setViewerError] = useState("");

    /* -- Topic Dropdown State -- */
    const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
    const [isAddingCustomTopic, setIsAddingCustomTopic] = useState(false);
    const [customTopicInput, setCustomTopicInput] = useState("");
    const [topicSearchQuery, setTopicSearchQuery] = useState("");
    const topicDropdownRef = useRef(null);
    const customTopicInputRef = useRef(null);

    /* -- Click outside and Escape key listener -- */
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                topicDropdownRef.current &&
                !topicDropdownRef.current.contains(e.target)
            ) {
                setIsTopicDropdownOpen(false);
                setIsAddingCustomTopic(false);
                setTopicSearchQuery("");
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isTopicDropdownOpen) {
                setIsTopicDropdownOpen(false);
                setIsAddingCustomTopic(false);
                setTopicSearchQuery("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isTopicDropdownOpen]);

    useEffect(() => {
        if (isAddingCustomTopic && customTopicInputRef.current) {
            customTopicInputRef.current.focus();
        }
    }, [isAddingCustomTopic]);

    const handleAddCertification = (newCert) => {
        const currentCerts = learningCertifications.certifications || [];
        onChange({
            ...learningCertifications,
            certifications: [...currentCerts, newCert],
        });
    };

    const handleViewCertification = async (cert) => {
        try {
            const rawFilePath = cert.certificateUrl || cert.certificate_file_path || cert.certificateFileName || "";
            const extractedFileName = rawFilePath ? rawFilePath.split("/").pop().split("\\").pop() : "";
            const certWithFile = {
                ...cert,
                certificateFileName: cert.certificateFileName || extractedFileName,
            };

            setViewingCert(certWithFile);
            setIsViewerOpen(true);
            setIsViewerLoading(true);
            setViewerError("");
            setViewerUrl("");

            const certUrl = cert.certificateUrl || cert.certificate_file_path;
            const rawId = cert.id || cert.cert_id || cert.certification_id;
            const cleanId = rawId ? String(rawId).replace("cert-", "").trim() : null;
            const numericId = cleanId && !isNaN(Number(cleanId)) ? Number(cleanId) : null;

            // 1. If it's an in-memory blob or data URL, use directly
            if (certUrl && (certUrl.startsWith("blob:") || certUrl.startsWith("data:"))) {
                setViewerUrl(certUrl);
                setIsViewerLoading(false);
                return;
            }

            // 2. If it's a numeric ID, fetch blob from backend download endpoint
            if (numericId) {
                try {
                    const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP004";
                    const token = localStorage.getItem("lms_token") || `dev-token-${activeEmpId}`;
                    const res = await axios.get(`${API_BASE_URL}/api/employee/certifications/${numericId}/download`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "x-employee-id": activeEmpId,
                        },
                        responseType: "blob",
                    });
                    const ext = (extractedFileName || cert.certificateFileName || cert.fileName || "pdf").split(".").pop().toLowerCase();
                    const mimeType = res.data.type || (ext === "png" ? "image/png" : (ext === "jpg" || ext === "jpeg") ? "image/jpeg" : "application/pdf");
                    const blob = new Blob([res.data], { type: mimeType });
                    const blobUrl = window.URL.createObjectURL(blob);
                    setViewerUrl(blobUrl);
                    setIsViewerLoading(false);
                    return;
                } catch (apiErr) {
                    console.warn("Backend certificate blob fetch failed, falling back to static URL:", apiErr);
                }
            }

            // 3. Fallback to direct static URL if available
            if (certUrl && certUrl !== "#") {
                const targetUrl = certUrl.startsWith("http")
                    ? certUrl
                    : `${API_BASE_URL}${certUrl.startsWith("/") ? "" : "/"}${certUrl}`;
                setViewerUrl(targetUrl);
                setIsViewerLoading(false);
                return;
            }

            // No document found
            setIsViewerLoading(false);
            setViewerError(`No certificate document file is available for "${cert.name || "this certification"}".`);
        } catch (err) {
            console.error("Failed to view certificate:", err);
            setIsViewerLoading(false);
            setViewerError(err.message || "Failed to load certificate document.");
        }
    };

    const handleOpenDeleteModal = (cert) => {
        setCertToDelete(cert);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!certToDelete) return;

        try {
            setIsDeleting(true);
            setDeletingId(certToDelete.id);
            // If it's a persisted DB record, delete from backend
            if (certToDelete.id && !String(certToDelete.id).startsWith("temp-")) {
                await deleteCertificateRecord(certToDelete.id);
            }
            // Remove from local React state immediately
            const currentCerts = learningCertifications.certifications || [];
            onChange({
                ...learningCertifications,
                certifications: currentCerts.filter((c) => c.id !== certToDelete.id),
            });
            setIsDeleteModalOpen(false);
            setCertToDelete(null);
        } catch (err) {
            console.error("Failed to delete certificate:", err);
            const msg = err.response?.data?.detail || err.message || "Failed to delete certificate.";
            setAlertDialog({
                isOpen: true,
                title: "Error Deleting Certificate",
                message: typeof msg === "string" ? msg : JSON.stringify(msg),
                type: "error",
            });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    const handleCloseDeleteModal = () => {
        if (isDeleting) return;
        setIsDeleteModalOpen(false);
        setCertToDelete(null);
    };

    const selectedInterests = learningCertifications.learningInterests || [];

    const handleToggleInterest = (interest) => {
        if (selectedInterests.includes(interest)) {
            onChange({
                ...learningCertifications,
                learningInterests: selectedInterests.filter((i) => i !== interest),
            });
        } else {
            onChange({
                ...learningCertifications,
                learningInterests: [...selectedInterests, interest],
            });
        }
    };

    const handleRemoveInterest = (interestToRemove) => {
        onChange({
            ...learningCertifications,
            learningInterests: selectedInterests.filter((i) => i !== interestToRemove),
        });
    };

    const handleAddCustomTopic = () => {
        const formatted = capitalizeFirstLetter(customTopicInput.trim());
        if (formatted && !selectedInterests.includes(formatted)) {
            onChange({
                ...learningCertifications,
                learningInterests: [...selectedInterests, formatted],
            });
        }
        setCustomTopicInput("");
        setIsAddingCustomTopic(false);
    };

    const filteredPredefinedTopics = LEARNING_TOPIC_OPTIONS.filter((t) =>
        t.toLowerCase().includes(topicSearchQuery.trim().toLowerCase())
    );

    return (
        <div className="edit-step-container">
            {/* Certifications Top Row */}
            <div className="edit-certs-header-row">
                <div className="step-section-title-group">
                    <h3 className="step-section-heading">Certifications</h3>
                    <p className="step-section-subtext">
                        Add the certifications you have earned.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn-add-cert-outline"
                    onClick={() => setIsAddCertOpen(true)}
                >
                    <span>+ Add Certification</span>
                </button>
            </div>

            {/* Certifications Table */}
            <div className="edit-certs-table-wrapper">
                <table className="edit-certs-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Issuer</th>
                            <th>Issue Date</th>
                            <th>Expiry Date</th>
                            <th>Certificate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayCertifications.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: "center", color: "#7F7F7F", padding: "16px" }}>
                                    No certifications added yet. Click &quot;+ Add Certification&quot; above.
                                </td>
                            </tr>
                        ) : (
                            displayCertifications.map((cert) => (
                                <tr key={cert.id}>
                                    <td style={{ fontWeight: 400 }} title={cert.name}>
                                        <span
                                            className="profile-cert-name-clickable"
                                            onClick={() => handleViewCertification(cert)}
                                            title={`View ${cert.name}`}
                                        >
                                            {cert.name}
                                        </span>
                                    </td>
                                    <td title={cert.issuer}>{cert.issuer}</td>
                                    <td>{formatCertDate(cert.issueDate)}</td>
                                    <td>{formatCertDate(cert.expiryDate)}</td>
                                    <td>
                                        <div className="cert-actions-group">
                                            <button
                                                type="button"
                                                className="cert-action-icon-btn view-btn"
                                                title="View Certificate"
                                                disabled={deletingId === cert.id}
                                                onClick={() => handleViewCertification(cert)}
                                            >
                                                <img
                                                    src={viewIcon}
                                                    alt="View"
                                                    style={{
                                                        width: "13px",
                                                        height: "9px",
                                                        objectFit: "contain",
                                                    }}
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                className="cert-action-icon-btn del-btn"
                                                title="Delete Certificate"
                                                disabled={deletingId === cert.id || isDeleting}
                                                onClick={() => handleOpenDeleteModal(cert)}
                                            >
                                                <img
                                                    src={deleteIcon}
                                                    alt="Delete"
                                                    style={{
                                                        width: "12px",
                                                        height: "12px",
                                                        opacity: deletingId === cert.id ? 0.4 : 1,
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="edit-step-divider" />

            {/* Which areas would you like to learn more about? (Select Dropdown) */}
            <div className="edit-form-field area-field-container" ref={topicDropdownRef}>
                <div className="area-field-header">
                    <div className="step-section-title-group" style={{ gap: "3px" }}>
                        <label className="step-section-heading">
                            Which areas would you like to learn more about? <span className="req">*</span>
                        </label>
                        <p className="step-section-subtext">
                            Select the areas you&apos;d like to develop through your learning.
                        </p>
                    </div>
                </div>

                {/* Select Box Trigger & Dropdown Menu */}
                <div className="learning-areas-select-wrapper">
                    <div
                        className={`learning-areas-select-box ${isTopicDropdownOpen ? "open" : ""} ${errors?.learningInterests ? "input-error" : ""}`}
                        onClick={() => {
                            setIsTopicDropdownOpen((prev) => !prev);
                            setIsAddingCustomTopic(false);
                        }}
                    >
                        {selectedInterests.length === 0 ? (
                            <span className="placeholder-text">Select areas</span>
                        ) : (
                            <div className="learning-areas-select-content">
                                {selectedInterests.map((topic) => (
                                    <span
                                        key={topic}
                                        className="skill-tag-chip"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="chip-text">{topic}</span>
                                        <button
                                            type="button"
                                            className="skill-tag-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveInterest(topic);
                                            }}
                                            title={`Remove ${topic}`}
                                            aria-label={`Remove ${topic}`}
                                        >
                                            <X size={12} strokeWidth={2.5} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <ChevronDown
                            size={16}
                            className="learning-areas-select-chevron"
                            style={{
                                transform: isTopicDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                        />
                    </div>

                    {/* Dropdown popup menu with clean header, close button, search, and toggle items */}
                    {isTopicDropdownOpen && (
                        <div className="area-popup-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                            {/* Header with Title and Close (X) button */}
                            <div className="area-popup-header">
                                <div className="area-popup-header-title">
                                    <span>Select Learning Areas</span>
                                    {selectedInterests.length > 0 && (
                                        <span className="area-popup-count-badge">
                                            {selectedInterests.length} selected
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="area-popup-close-btn"
                                    onClick={() => {
                                        setIsTopicDropdownOpen(false);
                                        setIsAddingCustomTopic(false);
                                        setTopicSearchQuery("");
                                    }}
                                    title="Close"
                                    aria-label="Close dropdown"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Options List */}
                            <div className="area-popup-options-list">
                                {filteredPredefinedTopics.length === 0 ? (
                                    <div className="area-popup-empty">
                                        No matching predefined areas. Add custom area below!
                                    </div>
                                ) : (
                                    filteredPredefinedTopics.map((opt) => {
                                        const isSelected = selectedInterests.includes(opt);
                                        return (
                                            <div
                                                key={opt}
                                                className={`area-popup-option-item ${isSelected ? "selected" : ""}`}
                                                onClick={() => handleToggleInterest(opt)}
                                            >
                                                <div className="area-popup-option-left">
                                                    <div className={`area-popup-checkbox ${isSelected ? "checked" : ""}`}>
                                                        {isSelected && <Check size={11} strokeWidth={3} />}
                                                    </div>
                                                    <span className="area-popup-option-text">{opt}</span>
                                                </div>
                                                {isSelected && (
                                                    <span className="area-popup-selected-tag">Added ✓</span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}

                                {/* Other custom topic toggle */}
                                {!isAddingCustomTopic && (
                                    <div
                                        className="area-popup-option-item area-popup-other-item"
                                        onClick={() => setIsAddingCustomTopic(true)}
                                    >
                                        <div className="area-popup-option-left">
                                            <Plus size={13} color="#215EF8" />
                                            <span>Other (Type custom area)</span>
                                        </div>
                                    </div>
                                )}

                                {/* Custom topic input row */}
                                {isAddingCustomTopic && (
                                    <div
                                        className="area-other-dropdown-input-row"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            ref={customTopicInputRef}
                                            type="text"
                                            className="area-other-dropdown-input"
                                            placeholder="Type custom area…"
                                            value={customTopicInput}
                                            maxLength={50}
                                            onChange={(e) =>
                                                setCustomTopicInput(capitalizeFirstLetter(e.target.value))
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddCustomTopic();
                                                } else if (e.key === "Escape") {
                                                    setIsAddingCustomTopic(false);
                                                    setCustomTopicInput("");
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className="btn-add-skill-inline"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={handleAddCustomTopic}
                                        >
                                            Add
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer with Search input and Done button */}
                            <div className="area-popup-footer">
                                <div className="area-footer-search-wrapper">
                                    <Search size={13} color="#94A3B8" />
                                    <input
                                        type="text"
                                        className="area-footer-search-input"
                                        placeholder="Search areas..."
                                        value={topicSearchQuery}
                                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                                    />
                                    {topicSearchQuery && (
                                        <button
                                            type="button"
                                            className="area-popup-search-clear"
                                            onClick={() => setTopicSearchQuery("")}
                                            title="Clear search"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="area-popup-done-btn"
                                    onClick={() => {
                                        setIsTopicDropdownOpen(false);
                                        setIsAddingCustomTopic(false);
                                        setTopicSearchQuery("");
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {errors?.learningInterests && (
                    <span className="edit-form-error">{errors.learningInterests}</span>
                )}
                <p className="skills-box-hint">Choose one or more areas</p>
            </div>

            {/* Sub-modal to add certification */}
            <AddCertificationModal
                isOpen={isAddCertOpen}
                onClose={() => setIsAddCertOpen(false)}
                onSave={handleAddCertification}
            />

            {/* Certificate Document Viewer Modal */}
            <CertificateViewerModal
                isOpen={isViewerOpen}
                onClose={() => {
                    setIsViewerOpen(false);
                    setViewingCert(null);
                    setViewerUrl("");
                    setViewerError("");
                }}
                cert={viewingCert}
                previewUrl={viewerUrl}
                isLoading={isViewerLoading}
                errorMessage={viewerError}
            />

            {/* Delete Certification Confirmation Modal */}
            <DeleteCertificationModal
                isOpen={isDeleteModalOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
                certName={certToDelete?.name}
                isDeleting={isDeleting}
            />

            {alertDialog.isOpen && (
                <AlertDialog
                    isOpen={alertDialog.isOpen}
                    onClose={() => setAlertDialog((prev) => ({ ...prev, isOpen: false }))}
                    title={alertDialog.title || "Alert"}
                    message={alertDialog.message}
                    type={alertDialog.type || "error"}
                />
            )}
        </div >
    );
}

