import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import emergere_logo from "../../assets/emergere_logo3.png";
import { useAuth } from "../../context/AuthContext";
import FirstTimeProfileModal from "../Profile/FirstTimeProfileModal";
import "../../styles/Sidebar.css";

export const AppLayout = () => {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const { role, currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const getRoleFromPath = (pathname) => {
        if (!pathname) return null;
        if (pathname.startsWith("/reporting-manager")) return "Reporting_Manager";
        if (pathname.startsWith("/ld")) return "L_D";
        if (pathname.startsWith("/hr")) return "HR";
        if (pathname.startsWith("/ceo")) return "CEO";
        if (pathname.startsWith("/employee")) return "Employee";
        return null;
    };

    const activeRole = getRoleFromPath(location.pathname) || role || "Employee";
    const userName =
        currentUser?.name && !currentUser.name.endsWith("User")
            ? currentUser.name
            : currentUser?.displayName ||
              currentUser?.full_name ||
              (currentUser?.email ? currentUser.email.split("@")[0] : null) ||
              `${activeRole} User`;
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "AK";

    const handleMobileLogoClick = () => {
        if (activeRole === "Reporting_Manager" || activeRole === "ReportingManager" || activeRole === "Reporting Manager") {
            navigate("/reporting-manager/dashboard");
        } else if (activeRole === "L_D" || activeRole === "L&D" || activeRole === "LD") {
            navigate("/ld/dashboard");
        } else {
            navigate("/employee/dashboard");
        }
    };

    return (
        <div className="app-container">
            {/* MOBILE TOP BAR (Only visible on screens < 1024px) */}
            <header className="mobile-top-bar">
                <button
                    type="button"
                    className="mobile-hamburger-btn"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    aria-label="Open Navigation Menu"
                >
                    <Menu size={24} color="#080808" />
                </button>

                <div
                    className="mobile-brand-logo"
                    onClick={handleMobileLogoClick}
                    role="button"
                    tabIndex={0}
                >
                    <img
                        src={emergere_logo}
                        alt="Emergere Technologies"
                        className="mobile-logo-img"
                    />
                </div>

                <div
                    className="mobile-user-avatar"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    title={userName}
                >
                    {initials}
                </div>
            </header>

            {/* BACKDROP OVERLAY FOR MOBILE SIDEBAR */}
            {isMobileSidebarOpen && (
                <div
                    className="mobile-sidebar-backdrop"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* SIDEBAR */}
            <Sidebar
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* MAIN CONTENT */}
            <main className="main-content">
                <div className="page-body">
                    <Outlet />
                </div>
            </main>

            {/* FIRST-TIME LOGIN PROFILE ONBOARDING MODAL */}
            <FirstTimeProfileModal />
        </div>
    );
};
