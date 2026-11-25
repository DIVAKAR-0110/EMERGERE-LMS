import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Bell } from "lucide-react";
import useNotificationRowHighlight from "../../hooks/useNotificationRowHighlight";
import { getApprovalHighlightKey } from "../../utils/notificationHighlight";

import bluebadgecardIcon from "../../assets/Certification/bluebadgecard.svg";
import rupeesIcon from "../../assets/Certification/rupees.svg";
import warningIcon from "../../assets/Certification/warning.svg";
import greencheckIcon from "../../assets/Certification/greencheck.svg";
import uploadIcon from "../../assets/Certification/upload.svg";
import blackdownarrowIcon from "../../assets/Certification/blackdownarrow.svg";

import badgeswithbackgroundIcon from "../../assets/course_library/badgeswithbackground.svg";
import filterIcon from "../../assets/course_library/filter.svg";

import axios from "axios";

import CertificateFilterDrawer from "../../components/employee/Certification/CertificateFilterDrawer";
import ReimbursementClaimFilterDrawer from "../../components/employee/Certification/ReimbursementClaimFilterDrawer";
import UploadCertificateModal from "../../components/employee/Certification/UploadCertificateModal";
import UploadSuccessModal from "../../components/employee/Certification/UploadSuccessModal";
import RequestCertificationModal from "../../components/employee/Certification/RequestCertificationModal";
import NewReimbursementClaimModal from "../../components/employee/Certification/NewReimbursementClaimModal";
import DeleteCertificateConfirmModal from "../../components/employee/Certification/DeleteCertificateConfirmModal";
import MyCertificatesTab from "../../components/employee/Certification/MyCertificatesTab";
import ReimbursementClaimsTab from "../../components/employee/Certification/ReimbursementClaimsTab";
import ApprovalDetailsModal from "../../components/hr/ApprovalsWorkflow/ApprovalDetailsModal";

import PageHeader from "../../components/common/PageHeader";
import AlertDialog from "../../components/common/AlertDialog";
import { useAuth } from "../../context/AuthContext";

import "../../styles/employee/CertificationReimb.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function CertificationReimb() {
    const location = useLocation();
    /* =========================================================
       AUTH CONTEXT & ACTIVE EMPLOYEE RESOLUTION
    ========================================================= */
    const { user, token } = useAuth();
    const activeEmpId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "EMP019";
    const authToken = token || localStorage.getItem("lms_token") || `dev-token-${activeEmpId}`;

    /* =========================================================
       STATE
    ========================================================= */
    const [activeTab, setActiveTab] = useState(
        location.state?.highlightTab === "reimbursement-claims" ? "reimbursement-claims" : "my-certificates"
    ); // 'my-certificates' | 'reimbursement-claims'
    const [certificates, setCertificates] = useState([]);
    const [certRequests, setCertRequests] = useState([]);
    const [certRequestsFetched, setCertRequestsFetched] = useState(false);
    const [claims, setClaims] = useState([]);
    const [claimsFetched, setClaimsFetched] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: "", message: "", type: "error" });

    // Track successful backend fetch (to avoid showing false 0 when backend server is offline)
    const [certsFetchedSuccessfully, setCertsFetchedSuccessfully] = useState(false);
    const [claimsFetchedSuccessfully, setClaimsFetchedSuccessfully] = useState(false);
    const [certRequestsFetchedSuccessfully, setCertRequestsFetchedSuccessfully] = useState(false);

    const fetchCertificates = async () => {
        try {
            setIsLoading(true);
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

            // Fetch uploaded employee certifications from database for active employee
            const res = await axios.get(`${API_BASE_URL}/api/employee/certifications?employee_id=${activeEmpId}`, {
                headers
            });

            const uploadedCerts = Array.isArray(res.data) ? res.data : [];
            const sortedUploaded = [...uploadedCerts].sort((a, b) => {
                const parseDateMs = (dStr) => {
                    if (!dStr || dStr === "—") return 0;
                    const d = new Date(dStr);
                    return isNaN(d.getTime()) ? 0 : d.getTime();
                };
                const timeA = parseDateMs(a.created_at || a.createdAt);
                const timeB = parseDateMs(b.created_at || b.createdAt);
                if (timeA !== timeB && timeA > 0 && timeB > 0) {
                    return timeB - timeA;
                }
                const idA = parseInt(String(a.certification_id || a.id || "").replace(/[^0-9]/g, ""), 10) || 0;
                const idB = parseInt(String(b.certification_id || b.id || "").replace(/[^0-9]/g, ""), 10) || 0;
                return idB - idA;
            });
            setCertificates(sortedUploaded);
            setCertsFetchedSuccessfully(true);
            setIsLoading(false);
        } catch (err) {
            console.error("Failed to fetch employee certifications:", err);
            // Server offline / network error: keep skeleton active until backend fetches records
            setCertsFetchedSuccessfully(false);
        }
    };

    const fetchClaims = async () => {
        try {
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
            const res = await axios.get(`${API_BASE_URL}/api/reimbursements/claims?employee_id=${activeEmpId}`, {
                headers
            });
            if (Array.isArray(res.data)) {
                // Defensive gating: Exclude claims whose upfront certification request has not been approved
                const validClaims = res.data.filter((cl) => {
                    const isMgmtApproved = cl.is_management_approved !== false;
                    const crStatus = String(cl.cr_status || "").toLowerCase();
                    return isMgmtApproved && (crStatus === "approved" || !crStatus);
                });
                const mapped = validClaims.map((cl) => {
                    const costVal = cl.amount ? `₹${Number(cl.amount).toLocaleString('en-IN')}` : "₹0";
                    const isPaid = Boolean(
                        cl.paid_on ||
                        cl.payment_code ||
                        cl.payment_slip_path ||
                        String(cl.processing_status || "").toLowerCase() === "paid" ||
                        cl.stages?.some((s) => String(s.stage_name || "").toLowerCase() === "claimed" && String(s.stage_status || "").toLowerCase() === "completed")
                    );
                    const slipName = cl.payment_slip_name || (cl.payment_slip_path ? cl.payment_slip_path.split("/").pop() : null);

                    return {
                        id: cl.claim_code || `CLM-${cl.id}`,
                        claimId: cl.id,
                        claim_id: cl.claim_code || cl.id,
                        claimCode: cl.claim_code,
                        requestId: cl.claim_code || `CLM-${cl.id}`,
                        requestCode: cl.claim_code,
                        certificateTitle: cl.certification_name,
                        certification_name: cl.certification_name,
                        courseName: cl.certification_name,
                        courseTitle: cl.certification_name,
                        name: cl.employee_name || user?.name || user?.full_name || "Employee",
                        employeeName: cl.employee_name || user?.name || user?.full_name || "Employee",
                        employee: cl.employee_name || user?.name || user?.full_name || "Employee",
                        provider: cl.provider_name || cl.provider || "—",
                        platform: cl.provider_name || cl.provider || "—",
                        category: cl.claim_type || "Certification",
                        claim_type: cl.claim_type || "Certification",
                        amount: costVal,
                        price: costVal,
                        rawCost: cl.amount,
                        purchaseDate: cl.purchase_date,
                        completionDate: cl.completion_exam_date,
                        submittedOn: cl.submitted_on || (cl.created_at ? cl.created_at.slice(0, 10) : "-"),
                        requestedAt: cl.created_at || cl.submitted_on || cl.purchase_date || "",
                        requestDate: cl.created_at ? cl.created_at.slice(0, 10) : (cl.submitted_on || "-"),
                        status: cl.status || "—",
                        processingStatus: cl.processing_status || "Submitted to HR",
                        payment_status: isPaid ? "Paid" : (cl.status === "Approved" ? "Pending Payment" : "Pending"),
                        is_ceo_bypassed: cl.is_ceo_bypassed || false,
                        paid_on: cl.paid_on || null,
                        payment_code: cl.payment_code || null,
                        payment_slip_path: cl.payment_slip_path || null,
                        payment_slip_name: slipName,
                        payment_description: cl.payment_description || null,
                        supporting_document_path: cl.supporting_document_path || null,
                        whyLearn: cl.purpose || cl.reason || cl.learning_purpose || "Professional skill development and certification reimbursement.",
                        purpose: cl.purpose,
                        stages: cl.stages || [],
                        raw: cl
                    };
                });
                setClaims(mapped);
                setClaimsFetchedSuccessfully(true);
                setClaimsFetched(true);
            }
        } catch (err) {
            console.error("Failed to fetch employee claims:", err);
            // Server offline / network error: keep skeleton active until backend fetches records
            setClaimsFetchedSuccessfully(false);
        }
    };

    const scrollContainerRef = useRef(null);

    const fetchCertificationRequests = async () => {
        if (!activeEmpId) {
            setCertRequests([]);
            setCertRequestsFetched(true);
            return;
        }
        try {
            const res = await axios.get(`${API_BASE_URL}/api/certifications/requests`, {
                params: { employee_id: activeEmpId },
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const list = Array.isArray(res.data)
                ? res.data
                : res.data?.requests || res.data?.data || [];
            setCertRequests(list);
            setCertRequestsFetchedSuccessfully(true);
            setCertRequestsFetched(true);
        } catch (err) {
            console.error("Error fetching certification requests:", err);
            setCertRequestsFetchedSuccessfully(false);
        }
    };

    useEffect(() => {
        fetchCertificates();
        fetchCertificationRequests();
        fetchClaims();
    }, [activeEmpId]);

    // When backend is offline or requests fail, auto-retry periodically until records are fetched
    useEffect(() => {
        if (!certsFetchedSuccessfully || !claimsFetchedSuccessfully || !certRequestsFetchedSuccessfully) {
            const retryInterval = setInterval(() => {
                if (!certsFetchedSuccessfully) fetchCertificates();
                if (!claimsFetchedSuccessfully) fetchClaims();
                if (!certRequestsFetchedSuccessfully) fetchCertificationRequests();
            }, 4000);
            return () => clearInterval(retryInterval);
        }
    }, [activeEmpId, certsFetchedSuccessfully, claimsFetchedSuccessfully, certRequestsFetchedSuccessfully]);

    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

    // Dedicated filter states for My Certificates tab
    const [myCertTypes, setMyCertTypes] = useState(["All"]);
    const [myCertProviders, setMyCertProviders] = useState(["All"]);
    const [myCertStatuses, setMyCertStatuses] = useState(["All"]);

    // Dedicated filter states for Requests tab
    const [reqStatuses, setReqStatuses] = useState(["All"]);
    const [reqProviders, setReqProviders] = useState(["All"]);
    const [reqSchedules, setReqSchedules] = useState(["All"]);

    const [expandedRequestId, setExpandedRequestId] = useState(null);
    const [reimbSubTab, setReimbSubTab] = useState("My Claim"); // 'My Claim' | 'Approved' | 'Pending' | 'Rejected'
    const [expandedClaimId, setExpandedClaimId] = useState(null);

    // Dedicated filter states for Reimbursement Claims tab
    const [isClaimFilterOpen, setIsClaimFilterOpen] = useState(false);
    const [claimFilters, setClaimFilters] = useState({
        minPrice: "",
        maxPrice: "",
        purchaseStartDate: "",
        purchaseEndDate: "",
        submittedStartDate: "",
        submittedEndDate: "",
        requestedStartDate: "",
        requestedEndDate: "",
    });

    // Modal States
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUploadSuccessOpen, setIsUploadSuccessOpen] = useState(false);
    const [successModalTitle, setSuccessModalTitle] = useState("Certificate uploaded Successfully!");
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isNewClaimModalOpen, setIsNewClaimModalOpen] = useState(false);
    const [selectedClaimForDetails, setSelectedClaimForDetails] = useState(null);
    const [deleteCertTarget, setDeleteCertTarget] = useState(null);
    const [isDeletingCert, setIsDeletingCert] = useState(false);

    const claimHighlightLocationState = useMemo(() => {
        if (location.state?.highlightTab !== "reimbursement-claims" || !location.state?.highlightTimestamp) {
            return null;
        }
        return location.state;
    }, [location.state]);

    const { highlightedKey: highlightedClaimId } = useNotificationRowHighlight({
        locationState: claimHighlightLocationState,
        isReady: claimsFetched,
        targetList: claims,
        storageKey: "lms_completed_emp_reimb_highlight_ts",
        onActivate: () => {
            setActiveTab("reimbursement-claims");
            setReimbSubTab("My Claim");
        },
    });

    const certRequestHighlightLocationState = useMemo(() => {
        if (
            !location.state?.highlightTimestamp ||
            location.state?.highlightTab === "reimbursement-claims"
        ) {
            return null;
        }
        const hasCertHint = Boolean(
            location.state?.highlightRequestCode ||
            location.state?.highlightRequestId ||
            location.state?.highlightCertTitle ||
            location.state?.highlightTitle
        );
        if (!hasCertHint) return null;
        return {
            ...location.state,
            highlightTitle:
                location.state.highlightTitle || location.state.highlightCertTitle || "",
        };
    }, [location.state]);

    const { highlightedKey: highlightedRequestId } = useNotificationRowHighlight({
        locationState: certRequestHighlightLocationState,
        isReady: certRequestsFetched,
        targetList: certRequests,
        storageKey: "lms_completed_emp_cert_req_highlight_ts",
        onActivate: () => {
            setActiveTab("requests");
        },
    });

    useEffect(() => {
        if (!highlightedRequestId || certRequests.length === 0) return;
        const matched = certRequests.find(
            (req) => getApprovalHighlightKey(req) === String(highlightedRequestId)
        );
        if (matched) {
            const reqKey = matched.request_code || String(matched.id ?? matched.request_id);
            setExpandedRequestId(reqKey);
        }
    }, [highlightedRequestId, certRequests]);

    const filteredCertRequests = useMemo(() => {
        return certRequests.filter((req) => {
            // 1. Request Status Filter (Pending, Approved, Rejected)
            const rawStatus = req.request_status || req.status || "Pending";
            const statusLower = String(rawStatus).toLowerCase();
            const matchesStatus =
                reqStatuses.includes("All") ||
                reqStatuses.some((st) => st.toLowerCase() === statusLower);

            // 2. Provider Filter
            const providerName = (req.provider_name || req.provider || "").trim();
            const matchesProvider =
                reqProviders.includes("All") ||
                reqProviders.some((p) => p.toLowerCase() === providerName.toLowerCase());

            // 3. Exam Schedule Filter (Scheduled vs Expired Schedule vs Pending Schedule)
            const rawExamDate = req.scheduled_exam_date || req.exam_date;
            let isUpcomingScheduled = false;
            let isExpiredSchedule = false;
            let isPendingSchedule = false;

            if (rawExamDate) {
                try {
                    const d = new Date(rawExamDate);
                    if (!isNaN(d.getTime())) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const examDay = new Date(d);
                        examDay.setHours(0, 0, 0, 0);

                        if (examDay >= today) {
                            isUpcomingScheduled = true;
                        } else {
                            isExpiredSchedule = true;
                        }
                    } else {
                        isPendingSchedule = true;
                    }
                } catch {
                    isPendingSchedule = true;
                }
            } else {
                isPendingSchedule = true;
            }

            const matchesSchedule =
                reqSchedules.includes("All") ||
                (reqSchedules.includes("Scheduled") && isUpcomingScheduled) ||
                (reqSchedules.includes("Expired Schedule") && isExpiredSchedule) ||
                (reqSchedules.includes("Pending Schedule") && isPendingSchedule);

            return matchesStatus && matchesProvider && matchesSchedule;
        });
    }, [certRequests, reqStatuses, reqProviders, reqSchedules]);

    /* =========================================================
       ACTIVE VALIDITY EVALUATOR
    ========================================================= */
    const isCertificateActive = (cert) => {
        if (!cert) return false;
        if (cert.status === "expired") return false;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // 1. Direct date check (expiryDate, scheduled_exam_date, expiry_date)
        const rawDate = cert.expiryDate || cert.scheduled_exam_date || cert.expiry_date;
        if (rawDate) {
            try {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    return d >= now;
                }
            } catch {
                // fall through
            }
        }

        // 2. Parse from validityText: e.g. "Valid till Feb 2027", "Completed on Oct 2026", "Valid Certificate"
        if (cert.validityText && typeof cert.validityText === "string") {
            const trimmed = cert.validityText.trim();
            if (/^expired/i.test(trimmed)) return false;
            if (/^completed\s+on/i.test(trimmed)) return true;
            if (/^valid\s+certificate/i.test(trimmed)) return true;
            if (/^valid\s+till/i.test(trimmed)) {
                const datePart = trimmed.replace(/^valid\s+till\s+/i, "").trim();
                const parsedMonth = Date.parse(datePart + " 01");
                if (!isNaN(parsedMonth)) {
                    const exp = new Date(parsedMonth);
                    exp.setMonth(exp.getMonth() + 1);
                    exp.setDate(0);
                    exp.setHours(23, 59, 59, 999);
                    return exp >= now;
                }
                const parsedGeneral = Date.parse(datePart);
                if (!isNaN(parsedGeneral)) {
                    return new Date(parsedGeneral) >= now;
                }
                return true;
            }
        }

        // 3. Status from backend
        if (cert.status === "valid" || cert.status === "completed") {
            return true;
        }

        // 4. Default perpetual / completed certifications without expiration date
        if (!rawDate) {
            return true;
        }

        return false;
    };

    /* =========================================================
       DYNAMIC STATS COMPUTATION
    ========================================================= */
    const stats = useMemo(() => {
        const isProfessionalCert = (c) => {
            if (!c) return false;
            const typeStr = String(c.type || "").trim().toLowerCase();
            const certTypeStr = String(c.certificate_type || "").trim().toLowerCase();
            if (typeStr.includes("course completion") || certTypeStr.includes("course completion")) {
                return false;
            }
            return typeStr.includes("professional") || typeStr.includes("certification") ||
                certTypeStr.includes("professional") || certTypeStr.includes("certification");
        };
        const activeCertsCount = certificates.filter((c) => isCertificateActive(c) && isProfessionalCert(c)).length;

        const isPaidClaim = (cl) =>
            String(cl.processingStatus || cl.processing_status || cl.raw?.processing_status || "").toLowerCase() === "paid" ||
            Boolean(cl.payment_slip_path || cl.raw?.payment_slip_path) ||
            Boolean(cl.payment_code || cl.raw?.payment_code) ||
            Boolean(cl.paid_on || cl.raw?.paid_on) ||
            cl.stages?.some((s) => String(s.stage_name || "").toLowerCase() === "claimed" && String(s.stage_status || "").toLowerCase() === "completed");

        const totalReimbursedSum = claims
            .filter((cl) => isPaidClaim(cl))
            .reduce((sum, cl) => {
                const num = Number(
                    cl.rawCost ??
                    (typeof cl.amount === "string" ? cl.amount.replace(/[^\d.-]/g, "") : cl.amount)
                ) || 0;
                return sum + num;
            }, 0);

        const pendingClaimsCount = claims.filter((cl) => cl.status === "Pending").length;
        const approvedClaimsCount = claims.filter((cl) => cl.status === "Approved").length;

        return {
            activeCertifications: activeCertsCount,
            totalReimbursed: totalReimbursedSum,
            pendingClaims: pendingClaimsCount,
            approvedClaims: approvedClaimsCount,
        };
    }, [certificates, claims]);

    const isStatsLoading = !certsFetchedSuccessfully || !claimsFetchedSuccessfully;

    /* =========================================================
       FILTERED CERTIFICATES & CLAIMS
    ========================================================= */
    const myCertActiveFilterCount = useMemo(() => {
        let count = 0;
        if (!myCertTypes.includes("All")) count += myCertTypes.length;
        if (!myCertProviders.includes("All")) count += myCertProviders.length;
        if (!myCertStatuses.includes("All")) count += myCertStatuses.length;
        return count;
    }, [myCertTypes, myCertProviders, myCertStatuses]);

    const reqActiveFilterCount = useMemo(() => {
        let count = 0;
        if (!reqStatuses.includes("All")) count += reqStatuses.length;
        if (!reqProviders.includes("All")) count += reqProviders.length;
        if (!reqSchedules.includes("All")) count += reqSchedules.length;
        return count;
    }, [reqStatuses, reqProviders, reqSchedules]);

    const maxClaimAmount = useMemo(() => {
        const amounts = (claims || []).map((c) => Number(c.amount) || 0);
        const highest = amounts.length > 0 ? Math.max(0, ...amounts) : 0;
        return highest > 0 ? highest : 5000;
    }, [claims]);

    const activeFilterCount = activeTab === "requests" ? reqActiveFilterCount : myCertActiveFilterCount;

    const claimActiveFilterCount = useMemo(() => {
        let count = 0;
        if (claimFilters.minPrice || claimFilters.maxPrice) count += 1;
        if (claimFilters.purchaseStartDate || claimFilters.purchaseEndDate) count += 1;
        if (claimFilters.submittedStartDate || claimFilters.submittedEndDate) count += 1;
        if (claimFilters.requestedStartDate || claimFilters.requestedEndDate) count += 1;
        return count;
    }, [claimFilters]);

    const handleClearClaimFilters = () => {
        setClaimFilters({
            minPrice: "",
            maxPrice: "",
            purchaseStartDate: "",
            purchaseEndDate: "",
            submittedStartDate: "",
            submittedEndDate: "",
            requestedStartDate: "",
            requestedEndDate: "",
        });
    };

    const normalizeDateToIso = (dStr) => {
        if (!dStr || dStr === "-" || dStr === "—") return "";
        const clean = String(dStr).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
            return clean.slice(0, 10);
        }
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(clean)) {
            const parts = clean.split(/[\/\-]/);
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        }
        return "";
    };

    const filteredCertificates = useMemo(() => {
        return certificates.filter((cert) => {
            // 1. Certificate Type Filter
            const isCourseCert =
                cert.type === "Course Completion Certificate" ||
                cert.type === "Course Certificate" ||
                cert.certificate_type === "Course Completion Certificate" ||
                cert.certificate_type === "Course Certificate" ||
                String(cert.type || "").toLowerCase().includes("course completion") ||
                String(cert.certificate_type || "").toLowerCase().includes("course completion");
            const certType = isCourseCert ? "Course Completion Certificate" : "Professional Certification";

            const matchesType =
                myCertTypes.includes("All") ||
                myCertTypes.includes(certType) ||
                myCertTypes.some((t) => t.toLowerCase() === String(cert.type || "").toLowerCase());

            // 2. Provider Filter
            const certProvider = (cert.provider || cert.provider_name || cert.issuer || "").trim();
            const matchesProvider =
                myCertProviders.includes("All") ||
                myCertProviders.some((p) => p.toLowerCase() === certProvider.toLowerCase());

            // 3. Status Filter
            const isCertActive = isCertificateActive(cert) && cert.status !== "expired";
            const matchesStatus =
                myCertStatuses.includes("All") ||
                (myCertStatuses.includes("Valid") && isCertActive) ||
                (myCertStatuses.includes("Expired") && !isCertActive);

            return matchesType && matchesProvider && matchesStatus;
        });
    }, [certificates, myCertTypes, myCertProviders, myCertStatuses]);

    const filteredClaims = useMemo(() => {
        let list = claims;
        if (reimbSubTab === "Approved") list = list.filter((c) => c.status === "Approved");
        else if (reimbSubTab === "Pending") list = list.filter((c) => c.status === "Pending");
        else if (reimbSubTab === "Rejected") list = list.filter((c) => c.status === "Rejected");

        // 1. Amount filter (#priceRefinements)
        if (claimFilters.minPrice !== "") {
            const min = parseFloat(claimFilters.minPrice);
            if (!isNaN(min)) {
                list = list.filter((c) => {
                    const amt = typeof c.amount === "number" ? c.amount : (parseFloat(String(c.amount).replace(/[^0-9.]/g, "")) || 0);
                    return amt >= min;
                });
            }
        }
        if (claimFilters.maxPrice !== "") {
            const max = parseFloat(claimFilters.maxPrice);
            if (!isNaN(max)) {
                list = list.filter((c) => {
                    const amt = typeof c.amount === "number" ? c.amount : (parseFloat(String(c.amount).replace(/[^0-9.]/g, "")) || 0);
                    return amt <= max;
                });
            }
        }

        // 2. Date of purchase range filter
        const pStart = normalizeDateToIso(claimFilters.purchaseStartDate);
        const pEnd = normalizeDateToIso(claimFilters.purchaseEndDate);
        if (pStart) {
            list = list.filter((c) => {
                const itemDate = normalizeDateToIso(c.purchaseDate);
                return itemDate ? itemDate >= pStart : false;
            });
        }
        if (pEnd) {
            list = list.filter((c) => {
                const itemDate = normalizeDateToIso(c.purchaseDate);
                return itemDate ? itemDate <= pEnd : false;
            });
        }

        // 3. Submitted on range filter
        const sStart = normalizeDateToIso(claimFilters.submittedStartDate);
        const sEnd = normalizeDateToIso(claimFilters.submittedEndDate);
        if (sStart) {
            list = list.filter((c) => {
                const itemDate = normalizeDateToIso(c.submittedOn);
                return itemDate ? itemDate >= sStart : false;
            });
        }
        if (sEnd) {
            list = list.filter((c) => {
                const itemDate = normalizeDateToIso(c.submittedOn);
                return itemDate ? itemDate <= sEnd : false;
            });
        }

        // 4. Requested at range filter
        const rStart = normalizeDateToIso(claimFilters.requestedStartDate);
        const rEnd = normalizeDateToIso(claimFilters.requestedEndDate);
        if (rStart) {
            list = list.filter((c) => {
                const itemDate = normalizeDateToIso(c.requestedAt || c.requestDate);
                return itemDate ? itemDate >= rStart : false;
            });
        }
        if (rEnd) {
            list = list.filter((c) => {
                const itemDate = normalizeDateToIso(c.requestedAt || c.requestDate);
                return itemDate ? itemDate <= rEnd : false;
            });
        }

        return list;
    }, [claims, reimbSubTab, claimFilters]);

    /* =========================================================
       HANDLERS
    ========================================================= */
    const handleAddCertificate = (newCert) => {
        if (newCert) {
            setCertificates((prev) => [newCert, ...prev.filter((c) => c.id !== newCert.id && c.certification_id !== newCert.certification_id)]);
        }
        fetchCertificates();
        setSuccessModalTitle("Certificate uploaded Successfully!");
        setIsUploadSuccessOpen(true);
    };

    const handleAddRequestCertification = () => {
        fetchCertificationRequests();
        setActiveTab("requests");
        setSuccessModalTitle("Request Submitted Successfully!");
        setIsUploadSuccessOpen(true);
    };

    const handleAddReimbursementClaim = (newClaim) => {
        if (newClaim) {
            setClaims((prev) => [newClaim, ...prev.filter((c) => c.id !== newClaim.id)]);
        }
        fetchClaims();
        setSuccessModalTitle("Claim Submitted Successfully!");
        setIsUploadSuccessOpen(true);
    };

    const handleDeleteCertificate = (itemTitle, itemId, itemType = "certification") => {
        setDeleteCertTarget({ id: itemId, title: itemTitle, type: itemType });
    };

    const handleConfirmDeleteCertificate = async () => {
        if (!deleteCertTarget) return;
        setIsDeletingCert(true);
        try {
            const numericId = String(deleteCertTarget.id).replace("cert-", "");
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
            await axios.delete(`${API_BASE_URL}/api/employee/certifications/${numericId}`, {
                headers
            });
            setCertificates((prev) => prev.filter((c) => c.id !== deleteCertTarget.id));
            setDeleteCertTarget(null);
            fetchCertificates();
        } catch (err) {
            console.error("Failed to delete certificate:", err);
            setAlertDialog({
                isOpen: true,
                title: "Deletion Failed",
                message: "Failed to delete certificate. Please try again.",
                type: "error",
            });
        } finally {
            setIsDeletingCert(false);
        }
    };

    const handleDownloadCertificate = async (itemTitle, itemId, certificateUrl) => {
        try {
            const numericId = String(itemId).replace("cert-", "");
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
            const response = await axios.get(`${API_BASE_URL}/api/employee/certifications/${numericId}/download`, {
                headers,
                responseType: "blob"
            });
            const blob = new Blob([response.data]);
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            const ext = certificateUrl ? certificateUrl.split(".").pop() : "pdf";
            a.download = `${itemTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Failed to download certificate via API:", err);
            if (certificateUrl) {
                const targetUrl = certificateUrl.startsWith("http") ? certificateUrl : `${API_BASE_URL}${certificateUrl}`;
                window.open(targetUrl, "_blank");
            } else {
                setAlertDialog({
                    isOpen: true,
                    title: "No Attachment",
                    message: `No document file attached for "${itemTitle}".`,
                    type: "warning",
                });
            }
        }
    };

    return (
        <div className="emp-cert-reimb-page">
            {/* FIXED TOP HEADER */}
            <div
                className="emp-cert-fixed-header"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                {/* Page Header */}
                <PageHeader
                    title="Certification & Reimbursement"
                    subtitle="Upload earned credentials, track certification statuses, and submit reimbursement claims."
                />

                {/* Stat Cards Grid (4 KPI Cards matching Image 1) */}
                <div className="emp-cert-stats-grid">
                    {/* 1. Active Certifications */}
                    <div className="emp-cert-stat-card">
                        <div className="emp-stat-card-icon-circle emp-icon-blue-bg">
                            <img src={bluebadgecardIcon} alt="Active Certifications" style={{ width: 20, height: 20 }} />
                        </div>
                        <div className="emp-stat-card-info-box">
                            <h2 className="emp-stat-value-text">
                                {isStatsLoading ? (
                                    <span className="emp-stat-skeleton" style={{ width: 36 }} />
                                ) : (
                                    stats.activeCertifications
                                )}
                            </h2>
                            <span className="emp-stat-label-text">Active Certifications</span>
                        </div>
                    </div>

                    {/* 2. Total Reimbursed */}
                    <div className="emp-cert-stat-card">
                        <div className="emp-stat-card-icon-circle emp-icon-navy-bg">
                            <img src={rupeesIcon} alt="Total Reimbursed" style={{ width: 20, height: 20 }} />
                        </div>
                        <div className="emp-stat-card-info-box">
                            <h2 className="emp-stat-value-text">
                                {isStatsLoading ? (
                                    <span className="emp-stat-skeleton" style={{ width: 64 }} />
                                ) : (
                                    `₹${Number(stats.totalReimbursed || 0).toLocaleString("en-IN")}`
                                )}
                            </h2>
                            <span className="emp-stat-label-text">Total Reimbursed</span>
                        </div>
                    </div>

                    {/* 3. Pending Claims */}
                    <div className="emp-cert-stat-card">
                        <div className="emp-stat-card-icon-circle emp-icon-amber-bg">
                            <img src={warningIcon} alt="Pending Claims" style={{ width: 20, height: 20 }} />
                        </div>
                        <div className="emp-stat-card-info-box">
                            <h2 className="emp-stat-value-text">
                                {isStatsLoading ? (
                                    <span className="emp-stat-skeleton" style={{ width: 36 }} />
                                ) : (
                                    stats.pendingClaims
                                )}
                            </h2>
                            <span className="emp-stat-label-text">Pending Claims</span>
                        </div>
                    </div>

                    {/* 4. Approved Claims */}
                    <div className="emp-cert-stat-card">
                        <div className="emp-stat-card-icon-circle emp-icon-emerald-bg">
                            <img src={greencheckIcon} alt="Approved Claims" style={{ width: 20, height: 20 }} />
                        </div>
                        <div className="emp-stat-card-info-box">
                            <h2 className="emp-stat-value-text">
                                {isStatsLoading ? (
                                    <span className="emp-stat-skeleton" style={{ width: 36 }} />
                                ) : (
                                    stats.approvedClaims
                                )}
                            </h2>
                            <span className="emp-stat-label-text">Approved Claims</span>
                        </div>
                    </div>
                </div>

                {/* Main Tabs Navbar & Action Toolbar Row */}
                <div className="emp-cert-tabs-bar-row">
                    <div className="emp-cert-tabs-group">
                        <button
                            className={`emp-cert-tab-pill ${activeTab === "my-certificates" ? "active" : ""}`}
                            onClick={() => setActiveTab("my-certificates")}
                        >
                            My Certificates
                        </button>
                        <button
                            className={`emp-cert-tab-pill ${activeTab === "requests" ? "active" : ""}`}
                            onClick={() => setActiveTab("requests")}
                        >
                            Requests
                        </button>
                        <button
                            className={`emp-cert-tab-pill ${activeTab === "reimbursement-claims" ? "active" : ""}`}
                            onClick={() => setActiveTab("reimbursement-claims")}
                        >
                            <span className="emp-tab-label-full">Reimbursement Claims</span>
                            <span className="emp-tab-label-short">Claims</span>
                        </button>
                    </div>

                    <div className="emp-cert-tabs-actions emp-flex-row emp-gap-12 emp-align-center">
                        {activeTab !== "reimbursement-claims" ? (
                            <>
                                <div className="emp-cert-action-btns-group">
                                    {activeTab === "my-certificates" && (
                                        <button className="emp-btn-upload-outline-blue" onClick={() => setIsUploadModalOpen(true)}>
                                            <img src={uploadIcon} alt="" style={{ width: 15, height: 15 }} />
                                            <span>Upload New Certificate</span>
                                        </button>
                                    )}
                                    {activeTab === "requests" && (
                                        <button className="emp-btn-primary-blue-pill" onClick={() => setIsRequestModalOpen(true)}>
                                            <span>+ Request Certification</span>
                                        </button>
                                    )}
                                </div>
                                <button
                                    className={`emp-btn-toolbar-outline ${activeFilterCount > 0 ? "filtered" : ""}`}
                                    onClick={() => setIsFilterDrawerOpen(true)}
                                >
                                    <img src={filterIcon} alt="Filter" style={{ width: 15, height: 15 }} />
                                    <span>Filter</span>
                                    {activeFilterCount > 0 && (
                                        <span
                                            className="emp-filter-clear-cross"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (activeTab === "requests") {
                                                    setReqStatuses(["All"]);
                                                    setReqProviders(["All"]);
                                                    setReqSchedules(["All"]);
                                                } else {
                                                    setMyCertTypes(["All"]);
                                                    setMyCertProviders(["All"]);
                                                    setMyCertStatuses(["All"]);
                                                }
                                            }}
                                            title="Clear all filters"
                                        >
                                            ×
                                        </span>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="emp-btn-primary-blue-pill emp-btn-claim-action" onClick={() => setIsNewClaimModalOpen(true)}>
                                    + New Reimbursement Claim
                                </button>
                                <button
                                    className={`emp-btn-toolbar-outline ${claimActiveFilterCount > 0 ? "filtered" : ""}`}
                                    onClick={() => setIsClaimFilterOpen(true)}
                                >
                                    <img src={filterIcon} alt="Filter" style={{ width: 15, height: 15 }} />
                                    <span>Filter</span>
                                    {claimActiveFilterCount > 0 && (
                                        <span
                                            className="emp-filter-clear-cross"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleClearClaimFilters();
                                            }}
                                            title="Clear all filters"
                                        >
                                            ×
                                        </span>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* SCROLLABLE MAIN CONTENT AREA */}
            <div className="emp-cert-scrollable-content" ref={scrollContainerRef}>
                {/* Tab Content */}
                {activeTab !== "reimbursement-claims" ? (
                    <MyCertificatesTab
                        filteredCertificates={filteredCertificates}
                        filteredCertRequests={filteredCertRequests}
                        mode={activeTab}
                        expandedRequestId={expandedRequestId}
                        setExpandedRequestId={setExpandedRequestId}
                        highlightedRequestId={highlightedRequestId}
                        onUploadClick={() => setIsUploadModalOpen(true)}
                        onRequestClick={() => setIsRequestModalOpen(true)}
                        onDownloadCertificate={handleDownloadCertificate}
                        onDeleteCertificate={handleDeleteCertificate}
                        isLoading={!certsFetchedSuccessfully || !certRequestsFetchedSuccessfully}
                    />
                ) : (
                    <ReimbursementClaimsTab
                        filteredClaims={filteredClaims}
                        reimbSubTab={reimbSubTab}
                        setReimbSubTab={setReimbSubTab}
                        expandedClaimId={expandedClaimId}
                        setExpandedClaimId={setExpandedClaimId}
                        highlightedItemId={highlightedClaimId}
                        isLoading={!claimsFetchedSuccessfully}
                        onViewClaimDetails={(claim) => setSelectedClaimForDetails(claim)}
                    />
                )}
            </div>

            {/* Modals */}
            <UploadCertificateModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUpload={handleAddCertificate}
            />

            <UploadSuccessModal
                isOpen={isUploadSuccessOpen}
                onClose={() => setIsUploadSuccessOpen(false)}
                title={successModalTitle}
            />

            <RequestCertificationModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                onRequest={handleAddRequestCertification}
            />

            <NewReimbursementClaimModal
                isOpen={isNewClaimModalOpen}
                onClose={() => setIsNewClaimModalOpen(false)}
                onSubmitClaim={handleAddReimbursementClaim}
                activeEmpId={activeEmpId}
                existingClaims={claims}
            />

            {selectedClaimForDetails && (
                <ApprovalDetailsModal
                    approval={selectedClaimForDetails}
                    requestType={selectedClaimForDetails?.claim_type === "Course" ? "course" : "cert"}
                    readOnly={true}
                    onClose={() => setSelectedClaimForDetails(null)}
                />
            )}

            {activeTab !== "reimbursement-claims" && (
                <CertificateFilterDrawer
                    isOpen={isFilterDrawerOpen}
                    onClose={() => setIsFilterDrawerOpen(false)}
                    mode={activeTab}
                    // My Certificates
                    selectedCertTypes={myCertTypes}
                    selectedStatuses={myCertStatuses}
                    certificates={certificates}
                    // Requests
                    selectedRequestStatuses={reqStatuses}
                    selectedSchedules={reqSchedules}
                    requests={certRequests}
                    // Shared Provider
                    selectedProviders={activeTab === "requests" ? reqProviders : myCertProviders}
                    onApply={(applied) => {
                        if (activeTab === "requests") {
                            setReqStatuses(applied.statuses || ["All"]);
                            setReqProviders(applied.providers || ["All"]);
                            setReqSchedules(applied.schedules || ["All"]);
                        } else {
                            setMyCertTypes(applied.types || ["All"]);
                            setMyCertProviders(applied.providers || ["All"]);
                            setMyCertStatuses(applied.statuses || ["All"]);
                        }
                    }}
                    onClearAll={() => {
                        if (activeTab === "requests") {
                            setReqStatuses(["All"]);
                            setReqProviders(["All"]);
                            setReqSchedules(["All"]);
                        } else {
                            setMyCertTypes(["All"]);
                            setMyCertProviders(["All"]);
                            setMyCertStatuses(["All"]);
                        }
                    }}
                />
            )}

            <ReimbursementClaimFilterDrawer
                isOpen={isClaimFilterOpen}
                onClose={() => setIsClaimFilterOpen(false)}
                filters={claimFilters}
                maxPriceLimit={maxClaimAmount}
                onApply={(applied) => setClaimFilters(applied)}
                onClearAll={handleClearClaimFilters}
            />

            <DeleteCertificateConfirmModal
                isOpen={Boolean(deleteCertTarget)}
                onClose={() => {
                    if (!isDeletingCert) setDeleteCertTarget(null);
                }}
                onConfirm={handleConfirmDeleteCertificate}
                certificateTitle={deleteCertTarget?.title || ""}
                certificateType={deleteCertTarget?.type || "certification"}
                isDeleting={isDeletingCert}
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
        </div>
    );
}
