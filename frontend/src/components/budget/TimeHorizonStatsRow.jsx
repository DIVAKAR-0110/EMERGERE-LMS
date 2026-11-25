import React from "react";

import pendingIcon from "../../assets/Approvals & Workflow/pending.svg";
import pendingBg from "../../assets/Approvals & Workflow/background.svg";

import courseIcon from "../../assets/Approvals & Workflow/course.svg";
import courseBg from "../../assets/Approvals & Workflow/course background.svg";

import certIcon from "../../assets/Approvals & Workflow/certificate.svg";
import certBg from "../../assets/Approvals & Workflow/certificate background.svg";

import totalApprovedIcon from "../../assets/Approvals & Workflow/Total Approved.svg";
import totalApprovedBg from "../../assets/Approvals & Workflow/Total Approved background.svg";

import bluebiglineSvg from "../../assets/Certification/bluebigline.svg";

export default function TimeHorizonStatsRow({ stats = {}, isLoading = false }) {
    const cardsConfig = [
        {
            key: "this_month",
            label: stats?.this_month?.label || "Spent This Month",
            value: stats?.this_month?.amount_formatted || "₹0",
            icon: pendingIcon,
            bg: pendingBg,
        },
        {
            key: "quarterly",
            label: stats?.quarterly?.label || "Quarterly Spent",
            value: stats?.quarterly?.amount_formatted || stats?.this_year?.amount_formatted || "₹0",
            icon: courseIcon,
            bg: courseBg,
        },
        {
            key: "this_year",
            label: stats?.this_year?.label || "Spent This Year",
            value: stats?.this_year?.amount_formatted || stats?.last_year?.amount_formatted || "₹0",
            icon: certIcon,
            bg: certBg,
        },
        {
            key: "all_time",
            label: stats?.all_time?.label || "All-Time LMS Investment",
            value: stats?.all_time?.amount_formatted || "₹0",
            icon: totalApprovedIcon,
            bg: totalApprovedBg,
        },
    ];

    return (
        <div className="ld-aw-stats-grid budget-aligned-stats-grid">
            {cardsConfig.map((card) => (
                <div key={card.key} className="ld-aw-stat-card">
                    <div
                        className="ld-aw-stat-icon-wrap"
                        style={{
                            backgroundImage: `url("${card.bg}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <img
                            src={card.icon}
                            alt={card.label}
                            style={{
                                width: "20px",
                                height: "20px",
                                display: "block",
                            }}
                        />
                    </div>

                    <div className="ld-aw-stat-body">
                        <div className="ld-aw-stat-value">
                            {isLoading ? (
                                <span
                                    className="ld-skeleton-block"
                                    style={{ width: "80px", height: "22px", display: "inline-block" }}
                                />
                            ) : (
                                card.value
                            )}
                        </div>
                        <div className="ld-aw-stat-label">
                            {isLoading ? (
                                <span
                                    className="ld-skeleton-block"
                                    style={{ width: "95px", height: "13px", display: "inline-block" }}
                                />
                            ) : (
                                card.label
                            )}
                        </div>
                    </div>

                    {/* Bottom accent line matching Approvals & Workflow */}
                    <img
                        src={bluebiglineSvg}
                        alt=""
                        className="ld-aw-stat-bottom-line"
                    />
                </div>
            ))}
        </div>
    );
}
