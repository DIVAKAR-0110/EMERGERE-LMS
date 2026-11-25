import React from "react";
import DonutChart from "./DonutChart";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

const DOMAIN_COLOR_MAP = [
    "#2563EB",
    "#10B981",
    "#8B5CF6",
    "#F59E0B",
    "#06B6D4",
    "#2563EB",
    "#10B981",
    "#8B5CF6",
    "#F59E0B",
    "#06B6D4",
];

const DYNAMIC_DOMAIN_PALETTE = [
    "#2563EB",
    "#10B981",
    "#8B5CF6",
    "#F59E0B",
    "#06B6D4",
    "#EC4899",
    "#6366F1",
    "#14B8A6",
];

const getDomainColor = (item, index = 0) => {
    const raw = item?.label || item?.name || "";
    if (DOMAIN_COLOR_MAP[raw]) return DOMAIN_COLOR_MAP[raw];
    if (item?.color) return item.color;
    return DYNAMIC_DOMAIN_PALETTE[index % DYNAMIC_DOMAIN_PALETTE.length];
};

/**
 * Largest Remainder Method (Hamilton's Method)
 * Converts percentages into whole numbers while ensuring their total equals exactly 100%.
 */
function applyHamiltonMethod(items) {
    if (!items || items.length === 0) return [];

    const totalRaw = items.reduce((sum, it) => sum + (Number(it.value ?? it.percentage ?? it.count ?? 0) || 0), 0);
    if (totalRaw === 0) {
        return items.map((it, idx) => ({
            label: it.label || it.name || "Domain",
            value: 0,
            color: getDomainColor(it, idx),
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
            label: it.label || it.name || "Domain",
            color: getDomainColor(it, idx),
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
    return rawList.map((it) => ({
        label: it.label,
        value: it.intPart + (winners.has(it.idx) ? 1 : 0),
        color: it.color,
    }));
}

export default function TopCertificationDomains({ domainData = null, isLoading = false }) {
    // Loading state when data has not arrived yet
    if (domainData === null || isLoading) {
        return (
            <div className="ld-section-card ld-top-domains-card">
                <div className="ld-section-header">
                    <h3 className="ld-section-title">Top Certification Domains</h3>
                </div>
                <div className="ld-domains-body">
                    <div className="ld-domains-chart-box">
                        <span className="ld-skeleton-circle" style={{ width: 88, height: 88, borderRadius: "50%" }} />
                    </div>
                    <div className="ld-domains-legend">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="ld-domains-legend-item">
                                <div className="ld-domain-label-group">
                                    <span className="ld-skeleton-circle" style={{ width: 8, height: 8, borderRadius: "50%" }} />
                                    <span className="ld-skeleton-block" style={{ width: 90, height: 12, marginLeft: 6, borderRadius: 4 }} />
                                </div>
                                <span className="ld-skeleton-block" style={{ width: 26, height: 12, borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Filter to strictly display unique domains with non-zero certifications
    const rawList = (Array.isArray(domainData) ? domainData : []).filter(
        (it) => Number(it.value ?? it.percentage ?? it.count ?? 0) > 0
    );
    // Apply Hamilton's Method to produce whole numbers and sort descending
    const normalizedData = applyHamiltonMethod(rawList).sort((a, b) => b.value - a.value);

    return (
        <div className="ld-section-card ld-top-domains-card">
            <div className="ld-section-header">
                <h3 className="ld-section-title">Top Certification Domains</h3>
            </div>

            {normalizedData.length === 0 ? (
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
                        alt="No certification domains"
                        className="ld-empty-state-icon"
                        style={{ width: "56px", height: "42px", objectFit: "contain", marginBottom: "8px", opacity: 0.8 }}
                    />
                    <span>No certification domains recorded yet.</span>
                </div>
            ) : (
                <div className="ld-domains-body">
                    <div className="ld-domains-chart-box">
                        <DonutChart
                            data={normalizedData}
                            size={106}
                            strokeWidth={26}
                        />
                    </div>

                    <div className="ld-domains-legend">
                        {normalizedData.map((item, index) => (
                            <div key={item.label || index} className="ld-domains-legend-item">
                                <div className="ld-domain-label-group">
                                    <span
                                        className="ld-domain-dot"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="ld-domain-name" title={item.label}>
                                        {item.label}
                                    </span>
                                </div>
                                <span className="ld-domain-val">{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
