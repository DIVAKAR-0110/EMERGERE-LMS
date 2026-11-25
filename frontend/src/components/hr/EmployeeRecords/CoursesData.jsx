import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { fetchHREmployeeRecordsAnalytics } from "../../../services/teamService";

const INITIAL_COURSES_DATA = [
  { id: 1, label: "Assigned Courses", value: 0, color: "#2667F9", pct: 0 },
  { id: 2, label: "Completed Courses", value: 0, color: "#31C27E", pct: 0 },
  { id: 3, label: "Active Courses", value: 0, color: "#9E5DF9", pct: 0 },
  { id: 4, label: "Overdue Courses", value: 0, color: "#FE7356", pct: 0 },
];

export default function CoursesData({ data }) {
  const { token } = useAuth();
  const [coursesData, setCoursesData] = useState(data || null);
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    if (data) {
      setCoursesData(data);
      return;
    }
    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await fetchHREmployeeRecordsAnalytics(token);
        if (isMounted && res) {
          if (res.courses_data) {
            setCoursesData(res.courses_data);
          }
          setAnalyticsData(res);
        }
      } catch (err) {
        console.error("Failed to load live courses data metrics:", err);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [data, token]);

  const displayData = coursesData || INITIAL_COURSES_DATA;
  const totalCourses = analyticsData?.total_courses || 0;

  const getPct = (item) => {
    if (typeof item.pct === "number") return item.pct;
    if (totalCourses > 0) {
      return Math.min(100, Math.round(((Number(item.value) || 0) / totalCourses) * 100));
    }
    return 0;
  };

  const getTooltip = (label) => {
    if (!analyticsData) return "";
    const total = analyticsData.total_courses || 0;
    const assignedItem = displayData.find((d) => d.label === "Assigned Courses");
    const completedItem = displayData.find((d) => d.label === "Completed Courses");
    const activeItem = displayData.find((d) => d.label === "Active Courses");
    const overdueItem = displayData.find((d) => d.label === "Overdue Courses");

    if (label === "Assigned Courses") {
      const count = assignedItem ? Number(assignedItem.value) || 0 : 0;
      const pct = getPct(assignedItem || {});
      const baseText = `${count} of ${total} company courses assigned / pending completion (${pct}%)`;
      if (analyticsData.assigned_breakdown && analyticsData.assigned_breakdown.length > 0) {
        return `${baseText}\n` + analyticsData.assigned_breakdown.map((b) => `${b.name}: ${b.count} assigned`).join("\n");
      }
      return baseText;
    }
    if (label === "Completed Courses") {
      const count = completedItem ? Number(completedItem.value) || 0 : 0;
      const pct = getPct(completedItem || {});
      const baseText = `${count} of ${total} total courses completed across company (${pct}%)`;
      if (analyticsData.completed_breakdown && analyticsData.completed_breakdown.length > 0) {
        return `${baseText}\n` + analyticsData.completed_breakdown.map((b) => `${b.name}: ${b.count} completed`).join("\n");
      }
      return baseText;
    }
    if (label === "Active Courses") {
      const count = activeItem ? Number(activeItem.value) || 0 : 0;
      const pct = getPct(activeItem || {});
      const baseText = `${count} of ${total} courses actively in progress across company (${pct}%)`;
      if (analyticsData.active_breakdown && analyticsData.active_breakdown.length > 0) {
        return `${baseText}\n` + analyticsData.active_breakdown.map((b) => `${b.name}: ${b.count} in progress`).join("\n");
      }
      return baseText;
    }
    if (label === "Overdue Courses") {
      const count = overdueItem ? Number(overdueItem.value) || 0 : 0;
      const pct = getPct(overdueItem || {});
      const baseText = `${count} of ${total} courses overdue across company (${pct}%)`;
      if (analyticsData.overdue_details && analyticsData.overdue_details.length > 0) {
        return `${baseText}\n` + analyticsData.overdue_details.map((d) => `• ${d.name}: ${d.course_name} (${d.days_overdue} days overdue • ${d.progress_percentage}% completed)`).join("\n");
      }
      if (analyticsData.overdue_breakdown && analyticsData.overdue_breakdown.length > 0) {
        return `${baseText}\n` + analyticsData.overdue_breakdown.map((b) => `${b.name}: ${b.count} overdue`).join("\n");
      }
      return baseText;
    }
    return "";
  };

  return (
    <div className="hr-records-card hr-courses-data-card">
      <h3 className="hr-card-heading">Courses Data</h3>
      <div className="hr-courses-data-list">
        {coursesData === null ? (
          [1, 2, 3, 4].map((id) => (
            <div key={id} className="hr-courses-data-item">
              <div className="hr-courses-data-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="ld-skeleton-block" style={{ width: 100, height: 14 }} />
                <span className="ld-skeleton-block" style={{ width: 30, height: 14 }} />
              </div>
              <div className="hr-courses-bar-track">
                <div
                  className="ld-skeleton-block"
                  style={{
                    width: `${id * 20}%`,
                    height: "100%",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          displayData.map((item) => (
            <div
              key={item.id}
              className="hr-courses-data-item"
              title={getTooltip(item.label)}
            >
              <div className="hr-courses-data-header">
                <span className="hr-courses-data-label">{item.label}</span>
                <span className="hr-courses-data-value">{item.value}</span>
              </div>
              <div className="hr-courses-bar-track">
                <div
                  className="hr-courses-bar-fill"
                  style={{
                    width: `${getPct(item)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
