import React from "react";
import userIcon from "../../../assets/Leaderboard/user.svg";
import greencapIcon from "../../../assets/Leaderboard/greencap.svg";
import clockIcon from "../../../assets/Leaderboard/clock.svg";
import redbadgecardIcon from "../../../assets/Leaderboard/redbadgecard.svg";

const JuneOverview = ({ monthName, activeTab, overviewData = {}, isLoading = false }) => {
    // Dynamic current month and current year calculation (e.g. "October 2026")
    const currentMonthYear = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

    let displayTitle;
    if (activeTab === "This Week") {
        displayTitle = "This Week Overview";
    } else if (activeTab === "All Time" || monthName === "All Time") {
        displayTitle = "All Time Overview";
    } else {
        displayTitle = `${currentMonthYear} Overview`;
    }

    const stats = [
        {
            id: "active-learners",
            label: "Active Learners",
            value: (isLoading || overviewData.activeLearners == null) ? null : String(overviewData.activeLearners),
            icon: userIcon,
            iconWidth: 18,
            iconHeight: 18,
            bgColor: "#F2F7FE",
        },
        {
            id: "courses-completed",
            label: "Courses Completed",
            value: (isLoading || overviewData.coursesCompleted == null) ? null : String(overviewData.coursesCompleted),
            icon: greencapIcon,
            iconWidth: 18,
            iconHeight: 18,
            bgColor: "#EEFBF5",
        },
        {
            id: "learning-hours",
            label: "Learning Hours",
            value: (isLoading || overviewData.learningHours == null) ? null : String(overviewData.learningHours),
            icon: clockIcon,
            iconWidth: 17,
            iconHeight: 17,
            bgColor: "#F7F3FD",
        },
        {
            id: "certifications-earned",
            label: "Certifications Earned",
            value: (isLoading || overviewData.certificationsEarned == null) ? null : String(overviewData.certificationsEarned),
            icon: redbadgecardIcon,
            iconWidth: 18,
            iconHeight: 18,
            bgColor: "#FEF3EF",
        },
    ];

    return (
        <div className="emp-leaderboard-card emp-overview-card">
            <h3 className="emp-leaderboard-card-title">{displayTitle}</h3>
            <div className="emp-overview-stats-grid">
                {stats.map((stat) => (
                    <div
                        key={stat.id}
                        className="emp-overview-stat-box"
                        style={{ backgroundColor: stat.bgColor }}
                    >
                        <div className="emp-overview-stat-icon-wrapper">
                            <img
                                src={stat.icon}
                                alt={stat.label}
                                width={stat.iconWidth}
                                height={stat.iconHeight}
                                className="emp-overview-stat-icon-img"
                            />
                        </div>
                        <div className="emp-overview-stat-value">
                            {stat.value !== null ? (
                                stat.value
                            ) : (
                                <span className="ld-skeleton-block" style={{ width: 44, height: 20, display: "inline-block", borderRadius: 4 }} />
                            )}
                        </div>
                        <div className="emp-overview-stat-label">
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default JuneOverview;
