import React, { useRef } from "react";
import { RANK_COLORS } from "../../../services/leaderboardService";
import { useAuth } from "../../../context/AuthContext";
import useLeaderboardScrollFit from "../../../hooks/useLeaderboardScrollFit";

const getLeaderboardPageRowCount = (listHeight) => Math.max(10, Math.round(listHeight / 43));

const TeamLeaderboard = ({ data = [], isLoading = false }) => {
    const { user } = useAuth();
    const activeUserId = (user?.employee_id || user?.id || user?.emp_id || "").toLowerCase();

    const rawList = data || [];
    const listRef = useRef(null);

    const { displayedList, rowStyleVars, handleScroll } = useLeaderboardScrollFit({
        rawList,
        activeUserId,
        listRef,
        baseRowHeight: 43,
        currentRowHeightOffset: 0,
        getRowCount: getLeaderboardPageRowCount,
    });

    return (
        <div className="emp-leaderboard-card emp-team-leaderboard-card">
            <h3 className="emp-leaderboard-card-title">Team Leaderboard</h3>
            <div
                className="emp-team-leaderboard-list"
                ref={listRef}
                style={rowStyleVars}
                onScroll={handleScroll}
            >
                {isLoading ? (
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <div key={`leaderboard-skel-${i}`} className="emp-team-leaderboard-row" style={{ opacity: 0.85 }}>
                            <div className="emp-leaderboard-rank-num">
                                <span className="ld-skeleton-block" style={{ width: 14, height: 14, borderRadius: 3 }} />
                            </div>
                            <div className="ld-skeleton-circle" style={{ width: 32, height: 32, margin: '0 10px', flexShrink: 0 }} />
                            <div className="emp-leaderboard-user-details">
                                <span className="ld-skeleton-block" style={{ width: 110, height: 14, borderRadius: 4, marginBottom: 4 }} />
                                <span className="ld-skeleton-block" style={{ width: 70, height: 12, borderRadius: 3 }} />
                            </div>
                            <div className="emp-leaderboard-user-hours">
                                <span className="ld-skeleton-block" style={{ width: 35, height: 14, borderRadius: 4 }} />
                            </div>
                            <div className="emp-leaderboard-user-points">
                                <span className="ld-skeleton-block" style={{ width: 50, height: 14, borderRadius: 4 }} />
                            </div>
                        </div>
                    ))
                ) : displayedList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: "14px" }}>
                        No leaderboard records found.
                    </div>
                ) : (
                    displayedList.map((item, index) => {
                        const isNextCurrentUser = Boolean(displayedList[index + 1]?.isCurrentUser || displayedList[index + 1]?.currentUser);
                        const isCurrentUser = Boolean(item.isCurrentUser || item.currentUser);
                        const rankNum = item.rank || (index + 1);
                        const avatarColor = item.avatarBg || RANK_COLORS[(rankNum - 1) % RANK_COLORS.length] || "#F5A623";

                        const formattedPoints = typeof item.points === "number"
                            ? `${item.points.toLocaleString()} pts`
                            : (String(item.points || "0").includes("pts") ? item.points : `${item.points || 0} pts`);

                        return (
                            <div
                                key={item._rowKey || item.id || item.employee_id || rankNum}
                                className={`emp-team-leaderboard-row ${isCurrentUser ? "emp-current-user-row" : ""} ${isNextCurrentUser ? "emp-prev-to-current-user" : ""}`}
                            >
                                {/* RANK NUMBER */}
                                <div className="emp-leaderboard-rank-num">
                                    {rankNum}
                                </div>

                                {/* AVATAR */}
                                <div
                                    className="emp-leaderboard-avatar"
                                    style={{ backgroundColor: avatarColor }}
                                >
                                    {item.initials || "EM"}
                                </div>

                                {/* NAME & DEPARTMENT */}
                                <div className="emp-leaderboard-user-details">
                                    <span className="emp-leaderboard-user-name">
                                        {item.name}
                                    </span>
                                    <span className="emp-leaderboard-user-role" title={item.department || item.role}>
                                        {item.department || item.role}
                                    </span>
                                </div>

                                {/* HOURS */}
                                <div className="emp-leaderboard-user-hours">
                                    {item.hours}
                                </div>

                                {/* POINTS */}
                                <div className="emp-leaderboard-user-points">
                                    {formattedPoints}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TeamLeaderboard;
