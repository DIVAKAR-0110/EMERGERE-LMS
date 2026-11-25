import React, { useState, useEffect } from "react";
import personSvg from "../../../assets/rmdashboard/person.svg";
import bookSvg from "../../../assets/rmdashboard/book.svg";
import clockSvg from "../../../assets/rmdashboard/clock.svg";
import certiSvg from "../../../assets/rmdashboard/certi.svg";
import { fetchTeamKpiStats, fetchTeamMembers, fetchTeamCertifications } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

export default function KPIStatsGrid() {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [kpiData, setKpiData] = useState({
        teamMembers: null,
        activeLearners: null,
        avgHoursWeek: null,
        certificatesEarned: null,
    });

    useEffect(() => {
        let isMounted = true;
        const loadDashboardStats = async () => {
            setIsLoading(true);
            const authToken = token || localStorage.getItem("lms_token");
            try {
                const liveKpis = await fetchTeamKpiStats(authToken);
                if (isMounted && liveKpis) {
                    setKpiData({
                        teamMembers: liveKpis.team_members ?? 0,
                        activeLearners: liveKpis.active_learners ?? 0,
                        avgHoursWeek: liveKpis.avg_hours_week ?? "0.0h",
                        certificatesEarned: liveKpis.certificates_earned ?? 0,
                        weeklyHoursTotal: liveKpis.weekly_hours_total,
                        activeLearnersThisWeek: liveKpis.active_learners_this_week,
                        weekPeriod: liveKpis.week_period,
                    });
                    return;
                }

                // Fallback to individual API endpoints if liveKpis is empty
                const [members, certsData] = await Promise.allSettled([
                    fetchTeamMembers(authToken),
                    fetchTeamCertifications(authToken),
                ]);

                if (isMounted) {
                    const isMemFulfilled = members.status === "fulfilled" && Array.isArray(members.value);
                    const isCertsFulfilled = certsData.status === "fulfilled" && certsData.value;
                    const tCount = isMemFulfilled ? members.value.length : null;
                    const cTotal = isCertsFulfilled
                        ? (certsData.value.total_earned ?? certsData.value.certifications?.length ?? 0)
                        : null;

                    setKpiData({
                        teamMembers: tCount,
                        activeLearners: isMemFulfilled ? 0 : null,
                        avgHoursWeek: isMemFulfilled ? "0.0h" : null,
                        certificatesEarned: cTotal,
                    });
                }
            } catch (err) {
                console.warn("fetchTeamKpiStats failed, falling back to aggregate calls:", err);
                try {
                    const [members, certsData] = await Promise.allSettled([
                        fetchTeamMembers(authToken),
                        fetchTeamCertifications(authToken),
                    ]);

                    if (isMounted) {
                        const isMemFulfilled = members.status === "fulfilled" && Array.isArray(members.value);
                        const isCertsFulfilled = certsData.status === "fulfilled" && certsData.value;
                        const tCount = isMemFulfilled ? members.value.length : null;
                        const cTotal = isCertsFulfilled
                            ? (certsData.value.total_earned ?? certsData.value.certifications?.length ?? 0)
                            : null;

                        setKpiData({
                            teamMembers: tCount,
                            activeLearners: isMemFulfilled ? 0 : null,
                            avgHoursWeek: isMemFulfilled ? "0.0h" : null,
                            certificatesEarned: cTotal,
                        });
                    }
                } catch (fallbackErr) {
                    console.error("Failed to load dashboard stats for KPI grid:", fallbackErr);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadDashboardStats();
        return () => {
            isMounted = false;
        };
    }, [token]);

    const formatCount = (val) => {
        if (val === null || val === undefined) return null;
        const num = Number(val);
        if (!isNaN(num)) {
            return String(num).padStart(2, "0");
        }
        return String(val);
    };

    const stats = [
        {
            id: "team_members",
            icon: personSvg,
            alt: "Team Members",
            value: (isLoading || kpiData.teamMembers === null) ? null : formatCount(kpiData.teamMembers),
            label: "Team Members",
            title: "Direct reports in your team",
            skeletonWidth: 44,
        },
        {
            id: "active_learners",
            icon: bookSvg,
            alt: "Active Learners",
            value: (isLoading || kpiData.activeLearners === null) ? null : formatCount(kpiData.activeLearners),
            label: "Active Learners",
            title: "Team members with active courses in progress",
            skeletonWidth: 44,
        },
        {
            id: "avg_hours",
            icon: clockSvg,
            alt: "Avg. Hours / Week",
            value: (isLoading || kpiData.avgHoursWeek === null) ? null : String(kpiData.avgHoursWeek),
            label: "Avg. Hours / Week",
            title: kpiData.weeklyHoursTotal
                ? `This Week (${kpiData.weekPeriod || "Mon - Sun"}): ${kpiData.weeklyHoursTotal} total logged across ${kpiData.activeLearnersThisWeek || 1} active learner(s)`
                : "Average hours per active learner this week (Mon - Sun)",
            skeletonWidth: 54,
        },
        {
            id: "certificates_earned",
            icon: certiSvg,
            alt: "Certificates Earned",
            value: (isLoading || kpiData.certificatesEarned === null) ? null : formatCount(kpiData.certificatesEarned),
            label: "Certificates Earned",
            title: "Active professional certification earned by direct reports",
            skeletonWidth: 44,
        },
    ];

    return (
        <div className="rm-dashboard-stats-grid">
            {stats.map((stat) => (
                <div key={stat.id} className="rm-stat-card" title={stat.title || stat.label}>
                    <div className="rm-stat-card-inner">
                        <div className="rm-stat-icon-circle">
                            <img src={stat.icon} alt={stat.alt} className="rm-stat-svg-icon" />
                        </div>
                        <div className="rm-stat-text-col">
                            <span className="rm-stat-value">
                                {isLoading || stat.value === null ? (
                                    <span
                                        className="rm-stat-skeleton ld-skeleton-block"
                                        style={{
                                            width: stat.skeletonWidth || 44,
                                            height: 20,
                                            display: "inline-block",
                                            borderRadius: 4
                                        }}
                                        aria-label="Loading..."
                                    />
                                ) : (
                                    stat.value
                                )}
                            </span>
                            <span className="rm-stat-label">{stat.label}</span>
                        </div>
                    </div>
                    {/* Bottom accent bar: height 5px, border-radius 10px bottom, bg #C1D2FF */}
                    <div className="rm-stat-bottom-bar" />
                </div>
            ))}
        </div>
    );
}
