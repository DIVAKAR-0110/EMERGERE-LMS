import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const resolveEmployeeIdentifier = (employeeId = null) => {
    let activeEmpId = employeeId || localStorage.getItem("lms_active_employee_id");
    if (!activeEmpId) {
        try {
            const u = JSON.parse(localStorage.getItem("lms_user") || "{}");
            activeEmpId =
                u.employee_id ||
                u.empId ||
                u.Emp_Obj_Id ||
                u.id ||
                u.work_email ||
                u.email ||
                null;
        } catch {
            // ignore malformed JSON
        }
    }
    return activeEmpId ? String(activeEmpId).trim() : null;
};

/**
 * Fetches dynamic leaderboard data, user stats, and overview from the backend API.
 * @param {string} timeFilter - e.g. "This Week" | "This Month" | "All Time"
 * @param {string} explicitToken - optional auth token override
 * @param {string} employeeId - optional employee ID override
 * @param {Object} options - optional request options (e.g. { signal })
 */
export const fetchLeaderboardData = async (
    timeFilter = "This Month",
    explicitToken = null,
    employeeId = null,
    options = {}
) => {
    const token = explicitToken || localStorage.getItem("lms_token");
    const activeEmpId = resolveEmployeeIdentifier(employeeId);

    const res = await axios.get(`${API_BASE_URL}/api/leaderboard`, {
        params: {
            timeFilter: timeFilter || "This Month",
            ...(activeEmpId ? { employee_id: activeEmpId } : {}),
        },
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(activeEmpId ? { "X-Employee-Id": activeEmpId } : {}),
        },
        ...(options?.signal ? { signal: options.signal } : {}),
    });

    return res.data;
};

export const RANK_COLORS = [
    "#FFBC64",  // Rank 1 - Warm Gold / Amber
    "#7F96FF",  // Rank 2 - Royal Blue
    "#7FCEFF",  // Rank 3 - Sky Blue
    "#F97FFF",  // Rank 4 - Rose Pink
    "#FF7FAE",  // Rank 5 - Coral Pink
    "#A87FFF",  // Rank 6 - Amethyst Purple
    "#5CDE8A",  // Rank 7 - Emerald Green
    "#BED60E",  // Rank 8 - Lime Green
    "#FF7F7F",  // Rank 9 - Crimson / Salmon Red
    "#7C67FF",  // Rank 10 - Indigo / Violet
];

/**
 * Downloads individual employee learning report (PDF, Excel, or CSV).
 * @param {Object} downloadParams - { dateRange, exportFormat, includes }
 * @param {string} explicitToken - optional auth token
 * @param {string} employeeId - optional employee ID
 */
export const downloadEmployeeLearningReport = async (downloadParams, explicitToken = null, employeeId = null) => {
    const token = explicitToken || localStorage.getItem("lms_token");
    const activeEmpId = resolveEmployeeIdentifier(employeeId);

    const res = await axios.post(
        `${API_BASE_URL}/api/reports/employee-learning-report/download`,
        downloadParams,
        {
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(activeEmpId ? { "X-Employee-Id": activeEmpId } : {}),
            },
            responseType: "blob",
            timeout: 60000,
        }
    );

    // Extract filename from response headers or fallback
    const contentDisposition = res.headers["content-disposition"] || "";
    let filename = `Employee_Learning_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/);
    if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
    } else if (downloadParams?.exportFormat?.toUpperCase() === "EXCEL") {
        filename = `Employee_Learning_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else if (downloadParams?.exportFormat?.toUpperCase() === "CSV") {
        filename = `Employee_Learning_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    return true;
};

