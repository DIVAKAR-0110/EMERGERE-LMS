import React, { useState, useEffect } from "react";
import contactIcon from "../../../assets/reportsanalytics/contact.svg";
import educationIcon from "../../../assets/reportsanalytics/education.svg";
import clockIcon from "../../../assets/reportsanalytics/timer.svg";
import certificationsIcon from "../../../assets/reportsanalytics/certifications.svg";
import warningIcon from "../../../assets/Certification/warning.svg";
import tickIcon from "../../../assets/reportsanalytics/tick.svg";
import { fetchTeamOverviewStats } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

export default function TeamOverviewCard() {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [overviewData, setOverviewData] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const loadOverviewData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchTeamOverviewStats(token);
                if (isMounted && data) {
                    setOverviewData(data);
                }
            } catch (err) {
                console.error("Failed to load live team overview data:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadOverviewData();
        return () => {
            isMounted = false;
        };
    }, [token]);

    const getTooltip = (id) => {
        const details = overviewData?.details || {};
        switch (id) {
            case 1:
                if (details.members_list && details.members_list.length > 0) {
                    return details.members_list.map((m) => `${m.name} (${m.designation || "Member"})`).join("\n");
                }
                return "Direct reports in your team";
            case 2:
                if (details.active_learners_list && details.active_learners_list.length > 0) {
                    return details.active_learners_list.map((l) => `${l.name} (${l.active_courses} active courses)`).join("\n");
                }
                return "Team members currently with active courses in progress";
            case 3:
                const hb = details.hours_breakdown;
                const mCount = hb?.months_calculated || overviewData?.learning_months_count || 1;
                const totHours = hb?.total_hours != null ? `${hb.total_hours}h` : (overviewData?.total_learning_hours || "0h");
                const avgVal = overviewData?.avg_learning_hours || overviewData?.learning_hours || "0h";
                if (hb) {
                    return `${avgVal} average per month across ${mCount} month${mCount === 1 ? "" : "s"} of learning logs\n(${totHours} total logged: ${hb.video_hours || 0}h Video • ${hb.practice_hours || 0}h Practice & Labs)`;
                }
                return "Average monthly learning hours calculated for your team";
            case 4:
                if (details.course_completion_list && details.course_completion_list.length > 0) {
                    return details.course_completion_list.map((c) => `• ${c.name}: ${c.course_name}`).join("\n");
                }
                return "Course completion certificates earned by your team members";
            case 5:
                if (details.pending_requests_list && details.pending_requests_list.length > 0) {
                    return details.pending_requests_list.map((r) => `• ${r.name}: ${r.course_name}`).join("\n");
                }
                return "Course requests submitted by your team awaiting review";
            case 6:
                if (details.approved_requests_list && details.approved_requests_list.length > 0) {
                    return details.approved_requests_list.map((r) => `• ${r.name}: ${r.course_name}`).join("\n");
                }
                return "Course requests approved for your team";
            default:
                return "";
        }
    };

    const kpis = [
        {
            id: 1,
            label: "Total Team Members",
            value: (isLoading || overviewData?.team_members == null) ? null : String(overviewData.team_members),
            bgColor: "#F2F7FE",
            icon: <img src={contactIcon} alt="Team Members" style={{ width: 18, height: 18, objectFit: "contain" }} />,
        },
        {
            id: 2,
            label: "Active Learners",
            value: (isLoading || overviewData?.active_learners == null) ? null : String(overviewData.active_learners),
            bgColor: "#EEFBF5",
            icon: <img src={educationIcon} alt="Active Learners" style={{ width: 18, height: 18, objectFit: "contain" }} />,
        },
        {
            id: 3,
            label: "Learning Avg.Hours",
            value: (isLoading || (overviewData?.avg_learning_hours == null && overviewData?.learning_hours == null))
                ? null
                : String(overviewData?.avg_learning_hours ?? overviewData?.learning_hours),
            bgColor: "#F7F3FD",
            icon: <img src={clockIcon} alt="Learning Avg.Hours" style={{ width: 18, height: 18, objectFit: "contain" }} />,
        },
        {
            id: 4,
            label: "Courses certificate",
            value: (isLoading || (overviewData?.courses_completion_certificate == null && overviewData?.certificates_earned == null))
                ? null
                : String(overviewData?.courses_completion_certificate ?? overviewData?.certificates_earned ?? 0),
            bgColor: "#FEF3EF",
            icon: <img src={certificationsIcon} alt="Courses completion certificate" style={{ width: 18, height: 18, objectFit: "contain" }} />,
        },
        {
            id: 5,
            label: "Course Request",
            value: (isLoading || (overviewData?.course_requests == null && overviewData?.pending_claims == null))
                ? null
                : String(overviewData?.course_requests ?? overviewData?.pending_claims ?? 0),
            bgColor: "#FEF8F0",
            icon: <img src={warningIcon} alt="Course Request" style={{ width: 18, height: 18, objectFit: "contain" }} />,
        },
        {
            id: 6,
            label: "Course Approve",
            value: (isLoading || (overviewData?.course_approved == null && overviewData?.approved_claims == null))
                ? null
                : String(overviewData?.course_approved ?? overviewData?.approved_claims ?? 0),
            bgColor: "#EEFAFD",
            icon: <img src={tickIcon} alt="Course Approve" style={{ width: 18, height: 18, objectFit: "contain" }} />,
        },
    ];

    return (
        <div className="rm-ra-card rm-ra-card-team-overview">
            <h3 className="rm-ra-card-title">Team Overview</h3>
            <div className="rm-ra-team-overview-grid">
                {kpis.map((kpi) => (
                    <div
                        key={kpi.id}
                        className="rm-ra-kpi-box"
                        style={{ backgroundColor: kpi.bgColor }}
                        title={getTooltip(kpi.id)}
                    >
                        <div className="rm-ra-kpi-icon">{kpi.icon}</div>
                        <span className="rm-ra-kpi-value">
                            {kpi.value !== null ? (
                                kpi.value
                            ) : (
                                <span className="ld-skeleton-block" style={{ width: 36, height: 20, display: "inline-block", borderRadius: 4 }} />
                            )}
                        </span>
                        <span className="rm-ra-kpi-label">{kpi.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
