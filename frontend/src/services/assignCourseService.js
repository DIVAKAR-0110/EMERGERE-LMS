import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

const getHeaders = (explicitToken, explicitEmpId) => {
    const token = explicitToken || localStorage.getItem("lms_token");
    let activeEmpId = explicitEmpId || localStorage.getItem("lms_active_employee_id");
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
 * Creates course assignments in dbo.lms_LD_assign_course.
 * @param {Object} data - { course_id, employee_ids, learning_starting_date, target_completion_date, assignment_note }
 */
export const assignCourseToEmployees = async (data, explicitToken, idempotencyKey) => {
    const headers = getHeaders(explicitToken);
    if (idempotencyKey) {
        headers["X-Idempotency-Key"] = idempotencyKey;
    }
    const res = await axios.post(`${API_BASE_URL}/api/ld/assign-course`, data, {
        headers,
    });
    return res.data;
};

/**
 * Fetches all course assignments from dbo.lms_LD_assign_course.
 */
export const fetchAssignedCourses = async (filters = {}, explicitToken) => {
    const params = new URLSearchParams();
    if (filters.courseId) params.append("course_id", filters.courseId);
    if (filters.employeeId) params.append("employee_id", filters.employeeId);
    if (filters.search) params.append("search", filters.search);

    const res = await axios.get(`${API_BASE_URL}/api/ld/assigned-courses?${params.toString()}`, {
        headers: getHeaders(explicitToken),
    });
    return res.data;
};
