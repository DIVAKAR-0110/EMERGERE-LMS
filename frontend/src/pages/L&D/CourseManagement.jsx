import React, { useState, useEffect } from "react";
import axios from "axios";
import { ShoppingCart, Users, UserCheck } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";

import PurchaseCourseTab from "../../components/L&D/CourseManagement/PurchaseCourseTab";
import EnrollmentRequestsTab from "../../components/L&D/CourseManagement/EnrollmentRequestsTab";
import AssignCourseTab from "../../components/L&D/CourseManagement/AssignCourseTab";

import RequestOnHoldModal from "../../components/L&D/CourseManagement/RequestOnHoldModal";
import AssignCourseModal from "../../components/L&D/CourseManagement/AssignCourseModal";
import PurchaseCourseModal from "../../components/L&D/CourseManagement/PurchaseCourseModal";
import AddCourseMaterialModal from "../../components/L&D/CourseManagement/AddCourseMaterialModal";
import AssignmentDetailsModal from "../../components/L&D/CourseManagement/AssignmentDetailsModal";
import RequestDetailsModal from "../../components/L&D/CourseManagement/RequestDetailsModal";
import ApprovalDetailsModal from "../../components/hr/ApprovalsWorkflow/ApprovalDetailsModal";
import TopToastNotification from "../../components/common/TopToastNotification";
import cartBlue from '../../assets/coursemanagement/cart.svg';
import cartBlack from '../../assets/coursemanagement/cart-black.svg';
import enrollmentBlue from '../../assets/coursemanagement/enrollment-b.svg';
import enrollmentBlack from '../../assets/coursemanagement/enrollment.svg';
import assignBlue from '../../assets/coursemanagement/assign-b.svg';
import assignBlack from '../../assets/coursemanagement/assigncourse.svg';

import {
    fetchEnrollmentRequests,
    approveEnrollmentRequest,
    holdEnrollmentRequest,
} from "../../services/courseEnrollmentService";
import {
    assignCourseToEmployees,
    fetchAssignedCourses,
} from "../../services/assignCourseService";

import "../../styles/L&D/CourseManagement.css";

const API_BASE_URL =
    typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000");

export default function CourseManagement() {
    const { user } = useAuth();
    const currentAdminId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "EMP010";

    // 3 Navigation Tabs: "purchase" | "requests" | "assign"
    const [activeTab, setActiveTab] = useState("purchase");

    // Data State (initialized to null for skeleton waiting state when offline)
    const [ceoApprovedCourses, setCeoApprovedCourses] = useState(null);
    const [isCeoCoursesLoading, setIsCeoCoursesLoading] = useState(true);
    const [enrollmentRequests, setEnrollmentRequests] = useState(null);
    const [assignedCourses, setAssignedCourses] = useState(null);
    const [toast, setToast] = useState({ isOpen: false, message: "", type: "success" });

    // Fetch live enrollment requests and course assignments from backend
    const loadEnrollments = async () => {
        try {
            const token = localStorage.getItem("lms_token");
            const headers = {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            };
            const [enrollmentData, assignedData, empRes] = await Promise.all([
                fetchEnrollmentRequests().catch(() => []),
                fetchAssignedCourses().catch(() => []),
                axios.get(`${API_BASE_URL}/api/auth/employees`, { headers }).catch(() => null),
            ]);

            const empList = empRes?.data?.employees || (Array.isArray(empRes?.data) ? empRes.data : []);
            const deptMap = {};
            const emailMap = {};
            const idMap = {};
            empList.forEach((e) => {
                const dept = e.department || e.job_title;
                const email = e.email || e.work_email || "";
                const empId = e.employee_id;
                if (e.employee_id && dept) deptMap[e.employee_id.trim().toUpperCase()] = dept;
                if (e.email && dept) deptMap[e.email.trim().toLowerCase()] = dept;
                if (e.name && dept) deptMap[e.name.trim().toLowerCase()] = dept;
                if (e.full_name && dept) deptMap[e.full_name.trim().toLowerCase()] = dept;

                if (e.employee_id && email) emailMap[e.employee_id.trim().toUpperCase()] = email;
                if (e.id && email) emailMap[String(e.id).trim().toUpperCase()] = email;
                if (e.name && email) emailMap[e.name.trim().toLowerCase()] = email;
                if (e.full_name && email) emailMap[e.full_name.trim().toLowerCase()] = email;

                if (e.name && empId) idMap[e.name.trim().toLowerCase()] = empId;
                if (e.full_name && empId) idMap[e.full_name.trim().toLowerCase()] = empId;
                if (e.email && empId) idMap[e.email.trim().toLowerCase()] = empId;
            });
            (Array.isArray(assignedData) ? assignedData : []).forEach((a) => {
                const code = a.employee_code || a.employee_id;
                const dept = a.employee_department;
                const email = a.employee_email;
                if (code && dept) deptMap[code.trim().toUpperCase()] = dept;
                if (a.employee_name && dept) deptMap[a.employee_name.trim().toLowerCase()] = dept;
                if (code && email) emailMap[code.trim().toUpperCase()] = email;
                if (a.employee_name && email) emailMap[a.employee_name.trim().toLowerCase()] = email;
                if (a.employee_name && code) idMap[a.employee_name.trim().toLowerCase()] = code;
            });

            const enrichedEnrollmentData = (Array.isArray(enrollmentData) ? enrollmentData : []).map((req) => {
                const emp = req.employee || {};
                const nameKey = (emp.name || req.employee_name || "").trim().toLowerCase();
                const emailKey = (emp.email || req.employee_email || "").trim().toLowerCase();
                const rawEmpId = emp.empId || emp.employee_id || emp.employeeCode || req.employee_id || idMap[nameKey] || idMap[emailKey] || (nameKey === "vikram malhotra" ? "EMP010" : nameKey === "imran khan" ? "EMP019" : "");
                const empIdKey = rawEmpId.trim().toUpperCase();
                const resolvedDept = (emp.department && String(emp.department).toLowerCase() !== "employee" && emp.department !== "—")
                    ? emp.department
                    : (deptMap[empIdKey] || deptMap[emailKey] || deptMap[nameKey] || (empIdKey === "EMP019" ? "Enterprise Application (Fusefy)" : empIdKey === "EMP010" ? "Learning & Development" : "Enterprise Data & Analytics"));

                return {
                    ...req,
                    employeeId: rawEmpId,
                    department: resolvedDept,
                    employee: {
                        ...emp,
                        empId: rawEmpId,
                        department: resolvedDept,
                    },
                };
            });

            setEnrollmentRequests(enrichedEnrollmentData);

            // Sync all approved enrollments from backend into assignedCourses
            const approvedFromDb = enrichedEnrollmentData
                .filter((r) => (r.status === "Approved" || r.action_status === "Approved") && r.status !== "Pending" && r.status !== "On Hold")
                .map((req) => {
                    const empName = req.employee?.name || "—";
                    const empInitials = req.employee?.initials || empName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                    const empAvatarBg = req.employee?.avatarBg || "#8B5CF6";
                    const empRole = req.employee?.role || "—";
                    const empId = req.employee?.empId || "EMP011";
                    const empDept = req.employee?.department || "—";
                    const empEmail = req.employee?.email || `${empName.toLowerCase().replace(/\s+/g, ".")}@emergertech.com`;

                    const formatDisplayDate = (dStr) => {
                        if (!dStr) return "";
                        try {
                            const d = new Date(dStr);
                            if (isNaN(d.getTime())) return String(dStr);
                            return d.toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                            });
                        } catch {
                            return String(dStr);
                        }
                    };

                    const todayFormatted = new Date().toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    });

                    const rawApprovalDate = req.approvedDate || req.approved_at || req.reviewed_at || req.created_at || req.requestedOn;
                    const assignedDate = formatDisplayDate(rawApprovalDate) || todayFormatted;

                    const rawProg = req.progress ?? req.progress_percentage ?? 0;
                    const numProg = Number(rawProg);
                    const progressVal = isNaN(numProg) ? 0 : (numProg % 1 === 0 ? numProg : Number(numProg.toFixed(1)));
                    const rawStatus = req.learningStatus || req.learning_status;
                    const statusVal = (rawStatus && rawStatus !== "Pending" && rawStatus !== "Assigned")
                        ? rawStatus
                        : (progressVal >= 100 ? "Completed" : progressVal > 0 ? "In Progress" : "Not Started");

                    const asnId = req.assignment_id || req.assignmentCode ||
                        (req.requestId && String(req.requestId).startsWith("ENR-") ? req.requestId : `ENR-2026-${String(req.requestId || 1).padStart(4, "0")}`);
                    const enrId = req.enrollment_code || req.enrollmentCode ||
                        (req.requestId && String(req.requestId).startsWith("ENR-") ? req.requestId : `ENR-2026-${String(req.requestId || 1).padStart(4, "0")}`);
                    return {
                        assignmentId: asnId,
                        assignmentCode: asnId,
                        enrollmentCode: enrId,
                        assignedBy: req.approvedBy || "-",
                        employee: {
                            name: empName,
                            empId: empId,
                            role: empRole,
                            department: empDept,
                            email: empEmail,
                            initials: empInitials,
                            avatarBg: empAvatarBg,
                        },
                        course: req.course,
                        provider: req.provider || "—",
                        courseType: "Purchased Course",
                        assignedOn: assignedDate,
                        status: statusVal,
                        progress: progressVal,
                        approvedEmployees: req.approvedEmployees || req.otherEmployees || [],
                        otherEmployees: req.otherEmployees || [
                            {
                                name: empName,
                                empId: empId,
                                role: empRole,
                                initials: empInitials,
                                avatarBg: empAvatarBg,
                            },
                        ],
                    };
                });

            // Map assignments directly recorded in dbo.lms_LD_assign_course
            const explicitAssigned = (Array.isArray(assignedData) ? assignedData : []).map((a) => {
                const empName = a.employee_name || a.employee_code || "—";
                const empInitials = empName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

                const formatDisplayDate = (dStr) => {
                    if (!dStr) return "";
                    try {
                        const d = new Date(dStr);
                        if (isNaN(d.getTime())) return String(dStr);
                        return d.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        });
                    } catch {
                        return String(dStr);
                    }
                };

                const todayFormatted = new Date().toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                });

                const rawAssignedDate = a.created_at || a.assigned_date || a.learning_starting_date;
                const assignedDate = formatDisplayDate(rawAssignedDate) || todayFormatted;

                const progressVal = Number(a.progress_percentage || 0);
                const statusVal = a.learning_status || (progressVal >= 100 ? "Completed" : progressVal > 0 ? "In Progress" : "Not Started");
                const asnId = a.assignment_id || a.assignment_code ||
                    (a.assign_course_id || a.id ? `ENR-2026-${String(a.assign_course_id || a.id).padStart(4, "0")}` : "-");
                const enrId = a.enrollment_code || a.enrollmentCode ||
                    (a.assign_course_id || a.id ? `ENR-2026-${String(a.assign_course_id || a.id).padStart(4, "0")}` : "-");

                let formattedTargetDate = "";
                if (a.target_completion_date) {
                    formattedTargetDate = formatDisplayDate(a.target_completion_date);
                }

                const empIdCode = a.employee_code || a.employee_id || (a.select_employee_id ? `EMP-${a.select_employee_id}` : "-");
                const resolvedEmail = a.employee_email || emailMap[empIdCode.toUpperCase()] || emailMap[empName.toLowerCase()] || "";
                const resolvedDept = (a.employee_department && String(a.employee_department).toLowerCase() !== "employee" && a.employee_department !== "—")
                    ? a.employee_department
                    : (deptMap[empIdCode.toUpperCase()] || deptMap[empName.toLowerCase()] || "—");

                const sourceLearners = (Array.isArray(a.approved_employees) && a.approved_employees.length > 0)
                    ? a.approved_employees
                    : (Array.isArray(a.other_employees) && a.other_employees.length > 0 ? a.other_employees : []);

                const colleaguesList = sourceLearners.length > 0
                    ? sourceLearners.map((c) => ({
                        name: c.name || c.empId,
                        empId: c.empId || c.employee_id,
                        role: c.role || "—",
                        department: c.department || deptMap[(c.empId || "").toUpperCase()] || "—",
                        email: c.email || emailMap[(c.empId || "").toUpperCase()] || "",
                        initials: c.initials || (c.name || c.empId || "EM").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
                        avatarBg: c.avatarBg || "#8B5CF6",
                    }))
                    : [
                        {
                            name: empName,
                            empId: empIdCode,
                            role: a.employee_role || "—",
                            department: resolvedDept,
                            email: resolvedEmail,
                            initials: empInitials,
                            avatarBg: "#3B82F6",
                        }
                    ];

                return {
                    assignmentId: asnId,
                    assignmentCode: asnId,
                    enrollmentCode: enrId,
                    assignedBy: a.created_by_name || "-",
                    employeeName: empName,
                    employeeCode: empIdCode,
                    employeeDepartment: resolvedDept,
                    employeeEmail: resolvedEmail,
                    employee_email: resolvedEmail,
                    employee: {
                        name: empName,
                        empId: empIdCode,
                        role: a.employee_role || "—",
                        department: resolvedDept,
                        email: resolvedEmail,
                        initials: empInitials,
                        avatarBg: "#3B82F6",
                    },
                    course: a.course_title || "—",
                    provider: a.provider || a.provider_name || "—",
                    courseType: "Purchased Course",
                    assignedOn: assignedDate,
                    startDate: formatDisplayDate(a.learning_starting_date) || assignedDate,
                    targetDate: formattedTargetDate,
                    assignmentNote: a.assignment_note || "",
                    status: statusVal,
                    progress: progressVal,
                    approvedEmployees: a.approved_employees || a.other_employees || colleaguesList,
                    otherEmployees: colleaguesList
                };
            });

            // Combine both sources
            const mergedMap = new Map();
            for (const item of explicitAssigned) {
                const key = `${(item.assignmentId || "").toLowerCase()}_${(item.employee?.empId || "").toLowerCase()}`;
                mergedMap.set(key, item);
            }
            for (const item of approvedFromDb) {
                const key = `${(item.assignmentId || "").toLowerCase()}_${(item.employee?.empId || "").toLowerCase()}`;
                if (!mergedMap.has(key)) {
                    mergedMap.set(key, item);
                }
            }

            setAssignedCourses(Array.from(mergedMap.values()));
        } catch (err) {
            console.error("Failed to load enrollment requests & assigned courses:", err);
            setEnrollmentRequests(null);
            setAssignedCourses(null);
        }
    };

    // Fetch live CEO-approved courses ready for purchase (including already purchased and L&D self-purchased courses)
    const fetchCeoApprovedCourses = async () => {
        setIsCeoCoursesLoading(true);
        try {
            const token = localStorage.getItem("lms_token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const [requestsData, coursesData, empRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/course-requests?stage=ceo_approved`, { headers })
                    .then((r) => (r.ok ? r.json() : []))
                    .catch((err) => {
                        console.warn("[CourseManagement] Error loading course requests:", err);
                        return [];
                    }),
                fetch(`${API_BASE_URL}/api/courses`, { headers })
                    .then((r) => (r.ok ? r.json() : []))
                    .catch((err) => {
                        console.warn("[CourseManagement] Error loading courses:", err);
                        return [];
                    }),
                axios.get(`${API_BASE_URL}/api/auth/employees`, { headers }).catch(() => null),
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

            const coursesMapByRequestId = new Map();
            const coursesMapByClaimId = new Map();
            (Array.isArray(coursesData) ? coursesData : []).forEach((c) => {
                if (c.request_id) {
                    coursesMapByRequestId.set(Number(c.request_id), c);
                }
                if (c.claim_id) {
                    coursesMapByClaimId.set(String(c.claim_id).trim().toUpperCase(), c);
                }
            });

            const mappedRequests = (Array.isArray(requestsData) ? requestsData : []).map((r, idx) => {
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
                    : "20 May 2026";

                const appDate = r.ceo_status_date
                    ? new Date(r.ceo_status_date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    })
                    : "Today";

                const linkedCourse =
                    coursesMapByRequestId.get(Number(r.id)) ||
                    (r.request_code ? coursesMapByClaimId.get(String(r.request_code).trim().toUpperCase()) : null) ||
                    (r.claim_id ? coursesMapByClaimId.get(String(r.claim_id).trim().toUpperCase()) : null);

                const isPurchased =
                    (r.purchase_status || "").trim().toLowerCase() === "purchased" ||
                    Boolean(r.is_purchased) ||
                    Boolean(linkedCourse);

                const isDirectPurchase = (r.request_code || "").startsWith("PUR-");
                const reqName = isDirectPurchase
                    ? (r.employee_name && !r.employee_name.startsWith("Employee ") ? r.employee_name : "L&D Team")
                    : (r.employee_name || "Employee");
                const nameKey = reqName.trim().toLowerCase();
                const reqEmpId = r.employee_id || r.employeeId || idMap[nameKey] || (nameKey === "vikram malhotra" ? "EMP010" : isDirectPurchase ? "EMP010" : "");
                const reqDept = r.department || deptMap[nameKey] || deptMap[(reqEmpId || "").toUpperCase()] || r.employee_department || r.employee_role || (nameKey === "vikram malhotra" ? "Learning & Development" : "Product Operations");
                const reqRole = reqDept;
                const resolvedInitials = reqName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                const paymentStatus = linkedCourse?.payment_status || r.payment_status || (linkedCourse?.paid_on ? "Paid" : "Pending Payment");
                const paymentCode = linkedCourse?.payment_code || r.payment_code;
                const paidOn = linkedCourse?.paid_on || r.paid_on;
                const paymentSlipPath = linkedCourse?.payment_slip_path || r.payment_slip_path;
                const paymentSlipName = linkedCourse?.payment_slip_name || r.payment_slip_name;
                const paymentDescription = linkedCourse?.payment_description || r.payment_description;

                return {
                    id: r.id,
                    new_course_id: r.id,
                    course_id: linkedCourse?.id || r.id,
                    requestId: r.request_code || (r.id ? `REQ-2026-${String(r.id).padStart(4, '0')}` : "—"),
                    requestCode: r.request_code,
                    courseRequestId: r.request_code,
                    courseTitle: r.course_name,
                    courseName: r.course_name,
                    courseUrl: r.course_link || "",
                    provider: r.provider,
                    category: r.category,
                    department: reqDept,
                    empId: reqEmpId,
                    employee_id: reqEmpId,
                    employeeName: reqName,
                    requestedBy: {
                        name: reqName,
                        empId: reqEmpId,
                        department: reqDept,
                        role: reqRole,
                        initials: resolvedInitials,
                        avatarBg: ["#F97FFF", "#38BDF8", "#34D399", "#FBBF24", "#A78BFA"][idx % 5],
                    },
                    requestDate: reqDate,
                    approvedDate: appDate,
                    estimatedCost: r.price,
                    price: r.price ? `₹${Number(r.price).toLocaleString()}` : "—",
                    amount: r.price ? `₹${Number(r.price).toLocaleString()}` : "—",
                    description: r.reason,
                    whyLearn: r.reason,
                    status: isDirectPurchase || isPurchased ? "Purchased" : (r.purchase_status || "Approved"),
                    isPurchased: isPurchased || isDirectPurchase,
                    payment_status: paymentStatus,
                    payment_code: paymentCode,
                    paid_on: paidOn,
                    payment_slip_path: paymentSlipPath,
                    payment_slip_name: paymentSlipName,
                    payment_description: paymentDescription,
                    raw: r,
                    rawDate: r.created_at || r.ceo_status_date || new Date().toISOString()
                };
            });

            // Map L&D self-purchased courses from dbo.lms_courses (claim_id starts with PUR-)
            const selfPurchasedList = (Array.isArray(coursesData) ? coursesData : []).filter((c) => {
                const claim = (c.claim_id || "").trim();
                return claim.startsWith("PUR-");
            });

            let loggedInName = "Vikram Malhotra";
            try {
                const rawUser = localStorage.getItem("lms_user");
                if (rawUser) {
                    const parsed = JSON.parse(rawUser);
                    if (parsed?.name || parsed?.full_name) loggedInName = parsed.name || parsed.full_name;
                }
            } catch (_) { }

            const mappedSelfPurchased = selfPurchasedList.map((c, idx) => {
                const reqName = c.employee_name && !c.employee_name.startsWith("Employee ")
                    ? c.employee_name
                    : loggedInName;
                const nameKey = reqName.trim().toLowerCase();
                const reqEmpId = c.employee_id || c.employee_code || idMap[nameKey] || (nameKey === "vikram malhotra" ? "EMP010" : "EMP010");
                const reqDept = c.department || deptMap[nameKey] || deptMap[(reqEmpId || "").toUpperCase()] || c.employee_department || "Learning & Development";
                const reqRole = reqDept;
                const resolvedInitials = reqName
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
                    : "Today";

                const appDate = c.hr_reviewed_at || c.created_at
                    ? new Date(c.hr_reviewed_at || c.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    })
                    : reqDate;

                return {
                    id: `pur-${c.id}`,
                    course_id: c.id,
                    new_course_id: c.id,
                    requestId: c.claim_id || `PUR-2026-${String(c.id).padStart(4, "0")}`,
                    requestCode: c.claim_id || `PUR-2026-${String(c.id).padStart(4, "0")}`,
                    courseRequestId: c.claim_id,
                    courseTitle: c.course_title,
                    courseName: c.course_title,
                    courseUrl: c.course_url || "",
                    provider: c.provider_name || c.provider,
                    category: c.category_name || c.category,
                    department: reqDept,
                    empId: reqEmpId,
                    employee_id: reqEmpId,
                    employeeName: reqName,
                    requestedBy: {
                        name: reqName,
                        empId: reqEmpId,
                        department: reqDept,
                        role: reqRole,
                        initials: resolvedInitials,
                        avatarBg: ["#34D399", "#38BDF8", "#F97FFF", "#FBBF24", "#A78BFA"][idx % 5],
                    },
                    requestDate: reqDate,
                    approvedDate: appDate,
                    estimatedCost: c.price,
                    price: c.price ? `₹${Number(c.price).toLocaleString()}` : "—",
                    amount: c.price ? `₹${Number(c.price).toLocaleString()}` : "—",
                    description: c.description,
                    whyLearn: c.description,
                    status: "Purchased",
                    purchase_status: "Purchased",
                    payment_status: c.payment_status || (c.paid_on ? "Paid" : "Pending Payment"),
                    payment_code: c.payment_code,
                    paid_on: c.paid_on,
                    payment_slip_path: c.payment_slip_path,
                    payment_slip_name: c.payment_slip_name,
                    payment_description: c.payment_description,
                    isPurchased: true,
                    isSelfPurchased: true,
                    raw: c,
                    rawDate: c.created_at || new Date().toISOString()
                };
            });

            // Combine both sets and sort by rawDate descending so newest additions appear at the top
            const combined = [...mappedSelfPurchased, ...mappedRequests];
            combined.sort((a, b) => {
                const da = new Date(a.rawDate || 0).getTime();
                const db = new Date(b.rawDate || 0).getTime();
                return db - da;
            });

            setCeoApprovedCourses(combined);
        } catch (err) {
            console.warn("[CourseManagement] Error loading live CEO approved courses, using fallback:", err);
            setCeoApprovedCourses([]);
        } finally {
            setIsCeoCoursesLoading(false);
        }
    };

    useEffect(() => {
        loadEnrollments();
        fetchCeoApprovedCourses();
    }, []);

    // Modals State
    const [isOnHoldModalOpen, setIsOnHoldModalOpen] = useState(false);
    const [selectedHoldRequest, setSelectedHoldRequest] = useState(null);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignModalCourseId, setAssignModalCourseId] = useState("");

    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [selectedPurchaseCourse, setSelectedPurchaseCourse] = useState(null);

    const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);

    // Assignment Details modal (eye icon in Assign Course tab)
    const [isAssignmentDetailsOpen, setIsAssignmentDetailsOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);

    // Request Details modal (eye icon in Purchase Course & Enrollment Requests tabs)
    const [isRequestDetailsOpen, setIsRequestDetailsOpen] = useState(false);
    const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);

    // Course Approval Details modal (eye icon on purchased courses in Purchase Course tab)
    const [selectedApprovalDetail, setSelectedApprovalDetail] = useState(null);

    // ── Handlers ──────────────────────────────────────────────

    // Purchase Action — opens AddCourseMaterialModal pre-filled with the row's course data
    const handlePurchaseClick = (course) => {
        setSelectedPurchaseCourse(course);
        setIsAddCourseModalOpen(true);
    };

    const handleConfirmPurchase = (purchaseData) => {
        setCeoApprovedCourses((prev) =>
            prev.map((c) =>
                (c.id === purchaseData.id || c.courseTitle === purchaseData.courseTitle)
                    ? { ...c, status: "Purchased", isPurchased: true }
                    : c
            )
        );
    };

    // Approve Request Action: moves request to Assign Course with status 'Not Started' and progress 0%
    const inFlightActionsRef = React.useRef(new Set());

    const handleApproveRequest = async (requestItem) => {
        const requesterId = requestItem?.employee?.empId || requestItem?.employeeId || requestItem?.employee_id || requestItem?.raw?.employee_id;
        if (currentAdminId && requesterId && String(requesterId).trim().toUpperCase() === String(currentAdminId).trim().toUpperCase()) {
            setToast({
                isOpen: true,
                message: "You cannot approve your own enrollment request. Another L&D team member must review it.",
                type: "error",
            });
            return;
        }

        const lockKey = `approve:${requestItem.requestId}`;
        if (inFlightActionsRef.current.has(lockKey)) return;
        // Pre-check: if course license is full (4/4), immediately show the custom notice toast
        if (requestItem.isFull || requestItem.activeUsers === "4/4") {
            setToast({
                isOpen: true,
                message: "Cannot approve: Maximum of 4 members already reached.",
                type: "error",
            });
            return;
        }

        inFlightActionsRef.current.add(lockKey);
        try {
            await approveEnrollmentRequest(requestItem.requestId);

            const empName = requestItem.employee?.name || "—";
            const empInitials = requestItem.employee?.initials || empName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            const empAvatarBg = requestItem.employee?.avatarBg || "#8B5CF6";
            const empRole = requestItem.employee?.role || "—";
            const empId = requestItem.employee?.empId || "EMP011";
            const empDept = requestItem.employee?.department || "—";
            const empEmail = requestItem.employee?.email || `${empName.toLowerCase().replace(/\s+/g, ".")}@emergertech.com`;

            const todayFormatted = new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });

            const newAssignmentCode = requestItem.enrollment_code || requestItem.enrollmentCode ||
                (requestItem.requestId && String(requestItem.requestId).startsWith("ENR-") ? requestItem.requestId : `ENR-2026-${String(requestItem.requestId || 1).padStart(4, "0")}`);

            const newAssignment = {
                assignmentId: newAssignmentCode,
                enrollmentCode: newAssignmentCode,
                assignedBy: "-",
                employee: {
                    name: empName,
                    empId: empId,
                    role: empRole,
                    department: empDept,
                    email: empEmail,
                    initials: empInitials,
                    avatarBg: empAvatarBg,
                },
                course: requestItem.course,
                provider: requestItem.provider || "—",
                courseType: "Purchased Course",
                assignedOn: todayFormatted,
                status: "Not Started",
                progress: 0,
                otherEmployees: requestItem.otherEmployees || [
                    {
                        name: empName,
                        empId: empId,
                        role: empRole,
                        initials: empInitials,
                        avatarBg: empAvatarBg,
                    },
                ],
            };

            // Prepend to assignedCourses so it immediately shows at the top of the Assign Course tab
            setAssignedCourses((prev) => [newAssignment, ...prev.filter((a) => a.assignmentId !== newAssignment.assignmentId)]);

            // Mark as approved in enrollmentRequests state
            setEnrollmentRequests((prev) =>
                prev.map((req) =>
                    req.requestId === requestItem.requestId
                        ? { ...req, status: "Approved" }
                        : req
                )
            );
            await loadEnrollments();
            const courseTitle = typeof requestItem.course === "object"
                ? (requestItem.course?.title || requestItem.course?.course_name || requestItem.course?.courseTitle || "—")
                : (requestItem.course || requestItem.courseTitle || requestItem.course_name || "—");

            setToast({
                isOpen: true,
                message: `Enrollment approved for "${empName}" - ${courseTitle}.`,
                type: "success",
            });
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Failed to approve request:", err);
            const errorMsg = err.response?.data?.detail || "Cannot approve: Maximum of 4 members already reached.";
            setToast({
                isOpen: true,
                message: errorMsg,
                type: "error",
            });
        } finally {
            inFlightActionsRef.current.delete(lockKey);
        }
    };

    // Open Hold Modal Action
    const handleOpenHoldModal = (requestItem) => {
        const requesterId = requestItem?.employee?.empId || requestItem?.employeeId || requestItem?.employee_id || requestItem?.raw?.employee_id;
        if (currentAdminId && requesterId && String(requesterId).trim().toUpperCase() === String(currentAdminId).trim().toUpperCase()) {
            setToast({
                isOpen: true,
                message: "You cannot put your own enrollment request on hold. Another L&D team member must review it.",
                type: "error",
            });
            return;
        }
        setSelectedHoldRequest(requestItem);
        setIsOnHoldModalOpen(true);
    };

    // Submit Hold Action
    const handleSubmitHold = async (requestItem, reason) => {
        try {
            await holdEnrollmentRequest(requestItem.requestId, reason);
            const todayFormatted = new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });

            setEnrollmentRequests((prev) =>
                prev.map((req) =>
                    req.requestId === requestItem.requestId
                        ? {
                            ...req,
                            status: "On Hold",
                            onHoldDate: todayFormatted,
                            onHoldReason: reason,
                        }
                        : req
                )
            );
            loadEnrollments();
            const holdCourseTitle = typeof requestItem.course === "object"
                ? (requestItem.course?.title || requestItem.course?.course_name || requestItem.course?.courseTitle || "—")
                : (requestItem.course || requestItem.courseTitle || requestItem.course_name || "—");

            setToast({
                isOpen: true,
                message: `Request for "${holdCourseTitle}" placed on hold.`,
                type: "warning",
            });
        } catch (err) {
            console.error("Failed to place request on hold:", err);
            setToast({
                isOpen: true,
                message: err.response?.data?.detail || "Failed to put request on hold.",
                type: "error",
            });
        }
    };

    // Assign Course Action
    const handleAssignCourseSubmit = async (newAssignmentData) => {
        try {
            const courseId = Number(newAssignmentData.course?.id || newAssignmentData.course?.course_id || 1);
            const employeeIds = newAssignmentData.employees.map((e) => e.code || e.empId || e.id);
            await assignCourseToEmployees(
                {
                    course_id: courseId,
                    employee_ids: employeeIds,
                    learning_starting_date: newAssignmentData.startDate,
                    target_completion_date: newAssignmentData.targetDate,
                    assignment_note: newAssignmentData.note,
                },
                undefined,
                newAssignmentData.idempotencyKey
            );
            await loadEnrollments();
            setToast({
                isOpen: true,
                message: "Course successfully assigned to the selected employees.",
                type: "success",
            });
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Failed to assign course:", err);
            setToast({
                isOpen: true,
                message: err.response?.data?.detail || "Failed to assign course to employees.",
                type: "error",
            });
        }

    };

    // View Assignment Details (eye icon in Assign tab)
    const handleViewAssignmentDetails = (assignment) => {
        setSelectedAssignment(assignment);
        setIsAssignmentDetailsOpen(true);
    };

    return (
        <div className="ld-course-management-page">
            {/* 1. Page Header */}
            <PageHeader
                title="Course Management"
                subtitle="Oversee course procurement, enrollment approvals, and employee learning assignments."
            />

            {/* 2. Top Segment Navigation Tabs */}
            <div className="ld-cm-tabs-card" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "purchase"}
                    className={`ld-cm-tab-btn ${activeTab === "purchase" ? "active" : ""}`}
                    onClick={() => setActiveTab("purchase")}
                >
                    <img
                        src={activeTab === "purchase" ? cartBlue : cartBlack}
                        className="ld-cm-tab-icon"
                        alt="Purchase Course"
                    />
                    <span>Purchase Course</span>
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "requests"}
                    className={`ld-cm-tab-btn ${activeTab === "requests" ? "active" : ""}`}
                    onClick={() => setActiveTab("requests")}
                >
                    <img
                        src={activeTab === "requests" ? enrollmentBlue : enrollmentBlack}
                        className="ld-cm-tab-icon"
                        alt="Enrollment Requests"
                    />
                    <span>Enrollment Requests</span>
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "assign"}
                    className={`ld-cm-tab-btn ${activeTab === "assign" ? "active" : ""}`}
                    onClick={() => setActiveTab("assign")}
                >
                    <img
                        src={activeTab === "assign" ? assignBlue : assignBlack}
                        className="ld-cm-tab-icon"
                        alt="Assign Course"
                    />
                    <span>Assign Course</span>
                </button>
            </div>

            {/* 3. Tab Content */}
            {activeTab === "purchase" && (
                <PurchaseCourseTab
                    courses={ceoApprovedCourses || []}
                    isLoading={isCeoCoursesLoading}
                    onPurchaseClick={handlePurchaseClick}
                    onOpenPurchaseModal={() => setIsAddCourseModalOpen(true)}
                    onViewDetails={(course) => {
                        setSelectedRequestDetails(course);
                        setIsRequestDetailsOpen(true);
                    }}
                    onViewApprovalDetails={(course) => {
                        setSelectedApprovalDetail(course);
                    }}
                    currentAdminId={currentAdminId}
                    currentUser={user}
                />
            )}

            {activeTab === "requests" && (
                <EnrollmentRequestsTab
                    requests={enrollmentRequests || []}
                    isLoading={enrollmentRequests === null}
                    onApprove={handleApproveRequest}
                    onOpenHoldModal={handleOpenHoldModal}
                    onViewDetails={(req) => {
                        setSelectedRequestDetails(req);
                        setIsRequestDetailsOpen(true);
                    }}
                    currentAdminId={currentAdminId}
                    currentUser={user}
                />
            )}

            {activeTab === "assign" && (
                <AssignCourseTab
                    assignments={assignedCourses || []}
                    isLoading={assignedCourses === null}
                    onOpenAssignModal={() => setIsAssignModalOpen(true)}
                    onViewAssignmentDetails={handleViewAssignmentDetails}
                    currentAdminId={currentAdminId}
                    currentUser={user}
                />
            )}

            {/* 4. Modals */}
            <RequestOnHoldModal
                isOpen={isOnHoldModalOpen}
                onClose={() => setIsOnHoldModalOpen(false)}
                request={selectedHoldRequest}
                onSubmit={handleSubmitHold}
            />

            <AssignCourseModal
                isOpen={isAssignModalOpen}
                onClose={() => {
                    setIsAssignModalOpen(false);
                    setAssignModalCourseId("");
                }}
                onAssign={async (data) => {
                    await handleAssignCourseSubmit(data);
                    setAssignModalCourseId("");
                }}
                initialCourseId={assignModalCourseId}
            />

            <PurchaseCourseModal
                isOpen={isPurchaseModalOpen}
                onClose={() => setIsPurchaseModalOpen(false)}
                initialCourse={selectedPurchaseCourse}
                onPurchase={handleConfirmPurchase}
            />

            <AddCourseMaterialModal
                isOpen={isAddCourseModalOpen}
                onClose={() => {
                    setIsAddCourseModalOpen(false);
                    setSelectedPurchaseCourse(null);
                }}
                onAdded={() => {
                    fetchCeoApprovedCourses();
                    loadEnrollments();
                }}
                onProceedToAssign={(addedCourse) => {
                    setIsAddCourseModalOpen(false);
                    setSelectedPurchaseCourse(null);
                    setActiveTab("assign");
                    const cId = addedCourse?.courseId || addedCourse?.id || addedCourse?.course_id || "";
                    setAssignModalCourseId(cId ? String(cId) : "");
                    setIsAssignModalOpen(true);
                }}
                initialCourse={selectedPurchaseCourse}
            />

            <AssignmentDetailsModal
                isOpen={isAssignmentDetailsOpen}
                onClose={() => setIsAssignmentDetailsOpen(false)}
                assignment={selectedAssignment}
            />

            <RequestDetailsModal
                isOpen={isRequestDetailsOpen}
                onClose={() => setIsRequestDetailsOpen(false)}
                course={selectedRequestDetails}
                onApprove={handleApproveRequest}
                onOpenHoldModal={handleOpenHoldModal}
                currentAdminId={currentAdminId}
                currentUser={user}
            />

            {selectedApprovalDetail && (
                <ApprovalDetailsModal
                    approval={selectedApprovalDetail}
                    requestType="course"
                    readOnly={true}
                    onClose={() => setSelectedApprovalDetail(null)}
                />
            )}

            <TopToastNotification
                isOpen={toast.isOpen}
                type={toast.type}
                message={toast.message}
                duration={5000}
                onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
