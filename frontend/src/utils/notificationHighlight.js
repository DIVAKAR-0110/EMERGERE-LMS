/**
 * Shared helpers for notification-driven navigation highlights across Approval & Request tables.
 */

const normalizeStr = (val) => String(val ?? "").trim().toLowerCase();

/**
 * Finds the matching request item by request code, numeric ID, or (title + optional requester).
 */
export function findMatchingApprovalItem(list, criteria) {
    if (!Array.isArray(list) || list.length === 0 || !criteria) return null;

    const targetCode = normalizeStr(criteria.highlightRequestCode);
    const targetId = criteria.highlightRequestId != null ? String(criteria.highlightRequestId).trim() : null;
    const targetTitle = normalizeStr(criteria.highlightTitle);
    const targetRequester = normalizeStr(criteria.highlightRequester);

    // 1. Exact Request Code match (e.g., CLM-2026-0036)
    if (targetCode) {
        const byCode = list.find((item) => {
            const candidates = [
                item.id,
                item.request_code,
                item.course_request_id,
                item.claimId,
                item.claim_id,
                item.raw?.request_code,
            ];
            return candidates.some((c) => normalizeStr(c) === targetCode);
        });
        if (byCode) return byCode;
    }

    // 2. Numeric Request ID match
    if (targetId && targetId !== "0") {
        const byId = list.find((item) => {
            const candidates = [
                item.requestId,
                item.request_id,
                item.new_course_id,
                item.course_id,
                item.raw?.id,
                item.raw?.request_id,
                item.raw?.course_request_id,
                item.id,
            ];
            return candidates.some((c) => c != null && String(c).trim() === targetId);
        });
        if (byId) return byId;
    }

    // 3. Title + Requester name match (or fallback to Title alone)
    if (targetTitle) {
        if (targetRequester) {
            const byTitleAndRequester = list.find((item) => {
                const itemTitle = normalizeStr(item.course || item.courseName || item.courseTitle || item.certification_name || item.certificate || item.certificateTitle);
                const itemRequester = normalizeStr(item.name || item.employeeName || item.employee);
                return itemTitle === targetTitle && itemRequester.includes(targetRequester);
            });
            if (byTitleAndRequester) return byTitleAndRequester;
        }

        const byTitle = list.find((item) => {
            const itemTitle = normalizeStr(item.course || item.courseName || item.courseTitle || item.certification_name || item.certificate || item.certificateTitle);
            return itemTitle === targetTitle;
        });
        if (byTitle) return byTitle;
    }

    return null;
}

/**
 * Returns a stable key representing an approval row/card across tables.
 */
export function getApprovalHighlightKey(item) {
    if (!item) return null;
    return String(item.id ?? item.requestId ?? item.new_course_id ?? item.course ?? "");
}

/**
 * Classifies a notification as personal learning ('EMPLOYEE') vs team/org work ('MANAGEMENT').
 */
export function getNotificationScope(n) {
    if (n?.notification_scope === "EMPLOYEE" || n?.notification_scope === "MANAGEMENT") {
        return n.notification_scope;
    }
    const msgLower = String(n?.message || "").toLowerCase().trim();
    const ntype = n?.notification_type || "";
    if (
        msgLower.startsWith("your ") ||
        msgLower.startsWith("congratulations! your ") ||
        msgLower.startsWith("reminder: your ") ||
        msgLower.startsWith("urgent: your ") ||
        msgLower.startsWith("reimbursement review for requested course") ||
        msgLower.includes("to your learning library") ||
        msgLower.includes("assigned to your library") ||
        msgLower.includes("has assigned the course") ||
        msgLower.includes("recommended the course") ||
        msgLower.includes("recommended the study material") ||
        msgLower.includes(" for you.") ||
        ntype === "COURSE_RECOMMENDATION" ||
        ntype === "MATERIAL_RECOMMENDATION" ||
        ntype === "COURSE_ON_HOLD" ||
        ntype === "COURSE_REQUEST_PURCHASED"
    ) {
        return "EMPLOYEE";
    }
    if (
        ntype.startsWith("CERTIFICATION_REQUEST") ||
        ntype.startsWith("COURSE_REQUEST_") ||
        ntype.startsWith("REIMBURSEMENT_CLAIM") ||
        ntype === "COURSE_ENROLLMENT_REQUEST" ||
        msgLower.includes("requires your approval") ||
        msgLower.includes("awaits your approval") ||
        msgLower.includes("awaiting your review") ||
        msgLower.includes("awaits hr review") ||
        msgLower.includes("awaiting hr") ||
        msgLower.includes("is ready for purchase") ||
        msgLower.includes("submitted a new") ||
        msgLower.includes("submitted by") ||
        msgLower.includes("urgent escalation") ||
        msgLower.includes("license seat has been released") ||
        msgLower.includes("'s enrollment request")
    ) {
        return "MANAGEMENT";
    }
    return "EMPLOYEE";
}

