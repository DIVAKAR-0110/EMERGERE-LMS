import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import editPencilIcon from "../../assets/Profile/edit-pencil-icon.svg";
import { useAuth } from "../../context/AuthContext";
import {
    fetchMyProfile,
    updateMyProfile,
    EMPTY_PROFILE,
} from "../../services/profileService";
import axios from "axios";
import CertificateViewerModal from "../../components/Profile/CertificateViewerModal";
import EditProfileModal from "../../components/Profile/EditProfileModal";
import AlertDialog from "../../components/common/AlertDialog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
import "../../styles/Profile.css";
import PageHeader from "../../components/common/PageHeader";

const SkeletonBlock = ({ width = 120, height = 14, radius = 4 }) => (
    <span
        className="ld-skeleton-block"
        style={{ width, height, borderRadius: radius }}
    />
);

const SkeletonPills = ({ widths = [84, 96, 78] }) => (
    <div className="profile-tags-wrapper">
        {widths.map((w, i) => (
            <SkeletonBlock key={i} width={w} height={26} radius={999} />
        ))}
    </div>
);

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

export default function Profile() {
    const { role, currentUser, user, token, setIsProfileCompleted } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    const activeRole = (location.pathname.includes("/reporting-manager")
        ? "Reporting Manager"
        : location.pathname.includes("/ld")
            ? "L&D"
            : location.pathname.includes("/hr")
                ? "HR"
                : location.pathname.includes("/ceo")
                    ? "CEO"
                    : location.pathname.includes("/employee")
                        ? "Employee"
                        : role) || "Employee";

    const buildInitialBasicInfo = (u) => {
        const rawName = u?.full_name || u?.name || "";
        const cleanName = rawName.split("(")[0].trim();
        const initials = cleanName
            ? cleanName
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "";

        return {
            ...EMPTY_PROFILE.basicInfo,
            employeeId: u?.employee_id || "",
            microsoftObjectId: u?.microsoft_object_id || "",
            fullName: cleanName,
            workEmail: u?.work_email || u?.email || "",
            department: u?.department || "",
            jobTitle: u?.job_title || u?.role || "",
            jobLocation: u?.job_location || "",
            mobileNumber: u?.mobile_number || "",
            reportingManager: u?.reporting_manager || "",
            reportingManagerId: u?.reporting_manager_id || null,
            dateOfJoining: u?.date_of_joining || "",
            linkedinUrl: u?.linkedin_url || "",
            photoInitials: initials,
        };
    };

    const [profileData, setProfileData] = useState(() => ({
        ...EMPTY_PROFILE,
        basicInfo: buildInitialBasicInfo(user || currentUser),
    }));
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: "", message: "", type: "error" });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editModalStep, setEditModalStep] = useState(1);
    const [editModalMode, setEditModalMode] = useState("single");
    const [photoError, setPhotoError] = useState("");
    const fileInputRef = useRef(null);

    /* -- Certificate Document Viewer Modal State -- */
    const [viewingCert, setViewingCert] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerUrl, setViewerUrl] = useState("");
    const [isViewerLoading, setIsViewerLoading] = useState(false);
    const [viewerError, setViewerError] = useState("");

    const handleViewCertification = async (cert) => {
        try {
            const rawFilePath = cert.certificateUrl || cert.certificate_file_path || cert.certificateFileName || "";
            const extractedFileName = rawFilePath ? rawFilePath.split("/").pop().split("\\").pop() : "";
            const certWithFile = {
                ...cert,
                certificateFileName: cert.certificateFileName || extractedFileName,
            };

            setViewingCert(certWithFile);
            setIsViewerOpen(true);
            setIsViewerLoading(true);
            setViewerError("");
            setViewerUrl("");

            const certUrl = cert.certificateUrl || cert.certificate_file_path;
            const rawId = cert.id || cert.cert_id || cert.certification_id;
            const cleanId = rawId ? String(rawId).replace("cert-", "").trim() : null;
            const numericId = cleanId && !isNaN(Number(cleanId)) ? Number(cleanId) : null;

            // 1. If it's an in-memory blob or data URL, use directly
            if (certUrl && (certUrl.startsWith("blob:") || certUrl.startsWith("data:"))) {
                setViewerUrl(certUrl);
                setIsViewerLoading(false);
                return;
            }

            // 2. If it's a numeric ID, fetch blob from backend download endpoint
            if (numericId) {
                try {
                    const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP004";
                    const authToken = token || localStorage.getItem("lms_token") || `dev-token-${activeEmpId}`;
                    const res = await axios.get(`${API_BASE_URL}/api/employee/certifications/${numericId}/download`, {
                        headers: {
                            Authorization: `Bearer ${authToken}`,
                            "x-employee-id": activeEmpId,
                        },
                        responseType: "blob",
                    });
                    const ext = (extractedFileName || cert.certificateFileName || cert.fileName || "pdf").split(".").pop().toLowerCase();
                    const mimeType = res.data.type || (ext === "png" ? "image/png" : (ext === "jpg" || ext === "jpeg") ? "image/jpeg" : "application/pdf");
                    const blob = new Blob([res.data], { type: mimeType });
                    const blobUrl = window.URL.createObjectURL(blob);
                    setViewerUrl(blobUrl);
                    setIsViewerLoading(false);
                    return;
                } catch (apiErr) {
                    console.warn("Backend certificate blob fetch failed, falling back to static URL:", apiErr);
                }
            }

            // 3. Fallback to direct static URL if available
            if (certUrl && certUrl !== "#") {
                const targetUrl = certUrl.startsWith("http")
                    ? certUrl
                    : `${API_BASE_URL}${certUrl.startsWith("/") ? "" : "/"}${certUrl}`;
                setViewerUrl(targetUrl);
                setIsViewerLoading(false);
                return;
            }

            // No document found
            setIsViewerLoading(false);
            setViewerError(`No certificate document file is available for "${cert.name || "this certification"}".`);
        } catch (err) {
            console.error("Failed to view certificate:", err);
            setIsViewerLoading(false);
            setViewerError(err.message || "Failed to load certificate document.");
        }
    };

    const activeEmpId =
        user?.employee_id ||
        currentUser?.employee_id ||
        localStorage.getItem("lms_active_employee_id") ||
        "";

    // Fetch live profile directly from backend (/api/profile/view) combining Azure AD + SQL Server
    useEffect(() => {
        let isMounted = true;
        const loadLiveProfile = async () => {
            const authToken = token || localStorage.getItem("lms_token");
            if (!authToken) {
                if (isMounted) setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const data = await fetchMyProfile(authToken);
                if (isMounted && data) {
                    setProfileData(data);
                    setHasLoadedProfile(true);
                }
            } catch (err) {
                console.error("Failed to load live profile from backend:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadLiveProfile();
        return () => {
            isMounted = false;
        };
    }, [token, activeEmpId]);

    const roleDisplayName =
        activeRole === "Reporting_Manager" || activeRole === "ReportingManager" || activeRole === "Reporting Manager"
            ? "Reporting Manager"
            : activeRole === "L_D" || activeRole === "L&D" || activeRole === "LD"
                ? "L&D"
                : activeRole;

    const liveUser = user || currentUser;
    const userName = profileData?.basicInfo?.fullName || liveUser?.full_name || liveUser?.name || "User";
    const firstName = userName.split(" ")[0] || "User";

    // Auto-open modal if ?edit=true is in URL query
    useEffect(() => {
        if (searchParams.get("edit") === "true") {
            setEditModalStep(1);
            setEditModalMode("wizard");
            setIsEditModalOpen(true);
        }
    }, [searchParams]);

    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        if (searchParams.get("edit") === "true") {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("edit");
            nextParams.delete("t");
            setSearchParams(nextParams, { replace: true });
        }
    };

    const handleOpenEdit = (stepNumber) => {
        setEditModalStep(stepNumber);
        setEditModalMode("single");
        setIsEditModalOpen(true);
    };

    const handleSaveProfile = async (newProfileData) => {
        setIsSaving(true);
        try {
            const authToken = token || localStorage.getItem("lms_token");
            const updated = await updateMyProfile(newProfileData, authToken);
            const effectiveProfile = updated || newProfileData;
            setProfileData(effectiveProfile);
            try {
                const storedUser = localStorage.getItem("lms_user");
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    parsed.linkedin_url = effectiveProfile?.basicInfo?.linkedinUrl || null;
                    localStorage.setItem("lms_user", JSON.stringify(parsed));
                }
            } catch (_) { }
            if (setIsProfileCompleted) {
                setIsProfileCompleted(true);
            }
            handleCloseModal();
        } catch (err) {
            const detailMsg = err.response?.data?.detail || err.message || "Unknown error";
            console.error("Failed to save profile to database:", detailMsg, err);
            setAlertDialog({
                isOpen: true,
                title: "Failed to Save Profile",
                message: typeof detailMsg === "string" ? detailMsg : JSON.stringify(detailMsg),
                type: "error",
            });
        } finally {
            setIsSaving(false);
        }
    };







    const basicInfo = profileData?.basicInfo || EMPTY_PROFILE.basicInfo;
    const skillsExpertise = profileData?.skillsExpertise || EMPTY_PROFILE.skillsExpertise;
    const learningCertifications = profileData?.learningCertifications || EMPTY_PROFILE.learningCertifications;
    const showSkeleton = isLoading || !hasLoadedProfile;

    const displayCertifications = (learningCertifications.certifications || []).filter((cert) => {
        const rawType = String(
            cert.certificateType ||
            cert.type ||
            ""
        ).toLowerCase();
        return !rawType.includes("course completion") && !rawType.includes("course certificate");
    });

    return (
        <div className="profile-page-container">
            {/* Hidden Photo File Input with JPG/PNG format accept */}


            {/* Top Page Header */}
            <PageHeader
                title={`${roleDisplayName} Profile`}
                subtitle="Manage your personal profile, technical skills, professional certification, and learning goals."
            />

            {/* =========================================================
                SECTIONS WRAPPER — transparent, vertically scrollable
                ========================================================= */}
            <div className="profile-sections-wrapper">

                {/* =========================================================
                SECTION 1: BASIC INFORMATION
                ========================================================= */}
                <section className="profile-section-card-1">
                    <div className="profile-section-header">
                        <h2 className="profile-section-title">Basic Information</h2>
                        <button
                            type="button"
                            className="profile-edit-btn"
                            disabled={showSkeleton}
                            onClick={() => handleOpenEdit(1)}
                        >
                            <img src={editPencilIcon} alt="" className="profile-edit-pencil-icon" />
                            <span>Edit</span>
                        </button>
                    </div>

                    <div className="profile-basic-grid">
                        {/* Column 1 */}
                        <div className="profile-info-column-card">
                            <div className="profile-photo-row">
                                <div className="profile-avatar-large">
                                    {showSkeleton ? (
                                        <span className="ld-skeleton-circle" style={{ width: "100%", height: "100%" }} />
                                    ) : (
                                        basicInfo.photoInitials || "RK"
                                    )}
                                </div>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Employee ID</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={86} /> : basicInfo.employeeId}
                                </span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Work Email</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={170} /> : basicInfo.workEmail}
                                </span>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="profile-info-column-card">
                            <div className="profile-field-row">
                                <span className="profile-field-label">Job Title</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={120} /> : basicInfo.jobTitle}
                                </span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Date of Joining</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={100} /> : basicInfo.dateOfJoining}
                                </span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Full Name</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={135} /> : basicInfo.fullName}
                                </span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Department</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={145} /> : basicInfo.department}
                                </span>
                            </div>
                        </div>

                        {/* Column 3 */}
                        <div className="profile-info-column-card">
                            <div className="profile-field-row">
                                <span className="profile-field-label">Job Location</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={130} /> : basicInfo.jobLocation}
                                </span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Reporting Manager</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={135} /> : basicInfo.reportingManager}
                                </span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">Mobile Number</span>
                                <span className="profile-field-value">
                                    {showSkeleton ? <SkeletonBlock width={125} /> : basicInfo.mobileNumber}
                                </span>
                            </div>

                            <div className="profile-field-row">
                                <span className="profile-field-label">LinkedIn URL</span>
                                {showSkeleton ? (
                                    <span className="profile-field-value">
                                        <SkeletonBlock width={180} />
                                    </span>
                                ) : basicInfo.linkedinUrl && String(basicInfo.linkedinUrl).trim() ? (
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

                {/* =========================================================
                SECTION 2: SKILLS & EXPERTISE
                ========================================================= */}
                <section className="profile-section-card-2">
                    <div className="profile-section-header">
                        <h2 className="profile-section-title">Skills & Expertise</h2>
                        <button
                            type="button"
                            className="profile-edit-btn"
                            disabled={showSkeleton}
                            onClick={() => handleOpenEdit(2)}
                        >
                            <img src={editPencilIcon} alt="" className="profile-edit-pencil-icon" />
                            <span>Edit</span>
                        </button>
                    </div>

                    <div className="profile-skills-grid">
                        {/* Left Column */}
                        <div className="profile-skills-card">
                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Professional summary</span>
                                {showSkeleton ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                                        <SkeletonBlock width="92%" />
                                        <SkeletonBlock width="68%" />
                                    </div>
                                ) : (
                                    <p className="profile-about-text">
                                        {skillsExpertise.aboutMe || "No bio added yet."}
                                    </p>
                                )}
                            </div>

                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Technical Skills</span>
                                {showSkeleton ? (
                                    <SkeletonPills widths={[76, 92, 84]} />
                                ) : (
                                    <div className="profile-tags-wrapper">
                                        {(skillsExpertise.technicalSkills || []).map((skill) => (
                                            <span key={skill} className="profile-tag-pill" title={skill}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="profile-skills-card">
                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Professional Skills</span>
                                {showSkeleton ? (
                                    <SkeletonPills widths={[88, 98, 76]} />
                                ) : (
                                    <div className="profile-tags-wrapper">
                                        {(skillsExpertise.professionalSkills || []).map((skill) => (
                                            <span key={skill} className="profile-tag-pill" title={skill}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="profile-skill-group-horizontal">
                                <span className="profile-skill-label">Area of Expertise</span>
                                {showSkeleton ? (
                                    <SkeletonPills widths={[112, 88, 94]} />
                                ) : (
                                    <div className="profile-tags-wrapper">
                                        {(skillsExpertise.areaOfExpertise || []).map((area) => (
                                            <span key={area} className="profile-tag-pill" title={area}>
                                                {area}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* =========================================================
                SECTION 3: LEARNING & CERTIFICATIONS
                ========================================================= */}
                <section className="profile-section-card-3">
                    <div className="profile-section-header">
                        <h2 className="profile-section-title">Learning & Certifications</h2>
                        <button
                            type="button"
                            className="profile-edit-btn"
                            disabled={showSkeleton}
                            onClick={() => handleOpenEdit(3)}
                        >
                            <img src={editPencilIcon} alt="" className="profile-edit-pencil-icon" />
                            <span>Edit</span>
                        </button>
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
                                        {showSkeleton ? (
                                            [1, 2].map((i) => (
                                                <tr key={`cert-skel-${i}`} className="ld-table-skeleton-row">
                                                    <td className="ld-table-skeleton-cell"><SkeletonBlock width="85%" /></td>
                                                    <td className="ld-table-skeleton-cell"><SkeletonBlock width="70%" /></td>
                                                    <td className="ld-table-skeleton-cell"><SkeletonBlock width={72} /></td>
                                                    <td className="ld-table-skeleton-cell"><SkeletonBlock width={72} /></td>
                                                </tr>
                                            ))
                                        ) : displayCertifications.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: "center", color: "#94A3B8", padding: "12px" }}>
                                                    No certifications recorded.
                                                </td>
                                            </tr>
                                        ) : (
                                            displayCertifications.map((cert) => (
                                                <tr key={cert.id}>
                                                    <td style={{ fontWeight: 400 }} title={cert.name}>
                                                        <span
                                                            className="profile-cert-name-clickable"
                                                            onClick={() => handleViewCertification(cert)}
                                                            title={`View ${cert.name}`}
                                                        >
                                                            {cert.name}
                                                        </span>
                                                    </td>
                                                    <td title={cert.issuer}>{cert.issuer}</td>
                                                    <td>{formatCertDate(cert.issueDate)}</td>
                                                    <td>{formatCertDate(cert.expiryDate)}</td>
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
                                {showSkeleton ? (
                                    <SkeletonPills widths={[116, 98, 108]} />
                                ) : (
                                    <div className="profile-tags-wrapper">
                                        {(learningCertifications.learningInterests || []).map((interest) => (
                                            <span key={interest} className="profile-tag-pill" title={interest}>
                                                {interest}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

            </div>{/* end profile-sections-wrapper */}

            {/* Edit Profile Modal (Single Section popup or Wizard) */}
            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={handleCloseModal}
                initialStep={editModalStep}
                section={editModalStep}
                mode={editModalMode}
                profileData={profileData}
                onSaveProfile={handleSaveProfile}
                isSaving={isSaving}
            />

            {/* Certificate Document Viewer Modal */}
            <CertificateViewerModal
                isOpen={isViewerOpen}
                onClose={() => {
                    setIsViewerOpen(false);
                    setViewingCert(null);
                    setViewerUrl("");
                    setViewerError("");
                }}
                cert={viewingCert}
                previewUrl={viewerUrl}
                isLoading={isViewerLoading}
                errorMessage={viewerError}
            />

            {alertDialog.isOpen && (
                <AlertDialog
                    isOpen={alertDialog.isOpen}
                    onClose={() => setAlertDialog((prev) => ({ ...prev, isOpen: false }))}
                    title={alertDialog.title || "Alert"}
                    message={alertDialog.message}
                    type={alertDialog.type || "error"}
                />
            )}
        </div>
    );
}
