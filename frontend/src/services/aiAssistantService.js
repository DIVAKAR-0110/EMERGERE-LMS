import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const getHeaders = (explicitToken, role = "Employee") => {
    const token = explicitToken || localStorage.getItem("lms_token");
    let activeEmpId = localStorage.getItem("lms_active_employee_id");
    if (!activeEmpId) {
        try {
            const u = JSON.parse(localStorage.getItem("lms_user") || "{}");
            activeEmpId = u.employee_id || u.id || u.empId;
        } catch {
            // ignore
        }
    }
    const effectiveRole = role || localStorage.getItem("lms_user_role") || "Employee";

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeEmpId ? { "X-Employee-Id": activeEmpId } : {}),
        "X-User-Role": effectiveRole,
    };
};

export const getRoleInitialMessages = (role, userName = "Learner") => {
    const isLd = ["L&D Team", "L&D", "L_D", "LD"].includes(role);

    if (isLd) {
        return [
            {
                id: "ld-welcome",
                sender: "assistant",
                text: `👋 Hello ${userName}! I am your Emergere LMS Copilot (L&D Team Access).\n\nI have organization-wide visibility across all employee course enrollments, completion rates, pending course & certification approvals, and training budget utilization. How can I assist you today?`,
                timestamp: "Just now",
            },
        ];
    }

    return [
        {
            id: "emp-welcome",
            sender: "assistant",
            text: `👋 Hello ${userName}! I am your Emergere LMS AI Assistant.\n\nI can help you track your personal course requests, enrollments, certifications, reimbursement claims, and skill-tailored course recommendations. How can I assist you today?`,
            timestamp: "Just now",
        },
    ];
};

export const initialMessages = getRoleInitialMessages("Employee", "Learner");

/**
 * Fetches dynamic, role- and page-contextual suggested prompt pills from the backend.
 * Never includes database table names.
 */
export const fetchSuggestedPills = async (page = "", role = "Employee", explicitToken = null) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/ai-assistant/pills`, {
            headers: getHeaders(explicitToken, role),
            params: { page, role },
            timeout: 5000,
        });
        if (res.data && res.data.pills) {
            return res.data.pills;
        }
    } catch (err) {
        console.warn("[AIAssistantService] Failed to fetch dynamic pills from backend:", err);
    }
    return [];
};

/**
 * Sends chat query to backend AI Assistant endpoint (/api/ai-assistant/chat).
 * Enforces strict LMS domain guardrails, role boundaries, and confidentiality rules:
 * Never exposes database table names.
 */
export const generateAIResponse = async (
    userQuery,
    userName = "Learner",
    explicitToken = null,
    history = [],
    role = "Employee",
    page = ""
) => {
    try {
        const realHistory = (history || [])
            .filter((m) => !m.id || (!m.id.startsWith("emp-msg-") && !m.id.startsWith("ld-msg-") && !m.id.startsWith("ld-welcome") && !m.id.startsWith("emp-welcome")))
            .slice(-6)
            .map((m) => ({
                sender: m.sender,
                text: m.text,
            }));

        const payload = {
            query: userQuery,
            history: realHistory,
            page_context: page,
            role: role,
        };

        let res;
        // Dual-attempt network dispatch:
        // 1. First try same-origin relative URL /api/ai-assistant/chat (Vite proxy, prevents CORS and LAN IP mismatches)
        try {
            res = await axios.post("/api/ai-assistant/chat", payload, {
                headers: getHeaders(explicitToken, role),
                timeout: 25000,
            });
        } catch (proxyErr) {
            // 2. Second try direct API_BASE_URL (http://localhost:5000/api/ai-assistant/chat)
            const directUrl = API_BASE_URL ? `${API_BASE_URL}/api/ai-assistant/chat` : "http://localhost:5000/api/ai-assistant/chat";
            res = await axios.post(directUrl, payload, {
                headers: getHeaders(explicitToken, role),
                timeout: 25000,
            });
        }

        if (res && res.data && res.data.reply) {
            return {
                reply: res.data.reply,
                suggestedPills: res.data.suggestedPills || [],
                actions: res.data.actions || [],
            };
        }
    } catch (err) {
        console.error("[AIAssistantService] Live AI Assistant endpoint unavailable:", err);
        return {
            reply: `⚠️ **AI Service Connection Notice**\n\nThe LMS AI Assistant is currently communicating with the live database and AI model engine. If you are experiencing a delay or connection issue, please verify that the LMS backend is active on port 5000 and click retry below.\n\n*Error details: ${err?.message || "Service temporarily unavailable"}*`,
            suggestedPills: [
                { id: "p-retry", label: "🔄 Retry Question", query: userQuery, type: "summary", className: "pill-summary" },
                { id: "p-enr", label: "Show enrolled courses", query: "What courses am I currently enrolled in?", type: "summary", className: "pill-summary" }
            ],
        };
    }
};

export const fetchTopPerformingCoursesAI = async (explicitToken = null) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/ai-assistant/top-courses`, {
            headers: getHeaders(explicitToken),
        });
        return res.data || [];
    } catch (err) {
        console.error("Failed to fetch top performing courses for AI:", err);
        return [];
    }
};
