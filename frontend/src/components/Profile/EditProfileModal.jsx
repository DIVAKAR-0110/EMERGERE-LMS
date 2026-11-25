import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import EditBasicInfo from "./EditBasicInfo";
import EditSkillsExpertise, { MAX_SUMMARY_LENGTH } from "./EditSkillsExpertise";
import EditCertifications from "./EditCertifications";
import { normalizeSingleSpacing, validateLinkedInUrl } from "../../utils/validationUtils";
import "../../styles/Profile.css";

export default function EditProfileModal({
    isOpen,
    onClose,
    initialStep = 1,
    section = null,
    mode = "wizard",
    profileData,
    onSaveProfile,
    isSaving = false,
    isMandatory = false,
}) {
    const effectiveMode = isMandatory ? "wizard" : (mode || (section !== null ? "single" : "wizard"));
    const activeSection = section || initialStep;
    const [currentStep, setCurrentStep] = useState(activeSection);
    const [formData, setFormData] = useState(profileData);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            setCurrentStep(section || initialStep);
            setFormData(profileData);
            setErrors({});
        }
    }, [isOpen, initialStep, section, profileData]);

    if (!isOpen) return null;

    const handleBasicInfoChange = (newBasic) => {
        setFormData((prev) => ({ ...prev, basicInfo: newBasic }));
        if (errors.linkedinUrl) {
            const err = validateLinkedInUrl(newBasic?.linkedinUrl);
            setErrors((prev) => {
                const next = { ...prev };
                if (!err) {
                    delete next.linkedinUrl;
                } else {
                    next.linkedinUrl = err;
                }
                return next;
            });
        }
    };

    const handleSkillsChange = (newSkills) => {
        setFormData((prev) => ({ ...prev, skillsExpertise: newSkills }));
        setErrors((prev) => {
            const next = { ...prev };
            if (newSkills?.aboutMe?.trim() && next.aboutMe) {
                if (newSkills.aboutMe.trim().length <= MAX_SUMMARY_LENGTH) delete next.aboutMe;
            }
            if (newSkills?.technicalSkills?.length > 0 && next.technicalSkills) delete next.technicalSkills;
            if (newSkills?.professionalSkills?.length > 0 && next.professionalSkills) delete next.professionalSkills;
            if (newSkills?.areaOfExpertise?.length > 0 && next.areaOfExpertise) delete next.areaOfExpertise;
            return next;
        });
    };


    const handleCertsChange = (newCerts) => {
        setFormData((prev) => ({ ...prev, learningCertifications: newCerts }));
        if (newCerts?.learningInterests?.length > 0 && errors.learningInterests) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next.learningInterests;
                return next;
            });
        }
    };

    const buildNormalizedProfilePayload = (data) => (
        data?.skillsExpertise
            ? {
                ...data,
                skillsExpertise: {
                    ...data.skillsExpertise,
                    aboutMe: normalizeSingleSpacing(data.skillsExpertise.aboutMe || "", {
                        trimEdges: true,
                    }).slice(0, MAX_SUMMARY_LENGTH),
                },
            }
            : data
    );

    const handleSaveAndClose = () => {
        if (!validateStep(currentStep)) return;
        if (formData.basicInfo) {
            const linkedin = (formData.basicInfo?.linkedinUrl || "").trim();
            const linkedinErr = validateLinkedInUrl(linkedin);
            if (linkedinErr) {
                setCurrentStep(1);
                setErrors({ linkedinUrl: linkedinErr });
                return;
            }
        }
        onSaveProfile(buildNormalizedProfilePayload(formData));
    };

    const validateStep = (step) => {
        const newErrors = {};
        if (step === 1) {
            const linkedin = (formData.basicInfo?.linkedinUrl || "").trim();
            const linkedinErr = validateLinkedInUrl(linkedin);
            if (linkedinErr) {
                newErrors.linkedinUrl = linkedinErr;
            }
        }

        if (step === 2) {
            const rawSummary = normalizeSingleSpacing(formData.skillsExpertise?.aboutMe || "", { trimEdges: true });

            if (!rawSummary) {
                newErrors.aboutMe = "Professional summary is required.";
            } else if (rawSummary.length > MAX_SUMMARY_LENGTH) {
                newErrors.aboutMe = `Professional summary must not exceed ${MAX_SUMMARY_LENGTH} characters.`;
            }


            const techSkills = formData.skillsExpertise?.technicalSkills || [];
            if (techSkills.length === 0) {
                newErrors.technicalSkills = "At least one technical skill is required.";
            }

            const profSkills = formData.skillsExpertise?.professionalSkills || [];
            if (profSkills.length === 0) {
                newErrors.professionalSkills = "At least one workplace skill is required.";
            }

            const areas = formData.skillsExpertise?.areaOfExpertise || [];
            if (areas.length === 0) {
                newErrors.areaOfExpertise = "At least one area of expertise is required.";
            }
        }

        if (step === 3) {
            const interests = formData.learningCertifications?.learningInterests || [];
            if (interests.length === 0) {
                newErrors.learningInterests = "Please select at least one area you'd like to learn or improve.";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (!validateStep(currentStep)) return;
        if (currentStep < 3) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setErrors({});
            setCurrentStep((prev) => prev - 1);
        }
    };

    const handleSubmitProfile = () => {
        if (!validateStep(currentStep)) return;
        const linkedin = (formData.basicInfo?.linkedinUrl || "").trim();
        const linkedinErr = validateLinkedInUrl(linkedin);
        if (linkedinErr) {
            setCurrentStep(1);
            setErrors({ linkedinUrl: linkedinErr });
            return;
        }
        onSaveProfile(buildNormalizedProfilePayload(formData));
    };

    const STEPS = [
        { num: 1, label: "Basic Information" },
        { num: 2, label: "Skills & Expertise" },
        { num: 3, label: "Learning & Certifications" },
    ];

    const getModalHeader = () => {
        if (effectiveMode === "single") {
            if (currentStep === 1) {
                return {
                    title: "Basic Information",
                    subtitle: "Verify your details and update your LinkedIn URL",
                };
            }
            if (currentStep === 2) {
                return {
                    title: "Skills & Expertise",
                    subtitle: "Showcase your professional summary, skills, and areas of expertise.",
                };
            }
            if (currentStep === 3) {
                return {
                    title: "Learning & Certifications",
                    subtitle: "Review your details and update your learning preferences.",
                };
            }
        }
        return {
            title: "Complete your LMS Profile",
            subtitle: "Help us personalize your learning experience for you.",
        };
    };

    const modalHeader = getModalHeader();

    return createPortal(
        <div className="edit-profile-overlay">
            <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={`edit-profile-modal-header ${effectiveMode === "single" ? "single-mode" : ""}`}>
                    <h2 className="edit-profile-title">{modalHeader.title}</h2>
                    <p className="edit-profile-subtitle">{modalHeader.subtitle}</p>
                    {!isMandatory && (
                        <button
                            type="button"
                            className="edit-profile-close-btn"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Stepper — tab-style indicator only in wizard mode */}
                {effectiveMode !== "single" && (
                    <div className="edit-profile-stepper" role="tablist" aria-label="Profile editing steps">
                        {STEPS.map((step) => {
                            const isActive = currentStep === step.num;
                            const isCompleted = currentStep > step.num;
                            return (
                                <div
                                    key={step.num}
                                    className={`stepper-tab-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-label={`Step ${step.num}: ${step.label}${isCompleted ? " (completed)" : ""}`}
                                >
                                    <span className="stepper-num-badge">
                                        {isCompleted ? <Check size={11} strokeWidth={3} /> : step.num}
                                    </span>
                                    <span className="stepper-label">{step.label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Modal Body — only active step displayed */}
                <div className="edit-profile-modal-body">
                    <div className="edit-profile-step-panel" style={{ display: currentStep === 1 ? "block" : "none" }}>
                        <EditBasicInfo
                            basicInfo={formData.basicInfo}
                            onChange={handleBasicInfoChange}
                            errors={errors}
                        />
                    </div>
                    <div className="edit-profile-step-panel" style={{ display: currentStep === 2 ? "block" : "none" }}>
                        <EditSkillsExpertise
                            skillsExpertise={formData.skillsExpertise}
                            onChange={handleSkillsChange}
                            errors={errors}
                        />
                    </div>
                    <div className="edit-profile-step-panel" style={{ display: currentStep === 3 ? "block" : "none" }}>
                        <EditCertifications
                            learningCertifications={formData.learningCertifications}
                            onChange={handleCertsChange}
                            errors={errors}
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                {effectiveMode === "single" ? (
                    <div className="edit-profile-modal-footer single-mode-footer">
                        <div className="modal-footer-right">
                            <button
                                type="button"
                                className="btn-modal-cancel"
                                onClick={onClose}
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-modal-submit"
                                onClick={handleSaveAndClose}
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : <span>Save</span>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={`edit-profile-modal-footer ${currentStep > 1 ? "has-back" : ""}`}>
                        {currentStep > 1 && (
                            <button
                                type="button"
                                className="btn-modal-back"
                                onClick={handleBack}
                            >
                                <span>Back</span>
                            </button>
                        )}

                        <div className="modal-footer-right">
                            {!isMandatory && (
                                <button
                                    type="button"
                                    className="btn-modal-save"
                                    onClick={handleSaveAndClose}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Saving..." : <span>Save</span>}
                                </button>
                            )}

                            {currentStep < 3 ? (
                                <button
                                    type="button"
                                    className="btn-modal-next"
                                    onClick={handleNext}
                                    disabled={isSaving}
                                >
                                    <span>Next</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn-modal-submit"
                                    onClick={handleSubmitProfile}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Saving..." : <span>Submit&nbsp;Profile</span>}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
