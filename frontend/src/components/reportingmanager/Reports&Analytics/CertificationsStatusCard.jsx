import React, { useState, useEffect } from "react";
import trophy from "../../../assets/reportsanalytics/trophy.svg";
import calendar from "../../../assets/reportsanalytics/calendar.svg";
import bottomleft from "../../../assets/reportsanalytics/bottom-left.svg";
import clock from "../../../assets/reportsanalytics/clock.svg";
import { fetchTeamCertificationsStatus } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

export default function CertificationsStatusCard() {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [statusData, setStatusData] = useState({
        earned: 0,
        expiring_soon: 0,
        requested: 0,
        claimed: 0,
        earned_breakdown: [],
        requested_breakdown: [],
        claimed_breakdown: [],
    });

    useEffect(() => {
        let isMounted = true;
        const loadStatus = async () => {
            setIsLoading(true);
            try {
                const res = await fetchTeamCertificationsStatus(token);
                if (isMounted && res) {
                    setStatusData(res);
                }
            } catch (err) {
                console.error("Failed to load team certifications status:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadStatus();
        return () => {
            isMounted = false;
        };
    }, [token]);

    const getTooltip = (itemType) => {
        if (itemType === "earned") {
            if (statusData.earned_breakdown && statusData.earned_breakdown.length > 0) {
                return statusData.earned_breakdown.map((b) => `${b.name}: ${b.count}`).join(", ");
            }
            return "Active certifications earned by your team";
        }
        if (itemType === "expiring_soon") {
            return "Certifications expiring within 60 days";
        }
        if (itemType === "requested") {
            if (statusData.requested_breakdown && statusData.requested_breakdown.length > 0) {
                return statusData.requested_breakdown.map((b) => `${b.name}: ${b.count}`).join(", ");
            }
            return "Pending certification requests";
        }
        if (itemType === "claimed") {
            if (statusData.claimed_breakdown && statusData.claimed_breakdown.length > 0) {
                return statusData.claimed_breakdown.map((b) => `${b.name}: ${b.count}`).join(", ");
            }
            return "Approved reimbursement claims";
        }
        return "";
    };

    const certStatuses = [
        {
            id: 1,
            type: "earned",
            label: "Earned",
            value: (isLoading || statusData.earned == null) ? null : String(statusData.earned),
            theme: "rm-ra-cert-earned",
            icon: trophy,
            iconBg: "#D7FFE5",
        },
        {
            id: 2,
            type: "expiring_soon",
            label: "Expiring Soon",
            value: (isLoading || statusData.expiring_soon == null) ? null : String(statusData.expiring_soon),
            theme: "rm-ra-cert-expiring",
            icon: calendar,
            iconBg: "#FFF5CE",
        },
        {
            id: 3,
            type: "requested",
            label: "Requested",
            value: (isLoading || statusData.requested == null) ? null : String(statusData.requested),
            theme: "rm-ra-cert-requested",
            icon: clock,
            iconBg: "#ECE8FF",
        },
        {
            id: 4,
            type: "claimed",
            label: "Claimed",
            value: (isLoading || statusData.claimed == null) ? null : String(statusData.claimed),
            theme: "rm-ra-cert-claimed",
            icon: bottomleft,
            iconBg: "#D6E7FF",
            style: {
                width: "12px",
                height: "12px",
            },
        },
    ];

    return (
        <div className="rm-ra-card rm-ra-card-cert-status">
            <h3 className="rm-ra-card-title">Certifications Status</h3>

            <div className="rm-ra-cert-status-grid">
                {certStatuses.map((item) => (
                    <div
                        key={item.id}
                        className={`rm-ra-cert-status-box ${item.theme}`}
                        title={getTooltip(item.type)}
                    >
                        <div
                            className="rm-ra-cert-status-icon-circle"
                            style={{ backgroundColor: item.iconBg }}
                        >
                            <img
                                src={item.icon}
                                alt={item.label}
                                className="rm-ra-cert-status-icon-img"
                                style={item.style}
                            />
                        </div>
                        <span className="rm-ra-cert-status-val">
                            {item.value !== null ? (
                                item.value
                            ) : (
                                <span
                                    className="ld-skeleton-block"
                                    style={{ width: 36, height: 22, display: "inline-block", borderRadius: 4 }}
                                />
                            )}
                        </span>
                        <span className="rm-ra-cert-status-lbl">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}