import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { fetchAllEmployees } from "../../services/teamService";
import { useAuth } from "../../context/AuthContext";
import searchIcon from "../../assets/course_library/search.svg";
import openBookIcon from "../../assets/course_library/open_book_icon.svg";
import blueEyeIcon from "../../assets/L&D/blue eye.svg";
import EmployeeProfileView from "./EmployeeProfileView";
import DirectoryFilterDropdown from "../../components/L&D/EmployeeDirectory/DirectoryFilterDropdown";
import TableSkeletonRows from "../../components/common/TableSkeletonRows";
import { sanitizeSingleSpaceInput } from "../../utils/validationUtils";
import "../../styles/L&D/EmployeeDirectory.css";

const LEARNING_STATUS_OPTIONS = [
    "Active",
    "Inactive",
];

const formatDateTimeParts = (isoStr) => {
    if (!isoStr || isoStr === "—" || isoStr === "-") return null;
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return null;

        const dateStr = d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }); // e.g. "25 Nov 2026"

        const timeStr = d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }); // e.g. "09:15 AM"

        return { date: dateStr, time: timeStr, raw: d.getTime() };
    } catch {
        return null;
    }
};

export default function LDEmployeeDirectory() {
    const { token } = useAuth();
    const location = useLocation();
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDepartments, setSelectedDepartments] = useState(["Departments"]);
    const [selectedLearningStatus, setSelectedLearningStatus] = useState(() => {
        const initial = location.state?.filter;
        if (initial === "Active Learners" || initial === "Active") return "Active";
        if (initial === "Inactive Learners" || initial === "Inactive") return "Inactive";
        return "Status";
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const tableContainerRef = useRef(null);

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
            return <ArrowUpDown size={11} className="ld-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={11} className="ld-sort-icon active" />
        ) : (
            <ArrowDown size={11} className="ld-sort-icon active" />
        );
    };

    // Fixed 10 items per page on all screen sizes
    const itemsPerPage = 10;

    useEffect(() => {
        if (location.state?.filter) {
            const f = location.state.filter;
            if (f === "Active Learners" || f === "Active") {
                setSelectedLearningStatus("Active");
            } else if (f === "Inactive Learners" || f === "Inactive") {
                setSelectedLearningStatus("Inactive");
            }
        }
    }, [location.state]);

    // Fetch live directory employees from Microsoft Entra ID (Azure AD)
    useEffect(() => {
        let isMounted = true;
        const loadEmployees = async () => {
            setIsLoading(true);
            try {
                const apiEmployees = await fetchAllEmployees(token);
                if (isMounted && Array.isArray(apiEmployees) && apiEmployees.length > 0) {
                    const AVATAR_COLORS = [
                        "#A87FFF", "#7C67FF", "#F97FFF", "#7FCEFF", "#7F96FF",
                        "#BED60E", "#5CDE8A", "#FF7F7F", "#FF7FAE", "#FFBC64"
                    ];
                    const mapped = apiEmployees.map((emp, idx) => {
                        const rawName = emp.full_name || emp.name || "—";
                        const cleanName = rawName.split("(")[0].trim();
                        const parts = cleanName.split(" ").filter(Boolean);
                        const initials = parts.length >= 2
                            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
                            : (cleanName.slice(0, 2).toUpperCase() || "EM");

                        const loginParts = formatDateTimeParts(emp.last_logged_in);
                        let logoutParts = formatDateTimeParts(emp.last_logged_out);
                        if (emp.last_logged_in && !emp.last_logged_out) {
                            logoutParts = { date: "Active", time: "In Session", raw: Infinity };
                        }

                        return {
                            id: emp.employee_id || idx + 1,
                            name: cleanName,
                            email: emp.work_email || emp.email || "",
                            initials: initials,
                            avatarBg: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                            employeeId: emp.employee_id || `EMP${String(idx + 1).padStart(3, "0")}`,
                            department: emp.department || "General",
                            designation: emp.job_title || emp.role || "—",
                            reportingManager: emp.reporting_manager || "Not Assigned",
                            reportingManagerId: emp.reporting_manager_id,
                            learningStatus: emp.learning_status || (emp.in_progress_courses_count > 0 ? "Active" : "Inactive"),
                            courses: emp.courses_count !== undefined ? emp.courses_count : ((emp.in_progress_courses_count || 0) + (emp.completed_courses_count || 0)),
                            certifications: emp.certifications_count !== undefined ? emp.certifications_count : 0,
                            lastLoginDate: loginParts?.date || null,
                            lastLoginTime: loginParts?.time || null,
                            lastLoginRaw: loginParts?.raw || null,
                            lastLogoutDate: logoutParts?.date || null,
                            lastLogoutTime: logoutParts?.time || null,
                            lastLogoutRaw: logoutParts?.raw || null,
                            jobLocation: emp.job_location || "Coimbatore, India",
                            mobileNumber: emp.mobile_number || "",
                            dateOfJoining: emp.date_of_joining || "",
                            linkedinUrl: emp.linkedin_url || "",
                        };
                    });
                    setEmployees(mapped);
                }
            } catch (err) {
                console.error("Failed to fetch Entra ID employees:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadEmployees();
        return () => {
            isMounted = false;
        };
    }, [token]);

    const employeeOptions = useMemo(() => {
        const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name));
        return [
            { value: "All Employees", label: "All Employees" },
            ...sorted.map((e) => ({
                value: e.name,
                label: `${e.name} (${e.employeeId})`,
            })),
        ];
    }, [employees]);

    const departments = useMemo(() => {
        const depts = new Set(
            employees
                .map((e) => (e.department || "").trim())
                .filter(Boolean)
        );
        return Array.from(depts).sort((a, b) => a.localeCompare(b));
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        return employees.filter((emp) => {
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !query ||
                (emp.name || "").toLowerCase().includes(query) ||
                (emp.email || "").toLowerCase().includes(query) ||
                (emp.employeeId || "").toLowerCase().includes(query);

            const isAllDepts =
                !selectedDepartments ||
                selectedDepartments.length === 0 ||
                selectedDepartments.includes("Departments") ||
                selectedDepartments.includes("All") ||
                selectedDepartments.includes("All Departments");

            const matchesDept =
                isAllDepts ||
                selectedDepartments.some(
                    (d) => String(d).trim().toLowerCase() === String(emp.department || "").trim().toLowerCase()
                );

            let matchesStatus = true;
            if (selectedLearningStatus === "Active" || selectedLearningStatus === "Active Learners") {
                matchesStatus = (emp.learningStatus || "").toLowerCase() === "active";
            } else if (selectedLearningStatus === "Inactive" || selectedLearningStatus === "Inactive Learners") {
                matchesStatus = (emp.learningStatus || "").toLowerCase() === "inactive";
            }

            return matchesSearch && matchesDept && matchesStatus;
        });
    }, [employees, searchQuery, selectedDepartments, selectedLearningStatus]);

    const isDeptFiltered =
        Array.isArray(selectedDepartments)
            ? !selectedDepartments.includes("Departments") &&
            !selectedDepartments.includes("All Departments") &&
            selectedDepartments.length > 0
            : selectedDepartments !== "Departments" && selectedDepartments !== "All Departments";

    const isFiltered =
        searchQuery.trim() !== "" ||
        isDeptFiltered ||
        (selectedLearningStatus !== "Status" && selectedLearningStatus !== "All Learning Statuses");

    const totalCount = employees.length;
    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));

    // Reset to page 1 whenever search query, filters, or itemsPerPage change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedDepartments, selectedLearningStatus, itemsPerPage]);

    // Sorted employees based on active column sort config (Employee, Department, Courses, Certifications)
    const sortedEmployees = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) {
            return filteredEmployees;
        }

        return [...filteredEmployees].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "name": {
                    const nameA = String(a.name || "").trim();
                    const nameB = String(b.name || "").trim();
                    comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
                    if (comparison === 0) {
                        comparison = String(a.employeeId || "").localeCompare(String(b.employeeId || ""));
                    }
                    break;
                }
                case "department": {
                    const deptA = String(a.department || "").trim();
                    const deptB = String(b.department || "").trim();
                    comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
                    break;
                }
                case "courses": {
                    const countA = Number(a.courses) || 0;
                    const countB = Number(b.courses) || 0;
                    comparison = countA - countB;
                    break;
                }
                case "certifications": {
                    const countA = Number(a.certifications) || 0;
                    const countB = Number(b.certifications) || 0;
                    comparison = countA - countB;
                    break;
                }
                case "learningStatus": {
                    const statusA = String(a.learningStatus || "").trim();
                    const statusB = String(b.learningStatus || "").trim();
                    comparison = statusA.localeCompare(statusB, undefined, { sensitivity: "base" });
                    break;
                }
                case "login": {
                    const timeA = a.lastLoginRaw || 0;
                    const timeB = b.lastLoginRaw || 0;
                    comparison = timeA - timeB;
                    break;
                }
                case "logout": {
                    const timeA = a.lastLogoutRaw || 0;
                    const timeB = b.lastLogoutRaw || 0;
                    comparison = timeA - timeB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [filteredEmployees, sortConfig]);

    // Paginate current slice of employees
    const paginatedEmployees = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedEmployees.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedEmployees, currentPage, itemsPerPage]);

    const startItem =
        filteredEmployees.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem =
        filteredEmployees.length === 0
            ? 0
            : (currentPage - 1) * itemsPerPage + paginatedEmployees.length;

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

    if (selectedEmployee) {
        return (
            <EmployeeProfileView
                employee={selectedEmployee}
                onBack={() => setSelectedEmployee(null)}
            />
        );
    }

    return (
        <div className="ld-directory-page">
            {/* 1. TOP PAGE HEADER */}
            <PageHeader
                title="Employee Directory"
                subtitle="Explore employee talent profiles, department learning hours, and active certifications."
            />

            {/* 2. UNIFIED MAIN DIRECTORY CARD (TOOLBAR + TABLE + PAGINATION) */}
            <div className="ld-directory-main-card">
                <div className="ld-directory-toolbar">
                    <div className="ld-toolbar-left">
                        <div className="ld-search-box">
                            <img
                                src={searchIcon}
                                alt="Search"
                                className="ld-search-icon"
                                style={{ width: "14px", height: "14px", display: "block" }}
                            />
                            <input
                                type="text"
                                className="ld-search-input"
                                placeholder="Search by employee id/name"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(sanitizeSingleSpaceInput(e.target.value))}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                                    aria-label="Clear search"
                                >
                                    <X size={14} color="#94A3B8" />
                                </button>
                            )}
                        </div>

                        {/* Department Filter Dropdown */}
                        <DirectoryFilterDropdown
                            value={selectedDepartments}
                            options={departments}
                            onChange={setSelectedDepartments}
                            placeholder="Departments"
                            defaultValue="Departments"
                            align="left"
                            isMulti={true}
                        />

                        {/* Learning Status Filter Dropdown */}
                        <DirectoryFilterDropdown
                            value={selectedLearningStatus}
                            options={LEARNING_STATUS_OPTIONS}
                            onChange={setSelectedLearningStatus}
                            placeholder="Status"
                            defaultValue="Status"
                            align="left"
                        />
                    </div>

                    <div className="ld-toolbar-right">
                        <span>Total Employees</span>
                        <span className="ld-total-count">
                            {isLoading ? (
                                <span className="ld-skeleton-block" style={{ width: "32px", height: "16px" }} />
                            ) : isFiltered ? (
                                `${filteredEmployees.length} of ${totalCount}`
                            ) : (
                                totalCount
                            )}
                        </span>
                    </div>
                </div>

                {/* Horizontal Divider Line */}
                <div className="ld-toolbar-divider" />

                {/* Table */}
                <div className="ld-table-responsive" ref={tableContainerRef}>
                    <table className={`ld-employee-table ${paginatedEmployees.length >= itemsPerPage || paginatedEmployees.length === 0 ? "ld-table-fill" : ""}`}>
                        <colgroup>
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "22%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "8%" }} />
                            <col style={{ width: "9%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "7%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    className="ld-th-sortable"
                                    onClick={() => handleSort("name")}
                                    title="Click to sort by Employee"
                                >
                                    <div className="ld-th-content">
                                        <span>Employee</span>
                                        {renderSortIcon("name")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-sortable"
                                    onClick={() => handleSort("department")}
                                    title="Click to sort by Department"
                                >
                                    <div className="ld-th-content">
                                        <span>Department</span>
                                        {renderSortIcon("department")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-sortable"
                                    onClick={() => handleSort("learningStatus")}
                                    title="Click to sort by Learning Status"
                                >
                                    <div className="ld-th-content">
                                        <span>Learning Status</span>
                                        {renderSortIcon("learningStatus")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-center ld-th-courses ld-th-sortable"
                                    onClick={() => handleSort("courses")}
                                    title="Click to sort by Courses"
                                >
                                    <div className="ld-th-content ld-th-content-center">
                                        <span>Courses</span>
                                        {renderSortIcon("courses")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-center ld-th-certifications ld-th-sortable"
                                    onClick={() => handleSort("certifications")}
                                    title="Click to sort by Certifications"
                                >
                                    <div className="ld-th-content ld-th-content-center">
                                        <span>Certifications</span>
                                        {renderSortIcon("certifications")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-sortable"
                                    onClick={() => handleSort("login")}
                                    title="Click to sort by Login"
                                >
                                    <div className="ld-th-content">
                                        <span>Login</span>
                                        {renderSortIcon("login")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-sortable"
                                    onClick={() => handleSort("logout")}
                                    title="Click to sort by Logout"
                                >
                                    <div className="ld-th-content">
                                        <span>Logout</span>
                                        {renderSortIcon("logout")}
                                    </div>
                                </th>
                                <th className="ld-th-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <TableSkeletonRows rows={itemsPerPage} columns={8} />
                            ) : paginatedEmployees.length === 0 ? (
                                <tr className="ld-empty-table-row">
                                    <td colSpan="8" className="ld-empty-table-cell">
                                        <div className="ld-empty-table-state">
                                            <img
                                                src={openBookIcon}
                                                alt="No employees found"
                                                className="ld-empty-table-icon"
                                            />
                                            <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No employees match the selected criteria.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedEmployees.map((emp) => (
                                    <tr key={emp.id}>
                                        {/* Employee Profile */}
                                        <td>
                                            <div className="ld-emp-profile-cell">
                                                <div className="ld-emp-details">
                                                    <span className="ld-emp-name" title={emp.name}>{emp.name}</span>
                                                    <span className="ld-emp-id-sub" title={emp.employeeId}>{emp.employeeId}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Department */}
                                        <td title={emp.department}>{emp.department}</td>

                                        {/* Learning Status Badge */}
                                        <td>
                                            <span
                                                className={`ld-status-badge ${(emp.learningStatus || "").toLowerCase() === "active"
                                                    ? "ld-status-active active"
                                                    : "ld-status-inactive inactive"
                                                    }`}
                                            >
                                                {emp.learningStatus}
                                            </span>
                                        </td>

                                        {/* Courses Count */}
                                        <td className="ld-td-center">
                                            <span className="ld-count-badge">
                                                {emp.courses}
                                            </span>
                                        </td>

                                        {/* Certifications Count */}
                                        <td className="ld-td-center">
                                            <span className="ld-count-badge">
                                                {emp.certifications}
                                            </span>
                                        </td>

                                        {/* Login */}
                                        <td>
                                            {emp.lastLoginDate ? (
                                                <div className="ld-emp-details">
                                                    <span className="ld-emp-name" title={emp.lastLoginDate}>
                                                        {emp.lastLoginDate}
                                                    </span>
                                                    <span className="ld-emp-id-sub" title={emp.lastLoginTime}>
                                                        {emp.lastLoginTime}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ color: "#7F7F7F", fontSize: "15px", fontWeight: 600, textAlign: "center", margin: "15px" }}>-</span>
                                            )}
                                        </td>

                                        {/* Logout */}
                                        <td>
                                            {emp.lastLogoutDate ? (
                                                <div className="ld-emp-details">
                                                    <span className="ld-emp-name" title={emp.lastLogoutDate}>
                                                        {emp.lastLogoutDate}
                                                    </span>
                                                    <span className="ld-emp-id-sub" title={emp.lastLogoutTime}>
                                                        {emp.lastLogoutTime}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ color: "#7F7F7F", fontSize: "15px", fontWeight: 600, textAlign: "center", margin: "15px" }}>-</span>
                                            )}
                                        </td>

                                        {/* Action Button */}
                                        <td className="ld-td-center">
                                            <button
                                                type="button"
                                                className="ld-btn-action-view"
                                                title="View Profile"
                                                onClick={() => setSelectedEmployee(emp)}
                                            >
                                                <img
                                                    src={blueEyeIcon}
                                                    alt="View"
                                                    className="ld-action-view-icon"
                                                />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 4. BOTTOM PAGINATION FOOTER */}
                <div className="ld-directory-footer">
                    <span>Showing {startItem} to {endItem} of {totalCount} employees</span>

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


        </div>
    );
}
