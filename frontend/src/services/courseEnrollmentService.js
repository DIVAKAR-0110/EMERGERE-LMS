import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

const resolveEmployeeId = (explicitEmpId) => {
    if (explicitEmpId) return explicitEmpId;
    const stored = localStorage.getItem("lms_active_employee_id");
    if (stored) return stored;
    try {
        const u = JSON.parse(localStorage.getItem("lms_user") || "{}");
        if (u.employee_id || u.empId || u.id) return u.employee_id || u.empId || u.id;
    } catch {
        // ignore
    }
    return null;
};

const getHeaders = (explicitToken, explicitEmpId) => {
    const token = explicitToken || localStorage.getItem("lms_token");
    const activeEmpId = resolveEmployeeId(explicitEmpId);
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
 * Submits a course enrollment request for an employee (status: 'Pending').
 * Generates an official request ID with prefix ENR-YYYY-XXXX.
 */
export const requestCourseEnrollment = async (courseId, employeeInfo = {}, explicitToken) => {
    const empId = employeeInfo?.employee_id || employeeInfo?.empId || resolveEmployeeId();
    const payload = {
        course_id: courseId,
        employee_id: empId,
        employee_name: employeeInfo?.name || employeeInfo?.full_name,
        employee_email: employeeInfo?.email || employeeInfo?.work_email,
        employee_role: employeeInfo?.role || employeeInfo?.job_title,
    };
    const res = await axios.post(`${API_BASE_URL}/api/enrollments/request`, payload, {
        headers: getHeaders(explicitToken, empId),
    });
    return res.data;
};

/**
 * Fetches all course enrollment requests for L&D Course Management tab,
 * including active license slots (activeUsers: X/4) and assigned team members.
 */
export const fetchEnrollmentRequests = async (filters = {}, explicitToken) => {
    const params = new URLSearchParams();
    if (filters.courseId) params.append("course_id", filters.courseId);
    if (filters.status && filters.status !== "All Status") params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);

    const res = await axios.get(`${API_BASE_URL}/api/enrollments/requests?${params.toString()}`, {
        headers: getHeaders(explicitToken),
    });
    return res.data;
};

/**
 * Fetches the course status and progress mapping for the logged-in employee:
 * { statusMap: { [course_id]: 'Pending' | 'Approved' | 'On Hold' | 'In Progress' | 'Completed' },
 *   progressMap: { [course_id]: progress_percentage } }
 */
export const fetchMyEnrollmentStatus = async (employeeId, explicitToken) => {
    const params = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : "";
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/my-status${params}`, {
        headers: getHeaders(explicitToken),
    });
    return {
        statusMap: res.data?.statusMap || {},
        progressMap: res.data?.progressMap || {},
        completedMap: res.data?.completedMap || {},
    };
};

/**
 * L&D Action: Approves the enrollment request.
 * Sets status to 'Approved', assigns course to employee library, and sends notification.
 */
export const approveEnrollmentRequest = async (requestId, explicitToken) => {
    const res = await axios.post(
        `${API_BASE_URL}/api/enrollments/${encodeURIComponent(requestId)}/approve`,
        {},
        { headers: getHeaders(explicitToken) }
    );
    return res.data;
};

/**
 * L&D Action: Puts request On Hold with a mandatory reason.
 * Sets status to 'On Hold' and sends notification to employee.
 */
export const holdEnrollmentRequest = async (requestId, reason, explicitToken) => {
    const res = await axios.post(
        `${API_BASE_URL}/api/enrollments/${encodeURIComponent(requestId)}/hold`,
        { reason },
        { headers: getHeaders(explicitToken) }
    );
    return res.data;
};

/**
 * Fetches calculated overall progress, active courses, completed courses, and certifications summary.
 */
export const fetchOverallProgressSummary = async (employeeId, explicitToken) => {
    const token = explicitToken || localStorage.getItem("lms_token");
    const activeEmpId = resolveEmployeeId(employeeId);
    const res = await axios.get(`${API_BASE_URL}/api/enrollments/overall-progress`, {
        params: { employee_id: activeEmpId },
        headers: getHeaders(token, activeEmpId),
    });
    return res.data;
};

