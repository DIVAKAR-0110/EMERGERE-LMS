import React from "react";
import backgroundCircleSvg from "../../assets/hr/backgroundcircle.svg";

/**
 * Common Reusable Component: Employee Distribution
 * Displays SVG Donut Chart with total employee count and department share legend.
 * Used across CEO Dashboard and HR Dashboard.
 *
 * @param {Array} distribution - Array of objects: [{ id, name, pct, count, color }]
 * @param {number} totalCount - Total headcount across enterprise (e.g. 21)
 * @param {string} totalLabel - Custom center text override (optional)
 * @param {string} variant - 'ceo' | 'hr' | 'common'
 */
export default function EmployeeDistribution({
  distribution,
  totalCount,
  totalLabel,
  variant = "ceo",
  cardClassName = "",
}) {
  const isHR = variant === "hr";
  const isLoading = !distribution;

  const cardClass = cardClassName || (
    isHR ? "hr-dashboard-card hr-distribution-card" : "ceo-dashboard-card ceo-distribution-card"
  );
  const titleClass = isHR ? "hr-card-title" : "ceo-card-title";
  const contentClass = isHR ? "hr-distribution-content" : "ceo-distribution-content";
  const donutContainerClass = isHR ? "hr-donut-container" : "ceo-donut-container";
  const donutWrapperClass = isHR ? "hr-donut-wrapper" : "ceo-donut-wrapper";
  const donutSvgClass = isHR ? "hr-donut-svg" : "ceo-donut-svg";
  const centerLabelClass = isHR ? "hr-donut-total-text" : "ceo-donut-total-text";
  const legendClass = isHR ? "hr-distribution-legend" : "ceo-distribution-legend";
  const legendRowClass = isHR ? "hr-legend-row" : "ceo-legend-row";
  const legendLeftClass = isHR ? "hr-legend-left" : "ceo-legend-left";
  const dotClass = isHR ? "hr-legend-dot" : "ceo-legend-dot";
  const deptNameClass = isHR ? "hr-legend-name" : "ceo-legend-name";
  const deptPctClass = isHR ? "hr-legend-pct" : "ceo-legend-pct";

  const displayTotalLabel =
    totalLabel ||
    (totalCount !== undefined && totalCount !== null
      ? `Total ${totalCount} Employees`
      : "Total Employees");

  const size = 110;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const countSum = (distribution || []).reduce(
    (sum, item) => sum + (typeof item.count === "number" ? item.count : 0),
    0
  );
  const totalEmployees = totalCount || countSum || 1;

  let runningFraction = 0;
  const segments = (distribution || []).map((item) => {
    // Exact fraction guarantees segments add up to 100% of circumference with zero gap
    let fraction = 0;
    if (typeof item.count === "number" && totalEmployees > 0) {
      fraction = item.count / totalEmployees;
    } else if (typeof item.raw_pct === "number") {
      fraction = item.raw_pct / 100;
    } else if (typeof item.pct === "number") {
      fraction = item.pct / 100;
    }

    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -(runningFraction * circumference);
    runningFraction += fraction;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className={cardClass}>
      <h3 className={titleClass}>Employee Distribution</h3>

      {isLoading ? (
        <div className={contentClass}>
          {/* Skeleton Donut */}
          <div
            className={donutContainerClass}
            style={{
              backgroundImage: `url(${backgroundCircleSvg})`,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className={donutWrapperClass}>
              <span
                className="ceo-skeleton-block"
                style={{
                  width: "82px",
                  height: "82px",
                  borderRadius: "50%",
                }}
              />
            </div>
            <div
              className="ceo-skeleton-block"
              style={{
                width: "90px",
                height: "14px",
                marginTop: "6px",
              }}
            />
          </div>

          {/* Skeleton Legend */}
          <div className={legendClass}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={legendRowClass}>
                <div className={legendLeftClass}>
                  <span className={`${dotClass} ceo-skeleton-block`} />
                  <span className={`${deptNameClass} ceo-skeleton-block`} style={{ width: 90, height: 14 }} />
                </div>
                <span className={`${deptPctClass} ceo-skeleton-block`} style={{ width: 28, height: 14 }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={contentClass}>
          {/* Donut Chart Container */}
          <div
            className={donutContainerClass}
            style={{
              backgroundImage: `url(${backgroundCircleSvg})`,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className={donutWrapperClass}>
              <svg className={donutSvgClass} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke="#F3F4F8"
                  strokeWidth={strokeWidth}
                />
                {segments.map((item, idx) => (
                  <circle
                    key={item.id || item.name || idx}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={item.color || "#2667F9"}
                    strokeWidth={strokeWidth}
                    strokeDasharray={item.strokeDasharray}
                    strokeDashoffset={item.strokeDashoffset}
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                ))}
              </svg>
            </div>
            <span className={centerLabelClass}>
              {displayTotalLabel}
            </span>
          </div>

          {/* Department Legend */}
          <div className={legendClass}>
            {(distribution || []).map((item, idx) => (
              <div
                key={item.id || item.name || idx}
                className={legendRowClass}
                title={
                  item.count !== undefined
                    ? `${item.name}: ${item.count} employees (${item.pct}%)`
                    : `${item.name}: ${item.pct}%`
                }
              >
                <div className={legendLeftClass}>
                  <span
                    className={dotClass}
                    style={{ backgroundColor: item.color || "#2667F9" }}
                  />
                  <span className={deptNameClass} title={item.name}>
                    {item.name}
                  </span>
                </div>
                <span className={deptPctClass}>{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
