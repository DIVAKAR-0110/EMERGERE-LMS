import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import searchIcon from "../../../assets/coursemanagement/search.svg";
import dropdownIcon from "../../../assets/coursemanagement/dropdown.svg";
import filtersIcon from "../../../assets/coursemanagement/filters.svg";
import approveIcon from "../../../assets/coursemanagement/approve.svg";
import holdIcon from "../../../assets/coursemanagement/hold.svg";
import eyeIcon from "../../../assets/coursemanagement/eye.svg";
import leftArrow from "../../../assets/coursemanagement/left-arrow.svg";
import rightArrow from "../../../assets/coursemanagement/right-arrow.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import EnrollmentRequestsFilterDrawer from "./EnrollmentRequestsFilterDrawer";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import { sanitizeSingleSpaceInput } from "../../../utils/validationUtils";

const getDepartment = (emp) => {
    if (!emp) return "—";
    if (emp.department && String(emp.department).toLowerCase() !== "employee") {
        return emp.department;
    }
    if (emp.dept && String(emp.dept).toLowerCase() !== "employee") {
        return emp.dept;
    }
    return "—";
};

const getRequestDepartment = (r) => {
    if (!r) return "—";
    if (r.employee?.department && String(r.employee.department).toLowerCase() !== "employee") {
        return r.employee.department;
    }
    if (r.department && String(r.department).toLowerCase() !== "employee") {
        return r.department;
    }
    return getDepartment(r.employee);
};

const getRequestProvider = (r) => {
    return r?.provider || "—";
};

const isSeatFull = (r) => {
    return Boolean(
        r?.isFull ||
        r?.activeUsers === "4/4" ||
        (r?.activeUsersStatus && String(r?.activeUsersStatus).toLowerCase().includes("full"))
    );
};

// Robust date parsing for course enrollment requests
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

export default function EnrollmentRequestsTab({
    requests = [],
    isLoading = false,
    onApprove,
    onOpenHoldModal,
    onViewDetails,
    currentAdminId,
    currentUser,
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeStatusTab, setActiveStatusTab] = useState("All");
    const [selectedDepartments, setSelectedDepartments] = useState(["All"]);
    const [selectedCourses, setSelectedCourses] = useState(["All"]);
    const [selectedProviders, setSelectedProviders] = useState(["All"]);
    const [selectedStatuses, setSelectedStatuses] = useState(["All"]);
    const [selectedSeats, setSelectedSeats] = useState(["All"]);
    const [requestStartDate, setRequestStartDate] = useState("");
    const [requestEndDate, setRequestEndDate] = useState("");
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

    // Hover overview for Active Users popover
    const [hoveredActiveUsers, setHoveredActiveUsers] = useState(null);

    const handleActiveUsersMouseEnter = (e, row) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const placement = (spaceAbove < 220 || spaceBelow >= spaceAbove) ? "bottom" : "top";
        const x = Math.max(130, Math.min(window.innerWidth - 130, rect.left + rect.width / 2));
        const y = placement === "top" ? rect.top - 8 : rect.bottom + 8;
        setHoveredActiveUsers({ row, x, y, placement });
    };

    const handleActiveUsersMouseLeave = () => {
        setHoveredActiveUsers(null);
    };

    // Auto-dismiss floating popover on window resize or scroll
    useEffect(() => {
        if (!hoveredActiveUsers) return;
        const dismiss = () => setHoveredActiveUsers(null);
        window.addEventListener("scroll", dismiss, true);
        window.addEventListener("resize", dismiss);
        return () => {
            window.removeEventListener("scroll", dismiss, true);
            window.removeEventListener("resize", dismiss);
        };
    }, [hoveredActiveUsers]);

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const tableContainerRef = useRef(null);

    const safeRequests = Array.isArray(requests) ? requests : [];

    // Course options derived from requests
    const availableCoursesList = useMemo(() => {
        const set = new Set();
        safeRequests.forEach((r) => {
            if (r.course && r.course.trim()) set.add(r.course.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [safeRequests]);

    // Department options derived from requests
    const availableDepartmentsList = useMemo(() => {
        const map = new Map();
        safeRequests.forEach((r) => {
            const raw = getRequestDepartment(r);
            if (raw && raw !== "—") {
                const key = raw.trim().toUpperCase();
                if (!map.has(key)) map.set(key, raw.trim());
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [safeRequests]);

    // Provider options derived from requests (case-insensitive deduplication)
    const availableProvidersList = useMemo(() => {
        const map = new Map();
        safeRequests.forEach((r) => {
            const raw = getRequestProvider(r);
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
    }, [safeRequests]);

    const seatOptions = ["Seats Available", "Seats Full (4/4)"];
    const statusOptions = ["Pending", "On Hold", "Approved"];

    // Count of active drawer filters (Department, Provider, Seats, Request Date)
    const activeFiltersCount =
        (!selectedDepartments.includes("All") && !selectedDepartments.includes("All Departments") && selectedDepartments.length > 0 ? 1 : 0) +
        (!selectedProviders.includes("All") && !selectedProviders.includes("All Providers") && selectedProviders.length > 0 ? 1 : 0) +
        (!selectedSeats.includes("All") && !selectedSeats.includes("All Seats") && selectedSeats.length > 0 ? 1 : 0) +
        (requestStartDate || requestEndDate ? 1 : 0);

    const handleClearAllFilters = () => {
        setSelectedDepartments(["All"]);
        setSelectedProviders(["All"]);
        setSelectedStatuses(["All"]);
        setSelectedSeats(["All"]);
        setRequestStartDate("");
        setRequestEndDate("");
    };

    // Status counts for top tabs (All, Pending, Approved, On Hold)
    const counts = useMemo(() => {
        let pending = 0;
        let approved = 0;
        let onHold = 0;
        safeRequests.forEach((r) => {
            const st = String(r.status || "").trim().toLowerCase();
            if (st === "approved") {
                approved++;
            } else if (st === "on hold" || st === "on_hold" || st === "hold") {
                onHold++;
            } else {
                pending++;
            }
        });
        return {
            all: safeRequests.length,
            pending,
            approved,
            onHold,
        };
    }, [safeRequests]);

    // Reset page on filter or sortConfig changes
    useEffect(() => {
        setCurrentPage(1);
    }, [
        searchTerm,
        activeStatusTab,
        selectedCourses,
        selectedStatuses,
        selectedDepartments,
        selectedProviders,
        selectedSeats,
        requestStartDate,
        requestEndDate,
        sortConfig,
    ]);

    // Filter requests
    const filteredRequests = useMemo(() => {
        const query = (searchTerm || "").toLowerCase().trim();
        return safeRequests.filter((r) => {
            const reqId = String(r.requestId || r.request_id || r.id || r.code || "").toLowerCase();
            const courseTitle = String(r.course || r.course_title || r.courseName || "").toLowerCase();
            const empName = String(r.employee?.name || r.employeeName || r.name || "").toLowerCase();
            const empId = String(r.employee?.empId || r.employeeId || r.empId || r.employeeCode || "").toLowerCase();
            const matchesSearch = !query || reqId.includes(query) || courseTitle.includes(query) || empName.includes(query) || empId.includes(query);

            const rDept = (getRequestDepartment(r) || "").trim();
            const matchesDept =
                selectedDepartments.includes("All") ||
                selectedDepartments.includes("All Departments") ||
                selectedDepartments.length === 0 ||
                selectedDepartments.some((d) => d.toLowerCase() === rDept.toLowerCase());

            const rCourse = (r.course || "").trim();
            const matchesCourse =
                selectedCourses.includes("All") ||
                selectedCourses.includes("All Courses") ||
                selectedCourses.length === 0 ||
                selectedCourses.some((c) => c.toLowerCase() === rCourse.toLowerCase());

            const rProvider = (getRequestProvider(r) || "").trim();
            const matchesProvider =
                selectedProviders.includes("All") ||
                selectedProviders.includes("All Providers") ||
                selectedProviders.length === 0 ||
                selectedProviders.some((p) => p.toLowerCase() === rProvider.toLowerCase());

            // 1. Top Status Tabs Filter (All, Pending, Approved, On Hold)
            const rStatusNorm = (r.status || "").trim().toLowerCase();
            if (activeStatusTab === "Pending") {
                if (rStatusNorm !== "pending" && rStatusNorm !== "") return false;
            } else if (activeStatusTab === "Approved") {
                if (rStatusNorm !== "approved") return false;
            } else if (activeStatusTab === "On Hold") {
                if (rStatusNorm !== "on hold" && rStatusNorm !== "on_hold" && rStatusNorm !== "hold") return false;
            }

            // 2. Drawer Status Filter
            const rStatus = (r.status || "").trim();
            const isAllStatus =
                selectedStatuses.includes("All") ||
                selectedStatuses.includes("All Status") ||
                selectedStatuses.length === 0;
            const matchesStatus = isAllStatus
                ? true
                : selectedStatuses.some((s) => s.toLowerCase() === rStatus.toLowerCase());

            const full = isSeatFull(r);
            const isAllSeats =
                selectedSeats.includes("All") ||
                selectedSeats.includes("All Seats") ||
                selectedSeats.length === 0;
            const wantsFull = selectedSeats.some((s) => s.toLowerCase().includes("full"));
            const wantsAvailable = selectedSeats.some((s) => s.toLowerCase().includes("available"));
            const matchesSeat = isAllSeats
                ? true
                : wantsFull && !wantsAvailable
                    ? full
                    : wantsAvailable && !wantsFull
                        ? !full
                        : true;

            const reqDateObj = parseCourseDate(r.requestedOn, r.created_at || r.createdAt || r.request_date || r.requestDate);
            const matchesRequestDate = matchesDateRange(reqDateObj, requestStartDate, requestEndDate);

            return matchesSearch && matchesDept && matchesCourse && matchesProvider && matchesStatus && matchesSeat && matchesRequestDate;
        });
    }, [
        safeRequests,
        searchTerm,
        activeStatusTab,
        selectedDepartments,
        selectedCourses,
        selectedProviders,
        selectedStatuses,
        selectedSeats,
        requestStartDate,
        requestEndDate,
    ]);

    // Sort filtered requests based on active sort configuration
    const sortedRequests = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction || !Array.isArray(filteredRequests)) {
            return filteredRequests;
        }

        return [...filteredRequests].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "requestId": {
                    const idA = String(a.requestId || "").trim();
                    const idB = String(b.requestId || "").trim();
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
                    const deptA = String(getRequestDepartment(a) || "").trim();
                    const deptB = String(getRequestDepartment(b) || "").trim();
                    comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
                    break;
                }
                case "course": {
                    const cA = String(a.course || "").trim();
                    const cB = String(b.course || "").trim();
                    comparison = cA.localeCompare(cB, undefined, { sensitivity: "base" });
                    break;
                }
                case "requestedOn": {
                    const dateA = parseCourseDate(a.requestedOn, a.raw?.created_at)?.getTime() || 0;
                    const dateB = parseCourseDate(b.requestedOn, b.raw?.created_at)?.getTime() || 0;
                    comparison = dateA - dateB;
                    break;
                }
                case "activeUsers": {
                    const parseCount = (r) => {
                        if (!r?.activeUsers) return 0;
                        const match = String(r.activeUsers).match(/^(\d+)/);
                        return match ? parseInt(match[1], 10) : 0;
                    };
                    comparison = parseCount(a) - parseCount(b);
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
    }, [filteredRequests, sortConfig]);

    const totalEntries = sortedRequests.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    const activePage = Math.min(currentPage, totalPages);

    const startIndex = totalEntries === 0 ? 0 : (activePage - 1) * pageSize + 1;
    const endIndex = Math.min(activePage * pageSize, totalEntries);

    const displayedRequests = useMemo(() => {
        return sortedRequests.slice(
            (activePage - 1) * pageSize,
            activePage * pageSize
        );
    }, [sortedRequests, activePage, pageSize]);

    // Pagination numbers matching Figma UI (< 1 2 ... 4 >)
    const getPageNumbers = () => {
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (activePage <= 2) {
            return [1, 2, "dots", 4];
        }
        if (activePage >= totalPages - 1) {
            return [1, "dots", totalPages - 1, totalPages];
        }
        return [activePage - 1, activePage, "dots", totalPages];
    };

    return (
        <div className="ld-cm-enrollment-tab">
            {/* 1. Section Header - OUTSIDE THE TABLE */}
            <div className="ld-cm-section-header">
                <div className="ld-cm-section-title-group">
                    <h3 className="ld-cm-section-title">Enrollment Requests</h3>
                    <p className="ld-cm-section-subtitle">
                        Review and take action on employee enrollment requests.
                    </p>
                </div>
            </div>

            {/* 2. Filters Bar - OUTSIDE THE TABLE */}
            <div className="ld-cm-filters-bar">
                <div className="ld-cm-search-box">
                    <img src={searchIcon} alt="search" className="ld-cm-search-icon" style={{ width: 14, height: 14 }} />
                    <input
                        type="text"
                        className="ld-cm-search-input"
                        placeholder="Search by request id or employee id/name or course"
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

            {/* Status Tabs below Search Bar */}
            <div className="ld-cm-status-tabs">
                <button
                    type="button"
                    className={`ld-cm-status-tab ${activeStatusTab === "All" ? "active" : ""}`}
                    onClick={() => {
                        setActiveStatusTab("All");
                        setCurrentPage(1);
                    }}
                >
                    All
                </button>
                <button
                    type="button"
                    className={`ld-cm-status-tab ${activeStatusTab === "Pending" ? "active" : ""}`}
                    onClick={() => {
                        setActiveStatusTab("Pending");
                        setCurrentPage(1);
                    }}
                >
                    Pending {isLoading ? "" : `(${counts.pending})`}
                </button>
                <button
                    type="button"
                    className={`ld-cm-status-tab ${activeStatusTab === "Approved" ? "active" : ""}`}
                    onClick={() => {
                        setActiveStatusTab("Approved");
                        setCurrentPage(1);
                    }}
                >
                    Approved {isLoading ? "" : `(${counts.approved})`}
                </button>
                <button
                    type="button"
                    className={`ld-cm-status-tab ${activeStatusTab === "On Hold" ? "active" : ""}`}
                    onClick={() => {
                        setActiveStatusTab("On Hold");
                        setCurrentPage(1);
                    }}
                >
                    On Hold {isLoading ? "" : `(${counts.onHold})`}
                </button>
            </div>

            {/* 3. Table Card - ONLY CONTAINS TABLE & PAGINATION */}
            <div className="ld-cm-table-card">
                <div className={`ld-cm-table-container ${displayedRequests.length === 0 ? "ld-table-container-empty" : ""}`} ref={tableContainerRef}>
                    <table className={`ld-cm-table ${displayedRequests.length >= pageSize || displayedRequests.length === 0 ? "ld-table-fill" : ""}`}>
                        <colgroup>
                            <col style={{ width: "13%" }} />
                            <col style={{ width: "13%" }} />
                            <col style={{ width: "16%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "9%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("requestId")}
                                    title="Sort by Request ID"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Request ID</span>
                                        {renderSortIcon("requestId")}
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
                                    onClick={() => handleSort("requestedOn")}
                                    title="Sort by Requested On"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Requested On</span>
                                        {renderSortIcon("requestedOn")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("activeUsers")}
                                    title="Sort by Active Users"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Active Users</span>
                                        {renderSortIcon("activeUsers")}
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
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading || requests === null ? (
                                <TableSkeletonRows rows={pageSize} columns={8} />
                            ) : displayedRequests.length > 0 ? (
                                displayedRequests.map((row) => (
                                    <tr key={row.requestId}>
                                        {/* Request ID */}
                                        <td>
                                            <span style={{ fontWeight: 400, color: "#000000", fontSize: "12px" }}>
                                                {row.requestId}
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
                                                    {(row.employee?.empId || row.employeeId || row.empId) && (
                                                        <span
                                                            className="ld-cm-employee-role"
                                                            title={row.employee?.empId || row.employeeId || row.empId}
                                                        >
                                                            {row.employee?.empId || row.employeeId || row.empId}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Department */}
                                        <td>
                                            <span
                                                className="ld-cm-provider-text"
                                                title={getRequestDepartment(row)}
                                            >
                                                {getRequestDepartment(row)}
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

                                        {/* Requested On */}
                                        <td>
                                            <span className="ld-cm-date-text">
                                                {row.requestedOn}
                                            </span>
                                        </td>

                                        {/* Active Users */}
                                        <td>
                                            <div
                                                className="ld-cm-active-users-trigger"
                                                onMouseEnter={(e) => handleActiveUsersMouseEnter(e, row)}
                                                onMouseLeave={handleActiveUsersMouseLeave}
                                            >
                                                <span className={`ld-cm-active-users-count ${(row.isFull || row.activeUsers === "4/4") ? "is-full" : "is-available"}`}>
                                                    {row.activeUsers}
                                                </span>
                                                <span className="ld-cm-active-users-status">
                                                    {row.activeUsersStatus}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td>
                                            {row.status === "Approved" ? (
                                                <span className="ld-cm-status-badge completed">
                                                    Approved
                                                </span>
                                            ) : row.status === "On Hold" ? (
                                                <span className="ld-cm-status-badge on-hold">
                                                    On Hold
                                                </span>
                                            ) : (
                                                <span className="ld-cm-status-badge pending">
                                                    Pending
                                                </span>
                                            )}
                                        </td>

                                        {/* Action */}
                                        <td style={{ textAlign: "center" }}>
                                            <button
                                                type="button"
                                                className="ld-cm-eye-btn"
                                                title="View details"
                                                onClick={() => onViewDetails && onViewDetails(row, "request")}
                                            >
                                                <img src={eyeIcon} alt="view" style={{ width: 13, height: 9 }} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr className="ld-empty-table-row">
                                    <td colSpan={8} className="ld-empty-table-cell">
                                        <div className="ld-empty-table-state">
                                            <img
                                                src={openBookIcon}
                                                alt="No enrollment requests"
                                                className="ld-empty-table-icon"
                                            />
                                            <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }} >No {activeStatusTab !== "All" ? activeStatusTab.toLowerCase() : ""} enrollment requests recorded yet.</span>
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
            {/* Floating Active Users Popover on Hover (rendered via portal for zero clipping) */}
            {hoveredActiveUsers && createPortal(
                <div
                    className={`ld-cm-active-users-popover ld-cm-popover-${hoveredActiveUsers.placement}`}
                    style={{
                        position: "fixed",
                        left: `${hoveredActiveUsers.x}px`,
                        top: hoveredActiveUsers.placement === "top" ? undefined : `${hoveredActiveUsers.y}px`,
                        bottom: hoveredActiveUsers.placement === "top" ? `${window.innerHeight - hoveredActiveUsers.y}px` : undefined,
                        transform: "translateX(-50%)",
                        zIndex: 99999,
                    }}
                    role="tooltip"
                >
                    <div className="ld-cm-active-users-popover-header">
                        Active Employees
                    </div>
                    <div className="ld-cm-active-users-popover-divider" />

                    <div className="ld-cm-active-users-popover-content">
                        {Array.isArray(hoveredActiveUsers.row.approvedEmployees) && hoveredActiveUsers.row.approvedEmployees.length > 0 ? (
                            <div className="ld-cm-active-users-list">
                                {hoveredActiveUsers.row.approvedEmployees.map((emp, i) => (
                                    <div key={i} className="ld-cm-active-user-item">
                                        <div
                                            className="ld-cm-active-user-avatar"
                                            style={{ backgroundColor: emp.avatarBg || "#8B5CF6" }}
                                        >
                                            {emp.initials || (emp.name ? emp.name.slice(0, 2).toUpperCase() : "EM")}
                                        </div>
                                        <div className="ld-cm-active-user-info">
                                            <span className="ld-cm-active-user-name" title={emp.name}>
                                                {emp.name}
                                            </span>
                                            <span className="ld-cm-active-user-meta">
                                                {emp.empId ? `${emp.empId}` : ""}
                                                {emp.empId && (emp.role || emp.department) ? " • " : ""}
                                                {emp.role || emp.department || ""}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="ld-cm-active-users-empty">
                                No active employees currently enrolled
                            </div>
                        )}
                    </div>

                    <div className="ld-cm-active-users-popover-footer">
                        <span className="ld-cm-active-users-footer-label">Available Slots:</span>
                        <span className="ld-cm-active-users-footer-value">
                            {hoveredActiveUsers.row.activeUsersStatus || (hoveredActiveUsers.row.isFull ? "(Full)" : "(4 Available)")}
                        </span>
                    </div>

                    <div className={`ld-cm-active-users-popover-arrow ld-cm-arrow-${hoveredActiveUsers.placement}`} />
                </div>,
                document.body
            )}

            {/* Slide-over Filter Drawer */}
            <EnrollmentRequestsFilterDrawer
                isOpen={isFiltersOpen}
                onClose={() => setIsFiltersOpen(false)}
                selectedDepartments={selectedDepartments}
                selectedProviders={selectedProviders}
                selectedStatuses={selectedStatuses}
                selectedSeats={selectedSeats}
                requestStartDate={requestStartDate}
                requestEndDate={requestEndDate}
                availableDepartments={availableDepartmentsList}
                availableProviders={availableProvidersList}
                availableStatuses={["Pending", "On Hold", "Approved"]}
                availableSeats={["Seats Available", "Seats Full (4/4)"]}
                onApply={({ departments, providers, statuses, seats, requestStartDate, requestEndDate }) => {
                    setSelectedDepartments(departments);
                    setSelectedProviders(providers);
                    setSelectedStatuses(statuses);
                    setSelectedSeats(seats);
                    setRequestStartDate(requestStartDate);
                    setRequestEndDate(requestEndDate);
                }}
                onClearAll={handleClearAllFilters}
            />
        </div>
    );
}
