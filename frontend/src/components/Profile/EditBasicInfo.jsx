import React, { useState, useRef, useEffect } from "react";
import employeeIdIcon from "../../assets/Profile/employeeid.svg";
import fullNameIcon from "../../assets/Profile/fullname.svg";
import workEmailIcon from "../../assets/Profile/workemail.svg";
import departmentIcon from "../../assets/Profile/department.svg";
import jobTitleIcon from "../../assets/Profile/jobtitle.svg";
import locationIcon from "../../assets/Profile/location.svg";
import mobilePhoneIcon from "../../assets/Profile/mobilephone.svg";
import reportingManagerIcon from "../../assets/Profile/reportingmanager.svg";
import dateOfJoiningIcon from "../../assets/Profile/dateofjoining.svg";
import { validateLinkedInUrl } from "../../utils/validationUtils";
import "../../styles/Profile.css";

export default function EditBasicInfo({
    basicInfo,
    onChange,
    errors = {},
    onSave,
    onNext,
}) {
    const [linkedinUrl, setLinkedinUrl] = useState(basicInfo?.linkedinUrl || "");
    const [linkedinError, setLinkedinError] = useState("");

    useEffect(() => {
        setLinkedinUrl(basicInfo?.linkedinUrl || "");
        if (basicInfo?.linkedinUrl) {
            setLinkedinError(validateLinkedInUrl(basicInfo.linkedinUrl));
        } else {
            setLinkedinError("");
        }
    }, [basicInfo?.linkedinUrl]);





    const handleLinkedInChange = (e) => {
        const value = e.target.value;
        setLinkedinUrl(value);
        onChange({ ...basicInfo, linkedinUrl: value });

        const err = validateLinkedInUrl(value);
        setLinkedinError(err);
    };

    const handleLinkedInBlur = () => {
        const err = validateLinkedInUrl(linkedinUrl);
        setLinkedinError(err);
    };

    return (
        <div className="edit-step-container">

            <div className="step-section-header">
                <div className="step-section-title-group">
                    <h3 className="step-section-heading">Employee Information</h3>
                    <p className="step-section-subtext">
                        This information is synced from your organization and cannot be edited
                    </p>
                </div>
                <div className="step-profile-photo-group">
                    <div className="step-avatar-circle">
                        {basicInfo.photoInitials || "RK"}
                    </div>
                </div>
            </div>

            {/* Read-Only Info 2-Column Grid */}
            <div className="readonly-info-grid">
                <div className="readonly-field-card">
                    <img src={employeeIdIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Employee ID</span>
                        <span className="readonly-field-val" title={basicInfo.employeeId}>{basicInfo.employeeId}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={fullNameIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Full Name</span>
                        <span className="readonly-field-val" title={basicInfo.fullName}>{basicInfo.fullName}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={workEmailIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Work Email</span>
                        <span className="readonly-field-val" title={basicInfo.workEmail}>{basicInfo.workEmail}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={departmentIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Department</span>
                        <span className="readonly-field-val" title={basicInfo.department}>{basicInfo.department}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={jobTitleIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Job Title</span>
                        <span className="readonly-field-val" title={basicInfo.jobTitle}>{basicInfo.jobTitle}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={locationIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Job Location</span>
                        <span className="readonly-field-val" title={basicInfo.jobLocation}>{basicInfo.jobLocation}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={mobilePhoneIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Mobile Number</span>
                        <span className="readonly-field-val" title={basicInfo.mobileNumber}>{basicInfo.mobileNumber}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={reportingManagerIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Reporting Manager</span>
                        <span className="readonly-field-val" title={basicInfo.reportingManager}>{basicInfo.reportingManager}</span>
                    </div>
                </div>

                <div className="readonly-field-card">
                    <img src={dateOfJoiningIcon} alt="" className="readonly-field-icon-img" />
                    <div className="readonly-field-text">
                        <span className="readonly-field-label">Date of Joining</span>
                        <span className="readonly-field-val" title={basicInfo.dateOfJoining}>{basicInfo.dateOfJoining}</span>
                    </div>
                </div>
            </div>

            <div className="edit-step-divider" />

            {/* LinkedIn URL Input */}
            <div className="edit-form-field">
                <label className="edit-form-label">
                    LinkedIn URL <span className="req">*</span>
                </label>
                <input
                    type="url"
                    className={`edit-form-input ${linkedinError || errors?.linkedinUrl ? "input-error" : ""}`}
                    value={linkedinUrl}
                    onChange={handleLinkedInChange}
                    onBlur={handleLinkedInBlur}
                    maxLength={100}
                    placeholder="https://www.linkedin.com/in/your-name"
                />
                {(linkedinError || errors?.linkedinUrl) && (
                    <span className="edit-form-error">{linkedinError || errors?.linkedinUrl}</span>
                )}
            </div>
        </div>
    );
}
