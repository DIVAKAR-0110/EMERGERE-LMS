import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const getHeaders = (explicitToken) => {
    const token = explicitToken || localStorage.getItem("lms_token");
    let activeEmpId = localStorage.getItem("lms_active_employee_id");
    if (!activeEmpId) {
        try {
            const u = JSON.parse(localStorage.getItem("lms_user") || "{}");
            activeEmpId = u.employee_id || u.empId || u.id;
        } catch {
            // ignore
        }
    }
    const headers = {
        "Content-Type": "application/json",
        ...(activeEmpId ? { "X-Employee-Id": activeEmpId } : {}),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
};

/**
 * Fetches dynamic Course Purchase History records from dbo.lms_course_requests,
 * dbo.lms_courses, and dbo.lms_course_request_stages.
 */
export const fetchCoursePurchaseHistory = async (explicitToken) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/ld/budget/course-purchases`, {
            headers: getHeaders(explicitToken),
        });
        return res.data;
    } catch (err) {
        console.warn("Failed to fetch live course purchase history, using fallback:", err);
        return null;
    }
};

const inFlightDeptPromises = new Map();
/**
 * Fetches dynamic Spend By Department records from database and Azure AD.
 */
export const fetchDepartmentBudgets = async (explicitToken, period) => {
    const key = period || "default";
    if (inFlightDeptPromises.has(key)) {
        return inFlightDeptPromises.get(key);
    }
    const promise = (async () => {
    try {
        const url = period && period !== "All" && period !== "all"
            ? `${API_BASE_URL}/api/ld/budget/departments?period=${encodeURIComponent(period)}`
            : `${API_BASE_URL}/api/ld/budget/departments`;
        const res = await axios.get(url, {
            headers: getHeaders(explicitToken),
        });
        return res.data;
    } catch (err) {
        console.warn("Failed to fetch live department budgets, using fallback:", err);
        return null;
    } finally {
        inFlightDeptPromises.delete(key);
    }
    })();
    inFlightDeptPromises.set(key, promise);
    return promise;
};

/**
 * Fetches dynamic Certification Reimbursement Claims from dbo.lms_reimbursement_claims
 * and dbo.lms_reimbursement_claim_stages.
 */
export const fetchCertificationClaimsHistory = async (explicitToken) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/ld/budget/certification-claims`, {
            headers: getHeaders(explicitToken),
        });
        return res.data;
    } catch (err) {
        console.warn("Failed to fetch live certification claims history, using fallback:", err);
        return null;
    }
};

/**
 * Fetches dynamic Workshops & Training events from dbo.lms_workshops_training.
 */
export const fetchWorkshopsHistory = async (explicitToken) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/ld/budget/workshops`, {
            headers: getHeaders(explicitToken),
        });
        return res.data;
    } catch (err) {
        console.warn("Failed to fetch live workshops history, using fallback:", err);
        return null;
    }
};

/**
 * Fetches dynamic Top Metric KPI Horizon Stats from the database:
 * - This Month Spend (Current Indian Month name & INR rupees)
 * - Quarterly Spend (Rolling 3 months)
 * - Spent This Year (Current calendar year spend)
 * - All-Time LMS Investment (Cumulative enterprise spend)
 * - Available Years for dropdown filtering
 */
export const fetchBudgetHorizonStats = async (explicitToken) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/ld/budget/stats`, {
            headers: getHeaders(explicitToken),
        });
        return res.data;
    } catch (err) {
        console.warn("Failed to fetch live budget horizon stats, using fallback:", err);
        return null;
    }
};

/**
 * Fetches dynamic Top 3 Certification Providers from live database records:
 * - Top 3 issuing bodies/providers by reimbursement spend
 * - Proportional percentage share
 * - Total spend and claim counts
 */
export const fetchTopCertificationProviders = async (period, explicitToken) => {
    try {
        const params = period ? { period } : {};
        const res = await axios.get(`${API_BASE_URL}/api/ld/budget/certification-top-providers`, {
            params,
            headers: getHeaders(explicitToken),
        });
        return res.data;
    } catch (err) {
        console.warn("Failed to fetch live top certification providers, using fallback:", err);
        return null;
    }
};

/**
 * Fetches dynamic Top 3 Course Providers from live database records:
 * - Top 3 platforms/providers by course purchase spend
 * - Proportional percentage share
 * - Total spend and course counts
 */
export const fetchTopCourseProviders = async (period, explicitToken) => {
    try {
        const params = period ? { period } : {};
        const res = await axios.get(`${API_BASE_URL}/api/ld/budget/course-top-providers`, {
            params,
            headers: getHeaders(explicitToken),
        });
        return res.data;
    } catch (err) {
        console.warn("Failed to fetch live top course providers, using fallback:", err);
        return null;
    }
};



/**
 * Universal date parser for budget records.
 * Supports DD-MM-YYYY, YYYY-MM-DD, ISO timestamps, and Date objects.
 */
export const parseRecordDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    const s = String(dateVal).trim();
    const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dmy) {
        return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    }
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
        return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Checks whether a given record date falls within the selected period:
 * - "This Month": same year and month as current Indian local date
 * - "Last Quarter": rolling 3-month window (current month + previous 2 months)
 * - "2026", etc.: matches the year
 */
export const isDateInPeriod = (dateVal, period, refDate = new Date()) => {
    if (!period || period === "ALL") return true;
    const d = parseRecordDate(dateVal);
    if (!d) return false;

    const currYear = refDate.getFullYear();
    const currMonth = refDate.getMonth(); // 0-indexed

    if (period === "This Month") {
        return d.getFullYear() === currYear && d.getMonth() === currMonth;
    }

    if (period === "Last Quarter") {
        // Rolling 3-month period: 2 months prior up to end of current month
        const startOfQuarter = new Date(currYear, currMonth - 2, 1, 0, 0, 0);
        const endOfQuarter = new Date(currYear, currMonth + 1, 0, 23, 59, 59);
        return d >= startOfQuarter && d <= endOfQuarter;
    }

    // Match numeric year e.g. "2026"
    const targetYear = parseInt(period, 10);
    if (!isNaN(targetYear)) {
        return d.getFullYear() === targetYear;
    }

    return true;
};


/**
 * Initial fallback structure for Top Metric KPI Stat Cards.
 */
export const initialBudgetTimeHorizonStats = {
    this_month: {
        label: "Spent This month",
        amount: 0,
        amount_formatted: "₹0",
    },
    this_year: {
        label: "Quarterly Spent",
        amount: 0,
        amount_formatted: "₹0",
    },
    last_year: {
        label: "Spent This Year",
        amount: 0,
        amount_formatted: "₹0",
    },
    all_time: {
        label: "All-Time LMS Investment",
        amount: 0,
        amount_formatted: "₹0",
    },
};

