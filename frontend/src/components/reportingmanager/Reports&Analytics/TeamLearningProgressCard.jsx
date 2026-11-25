import React, { useState, useEffect } from "react";
import { fetchTeamLearningProgressStats } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

export default function TeamLearningProgressCard() {
    const { token } = useAuth();
    const [progressStats, setProgressStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadProgressStats = async () => {
            try {
                setIsLoading(true);
                const data = await fetchTeamLearningProgressStats(token);
                if (isMounted && data) {
                    setProgressStats(data);
                }
            } catch (err) {
                console.error("Failed to load team learning progress stats:", err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadProgressStats();
        return () => {
            isMounted = false;
        };
    }, [token]);

    // Donut: r=42, circumference = 2π×42 ≈ 263.89
    const circumference = 263.89;

    const completedPct = progressStats?.completed_pct ?? 0;
    const inProgressPct = progressStats?.in_progress_pct ?? 0;
    const notStartedPct = progressStats?.not_started_pct ?? 0;
    const overallProgress = progressStats?.overall_progress ?? 0;
    const trendPct = progressStats?.trend_pct ?? 0;
    const trendDir = progressStats?.trend_direction || "up";

    const completedStroke = (completedPct / 100) * circumference;
    const inProgressStroke = (inProgressPct / 100) * circumference;
    const notStartedStroke = (notStartedPct / 100) * circumference;

    const inProgressOffset = -completedStroke;
    const notStartedOffset = -(completedStroke + inProgressStroke);

    // Figma & Status colors
    const COMPLETED_COLOR = "#1CB06A"; // Green
    const IN_PROGRESS_COLOR = "#215EF8"; // Blue
    const NOT_STARTED_COLOR = "#C5C5C5"; // Light gray
    const BG_RING_COLOR = "#DDE0EE"; // Base ring

    const legend = [
        { label: "Completed", color: COMPLETED_COLOR, value: `${completedPct}%` },
        { label: "In Progress", color: IN_PROGRESS_COLOR, value: `${inProgressPct}%` },
        { label: "Not Started", color: NOT_STARTED_COLOR, value: `${notStartedPct}%` },
    ];

    return (
        <div className="rm-ra-card rm-ra-card-learning-progress">
            <h3 className="rm-ra-card-title">Team Learning Progress</h3>

            {isLoading || !progressStats ? (
                <div className="rm-ra-progress-content">
                    <div className="rm-ra-progress-left-col">
                        <div className="rm-ra-donut-shadow-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="ld-skeleton-circle" style={{ width: 85, height: 85 }} />
                        </div>
                        <div className="rm-ra-progress-trend" style={{ opacity: 0.85 }}>
                            <span className="ld-skeleton-block" style={{ width: 80, height: 14, borderRadius: 3 }} />
                        </div>
                    </div>
                    <div className="rm-ra-progress-legend" style={{ opacity: 0.85 }}>
                        {[1, 2, 3].map((i) => (
                            <div key={`skel-leg-${i}`} className="rm-ra-legend-item">
                                <div className="rm-ra-legend-left">
                                    <span className="ld-skeleton-circle" style={{ width: 10, height: 10, marginRight: 8, display: 'inline-block' }} />
                                    <span className="ld-skeleton-block" style={{ width: 70, height: 14, borderRadius: 3 }} />
                                </div>
                                <span className="ld-skeleton-block" style={{ width: 30, height: 14, borderRadius: 3 }} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="rm-ra-progress-content">
                {/* Left Side: Donut Chart + Bottom Trend */}
                <div className="rm-ra-progress-left-col">
                    {/* Figma: 117.86×117.86 white box, drop-shadow */}
                    <div className="rm-ra-donut-shadow-box">
                        <div className="rm-ra-donut-wrapper">
                            <svg viewBox="0 0 100 100" className="rm-ra-donut-svg" style={{ transform: "rotate(-90deg)" }}>
                                {/* Background / Base Ring (#DDE0EE) */}
                                <circle
                                    cx="50" cy="50" r="42"
                                    fill="transparent"
                                    stroke={BG_RING_COLOR}
                                    strokeWidth="9"
                                />

                                {/* Completed Arc — #1CB06A (Green) */}
                                {completedPct > 0 && (
                                    <circle
                                        cx="50" cy="50" r="42"
                                        fill="transparent"
                                        stroke={COMPLETED_COLOR}
                                        strokeWidth="9"
                                        strokeDasharray={`${completedStroke} ${circumference}`}
                                        strokeDashoffset="0"
                                        strokeLinecap="round"
                                    />
                                )}

                                {/* In Progress Arc — #215EF8 (Blue) */}
                                {inProgressPct > 0 && (
                                    <circle
                                        cx="50" cy="50" r="42"
                                        fill="transparent"
                                        stroke={IN_PROGRESS_COLOR}
                                        strokeWidth="9"
                                        strokeDasharray={`${inProgressStroke} ${circumference}`}
                                        strokeDashoffset={inProgressOffset}
                                        strokeLinecap="round"
                                    />
                                )}

                                {/* Not Started Arc — #C5C5C5 (Gray) */}
                                {notStartedPct > 0 && (
                                    <circle
                                        cx="50" cy="50" r="42"
                                        fill="transparent"
                                        stroke={NOT_STARTED_COLOR}
                                        strokeWidth="9"
                                        strokeDasharray={`${notStartedStroke} ${circumference}`}
                                        strokeDashoffset={notStartedOffset}
                                        strokeLinecap="round"
                                    />
                                )}
                            </svg>

                            {/* Center text: Overall Progress */}
                            <div className="rm-ra-donut-center-text">
                                <span className="rm-ra-donut-percentage">{overallProgress}%</span>
                                <span className="rm-ra-donut-subtext">Overall Progress</span>
                            </div>
                        </div>
                    </div>

                    {/* Trend indicator — Figma: ▲ #FFAD0E amber arrow, green text */}
                    <div className={`rm-ra-progress-trend ${trendDir}`}>
                        <span className={`rm-ra-trend-triangle ${trendDir}`}>
                            {trendDir === "down" ? "▼" : trendDir === "neutral" ? "—" : "▲"}
                        </span>
                        <span className={`rm-ra-trend-text ${trendDir}`}>{trendPct}% </span>
                        <span className="rm-ra-trend-text-grey">vs last month</span>
                    </div>
                </div>

                {/* Right Side: Legend */}
                <div className="rm-ra-progress-legend">
                    {legend.map((item) => (
                        <div key={item.label} className="rm-ra-legend-item">
                            <div className="rm-ra-legend-left">
                                <span
                                    className="rm-ra-legend-dot"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="rm-ra-legend-label">{item.label}</span>
                            </div>
                            <span className="rm-ra-legend-value">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
            )}
        </div>
    );
}
