import TableSkeletonRows from "../common/TableSkeletonRows";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, ExternalLink, Calendar, CheckCircle2, ShieldCheck, Building, Users, Clock, AlertTriangle, ChevronLeft, ChevronRight, ArrowLeft, Filter, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import blueEyeIcon from "../../assets/L&D/blue eye.svg";
import openBookIcon from "../../assets/course_library/open_book_icon.svg";
import CoursePurchaseHistoryFilterDrawer from "./CoursePurchaseHistoryFilterDrawer";
import CertClaimsFilterDrawer from "./CertClaimsFilterDrawer";
import { sanitizeSingleSpaceInput } from "../../utils/validationUtils";
import "../../styles/L&D/BudgetModern.css";

// Robust date parsing for course purchases
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
    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmy = String(courseDate).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        d.setHours(0, 0, 0, 0);
        return d;
    }
    // Match YYYY-MM-DD
    const ymd = String(courseDate).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymd) {
        const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
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

// Three-bar filter icon matching Course Management & LMS design
const FilterBarsIcon = ({ className = "budget-filter-icon", style = {} }) => (
    <svg
        width="14"
        height="10"
        viewBox="0 0 20 12"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
    >
        <path d="M12 12H8V10H12V12ZM16 7H4V5H16V7ZM20 2H0V0H20V2Z" fill="currentColor" />
    </svg>
);

export default function BudgetDynamicLedgerTable({
    activeCategory,
    activeSubCategory = "All",
    onSelectSubCategory,
    categorySubCounts = {},
    coursePurchases = [],
    certClaims = [],
    workshops = [],
    departments = [],
    isLoading = false,
    onSelectTransaction,
    onBackToSummary,
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [filterStartDate, setFilterStartDate] = useState("");
    const [filterEndDate, setFilterEndDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterDropdownRef = useRef(null);
    const ITEMS_PER_PAGE = 6;

    // Course Purchase History Filter Drawer States
    const [selectedCourseDepartments, setSelectedCourseDepartments] = useState(["All"]);
    const [selectedCourseProviders, setSelectedCourseProviders] = useState(["All"]);
    const [coursePurchaseStartDate, setCoursePurchaseStartDate] = useState("");
    const [coursePurchaseEndDate, setCoursePurchaseEndDate] = useState("");
    const [isCourseDrawerOpen, setIsCourseDrawerOpen] = useState(false);

    // Available departments derived dynamically from course purchases
    const availableCourseDepartments = useMemo(() => {
        const map = new Map();
        (coursePurchases || []).forEach((c) => {
            const dept = c.department || c.dept || c.learner_department;
            if (dept && dept !== "—" && String(dept).toLowerCase() !== "employee") {
                const key = dept.trim().toUpperCase();
                if (!map.has(key)) map.set(key, dept.trim());
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [coursePurchases]);

    // Available providers derived dynamically from course purchases
    const availableCourseProviders = useMemo(() => {
        const map = new Map();
        (coursePurchases || []).forEach((c) => {
            const prov = c.provider;
            if (prov && prov !== "—") {
                const key = prov.trim().toUpperCase();
                if (!map.has(key)) {
                    const formatted = prov
                        .trim()
                        .split(" ")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        .join(" ");
                    map.set(key, formatted);
                }
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [coursePurchases]);

    // Active filters count for course purchases
    const courseActiveFiltersCount = useMemo(() => {
        let count = 0;
        if (!selectedCourseDepartments.includes("All") && !selectedCourseDepartments.includes("All Departments") && selectedCourseDepartments.length > 0) {
            count += selectedCourseDepartments.length;
        }
        if (!selectedCourseProviders.includes("All") && !selectedCourseProviders.includes("All Providers") && selectedCourseProviders.length > 0) {
            count += selectedCourseProviders.length;
        }
        if (coursePurchaseStartDate || coursePurchaseEndDate) {
            count += 1;
        }
        return count;
    }, [selectedCourseDepartments, selectedCourseProviders, coursePurchaseStartDate, coursePurchaseEndDate]);

    const handleClearAllCourseFilters = () => {
        setSelectedCourseDepartments(["All"]);
        setSelectedCourseProviders(["All"]);
        setCoursePurchaseStartDate("");
        setCoursePurchaseEndDate("");
        if (onSelectSubCategory) onSelectSubCategory("All");
    };

    // Certification Reimbursement Claims Filter Drawer States
    const [selectedCertDepartments, setSelectedCertDepartments] = useState(["All"]);
    const [selectedCertProviders, setSelectedCertProviders] = useState(["All"]);
    const [certClaimStartDate, setCertClaimStartDate] = useState("");
    const [certClaimEndDate, setCertClaimEndDate] = useState("");
    const [isCertDrawerOpen, setIsCertDrawerOpen] = useState(false);

    // Available departments derived dynamically from cert claims
    const availableCertDepartments = useMemo(() => {
        const map = new Map();
        (certClaims || []).forEach((c) => {
            const dept = c.department || c.dept || c.employee_department;
            if (dept && dept !== "—" && String(dept).toLowerCase() !== "employee") {
                const key = dept.trim().toUpperCase();
                if (!map.has(key)) map.set(key, dept.trim());
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [certClaims]);

    // Available providers derived dynamically from cert claims
    const availableCertProviders = useMemo(() => {
        const map = new Map();
        (certClaims || []).forEach((c) => {
            const prov = c.issuing_body || c.provider || c.authority;
            if (prov && prov !== "—") {
                const key = prov.trim().toUpperCase();
                if (!map.has(key)) {
                    map.set(key, prov.trim());
                }
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [certClaims]);

    // Active filters count for certification claims
    const certActiveFiltersCount = useMemo(() => {
        let count = 0;
        if (!selectedCertDepartments.includes("All") && !selectedCertDepartments.includes("All Departments") && selectedCertDepartments.length > 0) {
            count += selectedCertDepartments.length;
        }
        if (!selectedCertProviders.includes("All") && !selectedCertProviders.includes("All Providers") && selectedCertProviders.length > 0) {
            count += selectedCertProviders.length;
        }
        if (certClaimStartDate || certClaimEndDate) {
            count += 1;
        }
        return count;
    }, [selectedCertDepartments, selectedCertProviders, certClaimStartDate, certClaimEndDate]);

    const handleClearAllCertFilters = () => {
        setSelectedCertDepartments(["All"]);
        setSelectedCertProviders(["All"]);
        setCertClaimStartDate("");
        setCertClaimEndDate("");
        if (onSelectSubCategory) onSelectSubCategory("All");
    };

    // Close filter dropdown on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
                setIsFilterOpen(false);
            }
        };
        if (isFilterOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
        }
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [isFilterOpen]);

    // Dynamic Filter Options for the active category
    const filterOptions = useMemo(() => {
        if (categorySubCounts && Object.keys(categorySubCounts).length > 0) {
            return Object.entries(categorySubCounts).map(([name, count]) => ({ name, count }));
        }
        if (activeCategory === "certifications") {
            const counts = { All: certClaims.length };
            certClaims.forEach((c) => {
                counts[c.issuing_body] = (counts[c.issuing_body] || 0) + 1;
            });
            return Object.entries(counts).map(([name, count]) => ({ name, count }));
        }
        if (activeCategory === "courses") {
            const counts = { All: coursePurchases.length };
            coursePurchases.forEach((c) => {
                counts[c.provider] = (counts[c.provider] || 0) + 1;
            });
            return Object.entries(counts).map(([name, count]) => ({ name, count }));
        }
        if (activeCategory === "workshops") {
            const counts = { All: workshops.length };
            workshops.forEach((w) => {
                const t = w.event_category || (w.event_type === "Training" || w.event_type === "Workshop" ? w.event_type : (w.event_name && w.event_name.toLowerCase().includes("training") ? "Training" : "Workshop"));
                counts[t] = (counts[t] || 0) + 1;
            });
            return Object.entries(counts).map(([name, count]) => ({ name, count }));
        }
        if (activeCategory === "departments") {
            const counts = { All: departments.length };
            departments.forEach((d) => {
                counts[d.department] = (counts[d.department] || 0) + 1;
            });
            return Object.entries(counts).map(([name, count]) => ({ name, count }));
        }
        return [{ name: "All", count: 0 }];
    }, [categorySubCounts, activeCategory, certClaims, coursePurchases, workshops, departments]);

    // Reset pagination to page 1 whenever category, subcategory, search, dates, or sorting change
    useEffect(() => {
        setCurrentPage(1);
    }, [
        activeCategory,
        activeSubCategory,
        searchQuery,
        filterStartDate,
        filterEndDate,
        selectedCourseDepartments,
        selectedCourseProviders,
        coursePurchaseStartDate,
        coursePurchaseEndDate,
        selectedCertDepartments,
        selectedCertProviders,
        certClaimStartDate,
        certClaimEndDate,
        sortConfig,
    ]);

    // Parse diverse date formats (DD-MM-YYYY, YYYY-MM-DD, ISO string) to comparable YYYY-MM-DD
    const parseDateToComparable = (dateStr) => {
        if (!dateStr || typeof dateStr !== "string") return null;
        const cleanStr = dateStr.trim().split(" ")[0];
        if (!cleanStr) return null;
        if (cleanStr.includes("-")) {
            const parts = cleanStr.split("-");
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                } else if (parts[2].length === 4) {
                    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                }
            }
        } else if (cleanStr.includes("/")) {
            const parts = cleanStr.split("/");
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                } else if (parts[2].length === 4) {
                    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                }
            }
        }
        return null;
    };

    const getInitials = (name) => {
        if (!name) return "EM";
        const parts = name.trim().split(" ");
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    // Filter Course Purchases
    const filteredCourses = useMemo(() => {
        return coursePurchases.filter((item) => {
            // 1. Department match: multi-select
            const dept = (item.department || item.dept || "").trim();
            const isAllDepts =
                selectedCourseDepartments.includes("All") ||
                selectedCourseDepartments.includes("All Departments") ||
                selectedCourseDepartments.length === 0;
            const matchesDept =
                isAllDepts ||
                selectedCourseDepartments.some((d) => d.toLowerCase() === dept.toLowerCase());

            if (!matchesDept) return false;

            // 2. Provider match: multi-select
            const prov = (item.provider || "").trim();
            const isAllProviders =
                selectedCourseProviders.includes("All") ||
                selectedCourseProviders.includes("All Providers") ||
                selectedCourseProviders.length === 0;
            const matchesProvider =
                isAllProviders ||
                selectedCourseProviders.some((p) => p.toLowerCase() === prov.toLowerCase());

            if (!matchesProvider) return false;

            if (activeSubCategory !== "All" && isAllProviders && item.provider !== activeSubCategory) {
                return false;
            }

            // 3. Purchase Date range match
            if (coursePurchaseStartDate || coursePurchaseEndDate) {
                const dateObj = parseCourseDate(item.date || item.timestamp, item.created_at || item.createdAt);
                if (!matchesDateRange(dateObj, coursePurchaseStartDate, coursePurchaseEndDate)) {
                    return false;
                }
            } else if (filterStartDate || filterEndDate) {
                const normDate = parseDateToComparable(item.date);
                if (normDate) {
                    if (filterStartDate && normDate < filterStartDate) return false;
                    if (filterEndDate && normDate > filterEndDate) return false;
                }
            }

            // 4. Search query match (supports employee name, course, or multi-word employee + course)
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const words = q.split(/\s+/).filter(Boolean);
            const combined = `${item.learner_name || ""} ${item.course_name || ""} ${item.department || ""} ${item.provider || ""} ${item.request_code || ""} ${item.transaction_code || ""} ${item.employee_id || ""}`.toLowerCase();
            return words.every((w) => combined.includes(w));
        });
    }, [
        coursePurchases,
        selectedCourseDepartments,
        selectedCourseProviders,
        coursePurchaseStartDate,
        coursePurchaseEndDate,
        activeSubCategory,
        filterStartDate,
        filterEndDate,
        searchQuery,
    ]);

    // Filter Certification Claims
    const filteredClaims = useMemo(() => {
        return certClaims.filter((item) => {
            // 1. Department match: multi-select
            const dept = (item.department || item.dept || item.employee_department || "").trim();
            const isAllDepts =
                selectedCertDepartments.includes("All") ||
                selectedCertDepartments.includes("All Departments") ||
                selectedCertDepartments.length === 0;
            const matchesDept =
                isAllDepts ||
                selectedCertDepartments.some((d) => d.toLowerCase() === dept.toLowerCase());

            if (!matchesDept) return false;

            // 2. Provider match: multi-select
            const prov = (item.issuing_body || item.provider || item.authority || "").trim();
            const isAllProviders =
                selectedCertProviders.includes("All") ||
                selectedCertProviders.includes("All Providers") ||
                selectedCertProviders.length === 0;
            const matchesProvider =
                isAllProviders ||
                selectedCertProviders.some((p) => p.toLowerCase() === prov.toLowerCase());

            if (!matchesProvider) return false;

            if (activeSubCategory !== "All" && isAllProviders && item.issuing_body !== activeSubCategory && item.provider !== activeSubCategory) {
                return false;
            }

            // 3. Claim Date range match
            if (certClaimStartDate || certClaimEndDate) {
                const dateObj = parseCourseDate(
                    item.payment_time || item.submission_time || item.claim_date || item.date || item.timestamp,
                    item.created_at || item.createdAt
                );
                if (!matchesDateRange(dateObj, certClaimStartDate, certClaimEndDate)) {
                    return false;
                }
            } else if (filterStartDate || filterEndDate) {
                const normDate = parseDateToComparable(item.payment_time || item.submission_time || item.date);
                if (normDate) {
                    if (filterStartDate && normDate < filterStartDate) return false;
                    if (filterEndDate && normDate > filterEndDate) return false;
                }
            }

            // 4. Search query match
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const words = q.split(/\s+/).filter(Boolean);
            const combined = `${item.employee_name || ""} ${item.cert_title || ""} ${item.department || ""} ${item.issuing_body || ""} ${item.provider || ""} ${item.claim_code || ""} ${item.employee_id || ""}`.toLowerCase();
            return words.every((w) => combined.includes(w));
        });
    }, [
        certClaims,
        selectedCertDepartments,
        selectedCertProviders,
        certClaimStartDate,
        certClaimEndDate,
        activeSubCategory,
        searchQuery,
        filterStartDate,
        filterEndDate,
    ]);

    // Filter Workshops
    const filteredWorkshops = useMemo(() => {
        return workshops.filter((item) => {
            const itemCat = item.event_category || (item.event_type === "Training" || item.event_type === "Workshop" ? item.event_type : (item.event_name && item.event_name.toLowerCase().includes("training") ? "Training" : "Workshop"));
            if (activeSubCategory !== "All" && itemCat.toLowerCase() !== activeSubCategory.toLowerCase()) return false;
            if (filterStartDate || filterEndDate) {
                const itemStart = parseDateToComparable(item.start_date);
                const itemEnd = parseDateToComparable(item.end_date) || itemStart;
                if (itemStart || itemEnd) {
                    if (filterStartDate && itemEnd && itemEnd < filterStartDate) return false;
                    if (filterEndDate && itemStart && itemStart > filterEndDate) return false;
                }
            }
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const words = q.split(/\s+/).filter(Boolean);
            const combined = `${item.event_name || ""} ${item.department || ""} ${item.event_category || ""} ${item.event_type || ""} ${item.trainer || ""} ${item.event_code || ""}`.toLowerCase();
            return words.every((w) => combined.includes(w));
        });
    }, [workshops, activeSubCategory, searchQuery, filterStartDate, filterEndDate]);

    // Filter Departments
    const filteredDepartments = useMemo(() => {
        return departments.filter((item) => {
            if (activeSubCategory !== "All" && item.department !== activeSubCategory) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const words = q.split(/\s+/).filter(Boolean);
            const combined = `${item.department || ""}`.toLowerCase();
            return words.every((w) => combined.includes(w));
        });
    }, [departments, activeSubCategory, searchQuery]);

    // Active Category Metadata
    const categoryMeta = {
        courses: {
            title: "Course Purchase History",
            count: filteredCourses.length,
            totalAmt: filteredCourses.reduce((sum, c) => sum + (c.price || 0), 0),
        },
        certifications: {
            title: "Certification Reimbursement Claims",
            count: filteredClaims.length,
            totalAmt: filteredClaims.reduce((sum, c) => sum + (c.claim_amount || c.amount || 0), 0),
        },
        workshops: {
            title: "Workshops & Training Events",
            count: filteredWorkshops.length,
            totalAmt: filteredWorkshops.reduce((sum, w) => sum + (w.actual_spent || 0), 0),
        },
        departments: {
            title: "Spend By Department",
            count: filteredDepartments.length,
            totalAmt: filteredDepartments.reduce((sum, d) => sum + (d.ytd_spent || d.amount || 0), 0),
        },
    };

    const currentMeta = categoryMeta[activeCategory] || categoryMeta.courses;

    const searchPlaceholder = useMemo(() => {
        if (activeCategory === "courses") return "Search by employee name or course";
        if (activeCategory === "certifications") return "Search by employee name or certification";
        if (activeCategory === "workshops") return "Search by event name or department";
        if (activeCategory === "departments") return "Search by department name";
        return "Search by employee name or course";
    }, [activeCategory]);

    // Reset sort when active category changes
    useEffect(() => {
        setSortConfig({ key: null, direction: null });
    }, [activeCategory]);

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
            return <ArrowUpDown size={11} className="budget-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={11} className="budget-sort-icon active" />
        ) : (
            <ArrowDown size={11} className="budget-sort-icon active" />
        );
    };

    const parseDateToTime = (dateStr) => {
        if (!dateStr) return 0;
        const comp = parseDateToComparable(dateStr);
        if (comp) {
            const d = new Date(comp);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // Sorted datasets for each category
    const sortedCourses = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return filteredCourses;
        return [...filteredCourses].sort((a, b) => {
            let comp = 0;
            switch (sortConfig.key) {
                case "request_id": {
                    const codeA = String(a.request_code || a.transaction_code || a.id || "").toLowerCase();
                    const codeB = String(b.request_code || b.transaction_code || b.id || "").toLowerCase();
                    comp = codeA.localeCompare(codeB, undefined, { numeric: true });
                    break;
                }
                case "employee": {
                    const empA = String(a.learner_name || "").toLowerCase();
                    const empB = String(b.learner_name || "").toLowerCase();
                    comp = empA.localeCompare(empB);
                    break;
                }
                case "course": {
                    const cA = String(a.course_name || "").toLowerCase();
                    const cB = String(b.course_name || "").toLowerCase();
                    comp = cA.localeCompare(cB);
                    break;
                }
                case "purchase_date": {
                    const dateA = parseCourseDate(a.date, a.raw_date || a.timestamp)?.getTime() || 0;
                    const dateB = parseCourseDate(b.date, b.raw_date || b.timestamp)?.getTime() || 0;
                    comp = dateA - dateB;
                    break;
                }
                case "amount": {
                    const amtA = Number(a.price || 0);
                    const amtB = Number(b.price || 0);
                    comp = amtA - amtB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comp : -comp;
        });
    }, [filteredCourses, sortConfig]);

    const sortedClaims = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return filteredClaims;
        return [...filteredClaims].sort((a, b) => {
            let comp = 0;
            switch (sortConfig.key) {
                case "request_id": {
                    const codeA = String(a.claim_code || a.id || "").toLowerCase();
                    const codeB = String(b.claim_code || b.id || "").toLowerCase();
                    comp = codeA.localeCompare(codeB, undefined, { numeric: true });
                    break;
                }
                case "employee": {
                    const empA = String(a.employee_name || "").toLowerCase();
                    const empB = String(b.employee_name || "").toLowerCase();
                    comp = empA.localeCompare(empB);
                    break;
                }
                case "certification": {
                    const cA = String(a.cert_title || "").toLowerCase();
                    const cB = String(b.cert_title || "").toLowerCase();
                    comp = cA.localeCompare(cB);
                    break;
                }
                case "claim_date": {
                    const timeA = parseDateToTime(a.payment_time || a.submission_time || a.date);
                    const timeB = parseDateToTime(b.payment_time || b.submission_time || b.date);
                    comp = timeA - timeB;
                    break;
                }
                case "amount": {
                    const amtA = Number(a.claim_amount ?? a.amount ?? 0);
                    const amtB = Number(b.claim_amount ?? b.amount ?? 0);
                    comp = amtA - amtB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comp : -comp;
        });
    }, [filteredClaims, sortConfig]);

    const sortedWorkshops = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return filteredWorkshops;
        return [...filteredWorkshops].sort((a, b) => {
            let comp = 0;
            switch (sortConfig.key) {
                case "event_date": {
                    const timeA = parseDateToTime(a.start_date || a.date || a.dates_formatted);
                    const timeB = parseDateToTime(b.start_date || b.date || b.dates_formatted);
                    comp = timeA - timeB;
                    break;
                }
                case "event_name": {
                    const nameA = String(a.event_name || "").toLowerCase();
                    const nameB = String(b.event_name || "").toLowerCase();
                    comp = nameA.localeCompare(nameB);
                    break;
                }
                case "department": {
                    const deptA = String(a.department || "").toLowerCase();
                    const deptB = String(b.department || "").toLowerCase();
                    comp = deptA.localeCompare(deptB);
                    break;
                }
                case "participants": {
                    const pA = Number(a.participants_count || 0);
                    const pB = Number(b.participants_count || 0);
                    comp = pA - pB;
                    break;
                }
                case "amount": {
                    const amtA = Number(a.actual_spent || 0);
                    const amtB = Number(b.actual_spent || 0);
                    comp = amtA - amtB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comp : -comp;
        });
    }, [filteredWorkshops, sortConfig]);

    const sortedDepartments = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return filteredDepartments;
        return [...filteredDepartments].sort((a, b) => {
            let comp = 0;
            switch (sortConfig.key) {
                case "department": {
                    const deptA = String(a.department || "").toLowerCase();
                    const deptB = String(b.department || "").toLowerCase();
                    comp = deptA.localeCompare(deptB);
                    break;
                }
                case "course_spent": {
                    const sA = Number(a.spend_courses || 0);
                    const sB = Number(b.spend_courses || 0);
                    comp = sA - sB;
                    break;
                }
                case "reimbursement_spent": {
                    const sA = Number(a.spend_certifications || 0);
                    const sB = Number(b.spend_certifications || 0);
                    comp = sA - sB;
                    break;
                }
                case "workshops_spent": {
                    const sA = Number(a.spend_workshops || 0);
                    const sB = Number(b.spend_workshops || 0);
                    comp = sA - sB;
                    break;
                }
                case "amount": {
                    const amtA = Number(a.amount ?? a.ytd_spent ?? 0);
                    const amtB = Number(b.amount ?? b.ytd_spent ?? 0);
                    comp = amtA - amtB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comp : -comp;
        });
    }, [filteredDepartments, sortConfig]);

    // Current active list & pagination
    const currentList = useMemo(() => {
        if (activeCategory === "courses") return sortedCourses;
        if (activeCategory === "certifications") return sortedClaims;
        if (activeCategory === "workshops") return sortedWorkshops;
        if (activeCategory === "departments") return sortedDepartments;
        return [];
    }, [activeCategory, sortedCourses, sortedClaims, sortedWorkshops, sortedDepartments]);

    const totalCount = currentList.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

    const paginatedCourses = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedCourses.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedCourses, currentPage]);

    const paginatedClaims = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedClaims.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedClaims, currentPage]);

    const paginatedWorkshops = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedWorkshops.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedWorkshops, currentPage]);

    const paginatedDepartments = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedDepartments.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedDepartments, currentPage]);

    const getPageNumbers = () => {
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (currentPage <= 2) {
            return [1, 2, "dots", totalPages];
        }
        if (currentPage >= totalPages - 1) {
            return [1, "dots", totalPages - 1, totalPages];
        }
        return [currentPage - 1, currentPage, "dots", totalPages];
    };

    return (
        <div className="budget-ledger-card budget-spa-left-table-card">
            {/* Table Header Bar - Unified Single Row with Search & Filters */}
            <div
                className="budget-ledger-header"
            >
                <div
                    className="budget-ledger-header-left"
                >
                    {onBackToSummary && (
                        <button
                            type="button"
                            className="budget-back-to-summary-btn"
                            onClick={onBackToSummary}
                            title="Return to Spend Distribution Summary"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                margin: 0,
                                flexShrink: 0,
                                lineHeight: 1,
                            }}
                        >
                            <ArrowLeft size={13} />
                            <span>Back</span>
                        </button>
                    )}
                    <h3
                        className="budget-ledger-title"
                    >
                        {currentMeta.title}
                    </h3>

                    {/* Search Bar next to Title in Header Row */}
                    <div className="budget-search-box">
                        <Search size={15} color="#7f7f7f" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(sanitizeSingleSpaceInput(e.target.value))}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="budget-search-clear-btn"
                                onClick={() => setSearchQuery("")}
                                title="Clear search"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="budget-ledger-header-right">
                    <div
                        className="budget-ledger-summary-pill"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                            lineHeight: 1,
                        }}
                    >
                        <span>Total Amount: <strong>₹{currentMeta.totalAmt.toLocaleString("en-IN")}</strong></span>
                    </div>

                    {/* Filter Option in Same Row next to Summary Pill */}
                    {activeCategory === "courses" ? (
                        <div className="budget-toolbar-filter-wrapper">
                            <button
                                type="button"
                                className={`budget-toolbar-filter-btn ${courseActiveFiltersCount > 0 || isCourseDrawerOpen ? "has-filter" : ""}`}
                                onClick={() => setIsCourseDrawerOpen(true)}
                                aria-haspopup="dialog"
                                aria-expanded={isCourseDrawerOpen}
                                style={courseActiveFiltersCount > 0 ? { borderColor: "#2563EB", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 500 } : {}}
                            >
                                <FilterBarsIcon />
                                <span>{courseActiveFiltersCount > 0 ? `Filters (${courseActiveFiltersCount})` : "Filters"}</span>
                                {courseActiveFiltersCount > 0 && (
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearAllCourseFilters();
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
                    ) : activeCategory === "certifications" ? (
                        <div className="budget-toolbar-filter-wrapper">
                            <button
                                type="button"
                                className={`budget-toolbar-filter-btn ${certActiveFiltersCount > 0 || isCertDrawerOpen ? "has-filter" : ""}`}
                                onClick={() => setIsCertDrawerOpen(true)}
                                aria-haspopup="dialog"
                                aria-expanded={isCertDrawerOpen}
                                style={certActiveFiltersCount > 0 ? { borderColor: "#2563EB", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 500 } : {}}
                            >
                                <FilterBarsIcon />
                                <span>{certActiveFiltersCount > 0 ? `Filters (${certActiveFiltersCount})` : "Filters"}</span>
                                {certActiveFiltersCount > 0 && (
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearAllCertFilters();
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
                    ) : null}
                </div>
            </div>

            {/* 1. COURSES TABLE */}
            {activeCategory === "courses" && (
                <div className="budget-table-responsive">
                    <div className="budget-table-desktop-view">

                        <table className={`budget-data-table budget-courses-table ${filteredCourses.length === 0 ? "is-empty" : ""}`}>
                            <colgroup>
                                <col style={{ width: "16%" }} />
                                <col style={{ width: "18%" }} />
                                <col style={{ width: "30%" }} />
                                <col style={{ width: "16%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "10%" }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className="budget-th-sortable" onClick={() => handleSort("request_id")} title="Click to sort by Request ID">
                                        <div className="budget-th-content">
                                            <span>Request ID</span>
                                            {renderSortIcon("request_id")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("employee")} title="Click to sort by Employee">
                                        <div className="budget-th-content">
                                            <span>Employee</span>
                                            {renderSortIcon("employee")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("course")} title="Click to sort by Course">
                                        <div className="budget-th-content">
                                            <span>Course</span>
                                            {renderSortIcon("course")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("purchase_date")} title="Click to sort by Purchase Date">
                                        <div className="budget-th-content">
                                            <span>Purchase Date</span>
                                            {renderSortIcon("purchase_date")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("amount")} title="Click to sort by Amount">
                                        <div className="budget-th-content">
                                            <span>Amount</span>
                                            {renderSortIcon("amount")}
                                        </div>
                                    </th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <TableSkeletonRows rows={ITEMS_PER_PAGE} columns={6} />
                                ) : filteredCourses.length === 0 ? (
                                    <tr className="budget-empty-row">
                                        <td colSpan={6} className="budget-empty-cell">
                                            <div className="budget-empty-state">
                                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                                <span>No course purchase records found.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCourses.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="budget-code-stacked">
                                                    {/* <code className="budget-code-badge">{item.transaction_code}</code> */}
                                                    <span className="budget-code-inline">{item.request_code}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="budget-user-avatar-row">
                                                    {/* <div
                                                    className="budget-avatar-circle"
                                                    style={{ backgroundColor: getAvatarBg(item.learner_name) }}
                                                >
                                                    {getInitials(item.learner_name)}
                                                </div> */}
                                                    <div className="budget-user-cell">
                                                        <strong title={item.learner_name}>{item.learner_name}</strong>
                                                        <span className="budget-user-meta" title={item.department}>{/* {item.employee_id} • */}{item.department}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="budget-entity-cell">
                                                    <span className="budget-entity-name" title={item.course_name}>{item.course_name}</span>
                                                    <div className="budget-entity-tags">
                                                        <span className="budget-tag provider" title={item.provider}>{item.provider}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="budget-timestamp-cell">
                                                    <span className="budget-date-primary">{item.date || item.timestamp}</span>
                                                    {/* <span className="budget-time-secondary">{item.time}</span> */}
                                                </div>
                                            </td>
                                            <td><span className="budget-amount-cell">{item.price_formatted || (item.price ? `₹${item.price.toLocaleString("en-IN")}` : "₹0")}</span></td>
                                            {/* <td>
                                            <span className="budget-status-pill settled">
                                                <CheckCircle2 size={12} />
                                                <span>{item.status}</span>
                                            </span>
                                        </td> */}
                                            <td>
                                                <button
                                                    type="button"
                                                    className="budget-view-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectTransaction(item, "course");
                                                    }}
                                                    title="View course details"
                                                >
                                                    <img src={blueEyeIcon} alt="View" className="budget-eye-icon" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="budget-table-mobile-view">
                        {isLoading ? (
                            <div className="budget-empty-state">Loading courses...</div>
                        ) : filteredCourses.length === 0 ? (
                            <div className="budget-empty-state">
                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                <span>No course purchase records found.</span>
                            </div>
                        ) : (
                            paginatedCourses.map((item) => (
                                <div key={item.id} className="budget-mobile-card budget-mcard-course">
                                    <div className="budget-mcard-header">
                                        <div className="budget-mcard-header-left">
                                            <span className="budget-mcard-code">{item.request_id || item.id}</span>
                                            <span className="budget-mcard-date">{item.date || "—"}</span>
                                        </div>
                                        <div className="budget-mcard-header-right">
                                            <span className="budget-mcard-amount">{item.price_formatted || (item.price ? `₹${item.price.toLocaleString("en-IN")}` : "₹0")}</span>
                                        </div>
                                    </div>

                                    <div className="budget-mcard-main-info">
                                        <div className="budget-mcard-course-name">{item.course_name || "—"}</div>
                                        <div className="budget-mcard-sub-info">
                                            <span className="budget-provider-badge">{item.provider_name || item.provider || "—"}</span>
                                        </div>
                                    </div>

                                    <div className="budget-mcard-footer">
                                        <div className="budget-user-cell">
                                            <strong>{item.learner_name || item.employee_name || "—"}</strong>
                                            <span className="budget-user-meta">{item.department || "—"}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="budget-view-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectTransaction(item, "course");
                                            }}
                                            title="View course details"
                                        >
                                            <img src={blueEyeIcon} alt="View" className="budget-eye-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 2. CERTIFICATION CLAIMS TABLE */}
            {activeCategory === "certifications" && (
                <div className="budget-table-responsive">
                    <div className="budget-table-desktop-view">

                        <table className={`budget-data-table budget-claims-table ${filteredClaims.length === 0 ? "is-empty" : ""}`}>
                            <colgroup>
                                <col style={{ width: "18%" }} />
                                <col style={{ width: "22%" }} />
                                <col style={{ width: "26%" }} />
                                <col style={{ width: "16%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "8%" }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className="budget-th-sortable" onClick={() => handleSort("request_id")} title="Click to sort by Request ID">
                                        <div className="budget-th-content">
                                            <span>Claim ID</span>
                                            {renderSortIcon("request_id")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("employee")} title="Click to sort by Employee">
                                        <div className="budget-th-content">
                                            <span>Employee</span>
                                            {renderSortIcon("employee")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("certification")} title="Click to sort by Certification">
                                        <div className="budget-th-content">
                                            <span>Certification</span>
                                            {renderSortIcon("certification")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("claim_date")} title="Click to sort by Claim Date">
                                        <div className="budget-th-content">
                                            <span>Claim Date</span>
                                            {renderSortIcon("claim_date")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("amount")} title="Click to sort by Amount">
                                        <div className="budget-th-content">
                                            <span>Amount</span>
                                            {renderSortIcon("amount")}
                                        </div>
                                    </th>
                                    {/* <th>Status</th> */}
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClaims.length === 0 ? (
                                    <tr className="budget-empty-row">
                                        <td colSpan={6} className="budget-empty-cell">
                                            <div className="budget-empty-state">
                                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                                <span>No certification claim records found.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedClaims.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="budget-code-stacked">
                                                    <code className="budget-code-badge">{item.claim_code}</code>
                                                    {/* <span className="budget-verify-id"><ShieldCheck size={11} /> {item.verification_id}</span> */}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="budget-user-avatar-row">
                                                    {/* <div
                                                    className="budget-avatar-circle"
                                                    style={{ backgroundColor: getAvatarBg(item.employee_name) }}
                                                >
                                                    {getInitials(item.employee_name)}
                                                </div> */}
                                                    <div className="budget-user-cell">
                                                        <strong title={item.employee_name}>{item.employee_name}</strong>
                                                        <span className="budget-user-meta" title={item.department}>{/*{item.employee_id} • */}{item.department}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="budget-entity-cell">
                                                    <span className="budget-entity-name" title={item.cert_title}>{item.cert_title}</span>
                                                    <div className="budget-entity-tags">
                                                        <span className="budget-tag provider" title={item.issuing_body}>{item.issuing_body}</span>
                                                        {/* <span className="budget-sla-badge"><Clock size={11} /> {item.sla_days} days</span> */}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="budget-timestamp-cell">
                                                    <span className="budget-date-primary">{(item.payment_time || item.submission_time || item.date || "").split(" ")[0]}</span>
                                                    {/* <span className="budget-time-secondary">{item.payment_time.split(" ")[1]}</span> */}
                                                </div>
                                            </td>
                                            <td><span className="budget-amount-cell highlight-green">{item.claim_amount_formatted || (item.claim_amount ? `₹${item.claim_amount.toLocaleString("en-IN")}` : (item.amount ? `₹${item.amount.toLocaleString("en-IN")}` : "₹0"))}</span></td>
                                            {/* <td>
                                            <span className="budget-status-pill paid">
                                                <CheckCircle2 size={12} />
                                                <span>{item.status}</span>
                                            </span>
                                        </td> */}
                                            <td>
                                                <button
                                                    type="button"
                                                    className="budget-view-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectTransaction(item, "claim");
                                                    }}
                                                    title="View claim details"
                                                >
                                                    <img src={blueEyeIcon} alt="View" className="budget-eye-icon" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="budget-table-mobile-view">
                        {filteredClaims.length === 0 ? (
                            <div className="budget-empty-state">
                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                <span>No certification claim records found.</span>
                            </div>
                        ) : (
                            paginatedClaims.map((item) => (
                                <div key={item.id} className="budget-mobile-card budget-mcard-cert">
                                    <div className="budget-mcard-header">
                                        <div className="budget-mcard-header-left">
                                            <span className="budget-mcard-code">{item.claim_id || item.id}</span>
                                            <span className="budget-mcard-date">{item.payment_time || item.submission_time || "—"}</span>
                                        </div>
                                        <div className="budget-mcard-header-right">
                                            <span className="budget-mcard-amount">{item.claim_amount_formatted || item.amount_formatted || `₹${Number(item.claim_amount || item.amount || 0).toLocaleString("en-IN")}`}</span>
                                        </div>
                                    </div>

                                    <div className="budget-mcard-main-info">
                                        <div className="budget-mcard-course-name">{item.certification_name || "—"}</div>
                                        <div className="budget-mcard-sub-info">
                                            <span className="budget-provider-badge">{item.issuing_body || "—"}</span>
                                        </div>
                                    </div>

                                    <div className="budget-mcard-footer">
                                        <div className="budget-user-cell">
                                            <strong>{item.employee_name || "—"}</strong>
                                            <span className="budget-user-meta">{item.department || "—"}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="budget-view-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectTransaction(item, "certification");
                                            }}
                                            title="View claim details"
                                        >
                                            <img src={blueEyeIcon} alt="View" className="budget-eye-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 3. WORKSHOPS & TRAINING TABLE */}
            {activeCategory === "workshops" && (
                <div className="budget-table-responsive">
                    <div className="budget-table-desktop-view">

                        <table className={`budget-data-table budget-workshops-table ${filteredWorkshops.length === 0 ? "is-empty" : ""}`}>
                            <colgroup>
                                <col style={{ width: "18%" }} />
                                <col style={{ width: "27%" }} />
                                <col style={{ width: "20%" }} />
                                <col style={{ width: "13%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "10%" }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className="budget-th-sortable" onClick={() => handleSort("event_date")} title="Click to sort by Event Date">
                                        <div className="budget-th-content">
                                            <span>Event Date</span>
                                            {renderSortIcon("event_date")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("event_name")} title="Click to sort by Event Name">
                                        <div className="budget-th-content">
                                            <span>Event Name</span>
                                            {renderSortIcon("event_name")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("department")} title="Click to sort by Department">
                                        <div className="budget-th-content">
                                            <span>Department</span>
                                            {renderSortIcon("department")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("participants")} title="Click to sort by Participants">
                                        <div className="budget-th-content">
                                            <span>Participants</span>
                                            {renderSortIcon("participants")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("amount")} title="Click to sort by Amount">
                                        <div className="budget-th-content">
                                            <span>Amount</span>
                                            {renderSortIcon("amount")}
                                        </div>
                                    </th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWorkshops.length === 0 ? (
                                    <tr className="budget-empty-row">
                                        <td colSpan={6} className="budget-empty-cell">
                                            <div className="budget-empty-state">
                                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                                <span>No workshop records found.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedWorkshops.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="budget-timestamp-cell">
                                                    <span className="budget-date-primary">{item.dates_formatted}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="budget-entity-cell">
                                                    <span className="budget-entity-name" title={item.event_name}>{item.event_name}</span>
                                                    <span
                                                        className={`budget-tag ${(item.event_category || (item.event_type === "Training" || item.event_type === "Workshop" ? item.event_type : "Workshop")).toLowerCase() === "training" ? "training" : "workshop"}`}
                                                        title={item.event_category || (item.event_type === "Training" || item.event_type === "Workshop" ? item.event_type : "Workshop")}
                                                    >
                                                        {item.event_category || (item.event_type === "Training" || item.event_type === "Workshop" ? item.event_type : "Workshop")}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="budget-dept-text" title={item.department || "—"}>
                                                    {item.department || "—"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="budget-participants-cell">
                                                    {/* <Users size={13} /> */}
                                                    <span>{item.participants_count}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="budget-amount-cell highlight-purple">
                                                    {item.event_type === "Unpaid" || Number(item.actual_spent || 0) <= 0
                                                        ? "Unpaid"
                                                        : (item.actual_spent_formatted || `₹${Number(item.actual_spent).toLocaleString("en-IN")}`)}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="budget-view-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectTransaction(item, "workshop");
                                                    }}
                                                    title="View event details"
                                                >
                                                    <img src={blueEyeIcon} alt="View" className="budget-eye-icon" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="budget-table-mobile-view">
                        {filteredWorkshops.length === 0 ? (
                            <div className="budget-empty-state">
                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                <span>No workshop records found.</span>
                            </div>
                        ) : (
                            paginatedWorkshops.map((item) => (
                                <div key={item.id} className="budget-mobile-card budget-mcard-workshop">
                                    <div className="budget-mcard-header">
                                        <div className="budget-mcard-header-left">
                                            <span className="budget-mcard-date">{item.dates || item.start_date || "—"}</span>
                                        </div>
                                        <div className="budget-mcard-header-right">
                                            <span className="budget-mcard-amount">{item.actual_spent_formatted || (item.actual_spent ? `₹${Number(item.actual_spent).toLocaleString("en-IN")}` : "₹0")}</span>
                                        </div>
                                    </div>

                                    <div className="budget-mcard-main-info">
                                        <div className="budget-mcard-course-name">{item.event_name || "—"}</div>
                                        <div className="budget-mcard-sub-info">
                                            <span className="budget-provider-badge">{item.event_category || item.event_type || "Workshop"}</span>
                                            <span className="budget-mcard-participants">{item.participants_count || item.participants || "0"} Participants</span>
                                        </div>
                                    </div>

                                    <div className="budget-mcard-footer">
                                        <span className="budget-user-meta">{item.department || "All Departments"}</span>
                                        <button
                                            type="button"
                                            className="budget-view-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectTransaction(item, "workshop");
                                            }}
                                            title="View workshop details"
                                        >
                                            <img src={blueEyeIcon} alt="View" className="budget-eye-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 4. DEPARTMENT BUDGETS TABLE */}
            {activeCategory === "departments" && (
                <div className="budget-table-responsive">
                    <div className="budget-table-desktop-view">

                        <table className={`budget-data-table budget-department-table ${filteredDepartments.length === 0 ? "is-empty" : ""}`}>
                            <colgroup>
                                <col style={{ width: "22%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "18%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "17%" }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className="budget-th-sortable" onClick={() => handleSort("department")} title="Click to sort by Department Name">
                                        <div className="budget-th-content">
                                            <span>Department Name</span>
                                            {renderSortIcon("department")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("course_spent")} title="Click to sort by Course Spent">
                                        <div className="budget-th-content">
                                            <span>Course Spent</span>
                                            {renderSortIcon("course_spent")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("reimbursement_spent")} title="Click to sort by Reimbursement Spent">
                                        <div className="budget-th-content">
                                            <span>Reimbursement Spent</span>
                                            {renderSortIcon("reimbursement_spent")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("workshops_spent")} title="Click to sort by Workshops Spent">
                                        <div className="budget-th-content">
                                            <span>Workshops Spent</span>
                                            {renderSortIcon("workshops_spent")}
                                        </div>
                                    </th>
                                    <th className="budget-th-sortable" onClick={() => handleSort("amount")} title="Click to sort by Amount">
                                        <div className="budget-th-content">
                                            <span>Amount</span>
                                            {renderSortIcon("amount")}
                                        </div>
                                    </th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDepartments.length === 0 ? (
                                    <tr className="budget-empty-row">
                                        <td colSpan={6} className="budget-empty-cell">
                                            <div className="budget-empty-state">
                                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                                <span>No department budget records found.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedDepartments.map((item) => {
                                        const isWatchlist = item.status === "Watchlist";
                                        return (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="budget-dept-title-wrap">
                                                        <span className="budget-dept-name" title={item.department}>{item.department}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="budget-amount-cell">
                                                        {item.spend_courses_formatted || `₹${Number(item.spend_courses || 0).toLocaleString("en-IN")}`}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="budget-amount-cell">
                                                        {item.spend_certifications_formatted || `₹${Number(item.spend_certifications || 0).toLocaleString("en-IN")}`}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="budget-amount-cell">
                                                        {item.spend_workshops_formatted || `₹${Number(item.spend_workshops || 0).toLocaleString("en-IN")}`}
                                                    </span>
                                                </td>
                                                <td><span className="budget-amount-cell highlight-purple" style={{ fontWeight: 400 }}>{item.amount_formatted || item.ytd_spent_formatted || `₹${Number(item.amount || item.ytd_spent || 0).toLocaleString("en-IN")}`}</span></td>
                                                <td>
                                                    <div className="budget-dept-progress-section">
                                                        <div className="budget-dept-progress-bar">
                                                            <div
                                                                className="budget-dept-progress-fill"
                                                                style={{
                                                                    width: `${item.percentage !== undefined && item.percentage !== null ? item.percentage : (item.utilization_pct || 0)}%`,
                                                                    backgroundColor: "#2563ed",
                                                                }}
                                                            />
                                                        </div>
                                                        <span style={{ fontSize: "12px", fontWeight: "500", color: "#080808" }}>
                                                            {item.percentage !== undefined ? `${item.percentage}%` : `${item.utilization_pct}%`}
                                                        </span>
                                                    </div>
                                                </td>

                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="budget-table-mobile-view">
                        {filteredDepartments.length === 0 ? (
                            <div className="budget-empty-state">
                                <img src={openBookIcon} alt="" className="budget-empty-icon" />
                                <span>No department budget records found.</span>
                            </div>
                        ) : (
                            paginatedDepartments.map((item) => (
                                <div key={item.id} className="budget-mobile-card budget-mcard-department">
                                    <div className="budget-mcard-header">
                                        <div className="budget-mcard-header-left">
                                            <span className="budget-mcard-title">{item.department}</span>
                                        </div>
                                        <div className="budget-mcard-header-right">
                                            <span className="budget-mcard-pct-badge">
                                                {item.percentage_formatted || `${(item.percentage !== undefined && item.percentage !== null ? item.percentage : (item.utilization_pct || 0)).toFixed(1)}%`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="budget-mcard-progress-wrap">
                                        <div
                                            className="budget-mcard-progress-bar"
                                            style={{
                                                width: `${item.percentage !== undefined && item.percentage !== null ? item.percentage : (item.utilization_pct || 0)}%`,
                                                backgroundColor: "#2563EB",
                                            }}
                                        />
                                    </div>

                                    <div className="budget-mcard-grid">
                                        <div className="budget-mcard-item">
                                            <span className="budget-mcard-label">Course Spent</span>
                                            <span className="budget-mcard-value">{item.spend_courses_formatted || `₹${Number(item.spend_courses || 0).toLocaleString("en-IN")}`}</span>
                                        </div>
                                        <div className="budget-mcard-item">
                                            <span className="budget-mcard-label">Reimbursement Spent</span>
                                            <span className="budget-mcard-value">{item.spend_certifications_formatted || `₹${Number(item.spend_certifications || 0).toLocaleString("en-IN")}`}</span>
                                        </div>
                                        <div className="budget-mcard-item">
                                            <span className="budget-mcard-label">Workshops Spent</span>
                                            <span className="budget-mcard-value">{item.spend_workshops_formatted || `₹${Number(item.spend_workshops || 0).toLocaleString("en-IN")}`}</span>
                                        </div>
                                        <div className="budget-mcard-item budget-mcard-item-highlight">
                                            <span className="budget-mcard-label">Total Spend</span>
                                            <span className="budget-mcard-value highlight-blue">
                                                {item.amount_formatted || item.ytd_spent_formatted || `₹${Number(item.amount || item.ytd_spent || 0).toLocaleString("en-IN")}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Pagination Footer matching Course Management 1:1 */}
            <div className="budget-table-footer">
                <span className="budget-pagination-info">
                    Showing {startItem} to {endItem} of {totalCount} Records
                </span>

                <div className="ld-pagination-controls">
                    <button
                        type="button"
                        className="ld-page-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        title="Previous Page"
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={13} />
                    </button>

                    {getPageNumbers().map((item, idx) => {
                        if (item === "dots") {
                            return (
                                <span key={`dots-${idx}`} className="ld-pagination-ellipsis">
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
                        disabled={currentPage === totalPages || totalCount === 0}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        title="Next Page"
                        aria-label="Next page"
                    >
                        <ChevronRight size={13} />
                    </button>
                </div>
            </div>

            {/* Slide-over Filter Courses Drawer for Course Purchase History */}
            {activeCategory === "courses" && (
                <CoursePurchaseHistoryFilterDrawer
                    isOpen={isCourseDrawerOpen}
                    onClose={() => setIsCourseDrawerOpen(false)}
                    selectedDepartments={selectedCourseDepartments}
                    selectedProviders={selectedCourseProviders}
                    purchaseStartDate={coursePurchaseStartDate}
                    purchaseEndDate={coursePurchaseEndDate}
                    availableDepartments={availableCourseDepartments}
                    availableProviders={availableCourseProviders}
                    onApply={({ departments, providers, purchaseStartDate, purchaseEndDate }) => {
                        setSelectedCourseDepartments(departments);
                        setSelectedCourseProviders(providers);
                        setCoursePurchaseStartDate(purchaseStartDate);
                        setCoursePurchaseEndDate(purchaseEndDate);
                    }}
                    onClearAll={handleClearAllCourseFilters}
                />
            )}

            {/* Slide-over Filter Drawer for Certification Reimbursement Claims */}
            {activeCategory === "certifications" && (
                <CertClaimsFilterDrawer
                    isOpen={isCertDrawerOpen}
                    onClose={() => setIsCertDrawerOpen(false)}
                    selectedDepartments={selectedCertDepartments}
                    selectedProviders={selectedCertProviders}
                    claimStartDate={certClaimStartDate}
                    claimEndDate={certClaimEndDate}
                    availableDepartments={availableCertDepartments}
                    availableProviders={availableCertProviders}
                    onApply={({ departments, providers, claimStartDate, claimEndDate }) => {
                        setSelectedCertDepartments(departments);
                        setSelectedCertProviders(providers);
                        setCertClaimStartDate(claimStartDate);
                        setCertClaimEndDate(claimEndDate);
                    }}
                    onClearAll={handleClearAllCertFilters}
                />
            )}
        </div>
    );
}
