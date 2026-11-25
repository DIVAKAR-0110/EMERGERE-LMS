import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { fetchAllEmployees, fetchHREmployeeRecordsAnalytics } from "../../../services/teamService";
import contactIcon from "../../../assets/reportsanalytics/contact.svg";
import educationIcon from "../../../assets/reportsanalytics/education.svg";
import clockIcon from "../../../assets/reportsanalytics/clock.svg";
import certIcon from "../../../assets/reportsanalytics/certifications.svg";
import alertIcon from "../../../assets/hr/alerts1.svg";
import tickIcon from "../../../assets/reportsanalytics/tick.svg";

export default function EmployeeRecordsOverview({ totalEmployeesCount }) {
  const { token } = useAuth();
  const [overviewData, setOverviewData] = useState(null);
  const [liveEmployeeCount, setLiveEmployeeCount] = useState(totalEmployeesCount ?? null);

  useEffect(() => {
    let isMounted = true;
    const loadOverview = async () => {
      try {
        const [res, emps] = await Promise.allSettled([
          fetchHREmployeeRecordsAnalytics(token),
          totalEmployeesCount == null ? fetchAllEmployees(token) : Promise.resolve(null),
        ]);

        if (!isMounted) return;

        if (res.status === "fulfilled" && res.value?.overview) {
          setOverviewData(res.value.overview);
        }

        if (emps.status === "fulfilled" && Array.isArray(emps.value)) {
          setLiveEmployeeCount(emps.value.length);
        }
      } catch (err) {
        console.error("Failed to fetch employee records overview:", err);
      }
    };

    loadOverview();
    return () => {
      isMounted = false;
    };
  }, [token, totalEmployeesCount]);

  const empCount = liveEmployeeCount ?? overviewData?.total_employees ?? null;
  const activeLearners = overviewData?.active_learners ?? null;
  const avgLearningHours = overviewData?.avg_learning_hours ?? overviewData?.learning_hours ?? null;
  const certificatesEarned = overviewData?.certificates_earned ?? null;
  const pendingClaims = overviewData?.pending_claims ?? null;
  const approvedClaims = overviewData?.approved_claims ?? null;

  const stats = [
    {
      id: "total-employees",
      icon: contactIcon,
      value: empCount !== null ? String(empCount) : null,
      label: "Total Employees",
      bgClass: "hr-stat-tint-blue",
      iconClass: "hr-stat-icon-blue",
    },
    {
      id: "active-learners",
      icon: educationIcon,
      value: activeLearners !== null ? String(activeLearners) : null,
      label: "Active Learners",
      bgClass: "hr-stat-tint-green",
      iconClass: "hr-stat-icon-green",
    },
    {
      id: "learning-hours",
      icon: clockIcon,
      value: avgLearningHours !== null ? String(avgLearningHours) : null,
      label: "Learning Avg.Hours",
      tooltip: overviewData?.total_learning_hours
        ? `${avgLearningHours} average per month across ${overviewData?.learning_months_count || 1} month${(overviewData?.learning_months_count || 1) === 1 ? "" : "s"} of learning logs\n(${overviewData?.total_learning_hours} total logged: ${overviewData.video_learning_hours || "0h"} Video • ${overviewData.practice_learning_hours || "0h"} Practical)`
        : "Average monthly learning hours calculated across organization",
      bgClass: "hr-stat-tint-purple",
      iconClass: "hr-stat-icon-purple",
    },
    {
      id: "certificates-earned",
      icon: certIcon,
      value: certificatesEarned !== null ? String(certificatesEarned) : null,
      label: "Certifications Earned",
      bgClass: "hr-stat-tint-salmon",
      iconClass: "hr-stat-icon-salmon",
    },
    {
      id: "pending-claims",
      icon: alertIcon,
      value: pendingClaims !== null ? String(pendingClaims) : null,
      label: "Pending Claim",
      bgClass: "hr-stat-tint-yellow",
      iconClass: "hr-stat-icon-yellow",
    },
    {
      id: "approved-claims",
      icon: tickIcon,
      value: approvedClaims !== null ? String(approvedClaims) : null,
      label: "Approved Claims",
      bgClass: "hr-stat-tint-cyan",
      iconClass: "hr-stat-icon-cyan",
    },
  ];

  return (
    <div className="hr-records-card hr-records-overview-card">
      <h3 className="hr-card-heading">Employee Records Overview</h3>
      <div className="hr-overview-grid">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className={`hr-overview-mini-card ${stat.bgClass}`}
            title={stat.tooltip || stat.label}
          >
            <div className={`hr-overview-icon-wrap ${stat.iconClass}`}>
              <img src={stat.icon} alt={stat.label} className="hr-overview-icon" />
            </div>
            <div className="hr-overview-num">
              {stat.value !== null && stat.value !== undefined ? (
                stat.value
              ) : (
                <span className="ld-skeleton-block" style={{ width: 34, height: 20, display: "inline-block" }} />
              )}
            </div>
            <div className="hr-overview-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
