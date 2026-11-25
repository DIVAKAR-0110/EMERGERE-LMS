import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Award, GraduationCap, Building2, TrendingUp } from "lucide-react";

export default function SpendDistributionSummaryCard({
    streams = [],
    departments = [],
    topCertProviders = null,
    certClaims = [],
    topCourseProviders = null,
    courses = [],
    selectedPeriod = "This Month",
    onViewCategoryTable,
    counts = {},
    amounts = {},
}) {
    // Mode toggle: false = Navigation mode (clicks navigate to table), true = Chart Inspection mode (clicks pin/view pie chart)
    const [isChartInspectionOn, setIsChartInspectionOn] = useState(false);
    const [pinnedComponentKey, setPinnedComponentKey] = useState(null);

    const [hoveredKey, setHoveredKey] = useState(null);
    const [hoveredSliceKey, setHoveredSliceKey] = useState(null);

    // In Chart Inspection mode, pinned key takes precedence; otherwise hover controls dept view
    const isDeptMode = isChartInspectionOn
        ? pinnedComponentKey === "departments" || (!pinnedComponentKey && hoveredKey === "departments")
        : hoveredKey === "departments";

    // Fallback palette matching Image 1
    const defaultColors = ["#8B5CF6", "#F59E0B", "#06B6D4", "#2563EB"];

    // SVG donut math (Identical rock-solid 200x200 canvas matching Image 1)
    const radius = 68;
    const circumference = 2 * Math.PI * radius;

    // 1. Streams segments (Default view) - Continuous exact arc geometry with seamless closure
    const totalSpent = streams.reduce((sum, s) => sum + (s.amount || 0), 0);
    let accumulatedLength = 0;
    const streamSegments = streams.map((stream, idx) => {
        const isLast = idx === streams.length - 1;
        const color = stream.color || defaultColors[idx % defaultColors.length];

        let arcLength = 0;
        if (totalSpent > 0) {
            if (isLast) {
                // Ensure the full 360 circle is closed seamlessly with zero gap
                arcLength = Math.max(0, circumference - accumulatedLength);
            } else {
                arcLength = ((stream.amount || 0) / totalSpent) * circumference;
            }
        }

        const strokeDasharray = `${arcLength} ${circumference}`;
        const strokeDashoffset = -accumulatedLength;
        accumulatedLength += arcLength;

        return {
            ...stream,
            color,
            strokeDasharray,
            strokeDashoffset,
            shortLabel: stream.label ? stream.label.split(" ")[0] : "Stream",
        };
    });

    // 2. Department segments (Department Budgets hover/pinned view - exact same donut structure)
    const fallbackDepts = [];
    const deptList = (departments && departments.length > 0) ? departments : fallbackDepts;
    const deptTotal = deptList.reduce((sum, d) => sum + (d.ytd_spent || d.amount || d.spend || 0), 0);
    const deptColors = ["#2563EB", "#F59E0B", "#06B6D4", "#8B5CF6", "#EC4899", "#10B981", "#6366F1", "#F43F5E"];

    let accumulatedDeptLength = 0;
    const deptSegments = deptList.map((d, idx) => {
        const isLast = idx === deptList.length - 1;
        const amt = d.ytd_spent || d.amount || d.spend || 0;
        let arcLength = 0;
        if (deptTotal > 0) {
            if (isLast) {
                arcLength = Math.max(0, circumference - accumulatedDeptLength);
            } else {
                arcLength = (amt / deptTotal) * circumference;
            }
        }
        const pct = deptTotal > 0 ? Math.round((amt / deptTotal) * 100) : 0;
        const color = deptColors[idx % deptColors.length];
        const strokeDasharray = `${arcLength} ${circumference}`;
        const strokeDashoffset = -accumulatedDeptLength;
        accumulatedDeptLength += arcLength;

        const shortName = d.department
            .replace("Human Resources (HR)", "HR Dept")
            .replace("Enterprise Applications (Platform & Applications)", "Enterprise Applications");

        return {
            key: `dept-${d.id || idx}`,
            label: d.department,
            shortLabel: shortName,
            amount: amt,
            pct,
            color,
            strokeDasharray,
            strokeDashoffset,
        };
    });

    const activeSegments = isDeptMode ? deptSegments : streamSegments;
    const activeTotal = isDeptMode ? deptTotal : totalSpent;

    // Effective key for slice highlighting
    const effectiveActiveKey = isChartInspectionOn
        ? (pinnedComponentKey || hoveredKey)
        : hoveredKey;

    // Hovered slice resolution
    const hoveredSlice = activeSegments.find((s) => {
        if (hoveredSliceKey) return s.key === hoveredSliceKey;
        if (!isDeptMode && effectiveActiveKey) return s.key === effectiveActiveKey;
        return false;
    });

    const formatCompactINR = (amt) => {
        const val = Number(amt || 0);
        if (val >= 100000) {
            return `₹${(val / 100000).toFixed(2)}L`;
        }
        if (val >= 1000) {
            return `₹${(val / 1000).toFixed(0)}k`;
        }
        return `₹${val}`;
    };

    // Card click handler: in Inspection mode pins the chart, in Navigation mode navigates to table
    const handleCardClick = (compKey) => {
        if (isChartInspectionOn) {
            setPinnedComponentKey((prev) => (prev === compKey ? null : compKey));
            setHoveredSliceKey(null);
        } else {
            if (onViewCategoryTable) {
                onViewCategoryTable(compKey);
            }
        }
    };

    const courseSeg = streamSegments.find((s) => s.key === "courses");
    const certSeg = streamSegments.find((s) => s.key === "certifications");
    const workshopSeg = streamSegments.find((s) => s.key === "workshops");

    const isWorkshopsSelected = !isDeptMode && (
        pinnedComponentKey === "workshops" ||
        effectiveActiveKey === "workshops" ||
        hoveredSliceKey === "workshops"
    );

    const isCertsSelected = !isDeptMode && (
        pinnedComponentKey === "certifications" ||
        effectiveActiveKey === "certifications" ||
        hoveredSliceKey === "certifications"
    );

    const isCoursesSelected = !isDeptMode && (
        pinnedComponentKey === "courses" ||
        effectiveActiveKey === "courses" ||
        hoveredSliceKey === "courses"
    );



    // Dynamic Top 3 Certification Providers (from backend or live claims)
    const activeTop3Providers = (() => {
        if (topCertProviders && topCertProviders.length > 0) {
            return topCertProviders;
        }
        if (certClaims && certClaims.length > 0) {
            const provMap = {};
            let total = 0;
            certClaims.forEach((c) => {
                let name = (c.provider || c.issuing_body || "Other").trim();
                if (name.toLowerCase().includes("aws") || name.toLowerCase().includes("amazon")) name = "AWS";
                else if (name.toLowerCase().includes("linkedin")) name = "Linkedin Learning";
                else if (name.toLowerCase().includes("tableau")) name = "Tableau";
                else if (name.toLowerCase().includes("microsoft") || name.toLowerCase().includes("azure")) name = "Microsoft";
                else if (name.toLowerCase().includes("coursera")) name = "Coursera";

                const amt = Number(c.claim_amount || c.amount || 0);
                total += amt;
                if (!provMap[name]) provMap[name] = { name, spend: 0, count: 0 };
                provMap[name].spend += amt;
                provMap[name].count += 1;
            });
            const list = Object.values(provMap).sort((a, b) => b.spend - a.spend);
            return list.slice(0, 3).map((item, idx) => ({
                rank: idx + 1,
                name: item.name,
                spend: item.spend,
                spend_formatted: `₹${item.spend.toLocaleString("en-IN")}`,
                percentage: total > 0 ? Math.round((item.spend / total) * 1000) / 10 : 0,
                claims_count: item.count,
            }));
        }
        return [
            { rank: 1, name: "AWS", spend: 0, spend_formatted: "₹0", percentage: 0, claims_count: 0 },
            { rank: 2, name: "Linkedin Learning", spend: 0, spend_formatted: "₹0", percentage: 0, claims_count: 0 },
            { rank: 3, name: "Tableau", spend: 0, spend_formatted: "₹0", percentage: 0, claims_count: 0 },
        ];
    })();

    // Dynamic Top 3 Course Providers (from backend or live courses)
    const activeTop3CourseProviders = (() => {
        if (topCourseProviders && topCourseProviders.length > 0) {
            return topCourseProviders;
        }
        if (courses && courses.length > 0) {
            const provMap = {};
            let total = 0;
            courses.forEach((c) => {
                let name = (c.provider || "Other").trim();
                if (name.toLowerCase().includes("coursera")) name = "Coursera";
                else if (name.toLowerCase().includes("udemy")) name = "Udemy";
                else if (name.toLowerCase().includes("emergere")) name = "Emergere Academy";
                else if (name.toLowerCase().includes("aws")) name = "AWS Training";
                else if (name.toLowerCase().includes("microsoft")) name = "Microsoft Learn";
                else if (name.toLowerCase().includes("linkedin")) name = "Linkedin Learning";

                const amt = Number(c.price || 0);
                total += amt;
                if (!provMap[name]) provMap[name] = { name, spend: 0, count: 0 };
                provMap[name].spend += amt;
                provMap[name].count += 1;
            });
            const list = Object.values(provMap).sort((a, b) => b.spend - a.spend);
            return list.slice(0, 3).map((item, idx) => ({
                rank: idx + 1,
                name: item.name,
                spend: item.spend,
                spend_formatted: `₹${item.spend.toLocaleString("en-IN")}`,
                percentage: total > 0 ? Math.round((item.spend / total) * 1000) / 10 : 0,
                courses_count: item.count,
            }));
        }
        return [
            { rank: 1, name: "Coursera", spend: 0, spend_formatted: "₹0", percentage: 0, courses_count: 0 },
            { rank: 2, name: "Udemy", spend: 0, spend_formatted: "₹0", percentage: 0, courses_count: 0 },
            { rank: 3, name: "Emergere Academy", spend: 0, spend_formatted: "₹0", percentage: 0, courses_count: 0 },
        ];
    })();

    // Compute Top 3 Departments specifically for Workshops & Training spend
    const totalWorkshopDeptSpend = deptList.reduce((sum, d) => sum + (Number(d.spend_workshops) || 0), 0) || (workshopSeg?.amount ?? 0);

    const sortedWorkshopDepts = [...deptList]
        .filter((d) => (Number(d.spend_workshops) || 0) > 0)
        .sort((a, b) => (Number(b.spend_workshops) || 0) - (Number(a.spend_workshops) || 0));

    const remainingDepts = [...deptList]
        .filter((d) => (Number(d.spend_workshops) || 0) === 0)
        .sort((a, b) => (a.department || "").localeCompare(b.department || ""));

    const top3WorkshopDepts = [...sortedWorkshopDepts, ...remainingDepts].slice(0, 3).map((d, index) => {
        const spend = Number(d.spend_workshops) || 0;
        const sharePct = totalWorkshopDeptSpend > 0
            ? Math.round((spend / totalWorkshopDeptSpend) * 100)
            : 0;

        const shortName = (d.department || "Department")
            .replace("Human Resources (HR)", "HR Dept")
            .replace("Enterprise Applications (Platform & Applications)", "Enterprise Applications");

        return {
            rank: index + 1,
            name: d.department,
            shortName,
            spend,
            spendFormatted: `₹${spend.toLocaleString("en-IN")}`,
            sharePct,
        };
    });

    const componentItems = [
        {
            key: "courses",
            title: "Course Purchase History",
            shortLabel: "Course Purchases",
            icon: BookOpen,
            color: "#8B5CF6",
            bgColor: "#F3E8FF",
            count: `${counts.courses ?? 0} Courses`,
            amount: amounts.courses || "₹0.00L",
            budgetShare: courseSeg?.pct ? `${courseSeg.pct}% Spent` : "0% Spent",
            highlight: "Purchase New Courses",
        },
        {
            key: "certifications",
            title: "Certification Claims",
            shortLabel: "Certification Claims",
            icon: Award,
            color: "#F59E0B",
            bgColor: "#FEF3C7",
            count: `${counts.certifications ?? 0} Claims`,
            amount: amounts.certifications || "₹0.00L",
            budgetShare: certSeg?.pct ? `${certSeg.pct}% Spent` : "0% Spent",
            highlight: "Direct Exam Reimbursements",
        },
        {
            key: "workshops",
            title: "Workshops & Training",
            shortLabel: "Workshops & Events",
            icon: GraduationCap,
            color: "#06B6D4",
            bgColor: "#E0F2FE",
            count: `${counts.workshops ?? 0} Events`,
            amount: amounts.workshops || "₹0.00L",
            budgetShare: workshopSeg?.pct ? `${workshopSeg.pct}% Spent` : "0% Spent",
            highlight: "Campus & Technical Seminars",
        },
        {
            key: "departments",
            title: "Department Budgets",
            shortLabel: "Department Budgets",
            icon: Building2,
            color: "#2563EB",
            bgColor: "#EFF6FF",
            count: `${counts.departments ?? 0} Departments`,
            amount: amounts.departments || "₹0.00L",
            budgetShare: "Total Spent",
            highlight: isChartInspectionOn ? "Click to lock / view breakdown" : "Hover to view breakdown",
        },
    ];

    return (
        <div className="budget-summary-card">
            {/* Header with Title & ON/OFF Mode Switch */}
            <div className="budget-summary-header">
                <div>
                    <h3 className="budget-summary-title">
                        {isDeptMode ? "Department-Wise Budget Spend Breakdown" : "Spend Distribution Across Streams"}
                    </h3>
                </div>
            </div>

            {/* Split Container: Left Donut Chart | Right Components List */}
            <div className="budget-summary-split-container">
                {/* Left Div: Donut Chart Canvas (Identical format matching Image 1) */}
                <div className="budget-summary-left-pane">
                    <div className="budget-summary-chart-section centered-donut-canvas">
                        {isDeptMode ? (
                            /* Department Mode: Donut Chart on Left + Color Coded Department Breakdown on Right */
                            <div className="budget-summary-dept-donut-container">
                                <div className="budget-summary-donut-wrap compact" style={{ pointerEvents: "none", userSelect: "none" }}>
                                    <svg
                                        className="budget-summary-donut-svg"
                                        viewBox="0 0 200 200"
                                        width="180"
                                        height="180"
                                    >
                                        <g transform="rotate(-90 100 100)">
                                            <circle
                                                cx="100"
                                                cy="100"
                                                r={radius}
                                                fill="transparent"
                                                stroke="#F1F5F9"
                                                strokeWidth="40"
                                            />
                                            {deptSegments.map((seg) => {
                                                const isHovered = hoveredSlice ? hoveredSlice.key === seg.key : false;
                                                const isDimmed = Boolean(hoveredSlice && !isHovered);

                                                return (
                                                    <circle
                                                        key={seg.key}
                                                        cx="100"
                                                        cy="100"
                                                        r={radius}
                                                        fill="transparent"
                                                        stroke={seg.color}
                                                        strokeWidth={isHovered ? 44 : 40}
                                                        strokeDasharray={seg.strokeDasharray}
                                                        strokeDashoffset={seg.strokeDashoffset}
                                                        strokeLinecap="butt"
                                                        className="budget-donut-slice"
                                                        style={{
                                                            opacity: isDimmed ? 0.35 : 1,
                                                            filter: isHovered
                                                                ? "drop-shadow(0 2px 8px rgba(0,0,0,0.25)) brightness(1.08)"
                                                                : "none",
                                                            transition: "stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease",
                                                            cursor: "pointer",
                                                        }}
                                                        onClick={() => {
                                                            if (!isChartInspectionOn && onViewCategoryTable) {
                                                                onViewCategoryTable("departments");
                                                            }
                                                        }}
                                                    >
                                                        <title>{`${seg.label}: ${seg.pct}% (${formatCompactINR(seg.amount)})`}</title>
                                                    </circle>
                                                );
                                            })}
                                        </g>
                                    </svg>

                                    {/* Center circular badge */}
                                    <div className="budget-summary-donut-center compact">
                                        <span className="budget-summary-donut-amount">
                                            {hoveredSlice
                                                ? formatCompactINR(hoveredSlice.amount)
                                                : (amounts.departments || (deptTotal === 0 ? "₹0.00L" : formatCompactINR(deptTotal)))}
                                        </span>
                                        <span className="budget-summary-donut-label">
                                            {hoveredSlice
                                                ? `${hoveredSlice.shortLabel} (${hoveredSlice.pct}%)`
                                                : "Total Dept Spend"}
                                        </span>
                                    </div>
                                </div>

                                {/* Department Color Legend with Names, Percentages & Price */}
                                <div className="budget-dept-legend-list">
                                    {deptSegments.map((seg) => {
                                        const isHovered = hoveredSlice ? hoveredSlice.key === seg.key : false;

                                        return (
                                            <div
                                                key={`legend-${seg.key}`}
                                                className={`budget-dept-legend-item ${isHovered ? "hovered" : ""}`}
                                                onClick={() => {
                                                    if (!isChartInspectionOn && onViewCategoryTable) {
                                                        onViewCategoryTable("departments");
                                                    }
                                                }}
                                                title={
                                                    isChartInspectionOn
                                                        ? `${seg.label}: ${seg.pct}% (${formatCompactINR(seg.amount)})`
                                                        : `Click to view ${seg.label} ledger table`
                                                }
                                            >
                                                <div className="budget-dept-legend-left">
                                                    <span
                                                        className="budget-dept-legend-dot"
                                                        style={{ backgroundColor: seg.color }}
                                                    />
                                                    <span
                                                        className="budget-dept-legend-name"
                                                        style={{ color: isHovered ? seg.color : "#000000" }}
                                                    >
                                                        {seg.shortLabel}
                                                    </span>
                                                </div>
                                                <div className="budget-dept-legend-right">
                                                    <span
                                                        className="budget-dept-legend-pct"
                                                        style={{
                                                            backgroundColor: `${seg.color}18`,
                                                            color: seg.color,
                                                            border: `1px solid ${seg.color}40`,
                                                        }}
                                                    >
                                                        {seg.pct}%
                                                    </span>
                                                    <span className="budget-dept-legend-amount">
                                                        {formatCompactINR(seg.amount)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : isWorkshopsSelected ? (
                            /* Workshops Selected Mode: Donut Chart on Left with highlighted slice + Arrow + Top 3 Departments Callout */
                            <div className="budget-summary-workshops-container">
                                <div className="budget-summary-donut-wrap compact" style={{ pointerEvents: "none", userSelect: "none" }}>
                                    <svg
                                        className="budget-summary-donut-svg"
                                        viewBox="0 0 200 200"
                                        width="180"
                                        height="180"
                                    >
                                        <g transform="rotate(-90 100 100)">
                                            <circle
                                                cx="100"
                                                cy="100"
                                                r={radius}
                                                fill="transparent"
                                                stroke="#F1F5F9"
                                                strokeWidth="40"
                                            />
                                            {streamSegments.map((seg) => {
                                                const isWorkshops = seg.key === "workshops";
                                                const isHovered = hoveredSliceKey ? hoveredSliceKey === seg.key : isWorkshops;
                                                const isDimmed = !isHovered;

                                                return (
                                                    <circle
                                                        key={seg.key}
                                                        cx="100"
                                                        cy="100"
                                                        r={radius}
                                                        fill="transparent"
                                                        stroke={seg.color}
                                                        strokeWidth={isWorkshops ? 44 : 40}
                                                        strokeDasharray={seg.strokeDasharray}
                                                        strokeDashoffset={seg.strokeDashoffset}
                                                        strokeLinecap="butt"
                                                        className={`budget-donut-slice ${isWorkshops ? "is-selected-slice" : ""}`}
                                                        style={{
                                                            opacity: isDimmed ? 0.35 : 1,
                                                            filter: isWorkshops
                                                                ? "drop-shadow(0 0 10px rgba(6, 182, 212, 0.75)) brightness(1.12)"
                                                                : isHovered
                                                                    ? "drop-shadow(0 2px 8px rgba(0,0,0,0.25)) brightness(1.08)"
                                                                    : "none",
                                                            transition: "all 0.2s ease",
                                                            cursor: "pointer",
                                                        }}
                                                        onClick={() => {
                                                            if (isChartInspectionOn) {
                                                                setPinnedComponentKey((prev) => (prev === seg.key ? null : seg.key));
                                                            } else if (onViewCategoryTable) {
                                                                onViewCategoryTable(seg.key);
                                                            }
                                                        }}
                                                    >
                                                        <title>{`${seg.label}: ${seg.pct}% (${formatCompactINR(seg.amount)})`}</title>
                                                    </circle>
                                                );
                                            })}
                                        </g>
                                    </svg>

                                    {/* Center badge */}
                                    <div className="budget-summary-donut-center compact">
                                        <span className="budget-summary-donut-amount">
                                            {amounts.workshops || formatCompactINR(workshopSeg?.amount ?? 0)}
                                        </span>
                                        <span className="budget-summary-donut-label">
                                            Workshops ({workshopSeg?.pct ?? 0}%)
                                        </span>
                                    </div>
                                </div>

                                {/* Top 3 Departments Callout Card on the side */}
                                <div className="budget-workshops-top3-card">
                                    <div className="budget-workshops-top3-header">
                                        <div className="budget-workshops-top3-header-left">
                                            <span className="budget-workshops-top3-badge">
                                                <GraduationCap size={13} />
                                                <span>Workshops</span>
                                            </span>
                                            <span className="budget-workshops-top3-title">Top 3 Departments</span>
                                        </div>
                                        {/* <span className="budget-workshops-top3-total">
                                            {amounts.workshops || formatCompactINR(workshopSeg?.amount ?? 0)}
                                        </span> */}
                                    </div>

                                    <div className="budget-workshops-top3-list">
                                        {top3WorkshopDepts.length === 0 ? (
                                            <div className="budget-callout-empty-msg">
                                                No workshop events recorded for {selectedPeriod}.
                                            </div>
                                        ) : (
                                            top3WorkshopDepts.map((dept) => {
                                                const rankColors = [
                                                    { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
                                                    { bg: "#E0F2FE", text: "#0284C7", border: "#BAE6FD" },
                                                    { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
                                                ];
                                                const rankStyle = rankColors[dept.rank - 1] || rankColors[2];

                                                return (
                                                    <div key={`ws-dept-${dept.rank}`} className="budget-workshops-top3-item">
                                                        <div className="budget-workshops-top3-item-top">
                                                            <div className="budget-workshops-top3-item-left">
                                                                <span
                                                                    className="budget-workshops-rank-badge"
                                                                    style={{
                                                                        backgroundColor: rankStyle.bg,
                                                                        color: rankStyle.text,
                                                                        borderColor: rankStyle.border,
                                                                    }}
                                                                >
                                                                    #{dept.rank}
                                                                </span>
                                                                <span className="budget-workshops-dept-name" title={dept.name}>
                                                                    {dept.shortName}
                                                                </span>
                                                            </div>
                                                            <div className="budget-workshops-top3-item-right">
                                                                <span className="budget-workshops-dept-spend">{dept.spendFormatted}</span>
                                                                <span className="budget-workshops-dept-pct">{dept.sharePct}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="budget-workshops-progress-track">
                                                            <div
                                                                className="budget-workshops-progress-bar"
                                                                style={{
                                                                    width: `${Math.max(dept.sharePct, dept.spend > 0 ? 5 : 0)}%`,
                                                                    backgroundColor:
                                                                        dept.rank === 1 ? "#06B6D4" : dept.rank === 2 ? "#38BDF8" : "#94A3B8",
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }))}
                                    </div>

                                    <div className="budget-workshops-top3-footer">
                                        <span>{counts.workshops ?? 0} Events Recorded</span>
                                        <span className="budget-workshops-footer-highlight">L&D Training Spend</span>
                                    </div>
                                </div>
                            </div>
                        ) : isCertsSelected ? (
                            /* Certifications Selected Mode: Donut Chart on Left with highlighted amber slice + Arrow + Top 3 Providers Callout */
                            <div className="budget-summary-certs-container">
                                <div className="budget-summary-donut-wrap compact" style={{ pointerEvents: "none", userSelect: "none" }}>
                                    <svg
                                        className="budget-summary-donut-svg"
                                        viewBox="0 0 200 200"
                                        width="180"
                                        height="180"
                                    >
                                        <g transform="rotate(-90 100 100)">
                                            <circle
                                                cx="100"
                                                cy="100"
                                                r={radius}
                                                fill="transparent"
                                                stroke="#F1F5F9"
                                                strokeWidth="40"
                                            />
                                            {streamSegments.map((seg) => {
                                                const isCerts = seg.key === "certifications";
                                                const isHovered = hoveredSliceKey ? hoveredSliceKey === seg.key : isCerts;
                                                const isDimmed = !isHovered;

                                                return (
                                                    <circle
                                                        key={seg.key}
                                                        cx="100"
                                                        cy="100"
                                                        r={radius}
                                                        fill="transparent"
                                                        stroke={seg.color}
                                                        strokeWidth={isCerts ? 44 : 40}
                                                        strokeDasharray={seg.strokeDasharray}
                                                        strokeDashoffset={seg.strokeDashoffset}
                                                        strokeLinecap="butt"
                                                        className={`budget-donut-slice ${isCerts ? "is-selected-slice-amber" : ""}`}
                                                        style={{
                                                            opacity: isDimmed ? 0.35 : 1,
                                                            filter: isCerts
                                                                ? "drop-shadow(0 0 10px rgba(245, 158, 11, 0.75)) brightness(1.12)"
                                                                : isHovered
                                                                    ? "drop-shadow(0 2px 8px rgba(0,0,0,0.25)) brightness(1.08)"
                                                                    : "none",
                                                            transition: "all 0.2s ease",
                                                            cursor: "pointer",
                                                        }}
                                                        onClick={() => {
                                                            if (isChartInspectionOn) {
                                                                setPinnedComponentKey((prev) => (prev === seg.key ? null : seg.key));
                                                            } else if (onViewCategoryTable) {
                                                                onViewCategoryTable(seg.key);
                                                            }
                                                        }}
                                                    >
                                                        <title>{`${seg.label}: ${seg.pct}% (${formatCompactINR(seg.amount)})`}</title>
                                                    </circle>
                                                );
                                            })}
                                        </g>
                                    </svg>

                                    <div className="budget-summary-donut-center compact">
                                        <span className="budget-summary-donut-amount">
                                            {amounts.certifications || formatCompactINR(certSeg?.amount ?? 0)}
                                        </span>
                                        <span className="budget-summary-donut-label">
                                            Certifications ({certSeg?.pct ?? 0}%)
                                        </span>
                                    </div>
                                </div>

                                {/* Top 3 Providers Callout Card on the right of the pie chart */}
                                <div className="budget-certs-top3-card">
                                    <div className="budget-certs-top3-header">
                                        <div className="budget-certs-top3-header-left">
                                            <span className="budget-certs-top3-badge">
                                                <Award size={13} />
                                                <span>Certifications</span>
                                            </span>
                                            <span className="budget-certs-top3-title">Top 3 Providers</span>
                                        </div>
                                        {/* <span className="budget-certs-top3-total">
                                            {amounts.certifications || formatCompactINR(certSeg?.amount ?? 0)}
                                        </span> */}
                                    </div>

                                    <div className="budget-certs-top3-list">
                                        {activeTop3Providers.length === 0 ? (
                                            <div className="budget-callout-empty-msg">
                                                No certification claims recorded for {selectedPeriod}.
                                            </div>
                                        ) : (
                                            activeTop3Providers.map((prov) => {
                                                const rankColors = [
                                                    { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
                                                    { bg: "#FFFBEB", text: "#B45309", border: "#FCD34D" },
                                                    { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
                                                ];
                                                const rankStyle = rankColors[prov.rank - 1] || rankColors[2];

                                                return (
                                                    <div key={`prov-${prov.rank}`} className="budget-certs-top3-item">
                                                        <div className="budget-certs-top3-item-top">
                                                            <div className="budget-certs-top3-item-left">
                                                                <span
                                                                    className="budget-certs-rank-badge"
                                                                    style={{
                                                                        backgroundColor: rankStyle.bg,
                                                                        color: rankStyle.text,
                                                                        borderColor: rankStyle.border,
                                                                    }}
                                                                >
                                                                    #{prov.rank}
                                                                </span>
                                                                <span className="budget-certs-prov-name" title={prov.name}>
                                                                    {prov.name}
                                                                </span>
                                                            </div>
                                                            <div className="budget-certs-top3-item-right">
                                                                <span className="budget-certs-prov-spend">{prov.spend_formatted || `₹${Number(prov.spend || 0).toLocaleString("en-IN")}`}</span>
                                                                <span className="budget-certs-prov-pct">{prov.percentage}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="budget-certs-progress-track">
                                                            <div
                                                                className="budget-certs-progress-bar"
                                                                style={{
                                                                    width: `${Math.max(prov.percentage, prov.spend > 0 ? 5 : 0)}%`,
                                                                    backgroundColor:
                                                                        prov.rank === 1 ? "#F59E0B" : prov.rank === 2 ? "#FBBF24" : "#FCD34D",
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }))}
                                    </div>

                                    <div className="budget-certs-top3-footer">
                                        <span>{counts.certifications ?? 0} Claims Disbursed</span>
                                        <span className="budget-certs-footer-highlight">Direct Exam Reimbursements</span>
                                    </div>
                                </div>
                            </div>
                        ) : isCoursesSelected ? (
                            /* Courses Selected Mode: Donut Chart on Left with highlighted purple slice + Arrow + Top 3 Course Providers Callout */
                            <div className="budget-summary-courses-container">
                                <div className="budget-summary-donut-wrap compact" style={{ pointerEvents: "none", userSelect: "none" }}>
                                    <svg
                                        className="budget-summary-donut-svg"
                                        viewBox="0 0 200 200"
                                        width="180"
                                        height="180"
                                    >
                                        <g transform="rotate(-90 100 100)">
                                            <circle
                                                cx="100"
                                                cy="100"
                                                r={radius}
                                                fill="transparent"
                                                stroke="#F1F5F9"
                                                strokeWidth="40"
                                            />
                                            {streamSegments.map((seg) => {
                                                const isCourses = seg.key === "courses";
                                                const isHovered = hoveredSliceKey ? hoveredSliceKey === seg.key : isCourses;
                                                const isDimmed = !isHovered;

                                                return (
                                                    <circle
                                                        key={seg.key}
                                                        cx="100"
                                                        cy="100"
                                                        r={radius}
                                                        fill="transparent"
                                                        stroke={seg.color}
                                                        strokeWidth={isCourses ? 44 : 40}
                                                        strokeDasharray={seg.strokeDasharray}
                                                        strokeDashoffset={seg.strokeDashoffset}
                                                        strokeLinecap="butt"
                                                        className={`budget-donut-slice ${isCourses ? "is-selected-slice-purple" : ""}`}
                                                        style={{
                                                            opacity: isDimmed ? 0.35 : 1,
                                                            filter: isCourses
                                                                ? "drop-shadow(0 0 10px rgba(139, 92, 246, 0.75)) brightness(1.12)"
                                                                : isHovered
                                                                    ? "drop-shadow(0 2px 8px rgba(0,0,0,0.25)) brightness(1.08)"
                                                                    : "none",
                                                            transition: "all 0.2s ease",
                                                            cursor: "pointer",
                                                        }}
                                                        onClick={() => {
                                                            if (isChartInspectionOn) {
                                                                setPinnedComponentKey((prev) => (prev === seg.key ? null : seg.key));
                                                            } else if (onViewCategoryTable) {
                                                                onViewCategoryTable(seg.key);
                                                            }
                                                        }}
                                                    >
                                                        <title>{`${seg.label}: ${seg.pct}% (${formatCompactINR(seg.amount)})`}</title>
                                                    </circle>
                                                );
                                            })}
                                        </g>
                                    </svg>

                                    <div className="budget-summary-donut-center compact">
                                        <span className="budget-summary-donut-amount">
                                            {amounts.courses || formatCompactINR(courseSeg?.amount ?? 0)}
                                        </span>
                                        <span className="budget-summary-donut-label">
                                            Courses ({courseSeg?.pct ?? 0}%)
                                        </span>
                                    </div>
                                </div>

                                {/* Top 3 Course Providers Callout Card on the right of the pie chart */}
                                <div className="budget-courses-top3-card">
                                    <div className="budget-courses-top3-header">
                                        <div className="budget-courses-top3-header-left">
                                            <span className="budget-courses-top3-badge">
                                                <BookOpen size={13} />
                                                <span>Courses</span>
                                            </span>
                                            <span className="budget-courses-top3-title">Top 3 Providers</span>
                                        </div>
                                        {/* <span className="budget-courses-top3-total">
                                            {amounts.courses || formatCompactINR(courseSeg?.amount ?? 0)}
                                        </span> */}
                                    </div>

                                    <div className="budget-courses-top3-list">
                                        {activeTop3CourseProviders.length === 0 ? (
                                            <div className="budget-callout-empty-msg">
                                                No course purchases recorded for {selectedPeriod}.
                                            </div>
                                        ) : (
                                            activeTop3CourseProviders.map((prov) => {
                                                const rankColors = [
                                                    { bg: "#F3E8FF", text: "#7C3AED", border: "#DDD6FE" },
                                                    { bg: "#F5F3FF", text: "#6D28D9", border: "#EDE9FE" },
                                                    { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
                                                ];
                                                const rankStyle = rankColors[prov.rank - 1] || rankColors[2];

                                                return (
                                                    <div key={`course-prov-${prov.rank}`} className="budget-courses-top3-item">
                                                        <div className="budget-courses-top3-item-top">
                                                            <div className="budget-courses-top3-item-left">
                                                                <span
                                                                    className="budget-courses-rank-badge"
                                                                    style={{
                                                                        backgroundColor: rankStyle.bg,
                                                                        color: rankStyle.text,
                                                                        borderColor: rankStyle.border,
                                                                    }}
                                                                >
                                                                    #{prov.rank}
                                                                </span>
                                                                <span className="budget-courses-prov-name" title={prov.name}>
                                                                    {prov.name}
                                                                </span>
                                                            </div>
                                                            <div className="budget-courses-top3-item-right">
                                                                <span className="budget-courses-prov-spend">{prov.spend_formatted || `₹${Number(prov.spend || 0).toLocaleString("en-IN")}`}</span>
                                                                <span className="budget-courses-prov-pct">{prov.percentage}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="budget-courses-progress-track">
                                                            <div
                                                                className="budget-courses-progress-bar"
                                                                style={{
                                                                    width: `${Math.max(prov.percentage, prov.spend > 0 ? 5 : 0)}%`,
                                                                    backgroundColor:
                                                                        prov.rank === 1 ? "#8B5CF6" : prov.rank === 2 ? "#A78BFA" : "#C4B5FD",
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }))}
                                    </div>

                                    <div className="budget-courses-top3-footer">
                                        <span>{counts.courses ?? 0} Courses Enrolled</span>
                                        <span className="budget-courses-footer-highlight">Enterprise Platform Subscriptions</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Default Streams Donut Chart */
                            <div className="budget-summary-donut-wrap" style={{ pointerEvents: "none", userSelect: "none" }}>
                                <svg
                                    className="budget-summary-donut-svg"
                                    viewBox="0 0 200 200"
                                    width="200"
                                    height="200"
                                >
                                    <g transform="rotate(-90 100 100)">
                                        <circle
                                            cx="100"
                                            cy="100"
                                            r={radius}
                                            fill="transparent"
                                            stroke="#F1F5F9"
                                            strokeWidth="40"
                                        />
                                        {streamSegments.map((seg) => {
                                            const isHovered = hoveredSlice ? hoveredSlice.key === seg.key : false;
                                            const isDimmed = Boolean(hoveredSlice && !isHovered);

                                            return (
                                                <circle
                                                    key={seg.key}
                                                    cx="100"
                                                    cy="100"
                                                    r={radius}
                                                    fill="transparent"
                                                    stroke={seg.color}
                                                    strokeWidth={isHovered ? 44 : 40}
                                                    strokeDasharray={seg.strokeDasharray}
                                                    strokeDashoffset={seg.strokeDashoffset}
                                                    strokeLinecap="butt"
                                                    className="budget-donut-slice"
                                                    style={{
                                                        opacity: isDimmed ? 0.35 : 1,
                                                        filter: isHovered
                                                            ? "drop-shadow(0 2px 8px rgba(0,0,0,0.25)) brightness(1.08)"
                                                            : "none",
                                                        transition: "stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease",
                                                        cursor: "pointer",
                                                    }}
                                                    onClick={() => {
                                                        if (isChartInspectionOn) {
                                                            setPinnedComponentKey((prev) => (prev === seg.key ? null : seg.key));
                                                            setHoveredSliceKey(null);
                                                        } else if (onViewCategoryTable) {
                                                            onViewCategoryTable(seg.key);
                                                        }
                                                    }}
                                                >
                                                    <title>{`${seg.label}: ${seg.pct}% (${formatCompactINR(seg.amount)})`}</title>
                                                </circle>
                                            );
                                        })}
                                    </g>
                                </svg>

                                <div className="budget-summary-donut-center">
                                    <span className="budget-summary-donut-amount">
                                        {hoveredSlice
                                            ? formatCompactINR(hoveredSlice.amount)
                                            : formatCompactINR(totalSpent)}
                                    </span>
                                    <span className="budget-summary-donut-label">
                                        {hoveredSlice
                                            ? `${hoveredSlice.shortLabel} (${hoveredSlice.pct}%)`
                                            : "Total YTD Spend"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Div: Components List Inside Div Tag */}
                <div className="budget-summary-right-pane">
                    <div className="budget-components-side-list">
                        {componentItems.map((comp) => {
                            const Icon = comp.icon;
                            const isCardHovered = hoveredKey === comp.key;
                            const isCardPinned = isChartInspectionOn && pinnedComponentKey === comp.key;

                            return (
                                <div
                                    key={comp.key}
                                    className={`budget-component-row-card ${isCardHovered ? "hovered" : ""} ${isCardPinned ? "is-pinned" : ""}`}
                                    onClick={() => handleCardClick(comp.key)}
                                    onMouseEnter={() => {
                                        setHoveredKey(comp.key);
                                        setHoveredSliceKey(null);
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredKey(null);
                                        setHoveredSliceKey(null);
                                    }}
                                    title={
                                        isChartInspectionOn
                                            ? `Chart View Mode ON: Click to ${isCardPinned ? "unpin" : "pin & view"} ${comp.title} chart breakdown`
                                            : `Click to view ${comp.title} table`
                                    }
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="budget-component-row-left">
                                        <div
                                            className="budget-component-row-icon"
                                            style={{ backgroundColor: comp.bgColor, color: comp.color }}
                                        >
                                            <Icon size={18} />
                                        </div>
                                        <div className="budget-component-row-info">
                                            <span className="budget-component-row-title">{comp.title}</span>
                                            <span className="budget-component-row-sub">
                                                {comp.count} • {comp.highlight}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="budget-component-row-right">
                                        <span className="budget-component-row-amount">{comp.amount}</span>
                                        <span
                                            className="budget-component-row-badge"
                                            style={{
                                                backgroundColor: comp.bgColor,
                                                color: comp.color,
                                                border: `1px solid ${comp.color}40`,
                                            }}
                                        >
                                            {comp.budgetShare}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
