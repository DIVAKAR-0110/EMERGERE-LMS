import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { fetchHREmployeeRecordsAnalytics } from "../../../services/teamService";

const getInitialMonthlyTrends = () => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const initial = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (currentMonth - i + 12) % 12;
    initial.push({ month: monthNames[idx], hours: 0, isCurrent: i === 0 });
  }
  return initial;
};

export default function MonthlyLearningTrends({ data }) {
  const { token } = useAuth();
  const [trendsData, setTrendsData] = useState(data || null);

  useEffect(() => {
    if (data) {
      setTrendsData(data);
      return;
    }
    let isMounted = true;
    const loadTrends = async () => {
      try {
        const res = await fetchHREmployeeRecordsAnalytics(token);
        if (isMounted && res?.monthly_trends && res.monthly_trends.length > 0) {
          setTrendsData(res.monthly_trends);
        }
      } catch (err) {
        console.error("Failed to load monthly learning trends:", err);
      }
    };
    loadTrends();
    return () => {
      isMounted = false;
    };
  }, [data, token]);

  const displayData = trendsData || getInitialMonthlyTrends();

  // Dynamic Y-axis scale calculation:
  // - Adapts to actual observed learning hours so bars fill ~75%–85% of plot height
  // - Leaves ideal headroom for the floating value label (e.g., '49h')
  // - Automatically scales up with clean, round intervals as learning hours increase
  const peakHours = Math.max(
    ...displayData.map((d) => (typeof d.hours === "number" ? d.hours : parseInt(d.hours || 0, 10))),
    0
  );

  const STEP_CANDIDATES = [
    5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 125, 150, 200, 250, 300, 400, 500, 1000, 1500, 2000, 2500, 3000
  ];
  const targetMax = peakHours > 0 ? peakHours * 1.18 : 60;
  const step = STEP_CANDIDATES.find((s) => s * 6 >= targetMax) || Math.ceil(targetMax / 6 / 10) * 10;

  const maxVal = step * 6;
  const yTicks = [
    maxVal,
    maxVal - step,
    maxVal - step * 2,
    maxVal - step * 3,
    maxVal - step * 4,
    maxVal - step * 5,
    0,
  ];

  return (
    <div className="hr-records-card hr-trends-card">
      <h3 className="hr-card-heading">Monthly Learning Hours Trends</h3>

      <div className="hr-chart-container">
        {/* Top: Y-Axis + Plot Area */}
        <div className="hr-chart-plot-wrapper">
          {/* Y-Axis labels */}
          <div className="hr-chart-y-axis">
            {yTicks.map((tick) => (
              <div key={tick} className="hr-y-tick-wrap">
                <span className="hr-y-tick-label">{tick}</span>
              </div>
            ))}
          </div>

          {/* Chart Plot Area with Grid Lines and Bars */}
          <div className="hr-chart-plot-area">
            <div className="hr-chart-grid-lines">
              {yTicks.map((tick) => (
                <div
                  key={tick}
                  className={`hr-grid-line ${tick === 0 ? "hr-grid-baseline" : ""}`}
                />
              ))}
            </div>

            {/* Bars */}
            <div className="hr-chart-bars-row">
              {trendsData === null ? (
                [40, 65, 30, 80, 50, 70].map((h, idx) => (
                  <div key={idx} className="hr-bar-column">
                    <div
                      className="hr-bar-track-outer"
                      style={{ height: `${h}%` }}
                    >
                      <div className="ld-skeleton-block" style={{ width: "100%", height: "100%", borderRadius: "4px 4px 0 0" }} />
                    </div>
                  </div>
                ))
              ) : (
                displayData.map((item) => {
                  const heightPercent = Math.min(100, Math.max(0, (item.hours / maxVal) * 100));
                  return (
                    <div key={item.month} className="hr-bar-column">
                      <div
                        className="hr-bar-track-outer"
                        style={{ height: `${heightPercent}%` }}
                      >
                        <span className="hr-bar-val-label">{item.hours}h</span>
                        <div className="hr-bar-blue-fill" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom: X-Axis Month Labels */}
        <div className="hr-chart-x-axis-wrapper">
          <div className="hr-chart-y-axis-spacer" />
          <div className="hr-chart-x-axis">
            {displayData.map((item, idx) => (
              <div key={item.month || idx} className="hr-x-axis-col">
                {trendsData === null ? (
                  <span className="ld-skeleton-block" style={{ width: 24, height: 12, display: "inline-block" }} />
                ) : (
                  <span className={`hr-bar-month-label ${Boolean(item.isCurrent !== undefined ? item.isCurrent : idx === displayData.length - 1) ? "is-current" : ""}`}>{item.month}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
