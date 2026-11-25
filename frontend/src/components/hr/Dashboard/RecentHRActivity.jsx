import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { fetchHRActivityFeed } from "../../../services/teamService";
import employeeIcon from "../../../assets/hr/Dashboard/employee.svg";
import smallTickIcon from "../../../assets/hr/Dashboard/small-tick.svg";
import paymentIcon from "../../../assets/hr/Dashboard/payment.svg";
import reportIcon from "../../../assets/hr/Dashboard/report.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

const ICON_MAP = {
  employee: employeeIcon,
  cert: smallTickIcon,
  payment: paymentIcon,
  report: reportIcon,
};

export default function RecentHRActivity({ activities: propActivities }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState(propActivities || []);
  const [isLoading, setIsLoading] = useState(!propActivities);

  useEffect(() => {
    if (propActivities) {
      setActivities(propActivities);
      return;
    }

    let isMounted = true;
    const loadActivities = async () => {
      try {
        setIsLoading(true);
        const liveItems = await fetchHRActivityFeed(token);
        if (isMounted && Array.isArray(liveItems)) {
          const mapped = liveItems.map((item) => ({
            id: item.id,
            title: item.title,
            time: item.time,
            tooltip: item.tooltip || item.title,
            icon: ICON_MAP[item.icon_type] || smallTickIcon,
            bgClass: item.bg_class || "hr-activity-icon-green",
            alt: item.alt || "Activity",
          }));
          setActivities(mapped.slice(0, 4));
        }
      } catch (err) {
        console.warn("[RecentHRActivity] Failed to fetch live activity feed:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadActivities();

    window.addEventListener("focus", loadActivities);
    const intervalId = setInterval(loadActivities, 10000);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", loadActivities);
      clearInterval(intervalId);
    };
  }, [token, propActivities]);

  return (
    <div className="hr-dashboard-card hr-activity-card">
      <div className="hr-card-header-row">
        <h3 className="hr-card-title">Recent HR Activity</h3>
        {/* <button
          type="button"
          className="hr-card-view-all"
          onClick={() => navigate("/hr/employee-records")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          aria-label="View all activities"
        >
          View All
        </button> */}
      </div>
      <div className="hr-activity-list">
        {isLoading && activities.length === 0 ? (
          [1, 2, 3, 4].map((n) => (
            <div key={n} className="hr-activity-item" style={{ alignItems: "center" }}>
              <div className="hr-activity-left" style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                <span className="ld-skeleton-circle" style={{ width: 34, height: 34, flexShrink: 0 }} />
                <span className="ld-skeleton-block" style={{ width: "65%", height: 16 }} />
              </div>
              <span className="ld-skeleton-block" style={{ width: 45, height: 14 }} />
            </div>
          ))
        ) : activities.length === 0 ? (
          <div className="hr-empty-activity-state">
            <img src={openBookIcon} alt="" className="hr-empty-activity-icon" />
            <span>No recent HR activity recorded</span>
          </div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="hr-activity-item">
              <div className="hr-activity-left">
                <div className={`hr-activity-icon-wrapper ${act.bgClass}`}>
                  <img src={act.icon} alt={act.alt} className="hr-activity-icon" />
                </div>
                <span className="hr-activity-title" title={act.title}>
                  {act.title}
                </span>
              </div>
              <span className="hr-activity-time">{act.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
