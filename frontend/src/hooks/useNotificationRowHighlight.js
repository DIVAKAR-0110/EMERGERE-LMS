import { useState, useEffect, useRef } from "react";
import { findMatchingApprovalItem, getApprovalHighlightKey } from "../utils/notificationHighlight";

/**
 * Manages StrictMode-safe 3-second notification row/card highlighting
 * across Approval & Workflow / Tracker views.
 */
export default function useNotificationRowHighlight({
    locationState,
    isReady = true,
    targetList = null,
    onActivate,
    onNotFound,
    storageKey = "lms_completed_aw_highlight_ts",
    durationMs = 3000,
}) {
    const [pendingHighlight, setPendingHighlight] = useState(null);
    const [highlightedKey, setHighlightedKey] = useState(null);
    const activeTsRef = useRef(null);

    // 1. Capture incoming navigation highlight intent
    useEffect(() => {
        if (!locationState || !locationState.highlightTimestamp) return;
        const tsStr = String(locationState.highlightTimestamp);
        if (sessionStorage.getItem(storageKey) === tsStr) return;

        activeTsRef.current = tsStr;
        onActivate?.(locationState);
        setPendingHighlight({
            highlightTab: locationState.highlightTab || null,
            highlightRequestCode: locationState.highlightRequestCode || null,
            highlightRequestId: locationState.highlightRequestId || null,
            highlightTitle: locationState.highlightTitle || "",
            highlightRequester: locationState.highlightRequester || "",
            highlightTimestamp: locationState.highlightTimestamp,
        });
    }, [locationState, storageKey]);

    // 2. Match target item once data finishes loading
    useEffect(() => {
        if (!pendingHighlight || !isReady || !Array.isArray(targetList)) return;

        const match = findMatchingApprovalItem(targetList, pendingHighlight);
        const tsStr = String(pendingHighlight.highlightTimestamp || activeTsRef.current || "");

        if (match) {
            setHighlightedKey(getApprovalHighlightKey(match));
            setPendingHighlight(null);
        } else {
            if (tsStr) sessionStorage.setItem(storageKey, tsStr);
            setPendingHighlight(null);
            onNotFound?.(pendingHighlight);
        }
    }, [pendingHighlight, isReady, targetList, storageKey]);

    // 3. Auto-clear highlight after durationMs (default 3000ms)
    useEffect(() => {
        if (!highlightedKey) return;
        const timer = setTimeout(() => {
            if (activeTsRef.current) {
                sessionStorage.setItem(storageKey, activeTsRef.current);
            }
            setHighlightedKey(null);
        }, durationMs);
        return () => clearTimeout(timer);
    }, [highlightedKey, storageKey, durationMs]);

    return { highlightedKey, setHighlightedKey };
}

