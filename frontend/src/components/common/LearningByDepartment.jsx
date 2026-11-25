import React from "react";
import openBookIcon from "../../assets/course_library/open_book_icon.svg";

/**
 * Common Reusable Component: Learning by Department
 * Displays department-wise learning progress bars with dynamic percentage and spend amounts.
 * Used across CEO Dashboard, HR Dashboard, and L&D Dashboard.
 *
 * @param {Array} departments - Array of department objects: [{ id, name, pct, amount, color }]
 * @param {boolean} showAmount - Whether to display spend amount in parentheses e.g. "48% (₹42,000)" vs "48%"
 * @param {string} variant - Theme/style variant: 'ceo' | 'hr' | 'ld' | 'common'
 * @param {string} title - Optional title override (default: "Learning by Department")
 */
const PALETTE_COLORS = ["#2563EB", "#10B981", "#8B5CF6", "#F59E0B", "#06B6D4"];

export default function LearningByDepartment({
  departments,
  showAmount = false,
  variant = "ceo",
  title = "Learning by Department",
  cardClassName = "",
}) {
  const isLD = variant === "ld";
  const isHR = variant === "hr";

  // Dynamic CSS classes based on variant
  const cardClass = cardClassName || (
    isLD
      ? "ld-section-card"
      : isHR
        ? "hr-dashboard-card hr-learning-dept-card"
        : "ceo-dashboard-card ceo-learning-dept-card"
  );

  const titleClass = isLD ? "ld-section-title" : isHR ? "hr-card-title" : "ceo-card-title";
  const listClass = isLD ? "ld-dept-list" : isHR ? "hr-learning-dept-list" : "ceo-learning-dept-list";
  const rowClass = isLD ? "ld-dept-row" : isHR ? "hr-learning-dept-row" : "ceo-learning-dept-row";
  const nameClass = isLD ? "ld-dept-name" : isHR ? "hr-learning-dept-name" : "ceo-learning-dept-name";
  const trackClass = isLD ? "ld-dept-progress-track" : isHR ? "hr-learning-bar-track" : "ceo-learning-bar-track";
  const fillClass = isLD ? "ld-dept-progress-fill" : isHR ? "hr-learning-bar-fill" : "ceo-learning-bar-fill";
  const statClass = isLD ? "ld-dept-percent" : isHR ? "hr-learning-dept-stat" : "ceo-learning-dept-stat";

  const count = Array.isArray(departments) ? departments.length : 0;
  const formattedCount = String(count).padStart(2, "0");

  // Loading skeleton state
  if (!departments) {
    return (
      <div className={cardClass}>
        {isLD ? (
          <div className="ld-section-header">
            <h3 className={titleClass}>{title}</h3>
          </div>
        ) : (
          <h3 className={titleClass}>{title}</h3>
        )}
        <div className={listClass}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`${rowClass} ceo-learning-dept-skeleton`}>
              <span className={`${nameClass} ceo-skeleton-block`} style={{ width: 110, height: 14 }} />
              <div className={trackClass}>
                <div className="ceo-skeleton-block" style={{ width: "100%", height: "100%", borderRadius: 6 }} />
              </div>
              <span className={`${statClass} ceo-skeleton-block`} style={{ width: 60, height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state fallback
  if (!Array.isArray(departments) || departments.length === 0) {
    return (
      <div className={cardClass}>
        {isLD ? (
          <div className="ld-section-header">
            <h3 className={titleClass}>
              <span>{title}</span>
              <span className="ld-title-count">(00)</span>
            </h3>
          </div>
        ) : (
          <h3 className={titleClass}>
            <span>{title}</span>
            <span className="ld-title-count">(00)</span>
          </h3>
        )}
        <div
          className="ld-empty-state-card"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "140px",
            textAlign: "center",
            color: "#7f7f7f",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          <img
            src={openBookIcon}
            alt="No department learning data"
            className="ld-empty-state-icon"
            style={{ width: "56px", height: "42px", objectFit: "contain", marginBottom: "8px", opacity: 0.8 }}
          />
          <span>No department learning data available.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      {isLD ? (
        <div className="ld-section-header">
          <h3 className={titleClass}>
            <span>{title}</span>
            <span className="ld-title-count">({formattedCount})</span>
          </h3>
        </div>
      ) : (
        <h3 className={titleClass}>
          <span>{title}</span>
          <span className="ld-title-count">({formattedCount})</span>
        </h3>
      )}

      <div className={listClass}>
        {departments.map((dept, index) => {
          const deptName = dept.name || dept.label || "Department";
          const deptPct = dept.pct !== undefined ? dept.pct : (dept.value || 0);
          const deptColor = PALETTE_COLORS[index % PALETTE_COLORS.length];
          const deptAmount = dept.amount || "";

          const statLabel = showAmount && deptAmount
            ? `${deptPct}% (${deptAmount})`
            : `${deptPct}%`;

          return (
            <div key={dept.id || deptName || index} className={rowClass}>
              <span className={nameClass} title={deptName}>
                {deptName}
              </span>

              <div className={trackClass}>
                <div
                  className={fillClass}
                  style={{
                    width: `${deptPct}%`,
                    backgroundColor: deptColor,
                  }}
                />
              </div>

              <span className={statClass}>
                {statLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
