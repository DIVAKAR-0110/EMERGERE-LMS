import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import "../../../styles/reportingmanager/LearningRecords.css";

// Parse date string to timestamp for chronological sorting
const parseDateMs = (dStr) => {
    if (!dStr || dStr === "—") return 0;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

// Parse hours string e.g. "0 mins", "4 hrs", "1h 45m", "30 mins", "3h 45m" to total minutes
const parseHoursToMinutes = (str) => {
    if (!str || str === "—") return 0;
    const s = String(str).toLowerCase().trim();
    let totalMinutes = 0;
    const hMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
    if (hMatch) {
        totalMinutes += parseFloat(hMatch[1]) * 60;
    }
    const mMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/);
    if (mMatch) {
        totalMinutes += parseFloat(mMatch[1]);
    }
    if (!hMatch && !mMatch) {
        const num = parseFloat(s);
        if (!isNaN(num)) totalMinutes = num * 60;
    }
    return totalMinutes;
};

export default function CoursesTable({ data = [], isLoading = false }) {
    const itemsPerPage = 10;
    const tableScrollBodyRef = useRef(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

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

    const renderSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) {
            return <ArrowUpDown size={12} className="rm-lr-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={12} className="rm-lr-sort-icon active" />
        ) : (
            <ArrowDown size={12} className="rm-lr-sort-icon active" />
        );
    };

    // Reset to page 1 whenever data or sortConfig changes
    useEffect(() => {
        setCurrentPage(1);
    }, [data, sortConfig]);

    const totalCount = data.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

    // Sort data based on active column sort config
    const sortedData = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction || !Array.isArray(data)) {
            return data;
        }

        return [...data].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "employee": {
                    const nameA = String(a.employeeName || a.name || "").trim();
                    const nameB = String(b.employeeName || b.name || "").trim();
                    comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
                    break;
                }
                case "department": {
                    const deptA = String(a.department || a.designation || "").trim();
                    const deptB = String(b.department || b.designation || "").trim();
                    comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
                    break;
                }
                case "course": {
                    const cA = String(a.course || a.title || "").trim();
                    const cB = String(b.course || b.title || "").trim();
                    comparison = cA.localeCompare(cB, undefined, { sensitivity: "base" });
                    break;
                }
                case "enrollmentDate": {
                    comparison = parseDateMs(a.enrollmentDate) - parseDateMs(b.enrollmentDate);
                    break;
                }
                case "hoursLogged": {
                    comparison = parseHoursToMinutes(a.hoursLogged) - parseHoursToMinutes(b.hoursLogged);
                    break;
                }
                case "progress": {
                    const pA = Number(a.progress) || 0;
                    const pB = Number(b.progress) || 0;
                    comparison = pA - pB;
                    break;
                }
                case "status": {
                    const sA = String(a.status || "").trim();
                    const sB = String(b.status || "").trim();
                    comparison = sA.localeCompare(sB, undefined, { sensitivity: "base" });
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [data, sortConfig]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(totalCount, (currentPage - 1) * itemsPerPage + paginatedData.length);

    const getPageItems = () => {
        if (totalPages <= 4) {
            if (totalPages <= 3) {
                return Array.from({ length: totalPages }, (_, i) => i + 1);
            }
            if (currentPage <= 2) {
                return [1, 2, "dots", 4];
            }
            return [1, "dots", 3, 4];
        }
        if (currentPage <= 2) {
            return [1, 2, "dots", totalPages];
        }
        if (currentPage >= totalPages - 1) {
            return [1, "dots", totalPages - 1, totalPages];
        }
        return [currentPage - 1, currentPage, "dots", totalPages];
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "On track":
                return "rm-status-badge rm-status-on-track";
            case "Excellent":
                return "rm-status-badge rm-status-excellent";
            case "Low Progress":
                return "rm-status-badge rm-status-low-progress";
            case "Completed":
                return "rm-status-badge rm-status-completed";
            case "Not Started":
                return "rm-status-badge rm-status-not-started";
            default:
                return "rm-status-badge";
        }
    };

    return (
        <div className="rm-records-table-container-card">
            <div className="rm-records-table-scroll-body" ref={tableScrollBodyRef}>
                <table className={`rm-records-data-table rm-courses-table-layout ${paginatedData.length >= itemsPerPage || paginatedData.length === 0 ? "ld-table-fill" : ""}`}>
                    <thead>
                        <tr className="rm-records-table-header-row">
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("employee")}
                                title="Sort by Employee"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Employee</span>
                                    {renderSortIcon("employee")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("department")}
                                title="Sort by Department"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Department</span>
                                    {renderSortIcon("department")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("course")}
                                title="Sort by Course"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Course</span>
                                    {renderSortIcon("course")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("enrollmentDate")}
                                title="Sort by Enrollment Date"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Enrollment Date</span>
                                    {renderSortIcon("enrollmentDate")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("progress")}
                                title="Sort by Learning Progress"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Learning Progress</span>
                                    {renderSortIcon("progress")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("hoursLogged")}
                                title="Sort by Hours Logged"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Hours Logged</span>
                                    {renderSortIcon("hoursLogged")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("status")}
                                title="Sort by Status"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Status</span>
                                    {renderSortIcon("status")}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <TableSkeletonRows rows={itemsPerPage} columns={7} />
                        ) : paginatedData && paginatedData.length > 0 ? (
                            paginatedData.map((row) => (
                                <tr key={row.id}>
                                    {/* Employee Column */}
                                    <td>
                                        <div className="rm-employee-info-cell">
                                            <div className="rm-emp-details">
                                                <span className="rm-employee-name-text" title={row.employeeName}>{row.employeeName}</span>
                                                {(row.employee_id || row.employeeId) && (
                                                    <span className="rm-emp-id-sub">{row.employee_id || row.employeeId}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Designation / Department */}
                                    <td className="rm-text-secondary" title={row.department || row.designation || "—"}>
                                        {row.department || row.designation || "—"}
                                    </td>

                                    {/* Course */}
                                    <td className="rm-text-bold-title" title={row.course}>
                                        {row.course}
                                    </td>

                                    {/* Enrollment Date */}
                                    <td className="rm-text-secondary">{row.enrollmentDate}</td>

                                    {/* Learning Progress */}
                                    <td className="rm-td-progress">
                                        <div className="rm-progress-bar-cell">
                                            <div className="rm-progress-track">
                                                <div
                                                    className="rm-progress-fill"
                                                    style={{ width: `${row.progress}%` }}
                                                />
                                            </div>
                                            <span className="rm-progress-percentage">{row.progress}%</span>
                                        </div>
                                    </td>

                                    {/* Hours Logged */}
                                    <td className="rm-td-hours rm-text-secondary">{row.hoursLogged}</td>

                                    {/* Status Badge */}
                                    <td className="rm-td-status">
                                        <span className={getStatusClass(row.status)}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr className="ld-empty-table-row">
                                <td colSpan={7} className="ld-empty-table-cell">
                                    <div className="ld-empty-table-state">
                                        <img
                                            src={openBookIcon}
                                            alt="No records found"
                                            className="ld-empty-table-icon"
                                        />
                                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No records found.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination Footer (Matching Employee Directory) */}
            <div className="ld-directory-footer">
                <span>Showing {startItem} to {endItem} of {totalCount} courses</span>

                <div className="ld-pagination-controls">
                    <button
                        type="button"
                        className="ld-page-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        title="Previous Page"
                    >
                        <ChevronLeft size={14} />
                    </button>

                    {getPageItems().map((item, index) => {
                        if (item === "dots") {
                            return (
                                <span key={`dots-${index}`} className="ld-pagination-ellipsis">
                                    ...
                                </span>
                            );
                        }
                        return (
                            <button
                                key={`page-${item}`}
                                type="button"
                                className={`ld-page-btn ${currentPage === item ? "active" : ""}`}
                                onClick={() => setCurrentPage(item)}
                            >
                                {item}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        className="ld-page-btn"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        title="Next Page"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
