import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Search, Check, X } from "lucide-react";
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
import { capitalizeFirstLetter } from "../../../utils/validationUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function NewReimbursementClaimModal({ isOpen, onClose, onSubmitClaim, activeEmpId, existingClaims = [] }) {
    const [formData, setFormData] = useState({
        certificationName: "",
        provider: "",
        amount: "",
        dateOfPurchase: "",
        dateOfCompletion: "",
        validityFrom: "",
        validityTo: "",
        file: null,
    });

    const { providers: liveProviders } = useCourseMetadata(undefined, isOpen);
    const dbProviders = liveProviders.filter((p) => p.name?.toLowerCase() !== "other");
    const [isOtherProvider, setIsOtherProvider] = useState(false);
    const [otherProviderText, setOtherProviderText] = useState("");

    // Requested Certifications Dropdown States
    const [requests, setRequests] = useState([]);
    const [claims, setClaims] = useState([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [isOtherCert, setIsOtherCert] = useState(false);
    const [customCertName, setCustomCertName] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
    const submittingRef = useRef(false);
    const otherProviderInputRef = useRef(null);
    const customCertInputRef = useRef(null);
    const dropdownRef = useRef(null);
    const modalBodyRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Fetch employee certification requests and claims on open
    useEffect(() => {
        if (!isOpen) return;
        const empId = activeEmpId || localStorage.getItem("lms_active_employee_id") || "EMP019";
        const fetchEmpData = async () => {
            setIsLoadingRequests(true);
            try {
                const token = localStorage.getItem("lms_token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                const [requestsRes, claimsRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/certifications/requests?employee_id=${empId}`, { headers }).catch(() => ({ data: [] })),
                    axios.get(`${API_BASE_URL}/api/reimbursements/claims?employee_id=${empId}`, { headers }).catch(() => ({ data: [] }))
                ]);

                const reqData = Array.isArray(requestsRes.data) ? requestsRes.data : [];
                const claimData = Array.isArray(claimsRes.data) ? claimsRes.data : [];
                setRequests(reqData);
                setClaims(claimData);
            } catch (err) {
                console.warn("[NewReimbursementClaimModal] Failed to fetch data:", err);
                setRequests([]);
                setClaims([]);
            } finally {
                setIsLoadingRequests(false);
            }
        };
        fetchEmpData();
    }, [isOpen, activeEmpId]);

    // Auto-focus "Other" custom cert input
    useEffect(() => {
        if (isOtherCert && customCertInputRef.current) {
            customCertInputRef.current.focus();
        }
    }, [isOtherCert]);

    // Auto-focus "Other" provider input
    useEffect(() => {
        if (isOtherProvider && otherProviderInputRef.current) {
            otherProviderInputRef.current.focus();
        }
    }, [isOtherProvider]);

    // Set of certification names that already have active (Pending or Approved) reimbursement claims
    // Certifications with Rejected claims are NOT blocked, so employees can re-apply.
    const activeClaimedCertNames = useMemo(() => {
        const claimsList = claims.length > 0 ? claims : (existingClaims || []);
        const blocked = new Set();
        for (const cl of claimsList) {
            const rawStatus = String(cl.status || cl.claim_status || "").trim().toLowerCase();
            if (rawStatus === "pending" || rawStatus === "approved") {
                const nameKey = String(cl.certification_name || cl.certificateTitle || "").trim().toLowerCase();
                if (nameKey) {
                    blocked.add(nameKey);
                }
            }
        }
        return blocked;
    }, [claims, existingClaims]);

    // Only show Approved certification requests from dbo.lms_certification_requests
    // Excludes any with an active Pending or Approved reimbursement claim
    const approvedRequests = useMemo(() => {
        const approved = requests.filter(
            (r) => String(r.status || "").trim().toLowerCase() === "approved"
        );
        const seen = new Set();
        const unique = [];
        for (const r of approved) {
            const key = (r.certification_name || "").trim().toLowerCase();
            if (key && !seen.has(key) && !activeClaimedCertNames.has(key)) {
                seen.add(key);
                unique.push(r);
            }
        }
        return unique;
    }, [requests, activeClaimedCertNames]);

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

    // Dynamically check whether scrolling is needed, removing scroll icons if not scrolling
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
    }, [isOpen, formData, errors, isDropdownOpen, isOtherCert, isOtherProvider]);

    if (!isOpen) return null;

    // Validation functions
    const validateCertificationName = (val, isOther, otherText) => {
        const textToValidate = isOther ? otherText : val;
        const trimmed = (textToValidate || "").trim();
        if (!trimmed) {
            return isOther ? "Please enter the Certification Name." : "Please select or enter a Certification Name.";
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
        // Gating check: Cannot claim for a certification that has an unapproved/pending request
        if (isOther && Array.isArray(requests)) {
            const unapprovedReq = requests.find(
                (r) =>
                    String(r.certification_name || "").trim().toLowerCase() === trimmed.toLowerCase() &&
                    String(r.status || "").trim().toLowerCase() !== "approved"
            );
            if (unapprovedReq) {
                const reqStatus = unapprovedReq.status || "Pending";
                return `Certification request is currently ${reqStatus}. Reimbursement can only be claimed after approval.`;
            }
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

    const validateAmount = (val) => {
        if (val === "" || val === null || val === undefined || (typeof val === "string" && !val.trim())) {
            return "Amount is required.";
        }
        const strVal = String(val).trim();
        if (!/^\d+$/.test(strVal) || strVal.includes(".")) {
            return "Amount must be a whole number (no decimals allowed).";
        }
        const num = parseInt(strVal, 10);
        if (isNaN(num) || num < 1) {
            return "Amount must be at least ₹1.";
        }
        if (num > 100000) {
            return "Amount cannot exceed ₹1,00,000.";
        }
        return "";
    };

    const validateDateOfPurchase = (val) => {
        if (!val) {
            return "Date of Purchase is required.";
        }
        const parts = val.split("-");
        const year = parts[0];
        if (year.length !== 4 || isNaN(year) || parseInt(year, 10) < 1900 || parseInt(year, 10) > 2099) {
            return "Year must be a valid 4-digit year.";
        }
        if (val > todayStr) {
            return "Date of Purchase cannot be in the future.";
        }
        return "";
    };

    const validateDateOfCompletion = (comp, purch) => {
        if (!comp) {
            return "Date of Completion / Exam is required.";
        }
        const parts = comp.split("-");
        const year = parts[0];
        if (year.length !== 4 || isNaN(year) || parseInt(year, 10) < 1900 || parseInt(year, 10) > 2099) {
            return "Year must be a valid 4-digit year.";
        }
        if (purch && comp < purch) {
            return "Date of Completion cannot be earlier than Date of Purchase.";
        }
        return "";
    };

    const validateValidityFrom = (from) => {
        if (!from) return "";
        const parts = from.split("-");
        const year = parts[0];
        if (year.length !== 4 || isNaN(year) || parseInt(year, 10) < 2010 || parseInt(year, 10) > 2099) {
            return "Year must be a valid 4-digit year (between 2010 and 2099).";
        }
        return "";
    };

    const validateValidityDates = (from, to) => {
        if (to) {
            const parts = to.split("-");
            const year = parts[0];
            if (year.length !== 4 || isNaN(year) || parseInt(year, 10) < 2010 || parseInt(year, 10) > 2099) {
                return "Year must be a valid 4-digit year (between 2010 and 2099).";
            }
        }
        if (from && to && to <= from) {
            return "Validity To date must be later than Validity From date.";
        }
        return "";
    };

    const validateFile = (file) => {
        if (!file) {
            return "Supporting document is required.";
        }
        return "";
    };

    // Change handlers
    const handleCertificationSelect = (valueOrEvent) => {
        const selectedValue = typeof valueOrEvent === "string" ? valueOrEvent : valueOrEvent?.target?.value;
        setIsDropdownOpen(false);
        if (selectedValue === "Other") {
            setIsOtherCert(true);
            setCustomCertName("");
            setFormData((prev) => ({ ...prev, certificationName: "" }));
            if (touched.certificationName) {
                setErrors((prev) => ({ ...prev, certificationName: "Please enter the Certification Name." }));
            }
            return;
        }

        // Find the selected request
        const req = requests.find((r) => r.certification_name === selectedValue);
        const certName = req ? req.certification_name : selectedValue;

        setFormData((prev) => {
            const updated = {
                ...prev,
                certificationName: certName,
            };

            // Auto-fill provider if available
            if (req) {
                const rawProv = req.provider_name;
                if (rawProv) {
                    const matched = dbProviders.find(
                        (p) => p.name.toLowerCase() === rawProv.toLowerCase() ||
                            (p.provider_name && p.provider_name.toLowerCase() === rawProv.toLowerCase())
                    );
                    if (matched) {
                        updated.provider = matched.provider_name || matched.name;
                        setIsOtherProvider(false);
                        setOtherProviderText("");
                    } else {
                        updated.provider = "Other";
                        setIsOtherProvider(true);
                        setOtherProviderText(rawProv);
                    }
                }

                // Pre-fill amount from estimated_cost_inr or amount
                const certAmount = req.estimated_cost_inr ?? req.estimated_cost ?? req.amount;
                if (certAmount !== undefined && certAmount !== null && certAmount !== "") {
                    updated.amount = String(parseInt(String(certAmount).replace(/[^0-9]/g, ""), 10) || certAmount);
                }

                // Pre-fill Date of Completion / Exam from stored scheduled_exam_date
                const compDate = req.scheduled_exam_date || req.completion_date || req.exam_date;
                if (compDate) {
                    const normalizedDate = String(compDate).slice(0, 10);
                    updated.dateOfCompletion = normalizedDate;
                }
            }

            return updated;
        });

        setErrors((prev) => ({
            ...prev,
            certificationName: "",
            ...(req?.provider_name ? { provider: "" } : {}),
            ...(req?.estimated_cost_inr ? { amount: "" } : {}),
            ...(req?.scheduled_exam_date ? { dateOfCompletion: "" } : {}),
        }));
    };

    const handleCustomCertChange = (e) => {
        const raw = e.target.value;
        const filtered = raw.replace(/[^a-zA-Z0-9\s\-&\.\/\+\(\),]/g, "").slice(0, 100);
        const capitalized = capitalizeFirstLetter(filtered);
        setCustomCertName(capitalized);
        setFormData((prev) => ({ ...prev, certificationName: capitalized }));
        if (touched.certificationName) {
            setErrors((prev) => ({ ...prev, certificationName: validateCertificationName(capitalized, true, capitalized) }));
        }
    };

    const handleResetCertification = () => {
        setIsOtherCert(false);
        setCustomCertName("");
        setIsDropdownOpen(false);
        setFormData((prev) => ({ ...prev, certificationName: "" }));
        setErrors((prev) => ({ ...prev, certificationName: "" }));
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

    const handleAmountChange = (e) => {
        const val = e.target.value;
        // Strictly allow only whole numbers (digits only, no decimal point, max 6 digits up to ₹1,00,000)
        if (val === "" || /^\d+$/.test(val)) {
            const truncated = val.slice(0, 6);
            setFormData((prev) => ({ ...prev, amount: truncated }));
            if (touched.amount || truncated) {
                setErrors((prev) => ({ ...prev, amount: validateAmount(truncated) }));
            }
        }
    };

    const handlePurchaseDateChange = (e) => {
        let val = e.target.value;
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setFormData((prev) => ({ ...prev, dateOfPurchase: val }));
        if (touched.dateOfPurchase) {
            setErrors((prev) => ({
                ...prev,
                dateOfPurchase: validateDateOfPurchase(val),
                dateOfCompletion: validateDateOfCompletion(formData.dateOfCompletion, val),
            }));
        }
    };

    const handleCompletionDateChange = (e) => {
        let val = e.target.value;
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setFormData((prev) => ({ ...prev, dateOfCompletion: val }));
        if (touched.dateOfCompletion || val) {
            setErrors((prev) => ({
                ...prev,
                dateOfCompletion: validateDateOfCompletion(val, formData.dateOfPurchase),
            }));
        }
    };

    const handleValidityFromChange = (e) => {
        let val = e.target.value;
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setFormData((prev) => ({ ...prev, validityFrom: val }));
        if (touched.validityFrom || val) {
            setErrors((prev) => ({
                ...prev,
                validityFrom: validateValidityFrom(val),
                validityTo: validateValidityDates(val, formData.validityTo),
            }));
        } else if (touched.validityTo || formData.validityTo) {
            setErrors((prev) => ({
                ...prev,
                validityTo: validateValidityDates(val, formData.validityTo),
            }));
        }
    };

    const handleValidityToChange = (e) => {
        let val = e.target.value;
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setFormData((prev) => ({ ...prev, validityTo: val }));
        if (touched.validityTo || val) {
            setErrors((prev) => ({
                ...prev,
                validityTo: validateValidityDates(formData.validityFrom, val),
            }));
        }
    };

    const handleBlur = (field) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        if (field === "certificationName") {
            setErrors((prev) => ({ ...prev, certificationName: validateCertificationName(formData.certificationName, isOtherCert, customCertName) }));
        } else if (field === "provider") {
            setErrors((prev) => ({
                ...prev,
                provider: validateProvider(formData.provider, isOtherProvider, otherProviderText),
            }));
        } else if (field === "amount") {
            setErrors((prev) => ({ ...prev, amount: validateAmount(formData.amount) }));
        } else if (field === "dateOfPurchase") {
            setErrors((prev) => ({ ...prev, dateOfPurchase: validateDateOfPurchase(formData.dateOfPurchase) }));
        } else if (field === "dateOfCompletion") {
            setErrors((prev) => ({ ...prev, dateOfCompletion: validateDateOfCompletion(formData.dateOfCompletion, formData.dateOfPurchase) }));
        } else if (field === "validityFrom") {
            setErrors((prev) => ({ ...prev, validityFrom: validateValidityFrom(formData.validityFrom) }));
        } else if (field === "validityTo") {
            setErrors((prev) => ({ ...prev, validityTo: validateValidityDates(formData.validityFrom, formData.validityTo) }));
        } else if (field === "file") {
            setErrors((prev) => ({ ...prev, file: validateFile(formData.file) }));
        }
    };

    const handleFileSelect = (file) => {
        if (!file) return;
        const ext = file.name.split(".").pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setErrors((prev) => ({ ...prev, file: "Only PDF, DOC, DOCX, JPG, and PNG files are allowed." }));
            setTouched((prev) => ({ ...prev, file: true }));
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setErrors((prev) => ({ ...prev, file: "File size cannot exceed 5MB." }));
            setTouched((prev) => ({ ...prev, file: true }));
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

    const handleClose = () => {
        if (submittingRef.current || isSubmitting) return;
        setIsDropdownOpen(false);
        setIsOtherCert(false);
        setCustomCertName("");
        setIsOtherProvider(false);
        setOtherProviderText("");
        setErrors({});
        setTouched({});
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submittingRef.current || isSubmitting) return;
        const effectiveCertName = isOtherCert ? customCertName.trim() : formData.certificationName.trim();
        const effectiveProvider = isOtherProvider ? otherProviderText.trim() : formData.provider.trim();

        const nameErr = validateCertificationName(formData.certificationName, isOtherCert, customCertName);
        const providerErr = validateProvider(formData.provider, isOtherProvider, otherProviderText);
        const amountErr = validateAmount(formData.amount);
        const purchaseErr = validateDateOfPurchase(formData.dateOfPurchase);
        const completionErr = validateDateOfCompletion(formData.dateOfCompletion, formData.dateOfPurchase);
        const validityFromErr = validateValidityFrom(formData.validityFrom);
        const validityErr = validateValidityDates(formData.validityFrom, formData.validityTo);
        const fileErr = validateFile(formData.file);

        setTouched({
            certificationName: true,
            provider: true,
            amount: true,
            dateOfPurchase: true,
            dateOfCompletion: true,
            validityFrom: true,
            validityTo: true,
            file: true,
        });

        setErrors({
            certificationName: nameErr,
            provider: providerErr,
            amount: amountErr,
            dateOfPurchase: purchaseErr,
            dateOfCompletion: completionErr,
            validityFrom: validityFromErr,
            validityTo: validityErr,
            file: fileErr,
        });

        if (nameErr || providerErr || amountErr || purchaseErr || completionErr || validityFromErr || validityErr || fileErr) {
            return;
        }

        submittingRef.current = true;
        setIsSubmitting(true);

        try {
            const empId = activeEmpId || localStorage.getItem("lms_active_employee_id") || "EMP019";
            const matchedReq = approvedRequests.find(
                (r) => (r.certification_name || "").trim().toLowerCase() === effectiveCertName.toLowerCase()
            );
            const resolvedMeta = await resolveAndPersistFormMetadata({
                provider: effectiveProvider,
                isCustomProvider: isOtherProvider,
            });
            const finalProvider = resolvedMeta.provider || effectiveProvider;
            const finalProviderId = resolvedMeta.provider_id || matchedReq?.provider_id || null;
            const finalCategoryId = resolvedMeta.category_id || matchedReq?.category_id || null;

            const parsedAmount = parseInt(formData.amount, 10);

            const payload = {
                employee_id: empId,
                certification_name: effectiveCertName,
                provider_name: finalProvider,
                provider_id: finalProviderId,
                category_id: finalCategoryId,
                amount: parsedAmount,
                purchase_date: formData.dateOfPurchase,
                completion_exam_date: formData.dateOfCompletion,
                validity_from: formData.validityFrom || null,
                validity_to: formData.validityTo || null,
                supporting_document_path: formData.file ? `uploads/${formData.file.name}` : "uploads/document.pdf",
                supporting_document_name: formData.file ? formData.file.name : "document.pdf",
                supporting_document_size: formData.file ? formData.file.size : 1024,
            };

            const response = await axios.post(`${API_BASE_URL}/api/reimbursements/claims`, payload);
            const serverData = response.data;

            const newClaim = {
                id: serverData.claim_code || `CLM-${Math.floor(1000 + Math.random() * 9000)}`,
                claimId: serverData.id,
                certificateTitle: serverData.certification_name || effectiveCertName,
                provider: serverData.provider_name || effectiveProvider,
                amount: serverData.amount || parseFloat(formData.amount) || 0,
                purchaseDate: serverData.purchase_date || formData.dateOfPurchase,
                completionDate: serverData.completion_exam_date || formData.dateOfCompletion,
                validityFrom: serverData.validity_from || formData.validityFrom || null,
                validityTo: serverData.validity_to || formData.validityTo || null,
                submittedOn: serverData.submitted_on || todayStr,
                requestDate: serverData.purchase_date || formData.dateOfPurchase,
                status: serverData.status || "—",
                processingStatus: serverData.processing_status || "—",
                stages: serverData.stages || [],
                fileName: formData.file ? formData.file.name : null,
                raw: serverData
            };

            setClaims((prev) => [
                ...prev,
                {
                    certification_name: effectiveCertName,
                    status: "Pending",
                }
            ]);

            if (onSubmitClaim) {
                onSubmitClaim(newClaim);
            }
            onClose();
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Error submitting reimbursement claim to backend:", err);
            if (err?.response?.status === 409) {
                setAlertDialog({
                    isOpen: true,
                    title: "Duplicate Claim",
                    message: err.response?.data?.detail || "This reimbursement claim already exists.",
                    type: "warning",
                });
                return;
            }
            // Graceful fallback to client-side claim object
            const fallbackClaim = {
                id: `CLM-${Math.floor(1000 + Math.random() * 9000)}`,
                certificateTitle: effectiveCertName,
                provider: effectiveProvider,
                amount: parseFloat(formData.amount) || 0,
                purchaseDate: formData.dateOfPurchase,
                completionDate: formData.dateOfCompletion,
                validityFrom: formData.validityFrom || null,
                validityTo: formData.validityTo || null,
                submittedOn: todayStr,
                requestDate: formData.dateOfPurchase,
                status: "Pending",
                fileName: formData.file ? formData.file.name : null,
            };

            if (onSubmitClaim) {
                onSubmitClaim(fallbackClaim);
            }
            onClose();
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
            // Reset form
            setFormData({
                certificationName: "",
                provider: "",
                amount: "",
                dateOfPurchase: "",
                dateOfCompletion: "",
                validityFrom: "",
                validityTo: "",
                file: null,
            });
            setIsOtherCert(false);
            setCustomCertName("");
            setIsOtherProvider(false);
            setOtherProviderText("");
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
                        <h2 className="emp-req-cert-title">Reimbursement Claim Request</h2>
                        <p className="emp-req-cert-subtitle">Fill in the details below to submit your reimbursement request</p>
                    </div>
                    <button className="emp-cert-modal-close" onClick={handleClose} type="button" aria-label="Close modal">
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
                                <div className="emp-form-label-row">
                                    <label>
                                        Certification Name <span className="emp-req-star">*</span>
                                    </label>
                                    {isOtherCert && (
                                        <button
                                            type="button"
                                            className="emp-btn-switch-preset"
                                            onClick={handleResetCertification}
                                        >
                                            ← Back to requested certifications
                                        </button>
                                    )}
                                </div>

                                {!isOtherCert ? (
                                    <div
                                        className="emp-select-wrapper"
                                        ref={dropdownRef}
                                    >
                                        <button
                                            type="button"
                                            className={`emp-cert-select-trigger ${errors.certificationName && touched.certificationName ? "emp-form-input-error" : ""} ${isDropdownOpen ? "active" : ""}`}
                                            onClick={() => {
                                                setIsDropdownOpen((prev) => !prev);
                                                if (!touched.certificationName) {
                                                    setTouched((prev) => ({ ...prev, certificationName: true }));
                                                }
                                            }}
                                        >
                                            <span className={`emp-cert-select-value ${!formData.certificationName ? "placeholder" : ""}`}>
                                                {formData.certificationName || (isLoadingRequests ? "Loading requested certifications..." : "Select requested certification")}
                                            </span>
                                        </button>
                                        <img
                                            src={downArrowIcon}
                                            alt=""
                                            className="emp-select-chevron-img"
                                            style={{
                                                transform: isDropdownOpen ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                                                transition: "transform 0.2s ease"
                                            }}
                                        />

                                        {isDropdownOpen && (
                                            <div className="emp-cert-dropdown-menu">
                                                {approvedRequests.length > 0 && (
                                                    <div className="emp-cert-dropdown-section">
                                                        <div className="emp-cert-dropdown-group-header">
                                                            <span className="emp-cert-dropdown-dot approved"></span>
                                                            <span>Approved Certification Requests</span>
                                                        </div>
                                                        {approvedRequests.map((req) => {
                                                            const isSelected = formData.certificationName === req.certification_name;
                                                            return (
                                                                <div
                                                                    key={req.id || req.certification_name}
                                                                    className={`emp-cert-dropdown-item ${isSelected ? "selected" : ""}`}
                                                                    onClick={() => handleCertificationSelect(req.certification_name)}
                                                                >
                                                                    <div className="emp-cert-dropdown-item-left">
                                                                        <span className="emp-cert-dropdown-item-name">{req.certification_name}</span>
                                                                        {req.provider && (
                                                                            <span className="emp-cert-dropdown-item-provider">({req.provider})</span>
                                                                        )}
                                                                    </div>
                                                                    {isSelected && <Check size={14} className="emp-cert-dropdown-check-icon" />}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {approvedRequests.length === 0 && !isLoadingRequests && (
                                                    <div className="emp-cert-dropdown-empty">No approved certifications available for claim</div>
                                                )}

                                                <div className="emp-cert-dropdown-divider"></div>

                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="emp-input-with-icon-right">
                                        <input
                                            ref={customCertInputRef}
                                            type="text"
                                            placeholder="Enter certification or course name"
                                            value={customCertName}
                                            onChange={handleCustomCertChange}
                                            onBlur={() => handleBlur("certificationName")}
                                            maxLength={100}
                                            className={errors.certificationName && touched.certificationName ? "emp-form-input-error" : ""}
                                        />
                                    </div>
                                )}

                                {errors.certificationName && touched.certificationName && (
                                    <span className="emp-form-error-text">{errors.certificationName}</span>
                                )}
                            </div>

                            {/* 2. Provider & Amount */}
                            {(() => {
                                const isCertSelected = Boolean(formData.certificationName && !isOtherCert);
                                return (
                                    <>
                                        <div className="emp-cert-form-row">
                                            <div className="emp-cert-form-group emp-flex-1">
                                                <div className="emp-form-label-row">
                                                    <label>
                                                        Certifying Authority / Provider <span className="emp-req-star">*</span>
                                                    </label>
                                                    {isOtherProvider && !isCertSelected && (
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
                                                        disabled={isCertSelected}
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
                                                            disabled={isCertSelected}
                                                        />
                                                    </div>
                                                )}

                                                {errors.provider && touched.provider && (
                                                    <span className="emp-form-error-text">{errors.provider}</span>
                                                )}
                                            </div>

                                            <div className="emp-cert-form-group emp-flex-1">
                                                <label>
                                                    Amount (INR) <span className="emp-req-star">*</span>
                                                </label>
                                                <div className={`emp-input-with-rupee-box ${isCertSelected ? "is-disabled" : ""} ${errors.amount && touched.amount ? "emp-form-input-error" : ""}`}>
                                                    <span className="emp-rupee-symbol-box">₹</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="Enter claim amount"
                                                        value={formData.amount}
                                                        onChange={handleAmountChange}
                                                        onKeyDown={(e) => {
                                                            if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        onBlur={() => handleBlur("amount")}
                                                        maxLength={6}
                                                        disabled={isCertSelected}
                                                    />
                                                </div>
                                                {errors.amount && touched.amount && (
                                                    <span className="emp-form-error-text">{errors.amount}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. Date of Purchase & Date of Completion / Exam */}
                                        <div className="emp-cert-form-row">
                                            <div className="emp-cert-form-group emp-flex-1">
                                                <label>
                                                    Date of Purchase <span className="emp-req-star">*</span>
                                                </label>
                                                <EmpDatePicker
                                                    placeholder="dd/mm/yyyy"
                                                    value={formData.dateOfPurchase}
                                                    onChange={handlePurchaseDateChange}
                                                    onBlur={() => handleBlur("dateOfPurchase")}
                                                    max={todayStr}
                                                    hasError={Boolean(errors.dateOfPurchase && touched.dateOfPurchase)}
                                                />
                                                {errors.dateOfPurchase && touched.dateOfPurchase && (
                                                    <span className="emp-form-error-text">{errors.dateOfPurchase}</span>
                                                )}
                                            </div>

                                            <div className="emp-cert-form-group emp-flex-1">
                                                <label>
                                                    Date of Completion / Exam <span className="emp-req-star">*</span>
                                                </label>
                                                <EmpDatePicker
                                                    placeholder="dd/mm/yyyy"
                                                    value={formData.dateOfCompletion}
                                                    onChange={handleCompletionDateChange}
                                                    onBlur={() => handleBlur("dateOfCompletion")}
                                                    min={formData.dateOfPurchase || ""}
                                                    hasError={Boolean(errors.dateOfCompletion && (touched.dateOfCompletion || formData.dateOfCompletion))}
                                                    disabled={isCertSelected}
                                                />
                                                {errors.dateOfCompletion && (touched.dateOfCompletion || formData.dateOfCompletion) && (
                                                    <span className="emp-form-error-text">{errors.dateOfCompletion}</span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* 4. Certification Validity From & Certification Validity To */}
                            <div className="emp-cert-form-row">
                                <div className="emp-cert-form-group emp-flex-1">
                                    <label>Certification Validity From</label>
                                    <EmpDatePicker
                                        placeholder="dd/mm/yyyy"
                                        value={formData.validityFrom}
                                        onChange={handleValidityFromChange}
                                        onBlur={() => handleBlur("validityFrom")}
                                        min="2010-01-01"
                                        max="2099-12-31"
                                        hasError={Boolean(errors.validityFrom && touched.validityFrom)}
                                    />
                                    {errors.validityFrom && touched.validityFrom && (
                                        <span className="emp-form-error-text">{errors.validityFrom}</span>
                                    )}
                                </div>

                                <div className="emp-cert-form-group emp-flex-1">
                                    <label>Certification Validity To</label>
                                    <EmpDatePicker
                                        placeholder="dd/mm/yyyy"
                                        value={formData.validityTo}
                                        onChange={handleValidityToChange}
                                        onBlur={() => handleBlur("validityTo")}
                                        min={formData.validityFrom || undefined}
                                        max="2099-12-31"
                                        hasError={Boolean(errors.validityTo && touched.validityTo)}
                                    />
                                    {errors.validityTo && touched.validityTo && (
                                        <span className="emp-form-error-text">{errors.validityTo}</span>
                                    )}
                                </div>
                            </div>

                            {/* 5. Supporting Document */}
                            <div className="emp-cert-form-group">
                                <label>
                                    Supporting Document <span className="emp-req-star">*</span>
                                </label>
                                <div
                                    className={`emp-file-dropzone-container ${errors.file && touched.file ? "emp-form-input-error" : ""}`}
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
                                <span className="emp-file-supports-text">
                                    Upload invoice, payment receipt, course completion proof, etc.
                                </span>
                                <span className="emp-file-supports-text" style={{ marginTop: 2 }}>
                                    Supports PDF, DOC, DOCX, JPG, PNG (Max.5MB each)
                                </span>
                                {errors.file && touched.file && (
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
                    type={alertDialog.type || "warning"}
                />
            )}
        </div>
    );
}
