import React, { useState, useMemo, useEffect, useRef } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import searchIcon from "../../../assets/coursemanagement/search.svg";
import dropdownIcon from "../../../assets/coursemanagement/dropdown.svg";
import filtersIcon from "../../../assets/coursemanagement/filters.svg";
import cartButtonIcon from "../../../assets/coursemanagement/cart-button.svg";
import leftArrow from "../../../assets/coursemanagement/left-arrow.svg";
import rightArrow from "../../../assets/coursemanagement/right-arrow.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";
import blueEditIcon from "../../../assets/Daily_Learning_Log/blue_edit.svg";
import PurchaseCourseFilterDrawer from "./PurchaseCourseFilterDrawer";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import { sanitizeSingleSpaceInput } from "../../../utils/validationUtils";

import useCourseMetadata from "../../../hooks/useCourseMetadata";

// Cart icon with checkmark that inherits button text color via currentColor
const CartCheckIcon = ({ size = 11, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, ...style }}>
        <path d="M8.44584 6.6H4.25878L2.17904 0.374002C2.14203 0.26476 2.07152 0.169878 1.97748 0.102765C1.88344 0.0356523 1.77062 -0.000295805 1.65496 1.83344e-06H0V1.1H1.25777L3.21063 6.9465C3.28371 7.16601 3.42432 7.35697 3.61248 7.49224C3.80065 7.62751 4.0268 7.70021 4.25878 7.7H8.44584C8.67033 7.69961 8.88936 7.63095 9.07368 7.50319C9.25801 7.37544 9.39886 7.19466 9.47743 6.985L11 2.9425L9.9684 2.5575L8.44584 6.6ZM4.41324 8.8C4.12062 8.8 3.83999 8.91589 3.63308 9.12218C3.42617 9.32847 3.30993 9.60826 3.30993 9.9C3.30993 10.1917 3.42617 10.4715 3.63308 10.6778C3.83999 10.8841 4.12062 11 4.41324 11C4.70586 11 4.98649 10.8841 5.1934 10.6778C5.40031 10.4715 5.51655 10.1917 5.51655 9.9C5.51655 9.60826 5.40031 9.32847 5.1934 9.12218C4.98649 8.91589 4.70586 8.8 4.41324 8.8ZM8.27482 8.8C7.98221 8.8 7.70158 8.91589 7.49467 9.12218C7.28776 9.32847 7.17151 9.60826 7.17151 9.9C7.17151 10.1917 7.28776 10.4715 7.49467 10.6778C7.70158 10.8841 7.98221 11 8.27482 11C8.56744 11 8.84807 10.8841 9.05498 10.6778C9.26189 10.4715 9.37813 10.1917 9.37813 9.9C9.37813 9.60826 9.26189 9.32847 9.05498 9.12218C8.84807 8.91589 8.56744 8.8 8.27482 8.8Z" fill="currentColor"/>
        <path d="M5.35657 2.9095L4.57322 3.6905L6.0682 5.1755L8.6665 2.5905L7.88315 1.8095L6.0682 3.6245L5.35657 2.9095Z" fill="currentColor"/>
    </svg>
);

// Helper to parse dates from course rows robustly
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

// Helper to check if a date falls within [startDateStr, endDateStr]
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

export default function PurchaseCourseTab({
    courses = [],
    isLoading = false,
    onPurchaseClick,
    onOpenPurchaseModal,
    onViewDetails,
    onViewApprovalDetails,
    currentAdminId,
    currentUser,
}) {
    const { categoryNames, providerNames } = useCourseMetadata();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeStatusTab, setActiveStatusTab] = useState("All");
    const [selectedCategory, setSelectedCategory] = useState("All Categories");
    const [selectedProvider, setSelectedProvider] = useState("All Providers");

    // Drawer filter states (multi-select departments/providers + date ranges)
    const [selectedDrawerDepartments, setSelectedDrawerDepartments] = useState(["All"]);
    const [selectedDrawerProviders, setSelectedDrawerProviders] = useState(["All"]);
    const [requestStartDate, setRequestStartDate] = useState("");
    const [requestEndDate, setRequestEndDate] = useState("");
    const [approvedStartDate, setApprovedStartDate] = useState("");
    const [approvedEndDate, setApprovedEndDate] = useState("");
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

    const safeCourses = Array.isArray(courses) ? courses : [];

    // Filter categories & providers for toolbar dropdowns (strictly from CourseCategories & CourseProviders)
    const categories = useMemo(() => {
        const set = new Set((categoryNames || []).map((c) => (c || "").trim()).filter((c) => c && c.toUpperCase() !== "OTHER" && c.toUpperCase() !== "OTHERS"));
        return ["All Categories", ...Array.from(set)];
    }, [categoryNames]);

    const providers = useMemo(() => {
        const set = new Set((providerNames || []).map((p) => (p || "").trim()).filter((p) => p && p.toUpperCase() !== "OTHER" && p.toUpperCase() !== "OTHERS"));
        return ["All Providers", ...Array.from(set)];
    }, [providerNames]);

    // Drawer available departments derived from CEO approved courses
    const drawerAvailableDepartments = useMemo(() => {
        const map = new Map();
        safeCourses.forEach((c) => {
            const dept =
                c.department ||
                c.requestedBy?.department ||
                c.requestedBy?.dept ||
                c.requestedBy?.role ||
                c.raw?.department ||
                c.raw?.dept;
            if (dept && dept !== "—" && String(dept).toLowerCase() !== "employee") {
                const key = dept.trim().toUpperCase();
                if (!map.has(key)) map.set(key, dept.trim());
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [safeCourses]);

    // Drawer available categories: strictly from CourseCategories table
    const drawerAvailableCategories = useMemo(() => {
        const map = new Map();
        (categoryNames || []).forEach((cat) => {
            const clean = (cat || "").trim();
            if (clean && clean.toUpperCase() !== "OTHER" && clean.toUpperCase() !== "OTHERS") {
                map.set(clean.toUpperCase(), clean);
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [categoryNames]);

    // Drawer available providers: strictly from CourseProviders table
    const drawerAvailableProviders = useMemo(() => {
        const map = new Map();
        (providerNames || []).forEach((p) => {
            const clean = (p || "").trim();
            if (clean && clean.toUpperCase() !== "OTHER" && clean.toUpperCase() !== "OTHERS") {
                map.set(clean.toUpperCase(), clean);
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [providerNames]);

    // Drawer available request dates
    const drawerAvailableRequestDates = useMemo(() => {
        const set = new Set();
        safeCourses.forEach((c) => {
            if (c.requestDate && String(c.requestDate).trim() && c.requestDate !== "—") {
                set.add(String(c.requestDate).trim());
            }
        });
        if (set.size === 0) {
            return ["20 May 2026", "18 May 2026", "15 May 2026", "10 May 2026"];
        }
        return Array.from(set).sort();
    }, [safeCourses]);

    // Drawer available approved dates
    const drawerAvailableApprovedDates = useMemo(() => {
        const set = new Set();
        safeCourses.forEach((c) => {
            if (c.approvedDate && String(c.approvedDate).trim() && c.approvedDate !== "—") {
                set.add(String(c.approvedDate).trim());
            }
        });
        if (set.size === 0) {
            return ["Today", "19 May 2026", "16 May 2026", "12 May 2026"];
        }
        return Array.from(set).sort();
    }, [safeCourses]);

    // Active drawer filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (!selectedDrawerDepartments.includes("All") && !selectedDrawerDepartments.includes("All Departments") && selectedDrawerDepartments.length > 0) {
            count += selectedDrawerDepartments.length;
        }
        if (!selectedDrawerProviders.includes("All") && !selectedDrawerProviders.includes("All Providers") && selectedDrawerProviders.length > 0) {
            count += selectedDrawerProviders.length;
        }
        if (requestStartDate || requestEndDate) count += 1;
        if (approvedStartDate || approvedEndDate) count += 1;
        return count;
    }, [selectedDrawerDepartments, selectedDrawerProviders, requestStartDate, requestEndDate, approvedStartDate, approvedEndDate]);

    const handleClearAllDrawerFilters = () => {
        setSelectedDrawerDepartments(["All"]);
        setSelectedDrawerProviders(["All"]);
        setRequestStartDate("");
        setRequestEndDate("");
        setApprovedStartDate("");
        setApprovedEndDate("");
    };

    // Compute status tab counts for CEO approved courses
    const counts = useMemo(() => {
        let purchase = 0;
        let purchased = 0;
        safeCourses.forEach((c) => {
            const isPurchased = Boolean(
                c.isPurchased ||
                (c.status || "").toLowerCase() === "purchased" ||
                (c.purchase_status || "").toLowerCase() === "purchased" ||
                (c.raw?.purchase_status || "").toLowerCase() === "purchased" ||
                c.raw?.is_purchased
            );
            if (isPurchased) {
                purchased++;
            } else {
                purchase++;
            }
        });
        return {
            all: safeCourses.length,
            purchase,
            purchased,
        };
    }, [safeCourses]);

    // Reset page to 1 whenever filters, status tab, or sortConfig change
    useEffect(() => {
        setCurrentPage(1);
    }, [
        activeStatusTab,
        searchTerm,
        selectedCategory,
        selectedProvider,
        selectedDrawerDepartments,
        selectedDrawerProviders,
        requestStartDate,
        requestEndDate,
        approvedStartDate,
        approvedEndDate,
        sortConfig,
    ]);

    // Filter courses based on search, department, category, provider, request date range, approved date range, and status tab
    const filteredCourses = useMemo(() => {
        const query = (searchTerm || "").toLowerCase().trim();
        return safeCourses.filter((c) => {
            const isPurchased = Boolean(
                c.isPurchased ||
                (c.status || "").toLowerCase() === "purchased" ||
                (c.purchase_status || "").toLowerCase() === "purchased" ||
                (c.raw?.purchase_status || "").toLowerCase() === "purchased" ||
                c.raw?.is_purchased
            );

            // Sub-tabs match: "All" | "Purchase" | "Purchased"
            if (activeStatusTab === "Purchase" && isPurchased) return false;
            if (activeStatusTab === "Purchased" && !isPurchased) return false;

            const reqId = String(c.requestId || c.courseRequestId || c.requestCode || c.request_code || c.id || "").toLowerCase();
            const courseTitle = String(c.courseTitle || c.course || c.course_name || c.raw?.course_name || "").toLowerCase();
            const empName = String(c.requestedBy?.name || c.employeeName || c.employee?.name || c.name || c.raw?.employee_name || "").toLowerCase();
            const empId = String(c.requestedBy?.empId || c.empId || c.employee_id || "").toLowerCase();
            const matchesSearch = !query || reqId.includes(query) || courseTitle.includes(query) || empName.includes(query) || empId.includes(query);

            // Department match: drawer multi-select
            const dept = (
                c.department ||
                c.requestedBy?.department ||
                c.requestedBy?.dept ||
                c.requestedBy?.role ||
                c.raw?.department ||
                c.raw?.dept ||
                ""
            ).trim();

            const isAllDrawerDepts =
                selectedDrawerDepartments.includes("All") ||
                selectedDrawerDepartments.includes("All Departments") ||
                selectedDrawerDepartments.length === 0;

            const matchesDepartment =
                isAllDrawerDepts ||
                selectedDrawerDepartments.some((d) => d.toLowerCase() === dept.toLowerCase());

            // Category match: toolbar dropdown
            const matchesCategory =
                selectedCategory === "All Categories" ||
                selectedCategory === "All" ||
                (c.category && c.category.toUpperCase() === selectedCategory.toUpperCase());

            // Provider match: toolbar dropdown + drawer multi-select
            const matchesToolbarProv =
                selectedProvider === "All Providers" ||
                selectedProvider === "All" ||
                (c.provider && c.provider.toUpperCase() === selectedProvider.toUpperCase());

            const isAllDrawerProvs = selectedDrawerProviders.includes("All") || selectedDrawerProviders.length === 0;
            const matchesDrawerProv =
                isAllDrawerProvs ||
                selectedDrawerProviders.some((prov) => prov.toLowerCase() === (c.provider || "").toLowerCase());

            const matchesProvider = matchesToolbarProv && matchesDrawerProv;

            // Request Date range match (Starting Date to Ending Date)
            const reqDateObj = parseCourseDate(c.requestDate, c.raw?.created_at);
            const matchesRequestDate = matchesDateRange(reqDateObj, requestStartDate, requestEndDate);

            // Approved Date range match (Starting Date to Ending Date)
            const appDateObj = parseCourseDate(c.approvedDate, c.raw?.ceo_status_date);
            const matchesApprovedDate = matchesDateRange(appDateObj, approvedStartDate, approvedEndDate);

            return matchesSearch && matchesDepartment && matchesCategory && matchesProvider && matchesRequestDate && matchesApprovedDate;
        });
    }, [
        safeCourses,
        activeStatusTab,
        searchTerm,
        selectedCategory,
        selectedProvider,
        selectedDrawerDepartments,
        selectedDrawerProviders,
        requestStartDate,
        requestEndDate,
        approvedStartDate,
        approvedEndDate,
    ]);

    // Sort filtered courses based on active sort configuration
    const sortedCourses = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction || !Array.isArray(filteredCourses)) {
            return filteredCourses;
        }

        return [...filteredCourses].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "requestId": {
                    const idA = String(a.requestId || a.courseRequestId || a.requestCode || a.request_code || a.id || "").trim();
                    const idB = String(b.requestId || b.courseRequestId || b.requestCode || b.request_code || b.id || "").trim();
                    comparison = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
                    break;
                }
                case "courseTitle": {
                    const titleA = String(a.courseTitle || "").trim();
                    const titleB = String(b.courseTitle || "").trim();
                    comparison = titleA.localeCompare(titleB, undefined, { sensitivity: "base" });
                    break;
                }
                case "provider": {
                    const provA = String(a.provider || "").trim();
                    const provB = String(b.provider || "").trim();
                    comparison = provA.localeCompare(provB, undefined, { sensitivity: "base" });
                    break;
                }
                case "requestedBy": {
                    const reqA = String(a.requestedBy?.name || a.requestedBy || "").trim();
                    const reqB = String(b.requestedBy?.name || b.requestedBy || "").trim();
                    comparison = reqA.localeCompare(reqB, undefined, { sensitivity: "base" });
                    break;
                }
                case "department": {
                    const deptA = String(a.department || a.requestedBy?.department || a.requestedBy?.role || "").trim();
                    const deptB = String(b.department || b.requestedBy?.department || b.requestedBy?.role || "").trim();
                    comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
                    break;
                }
                case "requestDate": {
                    const dateA = parseCourseDate(a.requestDate, a.raw?.created_at)?.getTime() || 0;
                    const dateB = parseCourseDate(b.requestDate, b.raw?.created_at)?.getTime() || 0;
                    comparison = dateA - dateB;
                    break;
                }
                case "approvedDate": {
                    const dateA = parseCourseDate(a.approvedDate, a.raw?.ceo_status_date)?.getTime() || 0;
                    const dateB = parseCourseDate(b.approvedDate, b.raw?.ceo_status_date)?.getTime() || 0;
                    comparison = dateA - dateB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [filteredCourses, sortConfig]);

    const totalEntries = sortedCourses.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

    // Clamp current page if total pages change
    const activePage = Math.min(currentPage, totalPages);

    const startIndex = totalEntries === 0 ? 0 : (activePage - 1) * pageSize + 1;
    const endIndex = Math.min(activePage * pageSize, totalEntries);

    const displayedCourses = useMemo(() => {
        return sortedCourses.slice((activePage - 1) * pageSize, activePage * pageSize);
    }, [sortedCourses, activePage, pageSize]);

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
        <div className="ld-cm-purchase-tab">
            {/* 1. Section Header - OUTSIDE THE TABLE */}
            <div className="ld-cm-section-header">
                <div className="ld-cm-section-title-group">
                    <h3 className="ld-cm-section-title">CEO Approved Courses</h3>
                    <p className="ld-cm-section-subtitle">
                        These courses are approved by the CEO and ready for purchase.
                    </p>
                </div>
                <button
                    type="button"
                    className="ld-cm-primary-outline-btn"
                    onClick={() => onOpenPurchaseModal && onOpenPurchaseModal()}
                >
                    + Purchase Course
                </button>
            </div>

            {/* 2. Filters Bar - OUTSIDE THE TABLE */}
            <div className="ld-cm-filters-bar">
                <div className="ld-cm-search-box">
                    <img src={searchIcon} alt="search" className="ld-cm-search-icon" style={{ width: 14, height: 14 }} />
                    <input
                        type="text"
                        className="ld-cm-search-input"
                        placeholder="Search by employee id/name or course"
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
                            <X size={14} color="#7f7f7f" />
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
                                        handleClearAllDrawerFilters();
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
                    className={`ld-cm-status-tab ${activeStatusTab === "Purchase" ? "active" : ""}`}
                    onClick={() => {
                        setActiveStatusTab("Purchase");
                        setCurrentPage(1);
                    }}
                >
                    Purchase {isLoading ? "" : `(${counts.purchase})`}
                </button>
                <button
                    type="button"
                    className={`ld-cm-status-tab ${activeStatusTab === "Purchased" ? "active" : ""}`}
                    onClick={() => {
                        setActiveStatusTab("Purchased");
                        setCurrentPage(1);
                    }}
                >
                    Purchased {isLoading ? "" : `(${counts.purchased})`}
                </button>
            </div>

            {/* 3. Table Card - ONLY CONTAINS TABLE & PAGINATION */}
            <div className="ld-cm-table-card">
                <div className={`ld-cm-table-container ${displayedCourses.length === 0 ? "ld-table-container-empty" : ""}`} ref={tableContainerRef}>
                    <table className={`ld-cm-table ${displayedCourses.length >= pageSize || displayedCourses.length === 0 ? "ld-table-fill" : ""}`}>
                        <colgroup>
                            <col style={{ width: "16%" }} />
                            <col style={{ width: "13%" }} />
                            <col style={{ width: "15%" }} />
                            <col style={{ width: "16%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "17%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("courseTitle")}
                                    title="Sort by Course Title"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Course Title</span>
                                        {renderSortIcon("courseTitle")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("provider")}
                                    title="Sort by Provider"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Provider</span>
                                        {renderSortIcon("provider")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("requestedBy")}
                                    title="Sort by Requested By"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Requested By</span>
                                        {renderSortIcon("requestedBy")}
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
                                    onClick={() => handleSort("requestDate")}
                                    title="Sort by Request Date"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Request Date</span>
                                        {renderSortIcon("requestDate")}
                                    </div>
                                </th>
                                <th
                                    className="ld-cm-th-sortable"
                                    onClick={() => handleSort("approvedDate")}
                                    title="Sort by Approved Date"
                                >
                                    <div className="ld-cm-th-content">
                                        <span>Approved Date</span>
                                        {renderSortIcon("approvedDate")}
                                    </div>
                                </th>
                                <th style={{ textAlign: "left" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <TableSkeletonRows rows={pageSize} columns={7} />
                            ) : displayedCourses.length > 0 ? (
                                displayedCourses.map((row) => (
                                    <tr key={row.id}>
                                        {/* Course Title */}
                                        <td>
                                            <div className="ld-cm-course-title" title={row.courseTitle}>
                                                {row.courseTitle}
                                            </div>
                                        </td>

                                        {/* Provider */}
                                        <td>
                                            <span className="ld-cm-provider-text" title={row.provider}>
                                                {row.provider}
                                            </span>
                                        </td>

                                        {/* Requested By */}
                                        <td>
                                            <div className="ld-cm-employee-cell">
                                                <div className="ld-cm-employee-info">
                                                    <span className="ld-cm-employee-name" title={row.requestedBy?.name}>{row.requestedBy?.name}</span>
                                                    {(row.requestedBy?.empId || row.empId || row.employee_id) && (
                                                        <span className="ld-cm-employee-role" title={row.requestedBy?.empId || row.empId || row.employee_id}>
                                                            {row.requestedBy?.empId || row.empId || row.employee_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Department */}
                                        <td>
                                            <span className="ld-cm-provider-text" title={row.department || row.requestedBy?.department || row.requestedBy?.role || "—"}>
                                                {row.department || row.requestedBy?.department || row.requestedBy?.role || "—"}
                                            </span>
                                        </td>

                                        {/* Request Date */}
                                        <td>
                                            <span className="ld-cm-date-text">
                                                {row.requestDate}
                                            </span>
                                        </td>

                                        {/* Approved Date */}
                                        <td>
                                            <span className="ld-cm-date-text">
                                                {row.approvedDate}
                                            </span>
                                        </td>

                                        {/* Action */}
                                        <td style={{ textAlign: "center" }}>
                                            <div className="ld-cm-actions-group" style={{ justifyContent: "center" }}>
                                                {(() => {
                                                    const isPurchased = Boolean(
                                                        row.isPurchased ||
                                                        (row.status || "").toLowerCase() === "purchased" ||
                                                        (row.purchase_status || "").toLowerCase() === "purchased" ||
                                                        (row.raw?.purchase_status || "").toLowerCase() === "purchased" ||
                                                        row.raw?.is_purchased
                                                    );

                                                    const effectiveAdminId = (
                                                        currentAdminId ||
                                                        currentUser?.employee_id ||
                                                        localStorage.getItem("lms_active_employee_id") ||
                                                        ""
                                                    ).toString().trim().toUpperCase();

                                                    const effectiveUserName = (
                                                        currentUser?.name ||
                                                        ""
                                                    ).toString().trim().toLowerCase();

                                                    const reqEmpId = (
                                                        row.empId ||
                                                        row.employee_id ||
                                                        row.raw?.employee_id ||
                                                        row.requestedBy?.empId ||
                                                        ""
                                                    ).toString().trim().toUpperCase();

                                                    const reqEmpName = (
                                                        row.requestedBy?.name ||
                                                        row.employee_name ||
                                                        row.name ||
                                                        row.raw?.employee_name ||
                                                        ""
                                                    ).toString().trim().toLowerCase();

                                                    const isSelfRequest = Boolean(
                                                        (effectiveAdminId && reqEmpId && reqEmpId === effectiveAdminId) ||
                                                        (effectiveUserName && reqEmpName && reqEmpName === effectiveUserName)
                                                    );

                                                    if (isPurchased) {
                                                        const isPaid = Boolean(
                                                            String(row.payment_status || row.raw?.payment_status || "").toLowerCase() === "paid" ||
                                                            row.paid_on ||
                                                            row.payment_code ||
                                                            row.payment_slip_path ||
                                                            row.raw?.paid_on ||
                                                            row.raw?.payment_code ||
                                                            row.raw?.payment_slip_path
                                                        );

                                                        return (
                                                            <div className="ld-cm-action-group">
                                                                <button
                                                                    type="button"
                                                                    className={`ld-cm-purchase-btn disabled purchased ${isPaid ? "paid" : "unpaid"}`}
                                                                    disabled
                                                                    aria-disabled="true"
                                                                    title={
                                                                        isPaid
                                                                            ? "Course purchased and reimbursement paid by HR"
                                                                            : "Course purchased (reimbursement payment pending by HR)"
                                                                    }
                                                                >
                                                                    <CartCheckIcon size={12} />
                                                                    <span>Purchased</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="ld-cm-action-icon-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (onViewApprovalDetails) {
                                                                            onViewApprovalDetails(row);
                                                                        }
                                                                    }}
                                                                    title="View Course Approval Details"
                                                                    aria-label="View Course Approval Details"
                                                                >
                                                                    <img
                                                                        src={blueEyeIcon}
                                                                        alt="View Details"
                                                                        style={{ width: "13px", height: "9px", display: "block" }}
                                                                    />
                                                                </button>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="ld-cm-action-group">
                                                            <button
                                                                type="button"
                                                                className="ld-cm-purchase-btn status-only"
                                                                title="Status: Ready for Purchase"
                                                                aria-label="Status: Ready for Purchase"
                                                            >
                                                                <CartCheckIcon size={12} />
                                                                <span>Purchase</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ld-cm-action-icon-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (onPurchaseClick) {
                                                                        onPurchaseClick(row);
                                                                    }
                                                                }}
                                                                title="Purchase and Add to Catalog"
                                                                aria-label="Purchase and Add to Catalog"
                                                            >
                                                                <img
                                                                    src={blueEditIcon}
                                                                    alt="Edit & Purchase"
                                                                    className="ld-cm-edit-icon"
                                                                    style={{ width: "12px", height: "12px", display: "block" }}
                                                                />
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr className="ld-empty-table-row">
                                    <td colSpan={7} className="ld-empty-table-cell">
                                        <div className="ld-empty-table-state">
                                            <img
                                                src={openBookIcon}
                                                alt="No courses found"
                                                className="ld-empty-table-icon"
                                            />
                                            <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No {activeStatusTab !== "All" ? activeStatusTab.toLowerCase() : "CEO approved"} courses recorded yet.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 4. Pagination Footer matching Figma 1:1: Showing 1 to 5 of 25 entries */}
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

            {/* Slide-over Filter Courses Drawer */}
            <PurchaseCourseFilterDrawer
                isOpen={isFiltersOpen}
                onClose={() => setIsFiltersOpen(false)}
                selectedDepartments={selectedDrawerDepartments}
                selectedProviders={selectedDrawerProviders}
                requestStartDate={requestStartDate}
                requestEndDate={requestEndDate}
                approvedStartDate={approvedStartDate}
                approvedEndDate={approvedEndDate}
                availableDepartments={drawerAvailableDepartments}
                availableProviders={drawerAvailableProviders}
                onApply={({ departments, providers, requestStartDate, requestEndDate, approvedStartDate, approvedEndDate }) => {
                    setSelectedDrawerDepartments(departments);
                    setSelectedDrawerProviders(providers);
                    setRequestStartDate(requestStartDate);
                    setRequestEndDate(requestEndDate);
                    setApprovedStartDate(approvedStartDate);
                    setApprovedEndDate(approvedEndDate);
                }}
                onClearAll={handleClearAllDrawerFilters}
            />
        </div>
    );
}
