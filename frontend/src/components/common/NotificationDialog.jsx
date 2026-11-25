import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    Bell,
    Check,
    CheckCheck,
    Clock,
    ExternalLink,
    X,
    BookOpen,
    Sparkles,
    ChevronDown,
    Trash2,
    FileText
} from "lucide-react";
import { getNotificationScope } from "../../utils/notificationHighlight";
import "../../styles/common/NotificationDialog.css";

const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    try {
        const date = new Date(dateStr.replace(" ", "T"));
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return "Just now";
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString();
    } catch (_) {
        return dateStr;
    }
};

const getInitials = (name) => {
    if (!name) return "LM";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
};

const AVATAR_PALETTES = [
    { bg: "#EEF2FF", text: "#4338CA" }, // Indigo
    { bg: "#ECFDF5", text: "#047857" }, // Emerald
    { bg: "#FDF4FF", text: "#7E22CE" }, // Purple
    { bg: "#FEF3C7", text: "#B45309" }, // Amber
    { bg: "#E0F2FE", text: "#0369A1" }, // Sky
    { bg: "#FFF1F2", text: "#BE123C" }, // Rose
];

const getAvatarStyle = (name) => {
    if (!name) return AVATAR_PALETTES[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_PALETTES.length;
    return AVATAR_PALETTES[idx];
};

export default function NotificationDialog({
    isOpen,
    onClose,
    notifications = [],
    onMarkAsRead,
    onMarkAllAsRead,
    onDelete,
    onViewCourse,
    isLoading = false,
    viewMode = "EMPLOYEE",
    userRole
}) {
    const [expandedId, setExpandedId] = useState(null);
    const dialogRef = useRef(null);

    const targetScope = viewMode === "PRIMARY" ? "MANAGEMENT" : "EMPLOYEE";
    const scopedNotifications = notifications.filter((n) => getNotificationScope(n) === targetScope);

    // Auto-expand first unread item when opened
    useEffect(() => {
        if (isOpen) {
            const firstUnread = scopedNotifications.find((n) => !n.is_read);
            if (firstUnread) {
                setExpandedId(firstUnread.notification_id);
            } else if (scopedNotifications.length > 0) {
                setExpandedId(scopedNotifications[0].notification_id);
            } else {
                setExpandedId(null);
            }
        }
    }, [isOpen, scopedNotifications.length, targetScope]);

    // Lock body scroll while drawer is open
    useEffect(() => {
        if (!isOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const unreadCount = scopedNotifications.filter((n) => !n.is_read).length;

    const handleToggleExpand = (n) => {
        const isExpanding = expandedId !== n.notification_id;
        setExpandedId((prev) => (prev === n.notification_id ? null : n.notification_id));
        if (isExpanding && !n.is_read) {
            onMarkAsRead?.(n.notification_id);
        }
    };

    return createPortal(
        <div className="notif-drawer-root">
            {/* BACKDROP: closes ONLY when X icon is clicked */}
            <div className="notif-drawer-backdrop" aria-hidden="true" />

            {/* RIGHT-HAND SLIDE-OVER DRAWER PANEL */}
            <div
                className="notif-drawer-panel"
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Notification Center"
            >
                {/* HEADER */}
                <div className="notif-header">
                    <div className="notif-header-left">
                        <h3 className="notif-title">Inbox</h3>
                        {unreadCount > 0 && (
                            <span className="notif-inbox-badge">{unreadCount} new</span>
                        )}
                    </div>

                    <div className="notif-header-actions">
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                className="notif-mark-all-btn"
                                onClick={onMarkAllAsRead}
                                title="Mark all notifications as read"
                            >
                                <CheckCheck size={14} />
                                <span>Mark all read</span>
                            </button>
                        )}
                        <button
                            type="button"
                            className="notif-close-btn"
                            onClick={onClose}
                            aria-label="Close notifications"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* NOTIFICATION LIST (COLLAPSIBLE ACCORDION) */}
                <div className="notif-list-container">
                    {isLoading ? (
                        <div className="notif-empty-state">
                            <div className="notif-loading-spinner" />
                            <p className="notif-empty-subtitle">Loading notifications...</p>
                        </div>
                    ) : scopedNotifications.length === 0 ? (
                        <div className="notif-empty-state">
                            <div className="notif-empty-icon">
                                <Bell size={24} />
                            </div>
                            <h4 className="notif-empty-title">No notifications</h4>
                            <p className="notif-empty-subtitle">
                                {viewMode === "PRIMARY"
                                    ? "When employee approvals, requests, or team learning updates arrive, they will appear here in your Inbox."
                                    : "When course recommendations, assignments, or status updates on your learning arrive, they will appear here in your Inbox."}
                            </p>
                        </div>
                    ) : (
                        scopedNotifications.map((n) => {
                            const isExpanded = expandedId === n.notification_id;
                            const msgLower = (n.message || "").toLowerCase();
                            const titleLower = (n.title || "").toLowerCase();
                            const ntype = n.notification_type || "";

                            const isPurchased = ntype === "COURSE_REQUEST_PURCHASED" || ntype === "COURSE_PURCHASED";
                            const isReimbursement =
                                ntype.startsWith("REIMBURSEMENT_CLAIM") ||
                                ntype.startsWith("COURSE_REIMBURSEMENT") ||
                                msgLower.includes("reimbursement claim") ||
                                msgLower.includes("course reimbursement") ||
                                titleLower.includes("reimbursement claim") ||
                                titleLower.includes("course reimbursement");
                            const isCertRequest =
                                !isReimbursement &&
                                (ntype.startsWith("CERTIFICATION_REQUEST") ||
                                    msgLower.includes("certification request") ||
                                    titleLower.includes("certification request"));
                            const isCourseRequest =
                                !isReimbursement &&
                                !isCertRequest &&
                                !isPurchased &&
                                (ntype.startsWith("COURSE_REQUEST_") ||
                                    ntype === "COURSE_ENROLLMENT_REQUEST" ||
                                    msgLower.includes("course request") ||
                                    msgLower.includes("requested course") ||
                                    titleLower.includes("course request"));
                            const isRequest = isReimbursement || isCertRequest || isCourseRequest;
                            const isApproved =
                                (!isRequest &&
                                    (ntype === "COURSE_APPROVED" ||
                                        titleLower.includes("course approved") ||
                                        titleLower.includes("enrollment approved"))) ||
                                ntype === "CERTIFICATION_REQUEST_APPROVED" ||
                                ntype === "COURSE_REQUEST_APPROVED" ||
                                ntype === "REIMBURSEMENT_CLAIM_APPROVED";
                            const isOnHold = ntype === "COURSE_ON_HOLD" || titleLower.includes("on hold");
                            const isMaterial =
                                !isRequest &&
                                (ntype === "MATERIAL_RECOMMENDATION" || titleLower.includes("study material"));

                            const isReviewPrompt =
                                msgLower.includes("requires your approval") ||
                                msgLower.includes("awaits your approval") ||
                                msgLower.includes("awaiting your review") ||
                                msgLower.includes("awaiting hr") ||
                                msgLower.includes("awaits hr") ||
                                msgLower.includes("ready for purchase") ||
                                msgLower.includes("submitted by") ||
                                msgLower.includes("submitted a new");

                            const senderName = (isPurchased || (!isRequest && (isApproved || isOnHold)))
                                ? "L&D Team"
                                : isRequest
                                    ? isReviewPrompt && n.requester_name
                                        ? n.requester_name
                                        : (msgLower.includes("by hr") || msgLower.includes("reimbursed"))
                                            ? "HR Team"
                                            : (msgLower.includes("by l&d") || msgLower.includes("by the l&d") || msgLower.includes("reopened"))
                                                ? "L&D Team"
                                                : (msgLower.includes("by ceo") || msgLower.includes("by the ceo"))
                                                    ? "CEO"
                                                    : (n.requester_name || "Employee")
                                    : (n.recommender_name || "Reporting Manager");

                            const avatarColor = (isPurchased || isApproved)
                                ? { bg: "#ECFDF5", text: "#047857" }
                                : isOnHold
                                    ? { bg: "#FFF7ED", text: "#C2410C" }
                                    : isMaterial
                                        ? { bg: "#EFF6FF", text: "#2563EB" }
                                        : getAvatarStyle(senderName);

                            const initials = senderName === "L&D Team"
                                ? "LD"
                                : senderName === "HR Team"
                                    ? "HR"
                                    : senderName === "CEO"
                                        ? "CE"
                                        : getInitials(senderName);

                            const typeTag = isPurchased
                                ? "Course Purchased"
                                : isReimbursement
                                    ? (ntype === "REIMBURSEMENT_CLAIM_PAID" || ntype === "COURSE_REIMBURSEMENT_PAID" || msgLower.includes("has been paid"))
                                        ? "Claim Paid"
                                        : (ntype === "REIMBURSEMENT_CLAIM_APPROVED" || ntype === "COURSE_REIMBURSEMENT_APPROVED" || msgLower.includes("approved by hr"))
                                            ? "Claim Approved"
                                            : (ntype === "REIMBURSEMENT_CLAIM_REJECTED" || ntype === "COURSE_REIMBURSEMENT_REJECTED" || msgLower.includes("rejected by hr"))
                                                ? "Claim Rejected"
                                                : "Reimbursement Claim"
                                    : isCertRequest
                                        ? ntype === "CERTIFICATION_REQUEST_APPROVED"
                                            ? "Cert. Approved"
                                            : ntype === "CERTIFICATION_REQUEST_REJECTED"
                                                ? "Cert. Rejected"
                                                : "Certification Request"
                                        : isCourseRequest
                                            ? ntype === "COURSE_REQUEST_APPROVED"
                                                ? "Request Approved"
                                                : ntype === "COURSE_REQUEST_REJECTED"
                                                    ? "Request Rejected"
                                                    : "Course Request"
                                            : isApproved
                                                ? "Course Approved"
                                                : isOnHold
                                                    ? "Course On Hold"
                                                    : isMaterial
                                                        ? "Study Material"
                                                        : "Recommendation";

                            const tagClass = (isPurchased || isApproved)
                                ? "purchased"
                                : isOnHold
                                    ? "onhold"
                                    : isRequest
                                        ? "request"
                                        : isMaterial
                                            ? "material"
                                            : "recommendation";

                            return (
                                <div
                                    key={n.notification_id}
                                    className={`notif-card ${!n.is_read ? "unread" : ""} ${isExpanded ? "expanded" : ""}`}
                                    onClick={() => handleToggleExpand(n)}
                                >
                                    {/* SUMMARY BAR (ALWAYS VISIBLE - CLICKABLE) */}
                                    <div className="notif-card-header">
                                        {/* Avatar with Micro Icon */}
                                        <div
                                            className="notif-avatar"
                                            style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                                        >
                                            <span className="notif-avatar-text">{initials}</span>
                                            <span className={`notif-micro-badge ${tagClass}`}>
                                                {(isPurchased || isApproved) ? <Check size={9} /> : isOnHold ? <Clock size={9} /> : isRequest ? <Sparkles size={9} /> : isMaterial ? <FileText size={9} /> : <BookOpen size={9} />}
                                            </span>
                                        </div>

                                        {/* Summary text */}
                                        <div className="notif-summary-info">
                                            <div className="notif-summary-meta">
                                                <span className={`notif-type-tag ${tagClass}`}>
                                                    {typeTag}
                                                </span>
                                                <span className="notif-meta-dot">•</span>
                                                <span className="notif-sender-name">{senderName}</span>
                                                <span className="notif-meta-dot">•</span>
                                                <span className="notif-time-ago">
                                                    <Clock size={10} />
                                                    {formatRelativeTime(n.created_at)}
                                                </span>
                                            </div>

                                            <div className="notif-summary-title">
                                                <span className="notif-title-text">
                                                    {n.course_title || n.title}
                                                </span>
                                                {n.provider_name && (
                                                    <span className="notif-summary-provider">
                                                        {n.provider_name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Unread indicator & chevron toggle */}
                                        <div className="notif-header-right-tools">
                                            {!n.is_read && <span className="notif-unread-dot" title="Unread notification" />}
                                            <button
                                                type="button"
                                                className={`notif-chevron-toggle ${isExpanded ? "rotated" : ""}`}
                                                aria-label={isExpanded ? "Collapse notification" : "Expand notification"}
                                            >
                                                <ChevronDown size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* COLLAPSIBLE DETAILS (ANIMATED) */}
                                    <div className="notif-collapse-wrapper">
                                        <div className="notif-collapse-inner">
                                            {/* Full Message */}
                                            <p className="notif-full-message">{n.message}</p>

                                            {/* Unified Chips Bar */}
                                            <div className="notif-meta-chips">
                                                {(n.request_code || n.course_request_id) && (
                                                    <span className="notif-chip chip-request-id" title="Request ID">
                                                        #{n.request_code || n.course_request_id}
                                                    </span>
                                                )}
                                                {n.category_name && (
                                                    <span className="notif-chip chip-category">
                                                        {n.category_name}
                                                    </span>
                                                )}
                                                {n.provider_name && (
                                                    <span className="notif-chip chip-provider">
                                                        {n.provider_name}
                                                    </span>
                                                )}
                                                {n.duration && (
                                                    <span className="notif-chip chip-duration">
                                                        ⏱ {n.duration}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action Row */}
                                            <div className="notif-actions-row" onClick={(e) => e.stopPropagation()}>
                                                <div className="notif-actions-left">
                                                    {(isReimbursement || isCertRequest || isCourseRequest || n.course_id || n.course_title || n.course_url || isPurchased) ? (
                                                        <button
                                                            type="button"
                                                            className="notif-action-btn primary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!n.is_read) onMarkAsRead?.(n.notification_id);
                                                                onViewCourse?.({ ...n, isMaterial, isCertRequest, isCourseRequest, isReimbursement });
                                                                onClose?.();
                                                            }}
                                                        >
                                                            <span>
                                                                {isReimbursement
                                                                    ? "View Reimbursement"
                                                                    : isCertRequest
                                                                        ? "View Certification"
                                                                        : isCourseRequest
                                                                            ? "View Course Request"
                                                                            : isMaterial
                                                                                ? "View Material"
                                                                                : "View Course"}
                                                            </span>
                                                            <ExternalLink size={12} />
                                                        </button>
                                                    ) : null}
                                                </div>

                                                {/* Dustbin / Delete Button (Yellow Annotation) */}
                                                {onDelete && (
                                                    <button
                                                        type="button"
                                                        className="notif-delete-btn"
                                                        title="Delete notification"
                                                        aria-label="Delete notification"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDelete(n.notification_id);
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
