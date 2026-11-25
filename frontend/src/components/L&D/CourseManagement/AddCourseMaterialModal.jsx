import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { X, ArrowRight } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import useSubmitLock, { extractApiErrorMessage } from "../../../hooks/useSubmitLock";
import { MATERIAL_TYPES, validateCustomMetadataEntry } from "../../../constants/courseMetadata";
import useCourseMetadata from "../../../hooks/useCourseMetadata";
import { resolveAndPersistFormMetadata } from "../../../services/courseMetadataService";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
    sanitizeSingleSpaceInput,
} from "../../../utils/validationUtils";
import dragDropIcon from "../../../assets/coursemanagement/drag-drop.svg";
import dropdownIcon from "../../../assets/coursemanagement/dropdown.svg";
import successfulIcon from "../../../assets/coursemanagement/successful.svg";
import CourseModalDropdown from "./CourseModalDropdown";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const parseDuration = (str) => {
    if (!str) return { hours: "", minutes: "" };
    const hMatch = str.match(/(\d+)\s*h/i);
    const mMatch = str.match(/(\d+)\s*m/i);
    if (hMatch || mMatch) {
        return {
            hours: hMatch ? hMatch[1] : "",
            minutes: mMatch ? mMatch[1] : "",
        };
    }
    if (/^\d+$/.test(String(str).trim())) {
        return { hours: String(str).trim(), minutes: "" };
    }
    return { hours: "", minutes: "" };
};

const formatDuration = (h, m) => {
    const hTrim = String(h || "").trim();
    const mTrim = String(m || "").trim();
    if (hTrim && mTrim) return `${hTrim}h ${mTrim}m`;
    if (hTrim) return `${hTrim}h`;
    if (mTrim) return `${mTrim}m`;
    return "";
};


/**
 * AddCourseMaterialModal
 * Exactly matches Figma UI/UX:
 * - Fixed dialog box with NO scrolling
 * - Exact typography, field sizes, and spacing
 * - Tabs: "Video Course" and "Study Material"
 * - Supports pre-filling via initialCourse (from Purchase Course row click)
 * - Dropdown Course Provider and Course Category with "Other" option support
 */
export default function AddCourseMaterialModal({ isOpen, onClose, onAdded, onProceedToAssign, initialCourse }) {
    const { user } = useAuth();
    const { providerNames, categoryNames, emailNames, emails } = useCourseMetadata(undefined, isOpen);
    const [activeTab, setActiveTab] = useState("video");
    const [successType, setSuccessType] = useState(null); // "course" | "material" | null

    // Determine whether course title, provider, and category should be disabled
    const isPreFilledCourse = Boolean(initialCourse);
    const isTitleDisabled = isPreFilledCourse;
    const isProviderDisabled = isPreFilledCourse;
    const isCategoryDisabled = isPreFilledCourse;

    // ── "Others" custom option toggles ────────────────────
    const [isOtherProvider, setIsOtherProvider] = useState(false);
    const [otherProviderText, setOtherProviderText] = useState("");
    const [isOtherCategory, setIsOtherCategory] = useState(false);
    const [otherCategoryText, setOtherCategoryText] = useState("");
    const [isOtherMaterialType, setIsOtherMaterialType] = useState(false);
    const [otherMaterialTypeText, setOtherMaterialTypeText] = useState("");
    const otherProviderInputRef = useRef(null);
    const otherCategoryInputRef = useRef(null);
    const otherMaterialTypeInputRef = useRef(null);

    // ── Video Course form state ──────────────────────────
    const [courseUrl, setCourseUrl] = useState("");
    const [courseTitle, setCourseTitle] = useState("");
    const [provider, setProvider] = useState("");
    const [category, setCategory] = useState("");
    const [durationHours, setDurationHours] = useState("");
    const [durationMinutes, setDurationMinutes] = useState("");
    const [courseAccountEmail, setCourseAccountEmail] = useState("");
    const [estimatedCost, setEstimatedCost] = useState("");
    const [description, setDescription] = useState("");
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailDragOver, setThumbnailDragOver] = useState(false);
    const thumbnailInputRef = useRef(null);

    // ── Study Material form state ──────────────────────
    const [materialFile, setMaterialFile] = useState(null);
    const [materialDragOver, setMaterialDragOver] = useState(false);
    const [matTitle, setMatTitle] = useState("");
    const [matType, setMatType] = useState("");
    const [matDesc, setMatDesc] = useState("");
    const materialInputRef = useRef(null);

    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [lastAddedCourse, setLastAddedCourse] = useState(null);
    const { isSubmitting, runWithLock, resetIdempotencyKey } = useSubmitLock();

    const maxDescChars = 500;
    const maxMatDescChars = 500;

    // Reset validation errors whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            setSubmitError("");
            resetIdempotencyKey();
        }
    }, [isOpen, resetIdempotencyKey]);

    // Auto-focus "Others" input fields
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

    useEffect(() => {
        if (isOtherMaterialType && otherMaterialTypeInputRef.current) {
            otherMaterialTypeInputRef.current.focus();
        }
    }, [isOtherMaterialType]);

    // Pre-fill Video Course form whenever modal opens with a selected row course
    useEffect(() => {
        if (isOpen && initialCourse) {
            setActiveTab("video");
            setCourseUrl(initialCourse.courseUrl || initialCourse.course_url || initialCourse.course_link || "");
            setCourseTitle(initialCourse.courseTitle || initialCourse.courseName || initialCourse.course_name || initialCourse.title || "");

            // Match provider with live DB providers
            const initialProv = initialCourse.provider || initialCourse.provider_name || "";
            const matchedProv = (providerNames || []).find(
                (p) => p && p.toLowerCase() === initialProv.toLowerCase()
            );
            if (matchedProv) {
                setProvider(matchedProv);
                setIsOtherProvider(false);
                setOtherProviderText("");
            } else if (initialProv) {
                setIsOtherProvider(true);
                setProvider("Others");
                setOtherProviderText(initialProv);
            } else {
                setProvider("");
                setIsOtherProvider(false);
                setOtherProviderText("");
            }

            // Match category with live DB categories
            const initialCat = initialCourse.category || initialCourse.category_name || "";
            const matchedCat = (categoryNames || []).find(
                (c) => c && c.toLowerCase() === initialCat.toLowerCase()
            );
            if (matchedCat) {
                setCategory(matchedCat);
                setIsOtherCategory(false);
                setOtherCategoryText("");
            } else if (initialCat) {
                setIsOtherCategory(true);
                setCategory("Others");
                setOtherCategoryText(initialCat);
            } else {
                setCategory("");
                setIsOtherCategory(false);
                setOtherCategoryText("");
            }

            const parsedDur = parseDuration(initialCourse.duration || "");
            setDurationHours(parsedDur.hours);
            setDurationMinutes(parsedDur.minutes);
            setCourseAccountEmail(initialCourse.accountEmail || "");
            const rawCost = initialCourse.estimatedCost != null
                ? String(initialCourse.estimatedCost)
                : initialCourse.rawPrice != null
                    ? String(initialCourse.rawPrice)
                    : initialCourse.price
                        ? String(initialCourse.price).replace(/[^\d]/g, "")
                        : "";
            const parsedCost = rawCost ? Math.round(parseFloat(rawCost.replace(/,/g, "")) || 0) : 0;
            const wholeCost = parsedCost > 0 ? String(parsedCost) : "";
            setEstimatedCost(wholeCost);
            setDescription(normalizeSingleSpacing(initialCourse.description || "", { trimEdges: true }).slice(0, maxDescChars));
            setThumbnailFile(null);
            setSuccessType(null);
        } else if (isOpen && !initialCourse) {
            setActiveTab("video");
            setCourseUrl("");
            setCourseTitle("");
            setProvider("");
            setCategory("");
            setDurationHours("");
            setDurationMinutes("");
            setCourseAccountEmail("");
            setEstimatedCost("");
            setDescription("");
            setThumbnailFile(null);
            setIsOtherProvider(false);
            setOtherProviderText("");
            setIsOtherCategory(false);
            setOtherCategoryText("");
            setIsOtherMaterialType(false);
            setOtherMaterialTypeText("");
            setSuccessType(null);
        }
    }, [isOpen, initialCourse]);

    if (!isOpen) return null;

    // Reset entire modal when closed
    const handleClose = () => {
        if (isSubmitting) return;
        setSuccessType(null);
        setActiveTab("video");
        setCourseUrl("");
        setCourseTitle("");
        setProvider("");
        setCategory("");
        setDurationHours("");
        setDurationMinutes("");
        setCourseAccountEmail("");
        setEstimatedCost("");
        setDescription("");
        setThumbnailFile(null);
        setMaterialFile(null);
        setMatTitle("");
        setMatType("");
        setMatDesc("");
        setIsOtherProvider(false);
        setOtherProviderText("");
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setIsOtherMaterialType(false);
        setOtherMaterialTypeText("");
        setErrors({});
        setSubmitError("");
        setLastAddedCourse(null);
        onClose();
    };

    const handleCostChange = (e) => {
        const val = e.target.value;
        // Strictly whole numbers (digits only)
        if (val === "" || /^\d+$/.test(val)) {
            setEstimatedCost(val);
            if (errors.estimatedCost) {
                setErrors((prev) => ({ ...prev, estimatedCost: "" }));
            }
        }
    };

    const handleDurationHoursChange = (e) => {
        const val = e.target.value;
        if (val === "" || /^\d+$/.test(val)) {
            setDurationHours(val);
            if (errors.duration) {
                setErrors((prev) => ({ ...prev, duration: "" }));
            }
        }
    };

    const handleDurationMinutesChange = (e) => {
        const val = e.target.value;
        if (val === "" || /^\d+$/.test(val)) {
            const num = parseInt(val, 10);
            if (val === "" || (num >= 0 && num < 60)) {
                setDurationMinutes(val);
                if (errors.duration) {
                    setErrors((prev) => ({ ...prev, duration: "" }));
                }
            }
        }
    };

    const handleProviderChange = (e) => {
        const val = e.target.value;
        if (errors.provider) {
            setErrors((prev) => ({ ...prev, provider: "" }));
        }
        if (val === "Others" || val === "Other") {
            setIsOtherProvider(true);
            setProvider("Others");
        } else {
            setIsOtherProvider(false);
            setProvider(val);
        }
    };

    const handleResetProvider = () => {
        setIsOtherProvider(false);
        setOtherProviderText("");
        setProvider("");
        if (errors.provider) {
            setErrors((prev) => ({ ...prev, provider: "" }));
        }
    };

    const handleCategoryChange = (e) => {
        const val = e.target.value;
        if (errors.category) {
            setErrors((prev) => ({ ...prev, category: "" }));
        }
        if (val === "Others" || val === "Other") {
            setIsOtherCategory(true);
            setCategory("Others");
        } else {
            setIsOtherCategory(false);
            setCategory(val);
        }
    };

    const handleResetCategory = () => {
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setCategory("");
        if (errors.category) {
            setErrors((prev) => ({ ...prev, category: "" }));
        }
    };

    const handleMaterialTypeChange = (e) => {
        const val = e.target.value;
        if (errors.matType) {
            setErrors((prev) => ({ ...prev, matType: "" }));
        }
        if (val === "Others" || val === "Other") {
            setIsOtherMaterialType(true);
            setMatType("Others");
        } else {
            setIsOtherMaterialType(false);
            setMatType(val);
        }
    };

    const handleResetMaterialType = () => {
        setIsOtherMaterialType(false);
        setOtherMaterialTypeText("");
        setMatType("");
        if (errors.matType) {
            setErrors((prev) => ({ ...prev, matType: "" }));
        }
    };

    // "Fetch course" — clears stale validation errors on URL change
    const handleFetchCourse = () => {
        if (!courseUrl) return;

        if (errors.courseUrl) {
            setErrors((prev) => ({ ...prev, courseUrl: "" }));
        }
        setErrors((prev) => ({
            ...prev,
            courseTitle: "",
            provider: "",
            category: "",
            duration: "",
            courseAccountEmail: "",
            estimatedCost: "",
            thumbnailFile: "",
        }));

    };

    // ── Thumbnail drag & drop ──────────────────────────
    const handleThumbnailDrop = (e) => {
        e.preventDefault();
        setThumbnailDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            setThumbnailFile(file);
            if (errors.thumbnailFile) {
                setErrors((prev) => ({ ...prev, thumbnailFile: "" }));
            }
        }
    };

    const detectFileType = (file) => {
        if (!file || !file.name) return "PDF";
        const ext = file.name.split(".").pop().toLowerCase();
        const map = {
            pdf: "PDF",
            doc: "DOC",
            docx: "DOC",
            ppt: "PPT",
            pptx: "PPT",
            xls: "XLS",
            xlsx: "XLS",
            epub: "EPUB",
            mobi: "MOBI",
            mp4: "VIDEO",
            zip: "ZIP",
            txt: "TEXT",
        };
        return map[ext] || ext.toUpperCase();
    };

    // ── Material file drag & drop ──────────────────────
    const handleMaterialDrop = (e) => {
        e.preventDefault();
        setMaterialDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            setMaterialFile(file);
            if (errors.materialFile) {
                setErrors((prev) => ({ ...prev, materialFile: "" }));
            }
        }
    };

    // ── Submit handlers ────────────────────────────────
    const handleAddCourse = async (e) => {
        e.preventDefault();

        const effectiveProvider = (isOtherProvider ? otherProviderText.trim() : provider.trim()).slice(0, 30);
        const effectiveCategory = (isOtherCategory ? otherCategoryText.trim() : category.trim()).slice(0, 20);

        const newErrors = {};
        if (!courseUrl.trim()) newErrors.courseUrl = "This field is required";
        if (!courseTitle.trim()) newErrors.courseTitle = "This field is required";
        if (isOtherProvider) {
            const provErr = validateCustomMetadataEntry(otherProviderText, providerNames, "provider");
            if (provErr) newErrors.provider = provErr;
        } else if (!effectiveProvider) {
            newErrors.provider = "This field is required";
        }
        if (isOtherCategory) {
            const catErr = validateCustomMetadataEntry(otherCategoryText, categoryNames, "category");
            if (catErr) newErrors.category = catErr;
        } else if (!effectiveCategory) {
            newErrors.category = "This field is required";
        }
        setSubmitError("");
        const hNum = parseInt(durationHours, 10) || 0;
        const mNum = parseInt(durationMinutes, 10) || 0;
        if (hNum <= 0 && mNum <= 0) {
            newErrors.duration = "This field is required";
        }
        if (!courseAccountEmail.trim()) newErrors.courseAccountEmail = "This field is required";
        if (!String(estimatedCost).trim()) newErrors.estimatedCost = "This field is required";
        // Note: thumbnailFile / Supported Document is optional for online video courses

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setTimeout(() => {
                const firstErr = document.querySelector(".ld-cm-amm-form .has-error, .ld-cm-amm-error-text");
                if (firstErr) {
                    firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 50);
            return;
        }
        setErrors({});

        try {
            await runWithLock(async (idemKey) => {
                const costVal = parseInt(String(estimatedCost).replace(/[^\d]/g, ""), 10) || 0;
                const hNum = parseInt(durationHours, 10) || 0;
                const mNum = parseInt(durationMinutes, 10) || 0;
                const totalDurationMinutes = hNum * 60 + mNum;
                const effectiveDuration = totalDurationMinutes > 0 ? `${totalDurationMinutes}m` : formatDuration(durationHours, durationMinutes);
                const docName = thumbnailFile ? thumbnailFile.name : null;
                const courseReqId = initialCourse?.new_course_id || (typeof initialCourse?.id === "number" ? initialCourse.id : null);
                const activeLdId = user?.employee_id || 1;

                const resolvedMeta = await resolveAndPersistFormMetadata({
                    provider: isOtherProvider ? otherProviderText.trim() : provider.trim(),
                    isCustomProvider: isOtherProvider,
                    category: isOtherCategory ? otherCategoryText.trim() : category.trim(),
                    isCustomCategory: isOtherCategory,
                });
                const finalCourseProvider = (resolvedMeta.provider || effectiveProvider).slice(0, 30);
                const finalCourseCategory = (resolvedMeta.category || effectiveCategory).slice(0, 20);

                const matchedEmailObj = (emails || []).find(
                    (e) => (e.email || e.course_email || e.name || "").toLowerCase() === courseAccountEmail.trim().toLowerCase()
                );
                const resolvedEmailId = matchedEmailObj?.id || matchedEmailObj?.CourseEmailId || null;

                const payload = {
                    ld_id: activeLdId,
                    course_url: courseUrl.trim().slice(0, 255),
                    course_title: courseTitle.trim().slice(0, 100),
                    provider_id: resolvedMeta.provider_id || null,
                    provider_name: finalCourseProvider,
                    category_id: resolvedMeta.category_id || null,
                    category_name: finalCourseCategory,
                    course_email_id: resolvedEmailId,
                    course_account_email: courseAccountEmail.trim(),
                    duration: effectiveDuration || null,
                    duration_minutes: totalDurationMinutes,
                    price: costVal,
                    description: normalizeSingleSpacing(description, { trimEdges: true }).slice(0, maxDescChars) || null,
                    supported_document: docName,
                    is_active: true,
                    hr_status: "Pending",
                    request_id: courseReqId,
                    created_by: (user?.employee_id || "EMP006").slice(0, 7),
                };

                const res = await axios.post(`${API_BASE_URL}/api/courses`, payload, {
                    headers: { "X-Idempotency-Key": idemKey },
                });
                const savedCourse = res.data;
                setLastAddedCourse(savedCourse);

                // If this purchase originated from an approved course request, advance workflow to 'Purchased'
                if (courseReqId) {
                    try {
                        const ldAdminId = user?.employee_id || "EMP006";
                        await axios.put(`${API_BASE_URL}/api/course-requests/${courseReqId}/purchase?admin_id=${ldAdminId}`);
                    } catch (purchaseErr) {
                        console.warn("Failed to mark course request as purchased:", purchaseErr);
                    }
                }

                if (onAdded) {
                    onAdded({
                        type: "video",
                        new_course_id: courseReqId,
                        courseId: savedCourse.id,
                        claimId: savedCourse.claim_id,
                        claim_id: savedCourse.claim_id,
                        courseCode: savedCourse.course_code,
                        courseTitle: savedCourse.course_title || courseTitle,
                        provider: savedCourse.provider_name || finalCourseProvider,
                        category: savedCourse.category_name || finalCourseCategory,
                        duration: savedCourse.duration || effectiveDuration,
                        courseAccountEmail: savedCourse.course_account_email || courseAccountEmail,
                        estimatedCost: savedCourse.price != null ? savedCourse.price : costVal,
                        estimated_cost: savedCourse.price != null ? savedCourse.price : costVal,
                        price: estimatedCost ? (estimatedCost.startsWith("₹") ? estimatedCost : `₹${estimatedCost}`) : `₹${costVal}`,
                        rawPrice: costVal,
                        description: savedCourse.description || description,
                        supported_document: docName,
                        supportedDocument: docName,
                        thumbnail: docName,
                    });
                }
                setSuccessType("course");
            });
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Error creating course in database:", err);
            setSubmitError(
                extractApiErrorMessage(err, "Failed to add course to catalogue. Please check the inputs.")
            );
        }
    };

    const handleAddMaterial = async (e) => {
        e.preventDefault();

        const effectiveCategoryType = isOtherMaterialType ? otherMaterialTypeText.trim() : matType.trim();
        const detectedFormat = detectFileType(materialFile);

        const newErrors = {};
        if (!materialFile) newErrors.materialFile = "This field is required";
        if (!matTitle.trim()) newErrors.matTitle = "This field is required";
        if (isOtherMaterialType) {
            const matCatErr = validateCustomMetadataEntry(otherMaterialTypeText, categoryNames, "category");
            if (matCatErr) newErrors.matType = matCatErr;
        } else if (!effectiveCategoryType) {
            newErrors.matType = "This field is required";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

        try {
            await runWithLock(async (idemKey) => {
                const ldEmpId = user?.employee_id || user?.empId || localStorage.getItem("lms_active_employee_id") || "EMP008";
                const filePath = materialFile ? `materials/${materialFile.name}` : "materials/document.pdf";
                const authToken = localStorage.getItem("lms_token");
                const resolvedMeta = await resolveAndPersistFormMetadata({
                    category: effectiveCategoryType,
                    isCustomCategory: isOtherMaterialType,
                    explicitToken: authToken,
                });
                const payload = {
                    title: matTitle.trim().slice(0, 100),
                    category_type: resolvedMeta.category || effectiveCategoryType,
                    file_type: detectedFormat,
                    description: normalizeSingleSpacing(matDesc, { trimEdges: true }).slice(0, maxMatDescChars) || null,
                    file_path: filePath,
                    created_by: ldEmpId,
                    is_active: true,
                };
                const headers = {
                    "X-Employee-Id": ldEmpId,
                    "X-Idempotency-Key": idemKey,
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                };

                const res = await axios.post(`${API_BASE_URL}/api/study-materials`, payload, { headers });
                const savedMat = res.data;

                if (onAdded) {
                    onAdded({
                        type: "material",
                        materialId: savedMat.id,
                        materialCode: savedMat.material_code,
                        title: savedMat.title || matTitle,
                        matType: savedMat.file_type || detectedFormat,
                        matDesc: savedMat.description || matDesc,
                        file: materialFile?.name,
                    });
                }
                setSuccessType("material");
            });
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Error creating study material in database:", err);
            setSubmitError(
                extractApiErrorMessage(err, "Failed to add study material to database.")
            );
        }
    };

    // ── Success Screen ─────────────────────────────────
    if (successType) {
        return (
            <div className="ld-cm-modal-overlay">
                <div
                    className="ld-cm-modal-card"
                    style={{
                        maxWidth: 400,
                        width: "90%",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "36px 28px 28px 28px",
                        textAlign: "center",
                        borderRadius: 14,
                        position: "relative",
                        background: "#FFFFFF",
                        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.16)",
                        gap: 0,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        className="ld-cm-modal-close-btn"
                        onClick={handleClose}
                        aria-label="Close"
                        style={{ top: 16, right: 16 }}
                    >
                        <X size={18} color="#4B5563" />
                    </button>
                    <img
                        src={successfulIcon}
                        alt="success"
                        style={{ width: 52, height: 52, marginBottom: 16 }}
                    />
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 20,
                            fontWeight: 600,
                            color: "#111827",
                            lineHeight: 1.3,
                            textAlign: "center",
                        }}
                    >
                        {successType === "course" ? (
                            <>
                                Course Added
                                <br />
                                Successfully!
                            </>
                        ) : (
                            <>
                                Study Material Added
                                <br />
                                Successfully!
                            </>
                        )}
                    </h2>


                </div>
            </div>
        );
    }

    // ── Build option lists from live DB metadata with "Others" ────────────────
    const baseProviderList = (providerNames || []).filter(
        (p) => p && p.toLowerCase() !== "other" && p.toLowerCase() !== "others"
    );
    const providerOptions = Array.from(new Set([...baseProviderList, "Others"]));

    const baseCategoryList = (categoryNames || []).filter(
        (c) => c && c.toLowerCase() !== "other" && c.toLowerCase() !== "others"
    );
    const categoryOptions = Array.from(new Set([...baseCategoryList, "Others"]));

    const baseMaterialTypes = MATERIAL_TYPES.filter(
        (t) => t && t.toLowerCase() !== "other" && t.toLowerCase() !== "others"
    );
    const materialTypeOptions = Array.from(new Set([...baseMaterialTypes, "Others"]));
    const categoryTypeOptions = categoryOptions;

    // ── Main Fixed Modal ─────────────────────────────────────
    return (
        <div className="ld-cm-modal-overlay">
            <div
                className="ld-cm-modal-card ld-cm-add-material-modal"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Header (Title + Subtitle + Close Button) */}
                <div className="ld-cm-amm-header">
                    <button
                        type="button"
                        className="ld-cm-modal-close-btn"
                        onClick={handleClose}
                        aria-label="Close modal"
                        style={{ top: 0, right: 0 }}
                    >
                        <X size={18} />
                    </button>
                    <h2 className="ld-cm-amm-title">
                        Add Course / Study Material
                    </h2>
                    <p className="ld-cm-amm-subtitle">
                        Add video courses or upload study materials to the catalogue.
                    </p>

                    {/* 2. Horizontal Tabs */}
                    <div className="ld-cm-amm-tabs">
                        <button
                            type="button"
                            className={`ld-cm-amm-tab-btn ${activeTab === "video" ? "active" : "inactive"}`}
                            onClick={() => { setActiveTab("video"); setErrors({}); }}
                        >
                            Emergere Library
                        </button>
                        <button
                            type="button"
                            className={`ld-cm-amm-tab-btn ${activeTab === "material" ? "active" : "inactive"}`}
                            onClick={() => { setActiveTab("material"); setErrors({}); }}
                        >
                            Study Material
                        </button>
                    </div>
                </div>

                {/* 3. Tab Content (Fixed without Scrolling) */}
                {activeTab === "video" ? (
                    <form
                        id="video-course-form"
                        onSubmit={handleAddCourse}
                        className="ld-cm-amm-form"
                        noValidate
                    >
                        {/* Row 1: Course URL * */}
                        <div className="ld-cm-amm-field">
                            <label className="ld-cm-amm-label">
                                Course URL <span className="req">*</span>
                            </label>
                            <input
                                type="url"
                                className={`ld-cm-amm-input ${errors.courseUrl ? "has-error" : ""}`}
                                placeholder="http://www.udemy.com/course/xxxxxx"
                                maxLength={255}
                                value={courseUrl}
                                onChange={(e) => {
                                    setCourseUrl(e.target.value);
                                    if (errors.courseUrl) setErrors((prev) => ({ ...prev, courseUrl: "" }));
                                }}
                            />
                            {errors.courseUrl && <span className="ld-cm-amm-error-text">{errors.courseUrl}</span>}
                        </div>

                        {/* Row 2: Course Title * + Provider * */}
                        <div className="ld-cm-amm-grid-2col">
                            <div className="ld-cm-amm-field">
                                <label className="ld-cm-amm-label">
                                    Course Title <span className="req">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`ld-cm-amm-input ${errors.courseTitle ? "has-error" : ""}`}
                                    placeholder="Enter course title"
                                    maxLength={100}
                                    value={courseTitle}
                                    disabled={isTitleDisabled}
                                    onChange={(e) => {
                                        setCourseTitle(sanitizeSingleSpaceInput(e.target.value));
                                        if (errors.courseTitle) setErrors((prev) => ({ ...prev, courseTitle: "" }));
                                    }}
                                    onBlur={() => setCourseTitle((prev) => (prev || "").trim())}
                                />
                                {errors.courseTitle && <span className="ld-cm-amm-error-text">{errors.courseTitle}</span>}
                            </div>
                            <div className="ld-cm-amm-field">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <label className="ld-cm-amm-label">
                                        Provider <span className="req">*</span>
                                    </label>
                                    {!isProviderDisabled && isOtherProvider && (
                                        <button
                                            type="button"
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "#215EF8",
                                                fontSize: 11.5,
                                                fontWeight: 500,
                                                cursor: "pointer",
                                                padding: 0
                                            }}
                                            onClick={handleResetProvider}
                                        >
                                            ← Back to presets
                                        </button>
                                    )}
                                </div>
                                {!isOtherProvider ? (
                                    <CourseModalDropdown
                                        value={provider}
                                        options={providerOptions}
                                        disabled={isProviderDisabled}
                                        onChange={(val) => {
                                            if (val === "Others") {
                                                setIsOtherProvider(true);
                                                setOtherProviderText("");
                                                setProvider("");
                                            } else {
                                                setProvider(val);
                                                setIsOtherProvider(false);
                                            }
                                            if (errors.provider) setErrors((prev) => ({ ...prev, provider: "" }));
                                        }}
                                        placeholder="Select Provider"
                                        required
                                        hasError={!!errors.provider}
                                    />
                                ) : (
                                    <input
                                        ref={otherProviderInputRef}
                                        type="text"
                                        className={`ld-cm-amm-input ${errors.provider ? "has-error" : ""}`}
                                        placeholder="Enter custom provider name"
                                        maxLength={30}
                                        value={otherProviderText}
                                        disabled={isProviderDisabled}
                                        onChange={(e) => {
                                            const val = sanitizeSingleSpaceInput(e.target.value);
                                            setOtherProviderText(val);
                                            const dupErr = val.trim() ? validateCustomMetadataEntry(val, providerNames, "provider") : "";
                                            setErrors((prev) => ({ ...prev, provider: dupErr }));
                                        }}
                                        onBlur={() => setOtherProviderText((prev) => (prev || "").trim())}
                                    />
                                )}
                                {errors.provider && <span className="ld-cm-amm-error-text">{errors.provider}</span>}
                            </div>
                        </div>

                        {/* Row 3: Course Category * + Duration */}
                        <div className="ld-cm-amm-grid-2col">
                            <div className="ld-cm-amm-field">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <label className="ld-cm-amm-label">
                                        Course Category <span className="req">*</span>
                                    </label>
                                    {!isCategoryDisabled && isOtherCategory && (
                                        <button
                                            type="button"
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "#215EF8",
                                                fontSize: 11.5,
                                                fontWeight: 500,
                                                cursor: "pointer",
                                                padding: 0
                                            }}
                                            onClick={handleResetCategory}
                                        >
                                            ← Back to presets
                                        </button>
                                    )}
                                </div>
                                {!isOtherCategory ? (
                                    <CourseModalDropdown
                                        value={category}
                                        options={categoryOptions}
                                        disabled={isCategoryDisabled}
                                        onChange={(val) => {
                                            if (val === "Others") {
                                                setIsOtherCategory(true);
                                                setOtherCategoryText("");
                                                setCategory("");
                                            } else {
                                                setCategory(val);
                                                setIsOtherCategory(false);
                                            }
                                            if (errors.category) setErrors((prev) => ({ ...prev, category: "" }));
                                        }}
                                        placeholder="Select Course Category"
                                        required
                                        hasError={!!errors.category}
                                    />
                                ) : (
                                    <input
                                        ref={otherCategoryInputRef}
                                        type="text"
                                        className={`ld-cm-amm-input ${errors.category ? "has-error" : ""}`}
                                        placeholder="Enter custom category name"
                                        maxLength={20}
                                        value={otherCategoryText}
                                        disabled={isCategoryDisabled}
                                        onChange={(e) => {
                                            const val = sanitizeSingleSpaceInput(e.target.value);
                                            setOtherCategoryText(val);
                                            const dupErr = val.trim() ? validateCustomMetadataEntry(val, categoryNames, "category") : "";
                                            setErrors((prev) => ({ ...prev, category: dupErr }));
                                        }}
                                        onBlur={() => setOtherCategoryText((prev) => (prev || "").trim())}
                                    />
                                )}
                                {errors.category && <span className="ld-cm-amm-error-text">{errors.category}</span>}
                            </div>
                            <div className="ld-cm-amm-field">
                                <label className="ld-cm-amm-label">Duration <span className="req">*</span></label>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div className={`ld-cm-amm-duration-box ${errors.duration ? "has-error" : ""}`}>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="ld-cm-amm-duration-input"
                                            placeholder="0"
                                            value={durationHours}
                                            onChange={handleDurationHoursChange}
                                            maxLength="3"
                                        />
                                        <span className="ld-cm-amm-duration-suffix">hr</span>
                                    </div>
                                    <div className={`ld-cm-amm-duration-box ${errors.duration ? "has-error" : ""}`}>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="ld-cm-amm-duration-input"
                                            placeholder="0"
                                            value={durationMinutes}
                                            onChange={handleDurationMinutesChange}
                                        />
                                        <span className="ld-cm-amm-duration-suffix">min</span>
                                    </div>
                                </div>
                                {errors.duration && <span className="ld-cm-amm-error-text">{errors.duration}</span>}
                            </div>
                        </div>

                        {/* Row 4: Course Account Email * + Estimated Cost (INR) * */}
                        <div className="ld-cm-amm-grid-2col">
                            <div className="ld-cm-amm-field">
                                <label className="ld-cm-amm-label">
                                    Course Account Email <span className="req">*</span>
                                </label>
                                <CourseModalDropdown
                                    value={courseAccountEmail}
                                    options={
                                        courseAccountEmail && !(emailNames || []).includes(courseAccountEmail)
                                            ? [...(emailNames || []), courseAccountEmail]
                                            : (emailNames || [])
                                    }
                                    onChange={(val) => {
                                        setCourseAccountEmail(val);
                                        if (errors.courseAccountEmail) setErrors((prev) => ({ ...prev, courseAccountEmail: "" }));
                                    }}
                                    placeholder="Select Course Account Email"
                                    required
                                    hasError={!!errors.courseAccountEmail}
                                />
                                {errors.courseAccountEmail && <span className="ld-cm-amm-error-text">{errors.courseAccountEmail}</span>}
                            </div>
                            <div className="ld-cm-amm-field">
                                <label className="ld-cm-amm-label">
                                    Estimated Cost (INR) <span className="req">*</span>
                                </label>
                                <div className={`ld-cm-amm-cost-wrapper ${errors.estimatedCost ? "has-error" : ""}`}>
                                    <span className="ld-cm-amm-cost-prefix">₹</span>
                                    <input
                                        type="text"
                                        className="ld-cm-amm-cost-input"
                                        placeholder="0"
                                        value={estimatedCost}
                                        onChange={handleCostChange}
                                        maxLength={5}
                                    />
                                </div>
                                {errors.estimatedCost && <span className="ld-cm-amm-error-text">{errors.estimatedCost}</span>}
                            </div>
                        </div>

                        {/* Row 5: Description */}
                        <div className="ld-cm-amm-field">
                            <label className="ld-cm-amm-label">Description</label>
                            <div className="ld-cm-amm-textarea-wrap">
                                <textarea
                                    className="ld-cm-amm-textarea ld-cm-amm-textarea-course"
                                    placeholder="Course description will appear here..."
                                    maxLength={maxDescChars}
                                    value={description}
                                    onKeyDown={handleSingleSpaceKeyDown}
                                    onChange={(e) => setDescription(applySingleSpaceTextChange(e, maxDescChars))}
                                    onPaste={(e) => handleSingleSpacePaste(e, maxDescChars, setDescription)}
                                    onBlur={() => {
                                        const cleaned = normalizeSingleSpacing(description, { trimEdges: true }).slice(0, maxDescChars);
                                        if (cleaned !== description) setDescription(cleaned);
                                    }}
                                />
                                <span className="ld-cm-amm-counter">{description.length}/{maxDescChars}</span>
                            </div>
                        </div>

                        {/* Row 6: Supported Document */}
                        <div className="ld-cm-amm-field">
                            <label className="ld-cm-amm-label">Supported Document <span style={{ color: "#7f7f7f", fontSize: "12px", fontWeight: 400 }}>(Optional)</span></label>
                            <div
                                className={`ld-cm-amm-dropzone ${errors.thumbnailFile ? "has-error" : ""}`}
                                onDragOver={(e) => { e.preventDefault(); setThumbnailDragOver(true); }}
                                onDragLeave={() => setThumbnailDragOver(false)}
                                onDrop={handleThumbnailDrop}
                                onClick={() => thumbnailInputRef.current?.click()}
                            >
                                <img src={dragDropIcon} alt="upload" style={{ width: 18, height: 15 }} />
                                {thumbnailFile ? (
                                    <span style={{ fontSize: 11.5, color: "#10B981", fontWeight: 500 }}>
                                        {thumbnailFile.name}
                                    </span>
                                ) : (
                                    <span className="ld-cm-amm-dropzone-text">
                                        Drag and drop files here or <span className="ld-cm-amm-browse">Browse Files</span>
                                    </span>
                                )}
                            </div>
                            <input
                                ref={thumbnailInputRef}
                                type="file"
                                accept="image/*,.pdf,.doc,.docx"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    const file = e.target.files[0] || null;
                                    setThumbnailFile(file);
                                    if (file && errors.thumbnailFile) {
                                        setErrors((prev) => ({ ...prev, thumbnailFile: "" }));
                                    }
                                }}
                            />
                            {errors.thumbnailFile && <span className="ld-cm-amm-error-text">{errors.thumbnailFile}</span>}
                        </div>
                    </form>
                ) : (
                    <form
                        id="study-material-form"
                        onSubmit={handleAddMaterial}
                        className="ld-cm-amm-form"
                        style={{ gap: 10 }}
                        noValidate
                    >
                        {/* Title * (Full Width) */}
                        <div className="ld-cm-amm-field">
                            <label className="ld-cm-amm-label">
                                Title <span className="req">*</span>
                            </label>
                            <input
                                type="text"
                                className={`ld-cm-amm-input ${errors.matTitle ? "has-error" : ""}`}
                                placeholder="Enter material title"
                                maxLength={100}
                                value={matTitle}
                                onChange={(e) => {
                                    setMatTitle(e.target.value);
                                    if (errors.matTitle) setErrors((prev) => ({ ...prev, matTitle: "" }));
                                }}
                            />
                            {errors.matTitle && <span className="ld-cm-amm-error-text">{errors.matTitle}</span>}
                        </div>

                        {/* Category Type * (Full Width) */}
                        <div className="ld-cm-amm-field">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <label className="ld-cm-amm-label">
                                    Category Type <span className="req">*</span>
                                </label>
                                {isOtherMaterialType && (
                                    <button
                                        type="button"
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#215EF8",
                                            fontSize: 11.5,
                                            fontWeight: 500,
                                            cursor: "pointer",
                                            padding: 0
                                        }}
                                        onClick={handleResetMaterialType}
                                    >
                                        ← Back to presets
                                    </button>
                                )}
                            </div>
                            {!isOtherMaterialType ? (
                                <CourseModalDropdown
                                    value={matType}
                                    options={categoryTypeOptions}
                                    onChange={(val) => {
                                        if (val === "Others" || val === "Other") {
                                            setIsOtherMaterialType(true);
                                            setOtherMaterialTypeText("");
                                            setMatType("");
                                        } else {
                                            setMatType(val);
                                            setIsOtherMaterialType(false);
                                        }
                                        if (errors.matType) setErrors((prev) => ({ ...prev, matType: "" }));
                                    }}
                                    placeholder="Select Category Type"
                                    required
                                    hasError={!!errors.matType}
                                />
                            ) : (
                                <input
                                    ref={otherMaterialTypeInputRef}
                                    type="text"
                                    className={`ld-cm-amm-input ${errors.matType ? "has-error" : ""}`}
                                    placeholder="Enter custom category name"
                                    value={otherMaterialTypeText}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setOtherMaterialTypeText(val);
                                        const dupErr = val.trim() ? validateCustomMetadataEntry(val, categoryNames, "category") : "";
                                        setErrors((prev) => ({ ...prev, matType: dupErr }));
                                    }}
                                />
                            )}
                            {errors.matType && <span className="ld-cm-amm-error-text">{errors.matType}</span>}
                        </div>

                        {/* Description (Full Width) */}
                        <div className="ld-cm-amm-field">
                            <label className="ld-cm-amm-label">Description</label>
                            <div className="ld-cm-amm-textarea-wrap">
                                <textarea
                                    className="ld-cm-amm-textarea ld-cm-amm-textarea-material"
                                    placeholder="Enter description about this material"
                                    maxLength={maxMatDescChars}
                                    value={matDesc}
                                    onKeyDown={handleSingleSpaceKeyDown}
                                    onChange={(e) => setMatDesc(applySingleSpaceTextChange(e, maxMatDescChars))}
                                    onPaste={(e) => handleSingleSpacePaste(e, maxMatDescChars, setMatDesc)}
                                    onBlur={() => {
                                        const cleaned = normalizeSingleSpacing(matDesc, { trimEdges: true }).slice(0, maxMatDescChars);
                                        if (cleaned !== matDesc) setMatDesc(cleaned);
                                    }}
                                />
                                <span className="ld-cm-amm-counter">{matDesc.length}/{maxMatDescChars}</span>
                            </div>
                        </div>

                        {/* Upload File * */}
                        <div className="ld-cm-amm-field">
                            <label className="ld-cm-amm-label">
                                Upload File <span className="req">*</span>
                            </label>
                            <div
                                className={`ld-cm-amm-dropzone ${errors.materialFile ? "has-error" : ""}`}
                                style={{ height: 48 }}
                                onDragOver={(e) => { e.preventDefault(); setMaterialDragOver(true); }}
                                onDragLeave={() => setMaterialDragOver(false)}
                                onDrop={handleMaterialDrop}
                                onClick={() => materialInputRef.current?.click()}
                            >
                                <img src={dragDropIcon} alt="upload" style={{ width: 22, height: 18 }} />
                                {materialFile ? (
                                    <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>
                                        {materialFile.name}
                                    </span>
                                ) : (
                                    <span className="ld-cm-amm-dropzone-text">
                                        Drag and drop files here or <span className="ld-cm-amm-browse">Browse Files</span>
                                    </span>
                                )}
                            </div>
                            <input
                                ref={materialInputRef}
                                type="file"
                                accept=".pdf,.ppt,.pptx,.epub,.mobi"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    const file = e.target.files[0] || null;
                                    setMaterialFile(file);
                                    if (file && errors.materialFile) {
                                        setErrors((prev) => ({ ...prev, materialFile: "" }));
                                    }
                                }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 4 }}>
                                <span style={{ fontSize: 12, color: "#7f7f7f" }}>Max file size: 50MB</span>
                                <span style={{ fontSize: 12, color: "#7f7f7f" }}>Supported formats: PDF, PPT, PPTX, EPUB, MOBI</span>
                            </div>
                            {errors.materialFile && <span className="ld-cm-amm-error-text">{errors.materialFile}</span>}
                        </div>
                    </form>
                )}

                {/* 4. Footer Buttons */}
                <div className="ld-cm-amm-footer">
                    <button
                        type="button"
                        className="ld-cm-amm-cancel-btn"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="ld-cm-amm-submit-btn"
                        form={activeTab === "video" ? "video-course-form" : "study-material-form"}
                        disabled={isSubmitting}
                        style={isSubmitting ? { opacity: 0.7, cursor: "not-allowed" } : {}}
                    >
                        {isSubmitting ? "Adding..." : "Add to Catalogue"}
                    </button>
                </div>
            </div>
        </div>
    );
}
