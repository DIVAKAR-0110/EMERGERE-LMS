import { useState, useEffect, useMemo } from "react";

/**
 * Dynamically fits whole leaderboard rows inside the desktop scroll viewport
 * and enables immediate, uninterrupted wheel scrolling out of the pinned view.
 */
export default function useLeaderboardScrollFit({
    rawList = [],
    activeUserId = "",
    listRef,
    baseRowHeight = 40,
    currentRowHeightOffset = 0,
    getRowCount = null,
}) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [visibleRowCount, setVisibleRowCount] = useState(10);
    const [rowStyleVars, setRowStyleVars] = useState({});

    const listSignature = rawList.length
        ? `${rawList.length}:${rawList[0]?.id || rawList[0]?.employee_id || ""}`
        : "0";

    useEffect(() => {
        setIsScrolled(false);
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [listSignature, listRef]);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const updateRowFit = () => {
            if (window.innerWidth < 1024) {
                setVisibleRowCount(10);
                setRowStyleVars((prev) => (Object.keys(prev).length === 0 ? prev : {}));
                return;
            }

            const height = el.clientHeight;
            if (!height) return;

            const count = typeof getRowCount === "function"
                ? Math.max(8, getRowCount(height))
                : Math.max(8, Math.round(height / baseRowHeight));
            const exactRowHeight = Math.floor((height / count) * 100) / 100;
            const currentRowHeight = Math.max(
                30,
                Math.floor((exactRowHeight - currentRowHeightOffset) * 100) / 100
            );

            setVisibleRowCount((prev) => (prev !== count ? count : prev));
            const nextRow = `${exactRowHeight}px`;
            const nextCur = `${currentRowHeight}px`;
            setRowStyleVars((prev) => {
                if (
                    prev["--lb-row-height"] === nextRow &&
                    prev["--lb-current-row-height"] === nextCur
                ) {
                    return prev;
                }
                return {
                    "--lb-row-height": nextRow,
                    "--lb-current-row-height": nextCur,
                };
            });
        };

        updateRowFit();
        window.addEventListener("resize", updateRowFit);

        let observer;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(updateRowFit);
            observer.observe(el);
        }

        return () => {
            window.removeEventListener("resize", updateRowFit);
            if (observer) observer.disconnect();
        };
    }, [listRef, baseRowHeight, currentRowHeightOffset, getRowCount]);

    const userIndex = useMemo(
        () =>
            rawList.findIndex(
                (item) =>
                    item.isCurrentUser ||
                    item.currentUser ||
                    (activeUserId &&
                        item.employee_id &&
                        String(item.employee_id).toLowerCase() === activeUserId)
            ),
        [rawList, activeUserId]
    );

    const displayedList = useMemo(() => {
        if (!isScrolled && userIndex >= visibleRowCount) {
            const topCount = visibleRowCount - 1;
            const topSlice = rawList.slice(0, topCount);
            const currentItem = rawList[userIndex];
            const pinnedUserEntry = {
                ...currentItem,
                isCurrentUser: true,
                currentUser: true,
                _rowKey: `pinned-${currentItem.id || currentItem.employee_id || userIndex}`,
            };
            // Render remaining rows below the fold so the first wheel event scrolls immediately
            const remainingTail = rawList
                .slice(topCount)
                .filter((_, idx) => topCount + idx !== userIndex);

            return [...topSlice, pinnedUserEntry, ...remainingTail];
        }
        return rawList;
    }, [isScrolled, userIndex, visibleRowCount, rawList]);

    const handleScroll = (e) => {
        const top = e.target.scrollTop;
        if (top <= 1 && isScrolled) {
            setIsScrolled(false);
        } else if (top > 6 && !isScrolled && userIndex >= visibleRowCount) {
            setIsScrolled(true);
        }
    };

    return {
        displayedList,
        rowStyleVars,
        handleScroll,
    };
}
