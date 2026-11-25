import React, { useState, useEffect } from "react";
import { fetchTeamCoursesData } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

export default function CoursesDataCard() {
    const { token } = useAuth();
    const [coursesData, setCoursesData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadCoursesData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchTeamCoursesData(token);
                if (isMounted && data) {
                    setCoursesData(data);
                }
            } catch (err) {
                console.error("Failed to fetch live team courses data:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadCoursesData();
        return () => {
            isMounted = false;
        };
    }, [token]);

    const totalTeamCourses = coursesData?.total_team_courses || 0;
    const assignedCount = coursesData?.assigned ?? 0;
    const completedCount = coursesData?.completed ?? 0;
    const activeCount = coursesData?.active ?? 0;
    const overdueCount = coursesData?.overdue ?? 0;

    const assignedPct = totalTeamCourses > 0 ? Math.min(100, Math.round((assignedCount / totalTeamCourses) * 100)) : 0;
    const completedPct = totalTeamCourses > 0 ? Math.min(100, Math.round((completedCount / totalTeamCourses) * 100)) : 0;
    const activePct = totalTeamCourses > 0 ? Math.min(100, Math.round((activeCount / totalTeamCourses) * 100)) : 0;
    const overduePct = totalTeamCourses > 0 ? Math.min(100, Math.round((overdueCount / totalTeamCourses) * 100)) : 0;

    const getTooltip = (label) => {
        if (label === "Assigned Courses") {
            const baseText = `${assignedCount} of ${totalTeamCourses} team courses assigned / pending completion (${assignedPct}%)`;
            if (coursesData.assigned_breakdown && coursesData.assigned_breakdown.length > 0) {
                return `${baseText}\n` + coursesData.assigned_breakdown.map((b) => `${b.name}: ${b.count} assigned`).join("\n");
            }
            return baseText;
        }
        if (label === "Completed Courses") {
            const baseText = `${completedCount} of ${totalTeamCourses} total courses completed by your team (${completedPct}%)`;
            if (coursesData.completed_breakdown && coursesData.completed_breakdown.length > 0) {
                return `${baseText}\n` + coursesData.completed_breakdown.map((b) => `${b.name}: ${b.count} completed`).join("\n");
            }
            return baseText;
        }
        if (label === "Active Courses") {
            const baseText = `${activeCount} of ${totalTeamCourses} courses actively in progress (${activePct}%)`;
            if (coursesData.active_breakdown && coursesData.active_breakdown.length > 0) {
                return `${baseText}\n` + coursesData.active_breakdown.map((b) => `${b.name}: ${b.count} in progress`).join("\n");
            }
            return baseText;
        }
        if (label === "Overdue Courses") {
            const baseText = `${overdueCount} of ${totalTeamCourses} courses overdue (${overduePct}%)`;
            if (coursesData.overdue_details && coursesData.overdue_details.length > 0) {
                return `${baseText}\n` + coursesData.overdue_details.map((d) => `• ${d.name}: ${d.course_name} (${d.days_overdue} days overdue • ${d.progress_percentage}% completed)`).join("\n");
            }
            if (coursesData.overdue_breakdown && coursesData.overdue_breakdown.length > 0) {
                return `${baseText}\n` + coursesData.overdue_breakdown.map((b) => `${b.name}: ${b.count} overdue`).join("\n");
            }
            return baseText;
        }
        return "";
    };

    const items = [
        { label: "Assigned Courses", count: assignedCount, color: "#2667f9", percentage: assignedPct },
        { label: "Completed Courses", count: completedCount, color: "#31c27e", percentage: completedPct },
        { label: "Active Courses", count: activeCount, color: "#9e5df9", percentage: activePct },
        { label: "Overdue Courses", count: overdueCount, color: "#FE7356", percentage: overduePct },
    ];

    return (
        <div className="rm-ra-card rm-ra-card-courses-data">
            <h3 className="rm-ra-card-title">Courses Data</h3>

            <div className="rm-ra-courses-data-list">
                {isLoading || !coursesData ? (
                    [1, 2, 3, 4].map((i) => (
                        <div key={`course-skel-${i}`} className="rm-ra-course-data-item" style={{ opacity: 0.85 }}>
                            <div className="rm-ra-course-data-header" style={{ marginBottom: "6px" }}>
                                <span className="ld-skeleton-block" style={{ width: "110px", height: "14px", borderRadius: "3px" }} />
                            </div>
                            <div className="rm-ra-course-data-bar-row">
                                <div className="rm-ra-course-data-track">
                                    <span className="ld-skeleton-block" style={{ width: "100%", height: "100%", borderRadius: "3px" }} />
                                </div>
                                <span className="ld-skeleton-block" style={{ width: "20px", height: "14px", borderRadius: "3px" }} />
                            </div>
                        </div>
                    ))
                ) : (
                    items.map((item) => (
                        <div
                            key={item.label}
                            className="rm-ra-course-data-item"
                            title={getTooltip(item.label)}
                        >
                            <div className="rm-ra-course-data-header">
                                <span>{item.label}</span>
                            </div>
                            <div className="rm-ra-course-data-bar-row">
                                <div className="rm-ra-course-data-track">
                                    <div
                                        className="rm-ra-course-data-fill"
                                        style={{
                                            width: `${item.percentage}%`,
                                            backgroundColor: item.color,
                                        }}
                                    />
                                </div>
                                <span className="rm-ra-course-data-count">{item.count}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
