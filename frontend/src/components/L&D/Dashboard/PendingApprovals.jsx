import React from "react";
import courtsApprovalIcon from "../../../assets/L&D/courtsapproval.svg";
import approvalBg from "../../../assets/L&D/approvalbackground.svg";
import clockIcon from "../../../assets/L&D/Group.svg";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

export default function PendingApprovals({
    approvals = null,
    isLoading = false,
    onApprove,
    onReject,
    onView,
    onViewAll,
}) {
    const isWaiting = isLoading || approvals === null;
    const cardRef = React.useRef(null);

    // Only the last 4 pending approvals sorted by creation time / id descending
    const displayedApprovals = React.useMemo(() => {
        if (!Array.isArray(approvals)) return [];
        return [...approvals]
            .sort((a, b) => {
                const timeA = a.raw?.created_at ? new Date(a.raw.created_at).getTime() : 0;
                const timeB = b.raw?.created_at ? new Date(b.raw.created_at).getTime() : 0;
                if (timeB !== timeA) return timeB - timeA;
                const idA = Number(a.new_course_id || a.requestId || a.id) || 0;
                const idB = Number(b.new_course_id || b.requestId || b.id) || 0;
                return idB - idA;
            })
            .slice(0, 4);
    }, [approvals]);

    return (
        <div
            ref={cardRef}
            className="ld-section-card ld-approvals-card"
        >
            <div className="ld-section-header">
                <h3 className="ld-section-title">Pending Approvals</h3>
                <button
                    type="button"
                    className="ld-btn-view-all"
                    onClick={onViewAll}
                >
                    <img
                        src={blueEyeIcon}
                        alt=""
                        style={{ width: "11px", height: "9px", display: "block" }}
                    />
                    View All
                </button>
            </div>

            <div
                className="ld-approvals-list"
                style={!isWaiting && displayedApprovals.length === 0 ? { justifyContent: "center", height: "100%" } : undefined}
            >
                {isWaiting ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="ld-approval-item ld-table-skeleton-row">
                            <div className="ld-approval-left">
                                <div className="ld-skeleton-circle" style={{ width: 30, height: 30, borderRadius: 6 }} />
                                <div className="ld-approval-info" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
                                    <span className="ld-skeleton-block" style={{ width: 110, height: 12 }} />
                                    <span className="ld-skeleton-block" style={{ width: 180, height: 10 }} />
                                </div>
                            </div>
                            <div className="ld-approval-date">
                                <span className="ld-skeleton-block" style={{ width: 110, height: 12 }} />
                            </div>
                            <div className="ld-approval-view-col">
                                <span className="ld-skeleton-block" style={{ width: 44, height: 20, borderRadius: 4 }} />
                            </div>
                        </div>
                    ))
                ) : displayedApprovals.length === 0 ? (
                    <div
                        className="ld-empty-state-card"
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "140px",
                            height: "100%",
                            textAlign: "center",
                            color: "#7f7f7f",
                            fontSize: "13px",
                            fontWeight: "500",
                        }}
                    >
                        <img
                            src={openBookIcon}
                            alt="No pending approvals"
                            className="ld-empty-state-icon"
                            style={{ width: "56px", height: "42px", objectFit: "contain", marginBottom: "8px", opacity: 0.8 }}
                        />
                        <span>No pending approvals recorded yet.</span>
                    </div>
                ) : (
                    displayedApprovals.map((item) => (
                        <div key={item.id} className="ld-approval-item">
                            <div className="ld-approval-left">
                                <div
                                    className="ld-approval-icon-box"
                                    style={{
                                        backgroundImage: `url(${approvalBg})`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                    }}
                                >
                                    <img
                                        src={courtsApprovalIcon}
                                        alt="Request Icon"
                                        style={{ width: "18px", height: "18px", display: "block" }}
                                    />
                                </div>
                                <div className="ld-approval-info">
                                    <span className="ld-approval-title">{item.type}</span>
                                    <span className="ld-approval-detail" title={`${item.name} · ${item.detail}`}>
                                        {item.name} · {item.detail}
                                    </span>
                                    {/* {item.amount && item.amount !== "—" && item.amount !== "₹0" && item.amount !== "0" && (
                                        <span className="ld-approval-amount">
                                            {item.amount}
                                        </span>
                                    )} */}
                                </div>
                            </div>

                            <div className="ld-approval-date">
                                <img
                                    src={clockIcon}
                                    alt="Requested time"
                                    style={{ width: "15px", height: "15px", display: "block" }}
                                />
                                <span>Requested on {item.date}</span>
                            </div>

                            <div className="ld-approval-view-col">
                                <button
                                    type="button"
                                    className="ld-btn-view"
                                    title="View Details"
                                    aria-label="View Details"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onView(item);
                                    }}
                                >
                                    <img
                                        src={blueEyeIcon}
                                        alt=""
                                        style={{ width: "11px", height: "9px", display: "block" }}
                                    />
                                    View
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
