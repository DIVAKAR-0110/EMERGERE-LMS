import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchEmployeeProfile } from "../../services/profileService";
import { useAuth } from "../../context/AuthContext";
import "../../styles/Profile.css";

const formatCertDate = (dateVal) => {
    if (!dateVal || dateVal === "—" || dateVal === "-") return "";
    try {
        const str = String(dateVal).trim();
        if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return "";
        if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(str)) return str;

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const year = isoMatch[1];
            const monthIdx = parseInt(isoMatch[2], 10) - 1;
            const day = isoMatch[3];
            const mon = months[monthIdx];
            if (mon) {
                return `${day} ${mon} ${year}`;
            }
        }

        const d = new Date(str.includes("-") && !str.includes("T") ? str.replace(/-/g, "/") : str);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, "0");
            const mon = months[d.getMonth()];
            const year = d.getFullYear();
            return `${day} ${mon} ${year}`;
        }
    } catch { }
    return String(dateVal);
};

export default function EmployeeProfileView({ employee, onBack }) {
    const { token } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadProfileFromDatabase = async () => {
            if (!employee) return;
            setIsLoading(true);

            const empId = employee.employeeId || employee.employee_id || employee.id;
            try {
                const data = await fetchEmployeeProfile(empId, token);
                if (isMounted && data) {
                    setProfileData({
                        basicInfo: {
                            ...data.basicInfo,
                            avatarBg: employee.avatarBg || "#3B82F6",
                            learningStatus: employee.learningStatus || "—",
                        },
                        skillsExpertise: data.skillsExpertise || {
                            aboutMe: "",
                            technicalSkills: [],
                            professionalSkills: [],
                            areaOfExpertise: [],
                        },
                        learningCertifications: data.learningCertifications || {
                            certifications: [],
                            learningInterests: [],
                        },
                    });
                }
            } catch (err) {
                console.error(`Failed to fetch database profile for employee ${empId}:`, err);
                if (isMounted) {
                    // Fallback to Microsoft Entra ID directory properties without mock skills/certs
                    setProfileData({
                        basicInfo: {
                            employeeId: employee.employeeId || employee.employee_id || "EMP000",
                            fullName: employee.name || employee.full_name || "—",
                            workEmail: employee.email || employee.work_email || "",
                            department: employee.department || "General",
                            jobTitle: employee.designation || employee.job_title || employee.role || "—",
                            jobLocation: employee.jobLocation || employee.job_location || "Coimbatore, India",
                            mobileNumber: employee.mobileNumber || employee.mobile_number || "",
                            reportingManager: employee.reportingManager || employee.reporting_manager || "Not Assigned",
                            dateOfJoining: employee.dateOfJoining || employee.date_of_joining || "",
                            linkedinUrl: employee.linkedinUrl || employee.linkedin_url || "",
                            photoInitials: employee.initials || "EM",
                            avatarBg: employee.avatarBg || "#3B82F6",
                            learningStatus: employee.learningStatus || "—",
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
                    });
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadProfileFromDatabase();
        return () => {
            isMounted = false;
        };
    }, [employee, token]);

    if (!employee) return null;

    if (isLoading) {
        return (
            <div className="profile-page-container" style={{ padding: "32px 24px", textAlign: "center" }}>
                <div
                    style={{
                        display: "inline-block",
                        padding: "24px 36px",
                        background: "#FFFFFF",
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                    }}
                >
                    <p style={{ fontSize: "14px", color: "#64748B", margin: 0, fontWeight: 500 }}>
                        Loading employee profile records from database...
                    </p>
                </div>
            </div>
        );
    }

    const { basicInfo, skillsExpertise, learningCertifications } = profileData || {};
    if (!basicInfo) return null;

    const displayCertifications = (learningCertifications?.certifications || []).filter((cert) => {
        const rawType = String(
            cert.certificateType ||
            cert.certificate_type ||
            cert.type ||
            ""
        ).toLowerCase();
        return !rawType.includes("course completion") && !rawType.includes("course certificate");
    });

    return (
        <div className="profile-page-container" style={{ padding: "16px 24px 20px 24px" }}>
            {/* ── Top Page Header with Back Button on Top Left ── */}
            <div className="profile-header" style={{ marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <button
                        type="button"
                        onClick={onBack}
                        className="ld-profile-back-btn"
                        title="Back to Employee Directory"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: "#FFFFFF",
                            border: "1px solid #DDE0EE",
                            cursor: "pointer",
                            color: "#000000",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                            transition: "all 0.15s ease",
                            flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#EFF6FF";
                            e.currentTarget.style.borderColor = "#215EF8";
                            e.currentTarget.style.color = "#215EF8";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#FFFFFF";
                            e.currentTarget.style.borderColor = "#CBD5E1";
                            e.currentTarget.style.color = "#1E293B";
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="profile-header-left">
                        <h1 className="profile-header-title">Employee Profile</h1>
                        <p className="profile-header-greeting">
                            Viewing profile & learning records of {basicInfo.fullName}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Sections Wrapper ── */}
            <div className="profile-sections-wrapper">
                {/* ── Section 1: Basic Information ── */}
                <section className="profile-section-card-1">
                    <div className="profile-section-header">
                        <h2 className="profile-section-title">Basic Information</h2>
                    </div>

                    <div className="profile-basic-grid">
                        {/* Column 1 */}
                        <div className="profile-info-column-card">
                            <div className="profile-photo-row" style={{ alignItems: "center" }}>
                                <div
                                    className="profile-avatar-large"
                                    style={{
                                        backgroundColor: basicInfo.avatarBg,
                                        cursor: "default",
                                        overflow: "hidden",
                                    }}
                                >
                                    {basicInfo.photoInitials}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    <span
                                        style={{
                                            fontSize: "13.5px",
                                            fontWeight: "700",
                                            color: "#0F172A",
                                            fontFamily: "'Roboto', sans-serif",
                                        }}
                                    >
                                        {basicInfo.fullName}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "11.5px",
                                            color: "#64748B",
                                            fontFamily: "'Roboto', sans-serif",
                                        }}
                                    >
                                        {basicInfo.jobTitle}
                                    </span>
                                    <span
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            fontSize: "10.5px",
                                            fontWeight: "600",
                                            color: basicInfo.learningStatus === "Active" ? "#10B981" : "#64748B",
                                            background: basicInfo.learningStatus === "Active" ? "#ECFDF5" : "#F1F5F9",
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            width: "fit-content",
                                            marginTop: "2px",
                                            fontFamily: "'Roboto', sans-serif",
                                        }}
                                    >
                                        {basicInfo.learningStatus} Learner
                                    </span>
                                </div>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Employee ID</span>
                                <span className="profile-field-value">{basicInfo.employeeId}</span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Work Email</span>
                                <span className="profile-field-value">{basicInfo.workEmail}</span>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="profile-info-column-card">
                            <div className="profile-field-row">
                                <span className="profile-field-label">Job Title</span>
                                <span className="profile-field-value">{basicInfo.jobTitle}</span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Date of Joining</span>
                                <span className="profile-field-value">{basicInfo.dateOfJoining || "—"}</span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Full Name</span>
                                <span className="profile-field-value">{basicInfo.fullName}</span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Department</span>
                                <span className="profile-field-value">{basicInfo.department || "—"}</span>
                            </div>
                        </div>

                        {/* Column 3 */}
                        <div className="profile-info-column-card">
                            <div className="profile-field-row">
                                <span className="profile-field-label">Job Location</span>
                                <span className="profile-field-value">{basicInfo.jobLocation || "—"}</span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Reporting Manager</span>
                                <span className="profile-field-value">{basicInfo.reportingManager || "—"}</span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Mobile Number</span>
                                <span className="profile-field-value">{basicInfo.mobileNumber || "—"}</span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">LinkedIn URL</span>
                                {basicInfo.linkedinUrl && String(basicInfo.linkedinUrl).trim() ? (
                                    <a
                                        href={
                                            /^https?:\/\//i.test(String(basicInfo.linkedinUrl).trim())
                                                ? String(basicInfo.linkedinUrl).trim()
                                                : `https://${String(basicInfo.linkedinUrl).trim()}`
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="profile-field-value link-value"
                                        title={basicInfo.linkedinUrl}
                                    >
                                        {basicInfo.linkedinUrl}
                                    </a>
                                ) : (
                                    <span className="profile-field-value" style={{ color: "#94A3B8" }}>
                                        null
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Section 2: Skills & Expertise (Live from Database) ── */}
                <section className="profile-section-card-2">
                    <div className="profile-section-header">
                        <h2 className="profile-section-title">Skills & Expertise</h2>
                    </div>

                    <div className="profile-skills-grid">
                        {/* Left Column */}
                        <div className="profile-skills-card">
                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Professional summary</span>
                                <p className="profile-about-text">
                                    {skillsExpertise?.aboutMe || (
                                        <span style={{ color: "#94A3B8", fontStyle: "italic" }}>
                                            No about me description added yet.
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Technical Skills</span>
                                <div className="profile-tags-wrapper">
                                    {skillsExpertise?.technicalSkills && skillsExpertise.technicalSkills.length > 0 ? (
                                        skillsExpertise.technicalSkills.map((skill) => (
                                            <span key={skill} className="profile-tag-pill" title={skill}>
                                                {skill}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ color: "#94A3B8", fontSize: "12px", fontStyle: "italic" }}>
                                            No technical skills recorded.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="profile-skills-card">
                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Professional Skills</span>
                                <div className="profile-tags-wrapper">
                                    {skillsExpertise?.professionalSkills && skillsExpertise.professionalSkills.length > 0 ? (
                                        skillsExpertise.professionalSkills.map((skill) => (
                                            <span key={skill} className="profile-tag-pill" title={skill}>
                                                {skill}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ color: "#94A3B8", fontSize: "12px", fontStyle: "italic" }}>
                                            No professional skills recorded.
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Area of Expertise</span>
                                <div className="profile-tags-wrapper">
                                    {skillsExpertise?.areaOfExpertise && skillsExpertise.areaOfExpertise.length > 0 ? (
                                        skillsExpertise.areaOfExpertise.map((area) => (
                                            <span key={area} className="profile-tag-pill" title={area}>
                                                {area}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ color: "#94A3B8", fontSize: "12px", fontStyle: "italic" }}>
                                            No areas of expertise recorded.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Section 3: Learning & Certifications (Live from Database) ── */}
                <section className="profile-section-card-3">
                    <div className="profile-section-header">
                        <h2 className="profile-section-title">Learning & Certifications</h2>
                    </div>

                    <div className="profile-certs-grid">
                        {/* Left Column: Certifications Table */}
                        <div className="profile-certs-card">
                            <span className="profile-certs-subheading">Certifications</span>
                            <div className="profile-cert-table-wrapper">
                                <table className="profile-cert-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Issuer</th>
                                            <th>Issue Date</th>
                                            <th>Expiry Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayCertifications.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="4"
                                                    style={{
                                                        textAlign: "center",
                                                        color: "#94A3B8",
                                                        padding: "16px",
                                                        fontStyle: "italic",
                                                    }}
                                                >
                                                    No certifications recorded.
                                                </td>
                                            </tr>
                                        ) : (
                                            displayCertifications.map((cert, idx) => (
                                                <tr key={cert.id || idx}>
                                                    <td style={{ fontWeight: 500 }} title={cert.name}>
                                                        {cert.certificateUrl ? (
                                                            <a
                                                                href={cert.certificateUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{ color: "#2563EB", textDecoration: "none" }}
                                                                title={cert.name}
                                                            >
                                                                {cert.name}
                                                            </a>
                                                        ) : (
                                                            cert.name
                                                        )}
                                                    </td>
                                                    <td title={cert.issuer}>{cert.issuer}</td>
                                                    <td>{formatCertDate(cert.issueDate) || "—"}</td>
                                                    <td>{formatCertDate(cert.expiryDate) || "—"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right Column: Learning Interests */}
                        <div className="profile-certs-card">
                            <div className="profile-interests-horizontal">
                                <span className="profile-interests-label">
                                    What would you like<br />to learn or improve?
                                </span>
                                <div className="profile-tags-wrapper">
                                    {learningCertifications?.learningInterests &&
                                        learningCertifications.learningInterests.length > 0 ? (
                                        learningCertifications.learningInterests.map((interest) => (
                                            <span key={interest} className="profile-tag-pill" title={interest}>
                                                {interest}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ color: "#7f7f7f", fontSize: "12px", fontStyle: "r" }}>
                                            No learning interests recorded.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
