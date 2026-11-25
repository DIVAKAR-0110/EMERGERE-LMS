import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { X, FileText, ChevronDown } from "lucide-react";
import addimageIcon from "../../assets/Profile/addimage.svg";
import EmpDatePicker from "../employee/Certification/EmpDatePicker";

import downArrowIcon from "../../assets/course_library/down_arrow.svg";
import "../../styles/Profile.css";
import { validateCustomMetadataEntry } from "../../constants/courseMetadata";
import useCourseMetadata from "../../hooks/useCourseMetadata";
import { resolveAndPersistFormMetadata } from "../../services/courseMetadataService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const validateCertificationId = (val) => {
    const trimmed = (val || "").trim();
    if (!trimmed) return "Certification ID is required.";
    if (trimmed.length < 3) return "Certification ID must be at least 3 characters.";
    if (trimmed.length > 50) return "Certification ID must not exceed 50 characters.";
    if (/[^a-zA-Z0-9\-\/]/.test(trimmed)) return "Only letters, numbers, -, and / are allowed.";
    return "";
};

const formatDisplayDate = (dStr) => {
    if (!dStr) return "";
    try {
        const date = new Date(dStr);
        if (isNaN(date.getTime())) return dStr;
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dStr;
    }
};

export default function AddCertificationModal({ isOpen, onClose, onSave }) {
    const [name, setName] = useState("");
    const [credentialId, setCredentialId] = useState("");
    const { providers: liveProviders, categories: liveCategories } = useCourseMetadata(undefined, isOpen);
    const providers = liveProviders.filter((p) => p.name?.toLowerCase() !== "other");
    const domains = liveCategories.filter((c) => c.name?.toLowerCase() !== "other");
    const [issuer, setIssuer] = useState("");
    const [customIssuer, setCustomIssuer] = useState("");
    const [isIssuerOpen, setIsIssuerOpen] = useState(false);
    const [domain, setDomain] = useState("");
    const [customDomain, setCustomDomain] = useState("");
    const [isDomainOpen, setIsDomainOpen] = useState(false);
    const [issueDate, setIssueDate] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const fileInputRef = useRef(null);
    const issuerDropdownRef = useRef(null);
    const domainDropdownRef = useRef(null);
    const submittingRef = useRef(false);

    // Reset fields when modal is closed
    useEffect(() => {
        if (!isOpen) {
            setName("");
            setCredentialId("");
            setIssuer("");
            setCustomIssuer("");
            setIsIssuerOpen(false);
            setDomain("");
            setCustomDomain("");
            setIsDomainOpen(false);
            setIssueDate("");
            setExpiryDate("");
            setFile(null);
            setErrors({});
            setServerError("");
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (issuerDropdownRef.current && !issuerDropdownRef.current.contains(e.target)) {
                setIsIssuerOpen(false);
            }
            if (domainDropdownRef.current && !domainDropdownRef.current.contains(e.target)) {
                setIsDomainOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            if (selected.size > 5 * 1024 * 1024) {
                setErrors((prev) => ({ ...prev, file: "File size exceeds 5MB limit." }));
                setFile(null);
                return;
            }
            setFile(selected);
            setErrors((prev) => ({ ...prev, file: "" }));
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files[0];
        if (dropped) {
            if (dropped.size > 5 * 1024 * 1024) {
                setErrors((prev) => ({ ...prev, file: "File size exceeds 5MB limit." }));
                setFile(null);
                return;
            }
            setFile(dropped);
            setErrors((prev) => ({ ...prev, file: "" }));
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submittingRef.current || isUploading) return;
        const finalIssuer = issuer === "Other" ? customIssuer.trim() : issuer;
        const finalDomain = domain === "Other" ? customDomain.trim() : (domain || "").trim();
        const trimmedCredentialId = credentialId.trim();

        const newErrors = {};
        if (!name.trim()) {
            newErrors.name = "Certification Name is required.";
        }
        const credentialIdErr = validateCertificationId(trimmedCredentialId);
        if (credentialIdErr) {
            newErrors.credentialId = credentialIdErr;
        }
        if (!issuer) {
            newErrors.issuer = "Issuer organization is required.";
        } else if (issuer === "Other") {
            const customIssuerErr = validateCustomMetadataEntry(customIssuer, providers, "issuer");
            if (customIssuerErr) {
                newErrors.customIssuer = customIssuerErr;
            }
        }
        if (!domain) {
            newErrors.domain = "Certification Domain is required.";
        } else if (domain === "Other") {
            const customDomainErr = validateCustomMetadataEntry(customDomain, domains, "domain");
            if (customDomainErr) {
                newErrors.customDomain = customDomainErr;
            }
        }
        if (!issueDate) {
            newErrors.issueDate = "Issue Date is required.";
        }
        if (!expiryDate) {
            newErrors.expiryDate = "Expiry Date is required.";
        } else if (issueDate && expiryDate < issueDate) {
            newErrors.expiryDate = "Expiry Date cannot be earlier than Issue Date.";
        }
        if (!file) {
            newErrors.file = "Certificate file is required.";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        submittingRef.current = true;
        setIsUploading(true);
        setErrors({});
        setServerError("");

        try {
            const token = localStorage.getItem("lms_token") || "dev-token-EMP001";
            const resolvedMeta = await resolveAndPersistFormMetadata({
                provider: finalIssuer,
                isCustomProvider: issuer === "Other",
                category: finalDomain,
                isCustomCategory: domain === "Other",
                explicitToken: token,
            });
            const resolvedIssuer = resolvedMeta.provider || finalIssuer;
            const resolvedDomain = resolvedMeta.category || finalDomain;

            let savedCertId = Date.now();
            let savedCertUrl = file ? URL.createObjectURL(file) : "#";
            let savedFileName = file ? file.name : "certificate.pdf";
            let savedFileSize = file ? file.size : 0;
            let savedCredentialId = trimmedCredentialId;

            if (file) {
                const formData = new FormData();
                formData.append("title", name.trim());
                formData.append("type", "Professional Certification");
                formData.append("certificate_type", `${resolvedIssuer} | Professional Certification`);
                formData.append("credentialId", trimmedCredentialId);
                formData.append("certificate_id", trimmedCredentialId);
                formData.append("provider", resolvedIssuer);
                formData.append("provider_name", resolvedIssuer);
                formData.append("issuer", resolvedIssuer);
                formData.append("domain", resolvedDomain);
                formData.append("certification_domain", resolvedDomain);
                formData.append("issueDate", issueDate);
                formData.append("expiryDate", expiryDate);
                formData.append("certificate_file", file);

                const response = await axios.post(`${API_BASE_URL}/api/employee/certifications`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data",
                    },
                });

                const data = response.data;
                savedCertId = data.certification_id || (data.id ? Number(String(data.id).replace("cert-", "")) : Date.now());
                savedCertUrl = data.certificateUrl || data.certificate_file_path || savedCertUrl;
                savedFileName = data.certificateFileName || file.name;
                savedCredentialId = data.credentialId || data.certificate_id || trimmedCredentialId;
            }

            const newCert = {
                id: savedCertId,
                name: name.trim(),
                credentialId: savedCredentialId,
                certificate_id: savedCredentialId,
                issuer: resolvedIssuer,
                domain: resolvedDomain,
                certification_domain: resolvedDomain,
                issueDate: formatDisplayDate(issueDate),
                expiryDate: formatDisplayDate(expiryDate),
                certificateUrl: savedCertUrl,
                certificateFileName: savedFileName,
                certificateFileSize: savedFileSize,
                certificateType: "Professional Certification",
            };

            onSave(newCert);
            onClose();
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Failed to upload certificate:", err);
            const msg = err.response?.data?.detail || err.message || "Failed to upload certificate.";
            setServerError(typeof msg === "string" ? msg : JSON.stringify(msg));
        } finally {
            submittingRef.current = false;
            setIsUploading(false);
        }
    };

    return createPortal(
        <div className="add-cert-overlay">
            <div className="add-cert-card" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="add-cert-header">
                    <h3 className="add-cert-title">Add Certifications</h3>
                    <p className="add-cert-subtitle">Add the certification details you have earned.</p>
                    <button
                        type="button"
                        className="add-cert-close-btn"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={20} color="#0F172A" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="add-cert-body">
                        {serverError && <span className="edit-form-error" style={{ marginBottom: "10px" }}>{serverError}</span>}

                        {/* Certification Name & Certification ID (2-column) */}
                        <div className="add-cert-grid-2col">
                            <div className="edit-form-field">
                                <label className="edit-form-label">
                                    Certification Name<span className="req">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`add-cert-input ${errors.name ? "input-error" : ""}`}
                                    placeholder="e.g., AWS Certified Solution Architect"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                                    }}
                                />
                                {errors.name && <span className="edit-form-error">{errors.name}</span>}
                            </div>

                            <div className="edit-form-field">
                                <label className="edit-form-label">
                                    Certification ID<span className="req">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`add-cert-input ${errors.credentialId ? "input-error" : ""}`}
                                    placeholder="Enter certification ID"
                                    maxLength={50}
                                    value={credentialId}
                                    onChange={(e) => {
                                        const filtered = e.target.value.replace(/[^a-zA-Z0-9\-\/]/g, "").slice(0, 50);
                                        setCredentialId(filtered);
                                        if (errors.credentialId) {
                                            setErrors((prev) => ({ ...prev, credentialId: validateCertificationId(filtered) }));
                                        }
                                    }}
                                />
                                {errors.credentialId && <span className="edit-form-error">{errors.credentialId}</span>}
                            </div>
                        </div>

                        {/* Issuer & Certification Domains (2-column) */}

                        <div className="add-cert-grid-2col">

                            {/* Issuer Professional Dropdown / Input */}

                            <div

                                className="edit-form-field"

                                ref={issuerDropdownRef}

                                style={{ position: "relative", zIndex: isIssuerOpen ? 50 : 2 }}

                            >

                                <div className="add-cert-label-row">

                                    <label className="edit-form-label" style={{ marginBottom: 0 }}>

                                        Issuer<span className="req">*</span>

                                    </label>

                                    {issuer === "Other" && (

                                        <button

                                            type="button"

                                            className="add-cert-btn-switch-preset"

                                            onClick={() => {

                                                setIssuer("");

                                                setCustomIssuer("");

                                                if (errors.issuer || errors.customIssuer) {

                                                    setErrors((prev) => ({ ...prev, issuer: "", customIssuer: "" }));

                                                }

                                            }}

                                        >

                                            ← Back to presets

                                        </button>

                                    )}

                                </div>



                                {issuer !== "Other" ? (

                                    <>

                                        <div

                                            className={`add-cert-select-box ${isIssuerOpen ? "open" : ""} ${errors.issuer ? "input-error" : ""}`}

                                            onClick={() => {

                                                setIsIssuerOpen((prev) => !prev);

                                                setIsDomainOpen(false);

                                            }}

                                        >

                                            <span className={issuer ? "selected-text" : "placeholder-text"}>

                                                {issuer || "Select issuing organization"}

                                            </span>

                                            <img

                                                src={downArrowIcon}

                                                alt=""

                                                className={`add-cert-select-chevron ${isIssuerOpen ? "open" : ""}`}

                                            />

                                        </div>



                                        {/* Dropdown Options List */}

                                        {isIssuerOpen && (

                                            <div className="add-cert-issuer-dropdown">

                                                {providers.length === 0 ? (

                                                    <div className="add-cert-issuer-option" style={{ color: "#94A3B8" }}>

                                                        Loading providers...

                                                    </div>

                                                ) : (

                                                    providers.map((prov) => (

                                                        <div

                                                            key={prov.provider_name || prov.name}

                                                            className={`add-cert-issuer-option ${issuer === (prov.provider_name || prov.name) ? "selected" : ""}`}

                                                            onClick={() => {

                                                                setIssuer(prov.provider_name || prov.name);

                                                                setIsIssuerOpen(false);

                                                                if (errors.issuer) setErrors((prev) => ({ ...prev, issuer: "" }));

                                                            }}

                                                        >

                                                            {prov.name || prov.provider_name}

                                                        </div>

                                                    ))

                                                )}

                                                <div

                                                    key="Other"

                                                    className={`add-cert-issuer-option ${issuer === "Other" ? "selected" : ""}`}

                                                    onClick={() => {

                                                        setIssuer("Other");

                                                        setCustomIssuer("");

                                                        setIsIssuerOpen(false);

                                                        if (errors.issuer) setErrors((prev) => ({ ...prev, issuer: "" }));

                                                    }}

                                                >

                                                    Other

                                                </div>

                                            </div>

                                        )}

                                        {errors.issuer && <span className="edit-form-error">{errors.issuer}</span>}

                                    </>

                                ) : (

                                    <>

                                        <input

                                            type="text"

                                            className={`add-cert-input ${errors.issuer || errors.customIssuer ? "input-error" : ""}`}

                                            placeholder="Enter issuing organization name (e.g. AWS, Microsoft, Google)"

                                            value={customIssuer}

                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCustomIssuer(val);
                                                const dupErr = val.trim() ? validateCustomMetadataEntry(val, providers, "issuer") : "";
                                                setErrors((prev) => ({ ...prev, issuer: "", customIssuer: dupErr }));
                                            }}

                                            autoFocus

                                        />

                                        {(errors.issuer || errors.customIssuer) && (

                                            <span className="edit-form-error">{errors.customIssuer || errors.issuer}</span>

                                        )}

                                    </>

                                )}

                            </div>



                            {/* Certification Domains Dropdown */}

                            <div

                                className="edit-form-field"

                                ref={domainDropdownRef}

                                style={{ position: "relative", zIndex: isDomainOpen ? 50 : 2 }}

                            >

                                <div className="add-cert-label-row">
                                    <label className="edit-form-label" style={{ marginBottom: 0 }}>
                                        Certification Domains<span className="req">*</span>
                                    </label>
                                    {domain === "Other" && (
                                        <button
                                            type="button"
                                            className="add-cert-back-btn"
                                            onClick={() => {
                                                setDomain("");
                                                setCustomDomain("");
                                                setErrors((prev) => ({ ...prev, domain: "", customDomain: "" }));
                                            }}
                                        >
                                            ← Back to presets
                                        </button>
                                    )}
                                </div>

                                {domain !== "Other" ? (
                                    <>
                                        <div
                                            className={`add-cert-select-box ${isDomainOpen ? "open" : ""} ${errors.domain ? "input-error" : ""}`}
                                            onClick={() => {
                                                setIsDomainOpen((prev) => !prev);
                                                setIsIssuerOpen(false);
                                            }}
                                        >
                                            <span className={domain ? "selected-text" : "placeholder-text"}>
                                                {domain || "Select domain"}
                                            </span>
                                            <img
                                                src={downArrowIcon}
                                                alt=""
                                                className={`add-cert-select-chevron ${isDomainOpen ? "open" : ""}`}
                                            />
                                        </div>

                                        {isDomainOpen && (
                                            <div className="add-cert-issuer-dropdown">
                                                {domains.map((domObj) => {
                                                    const dom = domObj.category_name || domObj.name;
                                                    return (
                                                        <div
                                                            key={domObj.id || dom}
                                                            className={`add-cert-issuer-option ${domain === dom ? "selected" : ""}`}
                                                            onClick={() => {
                                                                setDomain(dom);
                                                                setIsDomainOpen(false);
                                                                if (errors.domain) setErrors((prev) => ({ ...prev, domain: "" }));
                                                            }}
                                                        >
                                                            {dom}
                                                        </div>
                                                    );
                                                })}
                                                <div
                                                    key="Other"
                                                    className={`add-cert-issuer-option ${domain === "Other" ? "selected" : ""}`}
                                                    onClick={() => {
                                                        setDomain("Other");
                                                        setCustomDomain("");
                                                        setIsDomainOpen(false);
                                                        if (errors.domain) setErrors((prev) => ({ ...prev, domain: "" }));
                                                    }}
                                                >
                                                    Other
                                                </div>
                                            </div>
                                        )}

                                        {errors.domain && <span className="edit-form-error">{errors.domain}</span>}
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            className={`add-cert-input ${errors.domain || errors.customDomain ? "input-error" : ""}`}
                                            placeholder="Enter certification domain (e.g. Data Engineering, FinOps)"
                                            value={customDomain}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCustomDomain(val);
                                                const dupErr = val.trim() ? validateCustomMetadataEntry(val, domains, "domain") : "";
                                                setErrors((prev) => ({ ...prev, domain: "", customDomain: dupErr }));
                                            }}
                                            autoFocus
                                        />
                                        {(errors.domain || errors.customDomain) && (
                                            <span className="edit-form-error">{errors.customDomain || errors.domain}</span>
                                        )}
                                    </>
                                )}

                            </div>

                        </div>



                        {/* Issue Date & Expiry Date (2-column) */}
                        <div className="add-cert-grid-2col" style={{ position: "relative", zIndex: 10 }}>
                            {/* Issue Date */}
                            <div className="edit-form-field">
                                <label className="edit-form-label">
                                    Issue Date <span className="req">*</span>
                                </label>
                                <EmpDatePicker
                                    id="add-cert-issue-date"
                                    value={issueDate}
                                    placeholder="dd/mm/yyyy"
                                    onChange={(e) => {
                                        const val = e?.target?.value !== undefined ? e.target.value : e;
                                        setIssueDate(val);
                                        if (errors.issueDate) setErrors((prev) => ({ ...prev, issueDate: "" }));
                                    }}
                                    hasError={Boolean(errors.issueDate)}
                                />
                                {errors.issueDate && <span className="edit-form-error">{errors.issueDate}</span>}
                            </div>

                            {/* Expiry Date */}
                            <div className="edit-form-field">
                                <label className="edit-form-label">
                                    Expiry Date <span className="req">*</span>
                                </label>
                                <EmpDatePicker
                                    id="add-cert-expiry-date"
                                    value={expiryDate}
                                    min={issueDate || undefined}
                                    placeholder="dd/mm/yyyy"
                                    onChange={(e) => {
                                        const val = e?.target?.value !== undefined ? e.target.value : e;
                                        setExpiryDate(val);
                                        if (errors.expiryDate) setErrors((prev) => ({ ...prev, expiryDate: "" }));
                                    }}
                                    hasError={Boolean(errors.expiryDate)}
                                />
                                {errors.expiryDate && <span className="edit-form-error">{errors.expiryDate}</span>}
                            </div>
                        </div>

                        {/* Upload Certificate Area */}
                        <div className="edit-form-field">
                            <label className="edit-form-label">
                                Supported Document<span className="req">*</span>
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: "none" }}
                                onChange={handleFileChange}
                            />
                            <div
                                className={`add-cert-upload-box ${errors.file ? "input-error" : ""}`}
                                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                            >
                                <img src={addimageIcon} alt="" className="add-cert-cloud-icon" />
                                {file ? (
                                    <div className="add-cert-uploaded-file-row">
                                        <span className="add-cert-uploaded-green-text" title={file.name}>
                                            {file.name}
                                        </span>
                                        <button
                                            type="button"
                                            className="add-cert-remove-file-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = "";
                                            }}
                                            title="Remove file"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="upload-main-text">
                                        Drag and drop files here or <span className="browse-link">Browse Files</span>
                                    </p>
                                )}
                            </div>
                            <p className="upload-hint-text">Supports PDF, JPG, PNG (Max. 5MB)</p>
                            {errors.file && <span className="edit-form-error">{errors.file}</span>}
                        </div>

                        {/* Footer Actions */}
                        <div className="add-cert-footer">
                            <button type="button" className="btn-cert-cancel" onClick={onClose} disabled={isUploading}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-cert-save" disabled={isUploading}>
                                {isUploading ? "Uploading..." : "Save"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
