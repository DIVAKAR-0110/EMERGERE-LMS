import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Trash2, X } from "lucide-react";
import calIcon from "../../../assets/Certification/cal.svg";
import docIcon from "../../../assets/Certification/doc.svg";
import docUploadIcon from "../../../assets/Certification/docuplode.svg";
import uploadSuccessIcon from "../../../assets/Certification/uplodesuc.svg";
import closeIcon from "../../../assets/course_library/close.svg";
import downArrowIcon from "../../../assets/course_library/down_arrow.svg";
import scrollingIcon from "../../../assets/Certification/scrolling.svg";

import { validateCustomMetadataEntry } from "../../../constants/courseMetadata";
import useCourseMetadata from "../../../hooks/useCourseMetadata";
import { resolveAndPersistFormMetadata } from "../../../services/courseMetadataService";
import {
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    capitalizeFirstLetter,
} from "../../../utils/validationUtils";
import EmpModalSelect from "./EmpModalSelect";
import EmpDatePicker from "./EmpDatePicker";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function UploadCertificateModal({ isOpen, onClose, onUpload }) {
    const { providers: liveProviders, categories: liveCategories, domains: liveDomains } = useCourseMetadata(undefined, isOpen);
    const dbProviders = liveProviders.filter((p) => p.name?.toLowerCase() !== "other");
    const dbDomains = (liveDomains && liveDomains.length > 0 ? liveDomains : liveCategories).filter((c) => c.name?.toLowerCase() !== "other");
    const [formData, setFormData] = useState({
        title: "",
        type: "",
        provider_name: "",
        provider: "",
        domain: "",
        issueDate: "",
        expiryDate: "",
        credentialId: "",
        reimbursementRequested: false,
        reimbursementAmount: "",
    });

    const [isOtherProvider, setIsOtherProvider] = useState(false);
    const [otherProviderText, setOtherProviderText] = useState("");
    const otherProviderInputRef = useRef(null);

    const [isOtherDomain, setIsOtherDomain] = useState(false);
    const [otherDomainText, setOtherDomainText] = useState("");
    const otherDomainInputRef = useRef(null);


    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [thumbOffset, setThumbOffset] = useState(0);
    const [hasScroll, setHasScroll] = useState(false);
    const modalBodyRef = useRef(null);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const maxScroll = scrollHeight - clientHeight;
        const canScroll = maxScroll > 1;
        setHasScroll(canScroll);
        const maxTravel = Math.max(0, clientHeight - 60);
        if (canScroll) {
            setThumbOffset((scrollTop / maxScroll) * maxTravel);
        } else {
            setThumbOffset(0);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const checkScroll = () => {
            if (modalBodyRef.current) {
                const { scrollHeight, clientHeight } = modalBodyRef.current;
                const canScroll = scrollHeight > clientHeight + 1;
                setHasScroll(canScroll);
                if (!canScroll) {
                    setThumbOffset(0);
                }
            }
        };

        checkScroll();
        const timer = setTimeout(checkScroll, 50);

        let resizeObserver;
        if (window.ResizeObserver && modalBodyRef.current) {
            resizeObserver = new ResizeObserver(() => checkScroll());
            resizeObserver.observe(modalBodyRef.current);
        }

        window.addEventListener("resize", checkScroll);

        return () => {
            clearTimeout(timer);
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener("resize", checkScroll);
        };
    }, [isOpen]);

    const [certFile, setCertFile] = useState(null);
    const [supportingFiles, setSupportingFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);

    const fileInputRef = useRef(null);
    const supportingFileInputRef = useRef(null);
    const submittingRef = useRef(false);

    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Auto-focus "Other" provider and domain input fields
    useEffect(() => {
        if (isOtherProvider && otherProviderInputRef.current) {
            otherProviderInputRef.current.focus();
        }
    }, [isOtherProvider]);

    useEffect(() => {
        if (isOtherDomain && otherDomainInputRef.current) {
            otherDomainInputRef.current.focus();
        }
    }, [isOtherDomain]);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFormData({
                title: "",
                type: "",
                provider_name: "",
                provider: "",
                domain: "",
                issueDate: "",
                expiryDate: "",
                credentialId: "",
                reimbursementRequested: false,
                reimbursementAmount: "",
            });
            setIsOtherProvider(false);
            setOtherProviderText("");
            setIsOtherDomain(false);
            setOtherDomainText("");
            setErrors({});
            setTouched({});
            setCertFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSupportingFiles([]);
            setActiveMenuId(null);
            setSubmitError("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const todayStr = new Date().toISOString().split("T")[0];
    const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    // Validation rules
    const validateTitle = (val) => {
        const trimmed = (val || "").trim();
        if (!trimmed) {
            return "Certification Name is required.";
        }
        if (/\s{2,}/.test(val)) {
            return "Only a single space is allowed between words.";
        }
        if (trimmed.length < 2) {
            return "Certification Name must be at least 2 characters.";
        }
        if (trimmed.length > 100) {
            return "Certification Name must not exceed 100 characters.";
        }
        if (!/[a-zA-Z]/.test(trimmed)) {
            return "Certification Name must contain at least one letter.";
        }
        return "";
    };

    const validateType = (val) => {
        if (!val || !val.trim()) {
            return "Certificate Type is required.";
        }
        return "";
    };

    const validateProvider = (val, isOther, otherText) => {
        if (isOther) {
            return validateCustomMetadataEntry(otherText, dbProviders, "provider");
        }
        if (!val || !val.trim()) {
            return "Please select a Certifying Authority / Provider.";
        }
        return "";
    };

    const validateDomain = (val, isOther = isOtherDomain, otherText = otherDomainText) => {
        if (isOther) {
            return validateCustomMetadataEntry(otherText, dbDomains, "domain");
        }
        if (!val || !val.trim()) {
            return "Please select a Certification Domain.";
        }
        return "";
    };

    const validateCredentialId = (val, type = formData.type) => {
        const isProfessional = type === "Professional Certification";
        const fieldName = isProfessional ? "Certification ID" : "Certificate ID";
        const trimmed = (val || "").trim();
        if (isProfessional && !trimmed) {
            return "Certification ID is required.";
        }
        if (!trimmed) return "";
        if (trimmed.length < 3) {
            return `${fieldName} must be at least 3 characters.`;
        }
        if (trimmed.length > 50) {
            return `${fieldName} must not exceed 50 characters.`;
        }
        if (/[^a-zA-Z0-9\-\/]/.test(trimmed)) {
            return "Only letters, numbers, -, and / are allowed.";
        }
        return "";
    };

    const validateIssueDate = (val) => {
        const dateLabel = "Issue Date";
        if (!val) {
            return `${dateLabel} is required.`;
        }
        const parts = val.split("-");
        const year = parts[0];
        if (year) {
            if (year.length !== 4 || isNaN(year) || parseInt(year, 10) < 1900 || parseInt(year, 10) > 2099) {
                return "Year must be a valid 4-digit year.";
            }
        }
        if (val > todayStr) {
            return `${dateLabel} cannot be in the future.`;
        }
        return "";
    };

    const validateExpiryDate = (exp, issue, type = formData.type) => {
        if (type === "Professional Certification" && !exp) {
            return "Expiry Date is required.";
        }
        if (!exp) return "";
        const parts = exp.split("-");
        const year = parts[0];
        if (year) {
            if (year.length !== 4 || isNaN(year) || parseInt(year, 10) < 1900 || parseInt(year, 10) > 2099) {
                return "Year must be a valid 4-digit year (up to 2099).";
            }
        }
        if (issue && exp <= issue) {
            return "Expiry Date must be later than Issue Date.";
        }
        return "";
    };

    const validateCertFile = (file) => {
        if (!file) {
            return "Please upload a certificate.";
        }
        return "";
    };

    const handleTitleChange = (e) => {
        // Filter: only letters, numbers, spaces, -, &, .
        // Allow at most 1 space between words and disallow leading spaces
        const raw = e.target.value;
        const filtered = raw
            .replace(/[^a-zA-Z0-9\s\-&\.]/g, "")
            .replace(/^\s+/, "")
            .replace(/\s{2,}/g, " ")
            .slice(0, 100);
        const capitalized = capitalizeFirstLetter(filtered);
        setFormData((prev) => ({ ...prev, title: capitalized }));
        if (touched.title) {
            setErrors((prev) => ({ ...prev, title: validateTitle(capitalized) }));
        }
    };

    const handleTitlePaste = (e) => {
        handleSingleSpacePaste(e, 100, (pastedVal) => {
            const filtered = pastedVal
                .replace(/[^a-zA-Z0-9\s\-&\.]/g, "")
                .replace(/^\s+/, "")
                .replace(/\s{2,}/g, " ")
                .slice(0, 100);
            const capitalized = capitalizeFirstLetter(filtered);
            setFormData((prev) => ({ ...prev, title: capitalized }));
            if (touched.title) {
                setErrors((prev) => ({ ...prev, title: validateTitle(capitalized) }));
            }
        });
    };

    const handleTypeChange = (e) => {
        const val = e.target.value;
        setFormData((prev) => ({ ...prev, type: val }));
        setTouched((prev) => ({ ...prev, type: true }));
        setErrors((prev) => ({
            ...prev,
            type: "",
            credentialId: touched.credentialId
                ? validateCredentialId(formData.credentialId, val)
                : (val !== "Professional Certification" ? "" : prev.credentialId),
            issueDate: touched.issueDate
                ? validateIssueDate(formData.issueDate, val)
                : prev.issueDate,
            expiryDate: touched.expiryDate
                ? validateExpiryDate(formData.expiryDate, formData.issueDate, val)
                : (val !== "Professional Certification" ? "" : prev.expiryDate),
        }));
    };

    const handleProviderChange = (e) => {
        const val = e.target.value;
        if (val === "Other") {
            setIsOtherProvider(true);
            setFormData((prev) => ({
                ...prev,
                provider_name: otherProviderText.trim(),
                provider: otherProviderText.trim(),
            }));
            if (touched.provider && otherProviderText.trim()) {
                setErrors((prev) => ({ ...prev, provider: "" }));
            }
        } else {
            setIsOtherProvider(false);
            setFormData((prev) => ({
                ...prev,
                provider_name: val,
                provider: val,
            }));
            setTouched((prev) => ({ ...prev, provider: true }));
            setErrors((prev) => ({ ...prev, provider: "" }));
        }
    };

    const handleOtherProviderChange = (e) => {
        const raw = e.target.value
            .replace(/^\s+/, "")
            .replace(/\s{2,}/g, " ")
            .slice(0, 100);
        const val = capitalizeFirstLetter(raw);
        setOtherProviderText(val);
        setFormData((prev) => ({
            ...prev,
            provider_name: val,
            provider: val,
        }));
        const dupErr = val.trim() ? validateCustomMetadataEntry(val, dbProviders, "provider") : "";
        if (dupErr || touched.provider) {
            if (dupErr) setTouched((prev) => ({ ...prev, provider: true }));
            setErrors((prev) => ({ ...prev, provider: dupErr || (touched.provider ? validateProvider(val, true, val) : "") }));
        }
    };

    const handleResetProvider = () => {
        setIsOtherProvider(false);
        setOtherProviderText("");
        setFormData((prev) => ({
            ...prev,
            provider_name: "",
            provider: "",
        }));
        setErrors((prev) => ({ ...prev, provider: "" }));
    };

    const handleDomainChange = (e) => {
        const val = e.target.value;
        if (val === "Other") {
            setIsOtherDomain(true);
            setFormData((prev) => ({
                ...prev,
                domain: otherDomainText.trim(),
            }));
            if (touched.domain && otherDomainText.trim()) {
                setErrors((prev) => ({ ...prev, domain: "" }));
            }
        } else {
            setIsOtherDomain(false);
            setFormData((prev) => ({
                ...prev,
                domain: val,
            }));
            setTouched((prev) => ({ ...prev, domain: true }));
            setErrors((prev) => ({ ...prev, domain: "" }));
        }
    };

    const handleOtherDomainChange = (e) => {
        const raw = e.target.value
            .replace(/^\s+/, "")
            .replace(/\s{2,}/g, " ")
            .slice(0, 100);
        const val = capitalizeFirstLetter(raw);
        setOtherDomainText(val);
        setFormData((prev) => ({ ...prev, domain: val }));
        const dupErr = val.trim() ? validateCustomMetadataEntry(val, dbDomains, "domain") : "";
        if (dupErr || touched.domain) {
            if (dupErr) setTouched((prev) => ({ ...prev, domain: true }));
            setErrors((prev) => ({ ...prev, domain: dupErr || (touched.domain ? validateDomain(val, true, val) : "") }));
        }
    };

    const handleResetDomain = () => {
        setIsOtherDomain(false);
        setOtherDomainText("");
        setFormData((prev) => ({ ...prev, domain: "" }));
        setErrors((prev) => ({ ...prev, domain: "" }));
    };

    const handleCredentialIdChange = (e) => {
        // Filter: only letters, numbers, -, / (no spaces)
        const raw = e.target.value;
        const filtered = raw.replace(/[^a-zA-Z0-9\-\/]/g, "").slice(0, 50);
        setFormData((prev) => ({ ...prev, credentialId: filtered }));
        if (touched.credentialId) {
            setErrors((prev) => ({ ...prev, credentialId: validateCredentialId(filtered, formData.type) }));
        }
    };

    const handleIssueDateChange = (e) => {
        let val = e.target.value;
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setFormData((prev) => ({ ...prev, issueDate: val }));
        if (touched.issueDate) {
            setErrors((prev) => ({
                ...prev,
                issueDate: validateIssueDate(val),
                expiryDate: validateExpiryDate(formData.expiryDate, val, formData.type),
            }));
        }
    };

    const handleExpiryDateChange = (e) => {
        let val = e.target.value;
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setFormData((prev) => ({ ...prev, expiryDate: val }));
        if (touched.expiryDate || val) {
            setErrors((prev) => ({
                ...prev,
                expiryDate: validateExpiryDate(val, formData.issueDate, formData.type),
            }));
        }
    };

    const handleBlur = (field) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        if (field === "title") {
            const trimmedTitle = capitalizeFirstLetter((formData.title || "").trim());
            if (trimmedTitle !== formData.title) {
                setFormData((prev) => ({ ...prev, title: trimmedTitle }));
            }
            setErrors((prev) => ({ ...prev, title: validateTitle(trimmedTitle) }));
        } else if (field === "type") {
            setErrors((prev) => ({ ...prev, type: validateType(formData.type) }));
        } else if (field === "provider") {
            if (isOtherProvider) {
                const trimmed = capitalizeFirstLetter((otherProviderText || "").trim());
                if (trimmed !== otherProviderText) {
                    setOtherProviderText(trimmed);
                    setFormData((prev) => ({ ...prev, provider_name: trimmed, provider: trimmed }));
                }
            }
            setErrors((prev) => ({ ...prev, provider: validateProvider(formData.provider_name, isOtherProvider, otherProviderText) }));
        } else if (field === "domain") {
            if (isOtherDomain) {
                const trimmed = capitalizeFirstLetter((otherDomainText || "").trim());
                if (trimmed !== otherDomainText) {
                    setOtherDomainText(trimmed);
                    setFormData((prev) => ({ ...prev, domain: trimmed }));
                }
            }
            setErrors((prev) => ({ ...prev, domain: validateDomain(formData.domain) }));
        } else if (field === "credentialId") {
            setErrors((prev) => ({ ...prev, credentialId: validateCredentialId(formData.credentialId, formData.type) }));
        } else if (field === "issueDate") {
            setErrors((prev) => ({ ...prev, issueDate: validateIssueDate(formData.issueDate) }));
        } else if (field === "expiryDate") {
            setErrors((prev) => ({ ...prev, expiryDate: validateExpiryDate(formData.expiryDate, formData.issueDate, formData.type) }));
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };

    const handleCertificateFileChange = (file) => {
        if (!file) return;
        const ext = file.name.split(".").pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setErrors((prev) => ({ ...prev, certFile: "Only PDF, DOC, DOCX, JPG, and PNG files are allowed." }));
            setTouched((prev) => ({ ...prev, certFile: true }));
            setCertFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setErrors((prev) => ({ ...prev, certFile: "File size cannot exceed 5MB." }));
            setTouched((prev) => ({ ...prev, certFile: true }));
            setCertFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        setErrors((prev) => ({ ...prev, certFile: "" }));
        setCertFile({
            name: file.name,
            size: formatFileSize(file.size),
            type: formData.type || "Certificates",
            rawFile: file,
        });
    };

    const handleFileInputChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleCertificateFileChange(e.target.files[0]);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleCertificateFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleSupportingFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            const validFiles = [];
            let suppError = "";

            for (const f of filesArray) {
                const ext = f.name.split(".").pop().toLowerCase();
                if (!ALLOWED_EXTENSIONS.includes(ext)) {
                    suppError = "Only PDF, DOC, DOCX, JPG, and PNG files are allowed.";
                    continue;
                }
                if (f.size > MAX_FILE_SIZE) {
                    suppError = "File size cannot exceed 5MB.";
                    continue;
                }
                validFiles.push({
                    id: `supp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    name: f.name,
                    size: formatFileSize(f.size),
                    type: "Supporting Document",
                    rawFile: f,
                });
            }

            if (suppError) {
                setErrors((prev) => ({ ...prev, supportingFiles: suppError }));
            } else {
                setErrors((prev) => ({ ...prev, supportingFiles: "" }));
            }

            if (validFiles.length > 0) {
                setSupportingFiles((prev) => [...prev, ...validFiles]);
            }
            e.target.value = "";
        }
    };

    const handleRemoveCertFile = () => {
        setCertFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setActiveMenuId(null);
        if (touched.certFile) {
            setErrors((prev) => ({ ...prev, certFile: "Please upload a certificate." }));
        }
    };

    const handleRemoveSupportingFile = (id) => {
        setSupportingFiles((prev) => prev.filter((f) => f.id !== id));
        setActiveMenuId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submittingRef.current || isSubmitting) return;
        const effectiveProvider = isOtherProvider ? otherProviderText.trim() : (formData.provider_name || "").trim();
        const effectiveDomain = isOtherDomain ? otherDomainText.trim() : (formData.domain || "").trim();
        const titleErr = validateTitle(formData.title);
        const typeErr = validateType(formData.type);
        const providerErr = validateProvider(formData.provider_name, isOtherProvider, otherProviderText);
        const domainErr = validateDomain(formData.domain, isOtherDomain, otherDomainText);
        const credErr = validateCredentialId(formData.credentialId, formData.type);
        const issueDateErr = validateIssueDate(formData.issueDate);
        const expiryDateErr = validateExpiryDate(formData.expiryDate, formData.issueDate, formData.type);
        const certFileErr = validateCertFile(certFile);

        setTouched({
            title: true,
            type: true,
            provider: true,
            domain: true,
            credentialId: true,
            issueDate: true,
            expiryDate: true,
            certFile: true,
        });

        setErrors({
            title: titleErr,
            type: typeErr,
            provider: providerErr,
            domain: domainErr,
            credentialId: credErr,
            issueDate: issueDateErr,
            expiryDate: expiryDateErr,
            certFile: certFileErr,
        });

        if (titleErr || typeErr || providerErr || domainErr || credErr || issueDateErr || expiryDateErr || certFileErr) {
            return;
        }

        try {
            submittingRef.current = true;
            setIsSubmitting(true);
            setSubmitError("");
            const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP019";
            const token = localStorage.getItem("lms_token") || `dev-token-${activeEmpId}`;
            const resolvedMeta = await resolveAndPersistFormMetadata({
                provider: effectiveProvider,
                isCustomProvider: isOtherProvider,
                category: effectiveDomain,
                isCustomCategory: isOtherDomain,
                domain: effectiveDomain,
                isCustomDomain: isOtherDomain,
                explicitToken: token,
            });
            const finalProvider = resolvedMeta.provider || effectiveProvider;
            const finalDomain = resolvedMeta.domain || resolvedMeta.category || effectiveDomain;
            const formPayload = new FormData();
            formPayload.append("employee_id", activeEmpId);
            formPayload.append("title", formData.title.trim());
            formPayload.append("type", formData.type || "Course Completion Certificate");
            if (finalProvider) {
                formPayload.append("provider_name", finalProvider);
                formPayload.append("provider", finalProvider);
            }
            if (finalDomain) {
                formPayload.append("domain", finalDomain);
                formPayload.append("certification_domain", finalDomain);
            }
            if (resolvedMeta.provider_id) {
                formPayload.append("provider_id", resolvedMeta.provider_id);
            }
            if (resolvedMeta.category_id) {
                formPayload.append("category_id", resolvedMeta.category_id);
            }
            if (resolvedMeta.domain_id) {
                formPayload.append("domain_id", resolvedMeta.domain_id);
            }
            formPayload.append("issueDate", formData.issueDate);
            if (formData.expiryDate) {
                formPayload.append("expiryDate", formData.expiryDate);
            }
            if (formData.credentialId) {
                formPayload.append("credentialId", formData.credentialId.trim());
            }
            if (certFile && certFile.rawFile) {
                formPayload.append("certificate_file", certFile.rawFile);
            }
            if (supportingFiles && supportingFiles.length > 0 && supportingFiles[0].rawFile) {
                formPayload.append("supporting_file", supportingFiles[0].rawFile);
            }

            const response = await axios.post(`${API_BASE_URL}/api/employee/certifications`, formPayload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data"
                }
            });

            if (onUpload) {
                onUpload(response.data);
            }
            onClose();

            // Reset form
            setIsOtherProvider(false);
            setOtherProviderText("");
            setIsOtherDomain(false);
            setOtherDomainText("");
            setFormData({
                title: "",
                type: "",
                provider_name: "",
                provider: "",
                domain: "",
                issueDate: "",
                expiryDate: "",
                credentialId: "",
                reimbursementRequested: false,
                reimbursementAmount: "",
            });
            setErrors({});
            setTouched({});
            setCertFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSupportingFiles([]);
            setActiveMenuId(null);
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Failed to upload certificate:", err);
            const errDetail = err.response?.data?.detail || "Failed to upload certificate. Please try again.";
            setSubmitError(typeof errDetail === "string" ? errDetail : JSON.stringify(errDetail));
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <div className="emp-cert-modal-overlay">
            <div className="emp-cert-modal-container emp-req-cert-modal emp-upload-cert-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="emp-cert-modal-header emp-border-none">
                    <div>
                        <h2 className="emp-req-cert-title">Upload New Certificate/Certifications</h2>
                        <p className="emp-req-cert-subtitle">Add your new certification details and upload your certificate</p>
                    </div>
                    <button className="emp-cert-modal-close" onClick={onClose} type="button" aria-label="Close modal">
                        <img src={closeIcon} alt="Close" className="emp-modal-close-icon-img" />
                    </button>
                </div>

                {/* Form Wrapper */}
                <form onSubmit={handleSubmit} className="emp-cert-modal-form-wrapper" noValidate>
                    <div className="emp-modal-scrollable-body-wrapper">
                        {/* Scrollable Form Body */}
                        <div className="emp-cert-modal-body" ref={modalBodyRef} onScroll={handleScroll}>
                            {/* 1. Certification Name */}
                            <div className="emp-cert-form-group">
                                <label>
                                    Certification Name <span className="emp-req-star">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter certification name"
                                    value={formData.title}
                                    onChange={handleTitleChange}
                                    onKeyDown={handleSingleSpaceKeyDown}
                                    onPaste={handleTitlePaste}
                                    onBlur={() => handleBlur("title")}
                                    maxLength={100}
                                    className={errors.title && touched.title ? "emp-form-input-error" : ""}
                                />
                                {errors.title && touched.title && (
                                    <span className="emp-form-error-text">{errors.title}</span>
                                )}
                            </div>

                            {/* 2. Certificate Type & Certificate ID */}
                            <div className="emp-cert-form-row">
                                <div className="emp-cert-form-group emp-flex-1">
                                    <label>
                                        Certificate/Certifications Type <span className="emp-req-star">*</span>
                                    </label>
                                    <EmpModalSelect
                                        value={formData.type}
                                        options={[
                                            "Course Completion Certificate",
                                            "Professional Certification",
                                        ]}
                                        placeholder="Select certificate type"
                                        onChange={handleTypeChange}
                                        onBlur={() => handleBlur("type")}
                                        hasError={!!(errors.type && touched.type)}
                                    />
                                    {errors.type && touched.type && (
                                        <span className="emp-form-error-text">{errors.type}</span>
                                    )}
                                </div>

                                <div className="emp-cert-form-group emp-flex-1">
                                    <label>
                                        {formData.type === "Professional Certification" ? (
                                            <>
                                                Certification ID <span className="emp-req-star">*</span>
                                            </>
                                        ) : (
                                            "Certificate ID"
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={
                                            formData.type === "Professional Certification"
                                                ? "Enter certification ID"
                                                : "Enter certificate ID "
                                        }
                                        value={formData.credentialId}
                                        onChange={handleCredentialIdChange}
                                        onBlur={() => handleBlur("credentialId")}
                                        maxLength={50}
                                        className={errors.credentialId && touched.credentialId ? "emp-form-input-error" : ""}
                                    />
                                    {errors.credentialId && touched.credentialId && (
                                        <span className="emp-form-error-text">{errors.credentialId}</span>
                                    )}
                                </div>
                            </div>

                            {/* 3. Issuing Organization / Provider & Certification Domains Row */}
                            <div className="emp-cert-form-row">
                                <div className="emp-cert-form-group emp-flex-1">
                                    <div className="emp-form-label-row">
                                        <label>
                                            Certifying Authority / Provider <span className="emp-req-star">*</span>
                                        </label>
                                        {isOtherProvider && (
                                            <button
                                                type="button"
                                                className="emp-btn-switch-preset"
                                                onClick={handleResetProvider}
                                            >
                                                ← Back to presets
                                            </button>
                                        )}
                                    </div>

                                    {!isOtherProvider ? (
                                        <EmpModalSelect
                                            value={formData.provider_name}
                                            options={[
                                                ...dbProviders.map((prov) => ({
                                                    value: prov.provider_name || prov.name,
                                                    label: prov.name || prov.provider_name,
                                                })),
                                                { value: "Other", label: "Other" },
                                            ]}
                                            placeholder="eg., AWS, Microsoft, Google..."
                                            onChange={handleProviderChange}
                                            onBlur={() => handleBlur("provider")}
                                            hasError={!!(errors.provider && touched.provider)}
                                        />
                                    ) : (
                                        <div className="emp-input-with-icon-right">
                                            <input
                                                ref={otherProviderInputRef}
                                                type="text"
                                                placeholder="Enter certifying authority / provider name (e.g. Oracle, Cisco, CNCF)"
                                                value={otherProviderText}
                                                onChange={handleOtherProviderChange}
                                                onBlur={() => handleBlur("provider")}
                                                maxLength={100}
                                                className={errors.provider && touched.provider ? "emp-form-input-error" : ""}
                                            />
                                        </div>
                                    )}

                                    {errors.provider && touched.provider && (
                                        <span className="emp-form-error-text">{errors.provider}</span>
                                    )}
                                </div>

                                <div className="emp-cert-form-group emp-flex-1">
                                    <div className="emp-form-label-row">
                                        <label>
                                            Certification Domains <span className="emp-req-star">*</span>
                                        </label>
                                        {isOtherDomain && (
                                            <button
                                                type="button"
                                                className="emp-btn-switch-preset"
                                                onClick={handleResetDomain}
                                            >
                                                ← Back to presets
                                            </button>
                                        )}
                                    </div>

                                    {!isOtherDomain ? (
                                        <EmpModalSelect
                                            value={formData.domain}
                                            options={[...dbDomains.map((d) => d.name), "Other"]}
                                            placeholder="Select domain"
                                            onChange={handleDomainChange}
                                            onBlur={() => handleBlur("domain")}
                                            hasError={!!(errors.domain && touched.domain)}
                                        />
                                    ) : (
                                        <div className="emp-input-with-icon-right">
                                            <input
                                                ref={otherDomainInputRef}
                                                type="text"
                                                placeholder="Enter certification domain (e.g. Data Engineering, FinOps)"
                                                value={otherDomainText}
                                                onChange={handleOtherDomainChange}
                                                onBlur={() => handleBlur("domain")}
                                                maxLength={100}
                                                className={errors.domain && touched.domain ? "emp-form-input-error" : ""}
                                            />
                                        </div>
                                    )}

                                    {errors.domain && touched.domain && (
                                        <span className="emp-form-error-text">{errors.domain}</span>
                                    )}
                                </div>
                            </div>

                            {/* 3. Issue Date & Expiry Date */}
                            <div className="emp-cert-form-row">
                                <div className="emp-cert-form-group emp-flex-1">
                                    <label>
                                        Issue Date <span className="emp-req-star">*</span>
                                    </label>
                                    <EmpDatePicker
                                        placeholder="dd/mm/yyyy"
                                        value={formData.issueDate}
                                        onChange={handleIssueDateChange}
                                        onBlur={() => handleBlur("issueDate")}
                                        max={todayStr}
                                        hasError={Boolean(errors.issueDate && touched.issueDate)}
                                    />
                                    {errors.issueDate && touched.issueDate && (
                                        <span className="emp-form-error-text">{errors.issueDate}</span>
                                    )}
                                </div>

                                <div className="emp-cert-form-group emp-flex-1">
                                    <label>
                                        Expiry Date{" "}
                                        {formData.type === "Professional Certification" && (
                                            <span className="emp-req-star">*</span>
                                        )}
                                    </label>
                                    <EmpDatePicker
                                        placeholder="dd/mm/yyyy"
                                        value={formData.expiryDate}
                                        onChange={handleExpiryDateChange}
                                        onBlur={() => handleBlur("expiryDate")}
                                        min={formData.issueDate || ""}
                                        max="2099-12-31"
                                        hasError={Boolean(errors.expiryDate && touched.expiryDate)}
                                    />
                                    {errors.expiryDate && touched.expiryDate && (
                                        <span className="emp-form-error-text">{errors.expiryDate}</span>
                                    )}
                                </div>
                            </div>

                            {/* 4. Upload Certificate Dropzone */}
                            <div className="emp-cert-form-group">
                                <label>
                                    Upload Certificate <span className="emp-req-star">*</span>
                                </label>
                                <div
                                    className={`emp-file-dropzone-container ${dragActive ? "active" : ""} ${errors.certFile && touched.certFile ? "emp-form-input-error" : ""}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                >
                                    <img src={docUploadIcon} alt="" className="emp-dropzone-upload-icon-img" />
                                    <p className="emp-dropzone-text">
                                        {certFile ? (
                                            <>
                                                <span className="emp-selected-filename" title={certFile.name}>{certFile.name}</span>
                                                <button
                                                    type="button"
                                                    className="emp-remove-file-cross-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveCertFile();
                                                    }}
                                                    title="Remove file"
                                                    aria-label="Remove file"
                                                >
                                                    <X size={15} />
                                                </button>
                                            </>
                                        ) : (
                                            <>Drag and drop files here or <span className="emp-browse-files-blue-text">Browse Files</span></>
                                        )}
                                    </p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: "none" }}
                                        accept=".pdf,.doc,.docx,.jpg,.png,.jpeg"
                                        onChange={handleFileInputChange}
                                    />
                                </div>
                                <span className="emp-file-supports-text">Supports PDF, DOC, DOCX, JPG, PNG (Max.5MB)</span>
                                {errors.certFile && touched.certFile && (
                                    <span className="emp-form-error-text">{errors.certFile}</span>
                                )}
                            </div>

                            {/* 5. Supporting Documents (Optional) */}
                            <div className="emp-cert-form-group">
                                <label>
                                    Supporting Documents (Optional)
                                </label>
                                <p style={{ margin: "2px 0 6px 0", fontSize: 12, fontWidth: 400, color: "#6B7280" }}>
                                    Attach course completion certificate, invoice, marksheet or any supporting files (Max.5MB).
                                </p>
                                <div>
                                    <button
                                        type="button"
                                        className="emp-btn-add-supporting-doc"
                                        onClick={() => supportingFileInputRef.current?.click()}
                                    >
                                        + Add Supporting Document
                                    </button>
                                    <input
                                        type="file"
                                        ref={supportingFileInputRef}
                                        style={{ display: "none" }}
                                        accept=".pdf,.doc,.docx,.jpg,.png,.jpeg"
                                        multiple
                                        onChange={handleSupportingFileChange}
                                    />
                                </div>
                                {errors.supportingFiles && (
                                    <span className="emp-form-error-text" style={{ marginTop: "6px", display: "block" }}>
                                        {errors.supportingFiles}
                                    </span>
                                )}
                            </div>

                            {/* 6. Uploaded Supporting Document Cards */}
                            {supportingFiles.map((item) => (
                                <div key={item.id} className="emp-uploaded-doc-preview-card">
                                    <div className="emp-uploaded-doc-left">
                                        <img src={docIcon} alt="" className="emp-uploaded-doc-blue-icon-img" />
                                        <div className="emp-uploaded-doc-text">
                                            <span className="emp-uploaded-doc-title" title={item.name}>{item.name}</span>
                                            <div className="emp-uploaded-doc-subtext">
                                                <span className="emp-uploaded-doc-type">Supporting Document</span>
                                                <span className="emp-uploaded-doc-size">{item.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="emp-uploaded-doc-right">
                                        <div className="emp-uploaded-doc-badge">
                                            <img src={uploadSuccessIcon} alt="" className="emp-badge-check-icon-img" />
                                            <span>Uploaded</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="emp-uploaded-doc-trash-btn"
                                            onClick={() => handleRemoveSupportingFile(item.id)}
                                            title="Remove file"
                                            aria-label="Remove file"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                        </div>

                        {hasScroll && (
                            <div className="emp-modal-scroll-track">
                                <div
                                    className="emp-modal-scroll-thumb-wrapper"
                                    style={{
                                        transform: `translateY(${thumbOffset}px)`,
                                    }}
                                >
                                    <img
                                        src={scrollingIcon}
                                        alt="Scroll Indicator"
                                        className="emp-modal-scroll-icon"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submit Error Banner */}
                    {submitError && (
                        <div style={{ padding: "8px 16px", margin: "0 24px 12px", background: "#FEE2E2", color: "#DC2626", borderRadius: 6, fontSize: 13, border: "1px solid #FCA5A5" }}>
                            {submitError}
                        </div>
                    )}

                    {/* Fixed Footer Actions */}
                    <div className="emp-cert-modal-footer emp-flex-end">
                        <button type="button" className="emp-btn-cancel-gray" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="emp-btn-submit-blue" disabled={isSubmitting}>
                            {isSubmitting ? "Uploading..." : "Upload"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
