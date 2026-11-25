import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const getHeaders = (explicitToken) => {
    const token = explicitToken || localStorage.getItem("lms_token");
    let activeEmpId = localStorage.getItem("lms_active_employee_id");
    if (!activeEmpId) {
        try {
            const rawUser = localStorage.getItem("lms_user");
            if (rawUser) {
                const parsed = JSON.parse(rawUser);
                activeEmpId = parsed?.employee_id;
            }
        } catch (_) {}
    }
    if (!activeEmpId && typeof window !== "undefined") {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("/reporting-manager")) {
            activeEmpId = "EMP004"; // Reporting Manager Suresh Menon
        }
    }
    return token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(activeEmpId ? { "X-Employee-Id": activeEmpId } : {}),
        }
        : {
            "Content-Type": "application/json",
            ...(activeEmpId ? { "X-Employee-Id": activeEmpId } : {}),
        };
};

let inFlightTeamMembersPromise = null;
/**
 * Fetches the direct reports assigned to the current reporting manager from Microsoft Entra ID.
 */
export const fetchTeamMembers = async (explicitToken) => {
    if (inFlightTeamMembersPromise) {
        return inFlightTeamMembersPromise;
    }
    inFlightTeamMembersPromise = (async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/auth/team-members`, {
                headers: getHeaders(explicitToken),
            });
            return res.data?.members || [];
        } finally {
            inFlightTeamMembersPromise = null;
        }
    })();
    return inFlightTeamMembersPromise;
};

let inFlightEmployeesPromise = null;
/**
 * Fetches all enterprise employees directly from Microsoft Entra ID.
 */
export const fetchAllEmployees = async (explicitToken) => {
    if (inFlightEmployeesPromise) {
        return inFlightEmployeesPromise;
    }
    inFlightEmployeesPromise = (async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/auth/employees`, {
                headers: getHeaders(explicitToken),
            });
            return res.data?.employees || [];
        } finally {
            inFlightEmployeesPromise = null;
        }
    })();
    return inFlightEmployeesPromise;
};

/**
 * Fetches certifications earned by direct reports of the current reporting manager.
 */
export const fetchTeamCertifications = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/employee/certifications/team`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || { certifications: [], total_earned: 0, team_members_count: 0 };
};

/**
 * Fetches all employee certifications across enterprise for learning records.
 */
export const fetchAllCertifications = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/employee/certifications/all`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || [];
};

/**
 * Fetches aggregated learning metrics for team members of the current reporting manager.
 * Used by Reporting Manager Dashboard TeamMembersCard.jsx.
 */
export const fetchTeamDashboardSummary = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-dashboard-summary`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || [];
};

/**
 * Fetches department-level learning progress and course/reimbursement spend for CEO dashboard.
 */
export const fetchDepartmentLearningStats = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/ceo/department-learning`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || [];
};

/**
 * Fetches dynamic KPI statistics and employee distribution for CEO dashboard.
 */
export const fetchCEOKpiStats = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/ceo/kpi-stats`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Fetches count of certified employees holding at least one valid certification.
 */
export const fetchCertifiedEmployeesCount = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/employee/certifications/certified-count`, {
        headers: getHeaders(explicitToken),
    });
    return res.data?.certified_employees ?? 0;
};

/**
 * Fetches top performing courses among team members of the current reporting manager.
 * Used by Reporting Manager Dashboard TopPerformingCoursesCard.jsx.
 */
export const fetchTopPerformingCourses = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/top-performing-courses?limit=5`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || [];
};

/**
 * Fetches learning progress distribution and overall progress exclusively for direct reports.
 * Used by Reporting Manager Reports & Analytics TeamLearningProgressCard.jsx.
 */
export const fetchTeamLearningProgressStats = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-learning-progress`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Fetches dynamic KPI statistics for Reporting Manager team (direct reports only).
 * Used by Reporting Manager Dashboard KPIStatsGrid.jsx.
 */
export const fetchTeamKpiStats = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-kpi-stats`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Fetches rolling monthly learning hours trends (video vs practice hours) exclusively for direct reports.
 * Used by Reporting Manager Reports & Analytics MonthlyLearningHoursCard.jsx.
 */
export const fetchTeamMonthlyLearningTrends = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-monthly-learning-trends`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Fetches certifications status summary (Earned, Expiring Soon, Requested, Claimed) exclusively for direct reports.
 * Used by Reporting Manager Reports & Analytics CertificationsStatusCard.jsx.
 */
export const fetchTeamCertificationsStatus = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-certifications-status`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Fetches comprehensive Team Overview KPIs exclusively for direct reports.
 * Used by Reporting Manager Reports & Analytics TeamOverviewCard.jsx.
 */
export const fetchTeamOverviewStats = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-overview-stats`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Fetches Courses Data metrics (Assigned, Completed, Active, Overdue) exclusively for direct reports.
 * Used by Reporting Manager Reports & Analytics CoursesDataCard.jsx.
 */
export const fetchTeamCoursesData = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-courses-data`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Downloads a custom team learning report (PDF, Excel, or CSV) generated from live team data.
 * Triggers a native browser file download.
 */
export const downloadLearningReport = async (payload, explicitToken) => {
    const res = await axios.post(`${API_BASE_URL}/api/reports/learning-report/download`, payload, {
        headers: getHeaders(explicitToken),
        responseType: "blob",
    });

    let filename = `Team_Learning_Report_${new Date().toISOString().slice(0, 10)}`;
    const disposition = res.headers["content-disposition"];
    if (disposition && disposition.indexOf("filename=") !== -1) {
        const matches = disposition.match(/filename="?([^";]+)"?/);
        if (matches && matches[1]) {
            filename = matches[1];
        }
    } else {
        const ext = (payload.exportFormat || "PDF").toLowerCase() === "excel" ? "xlsx" : (payload.exportFormat || "PDF").toLowerCase();
        filename += `.${ext}`;
    }

    const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return true;
};


/**
 * Fetches dynamic budget & expenditure stats and spend by category for CEO dashboard.
 */
export const fetchCEOBudgetStats = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/ceo/budget-expenditure-stats`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || null;
};

/**
 * Fetches all reimbursement claims across enterprise for HR and L&D management.
 */
export const fetchReimbursementClaims = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/reimbursements/claims`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || [];
};

/**
 * Fetches Courses Data metrics and Monthly Learning Hours Trends for HR Employee Records.
 */
export const fetchHREmployeeRecordsAnalytics = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/courses/analytics/employee-records`, {
        headers: getHeaders(explicitToken),
    });
    return res.data;
};
export const fetchCourseRequests = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/course-requests`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || [];
};

/**
 * Fetches all catalog courses with hr_status for HR Approvals & Workflow and Dashboard.
 */
export const fetchCatalogCourses = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/courses`, {
        headers: getHeaders(explicitToken),
    });
    return res.data || [];
};

/**
 * Fetches recent HR activity feed items for the HR Dashboard.
 */
export const fetchHRActivityFeed = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/hr/activity-feed`, {
        headers: getHeaders(explicitToken),
    });
    return res.data?.activities || [];
};

/**
 * Records a new HR activity into dbo.lms_hr_activity_feed.
 */
export const recordHRActivity = async (payload, explicitToken) => {
    const res = await axios.post(`${API_BASE_URL}/api/hr/activity-feed`, payload, {
        headers: getHeaders(explicitToken),
    });
    return res.data;
};

/**
 * Fetches structured team learning report data for Reporting Managers.
 */
export const fetchTeamReportData = async (downloadParams, explicitToken) => {
    const res = await axios.post(
        `${API_BASE_URL}/api/reports/learning-report/data`,
        downloadParams || {},
        {
            headers: getHeaders(explicitToken),
        }
    );
    return res.data;
};

