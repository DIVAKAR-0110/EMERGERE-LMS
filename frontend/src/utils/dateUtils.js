/**
 * Cross-Browser Date Utilities
 * Resolves Safari (macOS/iOS) date parsing issues where YYYY-MM-DD strings without
 * time components or strings with space separators result in Invalid Date -> "NaN days remaining".
 */

/**
 * Safely parses date strings across all browsers (including Safari, Chrome, Firefox, Edge, iOS WebKit).
 * Handles:
 * - "YYYY-MM-DD"
 * - "YYYY-MM-DD HH:mm:ss"
 * - ISO strings "YYYY-MM-DDTHH:mm:ss"
 * - Date objects
 */
export function parseDateSafe(dateVal) {
    if (!dateVal) return null;
    if (dateVal instanceof Date) {
        return isNaN(dateVal.getTime()) ? null : dateVal;
    }

    try {
        const cleanStr = String(dateVal).trim();
        // Split on standard separators: '-', 'T', ' ', ':', '/'
        const parts = cleanStr.split(/[-T /:]/);
        if (parts.length >= 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // JS 0-indexed month
            const day = parseInt(parts[2], 10);

            let hours = 0;
            let minutes = 0;
            let seconds = 0;
            if (parts.length >= 5) {
                hours = parseInt(parts[3], 10) || 0;
                minutes = parseInt(parts[4], 10) || 0;
                seconds = parseInt(parts[5], 10) || 0;
            }

            const dt = new Date(year, month, day, hours, minutes, seconds);
            if (!isNaN(dt.getTime())) {
                return dt;
            }
        }

        // Fallback replacement of hyphens with slashes (preferred by Safari for MM/DD/YYYY)
        const slashStr = cleanStr.replace(/-/g, "/");
        const fallback = new Date(slashStr);
        return isNaN(fallback.getTime()) ? null : fallback;
    } catch {
        return null;
    }
}

/**
 * Calculates calendar days remaining until target completion date.
 * Safari-safe: Never evaluates to NaN.
 * 
 * @param {string|Date} targetDateStr - Target completion date
 * @param {number|null} fallbackDays - Optional fallback number
 * @returns {number|null} - Days remaining (positive = future, negative = overdue, null if invalid)
 */
export function calculateDaysRemaining(targetDateStr, fallbackDays = null) {
    if (!targetDateStr) return fallbackDays;

    const target = parseDateSafe(targetDateStr);
    if (!target) return fallbackDays;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDay = new Date(target);
    targetDay.setHours(0, 0, 0, 0);

    const diffMs = targetDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (isNaN(diffDays) || !isFinite(diffDays)) {
        return fallbackDays;
    }

    return diffDays;
}

/**
 * Formats a friendly countdown string:
 * e.g., "5 days remaining", "1 day remaining", "Due today", "2 days overdue"
 */
export function formatDaysRemainingText(targetDateStr, fallbackDays = null) {
    const days = calculateDaysRemaining(targetDateStr, fallbackDays);
    if (days === null) return "Due soon";

    if (days > 1) return `${days} days remaining`;
    if (days === 1) return "1 day remaining";
    if (days === 0) return "Due today";
    if (days === -1) return "1 day overdue";
    return `${Math.abs(days)} days overdue`;
}

/**
 * Formats duration display for learning badges and pills.
 * Formats combined hours and minutes to decimal hours (e.g. "1h 20m" -> "1.2h", "1h 30m" -> "1.5h"),
 * keeps whole hours clean (e.g. "4h"), and preserves sub-hour minute durations (e.g. "10m", "30m" -> "0.5h").
 */
export function formatDurationPill(dur) {
    if (!dur) return "0h";
    const str = String(dur).trim();

    // If already formatted like "1.2h", "1.5h", "4h"
    if (/^\d+(?:\.\d+)?h$/i.test(str)) {
        return str.toLowerCase();
    }

    const hMatch = str.match(/(\d+)\s*(?:h|hr|hrs|hours)\b/i);
    const mMatch = str.match(/(\d+)\s*(?:m|min|mins|minutes)\b/i);

    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    const m = mMatch ? parseInt(mMatch[1], 10) : 0;

    if (!hMatch && !mMatch) {
        // If it's just a raw number, e.g. "2" -> "2h"
        if (/^\d+$/.test(str)) {
            return `${str}h`;
        }
        return str;
    }

    if (h > 0 && m > 0) {
        if (m === 30) return `${h}.5h`;
        if (m === 20) return `${h}.2h`;
        if (m === 10) return `${h}.1h`;
        if (m === 40) return `${h}.4h`;
        if (m === 15) return `${h}.25h`;
        if (m === 45) return `${h}.75h`;
        if (m % 10 === 0) return `${h}.${m / 10}h`;
        const dec = (h + m / 60).toFixed(1).replace(/\.0$/, "");
        return `${dec}h`;
    }

    if (h > 0) {
        return `${h}h`;
    }

    if (m === 30) {
        return "0.5h";
    }

    return `${m}m`;
}
