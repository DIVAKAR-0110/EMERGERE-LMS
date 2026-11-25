import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import searchIcon from "../../../assets/course_library/search.svg";
import eyeIcon from "../../../assets/reportsanalytics/eye.svg";
import bookIcon from "../../../assets/reportsanalytics/book.svg";
import clockIcon from "../../../assets/reportsanalytics/clock.svg";
import certIcon from "../../../assets/reportsanalytics/certifications.svg";
import { MoreVertical, LayoutGrid, Table, BookOpen, ChevronDown, Check, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { fetchAllEmployees } from "../../../services/teamService";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import useCustomScrollbar from "../../../hooks/useCustomScrollbar";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

// ─── Avatar helpers ──────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  "#E8488A", "#FB7185", "#8B5CF6", "#10B981",
  "#84CC16", "#F59E0B", "#06B6D4", "#3B82F6",
  "#EF4444", "#EC4899", "#14B8A6", "#6366F1",
];

function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Status pill class helper
const getStatusPillClass = (status) =>
  status === "Active" ? "hr-status-pill-active" : "hr-status-pill-inactive";

const STATUS_FILTERS = ["Active", "Inactive"];

export default function EmployeeRecordsTable({ onSelectEmployee }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [viewMode, setViewMode] = useState("table");
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 1024
  );
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Live data state
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const deptRef = useRef(null);
  const statusRef = useRef(null);

  // ─── Fetch live employees on mount ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAllEmployees();
        setEmployees(data);
      } catch (err) {
        console.error("[EmployeeRecordsTable] Failed to load employees:", err);
        setError("Failed to load employees. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ─── Derive department list dynamically from live data ──────────────────────
  const dynamicDepts = useMemo(() => {
    const cleaned = employees
      .map((e) => (e.department || "").trim())
      .filter(Boolean);
    return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (deptRef.current && !deptRef.current.contains(e.target)) {
        setIsDeptOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setIsStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
      return <ArrowUpDown size={11} className="hr-sort-icon inactive" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp size={11} className="hr-sort-icon active" />
    ) : (
      <ArrowDown size={11} className="hr-sort-icon active" />
    );
  };

  // ─── Filter employees ────────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const name = emp.name || emp.full_name || "";
      const role = emp.job_title || emp.role || "";
      const dept = emp.department || "";
      const status = emp.learning_status || emp.learningStatus || "Inactive";
      const empId = String(emp.employee_id || emp.id || "").toLowerCase();

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        role.toLowerCase().includes(query) ||
        empId.includes(query);
      const matchesDept =
        selectedDepts.length === 0 ||
        selectedDepts.some(
          (d) => d.trim().toLowerCase() === dept.trim().toLowerCase()
        );
      const matchesStatus =
        selectedStatus === "All Status" ||
        selectedStatus === "All Statuses" ||
        selectedStatus === "Filters" ||
        status.trim().toLowerCase() === selectedStatus.trim().toLowerCase();
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, selectedDepts, selectedStatus]);

  // ─── Sorted employees based on active sort configuration ─────────────────────
  const sortedEmployees = useMemo(() => {
    const getStatusWeight = (emp) => {
      const st = String(emp.learning_status || emp.learningStatus || "Inactive").trim().toLowerCase();
      return st === "active" ? 0 : 1; // 0 for Active (displays first), 1 for Inactive (displays second)
    };

    if (!sortConfig.key || !sortConfig.direction) {
      // Default ordering: Active status employees first, then Inactive status employees
      return [...filteredEmployees].sort((a, b) => {
        const weightDiff = getStatusWeight(a) - getStatusWeight(b);
        if (weightDiff !== 0) return weightDiff;
        // Secondary stable sort by employee name
        const nameA = String(a.name || a.full_name || "").trim();
        const nameB = String(b.name || b.full_name || "").trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      });
    }

    return [...filteredEmployees].sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.key) {
        case "employee": {
          const nameA = String(a.name || a.full_name || "").trim();
          const nameB = String(b.name || b.full_name || "").trim();
          comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
          break;
        }
        case "department":
        case "role": {
          const deptA = String(a.department || a.job_title || a.role || "").trim();
          const deptB = String(b.department || b.job_title || b.role || "").trim();
          comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
          break;
        }
        case "courses": {
          const coursesA = Number(a.courses ?? a.courses_count ?? 0);
          const coursesB = Number(b.courses ?? b.courses_count ?? 0);
          comparison = coursesA - coursesB;
          break;
        }
        case "progress": {
          const progA = Number(a.progress ?? a.avg_progress ?? 0);
          const progB = Number(b.progress ?? b.avg_progress ?? 0);
          comparison = progA - progB;
          break;
        }
        case "hours": {
          const parseHours = (emp) => {
            if (typeof emp.total_learning_hours === "number") return emp.total_learning_hours;
            const str = String(emp.hours || emp.total_learning_hours || "0");
            const num = parseFloat(str.replace(/[^0-9.]/g, ""));
            return isNaN(num) ? 0 : num;
          };
          comparison = parseHours(a) - parseHours(b);
          break;
        }
        case "certificates": {
          const certsA = Number(a.certificates ?? a.certificates_count ?? a.certifications ?? 0);
          const certsB = Number(b.certificates ?? b.certificates_count ?? b.certifications ?? 0);
          comparison = certsA - certsB;
          break;
        }
        case "status": {
          const statusA = String(a.learning_status || a.learningStatus || "Inactive").trim();
          const statusB = String(b.learning_status || b.learningStatus || "Inactive").trim();
          comparison = getStatusWeight(a) - getStatusWeight(b);
          if (comparison === 0) {
            comparison = statusA.localeCompare(statusB, undefined, { sensitivity: "base" });
          }
          break;
        }
        default:
          comparison = 0;
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredEmployees, sortConfig]);

  // Custom 7px x 80px scrollbar (#D9D9D9) as in CEO module
  const {
    containerRef,
    trackRef,
    thumbRef,
    thumbOffset,
    hasOverflow,
    isDragging,
    handleScroll,
    handlePointerDown,
    handleTrackClick,
  } = useCustomScrollbar({
    thumbHeight: 80,
    deps: [sortedEmployees, viewMode, loading],
  });

  const tableContainerRef = useRef(null);
  const cardsContainerRef = useRef(null);
  const effectiveViewMode = isCompactViewport ? "card" : viewMode;

  // Track responsive breakpoint (<=1024px CSS switches table to Card View)
  useEffect(() => {
    const updateViewportMode = () => {
      setIsCompactViewport(window.innerWidth <= 1024);
    };
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  // Reset to page 1 when filters, sortConfig, or effectiveViewMode change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepts, selectedStatus, effectiveViewMode, sortConfig]);

  // Dynamically calculate page size based on available container/screen height for Table & Card views
  useEffect(() => {
    if (loading || error) return;

    const computeItemsPerPage = () => {
      if (effectiveViewMode === "table") {
        setItemsPerPage((prev) => (prev === 10 ? prev : 10));
        return;
      }

      // Card View (desktop view-card or <=1024px / 150%-200% zoom)
      const cardsEl = cardsContainerRef.current;
      if (!cardsEl) return;

      const winWidth = window.innerWidth;
      const computedStyle = window.getComputedStyle(cardsEl);
      const gridCols = computedStyle.display === "grid"
        ? computedStyle.gridTemplateColumns.split(" ").filter(Boolean).length
        : 1;
      const cols = Math.max(1, gridCols || (winWidth <= 767 ? 1 : winWidth <= 1024 ? 2 : 3));

      const firstCard = cardsEl.querySelector(".hr-employee-card");
      const cardHeight = firstCard ? firstCard.getBoundingClientRect().height : 205;
      const gap = 12;

      const availableHeight =
        cardsEl.clientHeight > 120 && winWidth > 1024
          ? cardsEl.clientHeight
          : Math.max(240, window.innerHeight - 250);

      const rowsFit = Math.max(
        cols === 1 ? 3 : 2,
        Math.floor((availableHeight + gap) / (cardHeight + gap))
      );
      const nextCount = cols * rowsFit;
      setItemsPerPage((prev) => (prev === nextCount ? prev : nextCount));
    };

    const rafId = requestAnimationFrame(computeItemsPerPage);
    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => computeItemsPerPage());
      if (containerRef.current) observer.observe(containerRef.current);
      if (cardsContainerRef.current) observer.observe(cardsContainerRef.current);
    }
    window.addEventListener("resize", computeItemsPerPage);

    return () => {
      cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", computeItemsPerPage);
    };
  }, [effectiveViewMode, loading, error, sortedEmployees.length]);

  const totalEntries = sortedEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalEntries === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const endIndex = totalEntries === 0 ? 0 : Math.min(safePage * itemsPerPage, totalEntries);

  const paginatedEmployees = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return sortedEmployees.slice(start, start + itemsPerPage);
  }, [sortedEmployees, safePage, itemsPerPage]);

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 3) {
      return [1, 2, 3, "dots", totalPages];
    }
    if (safePage >= totalPages - 2) {
      return [1, "dots", totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "dots", safePage - 1, safePage, safePage + 1, "dots", totalPages];
  };

  // Coordinate wheel scrolling between outer page (moving 3 cards) and inner table rows
  useEffect(() => {
    const tableEl = tableContainerRef.current;
    if (!tableEl) return;

    const handleWheel = (e) => {
      // Allow native scrolling inside open dropdown menus without page/table interception
      if (e.target.closest && e.target.closest(".hr-dropdown-menu")) {
        return;
      }

      const outerScrollable = tableEl.closest(".hr-employee-records-scrollable");
      if (!outerScrollable) return;

      const cardsGrid = outerScrollable.querySelector(".hr-middle-cards-grid");
      const maxOuter = cardsGrid ? cardsGrid.offsetHeight + 10 : 200;
      const maxScrollable = outerScrollable.scrollHeight - outerScrollable.clientHeight;
      const targetOuterScroll = Math.max(0, Math.min(maxOuter, maxScrollable));

      const scrollContainer = viewMode === "table"
        ? containerRef.current
        : tableEl.querySelector(".hr-employee-cards-container");

      if (e.deltaY > 0) {
        // Scrolling down
        if (outerScrollable.scrollTop < targetOuterScroll - 2) {
          e.preventDefault();
          outerScrollable.scrollTop = Math.min(targetOuterScroll, outerScrollable.scrollTop + e.deltaY);
        } else if (scrollContainer) {
          const maxInner = scrollContainer.scrollHeight - scrollContainer.clientHeight;
          if (maxInner > 0 && scrollContainer.scrollTop < maxInner) {
            e.preventDefault();
            scrollContainer.scrollTop = Math.min(maxInner, scrollContainer.scrollTop + e.deltaY);
          }
        }
      } else if (e.deltaY < 0) {
        // Scrolling up
        if (scrollContainer && scrollContainer.scrollTop > 0) {
          e.preventDefault();
          scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop + e.deltaY);
        } else if (outerScrollable.scrollTop > 0) {
          e.preventDefault();
          outerScrollable.scrollTop = Math.max(0, outerScrollable.scrollTop + e.deltaY);
        }
      }
    };

    tableEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      tableEl.removeEventListener("wheel", handleWheel);
    };
  }, [containerRef, viewMode]);

  const snapCardsUpwards = () => {
    const tableEl = tableContainerRef.current;
    const outerScrollable = tableEl?.closest(".hr-employee-records-scrollable");
    if (outerScrollable) {
      const cardsGrid = outerScrollable.querySelector(".hr-middle-cards-grid");
      const cardsHeight = cardsGrid ? cardsGrid.offsetHeight + 14 : 224;
      if (outerScrollable.scrollTop < cardsHeight) {
        outerScrollable.scrollTop = cardsHeight;
      }
    }
  };

  return (
    <div
      className={`hr-records-table-container view-${viewMode}`}
      ref={tableContainerRef}
    >
      {/* Header Row: Title & View Mode Toggle */}
      <div className="hr-table-header-row">
        <h3 className="hr-employees-table-title">Employees</h3>

        {/* View Mode Toggle (Desktop) */}
        {/* <div className="hr-view-mode-toggle">
          <button
            type="button"
            className={`hr-view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
            title="Table View"
          >
          <Table size={13} />
            <span>Table View</span>
          </button>
          <button
            type="button"
            className={`hr-view-toggle-btn ${viewMode === "card" ? "active" : ""}`}
            onClick={() => setViewMode("card")}
            title="Card View"
          >
            <LayoutGrid size={13} />
            <span>Card View</span>
          </button>
        </div>*/}
      </div>

      {/* Filter Controls Bar */}
      <div className="hr-table-filter-bar">
        <div className="hr-search-input-wrap">
          <img src={searchIcon} alt="Search" className="hr-search-icon" />
          <input
            type="text"
            className="hr-search-input"
            placeholder="Search employee id/name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="hr-filter-dropdowns-group">
          {/* Department Dropdown (Multi-select) */}
          <div className="hr-dropdown-wrapper" ref={deptRef}>
            <button
              type="button"
              className={`hr-filter-dropdown-btn ${isDeptOpen ? "active" : ""} ${selectedDepts.length > 0 ? "filtered" : ""}`}
              onClick={() => {
                setIsDeptOpen(!isDeptOpen);
                setIsStatusOpen(false);
              }}
              title={
                selectedDepts.length === 0
                  ? "All Departments"
                  : selectedDepts.length === 1
                    ? selectedDepts[0]
                    : `${selectedDepts.length} selected (${selectedDepts.join(", ")})`
              }
            >
              <span className="hr-filter-btn-text">
                {selectedDepts.length === 0
                  ? "All Departments"
                  : selectedDepts.length === 1
                    ? selectedDepts[0]
                    : `${selectedDepts.length} selected`}
              </span>
              {selectedDepts.length > 0 ? (
                <span
                  className="hr-filter-clear-cross"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDepts([]);
                  }}
                  title="Clear department filter"
                >
                  ×
                </span>
              ) : (
                <ChevronDown
                  size={14}
                  className={`hr-dropdown-arrow ${isDeptOpen ? "open" : ""}`}
                />
              )}
            </button>

            {isDeptOpen && (
              <div className="hr-dropdown-menu">
                {dynamicDepts.map((dept) => {
                  const isSelected = selectedDepts.some(
                    (d) => d.trim().toLowerCase() === dept.trim().toLowerCase()
                  );
                  return (
                    <div
                      key={dept}
                      className={`hr-dropdown-item hr-dropdown-item-multi ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedDepts((prev) =>
                          isSelected
                            ? prev.filter((d) => d.trim().toLowerCase() !== dept.trim().toLowerCase())
                            : [...prev, dept]
                        );
                      }}
                      title={dept}
                    >
                      <span className={`hr-filter-checkbox ${isSelected ? "checked" : ""}`}>
                        {isSelected && <Check size={10} strokeWidth={3} color="#FFFFFF" />}
                      </span>
                      <span className="hr-dropdown-item-text">{dept}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="hr-dropdown-wrapper" ref={statusRef}>
            <button
              type="button"
              className={`hr-filter-dropdown-btn ${isStatusOpen ? "active" : ""} ${selectedStatus !== "All Status" && selectedStatus !== "All Statuses" ? "filtered" : ""}`}
              onClick={() => {
                setIsStatusOpen(!isStatusOpen);
                setIsDeptOpen(false);
              }}
            >
              <span>{selectedStatus}</span>
              {selectedStatus !== "All Status" && selectedStatus !== "All Statuses" ? (
                <span
                  className="hr-filter-clear-cross"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStatus("All Status");
                    setIsStatusOpen(false);
                  }}
                  title="Clear status filter"
                >
                  ×
                </span>
              ) : (
                <ChevronDown
                  size={14}
                  className={`hr-dropdown-arrow ${isStatusOpen ? "open" : ""}`}
                />
              )}
            </button>

            {isStatusOpen && (
              <div className="hr-dropdown-menu">
                {STATUS_FILTERS.map((st) => {
                  const isSelected = selectedStatus === st;
                  return (
                    <div
                      key={st}
                      className={`hr-dropdown-item ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedStatus(isSelected ? "All Status" : st);
                        setIsStatusOpen(false);
                      }}
                    >
                      <div className="hr-dropdown-item-left">
                        <span className={`hr-status-dot ${st === "Active" ? "active" : "inactive"}`} />
                        <span>{st}</span>
                      </div>
                      {isSelected && <Check size={14} className="hr-dropdown-check-icon" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Loading / Error States */}
      {loading && (
        <div className="hr-table-state-msg">Loading employees...</div>
      )}
      {error && !loading && (
        <div className="hr-empty-table-state" style={{ padding: "64px 16px" }}>
          <img src={openBookIcon} alt="" className="hr-empty-table-icon" />
          <span className="hr-table-state-error">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="hr-table-outer-wrapper">
            <div
              className={`hr-table-scroll-wrapper ${paginatedEmployees.length === 0 ? "is-empty" : ""}`}
              ref={containerRef}
              onScroll={handleScroll}
            >
              <table className={`hr-employees-table ${paginatedEmployees.length === 0 ? "is-empty" : ""}`}>
                <thead>
                  <tr>
                    <th
                      className="hr-th-employee hr-th-sortable"
                      onClick={() => handleSort("employee")}
                      title="Sort by Employee"
                    >
                      <div className="hr-th-content">
                        <span>Employee</span>
                        {renderSortIcon("employee")}
                      </div>
                    </th>
                    <th
                      className="hr-th-department hr-th-sortable"
                      onClick={() => handleSort("department")}
                      title="Sort by Department"
                    >
                      <div className="hr-th-content">
                        <span>Department</span>
                        {renderSortIcon("department")}
                      </div>
                    </th>
                    <th
                      className="hr-th-sortable"
                      onClick={() => handleSort("courses")}
                      title="Sort by Courses"
                    >
                      <div className="hr-th-content">
                        <span>Courses</span>
                        {renderSortIcon("courses")}
                      </div>
                    </th>
                    <th
                      className="hr-th-sortable"
                      onClick={() => handleSort("progress")}
                      title="Sort by Learning Progress"
                    >
                      <div className="hr-th-content">
                        <span>Learning Progress</span>
                        {renderSortIcon("progress")}
                      </div>
                    </th>
                    <th
                      className="hr-th-sortable"
                      onClick={() => handleSort("hours")}
                      title="Sort by Hours Logged"
                    >
                      <div className="hr-th-content">
                        <span>Hours Logged</span>
                        {renderSortIcon("hours")}
                      </div>
                    </th>
                    <th
                      className="hr-th-sortable"
                      onClick={() => handleSort("certificates")}
                      title="Sort by Certification"
                    >
                      <div className="hr-th-content">
                        <span>Certification</span>
                        {renderSortIcon("certificates")}
                      </div>
                    </th>
                    <th
                      className="hr-th-sortable"
                      onClick={() => handleSort("status")}
                      title="Sort by Status"
                    >
                      <div className="hr-th-content">
                        <span>Status</span>
                        {renderSortIcon("status")}
                      </div>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeletonRows columns={8} rows={5} />
                  ) : paginatedEmployees.length > 0 ? (
                    paginatedEmployees.map((emp, index) => {
                      const name = emp.name || emp.full_name || "—";
                      const initials = getInitials(name);
                      const avatarBg = getAvatarColor(name);
                      const role = emp.job_title || emp.role || "—";
                      const department = emp.department || "—";
                      const courses = emp.courses ?? emp.courses_count ?? 0;
                      const progress = emp.progress ?? emp.avg_progress ?? 0;
                      const hours = emp.hours || `${emp.total_learning_hours ?? 0}h`;
                      const certificates = emp.certificates ?? emp.certificates_count ?? emp.certifications ?? 0;
                      const status = emp.learning_status || emp.learningStatus || "Inactive";
                      const employeeId = emp.employee_id || emp.id || emp.emp_id || "";

                      return (
                        <tr key={`${emp.employee_id || emp.id || "emp"}-${index}`} data-emp-row="true">
                          {/* Employee Name + ID */}
                          <td className="hr-td-employee" title={name}>
                            <div className="hr-employee-cell">
                              <div className="hr-employee-meta">
                                <span className="hr-employee-name">{name}</span>
                                {employeeId && (
                                  <span className="hr-employee-id" title={employeeId}>
                                    {employeeId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="hr-td-department" title={department}>
                            <span className="hr-department-name">{department}</span>
                          </td>

                          {/* Courses */}
                          <td className="hr-td-courses">{courses}</td>

                          {/* Learning Progress */}
                          <td className="hr-td-progress">
                            <div className="hr-progress-cell">
                              <div className="hr-progress-bar-track">
                                <div
                                  className="hr-progress-bar-fill"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="hr-progress-pct">{progress}%</span>
                            </div>
                          </td>

                          {/* Hours Logged */}
                          <td className="hr-td-hours">{hours}</td>

                          {/* Certificates */}
                          <td className="hr-td-certs">{certificates}</td>

                          {/* Status */}
                          <td className="hr-td-status">
                            <span className={getStatusPillClass(status)}>{status}</span>
                          </td>

                          {/* Actions */}
                          <td className="hr-td-actions">
                            <button
                              type="button"
                              className="hr-view-action-btn"
                              onClick={() =>
                                onSelectEmployee?.({
                                  ...emp,
                                  initials,
                                  avatarBg,
                                  certificates,
                                  hours,
                                  progress,
                                  role,
                                  department: emp.department || "—",
                                })
                              }
                            >
                              <img src={eyeIcon} alt="View" className="hr-view-action-icon" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="hr-empty-table-row">
                      <td colSpan={8} className="hr-empty-table-cell">
                        <div className="hr-empty-table-state">
                          <img src={openBookIcon} alt="" className="hr-empty-table-icon" />
                          <span>No employees found matching your criteria.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Custom 7px x 80px scrollbar (#D9D9D9) as in CEO module */}
            {hasOverflow && effectiveViewMode !== "table" && (
              <div
                className="hr-table-scroll-track"
                ref={trackRef}
                onClick={(e) => {
                  snapCardsUpwards();
                  handleTrackClick(e);
                }}
                title="Scroll"
              >
                <div
                  className={`hr-table-scroll-thumb ${isDragging ? "dragging" : ""}`}
                  ref={thumbRef}
                  style={{ transform: `translateY(${thumbOffset}px)` }}
                  onPointerDown={(e) => {
                    snapCardsUpwards();
                    handlePointerDown(e);
                  }}
                />
              </div>
            )}
          </div>

          {/* Card View Section */}
          <div className="hr-employee-cards-container" ref={cardsContainerRef}>
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="hr-employee-card" style={{ opacity: 0.85 }}>
                  <div className="hr-emp-card-header">
                    <div className="hr-emp-card-identity">
                      <span className="ld-skeleton-circle" style={{ width: 40, height: 40 }} />
                      <div className="hr-emp-card-info" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span className="ld-skeleton-block" style={{ width: 110, height: 16 }} />
                        <span className="ld-skeleton-block" style={{ width: 70, height: 12 }} />
                      </div>
                    </div>
                  </div>
                  <div className="hr-emp-card-progress-section" style={{ marginTop: 16 }}>
                    <span className="ld-skeleton-block" style={{ width: "100%", height: 8, borderRadius: 4 }} />
                  </div>
                </div>
              ))
            ) : paginatedEmployees.length > 0 ? (
              paginatedEmployees.map((emp, index) => {
                const name = emp.name || emp.full_name || "—";
                const initials = getInitials(name);
                const avatarBg = getAvatarColor(name);
                const role = emp.job_title || emp.role || "—";
                const dept = emp.department || "—";
                const courses = emp.courses ?? emp.courses_count ?? 0;
                const progress = emp.progress ?? emp.avg_progress ?? 0;
                const hours = emp.hours || `${emp.total_learning_hours ?? 0}h`;
                const certificates = emp.certificates ?? emp.certificates_count ?? emp.certifications ?? 0;
                const status = emp.learning_status || emp.learningStatus || "Inactive";

                return (
                  <div
                    key={`card-${emp.employee_id || emp.id || "emp"}-${index}`}
                    className="hr-employee-card"
                    onClick={() =>
                      onSelectEmployee?.({
                        ...emp,
                        initials,
                        avatarBg,
                        certificates,
                        hours,
                        progress,
                        role,
                        department: dept,
                      })
                    }
                  >
                    {/* Card Top: Avatar, Name, Role, Department & Status, Options */}
                    <div className="hr-emp-card-header">
                      <div className="hr-emp-card-identity">
                        <span
                          className="hr-avatar-circle"
                          style={{ backgroundColor: avatarBg }}
                        >
                          {initials}
                        </span>
                        <div className="hr-emp-card-info">
                          <span className="hr-emp-card-name">{name}</span>
                          <span className="hr-emp-card-role">{role}</span>
                          <span className="hr-emp-card-dept">{dept}</span>
                        </div>
                      </div>
                      <div className="hr-emp-card-header-right">
                        <span className={getStatusPillClass(status)}>#{status}</span>
                        <button
                          type="button"
                          className="hr-emp-card-menu-btn"
                          aria-label="Options"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEmployee?.({
                              ...emp,
                              initials,
                              avatarBg,
                              certificates,
                              hours,
                              progress,
                              role,
                              department: dept,
                            });
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Section */}
                    <div className="hr-emp-card-progress-section">
                      <span className="hr-emp-card-progress-label">Learning Progress</span>
                      <div className="hr-progress-bar-track">
                        <div
                          className="hr-progress-bar-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="hr-emp-card-progress-pct">{progress}%</span>
                    </div>

                    {/* Stats Row: Courses, Hours, Certificates */}
                    <div className="hr-emp-card-stats-row">
                      <div className="hr-emp-card-stat">
                        <BookOpen size={14} color="#215EF8" className="hr-emp-card-stat-icon" />
                        <span className="hr-emp-card-stat-val">{courses}</span>
                        <span className="hr-emp-card-stat-lbl">Courses</span>
                      </div>
                      <div className="hr-emp-card-stat">
                        <img src={clockIcon} alt="Hours" className="hr-emp-card-stat-icon" />
                        <span className="hr-emp-card-stat-val">{hours}</span>
                        <span className="hr-emp-card-stat-lbl">Hours</span>
                      </div>
                      <div className="hr-emp-card-stat">
                        <img src={certIcon} alt="Certification" className="hr-emp-card-stat-icon" />
                        <span className="hr-emp-card-stat-val">{certificates}</span>
                        <span className="hr-emp-card-stat-lbl">Certification</span>
                      </div>
                    </div>

                    {/* View Profile Action Button */}
                    <button
                      type="button"
                      className="hr-emp-card-view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEmployee?.({
                          ...emp,
                          initials,
                          avatarBg,
                          certificates,
                          hours,
                          progress,
                          role,
                          department: dept,
                        });
                      }}
                    >
                      View Profile
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="hr-cards-empty-state">
                <img src={openBookIcon} alt="" className="hr-empty-table-icon" />
                <span>No employees found matching your criteria.</span>
              </div>
            )}
          </div>

          {/* Pagination Footer (Table View & Card View) */}
          <div className="hr-pagination-row">
            <span className="hr-pagination-info">
              Showing {startIndex} to {endIndex} of {totalEntries} employees
            </span>
            <div className="hr-pagination-controls">
              <button
                type="button"
                className="hr-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>

              {getPageNumbers().map((item, idx) => {
                if (item === "dots") {
                  return (
                    <span key={`dots-${idx}`} className="hr-page-ellipsis">
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={`page-${item}`}
                    type="button"
                    className={`hr-page-btn ${safePage === item ? "active" : ""}`}
                    onClick={() => setCurrentPage(item)}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                type="button"
                className="hr-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
