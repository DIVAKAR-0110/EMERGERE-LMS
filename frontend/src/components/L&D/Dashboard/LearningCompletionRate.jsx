import React from "react";
import DonutChart from "./DonutChart";

export default function LearningCompletionRate({ completionData = null, isLoading = false }) {
    const isWaiting = isLoading || completionData === null;

    if (isWaiting) {
        return (
            <div className="ld-section-card ld-completion-card">
                <div className="ld-section-header">
                    <h3 className="ld-section-title">Learning Completion Rate</h3>
                </div>

                <div className="ld-completion-body">
                    <div className="ld-completion-chart-wrapper">
                        <div className="ld-completion-chart-col">
                            <div className="ld-completion-donut-shadow-box" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 112, height: 112 }}>
                                <span className="ld-skeleton-circle" style={{ width: 104, height: 104 }} />
                            </div>
                            <div className="ld-trend-badge" style={{ marginTop: 8 }}>
                                <span className="ld-skeleton-block" style={{ width: 80, height: 14 }} />
                            </div>
                        </div>

                        <div className="ld-completion-legend" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[1, 2, 3].map((idx) => (
                                <div key={idx} className="ld-completion-legend-item">
                                    <div className="ld-legend-left">
                                        <span className="ld-skeleton-circle" style={{ width: 8, height: 8 }} />
                                        <span className="ld-skeleton-block" style={{ width: 70, height: 12, marginLeft: 6 }} />
                                    </div>
                                    <span className="ld-skeleton-block" style={{ width: 28, height: 12 }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const data = {
        overall: completionData?.overall !== undefined ? completionData.overall : 0,
        completed: completionData?.completed !== undefined ? completionData.completed : 0,
        inProgress: completionData?.inProgress !== undefined ? completionData.inProgress : 0,
        notStarted: completionData?.notStarted !== undefined ? completionData.notStarted : 0,
        trendVsLastMonth: completionData?.trendVsLastMonth !== undefined ? completionData.trendVsLastMonth : 0,
        trendDirection: completionData?.trendDirection || "neutral",
    };

    const chartData = [
        { label: "Completed", value: data.completed, color: "#10B981" },
        { label: "In Progress", value: data.inProgress, color: "#2563EB" },
        { label: "Not Started", value: data.notStarted, color: "#CBD5E1" },
    ];

    const trendArrow = data.trendDirection === "down" ? "▼" : data.trendDirection === "neutral" ? "" : "▲";

    return (
        <div className="ld-section-card ld-completion-card">
            <div className="ld-section-header">
                <h3 className="ld-section-title">Learning Completion Rate</h3>
            </div>

            <div className="ld-completion-body">
                <div className="ld-completion-chart-wrapper">
                    <div className="ld-completion-chart-col">
                        <div className="ld-completion-donut-shadow-box">
                            <DonutChart
                                data={chartData}
                                size={108}
                                strokeWidth={11}
                                strokeLinecap="round"
                                centerValue={`${data.overall}%`}
                                centerLabel="Overall Progress"
                            />
                        </div>
                        <div className="ld-trend-badge">
                            <span className={`ld-trend-value ${data.trendDirection}`}>
                                {trendArrow ? `${trendArrow} ` : ""}{data.trendVsLastMonth}%
                            </span>
                            <span className="ld-trend-label">vs last month</span>
                        </div>
                    </div>

                    <div className="ld-completion-legend">
                        {chartData.map((item, index) => (
                            <div key={index} className="ld-completion-legend-item">
                                <div className="ld-legend-left">
                                    <span
                                        className="ld-legend-dot"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="ld-legend-name">{item.label}</span>
                                </div>
                                <span className="ld-legend-val">{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
