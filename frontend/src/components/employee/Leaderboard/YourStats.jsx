import React, { useMemo } from "react";

/**
 * Generates smooth cubic Bézier SVG path (stroke) and area (fill)
 * dynamically from an array of numbers or values.
 */
export function generateSparklinePaths(rawValues, width = 64.5, height = 52, invert = false) {
    let values = Array.isArray(rawValues)
        ? rawValues.map((v) => (typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0))
        : [];

    if (values.length < 2) {
        const singleVal = values[0] || 0;
        if (singleVal === 0) {
            values = [0, 0];
        } else {
            values = [0, singleVal];
        }
    }

    const padTop = 6;
    const padBottom = 8;
    const padX = 2;
    const usableWidth = width - padX * 2;
    const usableHeight = height - padTop - padBottom;
    const bottomBaseline = height - padBottom; // 44

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    // 1. If flat/no variation
    if (range === 0) {
        const y = minVal === 0 ? bottomBaseline : padTop + usableHeight / 2;
        const pathD = `M ${padX} ${y} L ${width - padX} ${y}`;
        const areaD = `M ${padX} ${y} L ${width - padX} ${y} L ${width} ${height} L 0 ${height} Z`;
        return { pathD, areaD };
    }

    // 2. Map coordinates
    const points = values.map((val, idx) => {
        const x = padX + (idx / (values.length - 1)) * usableWidth;
        const normalized = (val - minVal) / range;
        const effectiveNorm = invert ? 1 - normalized : normalized;
        const y = bottomBaseline - effectiveNorm * usableHeight;
        return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    // 3. Smooth cubic Bézier interpolation with horizontal ease tangents
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const dx = p2.x - p1.x;

        const cp1x = Number((p1.x + dx * 0.45).toFixed(1));
        const cp1y = p1.y;
        const cp2x = Number((p2.x - dx * 0.45).toFixed(1));
        const cp2y = p2.y;

        pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
    return { pathD, areaD };
}

const SparklineChart = ({ strokeColor, startColor, endColor, gradientId, pathD, areaD }) => {
    return (
        <svg
            className="emp-stats-sparkline-svg"
            width="64.5"
            height="52"
            viewBox="0 0 64.5 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="64.5" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="39.37%" stopColor={startColor} />
                    <stop offset="100%" stopColor={endColor || "#FFFFFF"} stopOpacity="0.2" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#${gradientId})`} />
            <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

const YourStats = ({ stats = {}, isLoading = false }) => {
    const items = useMemo(() => {
        const spark = stats.sparklines || {};

        // 1. Points to next rank (Rank 1: goal achieved -> celebratory curve to top; Other ranks: progress curve)
        const nextRankVal = (isLoading || stats.pointsToNextRank == null) ? null : String(stats.pointsToNextRank);
        const rankVal = (isLoading || (stats.rank == null && stats.leaderboardRank == null)) ? null : String(stats.rank ?? stats.leaderboardRank);
        const curRankNum = rankVal ? parseInt(rankVal, 10) || 1 : 1;
        
        let nextRankData;
        if (curRankNum === 1 || nextRankVal === "0") {
            // Reached rank 1 milestone: upward curve reaching top peak
            nextRankData = [0, 5, 10];
        } else {
            const nextPts = parseFloat(nextRankVal) || 0;
            nextRankData = spark.pointsToNextRank || [0, nextPts];
        }
        const nextRankPaths = generateSparklinePaths(nextRankData, 64.5, 52, false);

        // 2. Leaderboard Rank (Invert Y so Rank 1 is top peak)
        const rankData = spark.leaderboardRank || (curRankNum === 1 ? [3, 1] : [curRankNum + 2, curRankNum]);
        const rankPaths = generateSparklinePaths(rankData, 64.5, 52, true);

        // 3. Total Points
        const pointsVal = (isLoading || stats.totalPoints == null) ? null : String(stats.totalPoints);
        const cleanPoints = pointsVal ? parseFloat(String(pointsVal).replace(/,/g, "")) || 0 : 0;
        const pointsData = spark.totalPoints || (cleanPoints > 0 ? [0, cleanPoints] : [0, 0]);
        const pointsPaths = generateSparklinePaths(pointsData, 64.5, 52, false);

        // 4. Total Learning Hours
        const hoursVal = (isLoading || stats.totalLearningHours == null) ? null : String(stats.totalLearningHours);
        const cleanHours = hoursVal ? parseFloat(String(hoursVal).replace(/[^0-9.-]/g, "")) || 0 : 0;
        const hoursData = spark.totalLearningHours || (cleanHours > 0 ? [0, cleanHours] : [0, 0]);
        const hoursPaths = generateSparklinePaths(hoursData, 64.5, 52, false);

        return [
            {
                id: "next-rank",
                label: "Points to next rank",
                value: nextRankVal,
                textColor: "#2667F9",
                strokeColor: "#215EF8",
                startColor: "#B3CAFF",
                endColor: "#FFFFFF",
                gradientId: "blueSparkGrad",
                pathD: nextRankPaths.pathD,
                areaD: nextRankPaths.areaD,
            },
            {
                id: "leaderboard-rank",
                label: "Leaderboard Rank",
                value: rankVal,
                textColor: "#31C27E",
                strokeColor: "#31C27E",
                startColor: "#CEFCE6",
                endColor: "#FFFFFF",
                gradientId: "greenSparkGrad",
                pathD: rankPaths.pathD,
                areaD: rankPaths.areaD,
            },
            {
                id: "total-points",
                label: "Total Points",
                value: pointsVal,
                textColor: "#FDAD33",
                strokeColor: "#FDAD33",
                startColor: "#FFEBCC",
                endColor: "#FFFFFF",
                gradientId: "orangeSparkGrad",
                pathD: pointsPaths.pathD,
                areaD: pointsPaths.areaD,
            },
            {
                id: "total-hours",
                label: "Total Learning Hours",
                value: hoursVal,
                textColor: "#A567FA",
                strokeColor: "#A567FA",
                startColor: "#E9D9FF",
                endColor: "#FFFFFF",
                gradientId: "purpleSparkGrad",
                pathD: hoursPaths.pathD,
                areaD: hoursPaths.areaD,
            },
        ];
    }, [stats, isLoading]);

    return (
        <div className="emp-leaderboard-card emp-your-stats-card">
            <h3 className="emp-leaderboard-card-title">Your Stats</h3>
            <div className="emp-your-stats-grid">
                {items.map((item) => (
                    <div key={item.id} className="emp-stat-sparkline-box">
                        <div className="emp-stat-sparkline-info">
                            <span className="emp-stat-sparkline-label">{item.label}</span>
                            <span className="emp-stat-sparkline-value" style={{ color: item.textColor }}>
                                {item.value !== null ? (
                                    item.value
                                ) : (
                                    <span className="ld-skeleton-block" style={{ width: 44, height: 20, display: "inline-block", borderRadius: 4 }} />
                                )}
                            </span>
                        </div>
                        <div className="emp-stat-sparkline-chart">
                            <SparklineChart
                                strokeColor={item.strokeColor}
                                startColor={item.startColor}
                                endColor={item.endColor}
                                gradientId={item.gradientId}
                                pathD={item.pathD}
                                areaD={item.areaD}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default YourStats;
