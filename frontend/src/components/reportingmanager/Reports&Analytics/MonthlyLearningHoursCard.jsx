import React, { useState, useEffect } from "react";
import { fetchTeamMonthlyLearningTrends } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

const buildRollingSixMonths = () => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            month: d.toLocaleString("en-US", { month: "short" }),
            fullName: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
            hours: 0,
            videoHours: 0,
            practiceHours: 0,
            activeLearners: 0,
            isCurrent: i === 0,
        });
    }
    return months;
};

export default function MonthlyLearningHoursCard() {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [monthlyData, setMonthlyData] = useState(buildRollingSixMonths);
    const [maxScale, setMaxScale] = useState(30);
    const [hoveredIdx, setHoveredIdx] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const loadTrends = async () => {
            setIsLoading(true);
            try {
                const data = await fetchTeamMonthlyLearningTrends(token);
                if (isMounted && data && Array.isArray(data.months) && data.months.length > 0) {
                    setMonthlyData(data.months);
                    if (data.max_scale) setMaxScale(data.max_scale);
                }
            } catch (err) {
                console.warn("Failed to fetch live team monthly learning trends:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadTrends();
        return () => {
            isMounted = false;
        };
    }, [token]);

    // 7 Clean Y-Axis Scale Ticks (e.g. 30, 25, 20, 15, 10, 5, 0)
    const yTicks = [
        maxScale,
        Math.round((maxScale * 5) / 6),
        Math.round((maxScale * 4) / 6),
        Math.round((maxScale * 3) / 6),
        Math.round((maxScale * 2) / 6),
        Math.round((maxScale * 1) / 6),
        0,
    ];

    return (
        <div className="rm-ra-card rm-ra-card-monthly-hours">
            <h3 className="rm-ra-card-title">Monthly Learning Hours Trends</h3>

            <div className="rm-ra-barchart-container">
                {/* 1. Plot Wrap: Y-Axis + Gridlines & Bars sharing exact 100% height */}
                <div className="rm-ra-barchart-plot-wrap">
                    {/* Y-Axis Labels */}
                    <div className="rm-ra-barchart-y-axis">
                        {yTicks.map((tick, idx) => (
                            <div key={idx} className="rm-ra-y-tick-wrap">
                                <span className="rm-ra-y-tick-label">{tick}</span>
                            </div>
                        ))}
                    </div>

                    {/* Plot area with gridlines and bars */}
                    <div className="rm-ra-barchart-plot-area">
                        {/* Grid Lines */}
                        <div className="rm-ra-barchart-gridlines">
                            {yTicks.map((_, idx) => (
                                <div key={idx} className="rm-ra-gridline" />
                            ))}
                        </div>

                        {/* Bars Area */}
                        <div className="rm-ra-bars-area">
                            {isLoading ? (
                                [1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={`month-skel-${i}`} className="rm-ra-bar-column" style={{ opacity: 0.85, justifyContent: "flex-end", alignItems: "center" }}>
                                        <span className="ld-skeleton-block" style={{ width: "24px", height: `${30 + (i % 3) * 25}px`, borderRadius: "4px 4px 0 0" }} />
                                    </div>
                                ))
                            ) : (
                                monthlyData.map((item, idx) => {
                                const wholeHours = Math.round(item.hours || 0);
                                const wholeVideo = Math.round(item.videoHours ?? 0);
                                const wholePractice = Math.round(item.practiceHours ?? 0);
                                const heightPct = wholeHours > 0 ? Math.min(100, Math.max(3, (wholeHours / maxScale) * 100)) : 0;
                                const isHovered = hoveredIdx === idx;

                                return (
                                    <div
                                        key={item.month}
                                        className={`rm-ra-bar-column ${item.isCurrent ? "is-current" : ""}`}
                                        onMouseEnter={() => setHoveredIdx(idx)}
                                        onMouseLeave={() => setHoveredIdx(null)}
                                    >
                                        {/* Interactive Breakdown Tooltip */}
                                        {isHovered && (
                                            <div className="rm-ra-bar-tooltip">
                                                <div className="rm-ra-tooltip-title">
                                                    <span>{item.fullName || item.month}</span>
                                                    {item.isCurrent && <span style={{ color: "#60A5FA", fontSize: 9 }}>(Current)</span>}
                                                </div>
                                                <div className="rm-ra-tooltip-row">
                                                    <span>Total Hours:</span>
                                                    <strong style={{ color: "#FFFFFF" }}>{wholeHours}h</strong>
                                                </div>
                                                <div className="rm-ra-tooltip-row">
                                                    <span>
                                                        <span className="rm-ra-tooltip-dot video" />
                                                        Video Learning:
                                                    </span>
                                                    <span>{wholeVideo}h</span>
                                                </div>
                                                <div className="rm-ra-tooltip-row">
                                                    <span>
                                                        <span className="rm-ra-tooltip-dot practice" />
                                                        Practice & Labs:
                                                    </span>
                                                    <span>{wholePractice}h</span>
                                                </div>
                                                <div className="rm-ra-tooltip-row" style={{ marginTop: 4, paddingTop: 3, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                                                    <span>Active Learners:</span>
                                                    <span>{item.activeLearners ?? 0} members</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Outer bar track with precise height */}
                                        <div className="rm-ra-bar-track-outer" style={{ height: `${heightPct}%` }}>
                                            <span className="rm-ra-bar-value-label">{wholeHours}h</span>
                                            {wholeHours > 0 && (
                                                <div
                                                    className="rm-ra-bar-fill"
                                                    title={`${item.fullName || item.month}: ${wholeHours}h`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            }))}
                        </div>
                    </div>
                </div>

                {/* 2. X-Axis Month Labels */}
                <div className="rm-ra-barchart-x-axis-wrapper">
                    <div className="rm-ra-barchart-y-axis-spacer" />
                    <div className="rm-ra-barchart-x-axis">
                        {monthlyData.map((item) => (
                            <div key={item.month} className="rm-ra-x-axis-col">
                                <span className={`rm-ra-bar-month-label ${item.isCurrent ? "is-current" : ""}`}>
                                    {item.month}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

