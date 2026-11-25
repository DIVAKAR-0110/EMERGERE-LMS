import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { X, User, Pencil, LogOut } from "lucide-react";

import ai_assistant from "../../assets/Sidebar/Ai_assistant.svg";
import certifications from "../../assets/Sidebar/Certifications.svg";
import course_library from "../../assets/Sidebar/Course_Library.svg";
import daily_learning from "../../assets/Sidebar/Daily_learning_log.svg";
import dashboard from "../../assets/Sidebar/Dashboard.svg";
import leaderboard from "../../assets/Sidebar/LeaderBoard.svg";
import Document from "../../assets/Sidebar/doc.svg";
import Analytics from "../../assets/Sidebar/analytics.svg";
import Education from "../../assets/Sidebar/edu.svg";
import budget from "../../assets/Sidebar/budget.svg";
import employee_directory from "../../assets/Sidebar/employee-directory.svg";
import course from "../../assets/Sidebar/course.svg";
import report from "../../assets/Sidebar/report.svg";
import people from "../../assets/Sidebar/people.svg";
import lms_copilot_icon from "../../assets/lms_copilot_icon.svg";

import emergere_logo from "../../assets/emergere_logo3.png";

import { useAuth } from "../../context/AuthContext";
import "../../styles/Sidebar.css";

/* =============================================================
   SIDEBAR MENU CONFIGURATION
   ============================================================= */

const sidebarMenus = {
    Employee: [
        {
            label: "AI Assistant",
            path: "/employee/ai-assistant",
            icon: ai_assistant,
        },
        {
            label: "Dashboard",
            path: "/employee/dashboard",
            icon: dashboard,
        },
        {
            label: "Course Library",
            path: "/employee/course-library",
            icon: course_library,
        },
        {
            label: "Daily Learning Log",
            path: "/employee/daily-learning-log",
            icon: daily_learning,
        },
        {
            label: "Leaderboard",
            path: "/employee/leaderboard",
            icon: leaderboard,
        },
        {
            label: "Certifications & Reimb.",
            path: "/employee/certification-reimb",
            icon: certifications,
        },
        {
            label: "LMS Copilot",
            path: "/employee/LMS Copilot",
            icon: lms_copilot_icon,
        }
    ],

    Reporting_Manager: [
        {
            label: "AI Assistant",
            path: "/reporting-manager/ai-assistant",
            icon: ai_assistant,
        },
        {
            label: "Dashboard",
            path: "/reporting-manager/dashboard",
            icon: dashboard,
        },
        {
            label: "Team Management",
            path: "/reporting-manager/team-management",
            icon: people,
        },
        {
            label: "Learning Records",
            path: "/reporting-manager/learning-records",
            icon: Document,
        },
        {
            label: "Recommend Course",
            path: "/reporting-manager/recommend-course",
            icon: Education,
        },
        {
            label: "Reports & Analytics",
            path: "/reporting-manager/reports-analytics",
            icon: Analytics,
        },
    ],

    L_D: [
        {
            label: "AI Assistant",
            path: "/ld/ai-assistant",
            icon: ai_assistant,
        },
        {
            label: "Dashboard",
            path: "/ld/dashboard",
            icon: dashboard,
        },
        {
            label: "Employee Directory",
            path: "/ld/employee-directory",
            icon: employee_directory,
        },
        {
            label: "Learning Records",
            path: "/ld/learning-records",
            icon: Document,
        },
        {
            label: "Course Management",
            path: "/ld/course-management",
            icon: course,
        },
        {
            label: "Approvals & Workflow",
            path: "/ld/approvals-workflow",
            icon: report,
        },
        {
            label: "Workshops & Training",
            path: "/ld/workshops-training",
            icon: Education,
        },
        {
            label: "Budget",
            path: "/ld/budget",
            icon: budget,
        },
        {
            label: "LMS Copilot",
            path: "/ld/LMS Copilot",
            icon: lms_copilot_icon,
        }
    ],

    HR: [
        {
            label: "AI Assistant",
            path: "/hr/ai-assistant",
            icon: ai_assistant,
        },
        {
            label: "Dashboard",
            path: "/hr/dashboard",
            icon: dashboard,
        },
        {
            label: "Employee Records",
            path: "/hr/employee-records",
            icon: course_library,
        },
        {
            label: "Approvals & Workflow",
            path: "/hr/approvals-workflow",
            icon: report,
        },

        {
            label: "Budget & Expenditure",
            path: "/hr/budget-expenditure",
            icon: course,
        },

    ],

    CEO: [
        {
            label: "AI Assistant",
            path: "/ceo/ai-assistant",
            icon: ai_assistant,
        },
        {
            label: "Dashboard",
            path: "/ceo/dashboard",
            icon: dashboard,
        },
        {
            label: "Approvals & Analytics",
            path: "/ceo/approvals-analytics",
            icon: leaderboard,
        },
        {
            label: "Budget & Expenditure",
            path: "/ceo/budget-expenditure",
            icon: dashboard,
        },
    ],
};

/* =============================================================
   ROLE HELPERS
   ============================================================= */

/**
 * Normalizes role names so the sidebar works even if
 * AuthContext returns slightly different role formats.
 */
const normalizeRole = (role) => {
    if (!role) {
        return "Employee";
    }

    const s = String(role).trim().toLowerCase();

    if (
        s === "reporting_manager" ||
        s === "reportingmanager" ||
        s === "reporting manager" ||
        s.includes("reporting")
    ) {
        return "Reporting_Manager";
    }

    if (s === "l_d" || s === "l&d" || s === "ld" || s.includes("l&d")) {
        return "L_D";
    }

    if (s === "hr" || s.includes("human resources")) {
        return "HR";
    }

    if (s === "ceo") {
        return "CEO";
    }

    return "Employee";
};

/**
 * Returns the role label displayed below the user's name.
 */
const getDisplayRole = (role) => {
    const normalized = normalizeRole(role);
    switch (normalized) {
        case "Reporting_Manager":
            return "Reporting Manager";

        case "L_D":
            return "L&D Team";

        case "HR":
            return "HR Team";

        case "CEO":
            return "CEO";

        case "Employee":
        default:
            return "Employee";
    }
};

/**
 * Returns the profile route based on the user's role.
 */
const getProfileBasePath = (role) => {
    switch (role) {
        case "Reporting_Manager":
            return "/reporting-manager/profile";

        case "L_D":
            return "/ld/profile";

        case "HR":
            return "/hr/profile";

        case "CEO":
            return "/ceo/profile";

        case "Employee":
        default:
            return "/employee/profile";
    }
};

/**
 * Generates initials from a user's name.
 */
const getInitials = (name) => {
    if (!name || typeof name !== "string") {
        return "RK";
    }

    const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return initials || "RK";
};

/* =============================================================
   SIDEBAR COMPONENT
   ============================================================= */

export default function Sidebar({ isOpen = false, onClose }) {
    const navigate = useNavigate();
    const location = useLocation();

    const { role, currentUser, user, logout } = useAuth();

    /* ---------------------------------------------------------
       ROLE
       --------------------------------------------------------- */

    const getRoleFromPath = (pathname) => {
        if (!pathname) return null;
        if (pathname.startsWith("/reporting-manager")) return "Reporting_Manager";
        if (pathname.startsWith("/ld")) return "L_D";
        if (pathname.startsWith("/hr")) return "HR";
        if (pathname.startsWith("/ceo")) return "CEO";
        if (pathname.startsWith("/employee")) return "Employee";
        return null;
    };

    const activeRole = getRoleFromPath(location.pathname) || normalizeRole(role);

    const menuItems =
        sidebarMenus[activeRole] || sidebarMenus.Employee;

    /* ---------------------------------------------------------
       PROFILE MENU STATE
       --------------------------------------------------------- */

    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    const profileMenuRef = useRef(null);
    const navRef = useRef(null);

    /* ---------------------------------------------------------
       USER INFORMATION
       --------------------------------------------------------- */

    const getUserName = () => {
        const name = (currentUser?.name || currentUser?.full_name || user?.name || user?.full_name || currentUser?.displayName || "").trim();
        if (
            name &&
            !name.endsWith("User")
        ) {
            return name;
        }

        if (currentUser?.email || user?.email) {
            return (currentUser?.email || user?.email).split("@")[0];
        }

        return `${activeRole} User`;
    };

    const userName = getUserName();

    const initials = getInitials(userName);

    const displayRole = getDisplayRole(activeRole);

    /* ---------------------------------------------------------
       CLOSE SIDEBAR
       --------------------------------------------------------- */

    const handleNavClick = () => {
        if (typeof onClose === "function") {
            onClose();
        }

        /*
         * Close the profile dropdown whenever navigation occurs.
         */
        setIsProfileMenuOpen(false);
    };

    /* ---------------------------------------------------------
       CLOSE PROFILE DROPDOWN WHEN CLICKING OUTSIDE
       --------------------------------------------------------- */

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                profileMenuRef.current &&
                !profileMenuRef.current.contains(event.target)
            ) {
                setIsProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener(
                "mousedown",
                handleClickOutside
            );
        }

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, [isProfileMenuOpen]);

    /* ---------------------------------------------------------
       ESC KEY
       --------------------------------------------------------- */

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setIsProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener("keydown", handleEscape);
        }

        return () => {
            document.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, [isProfileMenuOpen]);

    /* ---------------------------------------------------------
       PROFILE MENU TOGGLE
       --------------------------------------------------------- */

    const handleProfileMenuToggle = (event) => {
        event.stopPropagation();

        setIsProfileMenuOpen((previousState) => !previousState);
    };

    /* ---------------------------------------------------------
       PROFILE
       --------------------------------------------------------- */

    const handleProfile = () => {
        setIsProfileMenuOpen(false);

        navigate(getProfileBasePath(activeRole));

        if (typeof onClose === "function") {
            onClose();
        }
    };

    /* ---------------------------------------------------------
       EDIT PROFILE
       --------------------------------------------------------- */

    const handleEditProfile = () => {
        setIsProfileMenuOpen(false);

        navigate(`${getProfileBasePath(activeRole)}?edit=true&t=${Date.now()}`);

        if (typeof onClose === "function") {
            onClose();
        }
    };

    /* ---------------------------------------------------------
       LOGOUT
       --------------------------------------------------------- */

    const handleLogout = async () => {
        setIsProfileMenuOpen(false);

        try {
            if (typeof logout === "function") {
                await logout();
            }
        } catch (error) {
            console.error("Logout failed:", error);
        }

        navigate("/login");

        if (typeof onClose === "function") {
            onClose();
        }
    };

    /* ---------------------------------------------------------
       LOGO CLICK
       --------------------------------------------------------- */

    const handleLogoClick = () => {
        /*
         * Send the user to the appropriate dashboard instead
         * of sending an already-authenticated user to /login.
         */
        switch (activeRole) {
            case "Reporting_Manager":
                navigate("/reporting-manager/dashboard");
                break;

            case "L_D":
                navigate("/ld/dashboard");
                break;

            case "HR":
                navigate("/hr/dashboard");
                break;

            case "CEO":
                navigate("/ceo/dashboard");
                break;

            case "Employee":
            default:
                navigate("/employee/dashboard");
                break;
        }

        handleNavClick();
    };

    /* ---------------------------------------------------------
       LOGO KEYBOARD HANDLER
       --------------------------------------------------------- */

    const handleLogoKeyDown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleLogoClick();
        }
    };

    /* ---------------------------------------------------------
       PROFILE WIDGET KEYBOARD HANDLER
       --------------------------------------------------------- */

    const handleProfileWidgetKeyDown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleProfileMenuToggle(event);
        }
    };

    /* =========================================================
       RENDER
       ========================================================= */

    return (
        <aside
            className={`sidebar ${isOpen ? "is-mobile-open" : ""}`}
            onWheel={(e) => {
                if (navRef.current) {
                    navRef.current.scrollTop += e.deltaY;
                }
            }}
        >
            {/* =================================================
                SIDEBAR TOP
                ================================================= */}

            <div className="sidebar-top">
                {/* -------------------------------------------------
                    BRAND
                    ------------------------------------------------- */}

                <div className="sidebar-brand-wrapper">
                    <div
                        className="sidebar-brand"
                        onClick={handleLogoClick}
                        onKeyDown={handleLogoKeyDown}
                        role="button"
                        tabIndex={0}

                        aria-label="Go to dashboard"
                    >
                        <img
                            src={emergere_logo}
                            alt="Emergere Technologies"
                            className="sidebar-logo"
                            title="Emergere Tech"
                        />
                    </div>

                    {/* -------------------------------------------------
                        MOBILE CLOSE BUTTON
                        ------------------------------------------------- */}

                    <button
                        type="button"
                        className="sidebar-mobile-close-btn"
                        onClick={onClose}
                        aria-label="Close sidebar"
                    >
                        <X
                            size={22}
                            color="#080808"
                        />
                    </button>
                </div>

                {/* -------------------------------------------------
                    NAVIGATION
                    ------------------------------------------------- */}

                <nav
                    className="sidebar-nav"
                    ref={navRef}
                    aria-label="Main navigation"
                >
                    {menuItems.map((item) => {
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={handleNavClick}
                                className={({ isActive }) =>
                                    `nav-item ${isActive ? "active" : ""
                                    }`
                                }
                            >
                                <span className="nav-icon">
                                    {typeof Icon === "string" ? (
                                        <img
                                            src={Icon}
                                            alt=""
                                            className={`nav-icon-img ${item.label === "LMS Copilot" ? "nav-icon-copilot" : ""}`}
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        Icon && (
                                            <Icon
                                                size={18}
                                                strokeWidth={2}
                                                aria-hidden="true"
                                            />
                                        )
                                    )}
                                </span>

                                <span className="nav-label">
                                    {item.label}
                                </span>
                            </NavLink>
                        );
                    })}
                </nav>
            </div>

            {/* =================================================
                USER PROFILE SECTION
                ================================================= */}

            <div
                className="user-profile-section"
                ref={profileMenuRef}
            >
                {/* -------------------------------------------------
                    PROFILE DROPDOWN
                    ------------------------------------------------- */}

                {isProfileMenuOpen && (
                    <div
                        className="profile-dropdown-menu"
                        role="menu"
                        aria-orientation="vertical"
                    >
                        {/* PROFILE */}

                        <button
                            type="button"
                            className="profile-dropdown-item"
                            onClick={handleProfile}
                            role="menuitem"
                        >
                            <User
                                size={18}
                                strokeWidth={2}
                                className="profile-dropdown-icon"
                                aria-hidden="true"
                            />

                            <span>Profile</span>
                        </button>

                        {/* EDIT PROFILE */}

                        {/* <button
                            type="button"
                            className="profile-dropdown-item"
                            onClick={handleEditProfile}
                            role="menuitem"
                        >
                            <Pencil
                                size={18}
                                strokeWidth={2}
                                className="profile-dropdown-icon"
                                aria-hidden="true"
                            />

                            <span>Edit Profile</span>
                        </button> */}

                        {/* DIVIDER */}

                        <div className="profile-dropdown-divider" />

                        {/* LOGOUT */}

                        <button
                            type="button"
                            className="profile-dropdown-item profile-dropdown-logout"
                            onClick={handleLogout}
                            role="menuitem"
                        >
                            <LogOut
                                size={18}
                                strokeWidth={2}
                                className="profile-dropdown-icon"
                                aria-hidden="true"
                            />

                            <span>Logout</span>
                        </button>
                    </div>
                )}

                {/* -------------------------------------------------
                    BOTTOM USER PROFILE WIDGET
                    ------------------------------------------------- */}

                <div
                    className="user-profile-widget"
                    onClick={handleProfileMenuToggle}
                    onKeyDown={handleProfileWidgetKeyDown}
                    role="button"
                    tabIndex={0}
                    aria-haspopup="menu"
                    aria-expanded={isProfileMenuOpen}
                    aria-label={`Open profile menu for ${userName}`}
                >
                    {/* AVATAR */}

                    <div className="avatar-circle">
                        {initials}
                    </div>

                    {/* USER INFORMATION */}

                    <div className="user-info">
                        <span
                            className="user-name"
                            title={userName}
                        >
                            {userName}
                        </span>

                        <div className="user-role-dot">
                            <span
                                className="status-dot"
                                aria-hidden="true"
                            />

                            <span className="user-role-text">
                                {displayRole}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}

