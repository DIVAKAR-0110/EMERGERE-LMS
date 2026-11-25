import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { fetchTeamDashboardSummary } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";
import TableSkeletonRows from "../../common/TableSkeletonRows";

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

export default function TeamMembers({ onSelectMember, selectedMemberId }) {
    const { token } = useAuth();
    const resolvedToken = token || localStorage.getItem("lms_token");
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hoveredProgress, setHoveredProgress] = useState(null);

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
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const placement = (spaceAbove < 280 || spaceBelow >= spaceAbove) ? "bottom" : "top";
        const x = Math.max(140, Math.min(window.innerWidth - 140, rect.left + rect.width / 2));
        const y = placement === "top" ? rect.top - 8 : rect.bottom + 8;
        setHoveredProgress({ member, x, y, placement });
    };

    const handleProgressMouseLeave = () => {
        setHoveredProgress(null);
    };

    useEffect(() => {
        let isMounted = true;
        const loadMembers = async () => {
            setIsLoading(true);
            try {
                const membersData = await fetchTeamDashboardSummary(resolvedToken);
                if (isMounted && Array.isArray(membersData) && membersData.length > 0) {
                    const colors = ["#215EF8", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6"];
                    const mapped = membersData.map((m, idx) => {
                        const rawName = m.name || m.full_name || "Team Member";
                        const cleanName = rawName.split("(")[0].trim();
                        const initials = m.initials || cleanName
                            .split(" ")
                            .map(w => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                        const isInactive = m.isInactive || m.status === "InActive" || m.totalCourses === 0;
                        return {
                            id: m.employee_id || m.employeeId || idx + 1,
                            employee_id: m.employee_id || m.employeeId,
                            name: cleanName,
                            initials: initials,
                            avatarColor: m.avatarBg || colors[idx % colors.length],
                            hoursLogged: m.hours || (isInactive ? "—" : "0h"),
                            progress: (m.progressPct !== null && m.progressPct !== undefined && !isInactive) ? Number(m.progressPct) : null,
                            status: m.status || (isInactive ? "InActive" : "On track"),
                            statusType: m.statusType || (isInactive ? "inactive" : m.progressPct >= 100 ? "completed" : m.progressPct > 0 ? "in-progress" : "on-track"),
                            coursesList: m.coursesList || [],
                            isInactive: isInactive,
                        };
                    });
                    setMembers(mapped);
                    if (typeof onSelectMember === "function" && !selectedMemberId && mapped.length > 0) {
                        onSelectMember(mapped[0]);
                    }
                } else if (isMounted) {
                    setMembers([]);
                }
            } catch (err) {
                console.error("Failed to load live team members:", err);
                if (isMounted) setMembers([]);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        if (resolvedToken) {
            loadMembers();
        } else {
            setIsLoading(false);
        }
        return () => { isMounted = false; };
    }, [resolvedToken]);

    const tableContainerRef = useRef(null);
    const tbodyRef = useRef(null);

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
            } else if (key === "hours") {
                const isInactiveA = a.isInactive || a.status === "InActive" || a.hoursLogged === "—";
                const isInactiveB = b.isInactive || b.status === "InActive" || b.hoursLogged === "—";
                const minsA = isInactiveA ? -1 : parseHoursToMinutes(a.hoursLogged);
                const minsB = isInactiveB ? -1 : parseHoursToMinutes(b.hoursLogged);
                res = minsA - minsB;
            } else if (key === "progress") {
                const isInactiveA = a.isInactive || a.status === "InActive" || a.progress === null || a.progress === undefined;
                const isInactiveB = b.isInactive || b.status === "InActive" || b.progress === null || b.progress === undefined;
                const progA = isInactiveA ? -1 : Number(a.progress);
                const progB = isInactiveB ? -1 : Number(b.progress);
                res = progA - progB;
            } else if (key === "status") {
                const statA = (a.status || "").trim();
                const statB = (b.status || "").trim();
                res = statA.localeCompare(statB, undefined, { sensitivity: "base" });
            }
            return direction === "asc" ? res : -res;
        });
    }, [members, sortConfig]);

    return (
        <div className="rm-tm-card rm-tm-members-card">
            <div className="rm-tm-card-header">
                <h2 className="rm-tm-card-title">Team Members</h2>
            </div>

            <div
                className={`rm-tm-table-container ${members.length === 0 ? "rm-tm-empty" : ""}`}
                ref={tableContainerRef}
                style={{
                    overflowY: members.length === 0 ? "hidden" : "auto",
                }}
            >
                <table className="rm-tm-table">
                    <thead>
                        <tr>
                            <th
                                className={`rm-th-employee rm-sortable-th ${sortConfig.key === "name" ? "active-sort" : ""}`}
                                onClick={() => handleSort("name")}
                                title="Sort by Employee"
                            >
                                <div className="rm-th-flex">
                                    <span>Employee</span>
                                    {renderSortIcon("name", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-hours rm-sortable-th ${sortConfig.key === "hours" ? "active-sort" : ""}`}
                                onClick={() => handleSort("hours")}
                                title="Sort by Hours Logged"
                            >
                                <div className="rm-th-flex">
                                    <span>Hours Logged</span>
                                    {renderSortIcon("hours", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-progress rm-sortable-th ${sortConfig.key === "progress" ? "active-sort" : ""}`}
                                onClick={() => handleSort("progress")}
                                title="Sort by Learning Progress"
                            >
                                <div className="rm-th-flex">
                                    <span>Learning Progress</span>
                                    {renderSortIcon("progress", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-status rm-sortable-th ${sortConfig.key === "status" ? "active-sort" : ""}`}
                                onClick={() => handleSort("status")}
                                title="Sort by Status"
                            >
                                <div className="rm-th-flex">
                                    <span>Status</span>
                                    {renderSortIcon("status", sortConfig)}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    {isLoading ? (
                        <tbody ref={tbodyRef}>
                            <TableSkeletonRows rows={5} columns={4} />
                        </tbody>
                    ) : members.length > 0 ? (
                        <tbody ref={tbodyRef}>
                            {sortedMembers.filter((member) => member && member.name).map((member, index) => {
                                const isSelected = selectedMemberId && (selectedMemberId === member.employee_id || selectedMemberId === member.id);
                                return (
                                    <tr 
                                        key={member.id || index} 
                                        className={`rm-tm-table-row ${isSelected ? "selected" : ""}`}
                                        onClick={() => typeof onSelectMember === "function" && onSelectMember(member)}
                                    >
                                    <td className="rm-td-employee" data-label="Employee" title={`${member.name}${member.employee_id || member.employeeId ? ` (${member.employee_id || member.employeeId})` : ""}`}>
                                        <div className="rm-employee-info-cell">
                                            <div className="rm-emp-details">
                                                <span className="rm-member-name-s">{member.name}</span>
                                                {(member.employee_id || member.employeeId) && (
                                                    <span className="rm-emp-id-sub">{member.employee_id || member.employeeId}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="rm-td-hours" data-label="Hours Logged">
                                        <span className="rm-hours-text">{member.hoursLogged}</span>
                                    </td>
                                    <td className="rm-td-progress" data-label="Learning Progress">
                                        {member.isInactive || member.status === "InActive" || member.progress === null || member.progress === undefined ? (
                                            <span className="rm-null-hyphen">—</span>
                                        ) : (
                                            <div 
                                                className="rm-progress-cell-wrapper"
                                                onMouseEnter={(e) => handleProgressMouseEnter(e, member)}
                                                onMouseLeave={handleProgressMouseLeave}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (hoveredProgress?.member?.id === member.id) {
                                                        handleProgressMouseLeave();
                                                    } else {
                                                        handleProgressMouseEnter(e, member);
                                                    }
                                                }}
                                                tabIndex={0}
                                                role="region"
                                                aria-label={`${member.name} Courses`}
                                            >
                                                <div className="rm-progress-bar-track">
                                                    <div
                                                        className="rm-progress-bar-fill"
                                                        style={{ width: `${member.progress}%` }}
                                                    />
                                                </div>
                                                <span className="rm-progress-percentage">{member.progress}%</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="rm-td-status" data-label="Status">
                                        <span className={`rm-status-badge badge-${member.statusType} rm-badge-${member.statusType} ${member.statusType}`}>
                                            {member.status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    ) : null}
                </table>

                {!isLoading && members.length === 0 && (
                    <div className="rm-empty-state rm-tm-empty-state">
                        <img
                            src={openBookIcon}
                            alt="No team members found"
                            className="rm-empty-state-icon"
                        />
                        <h3>No team members found.</h3>
                    </div>
                )}
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

