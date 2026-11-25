import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import closeicon from "../../../assets/course_library/close.svg";
import downArrowIcon from "../../../assets/course_library/down_arrow.svg";
import courseLinkIcon from "../../../assets/course_library/course_link.svg";

import "../../../styles/employee/RequestCourseModal.css";
import "../../../styles/reportingmanager/RecommendCourseModal.css";
import "../../../styles/reportingmanager/RequestCourseModal.css";
import ChooseEmployeeDropdown from "./ChooseEmployeeDropdown";
import { useAuth } from "../../../context/AuthContext";
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
    formData = {},
    setFormData,
    isSubmitting = false,
}) => {
    const { token } = useAuth();
    const [teamMembers, setTeamMembers] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const employeeSelectRef = useRef(null);

    const { providerNames, categoryNames } = useCourseMetadata(token, isOpen);

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
    const [touched, setTouched] = useState({});

    const otherProviderInputRef = useRef(null);
    const otherCategoryInputRef = useRef(null);

    // Fetch live direct reports and all enterprise employees from Azure AD / API
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchTeamMembers = async () => {
            setIsLoadingMembers(true);
            try {
                const authToken = token || localStorage.getItem("lms_token");
                const AVATAR_COLORS = [
                    "#F97FFF", "#BED60E", "#5CDE8A", "#FF7FAE", "#A87FFF",
                    "#fdba74", "#93c5fd", "#7dd3fc", "#fb7185", "#38bdf8"
                ];

                const mapEmployee = (m, idx) => {
                    const rawName = m.full_name || m.name || "—";
                    const cleanName = rawName.split("(")[0].trim();
                    const initials = cleanName
                        .split(" ")
                        .filter(Boolean)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                    return {
                        id: m.employee_id || `EMP${idx + 1}`,
                        employee_id: m.employee_id,
                        name: cleanName,
                        initials: initials || "EM",
                        avatarBg: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                        email: m.work_email || m.email || "",
                        department: m.department || "",
                        role: m.role || m.job_title || "",
                    };
                };

                const [teamRes, allRes] = await Promise.allSettled([
                    axios.get(`${API_BASE_URL}/api/auth/team-members`, {
                        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                    }),
                    axios.get(`${API_BASE_URL}/api/auth/employees`, {
                        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                    }),
                ]);

                if (isMounted) {
                    if (teamRes.status === "fulfilled" && teamRes.value.data?.members) {
                        setTeamMembers(teamRes.value.data.members.map(mapEmployee));
                    }
                    if (allRes.status === "fulfilled" && allRes.value.data?.employees) {
                        const emps = allRes.value.data.employees
                            .filter(e => (e.role || "").toLowerCase() === "employee")
                            .map(mapEmployee);
                        setAllEmployees(emps);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch assigned team members from Azure AD:", err);
            } finally {
                if (isMounted) setIsLoadingMembers(false);
            }
        };

        fetchTeamMembers();
        return () => {
            isMounted = false;
        };
    }, [isOpen, token]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (employeeSelectRef.current && !employeeSelectRef.current.contains(e.target)) {
                setIsEmployeeDropdownOpen(false);
                setMemberSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);



    // Synchronize local state only when modal opens (not while user types)
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            setMemberSearchQuery("");
            setErrors({});
            setTouched({});

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

    // Field-level Validators
    const validateCourseName = (name) => {
        const trimmed = (name || "").trim();
        if (!trimmed) {
            return "Course Name is required.";
        }
        if (trimmed.length < 2) {
            return "Course Name must be at least 2 characters.";
        }
        if (trimmed.length > 100) {
            return "Course Name must not exceed 100 characters.";
        }
        // Check for multiple consecutive spaces
        if (/\s{2,}/.test(name)) {
            return "No more than 1 consecutive whitespace is allowed.";
        }
        // Only alphabets and single spaces allowed (no numbers, no symbols)
        if (!/^[a-zA-Z]+(\s[a-zA-Z]+)*$/.test(trimmed)) {
            return "Course Name must contain only alphabets (no numbers or special characters).";
        }
        return "";
    };

    const validateProvider = (provider, isOther, otherText) => {
        if (isOther) {
            const trimmed = (otherText || "").trim();
            if (!trimmed) {
                return "Please enter the custom Provider / Platform name.";
            }
            if (trimmed.length < 2) {
                return "Provider name must be at least 2 characters.";
            }
            if (!/[a-zA-Z]/.test(trimmed)) {
                return "Provider name must contain at least one letter.";
            }
            const dupErr = validateCustomMetadataEntry(trimmed, providerNames, "provider");
            if (dupErr) return dupErr;
            return "";
        }
        if (!provider || !provider.trim()) {
            return "Please select a Provider / Platform.";
        }
        return "";
    };

    const validateCategory = (category, isOther, otherText) => {
        if (isOther) {
            const trimmed = (otherText || "").trim();
            if (!trimmed) {
                return "Please enter the custom Course Category name.";
            }
            if (trimmed.length < 2) {
                return "Category name must be at least 2 characters.";
            }
            if (!/[a-zA-Z]/.test(trimmed)) {
                return "Category name must contain at least one letter.";
            }
            const dupErr = validateCustomMetadataEntry(trimmed, categoryNames, "category");
            if (dupErr) return dupErr;
            return "";
        }
        if (!category || !category.trim()) {
            return "Please select a Course Category.";
        }
        return "";
    };

    const validateCourseLink = (link) => {
        const trimmed = (link || "").trim();
        if (!trimmed) return "";
        if (!isValidUrl(trimmed)) {
            return "Please enter a valid course URL (e.g., https://example.com/...)";
        }
        if (trimmed.length > 250) {
            return "Course Link must not exceed 250 characters.";
        }
        return "";
    };

    const validateReason = (reason) => {
        const trimmed = normalizeSingleSpacing(reason || "", { trimEdges: true });
        if (!trimmed) {
            return "Please describe why you want to recommend this course.";
        }
        if (trimmed.length < 10) {
            return "Reason must be at least 10 characters long.";
        }
        if (trimmed.length > 500) {
            return "Reason must not exceed 500 characters.";
        }
        if (!/[a-zA-Z]/.test(trimmed)) {
            return "Reason must contain valid text.";
        }
        return "";
    };

    const handleProviderSelect = (opt) => {
        if (opt === "Other") {
            setIsOtherProvider(true);
            setFormData({
                ...formData,
                provider: otherProviderText.trim() || "",
                providerSelect: "Other"
            });
            const err = validateProvider("", true, otherProviderText);
            setErrors((prev) => ({ ...prev, provider: err }));
        } else {
            setIsOtherProvider(false);
            setOtherProviderText("");
            setFormData({
                ...formData,
                provider: opt,
                providerSelect: opt
            });
            setErrors((prev) => ({ ...prev, provider: "" }));
        }
        setTouched((prev) => ({ ...prev, provider: true }));
    };

    const handleResetProvider = () => {
        setIsOtherProvider(false);
        setOtherProviderText("");
        setFormData({
            ...formData,
            provider: "",
            providerSelect: ""
        });
        setErrors((prev) => ({ ...prev, provider: "" }));
    };

    const handleOtherProviderInput = (e) => {
        let val = e.target.value;
        val = val.replace(/[<>{}`]/g, "");
        if (val.length > 100) val = val.slice(0, 100);
        val = capitalizeFirstLetter(val);
        setOtherProviderText(val);
        setFormData((prev) => ({
            ...prev,
            provider: val,
            providerSelect: "Other"
        }));
        const err = validateProvider(val, true, val);
        setErrors((prev) => ({ ...prev, provider: err }));
    };

    const handleCategorySelect = (opt) => {
        if (opt === "Other") {
            setIsOtherCategory(true);
            setFormData({
                ...formData,
                category: otherCategoryText.trim() || "",
                categorySelect: "Other"
            });
            const err = validateCategory("", true, otherCategoryText);
            setErrors((prev) => ({ ...prev, category: err }));
        } else {
            setIsOtherCategory(false);
            setOtherCategoryText("");
            setFormData({
                ...formData,
                category: opt,
                categorySelect: opt
            });
            setErrors((prev) => ({ ...prev, category: "" }));
        }
        setTouched((prev) => ({ ...prev, category: true }));
    };

    const handleResetCategory = () => {
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setFormData({
            ...formData,
            category: "",
            categorySelect: ""
        });
        setErrors((prev) => ({ ...prev, category: "" }));
    };

    const handleOtherCategoryInput = (e) => {
        let val = e.target.value;
        val = val.replace(/[<>{}`]/g, "");
        if (val.length > 100) val = val.slice(0, 100);
        val = capitalizeFirstLetter(val);
        setOtherCategoryText(val);
        setFormData((prev) => ({
            ...prev,
            category: val,
            categorySelect: "Other"
        }));
        const err = validateCategory(val, true, val);
        setErrors((prev) => ({ ...prev, category: err }));
    };

    const validateMember = (members) => {
        if (!members || members.length === 0) {
            return "Please select at least one team member.";
        }
        return "";
    };

    const handleToggleMember = (memberId) => {
        setSelectedMemberIds((prev) => {
            const updated = prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId];
            setFormData((f) => ({ ...f, employee_ids: updated }));
            if (touched.member) {
                setErrors((e) => ({ ...e, member: validateMember(updated) }));
            }
            return updated;
        });
        setTouched((prev) => ({ ...prev, member: true }));
    };

    const handleSelectAllMembers = (currentList = null) => {
        const targetList = (Array.isArray(currentList) && currentList.length > 0)
            ? currentList
            : teamMembers;
        setSelectedMemberIds((prev) => {
            const allTargetSelected = targetList.every((m) => prev.includes(m.id) || prev.includes(m.employee_id));
            const targetIds = targetList.map((m) => m.id || m.employee_id);
            const updated = allTargetSelected
                ? prev.filter((id) => !targetIds.includes(id))
                : Array.from(new Set([...prev, ...targetIds]));
            setFormData((f) => ({ ...f, employee_ids: updated }));
            if (touched.member) {
                setErrors((e) => ({ ...e, member: validateMember(updated) }));
            }
            return updated;
        });
        setTouched((prev) => ({ ...prev, member: true }));
    };

    const getSelectedMemberDisplayText = () => {
        if (isLoadingMembers) return "Loading team members...";
        const allList = [...teamMembers, ...allEmployees];
        const uniqueList = Array.from(new Map(allList.map((m) => [m.id, m])).values());
        if (uniqueList.length === 0) return "No team members assigned";
        if (selectedMemberIds.length === 0) return "Choose employees";
        if (selectedMemberIds.length === 1) {
            const member = uniqueList.find((m) => m.id === selectedMemberIds[0] || m.employee_id === selectedMemberIds[0]);
            return member ? member.name : "1 employee selected";
        }
        if (selectedMemberIds.length === teamMembers.length && teamMembers.length > 0) {
            return "All team members selected";
        }
        const names = selectedMemberIds.map((id) => {
            const m = uniqueList.find((x) => x.id === id || x.employee_id === id);
            return m ? m.name : id;
        });
        return names.join(", ");
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const courseNameErr = validateCourseName(formData.course_name);
        const memberErr = validateMember(selectedMemberIds);
        const providerErr = validateProvider(formData.provider, isOtherProvider, otherProviderText);
        const categoryErr = validateCategory(formData.category, isOtherCategory, otherCategoryText);
        const courseLinkErr = validateCourseLink(formData.course_link);
        const reasonErr = validateReason(formData.reason);

        const newErrors = {};
        if (courseNameErr) newErrors.course_name = courseNameErr;
        if (memberErr) newErrors.member = memberErr;
        if (providerErr) newErrors.provider = providerErr;
        if (categoryErr) newErrors.category = categoryErr;
        if (courseLinkErr) newErrors.course_link = courseLinkErr;
        if (reasonErr) newErrors.reason = reasonErr;

        setTouched({
            course_name: true,
            member: true,
            provider: true,
            category: true,
            course_link: true,
            reason: true,
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
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
        setSelectedMemberIds([]);
        setIsEmployeeDropdownOpen(false);
        setErrors({});
        setTouched({});
        onClose();
    };

    const currentProviderSelect =
        formData.providerSelect ||
        (providerOptions.filter(p => p !== "Other").some(p => p.toLowerCase() === (formData.provider || "").trim().toLowerCase())
            ? (providerOptions.find(p => p.toLowerCase() === (formData.provider || "").trim().toLowerCase()) || formData.provider)
            : isOtherProvider
                ? "Other"
                : "");

    const currentCategorySelect =
        formData.categorySelect ||
        (categoryOptions.filter(c => c !== "Other").some(c => c.toLowerCase() === (formData.category || "").trim().toLowerCase())
            ? (categoryOptions.find(c => c.toLowerCase() === (formData.category || "").trim().toLowerCase()) || formData.category)
            : isOtherCategory
                ? "Other"
                : "");

    return (
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
                    <h2 className="emp-request-modal-blue-title">Recommend New Course</h2>
                    <p>Submit a request for a course you want to recommend</p>
                </div>

                {/* FORM */}
                <form onSubmit={handleFormSubmit} className="emp-request-form" noValidate>
                    {/* 2x2 GRID (ROW 1: Course Name + Select Team Member, ROW 2: Provider + Category) */}
                    <div className="emp-request-form-grid">
                        {/* ITEM 1: COURSE NAME */}
                        <div className="emp-form-group">
                            <label htmlFor="course_name">
                                Course Name <span className="emp-required-star">*</span>
                            </label>
                            <input
                                id="course_name"
                                type="text"
                                className={`emp-form-input ${touched.course_name && errors.course_name ? "emp-form-input-error" : ""}`}
                                placeholder="Enter the course name"
                                maxLength={100}
                                value={formData.course_name || ""}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    val = val.replace(/[^a-zA-Z\s]/g, "");
                                    val = val.replace(/^\s+/, "");
                                    val = val.replace(/\s{2,}/g, " ");
                                    if (val.length > 100) val = val.slice(0, 100);
                                    val = capitalizeFirstLetter(val);

                                    setFormData({
                                        ...formData,
                                        course_name: val,
                                    });
                                    if (touched.course_name) {
                                        setErrors((prev) => ({ ...prev, course_name: validateCourseName(val) }));
                                    }
                                }}
                                onBlur={() => {
                                    const trimmed = capitalizeFirstLetter((formData.course_name || "").trim());
                                    if (trimmed !== formData.course_name) {
                                        setFormData((prev) => ({ ...prev, course_name: trimmed }));
                                    }
                                    setTouched((prev) => ({ ...prev, course_name: true }));
                                    setErrors((prev) => ({ ...prev, course_name: validateCourseName(trimmed) }));
                                }}
                                autoComplete="off"
                            />
                            {touched.course_name && errors.course_name && (
                                <span className="emp-form-error-text">{errors.course_name}</span>
                            )}
                        </div>

                        {/* ITEM 2: SELECT TEAM MEMBER */}
                        <div className="emp-form-group" ref={employeeSelectRef} style={{ position: "relative" }}>
                            <label htmlFor="select_team_member">
                                Select Team Member <span className="emp-required-star">*</span>
                            </label>
                            <div
                                id="select_team_member"
                                className={`emp-form-input ${isEmployeeDropdownOpen ? "is-active" : ""} ${touched.member && errors.member ? "emp-form-input-error" : ""}`}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    cursor: "pointer",
                                    userSelect: "none"
                                }}
                                onClick={() => {
                                    setIsEmployeeDropdownOpen(true);
                                    setTouched((prev) => ({ ...prev, member: true }));
                                }}
                            >
                                <input
                                    type="text"
                                    className={`rm-select-search-input ${selectedMemberIds.length > 0 && !memberSearchQuery ? "has-selection" : ""}`}
                                    placeholder={memberSearchQuery ? "Type to search..." : getSelectedMemberDisplayText()}
                                    value={memberSearchQuery}
                                    onKeyDown={(e) => {
                                        if (e.key === " ") {
                                            const input = e.target;
                                            const val = input.value || "";
                                            const selStart = input.selectionStart ?? 0;
                                            const selEnd = input.selectionEnd ?? selStart;
                                            if (selStart === 0 || val[selStart - 1] === " " || val[selEnd] === " ") {
                                                e.preventDefault();
                                            }
                                        }
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const paste = (e.clipboardData || window.clipboardData)?.getData("text") || "";
                                        const input = e.target;
                                        const val = input.value || "";
                                        const start = input.selectionStart ?? 0;
                                        const end = input.selectionEnd ?? start;
                                        const nextVal = (val.slice(0, start) + paste + val.slice(end))
                                            .replace(/^\s+/, "")
                                            .replace(/\s{2,}/g, " ");
                                        setMemberSearchQuery(nextVal);
                                        if (!isEmployeeDropdownOpen) setIsEmployeeDropdownOpen(true);
                                        setTouched((prev) => ({ ...prev, member: true }));
                                    }}
                                    onChange={(e) => {
                                        const cleanVal = e.target.value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
                                        setMemberSearchQuery(cleanVal);
                                        if (!isEmployeeDropdownOpen) setIsEmployeeDropdownOpen(true);
                                        setTouched((prev) => ({ ...prev, member: true }));
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isEmployeeDropdownOpen) setIsEmployeeDropdownOpen(true);
                                    }}
                                    aria-label="Select Team Member"
                                />
                                {memberSearchQuery && (
                                    <button
                                        type="button"
                                        className="rm-search-clear-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMemberSearchQuery("");
                                        }}
                                        aria-label="Clear search"
                                    >
                                        ✕
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="rm-select-arrow-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEmployeeDropdownOpen((prev) => !prev);
                                        setTouched((prev) => ({ ...prev, member: true }));
                                    }}
                                    aria-label="Toggle dropdown"
                                >
                                    <img
                                        src={downArrowIcon}
                                        alt=""
                                        className={`rm-select-arrow-icon ${isEmployeeDropdownOpen ? "rotate-180" : ""}`}
                                    />
                                </button>
                            </div>

                            {touched.member && errors.member && (
                                <span className="emp-form-error-text">{errors.member}</span>
                            )}

                            {isEmployeeDropdownOpen && (
                                <ChooseEmployeeDropdown
                                    teamMembers={teamMembers}
                                    searchQuery={memberSearchQuery}
                                    selectedMemberIds={selectedMemberIds}
                                    onToggleMember={handleToggleMember}
                                    onSelectAll={handleSelectAllMembers}
                                    isLoading={isLoadingMembers}
                                />
                            )}
                        </div>

                        {/* ITEM 3: PROVIDER / PLATFORM */}
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
                                    hasError={Boolean(touched.provider && errors.provider)}
                                />
                            ) : (
                                <div className="emp-custom-input-wrapper">
                                    <input
                                        ref={otherProviderInputRef}
                                        id="provider"
                                        type="text"
                                        className={`emp-form-input emp-form-input-custom ${touched.provider && errors.provider ? "emp-form-input-error" : ""}`}
                                        maxLength={100}
                                        placeholder="e.g., Pluralsight, edX, LinkedIn Learning"
                                        value={otherProviderText}
                                        onChange={handleOtherProviderInput}
                                        onBlur={() => {
                                            setTouched((prev) => ({ ...prev, provider: true }));
                                            setErrors((prev) => ({ ...prev, provider: validateProvider(otherProviderText, true, otherProviderText) }));
                                        }}
                                        autoComplete="off"
                                    />
                                </div>
                            )}
                            {touched.provider && errors.provider && (
                                <span className="emp-form-error-text">{errors.provider}</span>
                            )}
                        </div>

                        {/* ITEM 4: COURSE CATEGORY */}
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
                                    hasError={Boolean(touched.category && errors.category)}
                                />
                            ) : (
                                <div className="emp-custom-input-wrapper">
                                    <input
                                        ref={otherCategoryInputRef}
                                        id="category"
                                        type="text"
                                        className={`emp-form-input-full emp-form-input-custom ${touched.category && errors.category ? "emp-form-input-error" : ""}`}
                                        maxLength={100}
                                        placeholder="e.g., Mobile Development, Embedded Systems, Blockchain"
                                        value={otherCategoryText}
                                        onChange={handleOtherCategoryInput}
                                        onBlur={() => {
                                            setTouched((prev) => ({ ...prev, category: true }));
                                            setErrors((prev) => ({ ...prev, category: validateCategory(otherCategoryText, true, otherCategoryText) }));
                                        }}
                                        autoComplete="off"
                                    />
                                </div>
                            )}
                            {touched.category && errors.category && (
                                <span className="emp-form-error-text">{errors.category}</span>
                            )}
                        </div>
                    </div>

                    {/* ROW 3: COURSE LINK */}
                    <div className="emp-form-group">
                        <label htmlFor="course_link">
                            Course Link (if available)
                        </label>
                        <div className={`emp-link-input-wrapper ${touched.course_link && errors.course_link ? "emp-form-input-error" : ""}`}>
                            <div className="emp-link-input-addon">
                                <img src={courseLinkIcon} alt="link-icon" className="emp-course-link-icon" />
                            </div>
                            <input
                                id="course_link"
                                type="url"
                                className="emp-link-input-field"
                                placeholder="Paste course link here (e.g. https://coursera.org/...)"
                                maxLength={250}
                                value={formData.course_link || ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({
                                        ...formData,
                                        course_link: val,
                                    });
                                    if (touched.course_link) {
                                        setErrors((prev) => ({ ...prev, course_link: validateCourseLink(val) }));
                                    }
                                }}
                                onBlur={() => {
                                    setTouched((prev) => ({ ...prev, course_link: true }));
                                    setErrors((prev) => ({ ...prev, course_link: validateCourseLink(formData.course_link) }));
                                }}
                                autoComplete="off"
                            />
                        </div>
                        {touched.course_link && errors.course_link && (
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
                                className={`emp-form-textarea ${touched.reason && errors.reason ? "emp-form-textarea-error" : ""}`}
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
                                    if (touched.reason) {
                                        setErrors((prev) => ({ ...prev, reason: validateReason(val) }));
                                    }
                                }}
                                onPaste={(e) => {
                                    handleSingleSpacePaste(e, 500, (nextVal) => {
                                        const val = formatSentenceCase(nextVal);
                                        setFormData((prev) => ({ ...prev, reason: val }));
                                        if (touched.reason) {
                                            setErrors((prev) => ({ ...prev, reason: validateReason(val) }));
                                        }
                                    });
                                }}
                                onBlur={() => {
                                    const cleaned = formatSentenceCase(normalizeSingleSpacing(formData.reason || "", { trimEdges: true }).slice(0, 500));
                                    if (cleaned !== (formData.reason || "")) {
                                        setFormData((prev) => ({ ...prev, reason: cleaned }));
                                    }
                                    setTouched((prev) => ({ ...prev, reason: true }));
                                    setErrors((prev) => ({ ...prev, reason: validateReason(cleaned) }));
                                }}
                            />
                            <span className="emp-char-counter">
                                {(formData.reason || "").length}/500
                            </span>
                        </div>
                        {touched.reason && errors.reason && (
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
        </div>
    );
};

export default RequestCourseModal;