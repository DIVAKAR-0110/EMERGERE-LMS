import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import eyeIcon from '../../../assets/Dashboard/eye.svg';
import { fetchLeaderboardData, RANK_COLORS } from '../../../services/leaderboardService';
import { useAuth } from '../../../context/AuthContext';
import useLeaderboardScrollFit from '../../../hooks/useLeaderboardScrollFit';

const getDashboardLeaderboardRowCount = (listHeight) => {
    const vh = window.innerHeight;
    if (vh < 685) return 10;
    if (vh <= 775) return 12;
    return Math.max(12, Math.round(listHeight / 36.5));
};

const TeamLeaderboard = ({ data = null, isLoading = false }) => {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [liveData, setLiveData] = useState(null);

    useEffect(() => {
        if (isLoading || (data && data.length > 0)) return;

        const controller = new AbortController();
        let isMounted = true;
        const loadLeaderboard = async () => {
            try {
                const activeEmpId = user?.employee_id || user?.id || user?.emp_id;
                const res = await fetchLeaderboardData("All Time", token, activeEmpId, {
                    signal: controller.signal,
                });
                if (isMounted && !controller.signal.aborted && res?.leaderboard?.length) {
                    setLiveData(res.leaderboard);
                }
            } catch (err) {
                if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || controller.signal.aborted) {
                    return;
                }
                console.warn("[Dashboard TeamLeaderboard] Fetch notice:", err);
            }
        };

        loadLeaderboard();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [data, isLoading, token, user]);

    const activeUserId = (user?.employee_id || user?.id || user?.emp_id || "").toLowerCase();

    // Priority: passed data -> fetched liveData -> empty array
    const rawList = (data && data.length > 0) ? data : (liveData || []);

    const listRef = useRef(null);
    const { displayedList, rowStyleVars, handleScroll } = useLeaderboardScrollFit({
        rawList,
        activeUserId,
        listRef,
        baseRowHeight: 36.5,
        currentRowHeightOffset: 4,
        getRowCount: getDashboardLeaderboardRowCount,
    });

    return (
        <div className="emp-dashboard-card emp-team-leaderboard-card">
            <div className="emp-dashboard-card-header-row">
                <h3 className="emp-dashboard-card-title">Team Leaderboard</h3>
            </div>

            <div
                className="emp-team-leaderboard-rows-list"
                ref={listRef}
                style={rowStyleVars}
                onScroll={handleScroll}
            >
                {isLoading || (data === null && liveData === null) ? (
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <div className="emp-leaderboard-entry-row" key={n} style={{ alignItems: "center" }}>
                            <div className="emp-entry-left-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span className="ld-skeleton-block" style={{ width: 22, height: 22, borderRadius: 4 }} />
                                <span className="ld-skeleton-circle" style={{ width: 34, height: 34, borderRadius: "50%" }} />
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span className="ld-skeleton-block" style={{ width: 90, height: 14 }} />
                                    <span className="ld-skeleton-block" style={{ width: 60, height: 10 }} />
                                </div>
                            </div>
                            <div className="emp-entry-stats" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                <span className="ld-skeleton-block" style={{ width: 40, height: 12 }} />
                                <span className="ld-skeleton-block" style={{ width: 48, height: 14 }} />
                            </div>
                        </div>
                    ))
                ) : displayedList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B", fontSize: "13px" }}>
                        No leaderboard data available.
                    </div>
                ) : (
                    displayedList.map((item, idx) => {
                        const rankNum = item.rank || (idx + 1);
                        const color = item.avatarBg || RANK_COLORS[(rankNum - 1) % RANK_COLORS.length] || "#F5A623";

                        const isUser = Boolean(
                            item.currentUser ||
                            item.isCurrentUser ||
                            (item.employee_id && item.employee_id.toLowerCase() === activeUserId)
                        );

                        const formattedPoints = typeof item.points === "number"
                            ? `${item.points.toLocaleString()} pts`
                            : (String(item.points || "0").includes("pts") ? item.points : `${item.points || 0} pts`);

                        return (
                            <div
                                className={`emp-leaderboard-entry-row ${isUser ? "is-current-user" : ""}`}
                                key={item._rowKey || item.id || item.employee_id || rankNum}
                            >
                                <div className="emp-entry-left-group">
                                    <span className="emp-entry-rank">{rankNum}</span>

                                    <div
                                        className="emp-entry-avatar"
                                        style={{ backgroundColor: color }}
                                    >
                                        {item.initials || "EM"}
                                    </div>

                                    <div className="emp-entry-user-info">
                                        <span className="emp-entry-name">{item.name}</span>
                                        <span className="emp-entry-role" title={item.department || item.role}>{item.department || item.role}</span>
                                    </div>
                                </div>

                                <div className="emp-entry-stats">
                                    <span className="emp-entry-hours">{item.hours}</span>
                                    <span className="emp-entry-points">{formattedPoints}</span>
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
