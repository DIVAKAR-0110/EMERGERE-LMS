import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import notificationWithDotSvg from "../../assets/course_library/notification.svg";
import notificationNoDotSvg from "../../assets/course_library/notification_icon_no_red.svg";
import { useAuth } from "../../context/AuthContext";
import { normalizeRoleName } from "../../utils/roleUtils";
import { getNotificationScope } from "../../utils/notificationHighlight";
import NotificationDialog from "./NotificationDialog";
import "../../styles/common/PageHeader.css";

/**
 * Common PageHeader component for LMS pages with role-based View Switcher & Notification Bell
 *
 * @param {Object} props
 * @param {string|React.ReactNode} [props.title] - Title text or element (e.g. "Team Management")
 * @param {string|React.ReactNode} [props.subtitle] - Subtitle text or element (e.g. "Manage and support your team's learning journey.")
 * @param {boolean} [props.showNotification=true] - Whether to render the notification button
 * @param {React.ReactNode} [props.notificationIcon] - Custom notification icon element if needed (default: notification.svg)
 * @param {boolean} [props.hasUnread] - Explicit override for unread red badge dot on bell
 * @param {Function} [props.onNotificationClick] - Optional custom callback when notification icon is clicked
 * @param {boolean} [props.showViewSwitcher=true] - Toggles the view switcher button for management roles
 * @param {React.ReactNode} [props.rightContent] - Optional custom elements rendered beside notification button
 * @param {string} [props.className=""] - Additional CSS class name for container
 */
export default function PageHeader({
    title,
    subtitle,
    showNotification = true,
    notificationIcon,
    hasUnread,
    onNotificationClick,
    showViewSwitcher = true,
    rightContent,
    className = "",
}) {
    const navigate = useNavigate();
    const { isManagementRole, isViewingAsEmployee, toggleViewMode, switchToEmployeeMode, switchToPrimaryMode, primaryRole, user, token } = useAuth();

    // Notification State
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
    const NOTIFICATION_REFRESH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
    const activeViewMode = !isManagementRole || isViewingAsEmployee ? "EMPLOYEE" : "PRIMARY";

    const getEffectiveEmpId = useCallback(() => {
        if (user?.employee_id) return user.employee_id;
        const stored = localStorage.getItem("lms_active_employee_id");
        if (stored) return stored;
        const path = window.location.pathname.toLowerCase();
        if (path.includes("/ceo") || (!isViewingAsEmployee && primaryRole === "CEO")) {
            return "EMP001"; // CEO Gowri Shankar
        }
        if (path.includes("/reporting-manager") || (!isViewingAsEmployee && primaryRole === "Reporting Manager")) {
            return "EMP004"; // Reporting Manager Suresh Menon
        }
        if (path.includes("/ld") || path.includes("/l&d") || (!isViewingAsEmployee && primaryRole === "L&D Team")) {
            return "EMP010"; // L&D Team Vikram Malhotra
        }
        return "EMP011"; // Default Employee Nivash
    }, [user, primaryRole, isViewingAsEmployee]);

    const fetchNotifications = useCallback(async () => {
        try {
            setIsLoadingNotifs(true);
            const authToken = token || localStorage.getItem("lms_token");
            const activeEmpId = getEffectiveEmpId();

            const res = await axios.get(`${API_BASE_URL}/api/notifications`, {
                params: { view_mode: activeViewMode },
                headers: {
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    "X-Employee-Id": activeEmpId,
                    "X-View-Mode": activeViewMode,
                }
            });
            if (Array.isArray(res.data)) {
                setNotifications(res.data);
            }
        } catch (err) {
            console.error("Failed to load notifications in PageHeader:", err);
        } finally {
            setIsLoadingNotifs(false);
        }
    }, [API_BASE_URL, token, getEffectiveEmpId, activeViewMode]);

    useEffect(() => {
        if (showNotification) {
            fetchNotifications();
            // Periodic polling every 3 minutes for live updates
            const interval = setInterval(fetchNotifications, NOTIFICATION_REFRESH_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [showNotification, fetchNotifications, NOTIFICATION_REFRESH_INTERVAL_MS]);

    const handleBellClick = (e) => {
        e.stopPropagation();
        if (onNotificationClick) {
            onNotificationClick(e);
        }
        setIsNotifOpen((prev) => !prev);
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            const authToken = token || localStorage.getItem("lms_token");
            const activeEmpId = getEffectiveEmpId();

            await axios.put(
                `${API_BASE_URL}/api/notifications/${notificationId}/read`,
                {},
                {
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    }
                }
            );
            setNotifications((prev) =>
                prev.map((n) => (n.notification_id === notificationId ? { ...n, is_read: true } : n))
            );
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const authToken = token || localStorage.getItem("lms_token");
            const activeEmpId = getEffectiveEmpId();

            await axios.put(
                `${API_BASE_URL}/api/notifications/read-all`,
                {},
                {
                    params: { view_mode: activeViewMode },
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                        "X-View-Mode": activeViewMode,
                    }
                }
            );
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch (err) {
            console.error("Failed to mark all notifications as read:", err);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            const authToken = token || localStorage.getItem("lms_token");
            const activeEmpId = getEffectiveEmpId();

            await axios.delete(
                `${API_BASE_URL}/api/notifications/${notificationId}`,
                {
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    }
                }
            );
            setNotifications((prev) =>
                prev.filter((n) => n.notification_id !== notificationId)
            );
        } catch (err) {
            console.error("Failed to delete notification:", err);
        }
    };

    const handleViewCourse = (notification) => {
        if (!notification) return;

        // Fire-and-forget recommendation view tracking
        if (notification?.reference_id && notification?.notification_type === "COURSE_RECOMMENDATION") {
            const authToken = token || localStorage.getItem("lms_token");
            const activeEmpId = getEffectiveEmpId();
            axios.put(
                `${API_BASE_URL}/api/notifications/recommendations/${notification.reference_id}/view`,
                {},
                {
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    }
                }
            ).catch((err) => {
                console.error("Failed to record recommendation view:", err);
            });
        }

        const msgLower = (notification.message || "").toLowerCase();
        const titleLower = (notification.title || "").toLowerCase();
        const ntype = notification.notification_type || "";

        const isPurchased =
            ntype === "COURSE_REQUEST_PURCHASED" || ntype === "COURSE_PURCHASED";
        const isReimbursement =
            Boolean(notification.isReimbursement) ||
            ntype.startsWith("REIMBURSEMENT_CLAIM") ||
            msgLower.includes("reimbursement claim") ||
            titleLower.includes("reimbursement claim");
        const isCertRequest =
            !isReimbursement &&
            (Boolean(notification.isCertRequest) ||
                ntype.startsWith("CERTIFICATION_REQUEST") ||
                msgLower.includes("certification request") ||
                titleLower.includes("certification request"));
        const isCourseRequest =
            !isReimbursement &&
            (Boolean(notification.isCourseRequest) ||
                (!isCertRequest &&
                    !isPurchased &&
                    (ntype.startsWith("COURSE_REQUEST_") ||
                        ntype === "COURSE_ENROLLMENT_REQUEST" ||
                        msgLower.includes("course request") ||
                        msgLower.includes("requested course") ||
                        titleLower.includes("course request"))));
        const isMaterial =
            !isReimbursement &&
            !isCertRequest &&
            !isCourseRequest &&
            (Boolean(notification.isMaterial) ||
                ntype === "MATERIAL_RECOMMENDATION" ||
                titleLower.includes("study material"));

        setIsNotifOpen(false);

        const normPrimary = normalizeRoleName(primaryRole);
        const isOwnEmployeeNotice =
            normPrimary === "Employee" ||
            msgLower.startsWith("your certification request") ||
            msgLower.startsWith("your certification reimbursement claim") ||
            msgLower.startsWith("congratulations! your certification") ||
            msgLower.startsWith("congratulations! your reimbursement") ||
            msgLower.startsWith("your reimbursement claim") ||
            msgLower.startsWith("your course request") ||
            msgLower.includes("your requested course");

        const requestHighlightState = {
            highlightTab: isReimbursement ? "reimbursement" : isCertRequest ? "cert" : "course",
            highlightRequestCode: notification.request_code || notification.course_request_id || null,
            highlightRequestId: notification.course_id || notification.reference_id || null,
            highlightTitle: notification.course_title || "",
            highlightRequester: notification.requester_name || "",
            highlightTimestamp: Date.now(),
        };

        if (isReimbursement && !isOwnEmployeeNotice) {
            if (isManagementRole && isViewingAsEmployee && switchToPrimaryMode) {
                switchToPrimaryMode();
            }
            if (normPrimary === "L&D Team") {
                navigate("/ld/approvals-workflow", { state: requestHighlightState });
                return;
            }
            if (normPrimary === "HR Team") {
                navigate("/hr/approvals-workflow", {
                    state: { ...requestHighlightState, highlightTab: "cert" },
                });
                return;
            }
            if (normPrimary === "Reporting Manager") {
                navigate("/reporting-manager/learning-records", { state: requestHighlightState });
                return;
            }
        }

        if (isCertRequest && !isOwnEmployeeNotice) {
            if (isManagementRole && isViewingAsEmployee && switchToPrimaryMode) {
                switchToPrimaryMode();
            }
            if (normPrimary === "L&D Team") {
                navigate("/ld/approvals-workflow", { state: requestHighlightState });
                return;
            }
            if (normPrimary === "CEO") {
                navigate("/ceo/approvals-analytics", { state: requestHighlightState });
                return;
            }
            if (normPrimary === "HR Team") {
                navigate("/hr/approvals-workflow", { state: requestHighlightState });
                return;
            }
            if (normPrimary === "Reporting Manager") {
                navigate("/reporting-manager/learning-records", { state: requestHighlightState });
                return;
            }
        }

        if (isCourseRequest && !isOwnEmployeeNotice) {
            if (isManagementRole && isViewingAsEmployee && switchToPrimaryMode) {
                switchToPrimaryMode();
            }
            if (normPrimary === "L&D Team") {
                navigate("/ld/approvals-workflow", { state: requestHighlightState });
                return;
            }
            if (normPrimary === "CEO") {
                navigate("/ceo/approvals-analytics", { state: requestHighlightState });
                return;
            }
            if (normPrimary === "HR Team") {
                navigate("/hr/approvals-workflow", { state: requestHighlightState });
                return;
            }
            if (normPrimary === "Reporting Manager") {
                navigate("/reporting-manager/team-management", { state: requestHighlightState });
                return;
            }
        }

        // Employee self-service routes: ensure management roles enter Employee View
        if (isManagementRole && !isViewingAsEmployee && switchToEmployeeMode) {
            switchToEmployeeMode();
        }

        if (isReimbursement) {
            navigate("/employee/certification-reimb", {
                state: {
                    highlightTab: "reimbursement-claims",
                    highlightTitle: notification.course_title || "",
                    highlightRequestCode: notification.request_code || notification.course_request_id || null,
                    highlightRequestId: notification.course_id || notification.reference_id || null,
                    highlightTimestamp: Date.now(),
                },
            });
            return;
        }

        if (isCertRequest) {
            navigate("/employee/certification-reimb", {
                state: {
                    highlightCertTitle: notification.course_title || "",
                    highlightRequestCode: notification.request_code || notification.course_request_id || null,
                    highlightTimestamp: Date.now(),
                },
            });
            return;
        }

        if (isCourseRequest) {
            navigate("/employee/course-library", {
                state: {
                    openTracker: true,
                    highlightRequestCode: notification.request_code || notification.course_request_id || null,
                    highlightCourseTitle: notification.course_title || "",
                    highlightTimestamp: Date.now(),
                },
            });
            return;
        }

        navigate("/employee/course-library", {
            state: {
                highlightCourseId: notification.course_id || null,
                highlightCourseTitle: notification.course_title || "",
                highlightTab: isMaterial ? "materials" : "video",
                highlightTimestamp: Date.now(),
            },
        });
    };

    const targetScope = activeViewMode === "PRIMARY" ? "MANAGEMENT" : "EMPLOYEE";
    const scopedNotifications = notifications.filter((n) => getNotificationScope(n) === targetScope);
    const unreadCount = scopedNotifications.filter((n) => !n.is_read).length;
    const hasNotificationMessage = hasUnread !== undefined ? hasUnread : unreadCount > 0;

    const handleToggleView = () => {
        toggleViewMode();
        if (isViewingAsEmployee) {
            // Return to Primary Portal
            const normalized = normalizeRoleName(primaryRole);
            if (normalized === "Reporting Manager") {
                navigate("/reporting-manager/dashboard");
            } else if (normalized === "L&D Team") {
                navigate("/ld/dashboard");
            } else if (normalized === "HR Team") {
                navigate("/hr/dashboard");
            } else if (normalized === "CEO") {
                navigate("/ceo/dashboard");
            } else {
                navigate("/employee/dashboard");
            }
        } else {
            // Switch to Employee Self-Service View
            navigate("/employee/dashboard");
        }
    };

    const hasViewSwitcher = showViewSwitcher && isManagementRole;
    const switcherLabel = isViewingAsEmployee
        ? "⇄ Switch Role"
        : "⇄ Employee View";

    return (
        <header className={`common-page-header ${hasViewSwitcher ? "has-view-switcher" : "no-view-switcher"} ${className}`.trim()}>
            <div className="common-page-header-title-section">
                {title && <h1>{title}</h1>}
                {subtitle && <p>{subtitle}</p>}
            </div>

            <div className="common-page-header-right">
                {/* Role-based View Switcher Button (Only for Non-Employee roles) */}
                {hasViewSwitcher && (
                    <button
                        type="button"
                        className={`common-view-switch-btn ${isViewingAsEmployee ? "primary-view" : "employee-view"
                            }`}
                        onClick={handleToggleView}
                        title={isViewingAsEmployee ? "Return to Primary Portal" : "Employee View"}
                    >
                        <span className="view-switch-knob" />
                        <span className="view-switch-text">
                            {switcherLabel}
                        </span>
                    </button>
                )}

                {rightContent}

                {showNotification && (
                    <div className="common-header-bell-container">
                        <button
                            type="button"
                            className="common-header-bell-btn header-bell-btn"
                            aria-label="Notifications"
                            onClick={handleBellClick}
                        >
                            <span className="common-bell-icon-wrapper bell-icon-wrapper">
                                {notificationIcon ? (
                                    <>
                                        {notificationIcon}
                                        {hasNotificationMessage && <span className="common-bell-badge-dot bell-badge-dot" />}
                                    </>
                                ) : (
                                    <img
                                        src={hasNotificationMessage ? notificationWithDotSvg : notificationNoDotSvg}
                                        alt={hasNotificationMessage ? "Notifications (New messages)" : "Notifications"}
                                        className="common-notification-img header-notification-icon-img"
                                    />
                                )}
                            </span>
                        </button>

                        <NotificationDialog
                            isOpen={isNotifOpen}
                            onClose={() => setIsNotifOpen(false)}
                            notifications={notifications}
                            onMarkAsRead={handleMarkAsRead}
                            onMarkAllAsRead={handleMarkAllAsRead}
                            onDelete={handleDeleteNotification}
                            onViewCourse={handleViewCourse}
                            isLoading={isLoadingNotifs}
                            viewMode={activeViewMode}
                            userRole={isViewingAsEmployee ? "Employee" : (normalizeRoleName(primaryRole) || user?.role || "Reporting Manager")}
                        />
                    </div>
                )}
            </div>
        </header>
    );
}
