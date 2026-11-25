import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchMyProfile, updateMyProfile, EMPTY_PROFILE } from "../../services/profileService";
import EditProfileModal from "./EditProfileModal";
import AlertDialog from "../common/AlertDialog";

export default function FirstTimeProfileModal() {
    const { user, currentUser, token, isProfileCompleted, setIsProfileCompleted } = useAuth();

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
    const [isSaving, setIsSaving] = useState(false);
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: "", message: "", type: "error" });

    useEffect(() => {
        let isMounted = true;
        const activeUser = user || currentUser;
        if (!activeUser) return;

        // If profile is already marked completed, don't fetch
        if (isProfileCompleted) return;

        const loadProfile = async () => {
            const authToken = token || localStorage.getItem("lms_token");
            try {
                const data = await fetchMyProfile(authToken);
                if (isMounted && data) {
                    setProfileData(data);
                    if (data.isProfileCompleted) {
                        setIsProfileCompleted(true);
                        localStorage.setItem("lms_profile_completed", "true");
                    }
                }
            } catch (err) {
                console.warn("[FirstTimeProfileModal] Notice fetching profile:", err?.message);
                if (isMounted) {
                    setProfileData((prev) => ({
                        ...prev,
                        basicInfo: buildInitialBasicInfo(activeUser),
                    }));
                }
            }
        };

        loadProfile();

        return () => {
            isMounted = false;
        };
    }, [isProfileCompleted, user, currentUser, token, setIsProfileCompleted]);

    if (isProfileCompleted || !(user || currentUser)) {
        return null;
    }

    const handleSaveProfile = async (formData) => {
        setIsSaving(true);
        try {
            const authToken = token || localStorage.getItem("lms_token");
            const updated = await updateMyProfile(formData, authToken);
            if (updated) {
                setProfileData(updated);
            }
            setIsProfileCompleted(true);
            localStorage.setItem("lms_profile_completed", "true");
        } catch (err) {
            const rawDetail = err.response?.data?.detail;
            const detailMsg = Array.isArray(rawDetail)
                ? rawDetail.map((d) => d.msg || JSON.stringify(d)).join(", ")
                : rawDetail || err.message || "Failed to save profile";
            console.error("[FirstTimeProfileModal] Error saving profile:", err);
            setAlertDialog({
                isOpen: true,
                title: "Unable to Complete Profile",
                message: typeof detailMsg === "string" ? detailMsg : JSON.stringify(detailMsg),
                type: "error",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <EditProfileModal
                isOpen={!isProfileCompleted}
                onClose={() => { }}
                initialStep={1}
                mode="wizard"
                profileData={profileData}
                onSaveProfile={handleSaveProfile}
                isSaving={isSaving}
                isMandatory={true}
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
        </>
    );
}
