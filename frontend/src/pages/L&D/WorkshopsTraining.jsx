import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Plus, Search, Calendar, Users, IndianRupee, Building, GraduationCap, X, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import editIcon from "../../assets/Sidebar/edit.svg";
import deleteIcon from "../../assets/Profile/delete.svg";
import blueEyeIcon from "../../assets/L&D/blue eye.svg";
import blueLineSvg from "../../assets/Certification/buleline.svg";
import openBookIcon from "../../assets/course_library/open_book_icon.svg";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";
import EmpModalSelect from "../../components/employee/Certification/EmpModalSelect";
import EmpDatePicker from "../../components/employee/Certification/EmpDatePicker";
import { validateCustomMetadataEntry } from "../../constants/courseMetadata";
import { sanitizeSingleSpaceInput } from "../../utils/validationUtils";
import filtersIcon from "../../assets/coursemanagement/filters.svg";
import WorkshopsFilterDrawer from "../../components/L&D/WorkshopsTraining/WorkshopsFilterDrawer";
import "../../styles/L&D/WorkshopsTraining.css";
import "../../styles/L&D/CourseManagement.css";
import "../../styles/employee/EnrollConfirmModal.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const INITIAL_FORM_STATE = {
    event_name: "",
    event_category: "",
    department: "",
    start_date: "",
    end_date: "",
    participants_count: "",
    event_type: "Paid",
    actual_spent: "",
};

// Format currency helper
const formatINR = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString("en-IN")}`;
};

export default function WorkshopsTraining() {
    const { token } = useAuth();

    const [workshops, setWorkshops] = useState([]);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Filter drawer state
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [filters, setFilters] = useState({
        categories: ["All"],
        departments: ["All"],
        amountRange: null,
        startDate: "",
        endDate: "",
    });

    // Details modal state
    const [viewingItem, setViewingItem] = useState(null);

    // Live Departments from Azure AD
    const [departmentsList, setDepartmentsList] = useState([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(INITIAL_FORM_STATE);
    const [formError, setFormError] = useState("");
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // "Others" custom category toggles (like in AddCourseMaterialModal)
    const [isOtherCategory, setIsOtherCategory] = useState(false);
    const [otherCategoryText, setOtherCategoryText] = useState("");
    const otherCategoryInputRef = useRef(null);

    // Auto-focus custom category input when "Others" is selected
    useEffect(() => {
        if (isOtherCategory && otherCategoryInputRef.current) {
            otherCategoryInputRef.current.focus();
        }
    }, [isOtherCategory]);

    const handleResetCategory = () => {
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setFormData((prev) => ({ ...prev, event_category: "" }));
        if (errors.event_category) {
            setErrors((prev) => ({ ...prev, event_category: "" }));
        }
    };

    const handleCloseModal = () => {
        if (isSaving) return;
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData(INITIAL_FORM_STATE);
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setFormError("");
        setErrors({});
    };

    // Delete modal state
    const [deletingItem, setDeletingItem] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const getAuthHeaders = useCallback(() => {
        const authToken = token || localStorage.getItem("lms_token");
        return {
            headers: {
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
        };
    }, [token]);

    // Load workshops and stats
    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [listRes, statsRes, deptRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/workshops`, getAuthHeaders()),
                axios.get(`${API_BASE_URL}/api/workshops/stats`, getAuthHeaders()),
                axios.get(`${API_BASE_URL}/api/workshops/departments`, getAuthHeaders()).catch(() => null),
            ]);
            setWorkshops(Array.isArray(listRes.data) ? listRes.data : []);
            setStats(statsRes.data || null);
            if (deptRes && Array.isArray(deptRes.data) && deptRes.data.length > 0) {
                setDepartmentsList(deptRes.data);
            } else {
                try {
                    const empRes = await axios.get(`${API_BASE_URL}/api/auth/employees`, getAuthHeaders());
                    const empList = empRes.data?.employees || [];
                    const liveDepts = Array.from(
                        new Set(empList.map((e) => (e.department || "").trim()).filter(Boolean))
                    ).sort();
                    if (liveDepts.length > 0) {
                        setDepartmentsList(liveDepts);
                    }
                } catch (e) {
                    console.warn("[WorkshopsTraining] Could not fetch Azure AD departments:", e);
                }
            }
        } catch (err) {
            console.error("Failed to load workshops data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Helper to get category for an item
    const getItemCategory = (w) => {
        return w.event_category || (w.event_type === "Training" || w.event_type === "Workshop" ? w.event_type : (w.event_name && w.event_name.toLowerCase().includes("training") ? "Training" : "Workshop"));
    };

    // Helper to get type for an item (Paid / Unpaid)
    const getItemType = (w) => {
        return w.event_type === "Paid" || w.event_type === "Unpaid" ? w.event_type : (Number(w.actual_spent || 0) > 0 ? "Paid" : "Unpaid");
    };

    // Event Category presets strictly for Workshops & Training events (Workshop / Training / Others)
    const workshopCategoryOptions = useMemo(() => {
        const set = new Set(["Workshop", "Training"]);
        workshops.forEach((w) => {
            const cat = getItemCategory(w);
            if (
                cat &&
                !["other", "others", "workshop", "training", "development", "devops", "data science", "security"].includes(
                    cat.toLowerCase()
                )
            ) {
                set.add(cat);
            }
        });
        return [...Array.from(set), "Others"];
    }, [workshops]);

    // Dynamic amount limits based strictly on the maximum amount in workshops records
    const amountLimits = useMemo(() => {
        let max = 0;
        workshops.forEach((w) => {
            const val = Number(w.actual_spent || 0);
            if (val > max) max = val;
        });
        const safeMax = max > 0 ? max : 1000;
        const step = safeMax <= 2000 ? 50 : safeMax <= 10000 ? 100 : safeMax <= 50000 ? 500 : 1000;
        return {
            min: 0,
            max: safeMax,
            step,
        };
    }, [workshops]);

    // Dynamic category options for drawer (strictly event categories)
    const filterCategoryOptions = useMemo(() => {
        const set = new Set(["Workshop", "Training"]);
        workshops.forEach((w) => {
            const cat = getItemCategory(w);
            if (
                cat &&
                !["other", "others", "all", "development", "devops", "data science", "security"].includes(
                    cat.toLowerCase()
                )
            ) {
                set.add(cat);
            }
        });
        return Array.from(set);
    }, [workshops]);

    // Dynamic department options for drawer: only departments present in table records
    const filterDepartmentOptions = useMemo(() => {
        const set = new Set();
        (workshops || []).forEach((w) => {
            const dept = (w.department || "").trim();
            if (dept && dept !== "—" && dept.toLowerCase() !== "all") {
                set.add(dept);
            }
        });
        return Array.from(set).sort();
    }, [workshops]);

    // Active filters count for drawer
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        const hasCategory =
            !filters.categories.includes("All") &&
            !filters.categories.includes("All Categories") &&
            filters.categories.length > 0;
        if (hasCategory) count += 1;

        const hasDept =
            !filters.departments.includes("All") &&
            !filters.departments.includes("All Departments") &&
            filters.departments.length > 0;
        if (hasDept) count += 1;

        const isAmountActive =
            Boolean(filters.amountRange) &&
            (filters.amountRange[0] > amountLimits.min ||
                filters.amountRange[1] < amountLimits.max);
        if (isAmountActive) count += 1;

        if (filters.startDate || filters.endDate) count += 1;

        return count;
    }, [filters, amountLimits]);

    const handleClearAllFilters = () => {
        setFilters({
            categories: ["All"],
            departments: ["All"],
            amountRange: [amountLimits.min, amountLimits.max],
            startDate: "",
            endDate: "",
        });
    };

    // Filtered workshops based on search query and filter drawer
    const filteredWorkshops = useMemo(() => {
        let list = workshops;

        // Drawer Category filter
        if (
            filters.categories &&
            !filters.categories.includes("All") &&
            !filters.categories.includes("All Categories") &&
            filters.categories.length > 0
        ) {
            const catsLower = filters.categories.map((c) => c.toLowerCase());
            list = list.filter((w) => catsLower.includes(getItemCategory(w).toLowerCase()));
        }

        // Drawer Department filter
        if (
            filters.departments &&
            !filters.departments.includes("All") &&
            !filters.departments.includes("All Departments") &&
            filters.departments.length > 0
        ) {
            const deptsLower = filters.departments.map((d) => d.toLowerCase());
            list = list.filter((w) => deptsLower.includes((w.department || "").trim().toLowerCase()));
        }

        // Drawer Amount filter
        const isAmountActive =
            Boolean(filters.amountRange) &&
            (filters.amountRange[0] > amountLimits.min ||
                filters.amountRange[1] < amountLimits.max);
        if (isAmountActive) {
            const minAmt = filters.amountRange[0];
            const maxAmt = filters.amountRange[1];
            list = list.filter((w) => {
                const spent = getItemType(w) === "Unpaid" ? 0 : Number(w.actual_spent || 0);
                if (spent < minAmt || spent > maxAmt) return false;
                return true;
            });
        }

        // Drawer Event Date filter (start date - end date)
        if (filters.startDate || filters.endDate) {
            const filterStart = filters.startDate ? new Date(filters.startDate) : null;
            if (filterStart) filterStart.setHours(0, 0, 0, 0);

            const filterEnd = filters.endDate ? new Date(filters.endDate) : null;
            if (filterEnd) filterEnd.setHours(23, 59, 59, 999);

            list = list.filter((w) => {
                const wStart = w.start_date ? new Date(w.start_date) : null;
                const wEnd = w.end_date ? new Date(w.end_date) : wStart;
                if (wStart) wStart.setHours(0, 0, 0, 0);
                if (wEnd) wEnd.setHours(23, 59, 59, 999);

                // Event must not end before filter start
                if (filterStart && wEnd && wEnd < filterStart) return false;
                // Event must not start after filter end
                if (filterEnd && wStart && wStart > filterEnd) return false;
                return true;
            });
        }

        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase().trim();
        const terms = q.split(/\s+/).filter(Boolean);
        return list.filter((w) => {
            const eventName = String(w.event_name || w.name || w.title || "").toLowerCase();
            const dept = String(w.department || "").toLowerCase();
            return (
                eventName.includes(q) ||
                dept.includes(q) ||
                (terms.length > 1 && terms.every((t) => eventName.includes(t) || dept.includes(t)))
            );
        });
    }, [workshops, searchQuery, filters, amountLimits]);

    // Sorting
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
            return <ArrowUpDown size={11} className="ld-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={11} className="ld-sort-icon active" />
        ) : (
            <ArrowDown size={11} className="ld-sort-icon active" />
        );
    };

    const sortedWorkshops = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) {
            return filteredWorkshops;
        }
        return [...filteredWorkshops].sort((a, b) => {
            let comp = 0;
            switch (sortConfig.key) {
                case "event_name": {
                    const nameA = String(a.event_name || "").trim().toLowerCase();
                    const nameB = String(b.event_name || "").trim().toLowerCase();
                    comp = nameA.localeCompare(nameB);
                    break;
                }
                case "department": {
                    const deptA = String(a.department || "").trim().toLowerCase();
                    const deptB = String(b.department || "").trim().toLowerCase();
                    comp = deptA.localeCompare(deptB);
                    break;
                }
                case "start_date": {
                    const timeA = a.start_date ? new Date(a.start_date).getTime() : 0;
                    const timeB = b.start_date ? new Date(b.start_date).getTime() : 0;
                    comp = timeA - timeB;
                    break;
                }
                case "end_date": {
                    const timeA = a.end_date ? new Date(a.end_date).getTime() : 0;
                    const timeB = b.end_date ? new Date(b.end_date).getTime() : 0;
                    comp = timeA - timeB;
                    break;
                }
                case "participants": {
                    const pA = Number(a.participants_count || 0);
                    const pB = Number(b.participants_count || 0);
                    comp = pA - pB;
                    break;
                }
                case "amount": {
                    const spentA = Number(a.actual_spent || 0);
                    const spentB = Number(b.actual_spent || 0);
                    comp = spentA - spentB;
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comp : -comp;
        });
    }, [filteredWorkshops, sortConfig]);

    // Pagination (matching Course Management with pageSize = 10)
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters, sortConfig]);

    const totalEntries = sortedWorkshops.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    const activePage = Math.min(currentPage, totalPages);
    const startIndex = totalEntries === 0 ? 0 : (activePage - 1) * pageSize + 1;
    const endIndex = Math.min(activePage * pageSize, totalEntries);

    const displayedWorkshops = useMemo(() => {
        const start = (activePage - 1) * pageSize;
        return sortedWorkshops.slice(start, start + pageSize);
    }, [sortedWorkshops, activePage, pageSize]);

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

    const workshopsCount = useMemo(() => {
        if (stats?.workshops_count !== undefined) return stats.workshops_count;
        return workshops.filter((w) => getItemCategory(w).toLowerCase() === "workshop").length;
    }, [stats, workshops]);

    const trainingCount = useMemo(() => {
        if (stats?.training_count !== undefined) return stats.training_count;
        return workshops.filter((w) => getItemCategory(w).toLowerCase() === "training").length;
    }, [stats, workshops]);

    const totalParticipants = useMemo(() => {
        if (stats?.total_participants !== undefined && stats?.total_participants !== null) {
            return stats.total_participants;
        }
        return workshops.reduce((acc, w) => acc + Number(w.participants_count || 0), 0);
    }, [stats, workshops]);

    const paidStats = useMemo(() => {
        if (stats?.paid_events_count !== undefined) {
            return {
                count: stats.paid_events_count,
                participants: stats.paid_participants_count ?? 0,
            };
        }
        const paidItems = workshops.filter((w) => getItemType(w).toLowerCase() === "paid");
        return {
            count: paidItems.length,
            participants: paidItems.reduce((acc, w) => acc + Number(w.participants_count || 0), 0),
        };
    }, [stats, workshops]);

    const unpaidStats = useMemo(() => {
        if (stats?.unpaid_events_count !== undefined) {
            return {
                count: stats.unpaid_events_count,
                participants: stats.unpaid_participants_count ?? 0,
            };
        }
        const unpaidItems = workshops.filter((w) => getItemType(w).toLowerCase() === "unpaid");
        return {
            count: unpaidItems.length,
            participants: unpaidItems.reduce((acc, w) => acc + Number(w.participants_count || 0), 0),
        };
    }, [stats, workshops]);

    const totalSpentFormatted = useMemo(() => {
        if (stats?.total_spent_formatted) return stats.total_spent_formatted;
        if (stats?.total_spent !== undefined && stats?.total_spent !== null) return formatINR(stats.total_spent);
        const sum = workshops.reduce((acc, w) => acc + Number(w.actual_spent || 0), 0);
        return formatINR(sum);
    }, [stats, workshops]);

    // Open Add Modal
    const handleOpenAddModal = () => {
        setEditingItem(null);
        setFormData(INITIAL_FORM_STATE);
        setIsOtherCategory(false);
        setOtherCategoryText("");
        setFormError("");
        setErrors({});
        setIsModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (item) => {
        setEditingItem(item);
        const category = getItemCategory(item);
        const type = getItemType(item);

        const matchedPreset = workshopCategoryOptions
            .filter((c) => c !== "Others")
            .find((c) => c.toLowerCase() === (category || "").trim().toLowerCase());
        const isStandardCategory = Boolean(matchedPreset);
        setIsOtherCategory(!isStandardCategory && Boolean(category));
        setOtherCategoryText(!isStandardCategory ? (category || "") : "");

        setFormData({
            department: item.department || "",
            event_category: isStandardCategory ? matchedPreset : (category ? "Others" : ""),
            event_type: type,
            event_name: item.event_name || "",
            start_date: item.start_date ? String(item.start_date).split("T")[0] : "",
            end_date: item.end_date ? String(item.end_date).split("T")[0] : "",
            participants_count: item.participants_count !== undefined && item.participants_count !== null ? String(item.participants_count) : "",
            actual_spent: type === "Unpaid" ? "0" : (item.actual_spent !== undefined && item.actual_spent !== null ? String(item.actual_spent) : ""),
        });
        setFormError("");
        setErrors({});
        setIsModalOpen(true);
    };

    // Form change handler
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let sanitizedValue = value;
        if (name === "event_name") {
            sanitizedValue = sanitizeSingleSpaceInput(value);
        }
        setFormData((prev) => ({
            ...prev,
            [name]: sanitizedValue,
        }));
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
        if (formError) setFormError("");
    };

    // Event type toggle handler (Paid / Unpaid)
    const handleEventTypeSelect = (type) => {
        setFormData((prev) => ({
            ...prev,
            event_type: type,
            actual_spent: type === "Unpaid" ? "0" : (prev.actual_spent === "0" ? "" : prev.actual_spent),
        }));
        if (errors.event_type) {
            setErrors((prev) => ({ ...prev, event_type: "" }));
        }
        if (type === "Unpaid" && errors.actual_spent) {
            setErrors((prev) => ({ ...prev, actual_spent: "" }));
        }
        if (formError) setFormError("");
    };

    // Save workshop (Create or Update)
    const handleSave = async (e) => {
        e.preventDefault();
        setFormError("");

        const newErrors = {};

        // Validation
        if (!formData.event_name.trim()) {
            newErrors.event_name = "This field is required";
        }

        const finalCategory = isOtherCategory ? otherCategoryText.trim() : formData.event_category;
        if (isOtherCategory) {
            const catErr = validateCustomMetadataEntry(otherCategoryText, workshopCategoryOptions.filter((c) => c !== "Others"), "category");
            if (catErr) {
                newErrors.event_category = catErr;
            }
        } else if (!finalCategory) {
            newErrors.event_category = "This field is required";
        }

        if (!formData.department || !formData.department.trim()) {
            newErrors.department = "This field is required";
        }

        if (!formData.start_date) {
            newErrors.start_date = "This field is required";
        }

        if (!formData.end_date) {
            newErrors.end_date = "This field is required";
        } else if (formData.start_date && new Date(formData.end_date) < new Date(formData.start_date)) {
            newErrors.end_date = "End Date must be on or after Start Date";
        }

        if (formData.participants_count === "" || formData.participants_count === null || formData.participants_count === undefined) {
            newErrors.participants_count = "This field is required";
        } else if (Number(formData.participants_count) < 0) {
            newErrors.participants_count = "Participants cannot be negative";
        }

        if (!formData.event_type) {
            newErrors.event_type = "This field is required";
        }

        if (formData.event_type === "Paid") {
            if (formData.actual_spent === "" || formData.actual_spent === null || formData.actual_spent === undefined) {
                newErrors.actual_spent = "This field is required";
            } else if (Number(formData.actual_spent) <= 0) {
                newErrors.actual_spent = "Actual spent must be greater than 0";
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        const payload = {
            ...formData,
            event_name: (formData.event_name || "").trim(),
            event_category: finalCategory,
            event_type: formData.event_type || "Paid",
            participants_count: Number(formData.participants_count || 0),
            actual_spent: formData.event_type === "Unpaid" ? 0 : Number(formData.actual_spent || 0),
            end_date: formData.end_date ? formData.end_date : null,
        };

        try {
            setIsSaving(true);
            const authConfig = getAuthHeaders();

            if (editingItem) {
                // Update
                await axios.put(
                    `${API_BASE_URL}/api/workshops/${editingItem.id}`,
                    payload,
                    authConfig
                );
            } else {
                // Create
                await axios.post(
                    `${API_BASE_URL}/api/workshops`,
                    payload,
                    authConfig
                );
            }
            handleCloseModal();
            loadData();
        } catch (err) {
            console.error("Failed to save workshop:", err);
            const msg = err.response?.data?.detail || "Failed to save workshop details. Please check the inputs.";
            setFormError(msg);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete handler
    const handleDelete = async () => {
        if (!deletingItem) return;
        try {
            setIsDeleting(true);
            await axios.delete(
                `${API_BASE_URL}/api/workshops/${deletingItem.id}`,
                getAuthHeaders()
            );
            setDeletingItem(null);
            loadData();
        } catch (err) {
            console.error("Failed to delete workshop:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    // Format date helper: "2026-10-20" -> "20 Oct 2026"
    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };



    return (
        <div className="ld-workshops-page">
            {/* Page Header */}
            <PageHeader
                title="Workshops & Training"
                subtitle="Manage and record completed workshop and training events, participant counts, and actual expenditures."
            />

            {/* KPI Stat Cards: 1. Workshops, 2. Training, 3. Total Participants, 4. Total Spent */}
            <div className="ld-workshops-stats-row">
                {/* 1. Workshops */}
                <div className="ld-workshops-stat-card">
                    <div className="ld-workshops-stat-icon-wrap blue">
                        <Building size={22} />
                    </div>
                    <div>
                        <div className="ld-workshops-stat-value">
                            {isLoading ? (
                                <span className="ld-skeleton-pulse" style={{ width: "45px", height: "22px" }} />
                            ) : (
                                stats?.workshops_count ?? workshopsCount
                            )}
                        </div>
                        <div className="ld-workshops-stat-label">Workshops</div>
                    </div>
                    <img src={blueLineSvg} alt="" className="ld-workshops-stat-bottom-line" />
                </div>

                {/* 2. Training */}
                <div className="ld-workshops-stat-card">
                    <div className="ld-workshops-stat-icon-wrap orange">
                        <GraduationCap size={22} />
                    </div>
                    <div>
                        <div className="ld-workshops-stat-value">
                            {isLoading ? (
                                <span className="ld-skeleton-pulse" style={{ width: "45px", height: "22px" }} />
                            ) : (
                                stats?.training_count ?? trainingCount
                            )}
                        </div>
                        <div className="ld-workshops-stat-label">Training</div>
                    </div>
                    <img src={blueLineSvg} alt="" className="ld-workshops-stat-bottom-line" />
                </div>

                {/* 3. Total Participants */}
                <div className="ld-workshops-stat-card">
                    <div className="ld-workshops-stat-icon-wrap purple">
                        <Users size={22} />
                    </div>
                    <div>
                        <div className="ld-workshops-stat-value">
                            {isLoading ? (
                                <span className="ld-skeleton-pulse" style={{ width: "60px", height: "22px" }} />
                            ) : (
                                (Number(stats?.total_participants ?? totalParticipants ?? 0)).toLocaleString("en-IN")
                            )}
                        </div>
                        <div className="ld-workshops-stat-label">Total Participants</div>
                    </div>
                    <img src={blueLineSvg} alt="" className="ld-workshops-stat-bottom-line" />
                </div>

                {/* 4. Total Spent */}
                <div className="ld-workshops-stat-card">
                    <div className="ld-workshops-stat-icon-wrap green">
                        <IndianRupee size={22} />
                    </div>
                    <div>
                        <div className="ld-workshops-stat-value">
                            {isLoading ? (
                                <span className="ld-skeleton-pulse" style={{ width: "95px", height: "22px" }} />
                            ) : (
                                totalSpentFormatted
                            )}
                        </div>
                        <div className="ld-workshops-stat-label">Total Spent</div>
                    </div>
                    <img src={blueLineSvg} alt="" className="ld-workshops-stat-bottom-line" />
                </div>
            </div>

            {/* Toolbar: Search & Count */}
            <div className="ld-workshops-toolbar">
                <div className="ld-workshops-search-wrap">
                    <Search size={16} color="#94A3B8" />
                    <input
                        type="text"
                        className="ld-workshops-search-input"
                        placeholder="Search by event name or department"
                        value={searchQuery}
                        style={{ fontSize: 12 }}
                        onChange={(e) => setSearchQuery(sanitizeSingleSpaceInput(e.target.value))}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                            <X size={14} color="#94A3B8" />
                        </button>
                    )}
                </div>

                <div className="ld-workshops-toolbar-right">
                    <button
                        type="button"
                        className={`ld-cm-filter-btn ${activeFiltersCount > 0 || isFilterDrawerOpen ? "filtered" : ""}`}
                        onClick={() => setIsFilterDrawerOpen(true)}
                        aria-label="Open Filters"
                    >
                        <img src={filtersIcon} alt="" style={{ width: 14, height: 10 }} />
                        <span>{activeFiltersCount > 0 ? `Filters (${activeFiltersCount})` : "Filters"}</span>
                        {activeFiltersCount > 0 && (
                            <span
                                className="ld-cm-clear-cross"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearAllFilters();
                                }}
                                title="Clear filters"
                                role="button"
                            >
                                ×
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        className="ld-workshops-add-btn"
                        onClick={handleOpenAddModal}
                    >
                        <Plus size={16} />
                        <span>New Event</span>
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className="ld-workshops-table-card">
                <div className="ld-workshops-table-responsive">
                    <table className="ld-workshops-table">
                        <thead>
                            <tr>
                                <th
                                    className="ld-th-event ld-th-sortable"
                                    onClick={() => handleSort("event_name")}
                                    title="Click to sort by Event Name"
                                >
                                    <div className="ld-th-content">
                                        <span>Event Name</span>
                                        {renderSortIcon("event_name")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-dept ld-th-sortable"
                                    onClick={() => handleSort("department")}
                                    title="Click to sort by Department"
                                >
                                    <div className="ld-th-content">
                                        <span>Department</span>
                                        {renderSortIcon("department")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-start-date ld-th-sortable"
                                    onClick={() => handleSort("start_date")}
                                    title="Click to sort by Start Date"
                                >
                                    <div className="ld-th-content">
                                        <span>Start Date</span>
                                        {renderSortIcon("start_date")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-end-date ld-th-sortable"
                                    onClick={() => handleSort("end_date")}
                                    title="Click to sort by End Date"
                                >
                                    <div className="ld-th-content">
                                        <span>End Date</span>
                                        {renderSortIcon("end_date")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-participants ld-th-sortable"
                                    onClick={() => handleSort("participants")}
                                    title="Click to sort by Participants"
                                >
                                    <div className="ld-th-content">
                                        <span>Participants</span>
                                        {renderSortIcon("participants")}
                                    </div>
                                </th>
                                <th
                                    className="ld-th-spent ld-th-sortable"
                                    onClick={() => handleSort("amount")}
                                    title="Click to sort by Amount"
                                >
                                    <div className="ld-th-content">
                                        <span>Amount</span>
                                        {renderSortIcon("amount")}
                                    </div>
                                </th>
                                <th className="ld-th-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [1, 2, 3].map((idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                <span className="ld-skeleton-pulse" style={{ width: "180px", height: "15px" }} />
                                                <span className="ld-skeleton-pulse" style={{ width: "65px", height: "18px", borderRadius: "4px" }} />
                                            </div>
                                        </td>
                                        <td><span className="ld-skeleton-pulse" style={{ width: "110px", height: "16px" }} /></td>
                                        <td><span className="ld-skeleton-pulse" style={{ width: "85px", height: "16px" }} /></td>
                                        <td><span className="ld-skeleton-pulse" style={{ width: "85px", height: "16px" }} /></td>
                                        <td><span className="ld-skeleton-pulse" style={{ width: "45px", height: "16px" }} /></td>
                                        <td><span className="ld-skeleton-pulse" style={{ width: "75px", height: "16px" }} /></td>
                                        <td style={{ textAlign: "right" }}>
                                            <span className="ld-skeleton-pulse" style={{ width: "60px", height: "24px" }} />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredWorkshops.length === 0 ? (
                                <tr className="ld-empty-table-row">
                                    <td colSpan={7} className="ld-empty-table-cell">
                                        <div className="ld-empty-table-state">
                                            <img
                                                src={openBookIcon}
                                                alt="No events found"
                                                className="ld-empty-table-icon"
                                            />
                                            <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No events found</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayedWorkshops.map((item) => {
                                    const eventCategory = getItemCategory(item);
                                    const isTraining = eventCategory.toLowerCase().includes("training");

                                    return (
                                        <tr
                                            key={item.id}
                                            className="ld-workshop-table-row"
                                        >
                                            <td className="ld-col-event">
                                                <div className="ld-event-col-content">
                                                    <span className="ld-event-name" title={item.event_name}>
                                                        {item.event_name}
                                                    </span>
                                                    <span className={`ld-event-type-badge ${isTraining ? "training" : "workshop"}`} title={eventCategory}>
                                                        {eventCategory}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="ld-col-dept">
                                                <span className="ld-dept-text" title={item.department || "—"}>
                                                    {item.department || "—"}
                                                </span>
                                            </td>
                                            <td className="ld-col-date">{formatDate(item.start_date)}</td>
                                            <td className="ld-col-date">{formatDate(item.end_date)}</td>
                                            <td className="ld-col-participants">{item.participants_count?.toLocaleString("en-IN")}</td>
                                            <td className="ld-col-spent">
                                                {getItemType(item) === "Unpaid" || Number(item.actual_spent || 0) <= 0
                                                    ? "Unpaid"
                                                    : formatINR(item.actual_spent)}
                                            </td>
                                            <td className="ld-col-actions" onClick={(e) => e.stopPropagation()}>
                                                <div className="ld-workshops-actions">
                                                    <button
                                                        type="button"
                                                        className="ld-action-icon-btn view"
                                                        title="View Event Details"
                                                        onClick={() => setViewingItem(item)}
                                                    >
                                                        <img src={blueEyeIcon} alt="View" className="ld-action-icon-img" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ld-action-icon-btn edit"
                                                        title="Edit Event"
                                                        onClick={() => handleOpenEditModal(item)}
                                                    >
                                                        <img src={editIcon} alt="Edit" className="ld-action-icon-img" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ld-action-icon-btn delete"
                                                        title="Delete Event"
                                                        onClick={() => setDeletingItem(item)}
                                                    >
                                                        <img src={deleteIcon} alt="Delete" className="ld-action-icon-img" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer matching Course Management 1:1 */}
                <div className="ld-workshops-pagination-row">
                    <span className="ld-workshops-pagination-info">
                        Showing {startIndex} to {endIndex} of {totalEntries} entries
                    </span>
                    <div className="ld-pagination-controls">
                        <button
                            type="button"
                            className="ld-page-btn"
                            disabled={activePage === 1}
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
                                    className={`ld-page-btn ${activePage === item ? "active" : ""}`}
                                    onClick={() => setCurrentPage(item)}
                                >
                                    {item}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            className="ld-page-btn"
                            disabled={activePage === totalPages || totalEntries === 0}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            title="Next Page"
                            aria-label="Next page"
                        >
                            <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal: Event Details (Row Click - closes ONLY via X icon button) */}
            {viewingItem &&
                createPortal(
                    <div className="ld-cad-modal-overlay">
                        <div className="ld-cad-modal-card" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => setViewingItem(null)}
                                className="ld-cad-close-btn"
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>

                            <div className="ld-cad-header">
                                <h2 className="ld-cad-title">Event Details</h2>
                                <p className="ld-cad-subtitle">
                                    View the event details, participants, and expenditure information.
                                </p>
                            </div>

                            <div className="ld-cad-grid">
                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">Event Name</span>
                                    <span className="ld-cad-value">{viewingItem.event_name || "—"}</span>
                                </div>

                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">Department</span>
                                    <span className="ld-cad-value">{viewingItem.department || "—"}</span>
                                </div>

                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">Event Category</span>
                                    <span className="ld-cad-value">
                                        {getItemCategory(viewingItem)}
                                    </span>
                                </div>

                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">Event Type</span>
                                    <span className="ld-cad-value">
                                        {getItemType(viewingItem)}
                                    </span>
                                </div>

                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">Start Date</span>
                                    <span className="ld-cad-value">{formatDate(viewingItem.start_date)}</span>
                                </div>

                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">End Date</span>
                                    <span className="ld-cad-value">{formatDate(viewingItem.end_date)}</span>
                                </div>

                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">Participants</span>
                                    <span className="ld-cad-value">
                                        {viewingItem.participants_count !== undefined && viewingItem.participants_count !== null
                                            ? Number(viewingItem.participants_count).toLocaleString("en-IN")
                                            : "0"}
                                    </span>
                                </div>

                                <div className="ld-cad-row">
                                    <span className="ld-cad-label">Actual Spent</span>
                                    <span className="ld-cad-value">
                                        {getItemType(viewingItem) === "Unpaid" || Number(viewingItem.actual_spent || 0) <= 0
                                            ? "Unpaid"
                                            : formatINR(viewingItem.actual_spent)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Modal: Add / Edit Event (closes ONLY via X button, not by backdrop click) */}
            {isModalOpen && (
                <div className="ld-modal-overlay">
                    <div className="ld-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="ld-modal-header">
                            <div>
                                <h3>{editingItem ? "Edit Workshop / Training" : "Add New Workshop / Training"}</h3>
                                <p className="ld-modal-subtitle">
                                    {editingItem
                                        ? "Update the workshop or training details below."
                                        : "Enter the details of your workshop or training."}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="ld-modal-close-btn"
                                onClick={handleCloseModal}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} noValidate>
                            <div className="ld-modal-body">
                                {formError && (
                                    <div className="ld-modal-error">
                                        <AlertCircle size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                                        {formError}
                                    </div>
                                )}

                                {/* Row 1: Event Name (Full Width) */}
                                <div className="ld-form-group">
                                    <label htmlFor="event_name">
                                        Event Name <span className="required">*</span>
                                    </label>
                                    <input
                                        id="event_name"
                                        name="event_name"
                                        type="text"
                                        className={`ld-form-input ${errors.event_name ? "has-error" : ""} ${!formData.event_name ? "is-empty" : ""}`}
                                        placeholder="e.g. Technical Symposium 2026, AI & ML Workshop"
                                        value={formData.event_name}
                                        onChange={handleInputChange}
                                        onBlur={() => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                event_name: (prev.event_name || "").trim(),
                                            }));
                                        }}
                                        autoFocus
                                    />
                                    {errors.event_name && <span className="ld-form-error-text">{errors.event_name}</span>}
                                </div>

                                {/* Row 2: Event Category & Department */}
                                <div className="ld-form-row-2">
                                    <div className="ld-form-group">
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <label htmlFor="event_category">
                                                Event Category <span className="required">*</span>
                                            </label>
                                            {isOtherCategory && (
                                                <button
                                                    type="button"
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        color: "#215EF8",
                                                        fontSize: "11.5px",
                                                        fontWeight: 500,
                                                        cursor: "pointer",
                                                        padding: 0
                                                    }}
                                                    onClick={handleResetCategory}
                                                >
                                                    ← Back to presets
                                                </button>
                                            )}
                                        </div>
                                        {!isOtherCategory ? (
                                            <EmpModalSelect
                                                id="event_category"
                                                value={formData.event_category}
                                                options={workshopCategoryOptions}
                                                placeholder="Select Event Category"
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "Others") {
                                                        setIsOtherCategory(true);
                                                        setOtherCategoryText("");
                                                        setFormData((prev) => ({ ...prev, event_category: "Others" }));
                                                    } else {
                                                        setIsOtherCategory(false);
                                                        setFormData((prev) => ({ ...prev, event_category: val }));
                                                    }
                                                    if (errors.event_category) setErrors((prev) => ({ ...prev, event_category: "" }));
                                                    if (formError) setFormError("");
                                                }}
                                                hasError={Boolean(errors.event_category)}
                                            />
                                        ) : (
                                            <input
                                                ref={otherCategoryInputRef}
                                                id="custom_event_category"
                                                type="text"
                                                className={`ld-form-input ${!otherCategoryText ? "is-empty" : ""} ${errors.event_category ? "has-error" : ""}`}
                                                placeholder="Enter custom category name"
                                                maxLength={50}
                                                value={otherCategoryText}
                                                onChange={(e) => {
                                                    setOtherCategoryText(sanitizeSingleSpaceInput(e.target.value));
                                                    if (errors.event_category) setErrors((prev) => ({ ...prev, event_category: "" }));
                                                    if (formError) setFormError("");
                                                }}
                                                onBlur={() => setOtherCategoryText((prev) => (prev || "").trim())}
                                            />
                                        )}
                                        {errors.event_category && <span className="ld-form-error-text">{errors.event_category}</span>}
                                    </div>

                                    <div className="ld-form-group">
                                        <label htmlFor="department">
                                            Department <span className="required">*</span>
                                        </label>
                                        <EmpModalSelect
                                            id="department"
                                            value={formData.department}
                                            options={departmentsList}
                                            placeholder="Select Department"
                                            onChange={(e) => {
                                                setFormData((prev) => ({ ...prev, department: e.target.value }));
                                                if (errors.department) setErrors((prev) => ({ ...prev, department: "" }));
                                                if (formError) setFormError("");
                                            }}
                                            hasError={Boolean(errors.department)}
                                        />
                                        {errors.department && <span className="ld-form-error-text">{errors.department}</span>}
                                    </div>
                                </div>

                                {/* Row 3: Start Date & End Date */}
                                <div className="ld-form-row-2">
                                    <div className="ld-form-group">
                                        <label htmlFor="start_date">
                                            Start Date <span className="required">*</span>
                                        </label>
                                        <EmpDatePicker
                                            id="start_date"
                                            placeholder="dd-mm-yyyy"
                                            value={formData.start_date}
                                            onChange={(e) => {
                                                setFormData((prev) => ({ ...prev, start_date: e.target.value }));
                                                if (errors.start_date) setErrors((prev) => ({ ...prev, start_date: "" }));
                                                if (formError) setFormError("");
                                            }}
                                            hasError={Boolean(errors.start_date)}
                                            dropUp={true}
                                        />
                                        {errors.start_date && <span className="ld-form-error-text">{errors.start_date}</span>}
                                    </div>

                                    <div className="ld-form-group">
                                        <label htmlFor="end_date">
                                            End Date <span className="required">*</span>
                                        </label>
                                        <EmpDatePicker
                                            id="end_date"
                                            placeholder="dd-mm-yyyy"
                                            value={formData.end_date}
                                            min={formData.start_date || undefined}
                                            onChange={(e) => {
                                                setFormData((prev) => ({ ...prev, end_date: e.target.value }));
                                                if (errors.end_date) setErrors((prev) => ({ ...prev, end_date: "" }));
                                                if (formError) setFormError("");
                                            }}
                                            hasError={Boolean(errors.end_date)}
                                            dropUp={true}
                                        />
                                        {errors.end_date && <span className="ld-form-error-text">{errors.end_date}</span>}
                                    </div>
                                </div>

                                {/* Row 4: Participants & Event Type */}
                                <div className="ld-form-row-2">
                                    <div className="ld-form-group">
                                        <label htmlFor="participants_count">
                                            Participants <span className="required">*</span>
                                        </label>
                                        <input
                                            id="participants_count"
                                            name="participants_count"
                                            type="number"
                                            min="0"
                                            className={`ld-form-input ${errors.participants_count ? "has-error" : ""} ${formData.participants_count === "" ? "is-empty" : ""}`}
                                            placeholder="e.g. 150"
                                            value={formData.participants_count}
                                            onChange={handleInputChange}
                                        />
                                        {errors.participants_count && <span className="ld-form-error-text">{errors.participants_count}</span>}
                                    </div>

                                    <div className="ld-form-group">
                                        <label>
                                            Event Type <span className="required">*</span>
                                        </label>
                                        <div className={`ld-radio-group ${errors.event_type ? "has-error" : ""}`}>
                                            <label className="ld-radio-label">
                                                <input
                                                    type="radio"
                                                    name="event_type"
                                                    value="Paid"
                                                    checked={formData.event_type === "Paid"}
                                                    onChange={() => handleEventTypeSelect("Paid")}
                                                    className="ld-radio-input"
                                                />
                                                <span className="ld-radio-text">Paid</span>
                                            </label>
                                            <label className="ld-radio-label">
                                                <input
                                                    type="radio"
                                                    name="event_type"
                                                    value="Unpaid"
                                                    checked={formData.event_type === "Unpaid"}
                                                    onChange={() => handleEventTypeSelect("Unpaid")}
                                                    className="ld-radio-input"
                                                />
                                                <span className="ld-radio-text">Unpaid</span>
                                            </label>
                                        </div>
                                        {errors.event_type && <span className="ld-form-error-text">{errors.event_type}</span>}
                                    </div>
                                </div>

                                {/* Row 5: Actual Spent (only when Event Type is Paid) */}
                                {formData.event_type === "Paid" && (
                                    <div className="ld-form-row-2">
                                        <div className="ld-form-group">
                                            <label htmlFor="actual_spent">
                                                Actual Spent (₹) <span className="required">*</span>
                                            </label>
                                            <input
                                                id="actual_spent"
                                                name="actual_spent"
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                className={`ld-form-input ${errors.actual_spent ? "has-error" : ""} ${formData.actual_spent === "" ? "is-empty" : ""}`}
                                                placeholder="e.g. 30000"
                                                value={formData.actual_spent}
                                                onChange={handleInputChange}
                                            />
                                            {errors.actual_spent && <span className="ld-form-error-text">{errors.actual_spent}</span>}
                                        </div>
                                        <div className="ld-form-group" />
                                    </div>
                                )}
                            </div>

                            <div className="ld-modal-footer">
                                <button
                                    type="button"
                                    className="ld-btn-secondary"
                                    onClick={handleCloseModal}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="ld-btn-primary"
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Saving..." : editingItem ? "Update" : "Submit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Delete Confirmation */}
            {deletingItem && (
                <div className="emp-enroll-confirm-overlay">
                    <div
                        className="emp-enroll-confirm-card"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Close Button */}
                        <button
                            type="button"
                            className="emp-enroll-confirm-close"
                            onClick={() => !isDeleting && setDeletingItem(null)}
                            disabled={isDeleting}
                            aria-label="Close dialog"
                        >
                            <X size={16} color="#64748B" />
                        </button>

                        {/* Icon Header */}
                        <div className="emp-enroll-confirm-icon-wrap">
                            <div className="emp-enroll-confirm-icon-circle emp-delete-confirm-icon-circle">
                                <Trash2 size={26} strokeWidth={2.2} className="emp-enroll-confirm-icon emp-delete-confirm-icon" color="#EF4444" />
                            </div>
                        </div>

                        {/* Title & Prompt */}
                        <h2 className="emp-enroll-confirm-title" style={{ fontWeight: 600 }}>
                            Confirm to Delete
                        </h2>
                        <p className="emp-enroll-confirm-prompt">
                            Are you sure you want to delete{" "}
                            <strong className="emp-enroll-course-highlight" style={{ fontWeight: 700 }}>
                                {deletingItem.event_name}
                            </strong>
                            ?
                        </p>

                        {/* Action Buttons: Cancel / Delete */}
                        <div className="emp-enroll-confirm-actions">
                            <button
                                type="button"
                                className="emp-enroll-confirm-btn emp-btn-no"
                                style={{ minWidth: 84, fontWeight: 500 }}
                                onClick={() => setDeletingItem(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="emp-enroll-confirm-btn emp-btn-delete-red"
                                style={{ minWidth: 84, fontWeight: 500 }}
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Drawer */}
            <WorkshopsFilterDrawer
                isOpen={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                categories={filterCategoryOptions}
                selectedCategories={filters.categories}
                departments={filterDepartmentOptions}
                selectedDepartments={filters.departments}
                amountLimits={amountLimits}
                selectedAmountRange={filters.amountRange || [amountLimits.min, amountLimits.max]}
                selectedStartDate={filters.startDate}
                selectedEndDate={filters.endDate}
                onApply={(newFilters) => setFilters(newFilters)}
                onClearAll={handleClearAllFilters}
            />
        </div>
    );
}
