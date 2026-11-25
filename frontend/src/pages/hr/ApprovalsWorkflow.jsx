import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import useNotificationRowHighlight from "../../hooks/useNotificationRowHighlight";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/common/PageHeader";
import { fetchAllEmployees } from "../../services/teamService";
import ApprovalStatsCards from "../../components/hr/ApprovalsWorkflow/ApprovalStatsCards";
import ApprovalDetailsModal from "../../components/hr/ApprovalsWorkflow/ApprovalDetailsModal";
import CourseRequestsTab from "../../components/hr/ApprovalsWorkflow/CourseRequestsTab";
import CertificationRequestsTab from "../../components/hr/ApprovalsWorkflow/CertificationRequestsTab";
import RejectRequestModal from "../../components/hr/ApprovalsWorkflow/RejectRequestModal";
import TopToastNotification from "../../components/common/TopToastNotification";
import searchIcon from "../../assets/course_library/search.svg";
import filtersIcon from "../../assets/coursemanagement/filters.svg";
import HRCourseFilterDrawer from "../../components/hr/ApprovalsWorkflow/HRCourseFilterDrawer";
import HRCertificationFilterDrawer from "../../components/hr/ApprovalsWorkflow/HRCertificationFilterDrawer";
import { sanitizeSingleSpaceInput } from "../../utils/validationUtils";

import "../../styles/hr/ApprovalsWorkflow.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function ApprovalsWorkflow() {
    const { user } = useAuth();
    const location = useLocation();

    // Top Request Type Pill (Course Requests | Certification Requests)
    const [requestType, setRequestType] = useState(
        location.state?.highlightTab || location.state?.requestType || "course"
    ); // 'course' | 'cert'

    // Status Filter Tab (All | Pending | Approved | Rejected)
    const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter || "All");

    // Search Query (Request ID, Employee, Course, Certification)
    const [searchQuery, setSearchQuery] = useState("");

    // Course Reimbursement Filter Drawer State: Department, Request Date
    const [isCourseDrawerOpen, setIsCourseDrawerOpen] = useState(false);
    const [courseFilters, setCourseFilters] = useState({
        departments: ["All"],
        reqStartDate: "",
        reqEndDate: "",
    });

    // Certification Reimbursement Filter Drawer State: Department, Amount, Request Date
    const [isCertDrawerOpen, setIsCertDrawerOpen] = useState(false);
    const [certFilters, setCertFilters] = useState({
        departments: ["All"],
        amountRange: null,
        reqStartDate: "",
        reqEndDate: "",
    });

    // Rejection Modal State
    const [rejectTarget, setRejectTarget] = useState(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const [toast, setToast] = useState({ isOpen: false, type: "success", message: "" });

    useEffect(() => {
        if (location.state?.statusFilter) {
            setStatusFilter(location.state.statusFilter);
        }
        const nextTab = location.state?.highlightTab || location.state?.requestType;
        if (nextTab) {
            setRequestType(nextTab);
        }
    }, [location.state]);

    // Course & Certification Requests State
    const [courseRequests, setCourseRequests] = useState([]);
    const [certRequests, setCertRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modals
    const [selectedApproval, setSelectedApproval] = useState(null);
    const deptMapRef = useRef({});
    const empIdMapRef = useRef({});

    // Fetch live courses added to catalog from backend
    const fetchCourses = async (customDeptMap, customEmpIdMap) => {
        const activeDeptMap = customDeptMap || deptMapRef.current || {};
        const activeEmpIdMap = customEmpIdMap || empIdMapRef.current || {};
        try {
            const res = await axios.get(`${API_BASE_URL}/api/courses`);
            if (Array.isArray(res.data)) {
                // Filter only courses that represent actual reimbursement claims (have an actual claim_id or request_id)
                // Exclude system seed inventory and requests rejected by L&D/CEO
                const validClaims = res.data.filter((c) => {
                    const hasClaim = Boolean(c.claim_id || c.request_id || c.course_request_code);
                    const isSystemSeed = (c.created_by || "").toUpperCase() === "SYSTEM" && !c.claim_id && !c.request_id;
                    const isRejectedUpfront = (c.ceo_status || "").toLowerCase() === "rejected" || (c.ld_status || "").toLowerCase() === "rejected";
                    return hasClaim && !isSystemSeed && !isRejectedUpfront;
                });

                const mapped = validClaims.map((c, idx) => {
                    const empName = c.employee_name || "-";
                    const initials = empName
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();

                    const reqDate = c.created_at
                        ? new Date(c.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        })
                        : "20 May 2026";

                    const costVal = c.price != null ? c.price : 0;
                    const claimId = c.claim_id || c.course_request_code || (c.request_id ? `REQ-${c.request_id}` : `CRS-${c.id}`);

                    const dept =
                        c.department ||
                        c.employee_department ||
                        activeDeptMap[empName.trim().toLowerCase()] ||
                        activeDeptMap[String(c.employee_id || "").trim().toLowerCase()] ||
                        "—";

                    const resolvedEmpId =
                        c.employee_id ||
                        c.emp_id ||
                        c.employeeId ||
                        activeEmpIdMap[empName.trim().toLowerCase()] ||
                        "";

                    return {
                        id: claimId,
                        claim_id: claimId,
                        course_id: c.id,
                        request_id: c.request_id,
                        course_request_code: c.course_request_code,
                        name: empName,
                        empId: resolvedEmpId,
                        employeeId: resolvedEmpId,
                        employee_id: resolvedEmpId,
                        title: dept,
                        department: dept,
                        role: c.employee_role || "—",
                        initials: initials || "RG",
                        avatarBg: ["#3B82F6", "#F97FFF", "#34D399", "#FBBF24", "#A78BFA"][idx % 5],
                        course: c.course_title,
                        courseName: c.course_title,
                        provider: c.provider_name || "Online Platform",
                        platform: c.provider_name || "Online Platform",
                        category: c.category_name || "—",
                        courseLink: c.course_url || "",
                        amount: costVal > 0 ? `₹${Number(costVal).toLocaleString()}` : "—",
                        rawCost: costVal,
                        requestDate: reqDate,
                        status: c.hr_status || "—",
                        payment_status: c.payment_status || "Pending Payment",
                        processingStatus: c.payment_status || "Pending Payment",
                        hr_reviewed_at: c.hr_reviewed_at,
                        employee_request_date: c.employee_request_date,
                        ld_approval_date: c.ld_approval_date,
                        ceo_status_date: c.ceo_status_date,
                        created_at: c.created_at,
                        description: c.description,
                        whyLearn: c.description || "Course purchased and added to catalog for organizational learning and development.",
                        rejection_reason: c.rejection_reason || c.reject_reason || c.comment || c.comments || c.reopen_reason || null,
                        stages: c.stages || [],
                        paid_on: c.paid_on || null,
                        payment_code: c.payment_code || null,
                        payment_slip_path: c.payment_slip_path || null,
                        payment_slip_name: c.payment_slip_name || null,
                        payment_description: c.payment_description || null,
                        raw: c
                    };
                });
                setCourseRequests(mapped);
            }
        } catch (err) {
            console.warn("[ApprovalsWorkflow] Error loading courses:", err);
            setCourseRequests([]);
        }
    };

    // Fetch live certification reimbursement claims from backend
    const fetchCertRequests = async (customDeptMap, customEmpIdMap) => {
        const activeDeptMap = customDeptMap || deptMapRef.current || {};
        const activeEmpIdMap = customEmpIdMap || empIdMapRef.current || {};
        try {
            const res = await axios.get(`${API_BASE_URL}/api/reimbursements/claims`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                // Filter only claims that are authorized for HR review:
                // Exclude claims whose upfront certification request is still Pending CEO/L&D approval or Rejected
                const validClaims = res.data.filter((r) => {
                    const isPendingOrRejectedUpfront = r.is_management_approved === false || r.cr_status === "Pending" || r.cr_status === "Rejected";
                    return !isPendingOrRejectedUpfront;
                });

                const mapped = validClaims.map((r, idx) => {
                    const empName = r.employee_name || `Employee ${r.employee_id}`;
                    const initials = empName
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();

                    const reqDate = r.submitted_on || r.created_at
                        ? new Date(r.submitted_on || r.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        })
                        : "Today";

                    const dept =
                        r.department ||
                        r.employee_department ||
                        activeDeptMap[empName.trim().toLowerCase()] ||
                        activeDeptMap[String(r.employee_id || "").trim().toLowerCase()] ||
                        "—";

                    const resolvedEmpId =
                        r.employee_id ||
                        r.emp_id ||
                        r.employeeId ||
                        activeEmpIdMap[empName.trim().toLowerCase()] ||
                        "";

                    return {
                        id: r.claim_code || `CLM-${r.id || idx + 1}`,
                        claimId: r.id,
                        requestId: r.id,
                        name: empName,
                        empId: resolvedEmpId,
                        employeeId: resolvedEmpId,
                        employee_id: resolvedEmpId,
                        title: dept,
                        department: dept,
                        role: r.employee_role || "—",
                        initials: initials,
                        avatarBg: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#6366F1"][idx % 6],
                        course: r.certification_name,
                        courseName: r.certification_name,
                        requestDate: reqDate,
                        status: r.status || "—",
                        processingStatus: r.processing_status || "Submitted to HR",
                        amount: r.amount ? `₹${Number(r.amount).toLocaleString()}` : "₹0",
                        provider: r.provider_name || "—",
                        platform: r.provider_name || "—",
                        category: r.claim_type || "Certification",
                        scheduledExamDate: r.completion_exam_date || r.purchase_date,
                        whyLearn: "Certification reimbursement claim submitted for completed examination.",
                        rejection_reason: r.rejection_reason || r.reject_reason || r.comment || r.comments || r.reopen_reason || null,
                        is_ceo_bypassed: r.is_ceo_bypassed || false,
                        stages: r.stages || [],
                        paid_on: r.paid_on || null,
                        payment_code: r.payment_code || null,
                        payment_slip_path: r.payment_slip_path || null,
                        payment_slip_name: r.payment_slip_name || null,
                        payment_description: r.payment_description || null,
                        raw: r
                    };
                });
                setCertRequests(mapped);
            } else {
                setCertRequests([]);
            }
        } catch (err) {
            console.warn("[ApprovalsWorkflow] Error fetching certification claims:", err);
            setCertRequests([]);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const loadAll = async () => {
            setIsLoading(true);
            try {
                const emps = await fetchAllEmployees().catch(() => []);
                const deptMap = {};
                const empIdMap = {};
                if (Array.isArray(emps)) {
                    emps.forEach((e) => {
                        const nameKey = (e.name || e.full_name || "").trim().toLowerCase();
                        const id = e.employee_id || e.id || "";
                        const idKey = String(id).trim().toLowerCase();
                        const dept = e.department || "";
                        if (nameKey && dept) deptMap[nameKey] = dept;
                        if (idKey && dept) deptMap[idKey] = dept;
                        if (nameKey && id) empIdMap[nameKey] = id;
                    });
                }
                deptMapRef.current = deptMap;
                empIdMapRef.current = empIdMap;
                await Promise.allSettled([fetchCourses(deptMap, empIdMap), fetchCertRequests(deptMap, empIdMap)]);
            } finally {
                setIsLoading(false);
            }
        };
        loadAll();
        return () => {
            isMounted = false;
        };
    }, []);

    // Current active list
    const currentList = requestType === "course" ? courseRequests : certRequests;

    // 3-second highlight for notification-targeted rows
    const { highlightedKey: highlightedItemId } = useNotificationRowHighlight({
        locationState: location.state,
        isReady: !isLoading,
        targetList: currentList,
        storageKey: "lms_completed_hr_aw_highlight_ts",
        onActivate: (state) => {
            if (state.highlightTab === "cert" || state.highlightTab === "course") {
                setRequestType(state.highlightTab);
            }
            setStatusFilter("All");
            setSearchQuery("");
            setCourseFilters({ departments: ["All"], reqStartDate: "", reqEndDate: "" });
            setCertFilters({ departments: ["All"], amountRange: null, reqStartDate: "", reqEndDate: "" });
        },
    });

    // Available Departments for Course Reimbursement
    const availableCourseDepartments = useMemo(() => {
        const set = new Set();
        (courseRequests || []).forEach((r) => {
            const d = r.department || r.title;
            if (d && d !== "—") set.add(d);
        });
        return Array.from(set).sort();
    }, [courseRequests]);

    // Available Departments for Certification Reimbursement
    const availableCertDepartments = useMemo(() => {
        const set = new Set();
        (certRequests || []).forEach((r) => {
            const d = r.department || r.title;
            if (d && d !== "—") set.add(d);
        });
        return Array.from(set).sort();
    }, [certRequests]);

    // Available Employees for Course Reimbursement
    const availableCourseEmployees = useMemo(() => {
        const set = new Set();
        (courseRequests || []).forEach((r) => {
            const name = r.name || r.employee_name;
            if (name && name !== "—") set.add(name);
        });
        return Array.from(set).sort();
    }, [courseRequests]);

    // Available Courses for Course Reimbursement
    const availableCourses = useMemo(() => {
        const set = new Set();
        (courseRequests || []).forEach((r) => {
            const c = r.course || r.courseName;
            if (c && c !== "—") set.add(c);
        });
        return Array.from(set).sort();
    }, [courseRequests]);

    // Available Employees for Certification Reimbursement
    const availableCertEmployees = useMemo(() => {
        const set = new Set();
        (certRequests || []).forEach((r) => {
            const name = r.name || r.employee_name;
            if (name && name !== "—") set.add(name);
        });
        return Array.from(set).sort();
    }, [certRequests]);

    // Available Certifications for Certification Reimbursement
    const availableCertifications = useMemo(() => {
        const set = new Set();
        (certRequests || []).forEach((r) => {
            const c = r.course || r.courseName;
            if (c && c !== "—") set.add(c);
        });
        return Array.from(set).sort();
    }, [certRequests]);

    // Amount limits for Certifications dynamically from records
    const certAmountLimits = useMemo(() => {
        const list = (certRequests || [])
            .map((r) => Number(r.raw?.amount || parseFloat(String(r.amount || "").replace(/[^0-9.]/g, "")) || 0))
            .filter((n) => n > 0);
        const max = list.length ? Math.max(...list) : 10000;
        const step = max <= 2000 ? 50 : max <= 10000 ? 100 : max <= 50000 ? 500 : 1000;
        return { min: 0, max, step };
    }, [certRequests]);

    // Helper functions for date range comparison
    const parseApprovalsDate = (val) => {
        if (!val || val === "—" || val === "Pending" || val === "Recent" || val === "Approved" || val === "Today") return null;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        if (typeof val === "string") {
            const trimmed = val.trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
                const d = new Date(trimmed.slice(0, 10));
                return isNaN(d.getTime()) ? null : d;
            }
            const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (dmyMatch) {
                const d = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
                return isNaN(d.getTime()) ? null : d;
            }
            const parsed = new Date(trimmed);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        return null;
    };

    const isDateInRange = (itemDateVal, startIso, endIso) => {
        if (!startIso && !endIso) return true;
        const itemDate = parseApprovalsDate(itemDateVal);
        if (!itemDate) return false;
        const itemTime = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

        if (startIso) {
            const startDate = parseApprovalsDate(startIso);
            if (startDate) {
                const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
                if (itemTime < startTime) return false;
            }
        }
        if (endIso) {
            const endDate = parseApprovalsDate(endIso);
            if (endDate) {
                const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
                if (itemTime > endTime) return false;
            }
        }
        return true;
    };

    // Active drawer filter counts
    const courseActiveFiltersCount = useMemo(() => {
        let count = 0;
        const hasDept =
            !courseFilters.departments.includes("All") &&
            !courseFilters.departments.includes("All Departments") &&
            courseFilters.departments.length > 0;
        if (hasDept) count += 1;
        if (courseFilters.reqStartDate || courseFilters.reqEndDate) count += 1;
        return count;
    }, [courseFilters]);

    const certActiveFiltersCount = useMemo(() => {
        let count = 0;
        const hasDept =
            !certFilters.departments.includes("All") &&
            !certFilters.departments.includes("All Departments") &&
            certFilters.departments.length > 0;
        if (hasDept) count += 1;
        const isAmountActive =
            Boolean(certFilters.amountRange) &&
            (certFilters.amountRange[0] > certAmountLimits.min ||
                certFilters.amountRange[1] < certAmountLimits.max);
        if (isAmountActive) count += 1;

        if (certFilters.reqStartDate || certFilters.reqEndDate) count += 1;
        return count;
    }, [certFilters, certAmountLimits]);

    // Clear filter handlers
    const handleClearCourseFilters = () => {
        setCourseFilters({
            departments: ["All"],
            reqStartDate: "",
            reqEndDate: "",
        });
    };

    const handleClearCertFilters = () => {
        setCertFilters({
            departments: ["All"],
            amountRange: [certAmountLimits.min, certAmountLimits.max],
            reqStartDate: "",
            reqEndDate: "",
        });
    };

    // Helper to detect if course / claim reimbursement has already been paid
    const isItemPaid = (item) => Boolean(
        !item ? false : (
            String(item.payment_status || item.processingStatus || item.processing_status || item.raw?.payment_status || item.raw?.processing_status || "").toLowerCase() === "paid" ||
            item.status === "Paid" ||
            item.raw?.status === "Paid" ||
            item.paid_on ||
            item.payment_code ||
            item.payment_slip_path ||
            item.raw?.paid_on ||
            item.raw?.payment_code ||
            item.raw?.payment_slip_path
        )
    );

    // Computed Counts for Sub-Tabs
    const pendingCount = useMemo(
        () => currentList.filter((item) => item.status === "Pending").length,
        [currentList]
    );

    const approvedCount = useMemo(
        () => currentList.filter((item) => item.status === "Approved" || isItemPaid(item)).length,
        [currentList]
    );

    const rejectedCount = useMemo(
        () => currentList.filter((item) => item.status === "Rejected").length,
        [currentList]
    );

    // Filtered Table List (Status Filter + Search Query + Drawer Filters)
    const filteredList = useMemo(() => {
        let list = currentList;
        if (statusFilter !== "All") {
            if (statusFilter === "Approved") {
                list = list.filter((item) => item.status === "Approved" || isItemPaid(item));
            } else {
                list = list.filter((item) => item.status === statusFilter);
            }
        }

        const q = (searchQuery || "").trim().toLowerCase();
        if (q) {
            const normQ = q.replace(/[-_\s]+/g, "");
            list = list.filter((item) => {
                const rawReqId = String(
                    item.id ||
                    item.claim_id ||
                    item.claim_code ||
                    item.course_request_code ||
                    item.requestId ||
                    ""
                ).toLowerCase();
                const normReqId = rawReqId.replace(/[-_\s]+/g, "");

                const empName = String(
                    item.name ||
                    item.employee ||
                    item.employee_name ||
                    item.raw?.employee_name ||
                    ""
                ).toLowerCase();

                const courseOrCert = String(
                    item.course ||
                    item.courseName ||
                    item.certification ||
                    item.certificate ||
                    item.raw?.course_title ||
                    item.raw?.certification_name ||
                    ""
                ).toLowerCase();

                const empId = String(
                    item.empId ||
                    item.employeeId ||
                    item.employee_id ||
                    item.raw?.employee_id ||
                    ""
                ).toLowerCase();
                const normEmpId = empId.replace(/[-_\s]+/g, "");

                const dept = String(
                    item.department ||
                    item.title ||
                    ""
                ).toLowerCase();

                return (
                    rawReqId.includes(q) ||
                    (normQ && normReqId.includes(normQ)) ||
                    empName.includes(q) ||
                    empId.includes(q) ||
                    (normQ && normEmpId.includes(normQ)) ||
                    dept.includes(q) ||
                    courseOrCert.includes(q)
                );
            });
        }

        if (requestType === "course") {
            // Department filter
            const hasDept =
                !courseFilters.departments.includes("All") &&
                !courseFilters.departments.includes("All Departments") &&
                courseFilters.departments.length > 0;
            if (hasDept) {
                const itemDept = (item.department || item.title || "").trim().toLowerCase();
                if (!courseFilters.departments.some((d) => d.trim().toLowerCase() === itemDept)) {
                    return false;
                }
            }

            // Request Date filter
            if (courseFilters.reqStartDate || courseFilters.reqEndDate) {
                list = list.filter((item) => {
                    const rawDate = item.raw?.created_at || item.requestDate;
                    return isDateInRange(rawDate, courseFilters.reqStartDate, courseFilters.reqEndDate);
                });
            }
        } else {
            // Department filter
            const hasDept =
                !certFilters.departments.includes("All") &&
                !certFilters.departments.includes("All Departments") &&
                certFilters.departments.length > 0;
            if (hasDept) {
                const itemDept = (item.department || item.title || "").trim().toLowerCase();
                if (!certFilters.departments.some((d) => d.trim().toLowerCase() === itemDept)) {
                    return false;
                }
            }

            // Amount filter (slider)
            const [minCost, maxCost] = certFilters.amountRange || [certAmountLimits.min, certAmountLimits.max];
            if (certFilters.amountRange) {
                list = list.filter((item) => {
                    const cost = Number(
                        item.raw?.amount ||
                        parseFloat(String(item.amount || "").replace(/[^0-9.]/g, "")) ||
                        0
                    );
                    if (maxCost >= certAmountLimits.max) {
                        return cost >= minCost;
                    }
                    return cost >= minCost && cost <= maxCost;
                });
            }

            // Request Date filter
            if (certFilters.reqStartDate || certFilters.reqEndDate) {
                list = list.filter((item) => {
                    const rawDate = item.raw?.submitted_on || item.raw?.created_at || item.requestDate;
                    return isDateInRange(rawDate, certFilters.reqStartDate, certFilters.reqEndDate);
                });
            }
        }

        return list;
    }, [
        currentList,
        statusFilter,
        searchQuery,
        requestType,
        courseFilters,
        certFilters,
        certAmountLimits
    ]);

    // Live Metrics for KPI Cards (Unified Enterprise Totals across Course & Cert Requests)
    const liveStats = useMemo(() => {
        if (isLoading) {
            return [
                { key: "pending", label: "Total Pending Approvals", value: null },
                { key: "courseReq", label: "Total Course Requests", value: null },
                { key: "certReq", label: "Total Certification Requests", value: null },
                { key: "approved", label: "Total Approved", value: null },
            ];
        }

        const coursePending = courseRequests.filter((c) => (c.status || "Pending") === "Pending").length;
        const certPending = certRequests.filter((c) => (c.status || "Pending") === "Pending").length;
        const totalPending = coursePending + certPending;

        const courseApproved = courseRequests.filter((c) => c.status === "Approved" || isItemPaid(c)).length;
        const certApproved = certRequests.filter((c) => c.status === "Approved" || isItemPaid(c)).length;
        const totalApproved = courseApproved + certApproved;

        const totalCourses = courseRequests.length;
        const totalCerts = certRequests.length;

        return [
            {
                key: "pending",
                label: "Total Pending Approvals",
                value: String(totalPending),
                change: "+12%",
                isPositive: true,
            },
            {
                key: "courseReq",
                label: "Total Course Requests",
                value: String(totalCourses),
                change: "+8%",
                isPositive: true,
            },
            {
                key: "certReq",
                label: "Total Certification Requests",
                value: String(totalCerts),
                change: "+15%",
                isPositive: true,
            },
            {
                key: "approved",
                label: "Total Approved",
                value: String(totalApproved),
                change: "+20%",
                isPositive: true,
            },
        ];
    }, [courseRequests, certRequests, isLoading]);

    // Handle Approve (HR Accept)
    const inFlightDecisionsRef = useRef(new Set());

    const handleApprove = async (item) => {
        const lockKey = `${requestType}:${item.course_id || item.claimId || item.raw?.id || item.id}`;
        if (inFlightDecisionsRef.current.has(lockKey)) return;
        inFlightDecisionsRef.current.add(lockKey);

        try {
            if (requestType === "course") {
                const courseId = item.course_id;
                setCourseRequests((prev) =>
                    prev.map((req) =>
                        (courseId && req.course_id === courseId) || req.id === item.id
                            ? { ...req, status: "Approved", hr_reviewed_at: new Date().toISOString() }
                            : req
                    )
                );

                if (courseId) {
                    try {
                        await axios.patch(`${API_BASE_URL}/api/courses/${courseId}/hr-review`, {
                            hr_status: "Approved",
                            hr_employee_id: user?.employee_id || "EMP005",
                            hr_email: user?.email,
                        });
                        fetchCourses();
                    } catch (err) {
                        console.error("[ApprovalsWorkflow] Error approving course reimbursement claim:", err);
                    }
                }
            } else {
                const claimId = item.claimId || item.raw?.id;
                setCertRequests((prev) =>
                    prev.map((req) =>
                        (claimId && (req.claimId === claimId || req.raw?.id === claimId)) || req.id === item.id
                            ? { ...req, status: "Approved", processingStatus: "Approved", processing_status: "Approved" }
                            : req
                    )
                );

                if (claimId) {
                    try {
                        await axios.post(`${API_BASE_URL}/api/reimbursements/claims/${claimId}/hr-decision`, {
                            status: "Approved",
                            admin_id: user?.employee_id || "EMP005",
                            comments: "Approved by HR"
                        });
                        fetchCertRequests();
                    } catch (err) {
                        console.error("[ApprovalsWorkflow] Error approving reimbursement claim:", err);
                    }
                }
            }
        } finally {
            inFlightDecisionsRef.current.delete(lockKey);
        }
    };

    // Handle Reject (Opens Reason for Rejection Modal)
    const handleReject = (item) => {
        setRejectTarget(item);
    };

    // Confirmed Reject with User-Supplied Reason
    const handleConfirmReject = async (reason) => {
        if (!rejectTarget) return;
        const item = rejectTarget;
        const lockKey = `${requestType}:${item.course_id || item.claimId || item.raw?.id || item.id}`;
        if (inFlightDecisionsRef.current.has(lockKey)) return;
        inFlightDecisionsRef.current.add(lockKey);
        setIsRejecting(true);

        try {
            if (requestType === "course") {
                const courseId = item.course_id;
                setCourseRequests((prev) =>
                    prev.map((req) =>
                        (courseId && req.course_id === courseId) || req.id === item.id
                            ? { ...req, status: "Rejected", hr_reviewed_at: new Date().toISOString(), rejection_reason: reason }
                            : req
                    )
                );

                if (courseId) {
                    try {
                        await axios.patch(`${API_BASE_URL}/api/courses/${courseId}/hr-review`, {
                            hr_status: "Rejected",
                            hr_employee_id: user?.employee_id || "EMP005",
                            hr_email: user?.email,
                            rejection_reason: reason,
                            comment: reason,
                        });
                        fetchCourses();
                    } catch (err) {
                        console.error("[ApprovalsWorkflow] Error rejecting course reimbursement claim:", err);
                    }
                }
            } else {
                const claimId = item.claimId || item.raw?.id;
                setCertRequests((prev) =>
                    prev.map((req) =>
                        (claimId && (req.claimId === claimId || req.raw?.id === claimId)) || req.id === item.id
                            ? { ...req, status: "Rejected", processingStatus: "Rejected", rejection_reason: reason }
                            : req
                    )
                );

                if (claimId) {
                    try {
                        await axios.post(`${API_BASE_URL}/api/reimbursements/claims/${claimId}/hr-decision`, {
                            status: "Rejected",
                            admin_id: user?.employee_id || "EMP005",
                            comments: reason,
                            rejection_reason: reason,
                        });
                    } catch (err) {
                        console.error("[ApprovalsWorkflow] Error rejecting reimbursement claim:", err);
                    }
                }
            }

            setRejectTarget(null);
            setSelectedApproval(null);
            setToast({
                isOpen: true,
                type: "success",
                message: `Request ${item.id || item.claim_id || item.requestId || ""} has been rejected.`,
            });
        } catch (err) {
            console.error("Error rejecting request in ApprovalsWorkflow:", err);
            setToast({
                isOpen: true,
                type: "error",
                message: "Failed to reject request. Please try again.",
            });
        } finally {
            inFlightDecisionsRef.current.delete(lockKey);
            setIsRejecting(false);
        }
    };

    // Open View Modal
    const handleViewDetails = (item) => {
        setSelectedApproval(item);
    };

    return (
        <div className="hr-approvals-workflow-page">
            {/* 1. Page Header */}
            <PageHeader
                title="Approvals & Workflow Management"
                subtitle="Review, authorize, and disburse certification reimbursements and employee course requests."
            />

            {/* 2. Top Metric Cards (4 KPI Cards) */}
            <ApprovalStatsCards stats={liveStats} />

            {/* 3. Controls Row (Type Pills & History Button) */}
            <div className="hr-aw-controls-row">
                <div className="hr-aw-type-pills">
                    <button
                        type="button"
                        className={`hr-aw-type-pill ${requestType === "course" ? "active" : ""}`}
                        onClick={() => {
                            setRequestType("course");
                            setStatusFilter("All");
                            setSearchQuery("");
                            setIsCertDrawerOpen(false);
                            handleClearCertFilters();
                        }}
                    >
                        Course Reimbursement
                    </button>
                    <button
                        type="button"
                        className={`hr-aw-type-pill ${requestType === "cert" ? "active" : ""}`}
                        onClick={() => {
                            setRequestType("cert");
                            setStatusFilter("All");
                            setSearchQuery("");
                            setIsCourseDrawerOpen(false);
                            handleClearCourseFilters();
                        }}
                    >
                        Certification Reimbursement
                    </button>
                </div>
            </div>

            {/* 4. Search Bar Row (Directly below Course / Certification Reimbursement tabs) */}
            <div className="hr-aw-search-row">
                <div className="hr-aw-search-box">
                    <img src={searchIcon} alt="" className="hr-aw-search-icon" />
                    <input
                        type="text"
                        placeholder={
                            requestType === "course"
                                ? "Search by Request id, employee id/name or course"
                                : "Search by Request id, employee id/name or certification"
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(sanitizeSingleSpaceInput(e.target.value))}
                        className="hr-aw-search-input"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="hr-aw-clear-search-btn"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                            title="Clear search"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* 5. Status Filter Sub-Tabs & Filter Button Row */}
            <div className="hr-aw-status-tabs-row">
                <div className="hr-aw-status-tabs">
                    <button
                        type="button"
                        className={`hr-aw-status-tab ${statusFilter === "All" ? "active" : ""}`}
                        onClick={() => setStatusFilter("All")}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        className={`hr-aw-status-tab ${statusFilter === "Pending" ? "active" : ""}`}
                        onClick={() => setStatusFilter("Pending")}
                    >
                        Pending ({pendingCount})
                    </button>
                    <button
                        type="button"
                        className={`hr-aw-status-tab ${statusFilter === "Approved" ? "active" : ""}`}
                        onClick={() => setStatusFilter("Approved")}
                    >
                        Approved ({approvedCount})
                    </button>
                    <button
                        type="button"
                        className={`hr-aw-status-tab ${statusFilter === "Rejected" ? "active" : ""}`}
                        onClick={() => setStatusFilter("Rejected")}
                    >
                        Rejected ({rejectedCount})
                    </button>
                </div>

                {/* Right controls: Filters button */}
                <div className="hr-aw-status-filter-wrap">
                    {requestType === "course" ? (
                        <button
                            type="button"
                            className={`hr-filter-btn ${courseActiveFiltersCount > 0 || isCourseDrawerOpen ? "filtered" : ""}`}
                            onClick={() => setIsCourseDrawerOpen(true)}
                            aria-label="Open Course Reimbursement Filters"
                        >
                            <img src={filtersIcon} alt="" style={{ width: 14, height: 10 }} />
                            <span>{courseActiveFiltersCount > 0 ? `Filters (${courseActiveFiltersCount})` : "Filters"}</span>
                            {courseActiveFiltersCount > 0 && (
                                <span
                                    className="hr-clear-cross"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearCourseFilters();
                                    }}
                                    title="Clear filters"
                                >
                                    ×
                                </span>
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={`hr-filter-btn ${certActiveFiltersCount > 0 || isCertDrawerOpen ? "filtered" : ""}`}
                            onClick={() => setIsCertDrawerOpen(true)}
                            aria-label="Open Certification Reimbursement Filters"
                        >
                            <img src={filtersIcon} alt="" style={{ width: 14, height: 10 }} />
                            <span>{certActiveFiltersCount > 0 ? `Filters (${certActiveFiltersCount})` : "Filters"}</span>
                            {certActiveFiltersCount > 0 && (
                                <span
                                    className="hr-clear-cross"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearCertFilters();
                                    }}
                                    title="Clear filters"
                                >
                                    ×
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* 5. Approvals Table Card (Delegated to dedicated component) */}
            {requestType === "course" ? (
                <CourseRequestsTab
                    requests={filteredList}
                    statusFilter={statusFilter}
                    isLoading={isLoading}
                    highlightedItemId={highlightedItemId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewDetails={handleViewDetails}
                />
            ) : (
                <CertificationRequestsTab
                    requests={filteredList}
                    statusFilter={statusFilter}
                    isLoading={isLoading}
                    highlightedItemId={highlightedItemId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewDetails={handleViewDetails}
                    onPaySuccess={(updated) => {
                        // Optimistically update the row's processing_status to Paid, then re-fetch
                        if (updated?.id) {
                            setCertRequests((prev) =>
                                prev.map((req) =>
                                    req.raw?.id === updated.id || req.claimId === updated.id
                                        ? { ...req, processingStatus: "Paid", processing_status: "Paid", raw: { ...req.raw, processing_status: "Paid" } }
                                        : req
                                )
                            );
                        }
                        fetchCertRequests();
                        setSelectedApproval(null);
                        setToast({
                            isOpen: true,
                            type: "success",
                            message: `Payment slip uploaded successfully for claim ${updated?.claim_code || ""}.`,
                        });
                    }}
                />
            )}

            {/* 6. Course Approval Details Modal (With border & view info) */}
            <ApprovalDetailsModal
                approval={selectedApproval}
                requestType={requestType}
                onClose={() => setSelectedApproval(null)}
                onApprove={handleApprove}
                onReject={handleReject}
                onPaySuccess={(updated) => {
                    if (updated?.course_id) {
                        const nowIso = new Date().toISOString();
                        setCourseRequests((prev) =>
                            prev.map((req) =>
                                req.course_id === updated.course_id || req.raw?.id === updated.course_id
                                    ? {
                                        ...req,
                                        payment_status: "Paid",
                                        processingStatus: "Paid",
                                        paid_on: updated.paid_on || nowIso,
                                        payment_code: updated.payment_code || req.payment_code,
                                        payment_slip_path: updated.payment_slip_path,
                                        payment_slip_name: updated.payment_slip_name,
                                        payment_description: updated.payment_description,
                                        raw: {
                                            ...req.raw,
                                            payment_status: "Paid",
                                            paid_on: updated.paid_on || nowIso,
                                            payment_code: updated.payment_code || req.raw?.payment_code,
                                            payment_slip_path: updated.payment_slip_path,
                                            payment_slip_name: updated.payment_slip_name,
                                            payment_description: updated.payment_description
                                        }
                                    }
                                    : req
                            )
                        );
                        fetchCourses();
                        setSelectedApproval(null);
                        setToast({
                            isOpen: true,
                            type: "success",
                            message: `Payment slip uploaded successfully for Course. Record #${updated.payment_code || ""} saved.`,
                        });
                    } else {
                        const nowIso = new Date().toISOString();
                        if (updated?.id) {
                            setCertRequests((prev) =>
                                prev.map((req) =>
                                    req.raw?.id === updated.id || req.claimId === updated.id
                                        ? {
                                            ...req,
                                            processingStatus: "Paid",
                                            processing_status: "Paid",
                                            paid_on: nowIso,
                                            payment_code: updated.payment_code || req.payment_code,
                                            payment_slip_path: updated.payment_slip_path,
                                            raw: {
                                                ...req.raw,
                                                processing_status: "Paid",
                                                paid_on: nowIso,
                                                payment_code: updated.payment_code || req.raw?.payment_code,
                                                payment_slip_path: updated.payment_slip_path
                                            }
                                        }
                                        : req
                                )
                            );
                        }
                        fetchCertRequests();
                        setSelectedApproval(null);
                        setToast({
                            isOpen: true,
                            type: "success",
                            message: `Payment slip uploaded successfully for claim ${updated?.claim_code || ""}. Record #${updated?.payment_code || ""} saved.`,
                        });
                    }
                }}
            />

            {/* 7. Reason for Rejection Modal */}
            <RejectRequestModal
                isOpen={Boolean(rejectTarget)}
                onClose={() => !isRejecting && setRejectTarget(null)}
                onConfirm={handleConfirmReject}
                targetItem={rejectTarget}
                isSubmitting={isRejecting}
            />

            {/* Top Toast Notification */}
            <TopToastNotification
                isOpen={toast.isOpen}
                type={toast.type}
                message={toast.message}
                onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
            />

            {/* Filter Drawers */}
            <HRCourseFilterDrawer
                isOpen={isCourseDrawerOpen}
                onClose={() => setIsCourseDrawerOpen(false)}
                departments={availableCourseDepartments}
                selectedDepartments={courseFilters.departments}
                selectedReqStartDate={courseFilters.reqStartDate}
                selectedReqEndDate={courseFilters.reqEndDate}
                onApply={(filters) => {
                    setCourseFilters(filters);
                }}
                onClearAll={handleClearCourseFilters}
            />

            <HRCertificationFilterDrawer
                isOpen={isCertDrawerOpen}
                onClose={() => setIsCertDrawerOpen(false)}
                departments={availableCertDepartments}
                selectedDepartments={certFilters.departments}
                amountLimits={certAmountLimits}
                selectedAmountRange={certFilters.amountRange || [certAmountLimits.min, certAmountLimits.max]}
                selectedReqStartDate={certFilters.reqStartDate}
                selectedReqEndDate={certFilters.reqEndDate}
                onApply={(filters) => {
                    setCertFilters(filters);
                }}
                onClearAll={handleClearCertFilters}
            />
        </div>
    );
}
