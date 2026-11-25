import React from "react";
import PageHeader from "../common/PageHeader";

const AIAssistantHeader = ({ userName = "", role = "Employee" }) => {
    const isLdOrManager =
        role === "L&D Team" ||
        role === "L&D" ||
        role === "L_D" ||
        role === "Reporting Manager" ||
        role === "Reporting_Manager";

    const isLd = ["L&D Team", "L&D", "L_D", "LD"].includes(role);

    const greeting = isLdOrManager ? "Good Morning" : "Good morning";
    const displayName = userName ? userName.split("(")[0].trim() : "Learner";

    const badgeElement = (
        <span className={`copilot-role-badge ${isLd ? "badge-ld" : "badge-personal"}`}>
            <span className="copilot-role-badge-dot"></span>
            {isLd ? "L&D Admin Access" : "Personal Access"}
        </span>
    );

    return (
        <PageHeader
            title={
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                    AI Assistant
                    {badgeElement}
                </span>
            }
            subtitle={`${greeting}, ${displayName}!`}
            className="ai-assistant-page-header"
        />
    );
};

export default AIAssistantHeader;
