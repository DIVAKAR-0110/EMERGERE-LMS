import React from "react";
import greendotIcon from "../../assets/greendot.svg";
import innercalendarIcon from "../../assets/innercalendar.svg";

const AIAssistantInfoBanner = ({ role = "Employee" }) => {
    const isLdOrManager =
        role === "L&D Team" ||
        role === "L&D" ||
        role === "L_D" ||
        role === "Reporting Manager" ||
        role === "Reporting_Manager";

    const bannerSubtitle = isLdOrManager
        ? "Ask me about learning analytics, curriculum design, course recommendations, or compliance training needs."
        : "Ask about reports, courses, certifications, tasks, reimbursements, and company policies.";

    return (
        <div className="ai-info-banner">
            <div className="ai-info-left">
                <div className="ai-info-title-row">
                    <img
                        src={greendotIcon}
                        alt=""
                        className="ai-greendot-img"
                    />
                    <span className="ai-info-title">AI Workplace Assistant!</span>
                </div>
                <p className="ai-info-description">
                    {bannerSubtitle}
                </p>
            </div>

            <button
                type="button"
                className="ai-calendar-btn"
                aria-label="Open Calendar"
            >
                <img
                    src={innercalendarIcon}
                    alt="Calendar"
                    className="ai-calendar-img"
                />
            </button>
        </div>
    );
};

export default AIAssistantInfoBanner;
