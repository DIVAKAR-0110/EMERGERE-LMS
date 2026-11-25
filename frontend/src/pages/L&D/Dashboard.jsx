import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";

// Modular Components from src/components/L&D/Dashboard
import StatCards from "../../components/L&D/Dashboard/StatCards";
import LearningCompletionRate from "../../components/L&D/Dashboard/LearningCompletionRate";
import PendingApprovals from "../../components/L&D/Dashboard/PendingApprovals";
import LearningByDepartment from "../../components/common/LearningByDepartment";
import TopCertificationDomains from "../../components/L&D/Dashboard/TopCertificationDomains";
import ApprovalDetailsModal from "../../components/L&D/Dashboard/ApprovalDetailsModal";
import RejectRequestModal from "../../components/L&D/ApprovalsWorkflow/RejectRequestModal";
import { fetchDepartmentLearningStats } from "../../services/teamService";

import "../../styles/L&D/Dashboard.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Fallback chart data used until a dedicated backend analytics endpoint is added
const FALLBACK_LEARNING_COMPLETION = {
    overall: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    trendVsLastMonth: 0,
    trendDirection: "neutral",
};

export default function LDDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const currentAdminId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "";
    const scrollContainerRef = useRef(null);

    // KPI stats
    const [totalCoursesCount, setTotalCoursesCount] = useState(null);
    const [totalEmployeesCount, setTotalEmployeesCount] = useState(null);
    const [activeLearnersCount, setActiveLearnersCount] = useState(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // Pending approvals
    const [approvals, setApprovals] = useState(null);
    const [selectedApproval, setSelectedApproval] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [isRejecting, setIsRejecting] = useState(false);

    // Chart data (initialized to null for loading skeleton, populated exclusively from live backend)
    const [learningCompletion, setLearningCompletion] = useState(null);
    const [learningByDepartment, setLearningByDepartment] = useState(null);
    const [topCertificationDomains, setTopCertificationDomains] = useState(null);

    // Build dashboardStats from live counts (Option B: single-digit 0 format)
    const dashboardStats = [
        { key: "employees", label: "Total Employees", value: totalEmployeesCount !== null ? String(totalEmployeesCount) : null, icon: "Users" },
        { key: "learners", label: "Active Learners", value: activeLearnersCount !== null ? String(activeLearnersCount) : null, icon: "BookOpenCheck" },
        { key: "courses", label: "Total Courses", value: totalCoursesCount !== null ? String(totalCoursesCount) : null, icon: "GraduationCap" },
        { key: "pending", label: "Pending Approvals", value: approvals !== null ? String(approvals.length) : null, icon: "AlertTriangle" },
    ];

    // Fetch live pending approvals for L&D (both courses and certifications)
    const fetchPendingApprovals = async () => {
        try {
            const [courseRes, certRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/course-requests?stage=pending_ld`).catch(() => null),
                axios.get(`${API_BASE_URL}/api/certifications/requests?stage=pending_ld`).catch(() => null),
            ]);

            if (!courseRes && !certRes) {
                setApprovals([]);
                return;
            }

            const mappedCourses = Array.isArray(courseRes.data) ? courseRes.data.map((r) => {
                const reqDate = r.created_at
                    ? new Date(r.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                    }).replace(/\//g, "-")
                    : "Today";

                return {
                    id: r.id,
                    new_course_id: r.id,
                    requestId: r.request_code,
                    type: "Course Request",
                    isCertification: false,
                    name: r.employee_name,
                    detail: `${r.course_name} · ${r.provider}`,
                    amount: (r.price && Number(r.price) > 0)
                        ? `₹${Number(r.price).toLocaleString()}`
                        : null,
                    date: reqDate,
                    courseName: r.course_name,
                    course: r.course_name,
                    provider: r.provider,
                    platform: r.provider,
                    category: r.category,
                    courseLink: r.course_link,
                    whyLearn: r.reason || "Course requested by employee for skill advancement.",
                    raw: r
                };
            }) : [];

            const mappedCerts = Array.isArray(certRes.data) ? certRes.data.map((r) => {
                const reqDate = r.created_at
                    ? new Date(r.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                    }).replace(/\//g, "-")
                    : "Today";

                return {
                    id: `cert-${r.id}`,
                    certId: r.id,
                    requestId: r.request_code || `CLM-2026-${String(r.id).padStart(4, "0")}`,
                    type: "Certification Request",
                    isCertification: true,
                    name: r.employee_name || "—",
                    detail: `${r.certification_name || "—"} · ${r.provider_name || "—"}`,
                    amount: (r.estimated_cost_inr && Number(r.estimated_cost_inr) > 0)
                        ? `₹${Number(r.estimated_cost_inr).toLocaleString()}`
                        : null,
                    date: reqDate,
                    courseName: r.certification_name,
                    course: r.certification_name,
                    provider: r.provider_name || "—",
                    platform: r.provider_name || "—",
                    category: r.category_name || "—",
                    scheduledExamDate: r.scheduled_exam_date,
                    whyLearn: r.purpose || "—",
                    raw: r
                };
            }) : [];

            const allPending = [...mappedCourses, ...mappedCerts].sort((a, b) => {
                const timeA = a.raw?.created_at ? new Date(a.raw.created_at).getTime() : 0;
                const timeB = b.raw?.created_at ? new Date(b.raw.created_at).getTime() : 0;
                return timeB - timeA;
            });
            setApprovals(allPending);
        } catch (err) {
            console.warn("[LDDashboard] Error fetching live pending approvals:", err);
            setApprovals([]);
        }
    };

    // Fetch live total courses count from lms_courses table
    const fetchTotalCourses = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/courses`);
            if (Array.isArray(res.data)) {
                setTotalCoursesCount(res.data.length);
            } else {
                setTotalCoursesCount(0);
            }
        } catch (err) {
            console.warn("[LDDashboard] Error fetching live courses count:", err);
            setTotalCoursesCount(0);
        }
    };

    // Fetch live total employees
    const fetchTotalEmployees = async () => {
        try {
            const token = localStorage.getItem("lms_token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE_URL}/api/auth/employees`, { headers });
            if (res.data) {
                const count = res.data.total ?? (Array.isArray(res.data.employees) ? res.data.employees.length : (Array.isArray(res.data) ? res.data.length : 0));
                setTotalEmployeesCount(count);
            } else {
                setTotalEmployeesCount(0);
            }
        } catch (err) {
            console.warn("[LDDashboard] Error fetching employee count:", err);
            setTotalEmployeesCount(0);
        }
    };

    // Fetch active learners (distinct employees with active / in-progress enrollment)
    const fetchActiveLearners = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/enrollments`);
            if (Array.isArray(res.data)) {
                const activeEnrollments = res.data.filter((e) => {
                    const status = (e.status || "").toLowerCase();
                    const prog = parseFloat(e.progress_percentage) || 0;
                    return (["in progress", "active"].includes(status) || (prog > 0 && prog < 100)) && status !== "completed" && prog < 100;
                });
                const uniqueLearners = new Set(activeEnrollments.map((e) => e.employee_id));
                setActiveLearnersCount(uniqueLearners.size);
            } else {
                setActiveLearnersCount(0);
            }
        } catch (err) {
            console.warn("[LDDashboard] Error fetching active learners:", err);
            setActiveLearnersCount(0);
        }
    };

    // Fetch live company learning completion stats and active learners
    const fetchLearningCompletionStats = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/enrollments/company-completion-stats`);
            if (res.data) {
                setLearningCompletion({
                    overall: res.data.overall !== undefined ? res.data.overall : '-',
                    completed: res.data.completed !== undefined ? res.data.completed : '-',
                    inProgress: res.data.inProgress !== undefined ? res.data.inProgress : '-',
                    notStarted: res.data.notStarted !== undefined ? res.data.notStarted : '-',
                    trendVsLastMonth: res.data.trendVsLastMonth !== undefined ? res.data.trendVsLastMonth : '-',
                    trendDirection: res.data.trendDirection || "up",
                });
                if (res.data.activeLearners !== undefined) {
                    setActiveLearnersCount(res.data.activeLearners);
                }
            }
        } catch (err) {
            console.warn("[LDDashboard] Error fetching company completion stats:", err);
        }
    };

    // Fetch live learning by department
    const fetchDepartmentLearning = async () => {
        try {
            const token = localStorage.getItem("lms_token");
            const res = await fetchDepartmentLearningStats(token);
            if (Array.isArray(res) && res.length > 0) {
                setLearningByDepartment(res);
            } else {
                setLearningByDepartment([]);
            }
        } catch (err) {
            console.warn("[LDDashboard] Error fetching department learning:", err);
            setLearningByDepartment([]);
        }
    };

    // Fetch live top certification domains from lms_employee_certificates
    const fetchTopCertificationDomains = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/employee/certifications/top-domains`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                setTopCertificationDomains(res.data);
            } else {
                setTopCertificationDomains([]);
            }
        } catch (err) {
            console.warn("[LDDashboard] Error fetching top certification domains:", err);
            setTopCertificationDomains([]);
        }
    };

    useEffect(() => {
        const loadKpiStats = async () => {
            setIsLoadingStats(true);
            await Promise.allSettled([
                fetchPendingApprovals(),
                fetchTotalCourses(),
                fetchTotalEmployees(),
                fetchActiveLearners(),
            ]);
            setIsLoadingStats(false);
        };

        loadKpiStats();
        fetchLearningCompletionStats();
        fetchDepartmentLearning();
        fetchTopCertificationDomains();
    }, []);

    const handleApprove = async (item, bypassCeo = false) => {
        if (item.isCertification) {
            const certId = item.certId || item.id;
            try {
                await axios.put(`${API_BASE_URL}/api/certifications/requests/${certId}/ld-approval`, {
                    status: "Approved",
                    admin_id: currentAdminId,
                    bypass_ceo: Boolean(bypassCeo),
                });
            } catch (err) {
                console.error("Error approving certification request:", err);
            }
            setApprovals((prev) => prev.filter((a) => a !== item && a.id !== item.id && a.certId !== certId));
        } else {
            const id = item.new_course_id || item.id;
            try {
                await axios.put(`${API_BASE_URL}/api/course-requests/${id}/ld-approval`, {
                    status: "Approved",
                    admin_id: currentAdminId,
                    bypass_ceo: Boolean(bypassCeo),
                });
            } catch (err) {
                console.error("Error approving course request:", err);
            }
            setApprovals((prev) => prev.filter((a) => a.id !== item.id && a.new_course_id !== id));
        }
        if (selectedApproval && (selectedApproval === item || selectedApproval.id === item.id)) {
            setSelectedApproval(null);
        }
    };

    const handleReject = (item) => {
        setRejectTarget(item);
    };

    const handleConfirmReject = async (reason) => {
        if (!rejectTarget) return;
        setIsRejecting(true);
        const item = rejectTarget;
        try {
            if (item.isCertification) {
                const certId = item.certId || item.id;
                await axios.put(`${API_BASE_URL}/api/certifications/requests/${certId}/ld-approval`, {
                    status: "Rejected",
                    admin_id: currentAdminId,
                    comments: reason,
                });
                setApprovals((prev) => (prev || []).filter((a) => a !== item && a.id !== item.id && a.certId !== certId));
            } else {
                const id = item.new_course_id || item.id;
                await axios.put(`${API_BASE_URL}/api/course-requests/${id}/ld-approval`, {
                    status: "Rejected",
                    admin_id: currentAdminId,
                    comment: reason,
                });
                setApprovals((prev) => (prev || []).filter((a) => a !== item && a.id !== item.id && a.new_course_id !== id));
            }
            setRejectTarget(null);
            setSelectedApproval(null);
        } catch (err) {
            console.error("Error rejecting request in Dashboard:", err);
        } finally {
            setIsRejecting(false);
        }
    };

    const handleView = (item) => {
        setSelectedApproval(item);
    };

    const handleViewAll = () => {
        navigate("/ld/approvals-workflow");
    };

    return (
        <div className="ld-dashboard-page">
            {/* FIXED TOP HEADER: Page Header & 4 KPI Stat Cards */}
            <div
                className="ld-dashboard-fixed-header"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                {/* 1. TOP PAGE HEADER */}
                <PageHeader
                    title="Dashboard"
                    subtitle="Monitor enterprise-wide learning trends, course completion rates, and pending approval queues."
                />

                {/* 2. TOP KPI STATS (4 CARDS) */}
                <StatCards
                    stats={dashboardStats}
                    pendingCount={approvals ? approvals.length : '-'}
                    totalEmployeesCount={totalEmployeesCount}
                    totalCoursesCount={totalCoursesCount}
                    activeLearnersCount={activeLearnersCount}
                    isLoading={isLoadingStats}
                />
            </div>

            {/* SCROLLABLE MAIN CONTENT (Sections below fixed header) */}
            <div className="ld-dashboard-scrollable-content" ref={scrollContainerRef}>
                {/* 3. MIDDLE ROW (LEARNING COMPLETION RATE + PENDING APPROVALS) */}
                <div className="ld-middle-grid">
                    <LearningCompletionRate
                        completionData={learningCompletion}
                    />

                    <PendingApprovals
                        approvals={approvals}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onView={handleView}
                        onViewAll={handleViewAll}
                    />
                </div>

                {/* 4. BOTTOM ROW (LEARNING BY DEPARTMENT + TOP CERTIFICATION DOMAINS) */}
                <div className="ld-bottom-grid">
                    <LearningByDepartment
                        departments={learningByDepartment}
                        showAmount={false}
                        variant="ld"
                    />

                    <TopCertificationDomains
                        domainData={topCertificationDomains}
                    />
                </div>
            </div>

            {/* 5. VIEW DETAILS MODAL */}
            <ApprovalDetailsModal
                approval={selectedApproval}
                onClose={() => setSelectedApproval(null)}
                onApprove={handleApprove}
                onReject={handleReject}
            />

            {/* 6. REJECT REASON MODAL */}
            <RejectRequestModal
                isOpen={Boolean(rejectTarget)}
                onClose={() => !isRejecting && setRejectTarget(null)}
                onConfirm={handleConfirmReject}
                targetItem={rejectTarget}
                isSubmitting={isRejecting}
            />
        </div>
    );
}
