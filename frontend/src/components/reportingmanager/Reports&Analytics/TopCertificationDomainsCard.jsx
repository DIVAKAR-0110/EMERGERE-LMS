import React, { useState, useEffect } from "react";
import DonutChart from "../../L&D/Dashboard/DonutChart";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { fetchTeamCertifications } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

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

export default function TopCertificationDomainsCard({ domainData }) {
    const { token } = useAuth();
    const [liveDomains, setLiveDomains] = useState(null);
    const [isLoading, setIsLoading] = useState(!domainData || domainData.length === 0);

    useEffect(() => {
        if (domainData && domainData.length > 0) {
            setIsLoading(false);
            return;
        }
        let isMounted = true;
        const loadTeamDomains = async () => {
            setIsLoading(true);
            try {
                const res = await fetchTeamCertifications(token);
                if (isMounted && res && Array.isArray(res.top_domains)) {
                    setLiveDomains(res.top_domains);
                }
            } catch (err) {
                console.warn("[TopCertificationDomainsCard] Error loading team domains:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadTeamDomains();
        return () => {
            isMounted = false;
        };
    }, [token, domainData]);

    const activeList = (domainData && domainData.length > 0)
        ? domainData
        : (liveDomains && liveDomains.length > 0 ? liveDomains : []);

    // Filter to strictly display unique domains with non-zero certifications
    const validList = activeList.filter(
        (it) => Number(it.value ?? it.percentage ?? it.count ?? 0) > 0
    );

    // Convert to whole numbers using Hamilton's Method and sort descending
    const data = applyHamiltonMethod(validList).sort((a, b) => b.value - a.value);

    return (
        <div className="rm-ra-card rm-ra-card-top-domains">
            <h3 className="rm-ra-card-title">Top Certification Domains</h3>

            {isLoading ? (
                <div className="rm-ra-domains-content" style={{ opacity: 0.9 }}>
                    <div className="rm-ra-domains-chart-box" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div className="ld-skeleton-circle" style={{ width: 100, height: 100, borderRadius: "50%" }} />
                    </div>
                    <div className="rm-ra-domains-legend">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="rm-ra-domain-item" style={{ alignItems: "center" }}>
                                <div className="rm-ra-domain-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span className="ld-skeleton-circle" style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0 }} />
                                    <span className="ld-skeleton-block" style={{ width: 80, height: 14, borderRadius: 4 }} />
                                </div>
                                <span className="ld-skeleton-block" style={{ width: 28, height: 14, borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : data.length === 0 ? (
                <div className="rm-ra-domains-empty-state">
                    <img
                        src={openBookIcon}
                        alt="No certification domains"
                        className="rm-ra-domains-empty-icon"
                    />
                    <span className="rm-ra-domains-empty-text">
                        No certification domains recorded for team yet.
                    </span>
                </div>
            ) : (
                <div className="rm-ra-domains-content">
                    <div className="rm-ra-domains-chart-box">
                        <DonutChart data={data} size={110} strokeWidth={26} />
                    </div>

                    <div className="rm-ra-domains-legend">
                        {data.map((item, index) => (
                            <div key={item.label || index} className="rm-ra-domain-item">
                                <div className="rm-ra-domain-left">
                                    <span
                                        className="rm-ra-domain-dot"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="rm-ra-domain-name" title={item.label}>
                                        {item.label}
                                    </span>
                                </div>
                                <span className="rm-ra-domain-val" style={{ fontWeight: 500 }}>{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
