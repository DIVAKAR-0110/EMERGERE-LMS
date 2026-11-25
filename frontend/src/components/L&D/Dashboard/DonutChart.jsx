import React from "react";

export default function DonutChart({
    data = [],
    size = 140,
    strokeWidth = 14,
    centerValue,
    centerLabel,
    gap = 0,
    strokeLinecap = "butt",
}) {
    const total = data.reduce((acc, item) => acc + (item.value || 0), 0) || 100;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedPercentage = 0;

    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", display: "block" }}
            >
                {/* Background base track */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke="#F1F5F9"
                    strokeWidth={strokeWidth}
                />

                {/* Segments */}
                {data.map((item, index) => {
                    const segmentLength = (item.value / total) * circumference;
                    const strokeDasharray = `${Math.max(0, segmentLength - gap)} ${circumference}`;
                    const strokeDashoffset = -((accumulatedPercentage / total) * circumference);
                    accumulatedPercentage += item.value;

                    return (
                        <circle
                            key={index}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap={strokeLinecap}
                            style={{ transition: "stroke-dashoffset 0.5s ease" }}
                        />
                    );
                })}
            </svg>

            {/* Optional center label and value */}
            {(centerValue || centerLabel) && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        pointerEvents: "none",
                        padding: "4px",
                    }}
                >
                    {centerValue && (
                        <span className="ld-donut-percentage">{centerValue}</span>
                    )}
                    {centerLabel && (
                        <span className="ld-donut-label">{centerLabel}</span>
                    )}
                </div>
            )}
        </div>
    );
}
