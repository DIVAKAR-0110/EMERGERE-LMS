import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchLeaderboardData, RANK_COLORS } from "../../../services/leaderboardService";
import { useAuth } from "../../../context/AuthContext";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

export default function TopPerformers({ performers = null }) {
  const [livePerformers, setLivePerformers] = useState(null);
  const [thumbOffset, setThumbOffset] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const { token } = useAuth();

  const listRef = useRef(null);
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

  const THUMB_HEIGHT = 80;

  useEffect(() => {
    if (performers && performers.length > 0) return;

    let isMounted = true;
    const loadTopPerformers = async () => {
      try {
        const res = await fetchLeaderboardData("All Time", token);
        if (isMounted) {
          if (Array.isArray(res?.leaderboard)) {
            setLivePerformers(res.leaderboard);
          } else if (Array.isArray(res)) {
            setLivePerformers(res);
          } else {
            setLivePerformers([]);
          }
        }
      } catch (err) {
        console.warn("[CEO TopPerformers] Live fetch notice:", err);
        if (isMounted) setLivePerformers([]);
      }
    };

    loadTopPerformers();
    return () => { isMounted = false; };
  }, [performers, token]);

  const allPerformers = Array.isArray(performers) && performers.length > 0
    ? performers
    : (Array.isArray(livePerformers) ? livePerformers : []);

  const checkOverflow = useCallback(() => {
    if (listRef.current) {
      const { scrollHeight, clientHeight } = listRef.current;
      setHasOverflow(scrollHeight > clientHeight + 2);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [allPerformers, checkOverflow]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxScroll = scrollHeight - clientHeight;
    const maxTravel = Math.max(0, clientHeight - THUMB_HEIGHT);
    if (maxScroll > 0) {
      setThumbOffset((scrollTop / maxScroll) * maxTravel);
    } else {
      setThumbOffset(0);
    }
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartOffsetRef.current = thumbOffset;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !listRef.current) return;
    const deltaY = e.clientY - dragStartYRef.current;
    const clientHeight = listRef.current.clientHeight;
    const scrollHeight = listRef.current.scrollHeight;
    const maxTravel = Math.max(0, clientHeight - THUMB_HEIGHT);
    const maxScroll = scrollHeight - clientHeight;
    if (maxTravel <= 0 || maxScroll <= 0) return;

    const newOffset = Math.max(0, Math.min(maxTravel, dragStartOffsetRef.current + deltaY));
    setThumbOffset(newOffset);
    listRef.current.scrollTop = (newOffset / maxTravel) * maxScroll;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  const handleTrackClick = (e) => {
    if (e.target === thumbRef.current) return;
    if (!trackRef.current || !listRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clientHeight = listRef.current.clientHeight;
    const scrollHeight = listRef.current.scrollHeight;
    const maxTravel = Math.max(0, clientHeight - THUMB_HEIGHT);
    const maxScroll = scrollHeight - clientHeight;
    if (maxTravel <= 0 || maxScroll <= 0) return;

    const targetOffset = Math.max(0, Math.min(maxTravel, clickY - THUMB_HEIGHT / 2));
    setThumbOffset(targetOffset);
    listRef.current.scrollTop = (targetOffset / maxTravel) * maxScroll;
  };

  return (
    <div className="ceo-dashboard-card ceo-top-performers-card">
      <div className="ceo-card-header-row">
        <h3 className="ceo-card-title">Top Learners</h3>
      </div>

      <div className="ceo-performers-body">
        <div className={`ceo-performers-list ${allPerformers.length === 0 ? "is-empty" : ""}`} ref={listRef} onScroll={handleScroll}>
          {allPerformers.length === 0 ? (
            <div className="ceo-empty-performers-state">
              <img src={openBookIcon} alt="" className="ceo-empty-performers-icon" />
              <span>No top learners recorded yet.</span>
            </div>
          ) : (
            allPerformers.map((p, idx) => {
              const rankNum = p.rank || (idx + 1);
              const color = p.bg || p.avatarBg || RANK_COLORS[(rankNum - 1) % RANK_COLORS.length] || "#F5A623";
              const formattedPoints = typeof p.points === "number"
                ? `${p.points.toLocaleString()} pts`
                : (String(p.points || "0").includes("pts") ? p.points : `${p.points || 0} pts`);

              return (
                <div
                  key={`${rankNum}-${p.employee_id || idx}`}
                  className="ceo-performer-row"
                >
                  <span className="ceo-performer-rank">{rankNum}</span>

                  <div
                    className="ceo-performer-avatar"
                    style={{ backgroundColor: color }}
                  >
                    {p.initials || "EM"}
                  </div>

                  <div className="ceo-performer-info">
                    <div className="ceo-performer-name">{p.name}</div>
                    <div className="ceo-performer-role">{p.department}</div>
                  </div>

                  <span className="ceo-performer-hours">{p.hours}</span>
                  <span className="ceo-performer-pts">{formattedPoints}</span>
                </div>
              );
            })
          )}
        </div>

        {hasOverflow && (
          <div
            className="ceo-performers-scroll-track"
            ref={trackRef}
            onClick={handleTrackClick}
            title="Scroll"
          >
            <div
              className="ceo-performers-scroll-thumb"
              ref={thumbRef}
              style={{
                transform: `translateY(${thumbOffset}px)`,
              }}
              onPointerDown={handlePointerDown}
            />
          </div>
        )}
      </div>
    </div>
  );
}
