import React, { useState, useEffect } from "react";
import axios from "axios";
import employeeIcon from "../../../assets/L&D/employee.svg";
import activeIcon from "../../../assets/L&D/active.svg";
import courseIcon from "../../../assets/L&D/course.svg";
import pendingIcon from "../../../assets/L&D/pending.svg";
import bluebiglineSvg from "../../../assets/Certification/bluebigline.svg";
import { fetchAllEmployees } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function StatCards({
    stats = [],
    pendingCount,
    totalEmployeesCount,
    totalCoursesCount,
    activeLearnersCount,
    isLoading = false,
}) {
    const { token } = useAuth();
    const [liveEmployeeCount, setLiveEmployeeCount] = useState(totalEmployeesCount ?? null);
    const [liveCourseCount, setLiveCourseCount] = useState(totalCoursesCount ?? null);

    useEffect(() => {
        if (totalEmployeesCount !== undefined && totalEmployeesCount !== null) {
            setLiveEmployeeCount(totalEmployeesCount);
            return;
        }
        let isMounted = true;
        const loadEmployeeCount = async () => {
            try {
                const emps = await fetchAllEmployees(token);
                if (isMounted) {
                    setLiveEmployeeCount(Array.isArray(emps) ? emps.length : 0);
                }
            } catch (err) {
                console.error("Failed to fetch employees count from Azure AD:", err);
                if (isMounted) setLiveEmployeeCount(0);
            }
        };
        loadEmployeeCount();
        return () => {
            isMounted = false;
        };
    }, [token, totalEmployeesCount]);

    useEffect(() => {
        if (totalCoursesCount !== undefined && totalCoursesCount !== null) {
            setLiveCourseCount(totalCoursesCount);
            return;
        }
        let isMounted = true;
        const loadCourseCount = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/courses`);
                if (isMounted) {
                    setLiveCourseCount(Array.isArray(res.data) ? res.data.length : 0);
                }
            } catch (err) {
                console.error("Failed to fetch courses count from database:", err);
                if (isMounted) setLiveCourseCount(0);
            }
        };
        loadCourseCount();
        return () => {
            isMounted = false;
        };
    }, [totalCoursesCount]);

    const getIcon = (key) => {
        switch (key) {
            case "employees":
                return <img src={employeeIcon} alt="Total Employees" style={{ width: "20px", height: "20px", display: "block" }} />;
            case "learners":
                return <img src={activeIcon} alt="Active Learners" style={{ width: "20px", height: "20px", display: "block" }} />;
            case "courses":
                return <img src={courseIcon} alt="Total Courses" style={{ width: "20px", height: "20px", display: "block" }} />;
            case "pending":
                return <img src={pendingIcon} alt="Pending Approvals" style={{ width: "20px", height: "20px", display: "block" }} />;
            default:
                return <img src={employeeIcon} alt="Icon" style={{ width: "20px", height: "20px", display: "block" }} />;
        }
    };

    const renderValue = (stat) => {
        let val = null;
        if (stat.key === "employees") {
            val = liveEmployeeCount !== null && liveEmployeeCount !== undefined ? liveEmployeeCount : stat.value;
        } else if (stat.key === "pending") {
            val = pendingCount !== null && pendingCount !== undefined ? pendingCount : stat.value;
        } else if (stat.key === "courses") {
            val = liveCourseCount !== null && liveCourseCount !== undefined ? liveCourseCount : stat.value;
        } else if (stat.key === "learners") {
            val = activeLearnersCount !== undefined && activeLearnersCount !== null ? activeLearnersCount : stat.value;
        } else {
            val = stat.value;
        }

        // Only show skeleton while actively fetching
        if (isLoading && (val === null || val === undefined || val === "—" || val === "...")) {
            return (
                <span
                    className="ld-skeleton-block"
                    style={{ width: "42px", height: "22px", display: "inline-block" }}
                />
            );
        }

        // Option B: display single digit 0 (and natural integers without leading zero padding)
        const numericVal = Number(val);
        if (!isNaN(numericVal)) {
            return String(numericVal);
        }
        return val !== null && val !== undefined && val !== "—" && val !== "..." ? String(val) : "0";
    };

    return (
        <div className="ld-stats-grid">
            {stats.map((stat) => (
                <div
                    key={stat.key}
                    className="ld-stat-card"
                >
                    <div className="ld-stat-icon-circle">
                        {getIcon(stat.key)}
                    </div>
                    <div className="ld-stat-content">
                        <span className="ld-stat-value">{renderValue(stat)}</span>
                        <span className="ld-stat-label">{stat.label}</span>
                    </div>
                    <img
                        src={bluebiglineSvg}
                        alt=""
                        className="ld-stat-bottom-line"
                    />
                </div>
            ))}
        </div>
    );
}
