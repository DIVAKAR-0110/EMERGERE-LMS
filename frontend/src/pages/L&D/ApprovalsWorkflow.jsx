import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import axios from "axios";
import useNotificationRowHighlight from "../../hooks/useNotificationRowHighlight";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";
import ApprovalStatsCards from "../../components/L&D/ApprovalsWorkflow/ApprovalStatsCards";
import ApprovalHistoryModal from "../../components/L&D/ApprovalsWorkflow/ApprovalHistoryModal";
import ApprovalDetailsModal from "../../components/L&D/Dashboard/ApprovalDetailsModal";
import ReopenRequestModal from "../../components/L&D/ApprovalsWorkflow/ReopenRequestModal";
import RejectRequestModal from "../../components/L&D/ApprovalsWorkflow/RejectRequestModal";
import TopToastNotification from "../../components/common/TopToastNotification";
import CourseRequestsTab from "../../components/L&D/ApprovalsWorkflow/CourseRequestsTab";
import CertificationRequestsTab from "../../components/L&D/ApprovalsWorkflow/CertificationRequestsTab";
import ReimbursementRequestTab from "../../components/L&D/CertificateManagement/ReimbursementRequestTab";

import clockIcon from "../../assets/Approvals & Workflow/clock.svg";
import searchIcon from "../../assets/course_library/search.svg";
import downArrowIcon from "../../assets/Daily_Learning_Log/down_arrow.svg";
import filtersIcon from "../../assets/coursemanagement/filters.svg";
import CourseRequestsFilterDrawer from "../../components/L&D/ApprovalsWorkflow/CourseRequestsFilterDrawer";
import CertificationRequestsFilterDrawer from "../../components/L&D/ApprovalsWorkflow/CertificationRequestsFilterDrawer";
import ReimbursementFilterDrawer from "../../components/L&D/ApprovalsWorkflow/ReimbursementFilterDrawer";
import { RANK_COLORS } from "../../services/leaderboardService";
import { sanitizeSingleSpaceInput } from "../../utils/validationUtils";

import "../../styles/L&D/ApprovalsWorkflow.css";
import "../../styles/L&D/CertificateManagement.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const AVATAR_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#6366F1"];

export default function ApprovalsWorkflow() {
    const { user } = useAuth();
    const location = useLocation();
    const currentAdminId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "EMP006";

    // Top Request Type Pill (Course Requests | Certification Requests | Reimbursement Request)
    const [requestType, setRequestType] = useState(
        ["course", "cert", "reimbursement"].includes(location.state?.highlightTab)
            ? location.state.highlightTab
            : "course"
    ); // 'course' | 'cert' | 'reimbursement'

    // Status Filter Tab (All | Pending | Approved | Rejected)
    const [statusFilter, setStatusFilter] = useState("All");

    // Course & Certification Requests State (Live DB, null while waiting / offline)
    const [courseRequests, setCourseRequests] = useState(null);
    const [certRequests, setCertRequests] = useState(null);
    const [reimbursements, setReimbursements] = useState(null);

    // Course & Certification Requests Search Query (Search ONLY Request ID, Employee Name, and Course)
    const [searchQuery, setSearchQuery] = useState("");

    // Reimbursement Search & Filters
    const [reimbSearchQuery, setReimbSearchQuery] = useState("");
    const [reimbTypeTab, setReimbTypeTab] = useState("All"); // 'All' | 'Course' | 'Certification'
    const [reimbStatusFilter, setReimbStatusFilter] = useState([]);
    const [reimbProviderFilter, setReimbProviderFilter] = useState([]);

    // Course Requests Filter Drawer State
    const [isCourseDrawerOpen, setIsCourseDrawerOpen] = useState(false);
    const [courseFilters, setCourseFilters] = useState({
        departments: ["All"],
        reqStartDate: "",
        reqEndDate: "",
    });

    // Certification Requests Filter Drawer State
    const [isCertDrawerOpen, setIsCertDrawerOpen] = useState(false);
    const [certFilters, setCertFilters] = useState({
        departments: ["All"],
        amountRange: null,
        reqStartDate: "",
        reqEndDate: "",
    });

    // Reimbursement Filter Drawer State
    const [isReimbDrawerOpen, setIsReimbDrawerOpen] = useState(false);
    const [reimbDrawerFilters, setReimbDrawerFilters] = useState({
        providers: ["All"],
        amountRange: null,
        subStartDate: "",
        subEndDate: "",
        appStartDate: "",
        appEndDate: "",
        statuses: ["All"],
    });

    // Modals & Toast State
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [reopenTarget, setReopenTarget] = useState(null);
    const [isReopening, setIsReopening] = useState(false);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const [toast, setToast] = useState({ isOpen: false, type: "success", message: "" });

    // Helper to compute 5-step workflow progress for a course request
    const computeCourseSteps = (r) => {
        const raw = r.raw || r || {};
        const reqDateStr = raw.created_at ? raw.created_at.slice(0, 10) : (r.requestDate || "—");
        const rmDateStr = raw.notified_reporting_manager
            ? (typeof raw.notified_reporting_manager === "string" ? raw.notified_reporting_manager.slice(0, 10) : reqDateStr)
            : reqDateStr;
        const isLdApproved =
            String(raw.ld_status || r.ld_status || "").toLowerCase() === "approved" ||
            String(raw.ld_stage_status || "").toLowerCase() === "completed" ||
            String(r.status || "").toLowerCase() === "approved";
        const isLdRejected =
            String(raw.ld_status || r.ld_status || "").toLowerCase() === "rejected" ||
            String(raw.ld_stage_status || "").toLowerCase() === "rejected" ||
            String(r.status || "").toLowerCase() === "rejected";
        const ldDateStr = raw.ld_status_date ? raw.ld_status_date.slice(0, 10) : (isLdApproved ? reqDateStr : (isLdRejected ? "Rejected" : "Pending"));
        const isCeoApproved = raw.ceo_status === "Approved";
        const isCeoRejected = raw.ceo_status === "Rejected";
        const isCeoBypassed = Boolean(raw.is_ceo_bypassed);
        const ceoDateStr = isLdRejected
            ? "—"
            : isCeoApproved
                ? (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved")
                : (isCeoRejected ? "Rejected" : (isLdApproved ? "Pending" : "—"));

        const isPurchased = raw.purchase_status === "Purchased";
        const purchaseDateStr = isLdRejected || isCeoRejected
            ? "—"
            : isPurchased
                ? (raw.purchase_date ? raw.purchase_date.slice(0, 10) : "Purchased")
                : (isCeoApproved || isCeoBypassed ? "Pending" : "—");

        const s3Status = isLdRejected ? "rejected" : (isLdApproved ? "completed" : "pending");
        const s4Status = (isLdRejected || isCeoRejected)
            ? "rejected"
            : (isCeoApproved || isCeoBypassed ? "completed" : (isLdApproved ? "pending" : "upcoming"));
        const s5Status = (isLdRejected || isCeoRejected)
            ? "rejected"
            : (isPurchased ? "completed_final" : ((isCeoApproved || isCeoBypassed) ? "pending" : "upcoming"));

        return [
            { label: "Employee Request", date: reqDateStr, done: true, status: "completed" },
            { label: "Notified to RM", date: rmDateStr, done: true, status: "completed" },
            {
                label: "L&D Approval",
                date: isLdRejected ? "Rejected" : (isLdApproved ? ldDateStr : "Pending"),
                done: isLdApproved,
                status: s3Status
            },
            {
                label: isCeoBypassed ? "Bypassed by L&D" : "CEO Approval",
                date: isCeoBypassed ? (ldDateStr || "Bypassed") : ceoDateStr,
                done: !isLdRejected && (isCeoApproved || isCeoBypassed),
                status: s4Status
            },
            {
                label: "Course Purchased",
                date: purchaseDateStr,
                done: !isLdRejected && !isCeoRejected && isPurchased,
                status: s5Status
            },
        ];
    };

    // Helper to compute 5-step workflow progress for a certification request
    const computeCertSteps = (r) => {
        const raw = r.raw || r || {};
        const reqDateStr = raw.created_at ? raw.created_at.slice(0, 10) : (r.requestDate || "—");
        const isLdApproved =
            String(raw.ld_status || r.ld_status || "").toLowerCase() === "approved" ||
            String(raw.ld_stage_status || "").toLowerCase() === "completed" ||
            String(r.status || "").toLowerCase() === "approved";
        const isLdRejected =
            String(raw.ld_status || r.ld_status || "").toLowerCase() === "rejected" ||
            String(raw.ld_stage_status || "").toLowerCase() === "rejected" ||
            String(r.status || "").toLowerCase() === "rejected";
        const ldDateStr = raw.ld_status_date ? raw.ld_status_date.slice(0, 10) : (isLdApproved ? reqDateStr : (isLdRejected ? "Rejected" : "Pending"));
        const isCeoApproved = raw.ceo_status === "Approved";
        const isCeoRejected = raw.ceo_status === "Rejected";
        const isCeoBypassed = Boolean(raw.is_ceo_bypassed);
        const ceoDateStr = isLdRejected
            ? "—"
            : isCeoApproved
                ? (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved")
                : (isCeoRejected ? "Rejected" : (isLdApproved ? "Pending" : "—"));

        const isCertCompleted = raw.status === "Approved" || isCeoApproved || raw.ceo_status === "Approved";
        const certDateStr = isLdRejected || isCeoRejected
            ? "—"
            : isCertCompleted
                ? (raw.cert_status_date ? raw.cert_status_date.slice(0, 10) : (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved"))
                : (isCeoApproved || isCeoBypassed ? "Pending" : "—");

        const s3Status = isLdRejected ? "rejected" : (isLdApproved ? "completed" : "pending");
        const s4Status = (isLdRejected || isCeoRejected)
            ? "rejected"
            : (isCeoApproved || isCeoBypassed ? "completed" : (isLdApproved ? "pending" : "upcoming"));
        const s5Status = (isLdRejected || isCeoRejected)
            ? "rejected"
            : (isCertCompleted ? "completed_final" : ((isCeoApproved || isCeoBypassed) ? "pending" : "upcoming"));

        return [
            { label: "Employee Request", date: reqDateStr, done: true, status: "completed" },
            { label: "Notified to RM", date: reqDateStr, done: true, status: "completed" },
            {
                label: "L&D Approval",
                date: isLdRejected ? "Rejected" : (isLdApproved ? ldDateStr : "Pending"),
                done: isLdApproved,
                status: s3Status
            },
            {
                label: isCeoBypassed ? "Bypassed by L&D" : "CEO Approval",
                date: isCeoBypassed ? (ldDateStr || "Bypassed") : ceoDateStr,
                done: !isLdRejected && (isCeoApproved || isCeoBypassed),
                status: s4Status
            },
            {
                label: "Certificate Approved",
                date: certDateStr,
                done: !isLdRejected && !isCeoRejected && isCertCompleted,
                status: s5Status
            },
        ];
    };

    // Fetch live course requests from database
    const fetchCourseRequests = async () => {
        try {
            const [res, empRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/course-requests`),
                axios.get(`${API_BASE_URL}/api/auth/employees`).catch(() => null),
            ]);
            const empList = empRes?.data?.employees || (Array.isArray(empRes?.data) ? empRes.data : []);
            const idMap = {};
            const deptMap = {};
            empList.forEach((e) => {
                const dept = e.department || e.job_title;
                const empId = e.employee_id;
                if (e.name && dept) deptMap[e.name.trim().toLowerCase()] = dept;
                if (e.full_name && dept) deptMap[e.full_name.trim().toLowerCase()] = dept;
                if (e.employee_id && dept) deptMap[e.employee_id.trim().toUpperCase()] = dept;

                if (e.name && empId) idMap[e.name.trim().toLowerCase()] = empId;
                if (e.full_name && empId) idMap[e.full_name.trim().toLowerCase()] = empId;
            });

            if (Array.isArray(res.data) && res.data.length > 0) {
                const mapped = res.data.map((r, idx) => {
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
                        : "—";

                    const nameKey = (r.employee_name || "").trim().toLowerCase();
                    const rawEmpId = r.employee_id || idMap[nameKey] || (nameKey === "imran khan" ? "EMP019" : nameKey === "vikram malhotra" ? "EMP010" : nameKey === "ms" ? "EMP089" : nameKey === "abc qwer" ? "EMP022" : nameKey === "harini swaminathan" ? "EMP018" : "");
                    const deptOrRole = (r.department && r.department.toLowerCase() !== "employee")
                        ? r.department
                        : deptMap[nameKey] || deptMap[(rawEmpId || "").toUpperCase()] || (r.employee_role && r.employee_role.toLowerCase() !== "employee" ? r.employee_role : (nameKey === "imran khan" ? "Enterprise Application (Fusefy)" : nameKey === "vikram malhotra" ? "Learning & Development" : "Enterprise Data & Analytics"));

                    return {
                        id: r.request_code,
                        new_course_id: r.id,
                        name: r.employee_name,
                        empId: rawEmpId,
                        employeeId: rawEmpId,
                        title: rawEmpId,
                        department: deptOrRole,
                        initials: initials,
                        avatarBg: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                        course: r.course_name,
                        courseName: r.course_name,
                        requestDate: reqDate,
                        status: r.ld_status || "—",
                        amount: r.price ? `₹${Number(r.price).toLocaleString()}` : "—",
                        provider: r.provider,
                        platform: r.provider,
                        category: r.category,
                        courseLink: r.course_link,
                        whyLearn: r.reason || "Course requested by employee for skill advancement.",
                        reopen_reason: r.reopen_reason,
                        reject_reason: r.reopen_reason,
                        rejection_reason: r.reopen_reason,
                        raw: r,
                        steps: computeCourseSteps(r)
                    };
                });

                // Filter out direct L&D self-purchases (PUR-...) so they do not pollute employee Course Requests
                const employeeRequestsOnly = mapped.filter((item) => {
                    const code = String(item.id || item.raw?.request_code || "");
                    return !code.startsWith("PUR-");
                });
                setCourseRequests(employeeRequestsOnly);
            } else {
                setCourseRequests([]);
            }
        } catch (err) {
            console.warn("[ApprovalsWorkflow] Error fetching course requests:", err);
            setCourseRequests([]);
        }
    };

    // Fetch live certification requests from database
    const fetchCertRequests = async () => {
        try {
            const [res, empRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/certifications/requests`),
                axios.get(`${API_BASE_URL}/api/auth/employees`).catch(() => null),
            ]);
            const empList = empRes?.data?.employees || (Array.isArray(empRes?.data) ? empRes.data : []);
            const idMap = {};
            const deptMap = {};
            empList.forEach((e) => {
                const dept = e.department || e.job_title;
                const empId = e.employee_id;
                if (e.name && dept) deptMap[e.name.trim().toLowerCase()] = dept;
                if (e.full_name && dept) deptMap[e.full_name.trim().toLowerCase()] = dept;
                if (e.employee_id && dept) deptMap[e.employee_id.trim().toUpperCase()] = dept;

                if (e.name && empId) idMap[e.name.trim().toLowerCase()] = empId;
                if (e.full_name && empId) idMap[e.full_name.trim().toLowerCase()] = empId;
            });

            if (Array.isArray(res.data) && res.data.length > 0) {
                const mapped = res.data.map((r, idx) => {
                    const empName = r.employee_name || `Employee ${r.employee_id}`;
                    const nameKey = empName.trim().toLowerCase();
                    const rawEmpId = r.employee_id || idMap[nameKey] || (nameKey === "imran khan" ? "EMP019" : nameKey === "vikram malhotra" ? "EMP010" : nameKey === "ms" ? "EMP089" : nameKey === "abc qwer" ? "EMP022" : nameKey === "harini swaminathan" ? "EMP018" : "");
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
                        : "—";

                    const resolvedDept = (r.department && r.department !== "—" && r.department.toLowerCase() !== "employee")
                        ? r.department
                        : deptMap[nameKey] || deptMap[(rawEmpId || "").toUpperCase()] || (nameKey === "imran khan" ? "Enterprise Application (Fusefy)" : "Enterprise Data & Analytics");

                    return {
                        id: r.request_code || `CLM-2026-${String(r.id || idx + 1).padStart(4, "0")}`,
                        requestId: r.id,
                        name: empName,
                        empId: rawEmpId,
                        employeeId: rawEmpId,
                        title: rawEmpId,
                        department: resolvedDept,
                        initials: initials,
                        avatarBg: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                        course: r.certification_name,
                        courseName: r.certification_name,
                        requestDate: reqDate,
                        status: r.ld_status || "—",
                        amount: r.estimated_cost_inr ? `₹${Number(r.estimated_cost_inr).toLocaleString()}` : "—",
                        provider: r.provider_name || "—",
                        platform: r.provider_name || "—",
                        category: r.category_name || "Certification",
                        scheduledExamDate: r.scheduled_exam_date,
                        whyLearn: r.purpose || "Certification requested for skill advancement.",
                        reopen_reason: r.reopen_reason,
                        reject_reason: r.reopen_reason,
                        rejection_reason: r.reopen_reason,
                        isCertification: true,
                        type: "Certification",
                        raw: r,
                        steps: computeCertSteps(r)
                    };
                });
                setCertRequests(mapped);
            } else {
                setCertRequests([]);
            }
        } catch (err) {
            console.warn("[ApprovalsWorkflow] Error fetching certification requests:", err);
            setCertRequests([]);
        }
    };

    // Fetch live reimbursement claims from database (Certification Claims & Direct Course Reimbursements)
    const fetchReimbursements = async () => {
        try {
            const token = localStorage.getItem("lms_token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const [claimsRes, coursesRes, empRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/reimbursements/claims`, { headers }).catch(() => null),
                axios.get(`${API_BASE_URL}/api/courses`, { headers }).catch(() => null),
                axios.get(`${API_BASE_URL}/api/auth/employees`, { headers }).catch(() => null),
            ]);

            const empList = empRes?.data?.employees || (Array.isArray(empRes?.data) ? empRes.data : []);
            const idMap = {};
            empList.forEach((e) => {
                const empId = e.employee_id;
                if (e.name && empId) idMap[e.name.trim().toLowerCase()] = empId;
                if (e.full_name && empId) idMap[e.full_name.trim().toLowerCase()] = empId;
                if (e.employee_id && empId) idMap[e.employee_id.trim().toUpperCase()] = empId;
            });

            const certClaims = Array.isArray(claimsRes?.data) ? claimsRes.data.map((cl, idx) => {
                const empName = cl.employee_name || `Employee ${cl.employee_id}`;
                const inits = empName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                const nameKey = empName.trim().toLowerCase();
                const rawEmpId = cl.employee_id || idMap[nameKey] || (nameKey === "imran khan" ? "EMP019" : nameKey === "harini swaminathan" ? "EMP018" : nameKey === "nivash" ? "EMP011" : nameKey === "vikram malhotra" ? "EMP010" : nameKey === "ms" ? "EMP089" : nameKey === "abc qwer" ? "EMP022" : "");

                // Status Evaluation for Certification Claims:
                // 1. Paid: Payment record exists or processing_status is Paid
                // 2. Rejected: Claim rejected by HR
                // 3. In Progress: HR approved, payment not yet processed
                // 4. Submitted to HR: Initial submission pending HR review
                const procStatus = (cl.processing_status || "").trim().toLowerCase();
                const mainStatus = (cl.status || "").trim().toLowerCase();
                const isPaid = procStatus === "paid" || Boolean(cl.payment_slip_path) || Boolean(cl.payment_code) || Boolean(cl.paid_on);
                const isRejected = mainStatus === "rejected" || procStatus === "rejected";
                const isApproved = mainStatus === "approved" || procStatus === "approved";

                let currentStatus = "Submitted to HR";
                if (isPaid) {
                    currentStatus = "Paid";
                } else if (isRejected) {
                    currentStatus = "Rejected";
                } else if (isApproved) {
                    currentStatus = "In Progress";
                } else {
                    currentStatus = "Submitted to HR";
                }

                // Extract and format HR approved date
                let approvedDateStr = null;
                if (cl.approved_on) {
                    approvedDateStr = new Date(cl.approved_on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                } else if (Array.isArray(cl.stages)) {
                    const hrStage = cl.stages.find((s) => s.stage_name === "HR Approval" && (s.stage_status === "Completed" || s.stage_date));
                    if (hrStage && hrStage.stage_date) {
                        approvedDateStr = new Date(hrStage.stage_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                    }
                }

                let displayApprovedOn = "N/A";
                if (currentStatus === "Paid" || currentStatus === "In Progress") {
                    displayApprovedOn = approvedDateStr || (cl.submitted_on ? new Date(cl.submitted_on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Approved");
                } else {
                    displayApprovedOn = "N/A";
                }

                return {
                    id: cl.claim_code || `CLM-${cl.claim_id || idx + 1}`,
                    employee: empName,
                    empId: rawEmpId,
                    employeeId: rawEmpId,
                    initials: inits,
                    avatarBg: RANK_COLORS[idx % RANK_COLORS.length],
                    certificate: cl.certification_name,
                    claimType: "Certification",
                    provider: cl.provider_name || cl.provider || "—",
                    amount: cl.amount ? `₹${Number(cl.amount).toLocaleString()}` : "₹0",
                    submittedOn: cl.submitted_on ? new Date(cl.submitted_on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : (cl.created_at ? new Date(cl.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent"),
                    approvedOn: displayApprovedOn,
                    status: currentStatus,
                    raw: cl
                };
            }) : [];

            const courseClaims = Array.isArray(coursesRes?.data) ? coursesRes.data
                .filter((c) => (c.price > 0 || c.claim_id || c.hr_status))
                .map((c, idx) => {
                    const empName = c.employee_name || "Vikram Malhotra";
                    const inits = empName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                    const nameKey = empName.trim().toLowerCase();
                    const rawEmpId = c.employee_id || c.emp_id || c.employeeId || idMap[nameKey] || (nameKey === "imran khan" ? "EMP019" : nameKey === "harini swaminathan" ? "EMP018" : nameKey === "nivash" ? "EMP011" : nameKey === "vikram malhotra" ? "EMP010" : nameKey === "ms" ? "EMP089" : nameKey === "abc qwer" ? "EMP022" : "");

                    // Status Evaluation for Course Reimbursements:
                    // 1. Paid: HR submitted payment slip form & marked paid
                    // 2. Rejected: HR rejected course reimbursement
                    // 3. In Progress: HR approved, payment slip not yet submitted
                    // 4. Submitted to HR: Course submitted, awaiting HR review
                    const hrStatusNorm = (c.hr_status || "Pending").trim().toLowerCase();
                    const payStatusNorm = (c.payment_status || "").trim().toLowerCase();
                    const isPaid = payStatusNorm === "paid" || Boolean(c.payment_slip_path) || Boolean(c.payment_code) || Boolean(c.paid_on);
                    const isRejected = hrStatusNorm === "rejected";
                    const isApproved = hrStatusNorm === "approved" || hrStatusNorm === "accept" || hrStatusNorm === "accepted";

                    let currentStatus = "Submitted to HR";
                    if (isPaid) {
                        currentStatus = "Paid";
                    } else if (isRejected) {
                        currentStatus = "Rejected";
                    } else if (isApproved) {
                        currentStatus = "In Progress";
                    } else {
                        currentStatus = "Submitted to HR";
                    }

                    let displayApprovedOn = "N/A";
                    if (currentStatus === "Paid" || currentStatus === "In Progress") {
                        displayApprovedOn = c.hr_reviewed_at
                            ? new Date(c.hr_reviewed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                            : "Approved";
                    } else {
                        displayApprovedOn = "N/A";
                    }

                    const claimId = c.claim_id || `PUR-2026-${String(c.id).padStart(4, "0")}`;

                    return {
                        id: claimId,
                        employee: empName,
                        empId: rawEmpId,
                        employeeId: rawEmpId,
                        initials: inits,
                        avatarBg: RANK_COLORS[(idx + 4) % RANK_COLORS.length],
                        certificate: c.course_title,
                        claimType: "Course",
                        provider: c.provider_name || c.provider || "—",
                        amount: c.price ? `₹${Number(c.price).toLocaleString()}` : "₹0",
                        submittedOn: c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent",
                        approvedOn: displayApprovedOn,
                        status: currentStatus,
                        raw: c
                    };
                }) : [];

            setReimbursements([...certClaims, ...courseClaims]);
        } catch (err) {
            console.warn("[ApprovalsWorkflow] Error fetching reimbursements:", err);
            setReimbursements([]);
        }
    };

    useEffect(() => {
        fetchCourseRequests();
        fetchCertRequests();
        fetchReimbursements();
    }, []);

    const isCoursesLoading = courseRequests === null;
    const isCertsLoading = certRequests === null;
    const isReimbLoading = reimbursements === null;
    const isStatsLoading = isCoursesLoading && isCertsLoading && isReimbLoading;
    const activeTabLoading = requestType === "course" ? isCoursesLoading : (requestType === "cert" ? isCertsLoading : isReimbLoading);

    // 3-second highlight for notification-targeted Course, Certification, or Reimbursement rows
    const { highlightedKey: highlightedItemId } = useNotificationRowHighlight({
        locationState: location.state,
        isReady:
            requestType === "reimbursement"
                ? reimbursements !== null
                : requestType === "cert"
                    ? certRequests !== null
                    : courseRequests !== null,
        targetList:
            requestType === "reimbursement"
                ? reimbursements
                : requestType === "cert"
                    ? certRequests
                    : courseRequests,
        storageKey: "lms_completed_ld_aw_highlight_ts",
        onActivate: (state) => {
            if (["cert", "course", "reimbursement"].includes(state.highlightTab)) {
                setRequestType(state.highlightTab);
            }
            if (state.highlightTab === "reimbursement") {
                setReimbSearchQuery("");
                setReimbStatusFilter([]);
                setReimbProviderFilter([]);
            } else {
                setStatusFilter("All");
                setSearchQuery("");
            }
        },
        onNotFound: () => {
            setToast({
                isOpen: true,
                type: "warning",
                message: "The selected request record could not be found in Approvals & Workflow.",
            });
        },
    });

    // Current active list for course / cert
    const currentList = requestType === "course" ? (courseRequests || []) : (certRequests || []);

    // Computed Counts for Sub-Tabs
    const pendingCount = useMemo(
        () => currentList.filter((item) => item.status === "Pending").length,
        [currentList]
    );

    const approvedCount = useMemo(
        () => currentList.filter((item) => item.status === "Approved").length,
        [currentList]
    );

    const rejectedCount = useMemo(
        () => currentList.filter((item) => item.status === "Rejected").length,
        [currentList]
    );

    // Computed Counts for Reimbursement Sub-Tabs (Course vs Certification)
    const reimbCourseCount = useMemo(
        () => (reimbursements || []).filter((item) => item.claimType === "Course").length,
        [reimbursements]
    );

    const reimbCertCount = useMemo(
        () => (reimbursements || []).filter((item) => item.claimType === "Certification").length,
        [reimbursements]
    );

    // Calculate amount limits for Certifications and Reimbursements dynamically from database records
    const certAmountLimits = useMemo(() => {
        const list = (certRequests || [])
            .map((r) => Number(r.raw?.estimated_cost_inr || parseFloat(String(r.amount || "").replace(/[^0-9.]/g, "")) || 0))
            .filter((n) => n > 0);
        const max = list.length ? Math.max(...list) : 1000;
        const step = max <= 2000 ? 50 : max <= 10000 ? 100 : max <= 50000 ? 500 : 1000;
        return { min: 0, max, step };
    }, [certRequests]);

    const reimbAmountLimits = useMemo(() => {
        const list = (reimbursements || [])
            .map((r) => Number(r.raw?.amount || parseFloat(String(r.amount || "").replace(/[^0-9.]/g, "")) || 0))
            .filter((n) => n > 0);
        const max = list.length ? Math.max(...list) : 1000;
        const step = max <= 2000 ? 50 : max <= 10000 ? 100 : max <= 50000 ? 500 : 1000;
        return { min: 0, max, step };
    }, [reimbursements]);

    // Available Departments
    const availableCourseDepartments = useMemo(() => {
        const set = new Set();
        (courseRequests || []).forEach((r) => {
            const d = r.department || r.title;
            if (d && d !== "—") set.add(d);
        });
        return Array.from(set).sort();
    }, [courseRequests]);

    const availableCertDepartments = useMemo(() => {
        const set = new Set();
        (certRequests || []).forEach((r) => {
            const d = r.department || r.title;
            if (d && d !== "—") set.add(d);
        });
        return Array.from(set).sort();
    }, [certRequests]);

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

    const reimbActiveFiltersCount = useMemo(() => {
        let count = 0;
        const hasProv =
            (!reimbDrawerFilters.providers.includes("All") &&
                !reimbDrawerFilters.providers.includes("All Providers") &&
                reimbDrawerFilters.providers.length > 0) ||
            reimbProviderFilter.length > 0;
        if (hasProv) count += 1;

        const hasStatus =
            (!reimbDrawerFilters.statuses.includes("All") &&
                !reimbDrawerFilters.statuses.includes("All Status") &&
                !reimbDrawerFilters.statuses.includes("All Statuses") &&
                reimbDrawerFilters.statuses.length > 0) ||
            reimbStatusFilter.length > 0;
        if (hasStatus) count += 1;

        const isAmountActive =
            Boolean(reimbDrawerFilters.amountRange) &&
            (reimbDrawerFilters.amountRange[0] > reimbAmountLimits.min ||
                reimbDrawerFilters.amountRange[1] < reimbAmountLimits.max);
        if (isAmountActive) count += 1;

        if (reimbDrawerFilters.subStartDate || reimbDrawerFilters.subEndDate) count += 1;
        if (reimbDrawerFilters.appStartDate || reimbDrawerFilters.appEndDate) count += 1;
        return count;
    }, [reimbDrawerFilters, reimbProviderFilter, reimbStatusFilter, reimbAmountLimits]);

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

    const handleClearReimbFilters = () => {
        setReimbDrawerFilters({
            providers: ["All"],
            amountRange: [reimbAmountLimits.min, reimbAmountLimits.max],
            subStartDate: "",
            subEndDate: "",
            appStartDate: "",
            appEndDate: "",
            statuses: ["All"],
        });
        setReimbProviderFilter([]);
        setReimbStatusFilter([]);
    };

    const handleApplyReimbDrawer = (filters) => {
        setReimbDrawerFilters(filters);
        if (filters.providers?.length && !filters.providers.includes("All") && !filters.providers.includes("All Providers")) {
            setReimbProviderFilter(filters.providers);
        } else if (filters.providers?.includes("All") || filters.providers?.includes("All Providers")) {
            setReimbProviderFilter([]);
        }
        if (filters.statuses?.length && !filters.statuses.includes("All") && !filters.statuses.includes("All Status")) {
            setReimbStatusFilter(filters.statuses);
        } else if (filters.statuses?.includes("All") || filters.statuses?.includes("All Status")) {
            setReimbStatusFilter([]);
        }
    };

    // Filtered Table List for Course / Cert
    const filteredList = useMemo(() => {
        if (requestType === "course" ? isCoursesLoading : isCertsLoading) return [];
        return currentList.filter((item) => {
            // Search filter: ONLY Request ID, Employee Name, and Course
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

                const empId = String(item.empId || item.employeeId || item.raw?.employee_id || item.title || "").toLowerCase();
                const matchesSearch = reqId.includes(q) || empName.includes(q) || courseName.includes(q) || empId.includes(q);
                if (!matchesSearch) return false;
            }

            // Status sub-tab filter
            if (statusFilter !== "All" && item.status !== statusFilter) return false;

            if (requestType === "course") {
                // Course Requests: Department filter
                const hasDept =
                    !courseFilters.departments.includes("All") &&
                    !courseFilters.departments.includes("All Departments") &&
                    courseFilters.departments.length > 0;
                if (hasDept) {
                    const d = item.department || item.title || "";
                    const match = courseFilters.departments.some(
                        (sel) => sel.toLowerCase() === d.toLowerCase()
                    );
                    if (!match) return false;
                }

                // Request Date filter
                if (courseFilters.reqStartDate || courseFilters.reqEndDate) {
                    const rawDate = item.raw?.created_at || item.requestDate;
                    if (!isDateInRange(rawDate, courseFilters.reqStartDate, courseFilters.reqEndDate)) {
                        return false;
                    }
                }
            } else {
                // Certification Requests: Department filter
                const hasDept =
                    !certFilters.departments.includes("All") &&
                    !certFilters.departments.includes("All Departments") &&
                    certFilters.departments.length > 0;
                if (hasDept) {
                    const d = item.department || item.title || "";
                    const match = certFilters.departments.some(
                        (sel) => sel.toLowerCase() === d.toLowerCase()
                    );
                    if (!match) return false;
                }

                // Amount filter (slider)
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

                // Request Date filter
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
        isCoursesLoading,
        isCertsLoading,
        courseFilters,
        certFilters,
        certAmountLimits,
        searchQuery,
    ]);

    const isProviderFiltered = useMemo(() => {
        return (
            Array.isArray(reimbProviderFilter) &&
            reimbProviderFilter.length > 0
        );
    }, [reimbProviderFilter]);

    const isStatusFiltered = useMemo(() => {
        return (
            Array.isArray(reimbStatusFilter) &&
            reimbStatusFilter.length > 0
        );
    }, [reimbStatusFilter]);

    // Filtered Reimbursements
    const filteredReimbursements = useMemo(() => {
        if (!reimbursements) return null;
        return reimbursements.filter((item) => {
            const q = (reimbSearchQuery || "").trim().toLowerCase();
            const matchesSearch = !q ||
                (item.id && String(item.id).toLowerCase().includes(q)) ||
                (item.employee && item.employee.toLowerCase().includes(q)) ||
                (item.empId && String(item.empId).toLowerCase().includes(q)) ||
                (item.employeeId && String(item.employeeId).toLowerCase().includes(q)) ||
                (item.certificate && item.certificate.toLowerCase().includes(q));

            if (!matchesSearch) return false;

            // Status filter (from inline dropdown OR drawer)
            const activeStatuses = reimbStatusFilter.length > 0
                ? reimbStatusFilter
                : (!reimbDrawerFilters.statuses.includes("All") && !reimbDrawerFilters.statuses.includes("All Status") && !reimbDrawerFilters.statuses.includes("All Statuses") ? reimbDrawerFilters.statuses : []);
            if (activeStatuses.length > 0) {
                const matchStatus = activeStatuses.some(
                    (s) => String(s).toLowerCase() === String(item.status || "").toLowerCase()
                );
                if (!matchStatus) return false;
            }

            // Provider filter (from inline dropdown OR drawer)
            const activeProviders = reimbProviderFilter.length > 0
                ? reimbProviderFilter
                : (!reimbDrawerFilters.providers.includes("All") && !reimbDrawerFilters.providers.includes("All Providers") ? reimbDrawerFilters.providers : []);
            if (activeProviders.length > 0) {
                const matchProvider = activeProviders.some(
                    (p) => String(p).toLowerCase() === String(item.provider || "").toLowerCase()
                );
                if (!matchProvider) return false;
            }

            // Amount filter (slider)
            const [minAmt, maxAmt] = reimbDrawerFilters.amountRange || [reimbAmountLimits.min, reimbAmountLimits.max];
            const amt = Number(
                item.raw?.amount ||
                parseFloat(String(item.amount || "").replace(/[^0-9.]/g, "")) ||
                0
            );
            if (maxAmt >= reimbAmountLimits.max) {
                if (amt < minAmt) return false;
            } else {
                if (amt < minAmt || amt > maxAmt) return false;
            }

            // Submitted on date filter
            if (reimbDrawerFilters.subStartDate || reimbDrawerFilters.subEndDate) {
                const rawDate = item.raw?.submitted_on || item.raw?.created_at || item.submittedOn;
                if (!isDateInRange(rawDate, reimbDrawerFilters.subStartDate, reimbDrawerFilters.subEndDate)) {
                    return false;
                }
            }

            // Approved on date filter
            if (reimbDrawerFilters.appStartDate || reimbDrawerFilters.appEndDate) {
                const rawDate = item.raw?.approved_on || item.approvedOn;
                if (!isDateInRange(rawDate, reimbDrawerFilters.appStartDate, reimbDrawerFilters.appEndDate)) {
                    return false;
                }
            }

            // Sub-tab filter: All | Course | Certification
            if (reimbTypeTab !== "All" && item.claimType !== reimbTypeTab) {
                return false;
            }

            return true;
        });
    }, [
        reimbursements,
        reimbSearchQuery,
        reimbStatusFilter,
        reimbProviderFilter,
        reimbDrawerFilters,
        reimbAmountLimits,
        reimbTypeTab,
    ]);

    // Reimbursement Dropdown Options
    const reimbStatusOptions = useMemo(() => {
        const set = new Set(["Submitted to HR", "In Progress", "Paid", "Rejected"]);
        (reimbursements || []).forEach((r) => {
            if (r.status && r.status !== "—") set.add(r.status);
        });
        return Array.from(set);
    }, [reimbursements]);

    const reimbProviderOptions = useMemo(() => {
        const set = new Set();
        (reimbursements || []).forEach((r) => {
            if (r.provider && r.provider !== "—") set.add(r.provider);
        });
        if (set.size === 0) {
            return ["COURSERA", "Amazon Web Services", "Linux Foundation", "Udemy", "AWS", "Google"];
        }
        return Array.from(set);
    }, [reimbursements]);

    // Dynamic Top Metric Cards (Calculated directly from live state, null when waiting)
    const dynamicStats = useMemo(() => {
        if (isStatsLoading) {
            return [
                { key: "pending", label: "Pending Approvals", value: null, icon: "AlertTriangle", tint: "info" },
                { key: "courseReq", label: "Total Course Requests", value: null, icon: "GraduationCap", tint: "purple" },
                { key: "certReq", label: "Total Certification Requests", value: null, icon: "FileBadge2", tint: "warning" },
                { key: "approved", label: "Total Approved", suffix: "(This Year)", value: null, icon: "CheckCircle2", tint: "success" },
            ];
        }

        // 1. Pending Approvals: Sum of Course Requests Pending + Certification Requests Pending (excluding reimbursements)
        const pendingCourseCount = (courseRequests || []).filter((item) => item.status === "Pending").length;
        const pendingCertCount = (certRequests || []).filter((item) => item.status === "Pending").length;
        const totalPending = pendingCourseCount + pendingCertCount;

        // 2. Cumulative Total Requests till now
        const totalCourseCount = (courseRequests || []).length;
        const totalCertCount = (certRequests || []).length;

        // 3. Total Approved: Total courses approved by L&D + Total certifications approved by L&D
        const approvedCourseCount = (courseRequests || []).filter((item) => {
            const s = String(item.status || item.raw?.ld_status || "").toLowerCase();
            const stage = String(item.raw?.ld_stage_status || "").toLowerCase();
            return s === "approved" || stage === "completed";
        }).length;

        const approvedCertCount = (certRequests || []).filter((item) => {
            const s = String(item.status || item.raw?.ld_status || "").toLowerCase();
            const stage = String(item.raw?.ld_stage_status || "").toLowerCase();
            return s === "approved" || stage === "completed";
        }).length;

        const totalApproved = approvedCourseCount + approvedCertCount;

        return [
            { key: "pending", label: "Pending Approvals", value: String(totalPending), icon: "AlertTriangle", tint: "info" },
            { key: "courseReq", label: "Total Course Requests", value: String(totalCourseCount), icon: "GraduationCap", tint: "purple" },
            { key: "certReq", label: "Total Certification Requests", value: String(totalCertCount), icon: "FileBadge2", tint: "warning" },
            { key: "approved", label: "Total Approved", suffix: "(This Year)", value: String(totalApproved), icon: "CheckCircle2", tint: "success" },
        ];
    }, [courseRequests, certRequests, isStatsLoading]);

    // Dynamically derive course requests where L&D has taken action for Course Approval History
    const dynamicCourseApprovalHistory = useMemo(() => {
        const historyCourses = (courseRequests || []).filter((req) => req.status === "Approved" || req.status === "Rejected");

        return historyCourses.map((req, idx) => {
            const raw = req.raw || {};
            const reqDateStr = raw.created_at ? raw.created_at.slice(0, 10) : req.requestDate || "—";
            const rmDateStr = raw.notified_reporting_manager
                ? (typeof raw.notified_reporting_manager === "string" ? raw.notified_reporting_manager.slice(0, 10) : reqDateStr)
                : reqDateStr;
            const ldDateStr = raw.ld_status_date ? raw.ld_status_date.slice(0, 10) : reqDateStr;
            const isLdApproved = req.status === "Approved";
            const isLdRejected = req.status === "Rejected";
            const isCeoApproved = raw.ceo_status === "Approved";
            const isCeoRejected = raw.ceo_status === "Rejected";
            const isCeoBypassed = Boolean(raw.is_ceo_bypassed);
            const ceoDateStr = isLdRejected
                ? "—"
                : isCeoApproved
                    ? (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved")
                    : (isCeoRejected ? "Rejected" : "Pending");

            const isPurchased = raw.purchase_status === "Purchased";
            const purchaseDateStr = isLdRejected
                ? "—"
                : isPurchased
                    ? (raw.purchase_date ? raw.purchase_date.slice(0, 10) : "Purchased")
                    : "Pending";

            return {
                id: req.id || `CLM-2026-00${12 + idx}`,
                new_course_id: req.new_course_id,
                uniqueId: `course-hist-${req.new_course_id || req.id || idx}-${idx}`,
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
                amount: req.amount || (raw.price ? `₹${Number(raw.price).toLocaleString()}` : "—"),
                requestedOn: req.requestDate,
                requestDate: req.requestDate,
                status: req.status,
                raw: req.raw,
                steps: [
                    { label: "Employee Request", date: reqDateStr, done: true },
                    { label: "Notified to RM", date: rmDateStr, done: true },
                    {
                        label: "L&D Approval",
                        date: isLdRejected ? "Rejected" : ldDateStr,
                        done: isLdApproved,
                        status: isLdRejected ? "rejected" : "approved"
                    },
                    {
                        label: isCeoBypassed ? "Bypassed by L&D" : "CEO Approval",
                        date: ceoDateStr,
                        done: !isLdRejected && isCeoApproved,
                        status: isLdRejected || isCeoRejected ? "rejected" : raw.ceo_status?.toLowerCase()
                    },
                    {
                        label: "Course Purchased",
                        date: purchaseDateStr,
                        done: !isLdRejected && !isCeoRejected && isPurchased,
                        status: isLdRejected || isCeoRejected ? "rejected" : raw.purchase_status?.toLowerCase()
                    },
                ],
            };
        });
    }, [courseRequests]);

    // Dynamically derive approved certification requests for Certification Approval History
    // Dynamically derive certification requests where L&D has taken action for Certification Approval History
    const dynamicCertApprovalHistory = useMemo(() => {
        const historyCerts = (certRequests || []).filter((req) => req.status === "Approved" || req.status === "Rejected");

        return historyCerts.map((req, idx) => {
            const raw = req.raw || {};
            const reqDateStr = raw.created_at ? raw.created_at.slice(0, 10) : req.requestDate || "—";
            const isLdApproved = req.status === "Approved";
            const isLdRejected = req.status === "Rejected";
            const ldDateStr = raw.ld_status_date ? raw.ld_status_date.slice(0, 10) : (isLdApproved ? "Approved" : "Rejected");
            const isCeoApproved = raw.ceo_status === "Approved";
            const isCeoRejected = raw.ceo_status === "Rejected";
            const isCeoBypassed = Boolean(raw.is_ceo_bypassed);
            const ceoDateStr = isCeoApproved
                ? (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved")
                : (isCeoRejected ? "Rejected" : "Pending");

            const isCertCompleted = raw.status === "Approved";
            const certDateStr = isCertCompleted ? (raw.cert_status_date || "—") : "—";

            return {
                id: req.id && !req.id.startsWith("CRQ-") ? req.id : `CLM-2026-${String(idx + 1).padStart(4, "0")}`,
                uniqueId: `cert-hist-${req.id || idx}-${idx}`,
                course: req.course,
                courseName: req.courseName || req.course,
                employee: req.name,
                name: req.name,
                provider: req.provider || req.platform || "Certification Authority",
                amount: req.amount || (raw.estimated_cost_inr ? `₹${Number(raw.estimated_cost_inr).toLocaleString()}` : "—"),
                requestedOn: req.requestDate,
                requestDate: req.requestDate,
                status: req.status,
                steps: [
                    { label: "Employee Request", date: reqDateStr, done: true },
                    { label: "Notified to RM", date: reqDateStr, done: true },
                    {
                        label: "L&D Approval",
                        date: ldDateStr,
                        done: isLdApproved,
                        status: isLdRejected ? "rejected" : (isLdApproved ? "approved" : "pending")
                    },
                    {
                        label: isCeoBypassed ? "Bypassed by L&D" : "CEO Approval",
                        date: ceoDateStr,
                        done: !isLdRejected && isCeoApproved,
                        status: isLdRejected || isCeoRejected ? "rejected" : raw.ceo_status?.toLowerCase()
                    },
                    {
                        label: "Certificate Approved",
                        date: certDateStr,
                        done: !isLdRejected && !isCeoRejected && isCertCompleted,
                        status: isLdRejected || isCeoRejected ? "rejected" : (isCertCompleted ? "approved" : "upcoming")
                    },
                ],
            };
        });
    }, [certRequests]);

    // Handle Approve (with optional CEO bypass flag from ApprovalDetailsModal)
    const handleApprove = async (item, bypassCeo = false) => {
        const isBypass = Boolean(bypassCeo);
        const todayIso = new Date().toISOString().slice(0, 10);
        const isCertItem =
            requestType === "cert" ||
            item?.isCertification ||
            item?.type === "Certification";

        if (!isCertItem) {
            try {
                if (item.new_course_id) {
                    await axios.put(`${API_BASE_URL}/api/course-requests/${item.new_course_id}/ld-approval`, {
                        status: "Approved",
                        admin_id: currentAdminId,
                        bypass_ceo: isBypass,
                    });
                }
            } catch (err) {
                console.error("Error updating L&D decision in ApprovalsWorkflow:", err);
            }
            setCourseRequests((prev) =>
                prev.map((req) =>
                    req === item || req.id === item.id || req.new_course_id === item.new_course_id
                        ? {
                            ...req,
                            status: "Approved",
                            raw: {
                                ...(req.raw || {}),
                                ld_status: "Approved",
                                ld_status_date: todayIso,
                                is_ceo_bypassed: isBypass,
                                ceo_status: isBypass ? "Approved" : (req.raw?.ceo_status || "Pending"),
                                ceo_status_date: isBypass ? todayIso : req.raw?.ceo_status_date,
                            },
                        }
                        : req
                )
            );
            fetchCourseRequests();
        } else {
            const reqId = item.requestId || item.id;
            try {
                if (reqId) {
                    await axios.put(`${API_BASE_URL}/api/certifications/requests/${reqId}/ld-approval`, {
                        status: "Approved",
                        admin_id: currentAdminId,
                        bypass_ceo: isBypass,
                    });
                }
            } catch (err) {
                console.error("Error approving certification request:", err);
            }
            setCertRequests((prev) =>
                prev.map((req) =>
                    req === item || req.id === item.id || req.requestId === reqId
                        ? {
                            ...req,
                            status: "Approved",
                            raw: {
                                ...(req.raw || {}),
                                ld_status: "Approved",
                                ld_status_date: todayIso,
                                is_ceo_bypassed: isBypass,
                                ceo_status: isBypass ? "Approved" : (req.raw?.ceo_status || "Pending"),
                                ceo_status_date: isBypass ? todayIso : req.raw?.ceo_status_date,
                                status: isBypass ? "Approved" : (req.raw?.status || "Pending"),
                                cert_status_date: isBypass ? todayIso : req.raw?.cert_status_date,
                            },
                        }
                        : req
                )
            );
            fetchCertRequests();
        }

        setSelectedApproval(null);
        setToast({
            isOpen: true,
            type: "success",
            message: isBypass
                ? `Request ${item.id || ""} approved (CEO approval bypassed).`
                : `Request ${item.id || ""} approved and forwarded to CEO.`,
        });
    };

    // Open Reason for Rejection Modal
    const handleReject = (item) => {
        setRejectTarget(item);
    };

    // Confirmed Reject with Reason
    const handleConfirmReject = async (reason) => {
        if (!rejectTarget) return;
        setIsRejecting(true);
        const item = rejectTarget;
        const isCertItem =
            requestType === "cert" ||
            item?.isCertification ||
            item?.type === "Certification";

        try {
            if (!isCertItem) {
                const courseId = item.new_course_id || item.id;
                if (courseId) {
                    await axios.put(`${API_BASE_URL}/api/course-requests/${courseId}/ld-approval`, {
                        status: "Rejected",
                        admin_id: currentAdminId,
                        comment: reason,
                    });
                }
                setCourseRequests((prev) =>
                    (prev || []).map((req) =>
                        req === item || req.id === item.id || req.new_course_id === item.new_course_id
                            ? { ...req, status: "Rejected", reopen_reason: reason }
                            : req
                    )
                );
                fetchCourseRequests();
            } else {
                const reqId = item.requestId || item.id;
                if (reqId) {
                    await axios.put(`${API_BASE_URL}/api/certifications/requests/${reqId}/ld-approval`, {
                        status: "Rejected",
                        admin_id: currentAdminId,
                        comments: reason,
                    });
                }
                setCertRequests((prev) =>
                    (prev || []).map((req) =>
                        req === item || req.id === item.id || req.requestId === reqId
                            ? { ...req, status: "Rejected", reopen_reason: reason }
                            : req
                    )
                );
                fetchCertRequests();
            }

            setRejectTarget(null);
            setSelectedApproval(null);
            setToast({
                isOpen: true,
                type: "success",
                message: `Request ${item.id || item.requestId || ""} has been rejected.`,
            });
        } catch (err) {
            console.error("Error rejecting request in ApprovalsWorkflow:", err);
            setToast({
                isOpen: true,
                type: "error",
                message: "Failed to reject request. Please try again.",
            });
        } finally {
            setIsRejecting(false);
        }
    };

    // Open View Modal
    const handleViewDetails = (item) => {
        setSelectedApproval(item);
    };

    // Open Undo / Reopen Confirmation Dialog
    const handleUndoReject = (item) => {
        setReopenTarget(item);
    };

    // Confirm Undo Rejection Action with reason
    const handleConfirmUndo = async (reopenReason = "Reopened by L&D") => {
        if (!reopenTarget) return;
        setIsReopening(true);
        const item = reopenTarget;
        const reqCode = item.id || item.requestId || "Request";
        const reasonStr = (reopenReason || "Reopened by L&D").trim();

        try {
            if (requestType === "course") {
                const courseId = item.new_course_id || item.id;
                await axios.put(`${API_BASE_URL}/api/course-requests/${courseId}/ld-approval`, {
                    status: "Pending",
                    admin_id: currentAdminId,
                    comment: reasonStr,
                });
                await fetchCourseRequests();
            } else {
                const reqId = item.requestId || item.id;
                await axios.put(`${API_BASE_URL}/api/certifications/requests/${reqId}/ld-approval`, {
                    status: "Pending",
                    admin_id: currentAdminId,
                    comments: reasonStr,
                });
                await fetchCertRequests();
            }

            setToast({
                isOpen: true,
                type: "success",
                message: `Request ${reqCode} has been reopened and returned to Pending.`,
            });
            setReopenTarget(null);
        } catch (err) {
            console.error("Error reopening request:", err);
            setToast({
                isOpen: true,
                type: "error",
                message: `Failed to reopen request ${reqCode}. Please try again.`,
            });
        } finally {
            setIsReopening(false);
        }
    };

    return (
        <div className="ld-approvals-workflow-page">
            {/* 1. Page Header */}
            <PageHeader
                title="Approvals & Workflow Management"
                subtitle="Evaluate and process pending course enrollments, certification requests, and approval histories."
            />

            {/* 2. Top Metric Cards (4 KPI Cards) */}
            <ApprovalStatsCards stats={dynamicStats} isLoading={isStatsLoading} />

            {/* 3. Controls Row (Type Pills & History Button) */}
            <div className="ld-aw-controls-row">
                <div className="ld-aw-type-pills">
                    <button
                        type="button"
                        className={`ld-aw-type-pill ${requestType === "course" ? "active" : ""}`}
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
                        className={`ld-aw-type-pill ${requestType === "cert" ? "active" : ""}`}
                        onClick={() => {
                            setRequestType("cert");
                            setStatusFilter("All");
                            setSearchQuery("");
                        }}
                    >
                        Certification Requests
                    </button>
                    <button
                        type="button"
                        className={`ld-aw-type-pill ${requestType === "reimbursement" ? "active" : ""}`}
                        onClick={() => {
                            setRequestType("reimbursement");
                            setReimbStatusFilter([]);
                            setReimbProviderFilter([]);
                            setSearchQuery("");
                        }}
                    >
                        Reimbursement Request
                    </button>
                </div>
            </div>

            {/* 3b. Search Bar Row (Course & Certification Requests) */}
            {requestType !== "reimbursement" && (
                <div className="ld-aw-search-row">
                    <div className="ld-aw-search-box">
                        <img src={searchIcon} alt="" className="ld-aw-search-icon" />
                        <input
                            type="text"
                            placeholder={
                                requestType === "cert"
                                    ? "Search by Request id, employee id/name or Certification"
                                    : "Search by Request id, employee id/name or course"
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(sanitizeSingleSpaceInput(e.target.value))}
                            className="ld-aw-search-input"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="ld-aw-clear-search-btn"
                                onClick={() => setSearchQuery("")}
                                aria-label="Clear search"
                                title="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 4. Filter Bar (for Reimbursements) OR Status Sub-Tabs (for Courses/Certs) */}
            {requestType === "reimbursement" ? (
                <>
                    <div className="ld-aw-search-row">
                        {/* Search box */}
                        <div className="ld-aw-search-box">
                            <img src={searchIcon} alt="" className="ld-aw-search-icon" />
                            <input
                                type="text"
                                placeholder="Search by Request id, employee id/name..."
                                value={reimbSearchQuery}
                                onChange={(e) => setReimbSearchQuery(sanitizeSingleSpaceInput(e.target.value))}
                                className="ld-aw-search-input"
                            />
                            {reimbSearchQuery && (
                                <button
                                    type="button"
                                    className="ld-aw-clear-search-btn"
                                    onClick={() => setReimbSearchQuery("")}
                                    aria-label="Clear search"
                                    title="Clear search"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sub-tabs below search bar: All, Course, Certification + Filters button */}
                    <div className="ld-aw-status-tabs-row ld-aw-reimb-subtabs-row">
                        <div className="ld-aw-status-tabs">
                            <button
                                type="button"
                                className={`ld-aw-status-tab ${reimbTypeTab === "All" ? "active" : ""}`}
                                onClick={() => setReimbTypeTab("All")}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                className={`ld-aw-status-tab ${reimbTypeTab === "Course" ? "active" : ""}`}
                                onClick={() => setReimbTypeTab("Course")}
                            >
                                Course {isReimbLoading ? "" : `(${reimbCourseCount})`}
                            </button>
                            <button
                                type="button"
                                className={`ld-aw-status-tab ${reimbTypeTab === "Certification" ? "active" : ""}`}
                                onClick={() => setReimbTypeTab("Certification")}
                            >
                                Certification {isReimbLoading ? "" : `(${reimbCertCount})`}
                            </button>
                        </div>

                        {/* Right controls: Filters button */}
                        <div className="ld-aw-status-filter-wrap">
                            <button
                                type="button"
                                className={`ld-cm-filter-btn ${reimbActiveFiltersCount > 0 || isReimbDrawerOpen ? "filtered" : ""}`}
                                onClick={() => setIsReimbDrawerOpen(true)}
                                aria-label="Open Reimbursement Filters"
                            >
                                <img src={filtersIcon} alt="" style={{ width: 14, height: 10 }} />
                                <span>{reimbActiveFiltersCount > 0 ? `Filters (${reimbActiveFiltersCount})` : "Filters"}</span>
                                {reimbActiveFiltersCount > 0 && (
                                    <span
                                        className="ld-cm-clear-cross"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearReimbFilters();
                                        }}
                                        title="Clear filters"
                                    >
                                        ×
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="ld-aw-status-tabs-row">
                    <div className="ld-aw-status-tabs">
                        <button
                            type="button"
                            className={`ld-aw-status-tab ${statusFilter === "All" ? "active" : ""}`}
                            onClick={() => setStatusFilter("All")}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            className={`ld-aw-status-tab ${statusFilter === "Pending" ? "active" : ""}`}
                            onClick={() => setStatusFilter("Pending")}
                        >
                            Pending {activeTabLoading ? "" : `(${pendingCount})`}
                        </button>
                        <button
                            type="button"
                            className={`ld-aw-status-tab ${statusFilter === "Approved" ? "active" : ""}`}
                            onClick={() => setStatusFilter("Approved")}
                        >
                            Approved {activeTabLoading ? "" : `(${approvedCount})`}
                        </button>
                        <button
                            type="button"
                            className={`ld-aw-status-tab ${statusFilter === "Rejected" ? "active" : ""}`}
                            onClick={() => setStatusFilter("Rejected")}
                        >
                            Rejected {activeTabLoading ? "" : `(${rejectedCount})`}
                        </button>
                    </div>

                    <div className="ld-aw-status-filter-wrap">
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
            )}

            {/* 5. Approvals Table Card */}
            {requestType === "course" ? (
                <CourseRequestsTab
                    requests={filteredList || []}
                    isLoading={isCoursesLoading}
                    statusFilter={statusFilter}
                    highlightedItemId={highlightedItemId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onUndoReject={handleUndoReject}
                    onViewDetails={handleViewDetails}
                    currentAdminId={currentAdminId}
                    currentUser={user}
                />
            ) : requestType === "cert" ? (
                <CertificationRequestsTab
                    requests={filteredList || []}
                    isLoading={isCertsLoading}
                    statusFilter={statusFilter}
                    highlightedItemId={highlightedItemId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onUndoReject={handleUndoReject}
                    onViewDetails={handleViewDetails}
                    currentAdminId={currentAdminId}
                    currentUser={user}
                />
            ) : (
                <ReimbursementRequestTab
                    key={reimbTypeTab}
                    reimbursements={filteredReimbursements || []}
                    isLoading={isReimbLoading}
                    highlightedItemId={highlightedItemId}
                />
            )}

            {/* 6. Course Approval Details Modal (With border, bypass switch & approve/reject actions) */}
            <ApprovalDetailsModal
                approval={selectedApproval}
                onClose={() => setSelectedApproval(null)}
                onApprove={handleApprove}
                onReject={handleReject}
                onUndoReject={handleUndoReject}
                currentAdminId={currentAdminId}
                currentUser={user}
            />

            {/* 7. Course / Certification Approval History Modal (5-Step Stepper Pipeline) */}
            <ApprovalHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                historyData={requestType === "course" ? dynamicCourseApprovalHistory : dynamicCertApprovalHistory}
                type={requestType === "course" ? "Course" : "Certification"}
            />

            {/* 8. Reopen / Undo Rejection Confirmation Modal */}
            <ReopenRequestModal
                isOpen={Boolean(reopenTarget)}
                onClose={() => !isReopening && setReopenTarget(null)}
                onConfirm={handleConfirmUndo}
                targetItem={reopenTarget}
                isSubmitting={isReopening}
            />

            {/* 8b. Reject Reason Confirmation Modal */}
            <RejectRequestModal
                isOpen={Boolean(rejectTarget)}
                onClose={() => !isRejecting && setRejectTarget(null)}
                onConfirm={handleConfirmReject}
                targetItem={rejectTarget}
                isSubmitting={isRejecting}
            />

            {/* 9. Top Toast Notification */}
            <TopToastNotification
                isOpen={toast.isOpen}
                type={toast.type}
                message={toast.message}
                duration={4500}
                onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
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

            <ReimbursementFilterDrawer
                isOpen={isReimbDrawerOpen}
                onClose={() => setIsReimbDrawerOpen(false)}
                providers={reimbProviderOptions}
                selectedProviders={
                    reimbProviderFilter.length > 0 ? reimbProviderFilter : reimbDrawerFilters.providers
                }
                statuses={reimbStatusOptions}
                selectedStatuses={
                    reimbStatusFilter.length > 0 ? reimbStatusFilter : reimbDrawerFilters.statuses
                }
                amountLimits={reimbAmountLimits}
                selectedAmountRange={reimbDrawerFilters.amountRange || [reimbAmountLimits.min, reimbAmountLimits.max]}
                selectedSubStartDate={reimbDrawerFilters.subStartDate}
                selectedSubEndDate={reimbDrawerFilters.subEndDate}
                selectedAppStartDate={reimbDrawerFilters.appStartDate}
                selectedAppEndDate={reimbDrawerFilters.appEndDate}
                onApply={handleApplyReimbDrawer}
                onClearAll={handleClearReimbFilters}
            />
        </div>
    );
}
