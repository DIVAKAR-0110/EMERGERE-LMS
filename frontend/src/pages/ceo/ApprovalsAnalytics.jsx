import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import useNotificationRowHighlight from "../../hooks/useNotificationRowHighlight";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";
import LearningReportBanner from "../../components/ceo/ApprovalsAnalytics/LearningReportBanner";
import CourseRequestsTab from "../../components/ceo/ApprovalsAnalytics/CourseRequestsTab";
import CertificationRequestsTab from "../../components/ceo/ApprovalsAnalytics/CertificationRequestsTab";
import ApprovalHistoryModal from "../../components/ceo/ApprovalsAnalytics/ApprovalHistoryModal";
import ApprovalDetailsModal from "../../components/ceo/ApprovalsAnalytics/ApprovalDetailsModal";
import RejectRequestModal from "../../components/ceo/ApprovalsAnalytics/RejectRequestModal";
import DownloadReportModal from "../../components/ceo/ApprovalsAnalytics/DownloadReportModal";
import DownloadSuccessModal from "../../components/ceo/analyticsexpenditure/DownloadSuccessModal";
import TopToastNotification from "../../components/common/TopToastNotification";
import { exportToCSV, exportToExcel, exportToPDF } from "../../utils/reportExportUtil";

import { RANK_COLORS } from "../../services/leaderboardService.js";

import clockIcon from "../../assets/Approvals & Workflow/clock.svg";
import searchIcon from "../../assets/course_library/search.svg";
import filtersIcon from "../../assets/coursemanagement/filters.svg";
import { sanitizeSingleSpaceInput } from "../../utils/validationUtils";
import CourseRequestsFilterDrawer from "../../components/L&D/ApprovalsWorkflow/CourseRequestsFilterDrawer";
import CertificationRequestsFilterDrawer from "../../components/L&D/ApprovalsWorkflow/CertificationRequestsFilterDrawer";
import "../../styles/ceo/ApprovalsAnalytics.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function CEOApprovalsAnalytics() {
    const { user } = useAuth();
    const location = useLocation();
    const currentAdminId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "EMP001";

    // Active request type pill: 'course' | 'cert'
    const [requestType, setRequestType] = useState(
        location.state?.highlightTab === "cert" ? "cert" : "course"
    );

    // Status filter: 'All' | 'Pending' | 'Approved' | 'Rejected'
    const [statusFilter, setStatusFilter] = useState("All");

    // Search Query (Search Request ID, Employee ID, Employee Name, Course/Certification)
    const [searchQuery, setSearchQuery] = useState("");

    // Course and Certification data state
    const [courseRequests, setCourseRequests] = useState([]);
    const [certRequests, setCertRequests] = useState([]);
    const [courseFetched, setCourseFetched] = useState(false);
    const [certFetched, setCertFetched] = useState(false);

    // Modals
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isDownloadSuccessOpen, setIsDownloadSuccessOpen] = useState(false);

    // Rejection Modal State
    const [rejectTarget, setRejectTarget] = useState(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const [toast, setToast] = useState({ isOpen: false, type: "success", message: "" });

    const getEmpId = (r, name) => {
        if (r.employee_id) return r.employee_id;
        if (r.employee_code) return r.employee_code;
        const nk = (name || r.employee_name || "").trim().toLowerCase();
        if (nk === "imran khan") return "EMP019";
        if (nk === "vikram malhotra") return "EMP010";
        if (nk === "ms") return "EMP089";
        if (nk === "abc qwer") return "EMP022";
        if (nk === "harini swaminathan") return "EMP018";
        if (nk === "nivash") return "EMP011";
        if (nk === "samantha") return "EMP043";
        if (nk === "suresh menon") return "EMP001";
        return "";
    };

    // Fetch live requests from database that have been approved by L&D
    const fetchCEOCourseRequests = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/course-requests`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                // CEO reviews requests that passed L&D (ld_status === 'Approved')
                const ceoEligible = res.data.filter((r) => r.ld_status === "Approved");
                if (ceoEligible.length > 0) {
                    const mapped = ceoEligible.map((r, idx) => {
                        const initials = (r.employee_name || "EM")
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                        const reqDate = r.created_at
                            ? new Date(r.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                            })
                            : "15 Dec 2025";

                        const deptOrRole = (r.department && r.department.toLowerCase() !== "employee")
                            ? r.department
                            : (r.employee_role && r.employee_role.toLowerCase() !== "employee")
                                ? r.employee_role
                                : "Product Operations";

                        const empId = getEmpId(r, r.employee_name);

                        return {
                            id: r.request_code,
                            new_course_id: r.id,
                            name: r.employee_name,
                            empId: empId,
                            employeeId: empId,
                            title: deptOrRole,
                            department: deptOrRole,
                            initials: initials,
                            avatarBg: RANK_COLORS[idx % RANK_COLORS.length],
                            course: r.course_name,
                            courseName: r.course_name,
                            requestDate: reqDate,
                            status: r.ceo_status || "—",
                            amount: r.price ? `₹${Number(r.price).toLocaleString()}` : "₹2,500",
                            platform: r.provider,
                            provider: r.provider,
                            category: r.category,
                            courseLink: r.course_link,
                            whyLearn: r.reason || "Course requested by employee for skill advancement.",
                            rejection_reason: r.rejection_reason || r.reject_reason || r.comment || r.comments || null,
                            claimId: r.request_code,
                            raw: r
                        };
                    });
                    setCourseRequests(mapped);
                }
            }
        } catch (err) {
            console.warn("[CEOApprovalsAnalytics] Error loading live course requests, using fallback:", err);
        } finally {
            setCourseFetched(true);
        }
    };

    // Fetch live certification requests that have been approved by L&D
    const fetchCEOCertRequests = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/certifications/requests`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                // CEO reviews certification requests that passed L&D (ld_status === 'Approved')
                const ceoEligible = res.data.filter((r) => r.ld_status === "Approved");
                if (ceoEligible.length > 0) {
                    const mapped = ceoEligible.map((r, idx) => {
                        const empName = r.employee_name || `Employee ${r.employee_id}`;
                        const initials = empName
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                        const reqDate = r.created_at
                            ? new Date(r.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                            })
                            : "15 Dec 2025";

                        const deptOrRole = r.department || "—";
                        const empId = getEmpId(r, empName);

                        return {
                            id: r.request_code || `CLM-2026-${String(r.id || idx + 1).padStart(4, "0")}`,
                            requestId: r.id,
                            new_course_id: r.id,
                            name: empName,
                            empId: empId,
                            employeeId: empId,
                            title: deptOrRole,
                            department: deptOrRole,
                            initials: initials,
                            avatarBg: RANK_COLORS[idx % RANK_COLORS.length],
                            course: r.certification_name,
                            courseName: r.certification_name,
                            requestDate: reqDate,
                            status: r.ceo_status || "—",
                            amount: r.estimated_cost_inr ? `₹${Number(r.estimated_cost_inr).toLocaleString()}` : "₹2,500",
                            platform: r.provider_name || "—",
                            provider: r.provider_name || "—",
                            category: r.category_name || "Certification",
                            scheduledExamDate: r.scheduled_exam_date,
                            whyLearn: r.purpose || "Certification requested for skill advancement.",
                            rejection_reason: r.rejection_reason || r.reject_reason || r.comment || r.comments || null,
                            claimId: r.request_code || `CLM-2026-${String(r.id || idx + 1).padStart(4, "0")}`,
                            isCertification: true,
                            type: "Certification",
                            raw: r
                        };
                    });
                    setCertRequests(mapped);
                } else {
                    setCertRequests([]);
                }
            } else {
                setCertRequests([]);
            }
        } catch (err) {
            console.warn("[CEOApprovalsAnalytics] Error loading live cert requests:", err);
            setCertRequests([]);
        } finally {
            setCertFetched(true);
        }
    };

    useEffect(() => {
        fetchCEOCourseRequests();
        fetchCEOCertRequests();
    }, []);

    // 3-second highlight for notification-targeted Course or Certification rows
    const { highlightedKey: highlightedItemId } = useNotificationRowHighlight({
        locationState: location.state,
        isReady: requestType === "cert" ? certFetched : courseFetched,
        targetList: requestType === "cert" ? certRequests : courseRequests,
        storageKey: "lms_completed_ceo_aw_highlight_ts",
        onActivate: (state) => {
            if (state.highlightTab === "cert" || state.highlightTab === "course") {
                setRequestType(state.highlightTab);
            }
            setStatusFilter("All");
        },
    });

    // Helper functions for date range comparison
    const parseApprovalsDate = (val) => {
        if (!val || val === "—" || val === "Pending" || val === "Recent" || val === "Approved") return null;
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

    // Filter Drawers State
    const [isCourseDrawerOpen, setIsCourseDrawerOpen] = useState(false);
    const [courseFilters, setCourseFilters] = useState({
        departments: ["All"],
        reqStartDate: "",
        reqEndDate: "",
    });

    const [isCertDrawerOpen, setIsCertDrawerOpen] = useState(false);
    const [certFilters, setCertFilters] = useState({
        departments: ["All"],
        amountRange: null,
        reqStartDate: "",
        reqEndDate: "",
    });

    // Current active list based on pill
    const currentList = requestType === "course" ? courseRequests : certRequests;

    // Available Departments
    const availableCourseDepartments = useMemo(() => {
        const set = new Set();
        (courseRequests || []).forEach((r) => {
            const d = r.department || r.title || r.raw?.department;
            if (d && d !== "—") set.add(d);
        });
        return Array.from(set).sort();
    }, [courseRequests]);

    const availableCertDepartments = useMemo(() => {
        const set = new Set();
        (certRequests || []).forEach((r) => {
            const d = r.department || r.title || r.raw?.department;
            if (d && d !== "—") set.add(d);
        });
        return Array.from(set).sort();
    }, [certRequests]);

    // Dynamic Amount Limits (for Certification Requests)
    const certAmountLimits = useMemo(() => {
        const list = (certRequests || [])
            .map((r) => Number(r.raw?.estimated_cost_inr || parseFloat(String(r.amount || "").replace(/[^0-9.]/g, "")) || 0))
            .filter((n) => n > 0);
        const max = list.length ? Math.max(...list) : 12500;
        const step = max <= 2000 ? 50 : max <= 10000 ? 100 : max <= 50000 ? 500 : 1000;
        return { min: 0, max, step };
    }, [certRequests]);

    // Active Drawer Filter Counts
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

    const handleClearCertFilters = () => {
        setCertFilters({
            departments: ["All"],
            amountRange: [certAmountLimits.min, certAmountLimits.max],
            reqStartDate: "",
            reqEndDate: "",
        });
    };

    const handleClearCourseFilters = () => {
        setCourseFilters({
            departments: ["All"],
            reqStartDate: "",
            reqEndDate: "",
        });
    };

    // Filter counts (dynamically reflects search & drawer filters, broken down by status tab)
    const baseListForCounts = useMemo(() => {
        return currentList.filter((item) => {
            // Search filter: Request ID, employee id, employee name, course/certification, department
            const q = (searchQuery || "").trim().toLowerCase();
            if (q) {
                const reqId = String(item.id || item.raw?.request_code || item.requestId || "").toLowerCase();
                const empName = String(item.name || item.employee || item.employeeName || item.raw?.employee_name || "").toLowerCase();
                const courseName = String(
                    item.course ||
                    item.courseName ||
                    item.certification ||
                    item.certName ||
                    item.raw?.course_name ||
                    item.raw?.certification_name ||
                    ""
                ).toLowerCase();
                const empId = String(item.empId || item.employeeId || item.raw?.employee_id || item.raw?.employee_code || "").toLowerCase();
                const dept = String(item.department || item.title || item.raw?.department || "").toLowerCase();

                const matchesSearch = reqId.includes(q) || empName.includes(q) || courseName.includes(q) || empId.includes(q) || dept.includes(q);
                if (!matchesSearch) return false;
            }

            if (requestType === "course") {
                const hasDept =
                    !courseFilters.departments.includes("All") &&
                    !courseFilters.departments.includes("All Departments") &&
                    courseFilters.departments.length > 0;
                if (hasDept) {
                    const d = item.department || item.title || item.raw?.department || "";
                    const match = courseFilters.departments.some(
                        (sel) => sel.toLowerCase() === d.toLowerCase()
                    );
                    if (!match) return false;
                }
                if (courseFilters.reqStartDate || courseFilters.reqEndDate) {
                    const rawDate = item.raw?.created_at || item.requestDate;
                    if (!isDateInRange(rawDate, courseFilters.reqStartDate, courseFilters.reqEndDate)) {
                        return false;
                    }
                }
            } else {
                const hasDept =
                    !certFilters.departments.includes("All") &&
                    !certFilters.departments.includes("All Departments") &&
                    certFilters.departments.length > 0;
                if (hasDept) {
                    const d = item.department || item.title || item.raw?.department || "";
                    const match = certFilters.departments.some(
                        (sel) => sel.toLowerCase() === d.toLowerCase()
                    );
                    if (!match) return false;
                }
                const [minCost, maxCost] = certFilters.amountRange || [certAmountLimits.min, certAmountLimits.max];
                const cost = Number(
                    item.raw?.estimated_cost_inr ||
                    parseFloat(String(item.amount || "").replace(/[^0-9.]/g, "")) ||
                    0
                );
                if (maxCost >= certAmountLimits.max) {
                    if (cost < minCost) return false;
                } else {
                    if (cost < minCost || cost > maxCost) return false;
                }
                if (certFilters.reqStartDate || certFilters.reqEndDate) {
                    const rawDate = item.raw?.created_at || item.requestDate;
                    if (!isDateInRange(rawDate, certFilters.reqStartDate, certFilters.reqEndDate)) {
                        return false;
                    }
                }
            }
            return true;
        });
    }, [
        currentList,
        requestType,
        searchQuery,
        courseFilters,
        certFilters,
        certAmountLimits,
    ]);

    const pendingCount = useMemo(
        () => baseListForCounts.filter((item) => item.status === "Pending").length,
        [baseListForCounts]
    );

    const approvedCount = useMemo(
        () => baseListForCounts.filter((item) => item.status === "Approved").length,
        [baseListForCounts]
    );

    const rejectedCount = useMemo(
        () => baseListForCounts.filter((item) => item.status === "Rejected").length,
        [baseListForCounts]
    );

    // Filtered list to display in table
    const filteredList = useMemo(() => {
        return currentList.filter((item) => {
            // Search filter: Request ID, employee id, employee name, course/certification, department
            const q = (searchQuery || "").trim().toLowerCase();
            if (q) {
                const reqId = String(item.id || item.raw?.request_code || item.requestId || "").toLowerCase();
                const empName = String(item.name || item.employee || item.employeeName || item.raw?.employee_name || "").toLowerCase();
                const courseName = String(
                    item.course ||
                    item.courseName ||
                    item.certification ||
                    item.certName ||
                    item.raw?.course_name ||
                    item.raw?.certification_name ||
                    ""
                ).toLowerCase();
                const empId = String(item.empId || item.employeeId || item.raw?.employee_id || item.raw?.employee_code || "").toLowerCase();
                const dept = String(item.department || item.title || item.raw?.department || "").toLowerCase();

                const matchesSearch = reqId.includes(q) || empName.includes(q) || courseName.includes(q) || empId.includes(q) || dept.includes(q);
                if (!matchesSearch) return false;
            }

            if (statusFilter !== "All" && item.status !== statusFilter) return false;

            if (requestType === "course") {
                const hasDept =
                    !courseFilters.departments.includes("All") &&
                    !courseFilters.departments.includes("All Departments") &&
                    courseFilters.departments.length > 0;
                if (hasDept) {
                    const d = item.department || item.title || item.raw?.department || "";
                    const match = courseFilters.departments.some(
                        (sel) => sel.toLowerCase() === d.toLowerCase()
                    );
                    if (!match) return false;
                }
                if (courseFilters.reqStartDate || courseFilters.reqEndDate) {
                    const rawDate = item.raw?.created_at || item.requestDate;
                    if (!isDateInRange(rawDate, courseFilters.reqStartDate, courseFilters.reqEndDate)) {
                        return false;
                    }
                }
            } else {
                const hasDept =
                    !certFilters.departments.includes("All") &&
                    !certFilters.departments.includes("All Departments") &&
                    certFilters.departments.length > 0;
                if (hasDept) {
                    const d = item.department || item.title || item.raw?.department || "";
                    const match = certFilters.departments.some(
                        (sel) => sel.toLowerCase() === d.toLowerCase()
                    );
                    if (!match) return false;
                }
                const [minCost, maxCost] = certFilters.amountRange || [certAmountLimits.min, certAmountLimits.max];
                const cost = Number(
                    item.raw?.estimated_cost_inr ||
                    parseFloat(String(item.amount || "").replace(/[^0-9.]/g, "")) ||
                    0
                );
                if (maxCost >= certAmountLimits.max) {
                    if (cost < minCost) return false;
                } else {
                    if (cost < minCost || cost > maxCost) return false;
                }
                if (certFilters.reqStartDate || certFilters.reqEndDate) {
                    const rawDate = item.raw?.created_at || item.requestDate;
                    if (!isDateInRange(rawDate, certFilters.reqStartDate, certFilters.reqEndDate)) {
                        return false;
                    }
                }
            }
            return true;
        });
    }, [
        currentList,
        statusFilter,
        requestType,
        searchQuery,
        courseFilters,
        certFilters,
        certAmountLimits,
    ]);

    // Derived dynamic history pipeline for Course Approval History
    const dynamicCourseApprovalHistory = useMemo(() => {
        const historyCourses = courseRequests.filter((req) => req.status === "Approved" || req.status === "Rejected");

        return historyCourses.map((req, idx) => {
            const raw = req.raw || {};
            const reqDateStr = raw.created_at ? raw.created_at.slice(0, 10) : req.requestDate || "15 Dec 2025";
            const rmDateStr = raw.notified_reporting_manager
                ? (typeof raw.notified_reporting_manager === "string" ? raw.notified_reporting_manager.slice(0, 10) : reqDateStr)
                : reqDateStr;
            const ldDateStr = raw.ld_status_date ? raw.ld_status_date.slice(0, 10) : reqDateStr;
            const isCeoApproved = req.status === "Approved";
            const isCeoRejected = req.status === "Rejected";
            const ceoDateStr = isCeoApproved
                ? (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved")
                : (isCeoRejected ? "Rejected" : "Pending");

            const isPurchased = raw.purchase_status === "Purchased";
            const purchaseDateStr = isCeoRejected
                ? "—"
                : isPurchased
                    ? (raw.purchase_date ? raw.purchase_date.slice(0, 10) : "Purchased")
                    : "Pending";

            const s4Status = isCeoRejected ? "rejected" : (isCeoApproved ? "completed" : "pending");
            const s5Status = isCeoRejected
                ? "rejected"
                : isPurchased
                    ? "completed_final"
                    : (isCeoApproved ? "pending" : "upcoming");

            return {
                id: req.id || `CLM-2026-001${2 + idx}`,
                new_course_id: req.new_course_id,
                uniqueId: `course-hist-${req.name || idx}-${req.id || idx}-${idx}`,
                course: req.course,
                courseName: req.courseName || req.course,
                employee: req.name,
                name: req.name,
                provider: req.provider || raw.provider || "—",
                platform: req.platform || req.provider || raw.provider || "—",
                category: req.category || raw.category || "—",
                courseCategory: req.category || raw.category || "—",
                courseLink: req.courseLink || raw.course_link || "—",
                whyLearn: req.whyLearn || raw.reason || "—",
                description: req.whyLearn || raw.reason || "—",
                amount: req.amount || (raw.price ? `₹${Number(raw.price).toLocaleString()}` : "₹2,500"),
                requestedOn: req.requestDate || "15 Dec 2025",
                requestDate: req.requestDate || "15 Dec 2025",
                status: req.status,
                raw: req.raw,
                steps: [
                    { label: "Employee Request", date: reqDateStr, done: true, status: "completed" },
                    { label: "Notified to RM", date: rmDateStr, done: true, status: "completed" },
                    { label: "L&D Approval", date: ldDateStr, done: true, status: "completed" },
                    {
                        label: raw.is_ceo_bypassed ? "Bypassed by L&D" : "CEO Approval",
                        date: ceoDateStr,
                        done: isCeoApproved,
                        status: s4Status
                    },
                    {
                        label: "Course Purchased",
                        date: purchaseDateStr,
                        done: isPurchased,
                        status: s5Status
                    },
                ],
            };
        });
    }, [courseRequests]);

    // Derived dynamic history pipeline for Certification Approval History
    const dynamicCertApprovalHistory = useMemo(() => {
        const historyCerts = certRequests.filter((req) => req.status === "Approved" || req.status === "Rejected");

        // const defaultAmounts = ["₹12,000", "₹8,000", "₹10,000", "₹15,000", "₹18,000"];

        return historyCerts.map((req, idx) => {
            const raw = req.raw || {};
            const reqDateStr = raw.created_at ? raw.created_at.slice(0, 10) : req.requestDate || "Error";
            const ldDateStr = raw.ld_status_date ? raw.ld_status_date.slice(0, 10) : reqDateStr;
            const isCeoApproved = req.status === "Approved";
            const isCeoRejected = req.status === "Rejected";
            const ceoDateStr = isCeoApproved
                ? (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved")
                : (isCeoRejected ? "Rejected" : "Pending");

            const isCertApproved = isCeoApproved || (raw.cert_status === "Approved" || raw.cert_stage_status === "Completed" || raw.status === "Approved");
            const certDateStr = isCeoRejected
                ? "-"
                : isCertApproved
                    ? (raw.cert_status_date ? raw.cert_status_date.slice(0, 10) : ceoDateStr)
                    : "-";

            const s4CertStatus = isCeoRejected ? "rejected" : (isCeoApproved ? "completed" : "pending");
            const s5CertStatus = isCeoRejected ? "rejected" : (isCertApproved ? "completed_final" : "upcoming");

            return {
                id: req.id || `CLM-2026-${String(idx + 1).padStart(4, "0")}`,
                uniqueId: `cert-hist-${req.name || idx}-${req.id || idx}-${idx}`,
                course: req.course,
                courseName: req.courseName || req.course,
                employee: req.name,
                name: req.name,
                platform: req.platform || "Error",
                provider: req.provider || req.platform,
                amount: req.amount || "$0",
                requestedOn: req.requestDate || "Error",
                requestDate: req.requestDate || "Error",
                status: req.status,
                steps: [
                    { label: "Employee Request", date: reqDateStr, done: true, status: "completed" },
                    { label: "Notified to RM", date: reqDateStr, done: true, status: "completed" },
                    { label: "L&D Approval", date: ldDateStr, done: true, status: "completed" },
                    {
                        label: raw.is_ceo_bypassed ? "Bypassed by L&D" : "CEO Approval",
                        date: ceoDateStr,
                        done: isCeoApproved,
                        status: s4CertStatus
                    },
                    {
                        label: "Certificate Approved",
                        date: certDateStr,
                        done: isCertApproved,
                        status: s5CertStatus
                    },
                ],
            };
        });
    }, [certRequests]);

    // Handle Approve
    const inFlightCeoDecisionsRef = useRef(new Set());

    const handleApprove = async (item) => {
        const lockKey = `${requestType}:${item.requestId || item.new_course_id || item.id}`;
        if (inFlightCeoDecisionsRef.current.has(lockKey)) return;
        inFlightCeoDecisionsRef.current.add(lockKey);

        try {
            if (requestType === "course") {
                try {
                    if (item.new_course_id) {
                        await axios.put(`${API_BASE_URL}/api/course-requests/${item.new_course_id}/ceo-approval`, {
                            status: "Approved",
                            admin_id: currentAdminId,
                        });
                    }
                } catch (err) {
                    console.error("Error approving CEO course request:", err);
                }
                setCourseRequests((prev) =>
                    prev.map((req) =>
                        req === item || req.id === item.id || req.new_course_id === item.new_course_id
                            ? { ...req, status: "Approved" }
                            : req
                    )
                );
            } else {
                const reqId = item.requestId || item.new_course_id || item.id;
                try {
                    if (reqId) {
                        await axios.put(`${API_BASE_URL}/api/certifications/requests/${reqId}/ceo-approval`, {
                            status: "Approved",
                            admin_id: currentAdminId,
                        });
                    }
                } catch (err) {
                    console.error("Error approving CEO certification request:", err);
                }
                const todayIso = new Date().toISOString();
                setCertRequests((prev) =>
                    prev.map((req) =>
                        req === item || req.id === item.id || req.requestId === reqId
                            ? {
                                ...req,
                                status: "Approved",
                                raw: {
                                    ...(req.raw || {}),
                                    ceo_status: "Approved",
                                    ceo_status_date: todayIso,
                                    cert_status: "Approved",
                                    cert_status_date: todayIso,
                                    status: "Approved"
                                }
                            }
                            : req
                    )
                );
            }
        } finally {
            inFlightCeoDecisionsRef.current.delete(lockKey);
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
        const lockKey = `${requestType}:${item.requestId || item.new_course_id || item.id}`;
        if (inFlightCeoDecisionsRef.current.has(lockKey)) return;
        inFlightCeoDecisionsRef.current.add(lockKey);
        setIsRejecting(true);

        try {
            if (requestType === "course") {
                try {
                    if (item.new_course_id) {
                        await axios.put(`${API_BASE_URL}/api/course-requests/${item.new_course_id}/ceo-approval`, {
                            status: "Rejected",
                            admin_id: currentAdminId,
                            comment: reason,
                            rejection_reason: reason,
                            comments: reason,
                        });
                    }
                } catch (err) {
                    console.error("Error rejecting CEO course request:", err);
                }
                setCourseRequests((prev) =>
                    prev.map((req) =>
                        req === item || req.id === item.id || req.new_course_id === item.new_course_id
                            ? { ...req, status: "Rejected", rejection_reason: reason }
                            : req
                    )
                );
            } else {
                const reqId = item.requestId || item.new_course_id || item.id;
                try {
                    if (reqId) {
                        await axios.put(`${API_BASE_URL}/api/certifications/requests/${reqId}/ceo-approval`, {
                            status: "Rejected",
                            admin_id: currentAdminId,
                            comment: reason,
                            rejection_reason: reason,
                            comments: reason,
                        });
                    }
                } catch (err) {
                    console.error("Error rejecting CEO certification request:", err);
                }
                setCertRequests((prev) =>
                    prev.map((req) =>
                        req === item || req.id === item.id || req.requestId === reqId
                            ? { ...req, status: "Rejected", rejection_reason: reason }
                            : req
                    )
                );
            }

            setRejectTarget(null);
            setSelectedApproval(null);
            setToast({
                isOpen: true,
                type: "success",
                message: `Request ${item.id || item.requestId || ""} has been rejected.`,
            });
        } catch (err) {
            console.error("Error rejecting request in CEO ApprovalsAnalytics:", err);
            setToast({
                isOpen: true,
                type: "error",
                message: "Failed to reject request. Please try again.",
            });
        } finally {
            inFlightCeoDecisionsRef.current.delete(lockKey);
            setIsRejecting(false);
        }
    };

    // Handle View Course / Certification Approval Details Modal
    const handleViewDetails = async (item) => {
        if (item && item.isCertification) {
            const certId = item.requestId || item.new_course_id || item.id;
            try {
                const res = await axios.get(`${API_BASE_URL}/api/certifications/requests/${certId}`);
                if (res.data) {
                    setSelectedApproval({
                        ...item,
                        ...res.data,
                        isCertification: true,
                    });
                    return;
                }
            } catch (err) {
                console.warn("[CEOApprovalsAnalytics] Error fetching cert details by id:", err);
            }
            setSelectedApproval(item);
            return;
        }
        if (item && item.new_course_id) {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/course-requests/${item.new_course_id}`);
                if (res.data) {
                    const db = res.data;
                    setSelectedApproval({
                        ...item,
                        new_course_id: db.id,
                        id: db.request_code || item.id,
                        courseName: db.course_name,
                        course: db.course_name,
                        provider: db.provider,
                        platform: db.provider,
                        category: db.category,
                        courseCategory: db.category,
                        courseLink: db.course_link,
                        whyLearn: db.reason,
                        description: db.reason,
                        employee: db.employee_name,
                        name: db.employee_name,
                        raw: db
                    });
                    return;
                }
            } catch (err) {
                console.warn("[CEOApprovalsAnalytics] Error fetching request details by id:", err);
            }
        }
        setSelectedApproval(item);
    };

    // Handle Download Report confirmed from modal — frontend-driven export via reportExportUtil
    const handleConfirmDownload = async (params) => {
        const fmt = (params?.format || "PDF").toUpperCase();
        const dateRange = params?.dateRange || "Year-To-Date (2026)";
        const includes = params?.includes || {};

        // ── 1. Fetch CEO KPI stats ──────────────────────────────────────────────
        let kpis = {};
        try {
            const res = await axios.get(`${API_BASE_URL}/api/ceo/kpi-stats`);
            kpis = res.data || {};
        } catch (err) {
            console.warn("[CEO Report] kpi-stats fetch failed:", err);
        }

        // ── 2. Fetch Department Performance data ───────────────────────────────
        let departments = [];
        try {
            const res = await axios.get(`${API_BASE_URL}/api/ceo/department-learning`);
            departments = Array.isArray(res.data) ? res.data : [];
        } catch (err) {
            console.warn("[CEO Report] department-learning fetch failed:", err);
        }

        // ── 3. Fetch Budget / Expenditure data ────────────────────────────────
        let budgetStats = {};
        try {
            const res = await axios.get(`${API_BASE_URL}/api/ceo/budget-expenditure-stats`);
            budgetStats = res.data || {};
        } catch (err) {
            console.warn("[CEO Report] budget-expenditure-stats fetch failed:", err);
        }

        // ── 4. Build overview & financials ────────────────────────────────────
        const overview = {
            totalEmployees: kpis.total_employees ?? 0,
            activeLearners: kpis.active_learners ?? 0,
            learningHours: `${kpis.total_learning_hours ?? 0}h`,
            certificatesEarned: kpis.total_certifications ?? 0,
            completionRate: kpis.completion_rate_pct ?? 0,
        };

        const financials = {
            totalInvestment: budgetStats.total_investment
                ? `₹ ${Number(budgetStats.total_investment).toLocaleString("en-IN")}`
                : "₹ 15,00,000",
            totalSpentFormatted: budgetStats.ytd_learning_spend
                ? `₹ ${Number(budgetStats.ytd_learning_spend).toLocaleString("en-IN")}`
                : "₹ 0",
            courseSpendFormatted: budgetStats.course_spend
                ? `₹ ${Number(budgetStats.course_spend).toLocaleString("en-IN")}`
                : "₹ 0",
            certificationSpendFormatted: budgetStats.certification_spend
                ? `₹ ${Number(budgetStats.certification_spend).toLocaleString("en-IN")}`
                : "₹ 0",
            pendingAmountFormatted: "₹ 0",
            approvedClaimsCount: certRequests.filter((r) => r.status === "Approved").length,
            pendingClaimsCount: certRequests.filter((r) => r.status === "Pending").length,
            rejectedClaimsCount: certRequests.filter((r) => r.status === "Rejected").length,
        };

        // ── 5. Map departments to reportExportUtil shape ──────────────────────
        const departmentSummary = departments.map((d) => ({
            department: d.name || d.department || "—",
            teamSize: d.headcount ?? 0,
            activeLearners: d.active_learners ?? 0,
            hours: d.hours ?? d.total_hours ?? 0,
            coursesDone: d.courses_completed ?? d.courses_done ?? 0,
            certs: d.certifications ?? d.certs ?? 0,
            spend: d.spend ?? 0,
        }));

        // ── 6. Map course requests to reportExportUtil courseRequests shape ───
        const courseRequestsForReport = courseRequests.map((r) => ({
            request_code: r.id,
            employee_id: r.raw?.employee_id || "—",
            employee_name: r.name || "—",
            department: r.department || "—",
            course_name: r.course || "—",
            provider: r.provider || "—",
            estimated_cost: r.raw?.price ?? 0,
            ld_status: "Approved",
            ceo_status: r.status || "—",
            purchase_status: r.raw?.purchase_status || "—",
            created_at: r.raw?.created_at || null,
        }));

        // ── 7. Map cert requests to reportExportUtil reimbursementClaims shape
        const certRequestsForReport = certRequests.map((c) => ({
            claim_code: c.id,
            employee_id: c.raw?.employee_id || "—",
            employee_name: c.name || "—",
            department: c.department || "—",
            certification_name: c.course || "—",
            provider: c.provider || "—",
            amount: c.raw?.estimated_cost_inr ?? 0,
            status: c.status || "—",
            processing_status: c.raw?.processing_status || "—",
            submitted_on: c.raw?.created_at ? String(c.raw.created_at).slice(0, 10) : "—",
        }));

        // ── 8. Assemble final payload ──────────────────────────────────────────
        const payload = {
            title: "CEO Overall Employee Learning & Financial Report",
            dateRange,
            overview,
            financials,
            employees: [],
            departmentSummary: includes.budgetSpend !== false ? departmentSummary : [],
            reimbursementClaims: includes.certifications !== false ? certRequestsForReport : [],
            courseRequests: includes.courseProgress !== false ? courseRequestsForReport : [],
            includes: {
                learningHours: includes.learningHours !== false,
                courseProgress: includes.courseProgress !== false,
                certificates: includes.certifications !== false,
                reimbursements: includes.budgetSpend !== false,
                departmentSummary: includes.budgetSpend !== false,
                courseRequests: includes.courseProgress !== false,
            },
        };

        // ── 9. Trigger export ─────────────────────────────────────────────────
        if (fmt === "CSV") {
            exportToCSV(payload);
        } else if (fmt === "EXCEL") {
            exportToExcel(payload);
        } else {
            exportToPDF(payload);
        }

        setIsDownloadModalOpen(false);
        setIsDownloadSuccessOpen(true);
    };

    return (
        <div className="ceo-approvals-page">
            {/* 1. Page Header */}
            <PageHeader
                title="Approvals & Analytics"
                subtitle="Audit executive-level approval workflows, training expenditures, and organization learning analytics."
            />

            {/* 2. Top Banner: Overall Employee Learning Report */}
            <LearningReportBanner
                onDownloadReport={() => setIsDownloadModalOpen(true)}
            />

            {/* 3. Controls Row (Type Pills) */}
            <div className="ceo-aw-controls-row">
                <div className="ceo-aw-type-pills">
                    <button
                        type="button"
                        className={`ceo-aw-type-pill ${requestType === "course" ? "active" : ""}`}
                        onClick={() => {
                            setRequestType("course");
                            setStatusFilter("All");
                            setSearchQuery("");
                        }}
                    >
                        Course Requests
                    </button>
                    <button
                        type="button"
                        className={`ceo-aw-type-pill ${requestType === "cert" ? "active" : ""}`}
                        onClick={() => {
                            setRequestType("cert");
                            setStatusFilter("All");
                            setSearchQuery("");
                        }}
                    >
                        Certification Requests
                    </button>
                </div>
            </div>

            {/* 3b. Search Bar Row (Course & Certification Requests) */}
            <div className="ceo-aw-search-row">
                <div className="ceo-aw-search-box">
                    <img src={searchIcon} alt="" className="ceo-aw-search-icon" />
                    <input
                        type="text"
                        placeholder={
                            requestType === "cert"
                                ? "Search by Request id, employee id/name"
                                : "Search by Request id, employee id/name or course"
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(sanitizeSingleSpaceInput(e.target.value))}
                        className="ceo-aw-search-input"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="ceo-aw-clear-search-btn"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                            title="Clear search"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* 4. Status Filter Sub-Tabs Row with Filters Button */}
            <div className="ceo-aw-status-tabs-row">
                <div className="ceo-aw-status-tabs">
                    <button
                        type="button"
                        className={`ceo-aw-status-tab ${statusFilter === "All" ? "active" : ""}`}
                        onClick={() => setStatusFilter("All")}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        className={`ceo-aw-status-tab ${statusFilter === "Pending" ? "active" : ""}`}
                        onClick={() => setStatusFilter("Pending")}
                    >
                        Pending ({pendingCount})
                    </button>
                    <button
                        type="button"
                        className={`ceo-aw-status-tab ${statusFilter === "Approved" ? "active" : ""}`}
                        onClick={() => setStatusFilter("Approved")}
                    >
                        Approved ({approvedCount})
                    </button>
                    <button
                        type="button"
                        className={`ceo-aw-status-tab ${statusFilter === "Rejected" ? "active" : ""}`}
                        onClick={() => setStatusFilter("Rejected")}
                    >
                        Rejected ({rejectedCount})
                    </button>
                </div>

                <div className="ceo-aw-status-filter-wrap">
                    {requestType === "course" ? (
                        <button
                            type="button"
                            className={`ld-cm-filter-btn ${courseActiveFiltersCount > 0 || isCourseDrawerOpen ? "filtered" : ""}`}
                            onClick={() => setIsCourseDrawerOpen(true)}
                            aria-label="Open Course Filters"
                        >
                            <img src={filtersIcon} alt="" style={{ width: 14, height: 10 }} />
                            <span>{courseActiveFiltersCount > 0 ? `Filters (${courseActiveFiltersCount})` : "Filters"}</span>
                            {courseActiveFiltersCount > 0 && (
                                <span
                                    className="ld-cm-clear-cross"
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
                            className={`ld-cm-filter-btn ${certActiveFiltersCount > 0 || isCertDrawerOpen ? "filtered" : ""}`}
                            onClick={() => setIsCertDrawerOpen(true)}
                            aria-label="Open Certification Filters"
                        >
                            <img src={filtersIcon} alt="" style={{ width: 14, height: 10 }} />
                            <span>{certActiveFiltersCount > 0 ? `Filters (${certActiveFiltersCount})` : "Filters"}</span>
                            {certActiveFiltersCount > 0 && (
                                <span
                                    className="ld-cm-clear-cross"
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

            {/* 5. Approvals Table Card */}
            {requestType === "course" ? (
                <CourseRequestsTab
                    requests={filteredList}
                    statusFilter={statusFilter}
                    highlightedItemId={highlightedItemId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewDetails={handleViewDetails}
                />
            ) : (
                <CertificationRequestsTab
                    requests={filteredList}
                    statusFilter={statusFilter}
                    highlightedItemId={highlightedItemId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewDetails={handleViewDetails}
                />
            )}

            {/* 6. Course Approval Details Modal */}
            <ApprovalDetailsModal
                approval={selectedApproval}
                onClose={() => setSelectedApproval(null)}
                onApprove={handleApprove}
                onReject={handleReject}
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

            {/* 7. Approval History Modal (5-Step Stepper) */}
            <ApprovalHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                historyData={requestType === "course" ? dynamicCourseApprovalHistory : dynamicCertApprovalHistory}
                type={requestType === "course" ? "Course" : "Certification"}
            />

            {/* 8. Download Learning Report Modal */}
            <DownloadReportModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                onDownload={handleConfirmDownload}
            />

            {/* 9. Download Success Modal */}
            <DownloadSuccessModal
                isOpen={isDownloadSuccessOpen}
                onClose={() => setIsDownloadSuccessOpen(false)}
            />

            {/* 10. Filter Drawers */}
            <CourseRequestsFilterDrawer
                isOpen={isCourseDrawerOpen}
                onClose={() => setIsCourseDrawerOpen(false)}
                departments={availableCourseDepartments}
                selectedDepartments={courseFilters.departments}
                selectedReqStartDate={courseFilters.reqStartDate}
                selectedReqEndDate={courseFilters.reqEndDate}
                onApply={(filters) => setCourseFilters(filters)}
                onClearAll={handleClearCourseFilters}
            />

            <CertificationRequestsFilterDrawer
                isOpen={isCertDrawerOpen}
                onClose={() => setIsCertDrawerOpen(false)}
                departments={availableCertDepartments}
                selectedDepartments={certFilters.departments}
                amountLimits={certAmountLimits}
                selectedAmountRange={certFilters.amountRange || [certAmountLimits.min, certAmountLimits.max]}
                selectedReqStartDate={certFilters.reqStartDate}
                selectedReqEndDate={certFilters.reqEndDate}
                onApply={(filters) => setCertFilters(filters)}
                onClearAll={handleClearCertFilters}
            />
        </div>
    );
}
