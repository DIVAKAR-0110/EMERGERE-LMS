import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Search, X } from "lucide-react";
import calIcon from "../../../assets/Certification/cal.svg";
import docUploadIcon from "../../../assets/Certification/docuplode.svg";
import closeIcon from "../../../assets/course_library/close.svg";
import downArrowIcon from "../../../assets/course_library/down_arrow.svg";
import scrollingIcon from "../../../assets/Certification/scrolling.svg";

import { validateCustomMetadataEntry } from "../../../constants/courseMetadata";
import useCourseMetadata from "../../../hooks/useCourseMetadata";
import { resolveAndPersistFormMetadata } from "../../../services/courseMetadataService";
import EmpModalSelect from "./EmpModalSelect";
import EmpDatePicker from "./EmpDatePicker";
import AlertDialog from "../../common/AlertDialog";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
    capitalizeFirstLetter,
    formatSentenceCase,
} from "../../../utils/validationUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function RequestCertificationModal({ isOpen, onClose, onRequest }) {
    const [formData, setFormData] = useState({
        examName: "",
        provider: "",
        scheduledDate: "",
        category: "",
        estimatedCost: "",
        justification: "",
        file: null,
    });

    const { providers: liveProviders, categories: liveCategories, domains: liveDomains } = useCourseMetadata(undefined, isOpen);
    const dbProviders = liveProviders.filter((p) => p.name?.toLowerCase() !== "other");
    const dbCategories = (liveDomains && liveDomains.length > 0 ? liveDomains : liveCategories).filter((c) => c.name?.toLowerCase() !== "other");

    const [isOtherProvider, setIsOtherProvider] = useState(false);
    const [otherProviderText, setOtherProviderText] = useState("");

    const [isOtherCategory, setIsOtherCategory] = useState(false);
    const [otherCategoryText, setOtherCategoryText] = useState("");

    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [thumbOffset, setThumbOffset] = useState(0);
    const [hasScroll, setHasScroll] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: "", message: "", type: "error" });

    const todayStr = new Date().toISOString().split("T")[0];
    const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    const fileInputRef = useRef(null);
    const otherProviderInputRef = useRef(null);
    const otherCategoryInputRef = useRef(null);
    const modalBodyRef = useRef(null);
    const submittingRef = useRef(false);

    // Auto-focus "Other" input fields
    useEffect(() => {
        if (isOtherProvider && otherProviderInputRef.current) {
            otherProviderInputRef.current.focus();
        }
    }, [isOtherProvider]);

    useEffect(() => {
        if (isOtherCategory && otherCategoryInputRef.current) {
            otherCategoryInputRef.current.focus();
        }
    }, [isOtherCategory]);

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
    }, [isOpen, formData, errors, isOtherProvider, isOtherCategory]);

    if (!isOpen) return null;

    // Validation functions
    const validateExamName = (val) => {
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

    const validateProvider = (val, isOther, otherText) => {
        if (isOther) {
            return validateCustomMetadataEntry(otherText, dbProviders, "provider");
        }
        if (!val || !val.trim()) {
            return "Please select a Certifying Authority / Provider.";
        }
        return "";
    };

    const validateScheduledDate = (val) => {
        if (!val) return "";
        const parts = val.split("-");
        const year = parts[0];
        if (year) {
            if (year.length !== 4 || isNaN(year) || parseInt(year, 10) < 1900 || parseInt(year, 10) > 2099) {
                return "Year must be a valid 4-digit year (up to 2099).";
            }
        }
        if (val < todayStr) {
            return "Scheduled Exam Date cannot be in the past.";
        }
        return "";
    };

    const validateCategory = (val, isOther, otherText) => {
        if (isOther) {
            return validateCustomMetadataEntry(otherText, dbCategories, "category");
        }
        if (!val || !val.trim()) {
            return "Please select a Certification Category.";
        }
        return "";
    };

    const validateEstimatedCost = (val) => {
        if (val === "" || val === null || val === undefined || (typeof val === "string" && !val.trim())) {
            return "Estimated Cost is required.";
        }
        const strVal = String(val).trim();
        if (!/^\d+$/.test(strVal) || strVal.includes(".")) {
            return "Estimated Cost must be a whole number (no decimals allowed).";
        }
        const num = parseInt(strVal, 10);
        if (isNaN(num) || num < 1) {
            return "Estimated Cost must be at least ₹1.";
        }
        if (num > 100000) {
            return "Estimated Cost cannot exceed ₹1,00,000.";
        }
        return "";
    };

    const validateJustification = (val) => {
        const trimmed = normalizeSingleSpacing(val || "", { trimEdges: true });
        if (!trimmed) {
            return "Purpose of Certification is required.";
        }
        if (trimmed.length < 10) {
            return "Purpose of Certification must be at least 10 characters.";
        }
        if (trimmed.length > 500) {
            return "Purpose of Certification cannot exceed 500 characters.";
        }
        return "";
    };

    // Change handlers
    const handleExamNameChange = (e) => {
        const raw = e.target.value
            .replace(/[^a-zA-Z0-9\s\-&\.\/\+\(\),]/g, "")
            .replace(/^\s+/, "")
            .replace(/\s{2,}/g, " ")
            .slice(0, 100);
        const filtered = capitalizeFirstLetter(raw);
        setFormData((prev) => ({ ...prev, examName: filtered }));
        if (touched.examName) {
            setErrors((prev) => ({ ...prev, examName: validateExamName(filtered) }));
        }
    };

    const handleExamNamePaste = (e) => {
        handleSingleSpacePaste(e, 100, (pastedVal) => {
            const raw = pastedVal
                .replace(/[^a-zA-Z0-9\s\-&\.\/\+\(\),]/g, "")
                .replace(/^\s+/, "")
                .replace(/\s{2,}/g, " ")
                .slice(0, 100);
            const filtered = capitalizeFirstLetter(raw);
            setFormData((prev) => ({ ...prev, examName: filtered }));
            if (touched.examName) {
                setErrors((prev) => ({ ...prev, examName: validateExamName(filtered) }));
            }
        });
    };

    const handleProviderChange = (e) => {
        const val = e.target.value;
        if (val === "Other") {
            setIsOtherProvider(true);
            setFormData((prev) => ({ ...prev, provider: otherProviderText.trim() }));
            if (touched.provider && otherProviderText.trim()) {
                setErrors((prev) => ({ ...prev, provider: "" }));
            }
        } else {
            setIsOtherProvider(false);
            setFormData((prev) => ({ ...prev, provider: val }));
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
        setFormData((prev) => ({ ...prev, provider: val }));
        const dupErr = val.trim() ? validateCustomMetadataEntry(val, dbProviders, "provider") : "";
        if (dupErr || touched.provider) {
            if (dupErr) setTouched((prev) => ({ ...prev, provider: true }));
            setErrors((prev) => ({ ...prev, provider: dupErr || (touched.provider ? validateProvider(val, true, val) : "") }));
        }
    };

    const handleResetProvider = () => {
        setIsOtherProvider(false);
        setOtherProviderText("");
        setFormData((prev) => ({ ...prev, provider: "" }));
        setErrors((prev) => ({ ...prev, provider: "" }));
    };

    const handleScheduledDateChange = (e) => {
        let val = e.target.value;
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setFormData((prev) => ({ ...prev, scheduledDate: val }));
        if (touched.scheduledDate || val) {
            setErrors((prev) => ({ ...prev, scheduledDate: validateScheduledDate(val) }));
        }
    };

    const handleCategoryChange = (e) => {
        const val = e.target.value;
        if (val === "Other") {
            setIsOtherCategory(true);
            setFormData((prev) => ({ ...prev, category: otherCategoryText.trim() }));
            if (touched.category && otherCategoryText.trim()) {
                setErrors((prev) => ({ ...prev, category: "" }));
            }
        } else {
            setIsOtherCategory(false);
            setFormData((prev) => ({ ...prev, category: val }));
            setTouched((prev) => ({ ...prev, category: true }));
            setErrors((prev) => ({ ...prev, category: "" }));
        }
    };

    const handleOtherCategoryChange = (e) => {
        const raw = e.target.value
            .replace(/^\s+/, "")
            .replace(/\s{2,}/g, " ")
            .slice(0, 100);
        const val = capitalizeFirstLetter(raw);
        setOtherCategoryText(val);
        setFormData((prev) => ({ ...prev, category: val }));
        const dupErr = val.trim() ? validateCustomMetadataEntry(val, dbCategories, "category") : "";
        if (dupErr || touched.category) {
            if (dupErr) setTouched((prev) => ({ ...prev, category: true }));
            setErrors((prev) => ({ ...prev, category: dupErr || (touched.category ? validateCategory(val, true, val) : "") }));
        }
    };

    const handleResetCategory = () => {
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setFormData((prev) => ({ ...prev, category: "" }));
        setErrors((prev) => ({ ...prev, category: "" }));
    };

    const handleCostChange = (e) => {
        const val = e.target.value;
        // Strictly allow only whole numbers (digits only, no decimal point, max 6 digits up to ₹1,00,000)
        if (val === "" || /^\d+$/.test(val)) {
            const truncated = val.slice(0, 6);
            setFormData((prev) => ({ ...prev, estimatedCost: truncated }));
            if (touched.estimatedCost || truncated) {
                setErrors((prev) => ({ ...prev, estimatedCost: validateEstimatedCost(truncated) }));
            }
        }
    };

    const handleJustificationChange = (e) => {
        const rawVal = applySingleSpaceTextChange(e, 500);
        const val = formatSentenceCase(rawVal);
        setFormData((prev) => ({ ...prev, justification: val }));
        if (touched.justification) {
            setErrors((prev) => ({ ...prev, justification: validateJustification(val) }));
        }
    };

    const handleJustificationPaste = (e) => {
        handleSingleSpacePaste(e, 500, (nextVal) => {
            const val = formatSentenceCase(nextVal);
            setFormData((prev) => ({ ...prev, justification: val }));
            if (touched.justification) {
                setErrors((prev) => ({ ...prev, justification: validateJustification(val) }));
            }
        });
    };

    const handleBlur = (field, overrideVal) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        const currentVal = overrideVal !== undefined ? overrideVal : formData[field];
        if (field === "examName") {
            const trimmed = capitalizeFirstLetter((currentVal || "").trim());
            if (trimmed !== currentVal) {
                setFormData((prev) => ({ ...prev, examName: trimmed }));
            }
            setErrors((prev) => ({ ...prev, examName: validateExamName(trimmed) }));
        } else if (field === "provider") {
            if (isOtherProvider) {
                const trimmed = capitalizeFirstLetter((otherProviderText || "").trim());
                if (trimmed !== otherProviderText) {
                    setOtherProviderText(trimmed);
                    setFormData((prev) => ({ ...prev, provider: trimmed }));
                }
            }
            setErrors((prev) => ({
                ...prev,
                provider: validateProvider(currentVal, isOtherProvider, otherProviderText),
            }));
        } else if (field === "scheduledDate") {
            setErrors((prev) => ({ ...prev, scheduledDate: validateScheduledDate(currentVal) }));
        } else if (field === "category") {
            if (isOtherCategory) {
                const trimmed = capitalizeFirstLetter((otherCategoryText || "").trim());
                if (trimmed !== otherCategoryText) {
                    setOtherCategoryText(trimmed);
                    setFormData((prev) => ({ ...prev, category: trimmed }));
                }
            }
            setErrors((prev) => ({
                ...prev,
                category: validateCategory(currentVal, isOtherCategory, otherCategoryText),
            }));
        } else if (field === "estimatedCost") {
            setErrors((prev) => ({ ...prev, estimatedCost: validateEstimatedCost(currentVal) }));
        } else if (field === "justification") {
            const cleaned = formatSentenceCase(normalizeSingleSpacing(currentVal || "", { trimEdges: true }).slice(0, 500));
            if (cleaned !== (formData.justification || "")) {
                setFormData((prev) => ({ ...prev, justification: cleaned }));
            }
            setErrors((prev) => ({ ...prev, justification: validateJustification(cleaned) }));
        }
    };

    const handleFileSelect = (file) => {
        if (!file) return;
        const ext = file.name.split(".").pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setErrors((prev) => ({ ...prev, file: "Only PDF, DOC, DOCX, JPG, and PNG files are allowed." }));
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setErrors((prev) => ({ ...prev, file: "File size cannot exceed 5MB." }));
            return;
        }
        setErrors((prev) => ({ ...prev, file: "" }));
        setFormData((prev) => ({ ...prev, file }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submittingRef.current || isSubmitting) return;
        const effectiveProvider = isOtherProvider ? otherProviderText.trim() : formData.provider.trim();
        const effectiveCategory = isOtherCategory ? otherCategoryText.trim() : formData.category.trim();

        const examNameErr = validateExamName(formData.examName);
        const providerErr = validateProvider(formData.provider, isOtherProvider, otherProviderText);
        const scheduledDateErr = validateScheduledDate(formData.scheduledDate);
        const categoryErr = validateCategory(formData.category, isOtherCategory, otherCategoryText);
        const costErr = validateEstimatedCost(formData.estimatedCost);
        const justificationErr = validateJustification(formData.justification);

        setTouched({
            examName: true,
            provider: true,
            scheduledDate: true,
            category: true,
            estimatedCost: true,
            justification: true,
        });

        setErrors({
            examName: examNameErr,
            provider: providerErr,
            scheduledDate: scheduledDateErr,
            category: categoryErr,
            estimatedCost: costErr,
            justification: justificationErr,
        });

        if (examNameErr || providerErr || scheduledDateErr || categoryErr || costErr || justificationErr) {
            return;
        }

        submittingRef.current = true;
        setIsSubmitting(true);

        try {
            const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP019";
            const resolvedMeta = await resolveAndPersistFormMetadata({
                provider: effectiveProvider,
                isCustomProvider: isOtherProvider,
                category: effectiveCategory,
                isCustomCategory: isOtherCategory,
                domain: effectiveCategory,
                isCustomDomain: isOtherCategory,
            });

            const payload = {
                employee_id: activeEmpId,
                certification_name: formData.examName.trim(),
                provider_id: resolvedMeta.provider_id || null,
                category_id: resolvedMeta.category_id || null,
                domain_id: resolvedMeta.domain_id || null,
                provider_name: resolvedMeta.provider || effectiveProvider,
                category_name: resolvedMeta.domain || resolvedMeta.category || effectiveCategory,
                scheduled_exam_date: formData.scheduledDate || null,
                estimated_cost_inr: parseInt(formData.estimatedCost, 10),
                purpose: normalizeSingleSpacing(formData.justification || "", { trimEdges: true }).slice(0, 500),
                supporting_document: null,
                supporting_document_name: formData.file ? formData.file.name : null,
                supporting_document_size: formData.file ? formData.file.size : null,
            };

            await axios.post(`${API_BASE_URL}/api/certifications/requests`, payload);

            if (onRequest) onRequest();
            onClose();
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Error submitting certification request to backend:", err);
            const errMsg = err?.response?.data?.detail || "Failed to submit certification request. Please try again.";
            setAlertDialog({
                isOpen: true,
                title: "Request Submission Failed",
                message: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
                type: "error",
            });
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
            // Reset form
            setFormData({
                examName: "",
                provider: "",
                scheduledDate: "",
                category: "",
                estimatedCost: "",
                justification: "",
                file: null,
            });
            setIsOtherProvider(false);
            setOtherProviderText("");
            setIsOtherCategory(false);
            setOtherCategoryText("");
            setErrors({});
            setTouched({});
        }
    };

    return (
        <div className="emp-cert-modal-overlay">
            <div className="emp-cert-modal-container emp-req-cert-modal" onClick={(e) => e.stopPropagation()}>
                {/* Fixed Header */}
                <div className="emp-cert-modal-header emp-border-none">
                    <div>
                        <h2 className="emp-req-cert-title">Request Certification</h2>
                        <p className="emp-req-cert-subtitle">Submit a request for a certification you want to earn.</p>
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
                                <div className="emp-input-with-icon-right">
                                    <input
                                        type="text"
                                        list="course-library-certifications"
                                        placeholder="Search or enter certification name"
                                        value={formData.examName}
                                        onChange={handleExamNameChange}
                                        onKeyDown={handleSingleSpaceKeyDown}
                                        onPaste={handleExamNamePaste}
                                        onBlur={() => handleBlur("examName")}
                                        maxLength={100}
                                        className={errors.examName && touched.examName ? "emp-form-input-error" : ""}
                                    />
                                    <datalist id="course-library-certifications">
                                        <option value="TensorFlow Basic to Advanced Training" />
                                        <option value="Docker & Kubernetes" />
                                        <option value="Python for Data Science" />
                                        <option value="Cybersecurity Essentials" />
                                        <option value="Machine Learning A-Z" />
                                        <option value="AWS Cloud Practitioner" />
                                        <option value="Agile & Scrum Master" />
                                        <option value="Full Stack JavaScript" />
                                        <option value="SQL for Data Analysis" />
                                        <option value="Google Cloud Data Engineer" />
                                    </datalist>
                                    <Search size={14} className="emp-inner-icon-right" />
                                </div>
                                {errors.examName && touched.examName && (
                                    <span className="emp-form-error-text">{errors.examName}</span>
                                )}
                            </div>

                            {/* 2. Provider & Scheduled Date */}
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
                                            value={formData.provider}
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
                                                placeholder="Enter provider name (e.g. Oracle, Cisco, CNCF)"
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
                                    <label>Scheduled exam date</label>
                                    <EmpDatePicker
                                        placeholder="dd/mm/yyyy"
                                        value={formData.scheduledDate}
                                        onChange={handleScheduledDateChange}
                                        onBlur={() => handleBlur("scheduledDate")}
                                        min={todayStr}
                                        max="2099-12-31"
                                        hasError={Boolean(errors.scheduledDate && (touched.scheduledDate || formData.scheduledDate))}
                                    />
                                    {errors.scheduledDate && (touched.scheduledDate || formData.scheduledDate) && (
                                        <span className="emp-form-error-text">{errors.scheduledDate}</span>
                                    )}
                                </div>
                            </div>

                            {/* 3. Category & Estimated Cost */}
                            <div className="emp-cert-form-row">
                                <div className="emp-cert-form-group emp-flex-1">
                                    <div className="emp-form-label-row">
                                        <label>
                                            Certification Category <span className="emp-req-star">*</span>
                                        </label>
                                        {isOtherCategory && (
                                            <button
                                                type="button"
                                                className="emp-btn-switch-preset"
                                                onClick={handleResetCategory}
                                            >
                                                ← Back to presets
                                            </button>
                                        )}
                                    </div>

                                    {!isOtherCategory ? (
                                        <EmpModalSelect
                                            value={formData.category}
                                            options={[
                                                ...dbCategories.map((cat) => ({
                                                    value: cat.category_name,
                                                    label: cat.category_name,
                                                })),
                                                { value: "Other", label: "Other" },
                                            ]}
                                            placeholder="Select category"
                                            onChange={handleCategoryChange}
                                            onBlur={() => handleBlur("category")}
                                            hasError={!!(errors.category && touched.category)}
                                        />
                                    ) : (
                                        <div className="emp-input-with-icon-right">
                                            <input
                                                ref={otherCategoryInputRef}
                                                type="text"
                                                placeholder="Enter category name (e.g. Blockchain, Mobile)"
                                                value={otherCategoryText}
                                                onChange={handleOtherCategoryChange}
                                                onBlur={() => handleBlur("category")}
                                                maxLength={100}
                                                className={errors.category && touched.category ? "emp-form-input-error" : ""}
                                            />
                                        </div>
                                    )}

                                    {errors.category && touched.category && (
                                        <span className="emp-form-error-text">{errors.category}</span>
                                    )}
                                </div>

                                <div className="emp-cert-form-group emp-flex-1">
                                    <label>
                                        Estimated Cost (INR) <span className="emp-req-star">*</span>
                                    </label>
                                    <div className={`emp-input-with-rupee-box ${errors.estimatedCost && touched.estimatedCost ? "emp-form-input-error" : ""}`}>
                                        <span className="emp-rupee-symbol-box">₹</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Enter estimated cost"
                                            value={formData.estimatedCost}
                                            onChange={handleCostChange}
                                            onKeyDown={(e) => {
                                                if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onBlur={() => handleBlur("estimatedCost")}
                                        />
                                    </div>
                                    {errors.estimatedCost && touched.estimatedCost && (
                                        <span className="emp-form-error-text">{errors.estimatedCost}</span>
                                    )}
                                </div>
                            </div>

                            {/* 4. Purpose of Certification */}
                            <div className="emp-cert-form-group">
                                <label>
                                    Purpose of Certification <span className="emp-req-star">*</span>
                                </label>
                                <div className="emp-textarea-wrapper">
                                    <textarea
                                        rows={4}
                                        maxLength={500}
                                        placeholder="Explain how this certification will help you and the organization...."
                                        value={formData.justification}
                                        onKeyDown={handleSingleSpaceKeyDown}
                                        onChange={handleJustificationChange}
                                        onPaste={handleJustificationPaste}
                                        onBlur={() => handleBlur("justification")}
                                        className={errors.justification && touched.justification ? "emp-form-input-error" : ""}
                                    />
                                    <span className="emp-char-counter">{formData.justification.length}/500</span>
                                </div>
                                {errors.justification && touched.justification && (
                                    <span className="emp-form-error-text">{errors.justification}</span>
                                )}
                            </div>

                            {/* 5. Supporting Document (Optional) */}
                            <div className="emp-cert-form-group">
                                <label>
                                    Supporting Document (Optional)
                                </label>
                                <div
                                    className={`emp-file-dropzone-container ${errors.file ? "emp-form-input-error" : ""}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                >
                                    <img src={docUploadIcon} alt="" className="emp-dropzone-upload-icon-img" />
                                    <p className="emp-dropzone-text">
                                        {formData.file ? (
                                            <>
                                                <span className="emp-selected-filename">{formData.file.name}</span>
                                                <button
                                                    type="button"
                                                    className="emp-remove-file-cross-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData((prev) => ({ ...prev, file: null }));
                                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                                        setErrors((prev) => ({ ...prev, file: "" }));
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
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <span className="emp-file-supports-text">Supports PDF, DOC, DOCX, JPG, PNG (Max.5MB)</span>
                                {errors.file && (
                                    <span className="emp-form-error-text">{errors.file}</span>
                                )}
                            </div>
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

                    {/* Fixed Footer Actions */}
                    <div className="emp-cert-modal-footer emp-flex-end">
                        <button type="button" className="emp-btn-cancel-gray" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="emp-btn-submit-blue" disabled={isSubmitting}>
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                    </div>
                </form>
            </div>

            {alertDialog.isOpen && (
                <AlertDialog
                    isOpen={alertDialog.isOpen}
                    onClose={() => setAlertDialog((prev) => ({ ...prev, isOpen: false }))}
                    title={alertDialog.title || "Alert"}
                    message={alertDialog.message}
                    type={alertDialog.type || "error"}
                />
            )}
        </div>
    );
}
