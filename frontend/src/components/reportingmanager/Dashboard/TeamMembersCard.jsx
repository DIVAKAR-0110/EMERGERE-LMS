import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import eye from "../../../assets/Dashboard/eye.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { fetchTeamDashboardSummary } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

const parseHoursToMinutes = (hStr) => {
    if (!hStr || hStr === "—") return -1;
    const hMatch = String(hStr).match(/(\d+(?:\.\d+)?)\s*h/i);
    const mMatch = String(hStr).match(/(\d+)\s*m/i);
    let total = 0;
    if (hMatch) total += parseFloat(hMatch[1]) * 60;
    if (mMatch) total += parseInt(mMatch[1], 10);
    if (total > 0) return total;
    const num = parseFloat(hStr);
    return isNaN(num) ? -1 : num * 60;
};

const renderSortIcon = (columnKey, sortConfig) => {
    if (sortConfig.key !== columnKey) {
        return <ArrowUpDown size={12} className="rm-sort-icon inactive" />;
    }
    return sortConfig.direction === "asc" ? (
        <ArrowUp size={12} className="rm-sort-icon active" />
    ) : (
        <ArrowDown size={12} className="rm-sort-icon active" />
    );
};

export default function TeamMembersCard() {
    const { token } = useAuth();
    const resolvedToken = token || localStorage.getItem("lms_token");
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [hoveredProgress, setHoveredProgress] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const loadTeamSummary = async () => {
            setIsLoading(true);
            try {
                const authToken = resolvedToken || localStorage.getItem("lms_token");
                const data = await fetchTeamDashboardSummary(authToken);
                if (isMounted) {
                    setMembers(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Failed to load team dashboard summary:", err);
                if (isMounted) setMembers([]);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        if (resolvedToken) {
            loadTeamSummary();
        } else {
            setIsLoading(false);
        }
        return () => {
            isMounted = false;
        };
    }, [resolvedToken]);

    useEffect(() => {
        const dismissPopover = () => {
            if (hoveredProgress) setHoveredProgress(null);
        };
        window.addEventListener("scroll", dismissPopover, true);
        window.addEventListener("resize", dismissPopover);
        return () => {
            window.removeEventListener("scroll", dismissPopover, true);
            window.removeEventListener("resize", dismissPopover);
        };
    }, [hoveredProgress]);

    const handleProgressMouseEnter = (e, member) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        // Prefer bottom if space above is less than 280px or space below is larger, avoiding top browser edge clipping
        const placement = (spaceAbove < 280 || spaceBelow >= spaceAbove) ? "bottom" : "top";
        const x = Math.max(140, Math.min(window.innerWidth - 140, rect.left + rect.width / 2));
        const y = placement === "top" ? rect.top - 8 : rect.bottom + 8;
        setHoveredProgress({ member, x, y, placement });
    };

    const handleProgressMouseLeave = () => {
        setHoveredProgress(null);
    };

    const handleSort = (key) => {
        setSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: "asc" };
            }
            if (prev.direction === "asc") {
                return { key, direction: "desc" };
            }
            return { key: null, direction: null };
        });
    };

    const sortedMembers = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) {
            return members;
        }
        const { key, direction } = sortConfig;
        return [...members].sort((a, b) => {
            let res = 0;
            if (key === "name") {
                const nameA = (a.name || "").trim();
                const nameB = (b.name || "").trim();
                res = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
            } else if (key === "role") {
                const roleA = (a.role || "").trim();
                const roleB = (b.role || "").trim();
                res = roleA.localeCompare(roleB, undefined, { sensitivity: "base" });
            } else if (key === "courses") {
                const isInactiveA = a.status === "InActive" || a.isInactive || a.courses === "—";
                const isInactiveB = b.status === "InActive" || b.isInactive || b.courses === "—";
                const countA = isInactiveA ? -1 : (parseInt(a.courses, 10) || 0);
                const countB = isInactiveB ? -1 : (parseInt(b.courses, 10) || 0);
                res = countA - countB;
            } else if (key === "progress") {
                const isInactiveA = a.status === "InActive" || a.isInactive || a.progressPct === null || a.progressPct === undefined;
                const isInactiveB = b.status === "InActive" || b.isInactive || b.progressPct === null || b.progressPct === undefined;
                const progA = isInactiveA ? -1 : Number(a.progressPct);
                const progB = isInactiveB ? -1 : Number(b.progressPct);
                res = progA - progB;
            } else if (key === "hours") {
                const isInactiveA = a.status === "InActive" || a.isInactive || a.hours === "—";
                const isInactiveB = b.status === "InActive" || b.isInactive || b.hours === "—";
                const minsA = isInactiveA ? -1 : parseHoursToMinutes(a.hours);
                const minsB = isInactiveB ? -1 : parseHoursToMinutes(b.hours);
                res = minsA - minsB;
            } else if (key === "certifications") {
                const isInactiveA = (a.status === "InActive" || a.isInactive) && (!a.certifications || a.certifications === 0 || a.certifications === "0" || a.certifications === "—");
                const isInactiveB = (b.status === "InActive" || b.isInactive) && (!b.certifications || b.certifications === 0 || b.certifications === "0" || b.certifications === "—");
                const certsA = isInactiveA ? -1 : (parseInt(a.certifications, 10) || 0);
                const certsB = isInactiveB ? -1 : (parseInt(b.certifications, 10) || 0);
                res = certsA - certsB;
            } else if (key === "status") {
                const statA = (a.status || "").trim();
                const statB = (b.status || "").trim();
                res = statA.localeCompare(statB, undefined, { sensitivity: "base" });
            }
            return direction === "asc" ? res : -res;
        });
    }, [members, sortConfig]);

    const handleViewAll = () => {
        navigate("/reporting-manager/learning-records?tab=courses");
    };

    return (
        <div className="rm-card rm-team-members-card">
            <div className="rm-card-header rm-header-with-action">
                <h3 className="rm-card-title">Team Members</h3>
                <button
                    type="button"
                    className="rm-view-all-btn"
                    onClick={handleViewAll}
                    aria-label="View all courses in Learning Records"
                >
                    <img src={eye} className="rm-view-all-icon" alt="View" />
                    <span>View All</span>
                </button>
            </div>

            <div className="rm-table-wrapper">
                <table className={`rm-team-table ${!isLoading && members.length === 0 ? "rm-table-empty" : ""}`}>
                    <thead>
                        <tr>
                            <th
                                className={`rm-th-employee rm-sortable-th ${sortConfig.key === "name" ? "active-sort" : ""}`}
                                onClick={() => handleSort("name")}
                                title="Sort by Employee"
                            >
                                <div className="rm-th-sortable">
                                    <span>Employee</span>
                                    {renderSortIcon("name", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-role rm-sortable-th ${sortConfig.key === "role" ? "active-sort" : ""}`}
                                onClick={() => handleSort("role")}
                                title="Sort by Role"
                            >
                                <div className="rm-th-sortable">
                                    <span>Department</span>
                                    {renderSortIcon("role", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-progress rm-sortable-th ${sortConfig.key === "progress" ? "active-sort" : ""}`}
                                onClick={() => handleSort("progress")}
                                title="Sort by Learning Progress"
                            >
                                <div className="rm-th-sortable">
                                    <span>Learning Progress</span>
                                    {renderSortIcon("progress", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-hours rm-sortable-th ${sortConfig.key === "hours" ? "active-sort" : ""}`}
                                onClick={() => handleSort("hours")}
                                title="Sort by Hours Logged"
                            >
                                <div className="rm-th-sortable">
                                    <span>Hours Logged</span>
                                    {renderSortIcon("hours", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-courses rm-sortable-th ${sortConfig.key === "courses" ? "active-sort" : ""}`}
                                onClick={() => handleSort("courses")}
                                title="Sort by Courses"
                            >
                                <div className="rm-th-sortable">
                                    <span>Courses</span>
                                    {renderSortIcon("courses", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-certs rm-sortable-th ${sortConfig.key === "certifications" ? "active-sort" : ""}`}
                                onClick={() => handleSort("certifications")}
                                title="Sort by Certifications"
                            >
                                <div className="rm-th-sortable">
                                    <span>Certifications</span>
                                    {renderSortIcon("certifications", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-status rm-sortable-th ${sortConfig.key === "status" ? "active-sort" : ""}`}
                                onClick={() => handleSort("status")}
                                title="Sort by Status"
                            >
                                <div className="rm-th-sortable">
                                    <span>Status</span>
                                    {renderSortIcon("status", sortConfig)}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map((i) => (
                                <tr key={`rm-team-skel-${i}`} className="rm-table-row rm-team-skeleton-row" style={{ pointerEvents: "none" }}>
                                    {/* 1. Employee */}
                                    <td className="rm-td-employee" data-label="Employee">
                                        <div className="rm-avatar-pill">
                                            <div className="rm-emp-details">
                                                <span className="ld-skeleton-block" style={{ width: "110px", height: "13px", borderRadius: "4px" }} />
                                                <span className="ld-skeleton-block" style={{ width: "55px", height: "10px", borderRadius: "3px", marginTop: "3px" }} />
                                            </div>
                                        </div>
                                    </td>

                                    {/* 2. Role */}
                                    <td className="rm-td-role" data-label="Role">
                                        <span className="ld-skeleton-block" style={{ width: "140px", height: "14px", borderRadius: "4px" }} />
                                    </td>

                                    {/* 3. Progress */}
                                    <td className="rm-td-progress" data-label="Learning Progress">
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                                            <div className="ld-skeleton-pulse" style={{ flex: 1, height: "6px", background: "#E8EDF5", borderRadius: "3px" }} />
                                            <span className="ld-skeleton-block" style={{ width: "28px", height: "14px", borderRadius: "4px" }} />
                                        </div>
                                    </td>

                                    {/* 4. Hours */}
                                    <td className="rm-td-hours" data-label="Hours Logged">
                                        <span className="ld-skeleton-block" style={{ width: "38px", height: "14px", borderRadius: "4px" }} />
                                    </td>

                                    {/* 5. Courses */}
                                    <td className="rm-td-courses" data-label="Courses">
                                        <span className="ld-skeleton-block" style={{ width: "22px", height: "14px", borderRadius: "4px" }} />
                                    </td>

                                    {/* 6. Certifications */}
                                    <td className="rm-td-certs" data-label="Certifications">
                                        <span className="ld-skeleton-block" style={{ width: "22px", height: "14px", borderRadius: "4px" }} />
                                    </td>

                                    {/* 7. Status */}
                                    <td className="rm-td-status" data-label="Status">
                                        <span className="ld-skeleton-block" style={{ width: "78px", height: "20px", borderRadius: "10px" }} />
                                    </td>
                                </tr>
                            ))
                        ) : members.length === 0 ? (
                            <tr className="rm-empty-state-row">
                                <td colSpan={7} className="rm-empty-state-cell">
                                    <div className="rm-empty-state-content">
                                        <img
                                            src={openBookIcon}
                                            alt="No learning activities"
                                            className="emp-recent-log-empty-icon"
                                        />
                                        <span className="rm-empty-state-text">
                                            No direct reports assigned to your team yet.
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            sortedMembers.map((member) => (
                                <tr
                                    key={member.id}
                                    className="rm-table-row"
                                >
                                    {/* 1. Employee */}
                                    <td className="rm-td-employee" data-label="Employee" title={`${member.name}${member.employeeId || member.employee_id ? ` (${member.employeeId || member.employee_id})` : ""}`}>
                                        <div className="rm-avatar-pill">
                                            <div className="rm-emp-details">
                                                <span className="rm-member-name">{member.name}</span>
                                                {(member.employeeId || member.employee_id) && (
                                                    <span className="rm-emp-id-sub">{member.employeeId || member.employee_id}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* 2. Role */}
                                    <td className="rm-td-role" data-label="Role" title={member.role}>{member.role}</td>

                                    {/* 3. Progress */}
                                    <td className="rm-td-progress" data-label="Learning Progress">
                                        {member.status === "InActive" || member.isInactive || member.progressPct === null || member.progressPct === undefined ? (
                                            <span className="rm-null-hyphen">—</span>
                                        ) : (
                                            <div
                                                className="rm-progress-bar-cell"
                                                onMouseEnter={(e) => handleProgressMouseEnter(e, member)}
                                                onMouseLeave={handleProgressMouseLeave}
                                                onClick={(e) => {
                                                    if (hoveredProgress?.member?.id === member.id) {
                                                        handleProgressMouseLeave();
                                                    } else {
                                                        handleProgressMouseEnter(e, member);
                                                    }
                                                }}
                                                tabIndex={0}
                                                role="region"
                                                aria-label={`${member.name} Progress Overview`}
                                            >
                                                <div className="rm-progress-track">
                                                    <div
                                                        className="rm-progress-fill"
                                                        style={{ width: `${member.progressPct}%` }}
                                                    />
                                                </div>
                                                <span className="rm-progress-pct">{member.progressPct}%</span>
                                            </div>
                                        )}
                                    </td>

                                    {/* 4. Hours */}
                                    <td className="rm-td-hours" data-label="Hours Logged">
                                        {member.status === "InActive" || member.isInactive || member.hours === "—" ? (
                                            <span className="rm-null-hyphen">—</span>
                                        ) : (
                                            member.hours
                                        )}
                                    </td>

                                    {/* 5. Courses */}
                                    <td className="rm-td-courses" data-label="Courses">
                                        {member.status === "InActive" || member.isInactive || member.courses === "—" ? (
                                            <span className="rm-null-hyphen">—</span>
                                        ) : (
                                            member.courses
                                        )}
                                    </td>

                                    {/* 6. Certifications */}
                                    <td className="rm-td-certs" data-label="Certifications">
                                        {(member.status === "InActive" || member.isInactive) && (!member.certifications || member.certifications === 0 || member.certifications === "0" || member.certifications === "—") ? (
                                            <span className="rm-null-hyphen">—</span>
                                        ) : (
                                            member.certifications
                                        )}
                                    </td>

                                    {/* 7. Status */}
                                    <td className="rm-td-status" data-label="Status">
                                        <span className={`rm-status-badge ${member.statusType}`}>
                                            {member.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Floating Courses Popover on Hover (rendered via portal for zero clipping) */}
            {hoveredProgress && createPortal(
                <div
                    className={`rm-progress-popover rm-popover-${hoveredProgress.placement}`}
                    style={{
                        left: `${hoveredProgress.x}px`,
                        top: `${hoveredProgress.y}px`,
                    }}
                    role="tooltip"
                >
                    <div className="rm-progress-popover-header">
                        Courses
                    </div>
                    <div className="rm-progress-popover-divider" />

                    <div className="rm-progress-popover-body">
                        {(!hoveredProgress.member.coursesList || hoveredProgress.member.coursesList.length === 0) ? (
                            <div className="rm-progress-popover-empty">
                                No active course enrollments
                            </div>
                        ) : (
                            <div className="rm-progress-popover-courses-list">
                                {hoveredProgress.member.coursesList.map((course, idx) => (
                                    <div key={course.courseId || idx} className="rm-progress-popover-course-item">
                                        <div className="rm-progress-popover-course-title" title={course.courseName}>
                                            {course.courseName}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Caret pointing directly to the progress bar */}
                    <div className={`rm-progress-popover-arrow rm-arrow-${hoveredProgress.placement}`} />
                </div>,
                document.body
            )}
        </div>
    );
}
