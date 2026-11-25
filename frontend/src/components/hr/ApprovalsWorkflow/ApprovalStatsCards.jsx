import React from "react";

import pendingIcon from "../../../assets/Approvals & Workflow/pending.svg";
import pendingBg from "../../../assets/Approvals & Workflow/background.svg";

import courseIcon from "../../../assets/Approvals & Workflow/course.svg";
import courseBg from "../../../assets/Approvals & Workflow/course background.svg";

import certIcon from "../../../assets/Approvals & Workflow/certificate.svg";
import certBg from "../../../assets/Approvals & Workflow/certificate background.svg";

import totalApprovedIcon from "../../../assets/Approvals & Workflow/Total Approved.svg";
import totalApprovedBg from "../../../assets/Approvals & Workflow/Total Approved background.svg";

import bluebiglineSvg from "../../../assets/Certification/bluebigline.svg";

const CARD_ASSETS = {
    pending: {
        icon: pendingIcon,
        bg: pendingBg,
        iconWidth: 20,
        iconHeight: 20,
    },
    courseReq: {
        icon: courseIcon,
        bg: courseBg,
        iconWidth: 20,
        iconHeight: 20,
    },
    certReq: {
        icon: certIcon,
        bg: certBg,
        iconWidth: 20,
        iconHeight: 20,
    },
    approved: {
        icon: totalApprovedIcon,
        bg: totalApprovedBg,
        iconWidth: 20,
        iconHeight: 20,
    },
};

export default function ApprovalStatsCards({ stats = [] }) {
    return (
        <div className="hr-aw-stats-grid">
            {stats.map((s) => {
                const asset = CARD_ASSETS[s.key] || CARD_ASSETS.pending;

                return (
                    <div key={s.key} className="hr-aw-stat-card">
                        <div
                            className="hr-aw-stat-icon-wrap"
                            style={{
                                backgroundImage: `url("${asset.bg}")`,
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
                                src={asset.icon}
                                alt={s.label}
                                style={{
                                    width: `${asset.iconWidth}px`,
                                    height: `${asset.iconHeight}px`,
                                    display: "block",
                                }}
                            />
                        </div>

                        <div className="hr-aw-stat-body">
                            <div className="hr-aw-stat-value">
                                {s.value !== null && s.value !== undefined ? (
                                    s.value
                                ) : (
                                    <span className="ld-skeleton-block" style={{ width: 36, height: 22, display: "inline-block" }} />
                                )}
                            </div>
                            <div className="hr-aw-stat-label" title={s.label}>
                                {s.label}
                                {s.suffix && (
                                    <span className="hr-aw-stat-suffix">{s.suffix}</span>
                                )}
                            </div>
                        </div>

                        {/* Bottom accent line */}
                        <img
                            src={bluebiglineSvg}
                            alt=""
                            className="hr-aw-stat-bottom-line"
                        />
                    </div>
                );
            })}
        </div>
    );
}
