import React, { useState, useEffect, useRef } from "react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/employee/Dashboard/StatCard";
import OverallProgress from "../../components/employee/Dashboard/OverallProgress";
import RecentLearningLog from "../../components/employee/Dashboard/RecentLearningLog";
import TeamLeaderboard from "../../components/employee/Dashboard/TeamLeaderboard";

import pageSvg from "../../assets/Dashboard/page.svg";
import clockSvg from "../../assets/Dashboard/clock.svg";
import badgeSvg from "../../assets/Dashboard/badge.svg";
import cupSvg from "../../assets/Dashboard/cup.svg";

import { fetchLeaderboardData } from "../../services/leaderboardService";
import { fetchOverallProgressSummary } from "../../services/courseEnrollmentService";
import { formatDaysRemainingText } from "../../utils/dateUtils";
import { useAuth } from "../../context/AuthContext";
import "../../styles/employee/Dashboard.css";

export default function Dashboard() {
    const { user, token } = useAuth();
    const [leaderboardList, setLeaderboardList] = useState(null);
    const [userRank, setUserRank] = useState(null);
    const [learningHours, setLearningHours] = useState(null);
    const [learningHoursTooltip, setLearningHoursTooltip] = useState(null);
    const [completedCoursesCount, setCompletedCoursesCount] = useState(null);
    const [totalCertificationsCount, setTotalCertificationsCount] = useState(null);
    const [mandatoryCourse, setMandatoryCourse] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const scrollContainerRef = useRef(null);

    const handleProgressLoaded = (data) => {
        if (!data) return;
        if (data.completed_courses_count !== undefined && data.completed_courses_count !== null) {
            setCompletedCoursesCount(data.completed_courses_count);
        }
        if (data.total_certifications_count !== undefined && data.total_certifications_count !== null) {
            setTotalCertificationsCount(data.total_certifications_count);
        }
    };

    const activeEmpId = user?.employee_id || user?.id || user?.emp_id || localStorage.getItem("lms_active_employee_id") || "EMP019";

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;
        const loadDashboardStats = async () => {
            setIsLoading(true);
            try {
                const [lbResult, progResult] = await Promise.allSettled([
                    fetchLeaderboardData("All Time", token, activeEmpId, {
                        signal: controller.signal,
                    }),
                    fetchOverallProgressSummary(activeEmpId, token),
                ]);

                if (!isMounted || controller.signal.aborted) return;

                if (lbResult.status === "fulfilled" && lbResult.value) {
                    const res = lbResult.value;
                    if (res.success && Array.isArray(res.leaderboard)) {
                        setLeaderboardList(res.leaderboard);
                    }
                    if (res.userStats) {
                        if (res.userStats.rank && res.userStats.rank !== "-") {
                            setUserRank(`#${res.userStats.rank}`);
                        } else {
                            setUserRank(null);
                        }
                        if (res.userStats.weeklyLearningHours != null) {
                            setLearningHours(res.userStats.weeklyLearningHours);
                        } else if (res.userStats.totalLearningHours != null) {
                            setLearningHours(res.userStats.totalLearningHours);
                        }
                    }
                }

                if (progResult.status === "fulfilled" && progResult.value) {
                    const progressSummary = progResult.value;
                    if (progressSummary.weekly_learning_hours) {
                        setLearningHours(progressSummary.weekly_learning_hours);
                        setLearningHoursTooltip(
                            `This Week (${progressSummary.week_period || "Mon - Sun"}): ${progressSummary.weekly_learning_hours} logged (${progressSummary.all_time_learning_hours || "0h"} all-time)`
                        );
                    }
                    if (progressSummary.completed_courses_count !== undefined && progressSummary.completed_courses_count !== null) {
                        setCompletedCoursesCount(progressSummary.completed_courses_count);
                    }
                    if (progressSummary.total_certifications_count !== undefined && progressSummary.total_certifications_count !== null) {
                        setTotalCertificationsCount(progressSummary.total_certifications_count);
                    }
                    if (progressSummary.mandatory_course) {
                        setMandatoryCourse(progressSummary.mandatory_course);
                    }
                }
            } catch (err) {
                if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || controller.signal.aborted) {
                    return;
                }
                console.warn("[Employee Dashboard] Stats fetch notice:", err);
            } finally {
                if (isMounted && !controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadDashboardStats();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [activeEmpId, token]);

    return (
        <div className="emp-employee-dashboard-page">
            {/* FIXED TOP HEADER (Title + Subtitle + 4 Stat Cards) */}
            <div className="emp-dashboard-fixed-header">
                <PageHeader
                    title="Dashboard"
                    subtitle="Track your active courses, daily learning progress, and upcoming milestones."
                />

                {/* Top Row: 4 Stat Cards */}
                <div className="emp-dashboard-stats-grid">
                    <StatCard
                        icon={<img src={pageSvg} alt="Completed Courses" className="emp-stat-svg-icon" />}
                        value={completedCoursesCount !== null && completedCoursesCount !== undefined ? completedCoursesCount : null}
                        label="Completed Courses"
                    />
                    <StatCard
                        icon={<img src={clockSvg} alt="Learning Hours/week" className="emp-stat-svg-icon" />}
                        value={learningHours || null}
                        label="Learning Hours/week"
                    />
                    <StatCard
                        icon={<img src={badgeSvg} alt="Certifications" className="emp-stat-svg-icon" />}
                        value={totalCertificationsCount !== null && totalCertificationsCount !== undefined ? totalCertificationsCount : null}
                        label="Certifications"
                    />
                    <StatCard
                        icon={<img src={cupSvg} alt="Leaderboard Rank" className="emp-stat-svg-icon" />}
                        value={userRank && userRank !== "-" ? userRank : null}
                        label="Leaderboard Rank"
                    />
                </div>
            </div>

            {/* SCROLLABLE MAIN CONTENT */}
            <div className="emp-dashboard-scrollable-content" ref={scrollContainerRef}>
                {/* Mandatory Course Due Date Alert Banner (Safari cross-browser safe) */}
                {/* {mandatoryCourse && (
                    <div className="emp-mandatory-course-banner" role="alert" id="emp-mandatory-course-alert">
                        <div className="emp-mandatory-banner-content">
                            <span className="emp-mandatory-tag">Mandatory Training</span>
                            <span className="emp-mandatory-title">{mandatoryCourse.course_name}</span>
                            <span className="emp-mandatory-due">
                                Target: {mandatoryCourse.target_completion_date}
                            </span>
                        </div> */}
                {/* <div className="emp-mandatory-countdown">
                            <span className="emp-mandatory-days-badge">
                                {formatDaysRemainingText(mandatoryCourse.target_completion_date, mandatoryCourse.days_remaining)}
                            </span>
                        </div>
                    </div>
                )} */}

                {/* Main Content Grid: Left (Team Leaderboard) + Right (Overall Progress & Recent Learning Log) */}
                <div className="emp-dashboard-main-grid">
                    <div className="emp-dashboard-left-col">
                        <TeamLeaderboard data={leaderboardList} isLoading={isLoading && leaderboardList === null} />
                    </div>
                    <div className="emp-dashboard-right-col">
                        <OverallProgress onProgressLoaded={handleProgressLoaded} />
                        <RecentLearningLog />
                    </div>
                </div>
            </div>
        </div>
    );
}
