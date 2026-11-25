import React, { useState, useMemo, useEffect, useRef } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import searchIcon from "../../../assets/coursemanagement/search.svg";
import dropdownIcon from "../../../assets/coursemanagement/dropdown.svg";
import filtersIcon from "../../../assets/coursemanagement/filters.svg";
import eyeIcon from "../../../assets/coursemanagement/eye.svg";
import leftArrow from "../../../assets/coursemanagement/left-arrow.svg";
import rightArrow from "../../../assets/coursemanagement/right-arrow.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import AssignCourseFilterDrawer from "./AssignCourseFilterDrawer";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import { sanitizeSingleSpaceInput } from "../../../utils/validationUtils";

// Robust date parsing for course assignments
const parseCourseDate = (courseDate, rawDate) => {
    if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            return d;
        }
    }
    if (!courseDate || courseDate === "—") return null;
    const str = String(courseDate).trim().toLowerCase();
    if (str === "today") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (str === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    const d = new Date(courseDate);
    if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
    }
    return null;
};

// Check if date falls in [startDateStr, endDateStr]
const matchesDateRange = (dateObj, startDateStr, endDateStr) => {
    if (!startDateStr && !endDateStr) return true;
    if (!dateObj) return false;

    if (startDateStr) {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        if (dateObj < start) return false;
    }
    if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        if (dateObj > end) return false;
    }
    return true;
};

export default function AssignCourseTab({
    assignments = [],
    isLoading = false,
    onOpenAssignModal,
    onViewAssignmentDetails,
    currentAdminId,
    currentUser,
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDeptFilter, setSelectedDeptFilter] = useState(["All"]);
    const [selectedCourseFilter, setSelectedCourseFilter] = useState("All Courses");
    const [selectedProviderFilter, setSelectedProviderFilter] = useState(["All"]);
    const [selectedStatusFilter, setSelectedStatusFilter] = useState(["All"]);
    const [assignedStartDate, setAssignedStartDate] = useState("");
    const [assignedEndDate, setAssignedEndDate] = useState("");
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

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
            return <ArrowUpDown size={12} className="ld-cm-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={12} className="ld-cm-sort-icon active" />
        ) : (
            <ArrowDown size={12} className="ld-cm-sort-icon active" />
        );
    };

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const tableContainerRef = useRef(null);

    const safeAssignments = Array.isArray(assignments) ? assignments : [];

    // Filter departments derived from assignments
    const availableDepartmentsList = useMemo(() => {
        const map = new Map();
        safeAssignments.forEach((a) => {
            const dept = a.employee?.department || a.employee?.role || a.department;
            if (dept && dept !== "—" && String(dept).toLowerCase() !== "employee") {
                const key = dept.trim().toUpperCase();
                if (!map.has(key)) map.set(key, dept.trim());
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [safeAssignments]);

    // Filter providers derived from assignments (case-insensitive deduplication)
    const availableProvidersList = useMemo(() => {
        const map = new Map();
        safeAssignments.forEach((a) => {
            const raw = a.provider;
            if (raw && raw !== "—") {
                const key = raw.trim().toUpperCase();
                if (!map.has(key)) {
                    const formatted = raw
                        .trim()
                        .split(" ")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        .join(" ");
                    map.set(key, formatted);
                }
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [safeAssignments]);

    // Filter courses derived from assignments
    const courseOptions = useMemo(() => {
        const set = new Set(safeAssignments.map((a) => a.course).filter(Boolean));
        return ["All Courses", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [safeAssignments]);

    // Available statuses
    const availableStatusesList = useMemo(() => {
        const defaultStatuses = ["Assigned", "Not Started", "In Progress", "Completed", "Overdue"];
        const set = new Set(defaultStatuses);
        safeAssignments.forEach((a) => {
            if (a.status && a.status.trim() && a.status !== "—") {
                set.add(a.status.trim());
            }
        });
        return Array.from(set);
    }, [safeAssignments]);

    // Count of active drawer filters
    const activeFiltersCount =
        (!selectedDeptFilter.includes("All") && !selectedDeptFilter.includes("All Departments") && selectedDeptFilter.length > 0 ? 1 : 0) +
        (!selectedProviderFilter.includes("All") && !selectedProviderFilter.includes("All Providers") && selectedProviderFilter.length > 0 ? 1 : 0) +
        (!selectedStatusFilter.includes("All") && !selectedStatusFilter.includes("All Status") && selectedStatusFilter.length > 0 ? 1 : 0) +
        (assignedStartDate || assignedEndDate ? 1 : 0);

    const handleClearAllFilters = () => {
        setSelectedDeptFilter(["All"]);
        setSelectedProviderFilter(["All"]);
        setSelectedStatusFilter(["All"]);
        setAssignedStartDate("");
        setAssignedEndDate("");
    };

    // Reset page on filter or sortConfig change
    useEffect(() => {
        setCurrentPage(1);
    }, [
        searchTerm,
        selectedDeptFilter,
        selectedCourseFilter,
        selectedProviderFilter,
        selectedStatusFilter,
        assignedStartDate,
        assignedEndDate,
        sortConfig,
    ]);

    // Filter assignments
    const filteredAssignments = useMemo(() => {
        const query = (searchTerm || "").toLowerCase().trim();
        return safeAssignments.filter((a) => {
            const assignId = String(a.assignmentId || a.assignment_id || a.requestId || a.request_id || a.id || a.code || "").toLowerCase();
            const courseTitle = String(a.course || a.course_title || a.courseName || "").toLowerCase();
            const empName = String(a.employee?.name || a.employeeName || a.name || "").toLowerCase();
            const empId = String(a.employee?.empId || a.employeeCode || a.employee_code || a.employeeId || "").toLowerCase();
            const matchesSearch = !query || assignId.includes(query) || courseTitle.includes(query) || empName.includes(query) || empId.includes(query);

            const aDept = (a.employee?.department || a.department || "").trim();
            const matchesDept =
                selectedDeptFilter.includes("All") ||
                selectedDeptFilter.includes("All Departments") ||
                selectedDeptFilter.length === 0 ||
                selectedDeptFilter.some((d) => d.toLowerCase() === aDept.toLowerCase());

            const matchesCourse =
                selectedCourseFilter === "All Courses" ||
                selectedCourseFilter === "All" ||
                (a.course && a.course.toLowerCase() === selectedCourseFilter.toLowerCase());

            const aProvider = (a.provider || "").trim();
            const matchesProvider =
                selectedProviderFilter.includes("All") ||
                selectedProviderFilter.includes("All Providers") ||
                selectedProviderFilter.length === 0 ||
                selectedProviderFilter.some((p) => p.toLowerCase() === aProvider.toLowerCase());

            const aStatus = (a.status || "").trim();
            const isAllStatus =
                selectedStatusFilter.includes("All") ||
                selectedStatusFilter.includes("All Status") ||
                selectedStatusFilter.includes("All Statuses") ||
                selectedStatusFilter.length === 0;
            const matchesStatus = isAllStatus
                ? true
                : selectedStatusFilter.some((s) => s.toLowerCase() === aStatus.toLowerCase());

            const dateObj = parseCourseDate(
                a.assignedOn || a.startDate,
                a.created_at || a.createdAt || a.assigned_date || a.assignedDate
            );
            const matchesAssignedDate = matchesDateRange(dateObj, assignedStartDate, assignedEndDate);

            return matchesSearch && matchesDept && matchesCourse && matchesProvider && matchesStatus && matchesAssignedDate;
        });
    }, [
        safeAssignments,
        searchTerm,
        selectedDeptFilter,
        selectedCourseFilter,
        selectedProviderFilter,
        selectedStatusFilter,
        assignedStartDate,
        assignedEndDate,
    ]);

    // Sort filtered assignments based on active sort configuration
    const sortedAssignments = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction || !Array.isArray(filteredAssignments)) {
            return filteredAssignments;
        }

        return [...filteredAssignments].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "assignmentId": {
                    const idA = String(a.assignmentId || "").trim();
                    const idB = String(b.assignmentId || "").trim();
                    comparison = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
                    break;
                }
                case "employee": {
                    const nameA = String(a.employee?.name || a.name || "").trim();
                    const nameB = String(b.employee?.name || b.name || "").trim();
                    comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
                    break;
                }
                case "department": {
                    const deptA = String(a.employee?.department || a.employeeDepartment || a.department || "").trim();
                    const deptB = String(b.employee?.department || b.employeeDepartment || b.department || "").trim();
                    comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
                    break;
                }
                case "course": {
                    const cA = String(a.course || a.courseTitle || "").trim();
                    const cB = String(b.course || b.courseTitle || "").trim();
                    comparison = cA.localeCompare(cB, undefined, { sensitivity: "base" });
                    break;
                }
                case "assignedOn": {
                    const dateA = parseCourseDate(
                        a.assignedOn || a.startDate,
                        a.created_at || a.createdAt || a.assigned_date || a.assignedDate
                    )?.getTime() || 0;
                    const dateB = parseCourseDate(
                        b.assignedOn || b.startDate,
                        b.created_at || b.createdAt || b.assigned_date || b.assignedDate
                    )?.getTime() || 0;
                    comparison = dateA - dateB;
                    break;
                }
                case "status": {
                    const sA = String(a.status || "").trim();
                    const sB = String(b.status || "").trim();
                    comparison = sA.localeCompare(sB, undefined, { sensitivity: "base" });
                    break;
                }
                case "progress": {
                    const pA = Number(a.progress) || 0;
                    const pB = Number(b.progress) || 0;
                    comparison = pA - pB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [filteredAssignments, sortConfig]);

    const totalEntries = sortedAssignments.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    const activePage = Math.min(currentPage, totalPages);

    const startIndex = totalEntries === 0 ? 0 : (activePage - 1) * pageSize + 1;
    const endIndex = Math.min(activePage * pageSize, totalEntries);

    const displayedAssignments = useMemo(() => {
        return sortedAssignments.slice(
            (activePage - 1) * pageSize,
            activePage * pageSize
        );
    }, [sortedAssignments, activePage, pageSize]);

    const getStatusClass = (status) => {
        if (status === "In Progress") return "in-progress";
        if (status === "Not Started") return "not-started";
        if (status === "Completed") return "completed";
        if (status === "Assigned") return "assigned";
        if (status === "Overdue") return "overdue";
        if (status === "On Hold") return "on-hold";
        return "pending";
    };

    // Pagination numbers matching Figma UI (< 1 2 ... 4 >)
    const getPageNumbers = () => {
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (activePage <= 2) {
            return [1, 2, "dots", totalPages];
        }
        if (activePage >= totalPages - 1) {
            return [1, "dots", totalPages - 1, totalPages];
        }
        return [activePage - 1, activePage, "dots", totalPages];
    };

    return (
        <div className="ld-cm-assign-tab">
            {/* 1. Section Header - OUTSIDE THE TABLE */}
            <div className="ld-cm-section-header">
                <div className="ld-cm-section-title-group">
                    <h3 className="ld-cm-section-title">Assign Course</h3>
                    <p className="ld-cm-section-subtitle">
                        Assign purchased or internal courses to employees or teams.
                    </p>
                </div>
                <button
                    type="button"
                    className="ld-cm-primary-outline-btn"
                    onClick={() => onOpenAssignModal && onOpenAssignModal()}
                >
                    + Assign New Course
                </button>
            </div>

            {/* 2. Filters Bar - OUTSIDE THE TABLE */}
            <div className="ld-cm-filters-bar">
                <div className="ld-cm-search-box">
                    <img src={searchIcon} alt="search" className="ld-cm-search-icon" style={{ width: 14, height: 14 }} />
                    <input
                        type="text"
                        className="ld-cm-search-input"
                        placeholder="Search by assignment id or employee id/name or course"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(sanitizeSingleSpaceInput(e.target.value))}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                            aria-label="Clear search"
                        >
                            <X size={14} color="#94A3B8" />
                        </button>
                    )}
                </div>

                <div className="ld-cm-filters-controls-group">
                    <div className="ld-cm-filter-btn-wrapper">
                        <button
                            type="button"
                            className={`ld-cm-filter-btn ${activeFiltersCount > 0 || isFiltersOpen ? "active" : ""}`}
                            onClick={() => setIsFiltersOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={isFiltersOpen}
                            style={activeFiltersCount > 0 ? { borderColor: "#2563EB", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 500 } : {}}
                        >
                            <img src={filtersIcon} alt="filter" style={{ width: 14, height: 10 }} />
                            <span>{activeFiltersCount > 0 ? `Filters (${activeFiltersCount})` : "Filters"}</span>
                            {activeFiltersCount > 0 && (
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearAllFilters();
                                    }}
                                    style={{
                                        marginLeft: 4,
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        lineHeight: 1,
                                        color: "#EF4444",
                                    }}
                                    title="Clear filters"
                                >
                                    ×
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Table Card - ONLY CONTAINS TABLE & PAGINATION */}
            <div className="ld-cm-table-card">
                <div className={`ld-cm-table-container ${displayedAssignments.length === 0 ? "ld-table-container-empty" : ""}`} ref={tableContainerRef}>
                    <table className={`ld-cm-table ${displayedAssignments.length >= pageSize || displayedAssignments.length === 0 ? "ld-table-fill" : ""}`}>
                        <colgroup>
                            <col style={{ width: "13%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "16%" }} />
                            <col style={{ width: "16%" }} />
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "7%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("assignmentId")}
                                    title="Sort by Assignment ID"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Assignment ID</span>
                                        {renderSortIcon("assignmentId")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("employee")}
                                    title="Sort by Employee"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Employee</span>
                                        {renderSortIcon("employee")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("department")}
                                    title="Sort by Department"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Department</span>
                                        {renderSortIcon("department")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("course")}
                                    title="Sort by Course"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Course</span>
                                        {renderSortIcon("course")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("assignedOn")}
                                    title="Sort by Assigned On"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Assigned On</span>
                                        {renderSortIcon("assignedOn")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("status")}
                                    title="Sort by Status"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Status</span>
                                        {renderSortIcon("status")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("progress")}
                                    title="Sort by Progress"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Progress</span>
                                        {renderSortIcon("progress")}
                                    </div>
                                </th>
                                <th style={{ textAlign: "center" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading || assignments === null ? (
                                <TableSkeletonRows rows={pageSize} columns={8} />
                            ) : displayedAssignments.length > 0 ? (
                                displayedAssignments.map((row, idx) => (
                                    <tr key={`${row.assignmentId}_${row.employee?.empId || idx}`}>
                                        {/* Assignment ID */}
                                        <td>
                                            <span style={{ fontWeight: 400, color: "#000000", fontSize: "12px" }}>
                                                {row.assignmentId || row.assignmentCode || row.assignment_id || "—"}
                                            </span>
                                        </td>

                                        {/* Employee */}
                                        <td>
                                            <div className="ld-cm-employee-cell">
                                                <div className="ld-cm-employee-info">
                                                    <span
                                                        className="ld-cm-employee-name"
                                                        title={row.employee?.name ? String(row.employee.name).replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, "") : "Employee"}
                                                    >
                                                        {row.employee?.name ? String(row.employee.name).replace(/\s*\([A-Za-z0-9_-]+\)\s*$/, "") : "Employee"}
                                                    </span>
                                                    {(row.employee?.empId || row.employeeCode || row.employee_code || row.employeeId) && (
                                                        <span
                                                            className="ld-cm-employee-role"
                                                            title={row.employee?.empId || row.employeeCode || row.employee_code || row.employeeId}
                                                        >
                                                            {row.employee?.empId || row.employeeCode || row.employee_code || row.employeeId}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Department */}
                                        <td>
                                            <span
                                                className="ld-cm-provider-text"
                                                title={row.employee?.department || row.employeeDepartment || row.department || "—"}
                                            >
                                                {row.employee?.department || row.employeeDepartment || row.department || "—"}
                                            </span>
                                        </td>

                                        {/* Course */}
                                        <td>
                                            <div className="ld-cm-course-cell">
                                                <div className="ld-cm-course-title" title={row.course}>
                                                    {row.course}
                                                </div>
                                                <span className="ld-cm-course-provider" title={row.provider || "—"}>
                                                    {row.provider || "—"}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Assigned Date */}
                                        <td>
                                            <span className="ld-cm-date-text">
                                                {row.assignedOn || row.startDate || "Today"}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td>
                                            <span className={`ld-cm-status-badge ${getStatusClass(row.status)}`}>
                                                {row.status}
                                            </span>
                                        </td>

                                        {/* Progress Bar */}
                                        <td>
                                            <div className="ld-cm-progress-cell">
                                                <div className="ld-cm-progress-track">
                                                    <div
                                                        className={`ld-cm-progress-fill ${row.progress === 100 ? "is-100" : ""}`}
                                                        style={{ width: `${row.progress}%` }}
                                                    />
                                                </div>
                                                <span className="ld-cm-progress-label">
                                                    {row.progress}%
                                                </span>
                                            </div>
                                        </td>

                                        {/* Action */}
                                        <td style={{ textAlign: "center" }}>
                                            <div className="ld-cm-actions-group" style={{ justifyContent: "center" }}>
                                                <button
                                                    type="button"
                                                    className="ld-cm-eye-btn"
                                                    title="View assignment details"
                                                    onClick={() => onViewAssignmentDetails && onViewAssignmentDetails(row)}
                                                >
                                                    <img src={eyeIcon} alt="view" style={{ width: 13, height: 9 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr className="ld-empty-table-row">
                                    <td colSpan={8} className="ld-empty-table-cell">
                                        <div className="ld-empty-table-state">
                                            <img
                                                src={openBookIcon}
                                                alt="No course assignments"
                                                className="ld-empty-table-icon"
                                            />
                                            <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No course assignments recorded yet.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 4. Pagination Footer matching Figma 1:1: Showing 1 to 5 of 22 entries */}
                <div className="ld-cm-pagination-row">
                    <span className="ld-cm-pagination-info">
                        Showing {startIndex} to {endIndex} of {totalEntries} entries
                    </span>
                    <div className="ld-cm-pagination-controls">
                        <button
                            type="button"
                            className="ld-cm-page-btn"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={activePage === 1}
                            aria-label="Previous page"
                        >
                            <img src={leftArrow} alt="prev" style={{ width: 5, height: 9 }} />
                        </button>

                        {getPageNumbers().map((item, idx) => {
                            if (item === "dots") {
                                return (
                                    <span key={`dots-${idx}`} className="ld-cm-page-ellipsis">
                                        ...
                                    </span>
                                );
                            }
                            return (
                                <button
                                    key={`page-${item}`}
                                    type="button"
                                    className={`ld-cm-page-btn ${activePage === item ? "active" : ""}`}
                                    onClick={() => setCurrentPage(item)}
                                >
                                    {item}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            className="ld-cm-page-btn"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={activePage === totalPages}
                            aria-label="Next page"
                        >
                            <img src={rightArrow} alt="next" style={{ width: 5, height: 9 }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Slide-over Filter Drawer */}
            <AssignCourseFilterDrawer
                isOpen={isFiltersOpen}
                onClose={() => setIsFiltersOpen(false)}
                selectedDepartments={selectedDeptFilter}
                selectedProviders={selectedProviderFilter}
                selectedStatuses={selectedStatusFilter}
                assignedStartDate={assignedStartDate}
                assignedEndDate={assignedEndDate}
                availableDepartments={availableDepartmentsList}
                availableProviders={availableProvidersList}
                availableStatuses={availableStatusesList}
                onApply={({ departments, providers, statuses, assignedStartDate, assignedEndDate }) => {
                    setSelectedDeptFilter(departments);
                    setSelectedProviderFilter(providers);
                    setSelectedStatusFilter(statuses);
                    setAssignedStartDate(assignedStartDate);
                    setAssignedEndDate(assignedEndDate);
                }}
                onClearAll={handleClearAllFilters}
            />
        </div>
    );
}
