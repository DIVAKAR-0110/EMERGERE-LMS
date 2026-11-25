import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import closeicon from "../../../assets/course_library/close.svg";
import downArrowIcon from "../../../assets/course_library/down_arrow.svg";
import courseLinkIcon from "../../../assets/course_library/course_link.svg";

import "../../../styles/employee/RequestCourseModal.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

import { validateCustomMetadataEntry } from "../../../constants/courseMetadata";
import useCourseMetadata from "../../../hooks/useCourseMetadata";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
    capitalizeFirstLetter,
    formatSentenceCase,
} from "../../../utils/validationUtils";

// Reusable Custom Dropdown Component with In-Field Typing Search & Right Scrollbar
const CustomDropdown = ({
    id,
    options = [],
    value,
    placeholder,
    onSelect,
    hasError = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const itemRefs = useRef([]);

    const uniqueOptions = useMemo(
        () => Array.from(new Set(options || [])),
        [options]
    );

    // Case-insensitive filtering of options from typed letters
    const filteredOptions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return uniqueOptions;
        return uniqueOptions.filter((opt) => String(opt).toLowerCase().includes(q));
    }, [uniqueOptions, searchQuery]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Set initial highlighted index when dropdown opens or query changes
    useEffect(() => {
        if (isOpen) {
            const idx = filteredOptions.findIndex((opt) => opt === value);
            setHighlightedIndex(idx >= 0 ? idx : (filteredOptions.length > 0 ? 0 : -1));
        } else {
            setSearchQuery("");
        }
    }, [isOpen, value, filteredOptions]);

    const scrollToIndex = (idx) => {
        if (itemRefs.current[idx]) {
            itemRefs.current[idx].scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            });
        }
    };

    const handleOptionClick = (opt) => {
        onSelect(opt);
        setIsOpen(false);
        setSearchQuery("");
    };

    const handleContainerClick = () => {
        if (!isOpen) {
            setIsOpen(true);
        }
        inputRef.current?.focus();
    };

    const handleArrowClick = (e) => {
        e.stopPropagation();
        setIsOpen((prev) => {
            const next = !prev;
            if (next) {
                setTimeout(() => inputRef.current?.focus(), 10);
            }
            return next;
        });
    };

    const handleInputChange = (e) => {
        const val = e.target.value.replace(/\s+/g, " ");
        setSearchQuery(val);
        if (!isOpen) {
            setIsOpen(true);
        }
        setHighlightedIndex(0);
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        if (e.key === "Escape") {
            e.preventDefault();
            setIsOpen(false);
            setSearchQuery("");
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                handleOptionClick(filteredOptions[highlightedIndex]);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                const nextIdx = highlightedIndex < filteredOptions.length - 1 ? highlightedIndex + 1 : 0;
                setHighlightedIndex(nextIdx);
                scrollToIndex(nextIdx);
            }
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                const prevIdx = highlightedIndex > 0 ? highlightedIndex - 1 : filteredOptions.length - 1;
                setHighlightedIndex(prevIdx);
                scrollToIndex(prevIdx);
            }
            return;
        }
    };

    return (
        <div
            className="emp-custom-select-container"
            ref={containerRef}
            onKeyDown={handleKeyDown}
        >
            <div
                className={`emp-custom-select-trigger ${isOpen ? "is-open" : ""} ${hasError ? "emp-form-select-error" : ""}`}
                onClick={handleContainerClick}
            >
                <input
                    ref={inputRef}
                    type="text"
                    id={id}
                    className="emp-custom-select-search-input"
                    value={isOpen ? searchQuery : (value || "")}
                    placeholder={placeholder}
                    onChange={handleInputChange}
                    onKeyDown={handleSingleSpaceKeyDown}
                    onPaste={handleSingleSpacePaste}
                    onFocus={() => {
                        if (!isOpen) setIsOpen(true);
                    }}
                    autoComplete="off"
                    spellCheck="false"
                />
                <img
                    src={downArrowIcon}
                    alt=""
                    className={`emp-select-dropdown-icon ${isOpen ? "rotate-180" : ""}`}
                    onClick={handleArrowClick}
                />
            </div>

            {isOpen && (
                <div className="emp-custom-dropdown-menu" role="listbox">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => (
                            <div
                                key={`${opt}-${idx}`}
                                ref={(el) => (itemRefs.current[idx] = el)}
                                className={`emp-custom-dropdown-option ${value === opt ? "is-selected" : ""
                                    } ${highlightedIndex === idx ? "is-highlighted" : ""}`}
                                onClick={() => handleOptionClick(opt)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                role="option"
                                aria-selected={value === opt}
                            >
                                {opt}
                            </div>
                        ))
                    ) : (
                        <div className="emp-custom-dropdown-no-match">
                            No options found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const RequestCourseModal = ({
    isOpen,
    onClose,
    onSubmit,
    formData,
    setFormData,
    isSubmitting = false,
}) => {
    const { providerNames, categoryNames } = useCourseMetadata(undefined, isOpen);

    const providerOptions = useMemo(() => {
        const list = (providerNames || []).filter((p) => p && p.toLowerCase() !== "other");
        return Array.from(new Set([...list, "Other"]));
    }, [providerNames]);

    const categoryOptions = useMemo(() => {
        const list = (categoryNames || []).filter((c) => c && c.toLowerCase() !== "other");
        return Array.from(new Set([...list, "Other"]));
    }, [categoryNames]);

    const [isOtherProvider, setIsOtherProvider] = useState(false);
    const [otherProviderText, setOtherProviderText] = useState("");

    const [isOtherCategory, setIsOtherCategory] = useState(false);
    const [otherCategoryText, setOtherCategoryText] = useState("");

    const [errors, setErrors] = useState({});

    const otherProviderInputRef = useRef(null);
    const otherCategoryInputRef = useRef(null);



    const validateCourseName = (name) => {
        const trimmed = (name || "").trim();
        if (!trimmed) {
            return "This field is required";
        }
        if (/\s{2,}/.test(name)) {
            return "Course Name should allow only 1 white space between words.";
        }
        if (trimmed.length < 2) {
            return "Course Name must be at least 2 characters.";
        }
        if (trimmed.length > 100) {
            return "Course Name cannot exceed 100 characters.";
        }
        const validCharsRegex = /^[a-zA-Z0-9\s\-/&+.,()]+$/;
        if (!validCharsRegex.test(trimmed) || !/[a-zA-Z]/.test(trimmed)) {
            return "Course Name must contain at least one letter.";
        }
        return "";
    };

    const isValidUrl = (urlString) => {
        if (!urlString || typeof urlString !== "string") return false;
        const trimmed = urlString.trim();
        if (!trimmed) return false;
        try {
            const urlToTest = trimmed.startsWith("http://") || trimmed.startsWith("https://")
                ? trimmed
                : `https://${trimmed}`;
            const parsed = new URL(urlToTest);
            return Boolean(parsed.hostname && parsed.hostname.includes("."));
        } catch (_) {
            return false;
        }
    };

    const validateCourseLink = (link) => {
        const trimmed = (link || "").trim();
        if (!trimmed) return "";
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            return "Please enter a valid course URL (e.g., https://example.com/...)";
        }
        if (!isValidUrl(trimmed)) {
            return "Please enter a valid course URL (e.g., https://example.com/...)";
        }
        if (trimmed.length > 255) {
            return "Course Link must not exceed 255 characters.";
        }
        return "";
    };

    const validateTargetDate = (dateStr) => {
        if (!dateStr) return "";
        const parts = dateStr.split("-");
        if (parts.length !== 3) return "Please enter a valid date.";
        const selected = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (isNaN(selected.getTime())) {
            return "Please enter a valid date.";
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selected <= today) {
            return "Target completion date must be a future date.";
        }
        const dayOfWeek = selected.getDay(); // 0 is Sunday, 6 is Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return "Target completion date cannot fall on a weekend (Saturday or Sunday) according to company training policy. Please choose a weekday.";
        }
        return "";
    };

    const validateCost = (costVal) => {
        if (costVal === undefined || costVal === null || costVal === "") return "";
        const strVal = String(costVal).trim().replace("$", "").replace("₹", "").replace(",", "");
        if (!strVal) return "";
        if (strVal.includes(".")) {
            const parts = strVal.split(".");
            if (parts[1] && parseInt(parts[1], 10) > 0) {
                return `Course cost allows whole integers only ($${Math.round(Number(strVal))}). Decimals (.${parts[1]}) cannot be silently truncated.`;
            }
        }
        const num = Number(strVal);
        if (isNaN(num) || num < 0) {
            return "Cost must be a positive whole integer.";
        }
        return "";
    };

    const validateReason = (reason) => {
        const trimmed = (reason || "").trim();
        if (!trimmed) {
            return "This field is required";
        }
        if (!/[a-zA-Z]/.test(trimmed)) {
            return "Please enter a valid reason containing at least one letter.";
        }
        if (/\s{2,}/.test(reason || "")) {
            return "Multiple consecutive spaces are not allowed. Only 1 space is allowed between words.";
        }
        return "";
    };

    // Synchronize local state only when modal opens (not while user types)
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            setErrors({});

            // 1. Check provider state
            const standardProviders = providerOptions.filter((p) => p !== "Other");
            if (formData.provider) {
                const isKnown = standardProviders.some(
                    (p) => p.toLowerCase() === formData.provider.trim().toLowerCase()
                );
                if (!isKnown || formData.providerSelect === "Other" || formData.provider === "Other") {
                    setIsOtherProvider(true);
                    setOtherProviderText(formData.provider === "Other" ? "" : formData.provider);
                } else {
                    setIsOtherProvider(false);
                    setOtherProviderText("");
                }
            } else {
                setIsOtherProvider(false);
                setOtherProviderText("");
            }

            // 2. Check category state
            const standardCategories = categoryOptions.filter((c) => c !== "Other");
            if (formData.category) {
                const isKnown = standardCategories.some(
                    (c) => c.toLowerCase() === formData.category.trim().toLowerCase()
                );
                if (!isKnown || formData.categorySelect === "Other" || formData.category === "Other") {
                    setIsOtherCategory(true);
                    setOtherCategoryText(formData.category === "Other" ? "" : formData.category);
                } else {
                    setIsOtherCategory(false);
                    setOtherCategoryText("");
                }
            } else {
                setIsOtherCategory(false);
                setOtherCategoryText("");
            }
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    // Auto-focus custom inputs when switched to "Other"
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

    if (!isOpen) return null;

    const handleProviderSelect = (opt) => {
        if (opt === "Other") {
            setIsOtherProvider(true);
            setFormData({
                ...formData,
                provider: otherProviderText.trim() || "",
                providerSelect: "Other"
            });
        } else {
            setIsOtherProvider(false);
            setOtherProviderText("");
            setFormData({
                ...formData,
                provider: opt,
                providerSelect: opt
            });
        }
        if (errors.provider) {
            setErrors((prev) => ({ ...prev, provider: "" }));
        }
    };

    const handleResetProvider = () => {
        setIsOtherProvider(false);
        setOtherProviderText("");
        setFormData({
            ...formData,
            provider: "",
            providerSelect: ""
        });
        if (errors.provider) {
            setErrors((prev) => ({ ...prev, provider: "" }));
        }
    };

    const handleOtherProviderInput = (e) => {
        const val = capitalizeFirstLetter(e.target.value);
        setOtherProviderText(val);
        setFormData((prev) => ({
            ...prev,
            provider: val,
            providerSelect: "Other"
        }));
        const dupErr = val.trim() ? validateCustomMetadataEntry(val, providerNames, "provider") : "";
        setErrors((prev) => ({ ...prev, provider: dupErr }));
    };

    const handleCategorySelect = (opt) => {
        if (opt === "Other") {
            setIsOtherCategory(true);
            setFormData({
                ...formData,
                category: otherCategoryText.trim() || "",
                categorySelect: "Other"
            });
        } else {
            setIsOtherCategory(false);
            setOtherCategoryText("");
            setFormData({
                ...formData,
                category: opt,
                categorySelect: opt
            });
        }
        if (errors.category) {
            setErrors((prev) => ({ ...prev, category: "" }));
        }
    };

    const handleResetCategory = () => {
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setFormData({
            ...formData,
            category: "",
            categorySelect: ""
        });
        if (errors.category) {
            setErrors((prev) => ({ ...prev, category: "" }));
        }
    };

    const handleOtherCategoryInput = (e) => {
        const val = capitalizeFirstLetter(e.target.value);
        setOtherCategoryText(val);
        setFormData((prev) => ({
            ...prev,
            category: val,
            categorySelect: "Other"
        }));
        const dupErr = val.trim() ? validateCustomMetadataEntry(val, categoryNames, "category") : "";
        setErrors((prev) => ({ ...prev, category: dupErr }));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const newErrors = {};

        const courseNameError = validateCourseName(formData.course_name);
        if (courseNameError) newErrors.course_name = courseNameError;

        if (isOtherProvider) {
            const provErr = validateCustomMetadataEntry(otherProviderText, providerNames, "provider");
            if (provErr) newErrors.provider = provErr;
        } else if (!formData.provider) {
            newErrors.provider = "This field is required";
        }

        if (isOtherCategory) {
            const catErr = validateCustomMetadataEntry(otherCategoryText, categoryNames, "category");
            if (catErr) newErrors.category = catErr;
        } else if (!formData.category) {
            newErrors.category = "This field is required";
        }

        const courseLinkError = validateCourseLink(formData.course_link);
        if (courseLinkError) newErrors.course_link = courseLinkError;

        const cleanedReason = normalizeSingleSpacing(formData.reason || "", { trimEdges: true });
        const reasonError = validateReason(formData.reason);
        if (reasonError) newErrors.reason = reasonError;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        if (cleanedReason !== formData.reason) {
            setFormData((prev) => ({ ...prev, reason: cleanedReason }));
        }

        setErrors({});
        onSubmit(e);
    };

    const handleClose = () => {
        if (isSubmitting) return;
        setIsOtherProvider(false);
        setOtherProviderText("");
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setErrors({});
        onClose();
    };

    // Calculate current dropdown selection label
    const currentProviderSelect = (() => {
        if (formData.providerSelect) return formData.providerSelect;
        if (isOtherProvider) return "Other";
        if (!formData.provider) return "";
        const matched = providerOptions.find(
            (opt) => opt.toLowerCase() === formData.provider.trim().toLowerCase()
        );
        return matched || "Other";
    })();

    const currentCategorySelect = (() => {
        if (formData.categorySelect) return formData.categorySelect;
        if (isOtherCategory) return "Other";
        if (!formData.category) return "";
        const matched = categoryOptions.find(
            (opt) => opt.toLowerCase() === formData.category.trim().toLowerCase()
        );
        return matched || "Other";
    })();

    return createPortal(
        <div className="emp-custom-modal-overlay">
            <div className="emp-custom-modal emp-request-course-modal" onClick={(e) => e.stopPropagation()}>
                {/* CLOSE BUTTON */}
                <button
                    type="button"
                    className="emp-modal-close"
                    onClick={handleClose}
                    aria-label="Close modal"
                >
                    <img src={closeicon} alt="close-icon" width={12} height={12} />
                </button>

                {/* HEADER */}
                <div className="emp-request-modal-header">
                    <h2 className="emp-request-modal-blue-title">Request a Course</h2>
                    <p>Submit a request for a course you want to learn</p>
                </div>

                {/* FORM */}
                <form onSubmit={handleFormSubmit} className="emp-request-form" noValidate autoComplete="off">
                    {/* ROW 1: COURSE NAME + PROVIDER */}
                    <div className="emp-request-form-grid">
                        <div className="emp-form-group">
                            <label htmlFor="course_name">
                                Course Name <span className="emp-required-star">*</span>
                            </label>
                            <input
                                id="course_name"
                                type="text"
                                maxLength={100}
                                autoComplete="off"
                                className={`emp-form-input ${errors.course_name ? "emp-form-input-error" : ""}`}
                                placeholder="Enter the course name"
                                value={formData.course_name}
                                onChange={(e) => {
                                    const raw = e.target.value
                                        .replace(/[^a-zA-Z0-9\s\-/&+.,()]/g, "")
                                        .replace(/^\s+/, "")
                                        .replace(/\s{2,}/g, " ")
                                        .slice(0, 100);
                                    const val = capitalizeFirstLetter(raw);
                                    setFormData({
                                        ...formData,
                                        course_name: val,
                                    });
                                    if (errors.course_name) {
                                        setErrors((prev) => ({ ...prev, course_name: validateCourseName(val) }));
                                    }
                                }}
                                onKeyDown={handleSingleSpaceKeyDown}
                                onPaste={(e) =>
                                    handleSingleSpacePaste(e, 100, (pastedVal) => {
                                        const cleaned = pastedVal
                                            .replace(/[^a-zA-Z0-9\s\-/&+.,()]/g, "")
                                            .replace(/^\s+/, "")
                                            .replace(/\s{2,}/g, " ")
                                            .slice(0, 100);
                                        const val = capitalizeFirstLetter(cleaned);
                                        setFormData((prev) => ({
                                            ...prev,
                                            course_name: val,
                                        }));
                                        if (errors.course_name) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                course_name: validateCourseName(val),
                                            }));
                                        }
                                    })
                                }
                                onBlur={() => {
                                    const trimmed = capitalizeFirstLetter((formData.course_name || "").trim());
                                    if (trimmed !== formData.course_name) {
                                        setFormData((prev) => ({ ...prev, course_name: trimmed }));
                                    }
                                    const err = validateCourseName(trimmed);
                                    setErrors((prev) => ({ ...prev, course_name: err }));
                                }}
                            />
                            {errors.course_name && (
                                <span className="emp-form-error-text">{errors.course_name}</span>
                            )}
                        </div>

                        <div className="emp-form-group">
                            <div className="emp-form-label-row">
                                <label htmlFor="provider">
                                    Provider / Platform <span className="emp-required-star">*</span>
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
                                <CustomDropdown
                                    id="provider"
                                    options={providerOptions}
                                    value={currentProviderSelect}
                                    placeholder="Select provider"
                                    onSelect={handleProviderSelect}
                                    hasError={Boolean(errors.provider)}
                                />
                            ) : (
                                <div className="emp-custom-input-wrapper">
                                    <input
                                        ref={otherProviderInputRef}
                                        id="provider"
                                        type="text"
                                        className={`emp-form-input emp-form-input-custom ${errors.provider ? "emp-form-input-error" : ""}`}
                                        maxLength={100}
                                        placeholder="e.g., Pluralsight, edX, LinkedIn Learning"
                                        value={otherProviderText}
                                        onChange={handleOtherProviderInput}
                                        required
                                    />
                                </div>
                            )}
                            {errors.provider && (
                                <span className="emp-form-error-text">{errors.provider}</span>
                            )}
                        </div>
                    </div>

                    {/* ROW 2: CATEGORY */}
                    <div className="emp-form-group">
                        <div className="emp-form-label-row">
                            <label htmlFor="category">
                                Course Category <span className="emp-required-star">*</span>
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
                            <CustomDropdown
                                id="category"
                                options={categoryOptions}
                                value={currentCategorySelect}
                                placeholder="Select category"
                                onSelect={handleCategorySelect}
                                hasError={Boolean(errors.category)}
                            />
                        ) : (
                            <div className="emp-custom-input-wrapper">
                                <input
                                    ref={otherCategoryInputRef}
                                    id="category"
                                    type="text"
                                    className={`emp-form-input-full emp-form-input-custom ${errors.category ? "emp-form-input-error" : ""}`}
                                    maxLength={100}
                                    placeholder="e.g., Mobile Development, Embedded Systems, Blockchain"
                                    value={otherCategoryText}
                                    onChange={handleOtherCategoryInput}
                                    required
                                />
                            </div>
                        )}
                        {errors.category && (
                            <span className="emp-form-error-text">{errors.category}</span>
                        )}
                    </div>

                    {/* ROW 3: COURSE LINK */}
                    <div className="emp-form-group">
                        <label htmlFor="course_link">
                            Course Link (if available)
                        </label>
                        <div className={`emp-link-input-wrapper ${errors.course_link ? "emp-form-input-error" : ""}`}>
                            <div className="emp-link-input-addon">
                                <img src={courseLinkIcon} alt="link-icon" className="emp-course-link-icon" />
                            </div>
                            <input
                                id="course_link"
                                type="url"
                                autoComplete="off"
                                className="emp-link-input-field"
                                placeholder="Paste course link here"
                                value={formData.course_link || ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({
                                        ...formData,
                                        course_link: val,
                                    });
                                    if (errors.course_link) {
                                        setErrors((prev) => ({
                                            ...prev,
                                            course_link: validateCourseLink(val),
                                        }));
                                    }
                                }}
                                onBlur={() => {
                                    if (formData.course_link?.trim()) {
                                        setErrors((prev) => ({
                                            ...prev,
                                            course_link: validateCourseLink(formData.course_link),
                                        }));
                                    }
                                }}
                            />
                        </div>
                        {errors.course_link && (
                            <span className="emp-form-error-text">{errors.course_link}</span>
                        )}
                    </div>

                    {/* ROW 4: REASON */}
                    <div className="emp-form-group">
                        <label htmlFor="reason">
                            Why do you want to learn this course? <span className="emp-required-star">*</span>
                        </label>
                        <div className="emp-textarea-wrapper">
                            <textarea
                                id="reason"
                                className={`emp-form-textarea ${errors.reason ? "emp-form-textarea-error" : ""}`}
                                maxLength={500}
                                placeholder="Describe how this course will help you and the organization...."
                                value={formData.reason || ""}
                                onKeyDown={handleSingleSpaceKeyDown}
                                onChange={(e) => {
                                    const rawVal = applySingleSpaceTextChange(e, 500);
                                    const val = formatSentenceCase(rawVal);
                                    setFormData({
                                        ...formData,
                                        reason: val,
                                    });
                                    if (errors.reason) {
                                        setErrors((prev) => ({ ...prev, reason: validateReason(val) }));
                                    }
                                }}
                                onPaste={(e) => {
                                    handleSingleSpacePaste(e, 500, (nextVal) => {
                                        const val = formatSentenceCase(nextVal);
                                        setFormData((prev) => ({ ...prev, reason: val }));
                                        if (errors.reason) {
                                            setErrors((prev) => ({ ...prev, reason: validateReason(val) }));
                                        }
                                    });
                                }}
                                onBlur={() => {
                                    const cleaned = formatSentenceCase(normalizeSingleSpacing(formData.reason || "", { trimEdges: true }).slice(0, 500));
                                    if (cleaned !== (formData.reason || "")) {
                                        setFormData((prev) => ({ ...prev, reason: cleaned }));
                                    }
                                    if (errors.reason) {
                                        setErrors((prev) => ({ ...prev, reason: validateReason(cleaned) }));
                                    }
                                }}
                            />
                            <span className="emp-char-counter">
                                {(formData.reason || "").length}/500
                            </span>
                        </div>
                        {errors.reason && (
                            <span className="emp-form-error-text">{errors.reason}</span>
                        )}
                    </div>

                    {/* FOOTER ACTIONS */}
                    <div className="emp-modal-action-footer">
                        <button
                            type="button"
                            className="emp-btn-modal-cancel"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="emp-btn-modal-submit"
                            disabled={isSubmitting}
                            style={isSubmitting ? { opacity: 0.7, cursor: "not-allowed" } : {}}
                        >
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default RequestCourseModal;