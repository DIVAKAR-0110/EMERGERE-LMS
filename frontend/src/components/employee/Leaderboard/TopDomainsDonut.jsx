import React from "react";

import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
const DEFAULT_DOMAIN_COLORS = [
    "#2667F9",
    "#31C27E",
    "#9E5DF9",
    "#FDAD33",
    "#2BC3F3",
    "#EC4899",
    "#8B5CF6",
    "#14B8A6",
];

const DOMAIN_NAME_MAP = {
    "CLOUD": "Cloud Computing",
    "DATA SCIENCE": "Data Science & Analytics",
    "DEVOPS": "DevOps & Kubernetes",
    "AI/ML": "AI & Machine Learning",
    "SECURITY": "Cybersecurity",
};

/**
 * Largest Remainder Method (Hamilton's Method)
 * Converts percentages into whole numbers while ensuring their total equals exactly 100%.
 */
function applyHamiltonMethod(items) {
    if (!items || items.length === 0) return [];

    const totalRaw = items.reduce((sum, it) => sum + (Number(it.value ?? it.percentage ?? it.count ?? 0) || 0), 0);
    if (totalRaw === 0) {
        return items.map((it) => ({
            ...it,
            value: 0,
            percentage: 0,
        }));
    }

    // 1. Calculate raw percentages and integer parts
    const rawList = items.map((it, idx) => {
        const val = Number(it.value ?? it.percentage ?? it.count ?? 0) || 0;
        const rawPct = (val / totalRaw) * 100;
        const intPart = Math.floor(rawPct);
        const remainder = rawPct - intPart;
        return {
            ...it,
            idx,
            rawPct,
            intPart,
            remainder,
        };
    });

    // 2. Sum of integer parts and remaining points (100 - sum)
    const sumInt = rawList.reduce((acc, it) => acc + it.intPart, 0);
    const remainingPoints = 100 - sumInt;

    // 3. Rank decimal remainders descending (tie-breaker by original index)
    const sortedByRemainder = [...rawList].sort((a, b) => b.remainder - a.remainder || a.idx - b.idx);
    const winners = new Set(sortedByRemainder.slice(0, remainingPoints).map((it) => it.idx));

    // 4. Distribute the remaining points
    return rawList.map((it) => {
        const finalVal = it.intPart + (winners.has(it.idx) ? 1 : 0);
        return {
            ...it,
            value: finalVal,
            percentage: finalVal,
        };
    });
}

const DOMAIN_COLOR_MAP = {
    "Cloud Computing": "#2667F9",
    "Data Science & Analytics": "#31C27E",
    "Cybersecurity": "#9E5DF9",
    "AI & Machine Learning": "#FDAD33",
    "DevOps & Kubernetes": "#2BC3F3",
    "CLOUD": "#2667F9",
    "DATA SCIENCE": "#31C27E",
    "SECURITY": "#9E5DF9",
    "AI/ML": "#FDAD33",
    "DEVOPS": "#2BC3F3",
};

const getDomainColor = (domain, index) => {
    const raw = domain?.name || domain?.label || "";
    if (DOMAIN_COLOR_MAP[raw]) return DOMAIN_COLOR_MAP[raw];
    const mapped = DOMAIN_NAME_MAP[raw.toUpperCase()];
    if (mapped && DOMAIN_COLOR_MAP[mapped]) return DOMAIN_COLOR_MAP[mapped];
    if (domain?.color) return domain.color;
    return DEFAULT_DOMAIN_COLORS[index % DEFAULT_DOMAIN_COLORS.length];
};

const TopDomainsDonut = ({ domains = [], isLoading = false }) => {
    // Filter to strictly display unique domains with non-zero certifications
    const validDomains = (domains || []).filter(
        (d) => Number(d.percentage ?? d.value ?? d.count ?? 0) > 0
    );
    // Apply Hamilton's Method to guarantee whole numbers summing to 100%, and sort descending
    const sortedDomains = applyHamiltonMethod(validDomains).sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

    // Radius & Circumference for 123x123 Donut Chart
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    let cumulativeOffset = 0;

    return (
        <div className="emp-leaderboard-card emp-domains-card">
            <h3 className="emp-leaderboard-card-title">Top Certification Domains</h3>
            {isLoading ? (
                <div className="emp-domains-card-content">
                    {/* SKELETON DONUT */}
                    <div className="emp-domains-chart-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="ld-skeleton-circle" style={{ width: 100, height: 100 }} />
                    </div>
                    {/* SKELETON LEGEND */}
                    <div className="emp-domains-legend-list">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={`dom-skel-${i}`} className="emp-domain-legend-item" style={{ opacity: 0.85 }}>
                                <div className="emp-domain-legend-left">
                                    <span className="ld-skeleton-circle" style={{ width: 10, height: 10, marginRight: 8, display: 'inline-block' }} />
                                    <span className="ld-skeleton-block" style={{ width: 110, height: 14, borderRadius: 4 }} />
                                </div>
                                <span className="ld-skeleton-block" style={{ width: 28, height: 14, borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : sortedDomains.length === 0 ? (
                <div className="emp-domains-empty-wrapper">
                    <img
                        src={openBookIcon}
                        alt="No certification domains"
                        className="ld-empty-state-icon"
                    />
                    <span>No certification domains recorded yet.</span>
                </div>
            ) : (
                <div className="emp-domains-card-content">
                    {/* DONUT CHART SVG (123px x 123px) */}
                        <div className="emp-domains-chart-wrapper">
                            <svg className="emp-donut-chart-svg" width="123" height="123" viewBox="0 0 120 120">
                                {/* Background base track */}
                                <circle
                                    cx="60"
                                    cy="60"
                                    r={radius}
                                    fill="transparent"
                                    stroke="#F1F5F9"
                                    strokeWidth="24"
                                />
                                {sortedDomains.map((domain, index) => {
                                    const pct = Number(domain.percentage || 0);
                                    const strokeDash = (pct / 100) * circumference;
                                    const strokeOffset = -cumulativeOffset;
                                    cumulativeOffset += strokeDash;
                                    const color = getDomainColor(domain, index);

                                    return (
                                        <circle
                                            key={domain.name || index}
                                            cx="60"
                                            cy="60"
                                            r={radius}
                                            fill="transparent"
                                            stroke={color}
                                            strokeWidth="24"
                                            strokeDasharray={`${strokeDash} ${circumference}`}
                                            strokeDashoffset={strokeOffset}
                                            transform="rotate(-90 60 60)"
                                            className="emp-donut-segment"
                                        />
                                    );
                                })}
                            </svg>
                        </div>

                        {/* DOMAINS LEGEND LIST (296px width, 5 bordered rows) */}
                        <div className="emp-domains-legend-list">
                            {sortedDomains.map((domain, index) => {
                                const color = getDomainColor(domain, index);
                                const displayName = DOMAIN_NAME_MAP[domain.name] || domain.name;

                                return (
                                    <div key={domain.name || index} className="emp-domain-legend-item">
                                        <div className="emp-domain-legend-left">
                                            <span
                                                className="emp-domain-legend-dot"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="emp-domain-legend-name" title={displayName}>
                                                {displayName}
                                            </span>
                                        </div>
                                        <span className="emp-domain-legend-percentage">
                                            {domain.percentage}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
        </div>
    );
};

export default TopDomainsDonut;
