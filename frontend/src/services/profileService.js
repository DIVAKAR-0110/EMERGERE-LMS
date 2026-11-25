import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const EMPTY_PROFILE = {
    basicInfo: {
        employeeId: "",
        microsoftObjectId: "",
        fullName: "",
        workEmail: "",
        department: "",
        jobTitle: "",
        jobLocation: "",
        mobileNumber: "",
        reportingManager: "",
        reportingManagerId: null,
        dateOfJoining: "",
        linkedinUrl: "",
        photoInitials: "",
    },
    skillsExpertise: {
        aboutMe: "",
        technicalSkills: [],
        professionalSkills: [],
        areaOfExpertise: [],
    },
    learningCertifications: {
        certifications: [],
        learningInterests: [],
    },
};

const getHeaders = (explicitToken) => {
    const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP004";
    const token = explicitToken || localStorage.getItem("lms_token") || `dev-token-${activeEmpId}`;
    return {
        Authorization: `Bearer ${token}`,
        "x-employee-id": activeEmpId,
        "Content-Type": "application/json",
    };
};

/**
 * Fetches the authenticated employee's full profile:
 * Azure AD directory properties + SQL Server relational profile extensions.
 */
export const fetchMyProfile = async (explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/profile/view`, {
        headers: getHeaders(explicitToken),
    });
    return res.data;
};

/**
 * Updates the authenticated employee's relational profile tables in MS SQL Server
 * (Skills, Expertise, Certifications, Learning Interests, LinkedIn URL, Avatar).
 */
export const updateMyProfile = async (profileData, explicitToken) => {
    const payload = {
        basicInfo: profileData.basicInfo,
        skillsExpertise: profileData.skillsExpertise,
        learningCertifications: profileData.learningCertifications,
    };
    const res = await axios.put(`${API_BASE_URL}/api/profile/update`, payload, {
        headers: getHeaders(explicitToken),
    });
    return res.data;
};

/**
 * Fetches a specific employee's profile by employee ID or Azure OID.
 */
export const fetchEmployeeProfile = async (employeeId, explicitToken) => {
    const res = await axios.get(`${API_BASE_URL}/api/profile/view/${employeeId}`, {
        headers: getHeaders(explicitToken),
    });
    return res.data;
};

/**
 * Downloads a certificate file for the given certificate object.
 * Attempts secure backend blob download via /api/employee/certifications/{id}/download,
 * with fallbacks for direct URLs.
 */
export const downloadCertificateFile = async (cert, explicitToken) => {
    const rawId = cert.id || cert.cert_id || cert.certification_id;
    const cleanId = rawId ? String(rawId).replace("cert-", "").trim() : null;
    const numericId = cleanId && !isNaN(Number(cleanId)) ? Number(cleanId) : null;
    const token = explicitToken || localStorage.getItem("lms_token");

    // 1. Try download via API endpoint if numericId exists
    if (numericId) {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/employee/certifications/${numericId}/download`, {
                headers: getHeaders(token),
                responseType: "blob",
            });
            const blob = new Blob([res.data]);
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            const ext = (cert.certificateFileName || cert.fileName || "pdf").split(".").pop();
            const fallbackName = (cert.name || "certificate").replace(/[^a-zA-Z0-9_-]/g, "_");
            a.download = cert.certificateFileName || cert.fileName || `${fallbackName}.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
            return true;
        } catch (err) {
            console.warn("API certificate download endpoint failed, trying direct URL fallback:", err);
            // Fall through to direct URL logic
        }
    }

    // 2. Fallback to direct URL if available
    const certUrl = cert.certificateUrl || cert.certificate_file_path;
    if (certUrl && certUrl !== "#") {
        if (certUrl.startsWith("blob:")) {
            const a = document.createElement("a");
            a.href = certUrl;
            a.download = cert.certificateFileName || cert.fileName || `${(cert.name || "certificate").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            return true;
        }

        const targetUrl = certUrl.startsWith("http")
            ? certUrl
            : `${API_BASE_URL}${certUrl.startsWith("/") ? "" : "/"}${certUrl}`;
        window.open(targetUrl, "_blank");
        return true;
    }

    throw new Error(`No certificate document is available on the server for "${cert.name || "this item"}".`);
};

/**
 * Deletes an employee certificate record by its database ID.
 */
export const deleteCertificateRecord = async (certId, explicitToken) => {
    const rawId = certId ? String(certId).replace("cert-", "").trim() : null;
    const numericId = rawId && !isNaN(Number(rawId)) ? Number(rawId) : null;
    if (!numericId) return { success: true };

    const token = explicitToken || localStorage.getItem("lms_token");
    const res = await axios.delete(`${API_BASE_URL}/api/employee/certifications/${numericId}`, {
        headers: getHeaders(token),
    });
    return res.data;
};

