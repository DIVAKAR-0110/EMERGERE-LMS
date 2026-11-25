import React from "react";
import totalEmployeesIcon from "../../../assets/hr/Dashboard/totalemployees.svg";
import activeLearnersIcon from "../../../assets/hr/Dashboard/certified-employees.svg";
import metricBg from "../../../assets/hr/Dashboard/background.svg";

const CARD_CONFIGS = [
  {
    id: "total-employees",
    title: "Total Employees",
    type: "total-employees",
    getValue: (stats) => String(stats?.total_employees ?? 0),
  },
  {
    id: "active-learners",
    title: "Active Learners",
    type: "active-learners",
    getValue: (stats) => String(stats?.active_learners ?? 0),
  },
  {
    id: "completion-rate",
    title: "Completion Rate",
    type: "completion-rate",
    getValue: (stats) => {
      if (!stats) return "0%";
      const rate = stats.completion_rate_pct ?? 0;
      return String(rate).endsWith("%") ? String(rate) : `${rate}%`;
    },
  },
  {
    id: "total-hours",
    title: "Total Learning Hours",
    type: "total-hours",
    getValue: (stats) => stats?.total_learning_hours_formatted || `${stats?.total_learning_hours ?? 0}h`,
  },
];

export default function CEOMetricCards({ kpiStats, isLoading: externalLoading }) {
  const isLoading = externalLoading !== undefined ? externalLoading : !kpiStats;

  return (
    <div className="ceo-metric-cards-grid">
      {CARD_CONFIGS.map((item) => {
        const value = item.getValue(kpiStats);
        return (
          <div
            key={item.id}
            className="ceo-metric-card"
            style={{ borderBottom: "3.5px solid #C1D2FF" }}
          >
            <div
              className="ceo-metric-icon-wrapper"
              style={{
                backgroundImage: `url(${metricBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {item.type === "total-employees" && (
                <img
                  src={totalEmployeesIcon}
                  alt="Total Employees"
                  className="ceo-metric-icon"
                  style={{ width: "20px", height: "20px" }}
                />
              )}
              {item.type === "active-learners" && (
                <img
                  src={activeLearnersIcon}
                  alt="Active Learners"
                  className="ceo-metric-icon"
                  style={{ width: "20px", height: "20px" }}
                />
              )}
              {item.type === "completion-rate" && (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ceo-metric-icon"
                >
                  <circle cx="12" cy="12" r="9.5" />
                  <polyline points="8 12 11 15 16 9" />
                </svg>
              )}
              {item.type === "total-hours" && (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ceo-metric-icon"
                >
                  <circle cx="12" cy="12" r="9.5" />
                  <polyline points="12 7 12 12 15 13.5" />
                </svg>
              )}
            </div>
            <div className="ceo-metric-info">
              <div className="ceo-metric-value">
                {isLoading ? (
                  <span
                    className="ceo-skeleton-block"
                    style={{ width: "42px", height: "22px", display: "inline-block" }}
                  />
                ) : (
                  value
                )}
              </div>
              <div className="ceo-metric-title">{item.title}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

