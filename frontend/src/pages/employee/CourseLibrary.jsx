import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import {
    Plus,
    Bell,
    ChevronDown,
    Check,
    X,
} from "lucide-react";

import StudyMaterials from "../../components/employee/CourseLibrary/StudyMaterials";
import RequestCourseModal from "../../components/employee/CourseLibrary/RequestCourseModal";
import TopToastNotification from "../../components/common/TopToastNotification";
import CourseRequestTracker from "../../components/employee/CourseLibrary/CourseRequestTracker";
import CourseCard from "../../components/employee/CourseLibrary/CourseCard";
import EnrollConfirmModal from "../../components/employee/CourseLibrary/EnrollConfirmModal";
import Pagination from "../../components/employee/CourseLibrary/Pagination";
import PageHeader from "../../components/common/PageHeader";
import CourseModalDropdown from "../../components/L&D/CourseManagement/CourseModalDropdown";
import CourseFilterPopover from "../../components/employee/CourseLibrary/CourseFilterPopover";
import ResourceFilterDrawer from "../../components/employee/CourseLibrary/ResourceFilterDrawer";
import useCourseMetadata from "../../hooks/useCourseMetadata";
import { resolveAndPersistFormMetadata } from "../../services/courseMetadataService";
import { useAuth } from "../../context/AuthContext";

import filterIcon from "../../assets/course_library/filter.svg";
import searchIcon from "../../assets/course_library/search.svg";
import trackIcon from "../../assets/course_library/track.svg";
import openBookIcon from "../../assets/course_library/open_book_icon.svg";

import { COURSE_ICONS, getStatusIcon } from "../../constants/courseIcons";
import { formatMaterialFileSize, deriveMaterialFormatOptions } from "../../utils/materialUtils";
import useNotificationRowHighlight from "../../hooks/useNotificationRowHighlight";
import useSubmitLock, { extractApiErrorMessage } from "../../hooks/useSubmitLock";
import {
    requestCourseEnrollment,
    fetchMyEnrollmentStatus,
} from "../../services/courseEnrollmentService";

const mapCategoryToIconType = (category) => {
    if (!category) return "development";
    const clean = category.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.includes("devops")) return "devops";
    if (clean.includes("data") || clean.includes("science")) return "datascience";
    if (clean.includes("security")) return "security";
    if (clean.includes("ai") || clean.includes("ml")) return "aiml";
    if (clean.includes("cloud")) return "cloud";
    if (clean.includes("manage")) return "management";
    return "development";
};

const formatDuration = (totalMinutes) => {
    const mins = Math.max(0, Math.round(Number(totalMinutes) || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
        return `${h}h ${String(m).padStart(2, "0")}m`;
    }
    return `${m}m`;
};

const parseDurationToMinutes = (dur, durMin) => {
    if (typeof durMin === "number" && durMin > 0) return durMin;
    if (typeof dur === "number" && dur > 0) return dur;
    if (typeof dur === "string") {
        const hMatch = dur.match(/(\d+)\s*h/i);
        const mMatch = dur.match(/(\d+)\s*m/i);
        let total = 0;
        if (hMatch) total += parseInt(hMatch[1], 10) * 60;
        if (mMatch) total += parseInt(mMatch[1], 10);
        if (total > 0) return total;
        const num = parseInt(dur, 10);
        if (!isNaN(num) && num > 0) return num;
    }
    return 150; // fallback 2h 30m
};

import "../../styles/employee/CourseLibrary.css";
import "../../styles/employee/StudyMaterials.css";

const CourseLibrary = () => {
    /* =========================================================
       STATE
    ========================================================= */

    const { categoryNames: liveCategoryNames, providerNames: liveProviderNames } = useCourseMetadata();

    const [courses, setCourses] = useState([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);

    const [activeTab, setActiveTab] = useState("video");
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [selectedCategories, setSelectedCategories] = useState(["All"]);
    const [selectedProviders, setSelectedProviders] = useState(["All"]);
    const [selectedStatuses, setSelectedStatuses] = useState(["All"]);
    const [isVideoFilterOpen, setIsVideoFilterOpen] = useState(false);
    const [sortBy, setSortBy] = useState("Latest");
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortDropdownRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
    const [toast, setToast] = useState({ isOpen: false, message: "", type: "success" });
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const filterPopoverRef = useRef(null);
    const [selectedMaterialType, setSelectedMaterialType] = useState("All");
    const [selectedMaterialCategories, setSelectedMaterialCategories] = useState(["All"]);
    const [selectedMaterialFormats, setSelectedMaterialFormats] = useState(["All"]);
    const [trackerItems, setTrackerItems] = useState([]);
    const [isTrackerLoading, setIsTrackerLoading] = useState(false);
    const [confirmCourse, setConfirmCourse] = useState(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false);
    const {
        isSubmitting: isSubmittingRequest,
        runWithLock: runRequestWithLock,
        resetIdempotencyKey: resetRequestIdemKey,
    } = useSubmitLock();

    const { user, currentUser } = useAuth();
    const scrollContainerRef = useRef(null);
    const location = useLocation();

    // Notification course highlight state
    const [coursesFetched, setCoursesFetched] = useState(false);
    const [materialsFetched, setMaterialsFetched] = useState(false);
    const [trackerFetched, setTrackerFetched] = useState(false);
    const [pendingHighlight, setPendingHighlight] = useState(null);
    const [highlightedTarget, setHighlightedTarget] = useState(null); // { type: 'video' | 'materials', id }
    const highlightTimerRef = useRef(null);

    // Active logged-in user identification
    const activeUser = user || currentUser;
    const activeEmpName = (activeUser?.full_name || activeUser?.name || activeUser?.displayName || (activeUser?.email ? activeUser.email.split("@")[0] : "Learner")).split("(")[0].trim();
    const activeEmpRole = (activeUser?.department && activeUser?.department.toLowerCase() !== "employee")
        ? activeUser.department
        : (activeUser?.job_title && activeUser?.job_title.toLowerCase() !== "employee")
            ? activeUser.job_title
            : (activeUser?.role && activeUser?.role.toLowerCase() !== "employee")
                ? activeUser.role
                : (activeUser?.department || "—");
    const resolvedEmpId = (() => {
        if (activeUser?.employee_id) return activeUser.employee_id;
        if (activeUser?.empId) return activeUser.empId;
        const storedUser = localStorage.getItem("lms_user");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed?.employee_id) return parsed.employee_id;
                if (parsed?.empId) return parsed.empId;
            } catch (e) { }
        }
        return localStorage.getItem("lms_active_employee_id") || "XXXYYY";
    })();
    const activeEmpIdNum = parseInt(String(resolvedEmpId).replace(/\D/g, ""), 10) || null;

    // Fetch live courses from database table lms_courses and sync enrollment status
    useEffect(() => {
        let isMounted = true;
        const fetchLiveCourses = async () => {
            setIsLoadingCourses(true);
            try {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
                const empId = resolvedEmpId;

                const [coursesRes, enrollmentData] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/courses?is_active=true`),
                    fetchMyEnrollmentStatus(empId).catch(() => ({})),
                ]);

                const statusMap = enrollmentData?.statusMap || enrollmentData || {};
                const progressMap = enrollmentData?.progressMap || {};
                const completedMap = enrollmentData?.completedMap || {};

                if (isMounted && Array.isArray(coursesRes.data) && coursesRes.data.length > 0) {
                    const mapped = coursesRes.data.map((c) => {
                        const rawCourseId = c.id ?? c.course_id;
                        const cat = (c.category_name || "—").toUpperCase();
                        const iconKey = mapCategoryToIconType(cat);

                        let cardStatus = "available";
                        const dbStatus = statusMap[rawCourseId] || statusMap[String(rawCourseId)];
                        const rawProg = progressMap[rawCourseId] ?? progressMap[String(rawCourseId)] ?? 0;
                        const numProg = Number(rawProg);
                        const courseProgress = isNaN(numProg) ? 0 : (numProg % 1 === 0 ? numProg : Number(numProg.toFixed(1)));

                        const normDb = String(dbStatus || "").toLowerCase().trim().replace(/_/g, " ");
                        if (normDb === "completed" || courseProgress >= 100) cardStatus = "completed";
                        else if (normDb === "in progress" || normDb === "in-progress" || courseProgress > 0) cardStatus = "in-progress";
                        else if (normDb === "not started" || normDb === "not-started" || normDb === "enrolled" || normDb === "approved") cardStatus = "not-started";   // Post-approval: ready to launch
                        else if (normDb === "pending" || normDb === "requested") cardStatus = "pending";
                        else if (normDb === "on hold" || normDb === "on-hold" || normDb === "onhold") cardStatus = "on-hold";
                        else if (normDb === "assigned") cardStatus = "assigned";       // L&D direct: needs enroll request
                        else cardStatus = "available";

                        // Compute Duration Metrics (Total, Completed, Remaining)
                        const totalMin = parseDurationToMinutes(c.duration, c.duration_minutes);
                        let completedMin = 0;
                        if (completedMap[rawCourseId] !== undefined) {
                            completedMin = Number(completedMap[rawCourseId]);
                        } else if (completedMap[String(rawCourseId)] !== undefined) {
                            completedMin = Number(completedMap[String(rawCourseId)]);
                        } else {
                            completedMin = Math.round((courseProgress / 100) * totalMin);
                        }

                        if (cardStatus === "completed" || courseProgress >= 100) {
                            completedMin = totalMin;
                        } else if (cardStatus === "not-started" || courseProgress === 0) {
                            completedMin = 0;
                        } else {
                            completedMin = Math.min(totalMin, Math.max(0, completedMin));
                        }

                        const remainingMin = Math.max(0, totalMin - completedMin);

                        const totalDurationText = formatDuration(totalMin);
                        const completedDurationText = formatDuration(completedMin);
                        const remainingDurationText = formatDuration(remainingMin);

                        return {
                            id: c.id,
                            course_id: c.id,
                            title: c.course_title,
                            courseUrl: c.course_url,
                            provider: c.provider_name || "—",
                            category: cat,
                            duration: c.duration || totalDurationText,
                            totalDurationText,
                            completedDurationText,
                            remainingDurationText,
                            totalMin,
                            completedMin,
                            remainingMin,
                            iconType: cardStatus,
                            icon: getStatusIcon(cardStatus),
                            providerIcon: COURSE_ICONS.webLogo,
                            description: c.description,
                            supported_document: c.supported_document,
                            status: cardStatus,
                            progress: courseProgress,
                            is_active: c.is_active,
                        };
                    });
                    setCourses(mapped);
                }
            } catch (err) {
                console.error("Error loading courses in employee CourseLibrary:", err);
            } finally {
                if (isMounted) {
                    setIsLoadingCourses(false);
                    setCoursesFetched(true);
                }
            }
        };

        fetchLiveCourses();
        return () => {
            isMounted = false;
        };
    }, [resolvedEmpId]);

    // ─── Dynamic Pagination Based on Screen Width & Viewport Height ─────────────
    // Screen classes:
    //   5-col Desktop (>= 1200px) : Courses: 2 rows (10 courses) default, 3 rows (15 courses) at >= 900px height.
    //                               Study Materials: 4-col grid:
    //                                 - 4 rows (16 materials) on very tall screens (height >= 860px);
    //                                 - 3 rows (12 materials) on 100% and 110% zoom (height >= 650px);
    //                                 - 2 rows (8 materials) on 125%, 150% zoom or short viewports (< 650px).
    //   110% / Small Laptop (1024-1199px) : 4-col grid → 8 courses (4×2) / 12 materials (4×3 when height >= 650px, 8 if < 650px)
    //   Tablet              (768-1023px)  : 3-col grid → 6 courses (3×2) / 9 materials (3×3 when height >= 650px, 6 if < 650px)
    //   Mobile              (<768px)      : 1-col grid → 6 courses / 4 materials (5 if >= 750px)
    const getItemsPerPage = useCallback((width, height) => {
        if (width >= 1200) {
            let courseRows = 3;
            const is125ZoomOrShort = (width <= 1245 && height <= 670) || height < 500;

            if (is125ZoomOrShort) {
                // Zoom 125% (width ~1228px on laptop) or very short viewport (<500px): 2 rows
                courseRows = 2;
            } else if (height >= 1400) {
                // Zoom 50% or tall screens: 6 or 7 rows
                courseRows = height >= 1550 ? 7 : 6;
            } else if (height >= 1120) {
                // Zoom 67%: 5 rows
                courseRows = 5;
            } else if (height >= 940) {
                // Zoom 80%, 75%: 4 rows
                courseRows = 4;
            } else {
                // Zoom 100% (width 1536) and 110% (width 1396): 3 rows
                courseRows = 3;
            }

            const materialRows = height >= 1400 ? 6 : (height >= 1120 ? 5 : (height >= 860 ? 4 : (!is125ZoomOrShort ? 3 : 2)));

            return {
                courses: 5 * courseRows,
                materials: 4 * materialRows,
                rows: courseRows,
                materialRows,
                materialCols: 4,
            };
        }
        if (width >= 1024) {
            let courseRows = 2;
            if (height >= 1400) {
                courseRows = 6;
            } else if (height >= 1120) {
                courseRows = 5;
            } else if (height >= 940) {
                courseRows = 4;
            } else if (height >= 600) {
                courseRows = 3;
            } else {
                courseRows = 2;
            }

            const materialRows = height >= 1400 ? 6 : (height >= 1120 ? 5 : (height >= 860 ? 4 : (height >= 600 ? 3 : 2)));

            return {
                courses: 4 * courseRows,
                materials: 4 * materialRows,
                rows: courseRows,
                materialRows,
                materialCols: 4,
            };
        }
        if (width >= 768) {
            const materialRows = height >= 860 ? 4 : (height >= 650 ? 3 : 2);
            return {
                courses: 6,
                materials: 3 * materialRows,
                rows: 2,
                materialRows,
                materialCols: 3,
            };
        }
        const materialRows = height >= 750 ? 5 : 4;
        return {
            courses: 6,
            materials: materialRows,
            rows: 6,
            materialRows,
            materialCols: 1,
        };
    }, []);

    const [screenItemsPerPage, setScreenItemsPerPage] = useState(() =>
        getItemsPerPage(window.innerWidth, window.innerHeight)
    );

    useEffect(() => {
        const handleResize = () => {
            const next = getItemsPerPage(window.innerWidth, window.innerHeight);
            setScreenItemsPerPage((prev) => {
                if (
                    prev.courses !== next.courses ||
                    prev.materials !== next.materials ||
                    prev.rows !== next.rows ||
                    prev.materialRows !== next.materialRows
                ) {
                    setCurrentPage(1); // reset page on layout change
                    return next;
                }
                return prev;
            });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [getItemsPerPage]);

    useEffect(() => {
        if (scrollContainerRef.current && !pendingHighlight && !highlightedTarget) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [currentPage, activeTab, statusFilter, categoryFilter, pendingHighlight, highlightedTarget]);

    const [formData, setFormData] = useState({
        course_name: "",
        provider: "",
        category: "",
        course_link: "",
        reason: "",
        estimated_cost: "",
        target_completion_date: "",
    });

    const coursesPerPage = screenItemsPerPage.courses;
    const materialsPerPage = screenItemsPerPage.materials;

    /* =========================================================
       SEARCH & FILTER
    ========================================================= */

    const normalizedQuery = (searchQuery || "").trim().toLowerCase();

    // Intermediate filtered list matching search keyword and active status tab
    // (Used by VideoCourseFilterDrawer so provider/category badge counts update dynamically)
    const searchFilteredCourses = useMemo(() => {
        return courses.filter((course) => {
            const courseName = (course.title || course.course_name || "").toLowerCase();
            const matchesSearch =
                !normalizedQuery ||
                courseName.includes(normalizedQuery);

            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "in-progress" && course.status === "in-progress") ||
                (statusFilter === "completed" && course.status === "completed") ||
                // "Assigned" tab shows ONLY courses that are assigned (status === 'assigned' with [ Assign ] button)
                (statusFilter === "assigned" && course.status === "assigned") ||
                (statusFilter === "not-started" && course.status === "not-started") ||
                (statusFilter === "pending" && course.status === "pending") ||
                (statusFilter === "on-hold" && course.status === "on-hold");

            return matchesSearch && matchesStatus;
        });
    }, [courses, normalizedQuery, statusFilter]);

    const filteredCourses = useMemo(() => {
        return searchFilteredCourses.filter((course) => {
            const cCat = (course.category || course.category_name || "").toUpperCase();
            const matchesCategory =
                selectedCategories.includes("All") ||
                selectedCategories.length === 0 ||
                selectedCategories.some((cat) => cat.toUpperCase() === cCat);

            const cProv = (course.provider || course.provider_name || "").toUpperCase();
            const matchesProvider =
                selectedProviders.includes("All") ||
                selectedProviders.length === 0 ||
                selectedProviders.some((prov) => prov.toUpperCase() === cProv);

            const matchesStatusFilter =
                selectedStatuses.includes("All") ||
                selectedStatuses.includes("All Statuses") ||
                selectedStatuses.length === 0 ||
                selectedStatuses.some((st) => {
                    const normSt = st.toLowerCase().replace(/[\s-_]+/g, "");
                    const prog = Number(course.progress || 0);
                    const normCard = (course.status || "").toLowerCase().replace(/[\s-_]+/g, "");

                    if (normSt === "completed") {
                        return normCard === "completed" || prog >= 100;
                    }
                    if (normSt === "assigned") {
                        return normCard === "assigned";
                    }
                    if (normSt === "pending" || normSt === "requested") {
                        return normCard === "pending" || normCard === "requested";
                    }
                    if (normSt === "enrollnow" || normSt === "available") {
                        return (
                            normCard === "available" ||
                            normCard === "enrollnow" ||
                            (!["completed", "assigned", "notstarted", "pending", "requested", "onhold", "inprogress"].includes(normCard))
                        );
                    }
                    if (normSt === "notstarted" || normSt === "enrolled") {
                        return normCard === "notstarted" || normCard === "enrolled";
                    }
                    if (normSt === "onhold") {
                        return normCard === "onhold";
                    }
                    if (normSt === "inprogress") {
                        return normCard === "inprogress";
                    }
                    return normCard === normSt;
                });

            return matchesCategory && matchesProvider && matchesStatusFilter;
        });
    }, [searchFilteredCourses, selectedCategories, selectedProviders, selectedStatuses]);

    const searchFilteredMaterials = useMemo(() => {
        return materials.filter((material) => {
            const materialName = (material.title || material.name || "").toLowerCase();
            const matchesSearch =
                !normalizedQuery ||
                materialName.includes(normalizedQuery);
            return matchesSearch;
        });
    }, [materials, normalizedQuery]);

    const inferMaterialCategory = (material) => {
        if (material.category && material.category !== "General") return material.category;
        const text = `${material.title || ""} ${material.description || ""}`.toLowerCase();
        if (text.includes("react") || text.includes("javascript") || text.includes("python") || text.includes("code") || text.includes("programming") || text.includes("web") || text.includes("frontend") || text.includes("backend")) return "Development";
        if (text.includes("ai") || text.includes("machine learning") || text.includes("deep learning") || text.includes("neural") || text.includes("model")) return "AI/ML";
        if (text.includes("cloud") || text.includes("aws") || text.includes("azure") || text.includes("gcp") || text.includes("devops") || text.includes("kubernetes") || text.includes("docker")) return "Cloud";
        if (text.includes("data") || text.includes("sql") || text.includes("analytics") || text.includes("database")) return "Data Science";
        if (text.includes("security") || text.includes("cyber")) return "Security";
        if (text.includes("agile") || text.includes("scrum") || text.includes("management") || text.includes("project")) return "Management";
        return "Development";
    };

    const filteredMaterials = useMemo(() => {
        return materials.filter((material) => {
            const materialName = (material.title || material.name || "").toLowerCase();
            const matchesSearch =
                !normalizedQuery ||
                materialName.includes(normalizedQuery);

            // Category match
            const matCategory = inferMaterialCategory(material);
            const matchesCategory =
                selectedMaterialCategories.includes("All") ||
                selectedMaterialCategories.some((c) => c.toLowerCase() === matCategory.toLowerCase());

            // Format match
            const norm = (material.fileType || "").trim().toLowerCase();
            const file = (material.fileUrl || "").trim().toLowerCase();
            const matchesFormat =
                selectedMaterialFormats.includes("All") ||
                selectedMaterialFormats.some((fmt) => {
                    const f = fmt.toLowerCase();
                    if (f === "pdf") return norm.includes("pdf") || file.endsWith(".pdf");
                    if (f === "ppt" || f === "pptx" || f.includes("ppt") || f.includes("presentation")) {
                        return norm.includes("ppt") || norm.includes("presentation") || file.endsWith(".ppt") || file.endsWith(".pptx");
                    }
                    if (f === "epub" || f === "mobi" || f.includes("epub") || f.includes("mobi") || f.includes("ebook")) {
                        return norm.includes("epub") || norm.includes("mobi") || norm.includes("ebook") || norm.includes("e-book") || file.endsWith(".epub") || file.endsWith(".mobi");
                    }
                    return norm === f || norm.includes(f);
                });

            return matchesSearch && matchesCategory && matchesFormat;
        });
    }, [materials, normalizedQuery, selectedMaterialCategories, selectedMaterialFormats]);

    /* =========================================================
       SORT
    ========================================================= */

    // Fetch live study materials from database table lms_study_materials
    useEffect(() => {
        let isMounted = true;
        const fetchStudyMaterials = async () => {
            setIsLoadingMaterials(true);
            try {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
                const res = await axios.get(`${API_BASE_URL}/api/study-materials?is_active=true`);
                if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
                    const mapped = res.data.map((m) => {
                        let dateStr = "Recent";
                        if (m.created_at) {
                            try {
                                const d = new Date(m.created_at);
                                if (!isNaN(d.getTime())) {
                                    dateStr = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
                                }
                            } catch {
                                dateStr = "Recent";
                            }
                        }

                        const fileSizeStr = formatMaterialFileSize(m);

                        return {
                            id: m.id,
                            course_id: m.id,
                            title: m.title,
                            description: m.description || "No description provided.",
                            fileType: m.file_type || "PDF",
                            fileUrl: m.file_path,
                            fileSize: fileSizeStr,
                            date: dateStr,
                            is_active: m.is_active,
                        };
                    });
                    setMaterials(mapped);
                }
            } catch (err) {
                console.error("Error loading study materials in employee CourseLibrary:", err);
            } finally {
                if (isMounted) {
                    setIsLoadingMaterials(false);
                    setMaterialsFetched(true);
                }
            }
        };

        fetchStudyMaterials();
        return () => {
            isMounted = false;
        };
    }, []);

    // Fetch live course request tracker data strictly for this respective employee
    const fetchTrackerItems = useCallback(async () => {
        setIsTrackerLoading(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
            const res = await axios.get(`${API_BASE_URL}/api/course-requests/tracker`, {
                params: {
                    employee_id: resolvedEmpId,
                    employee_name: activeEmpName,
                }
            });
            if (Array.isArray(res.data)) {
                setTrackerItems(res.data);
            }
        } catch (err) {
            console.warn("Could not load course request tracker:", err);
        } finally {
            setIsTrackerLoading(false);
            setTrackerFetched(true);
        }
    }, [resolvedEmpId, activeEmpName]);

    useEffect(() => {
        fetchTrackerItems();
    }, [fetchTrackerItems]);

    const sortedCourses = useMemo(() => {
        return [...filteredCourses].sort((a, b) => {
            const aId = Number(a.id) || 0;
            const bId = Number(b.id) || 0;
            return sortBy === "Oldest" ? aId - bId : bId - aId;
        });
    }, [filteredCourses, sortBy]);

    const sortedMaterials = useMemo(() => {
        return [...filteredMaterials].sort((a, b) => {
            const aId = Number(a.id) || 0;
            const bId = Number(b.id) || 0;
            return sortBy === "Oldest" ? aId - bId : bId - aId;
        });
    }, [filteredMaterials, sortBy]);

    /* =========================================================
       PAGINATION
    ========================================================= */

    const paginatedCourses = useMemo(() => {
        const start = (currentPage - 1) * coursesPerPage;
        return sortedCourses.slice(start, start + coursesPerPage);
    }, [sortedCourses, currentPage, coursesPerPage]);

    /* =========================================================
       NOTIFICATION VIEW COURSE: AUTO-LOCATE & 3-SECOND ANNOTATION
    ========================================================= */

    const trackerLocationState = useMemo(() => {
        if (!location.state?.openTracker || !location.state?.highlightTimestamp) return null;
        return {
            ...location.state,
            highlightTitle: location.state.highlightTitle || location.state.highlightCourseTitle || "",
        };
    }, [location.state]);

    const { highlightedKey: highlightedTrackerId } = useNotificationRowHighlight({
        locationState: trackerLocationState,
        isReady: trackerFetched,
        targetList: trackerItems,
        storageKey: "lms_completed_tracker_highlight_ts",
        onActivate: () => setIsTrackModalOpen(true),
    });

    useEffect(() => {
        const state = location.state;
        if (!state || !state.highlightTimestamp || state.openTracker) return;
        const tsStr = String(state.highlightTimestamp);
        if (sessionStorage.getItem("lms_completed_notif_highlight_ts") === tsStr) {
            return;
        }

        const targetTab = state.highlightTab === "materials" ? "materials" : "video";

        setActiveTab(targetTab);
        setSearchQuery("");
        setStatusFilter("all");
        setSelectedCategories(["All"]);
        setSelectedProviders(["All"]);
        setSelectedStatuses(["All"]);
        setSelectedMaterialCategories(["All"]);
        setSelectedMaterialFormats(["All"]);

        setPendingHighlight({
            courseId: state.highlightCourseId || null,
            courseTitle: state.highlightCourseTitle || "",
            tab: targetTab,
            timestamp: state.highlightTimestamp,
        });
    }, [location.state]);

    useEffect(() => {
        if (!pendingHighlight) return;

        const isMaterials = pendingHighlight.tab === "materials";
        if (isMaterials && !materialsFetched) return;
        if (!isMaterials && !coursesFetched) return;

        if (searchQuery !== "") return;
        if (!isMaterials && (statusFilter !== "all" || !selectedCategories.includes("All") || !selectedProviders.includes("All"))) return;
        if (isMaterials && (!selectedMaterialCategories.includes("All") || !selectedMaterialFormats.includes("All"))) return;

        const targetList = isMaterials ? sortedMaterials : sortedCourses;
        const perPage = isMaterials ? materialsPerPage : coursesPerPage;
        const targetTitleLower = (pendingHighlight.courseTitle || "").trim().toLowerCase();
        const targetIdNum = pendingHighlight.courseId ? Number(pendingHighlight.courseId) : null;

        let matchIndex = -1;
        if (targetIdNum) {
            matchIndex = targetList.findIndex((item) => Number(item.id) === targetIdNum);
        }
        if (matchIndex === -1 && targetTitleLower) {
            matchIndex = targetList.findIndex(
                (item) => (item.title || "").trim().toLowerCase() === targetTitleLower
            );
        }
        if (matchIndex === -1 && targetTitleLower) {
            matchIndex = targetList.findIndex(
                (item) => (item.title || "").trim().toLowerCase().includes(targetTitleLower)
            );
        }

        const tsStr = String(pendingHighlight.timestamp);

        if (matchIndex >= 0) {
            const matchedItem = targetList[matchIndex];
            const targetPage = Math.floor(matchIndex / perPage) + 1;

            if (currentPage !== targetPage) {
                setCurrentPage(targetPage);
            }

            setHighlightedTarget({
                type: pendingHighlight.tab,
                id: matchedItem.id,
            });
            setPendingHighlight(null);

            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = setTimeout(() => {
                setHighlightedTarget(null);
                highlightTimerRef.current = null;
                sessionStorage.setItem("lms_completed_notif_highlight_ts", tsStr);
            }, 3000);
        } else {
            setPendingHighlight(null);
            sessionStorage.setItem("lms_completed_notif_highlight_ts", tsStr);
            if (pendingHighlight.courseTitle) {
                setToast({
                    isOpen: true,
                    type: "warning",
                    message: `"${pendingHighlight.courseTitle}" is currently not listed in your Course Library.`,
                });
            }
        }
    }, [
        pendingHighlight,
        coursesFetched,
        materialsFetched,
        sortedCourses,
        sortedMaterials,
        coursesPerPage,
        materialsPerPage,
        currentPage,
        searchQuery,
        statusFilter,
        selectedCategories,
        selectedProviders,
        selectedMaterialCategories,
        selectedMaterialFormats,
    ]);

    useEffect(() => {
        return () => {
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
        };
    }, []);

    /* =========================================================
       HANDLERS
    ========================================================= */

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (
            !formData.course_name.trim() ||
            !formData.provider ||
            !formData.category ||
            !formData.reason.trim()
        ) {
            return;
        }

        try {
            const { skipped } = await runRequestWithLock(async (idemKey) => {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
                const resolvedMeta = await resolveAndPersistFormMetadata({
                    provider: formData.provider,
                    isCustomProvider: formData.providerSelect === "Other",
                    category: formData.category,
                    isCustomCategory: formData.categorySelect === "Other",
                });
                const costVal = formData.estimated_cost !== "" && !isNaN(Number(formData.estimated_cost))
                    ? Number(formData.estimated_cost)
                    : null;
                await axios.post(`${API_BASE_URL}/api/course-requests`, {
                    employee_id: resolvedEmpId,
                    employee_name: activeEmpName,
                    employee_role: activeEmpRole,
                    course_name: formData.course_name.trim(),
                    category: resolvedMeta.category || formData.category.trim(),
                    category_id: resolvedMeta.category_id || null,
                    provider: resolvedMeta.provider || formData.provider.trim(),
                    provider_id: resolvedMeta.provider_id || null,
                    course_link: formData.course_link?.trim() || null,
                    reason: formData.reason.trim().replace(/\s+/g, " "),
                    price: costVal,
                    target_completion_date: formData.target_completion_date || null
                }, {
                    headers: { "X-Idempotency-Key": idemKey },
                });

                await fetchTrackerItems();

                setIsRequestModalOpen(false);
                setToast({
                    isOpen: true,
                    message: "Request Submitted Successfully",
                    type: "success",
                });

                setFormData({
                    course_name: "",
                    provider: "",
                    category: "",
                    course_link: "",
                    reason: "",
                    estimated_cost: "",
                    target_completion_date: "",
                });
            });
            if (skipped) return;
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Error creating course request in DB:", err);
            let errorMsg = extractApiErrorMessage(err, "Failed to submit course request. Please check required fields and try again.");
            const detail = err.response?.data?.detail;

            // Do not show top toast popup for URL validation errors (inline error is displayed in the modal)
            const isUrlError = (typeof detail === "string" && detail.toLowerCase().includes("url")) ||
                (Array.isArray(detail) && detail.some((d) => d.loc?.includes("course_link") || String(d.msg || "").toLowerCase().includes("url")));
            if (isUrlError) {
                return;
            }

            setToast({
                isOpen: true,
                message: errorMsg,
                type: "error",
            });
        }
    };

    const enrollingCourseIdsRef = useRef(new Set());

    const handleEnroll = async (course) => {
        const courseId = course.id || course.course_id;
        if (!courseId) return;

        // ENR-YYYY-022: Prevent duplicate inserts on rapid double-click
        if (enrollingCourseIdsRef.current.has(courseId)) {
            return;
        }
        enrollingCourseIdsRef.current.add(courseId);

        try {
            const empInfo = activeUser || currentUser || {
                employee_id: "EMP011",
                name: "Nivash",
                email: "Niva@rdivakar0110outlook.onmicrosoft.com",
                role: "Product Operations"
            };
            await requestCourseEnrollment(courseId, empInfo);
            setCourses((prev) =>
                prev.map((c) =>
                    (c.id === courseId || c.course_id === courseId)
                        ? { ...c, status: "pending" }
                        : c
                )
            );
            const enrollCourseTitle = course.title || "";
            setToast({
                isOpen: true,
                message: enrollCourseTitle
                    // ? `Request Submitted Successfully for "${enrollCourseTitle}"`
                    ? 'Request Submitted Successfully!'
                    : "Request Submitted Successfully!",
                type: "success",
            });
        } catch (err) {
            console.error("Enrollment request error:", err);
            let errorMsg = `Failed to submit enrollment request for "${course.title}".`;
            const detail = err.response?.data?.detail;
            if (typeof detail === "string") {
                errorMsg = detail;
            } else if (Array.isArray(detail) && detail.length > 0) {
                errorMsg = detail.map((d) => d.msg || d.message).join(", ");
            }
            setToast({
                isOpen: true,
                message: errorMsg,
                type: "error",
            });
        } finally {
            setTimeout(() => {
                enrollingCourseIdsRef.current.delete(courseId);
            }, 1000);
        }
    };

    const handleOpenEnrollModal = (course) => {
        if (!course) return;
        setConfirmCourse(course);
        setIsConfirmModalOpen(true);
    };

    const handleCloseEnrollModal = () => {
        if (isSubmittingEnroll) return;
        setIsConfirmModalOpen(false);
        setConfirmCourse(null);
    };

    const handleConfirmEnroll = async () => {
        if (!confirmCourse) return;
        setIsSubmittingEnroll(true);
        try {
            await handleEnroll(confirmCourse);
            setIsConfirmModalOpen(false);
            setConfirmCourse(null);
        } catch (err) {
            console.error("Enrollment confirmation error:", err);
        } finally {
            setIsSubmittingEnroll(false);
        }
    };

    // const handleUnenroll = async (course) => {
    //     const courseId = course.id || course.course_id;
    //     const currentProg = Number(course.progress || 0);

    //     // ENR-YYYY-021: Validate corporate training audit policy (>50% completion cannot be dropped)
    //     if (currentProg > 50) {
    //         alert(`Unenrollment is disabled for courses with more than 50% progress (${currentProg}%). Corporate training audit policy requires records to be maintained.`);
    //         return;
    //     }

    //     const confirmed = window.confirm(`Are you sure you want to drop "${course.title}"?`);
    //     if (!confirmed) return;

    //     try {
    //         const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    //         const empId = resolvedEmpId || "EMP011";
    //         await axios.post(`${API_BASE_URL}/api/enrollments/${courseId}/unenroll?employee_id=${empId}`);

    //         setCourses((prev) =>
    //             prev.map((c) =>
    //                 (c.id === courseId || c.course_id === courseId)
    //                     ? { ...c, status: "available", progress: 0 }
    //                     : c
    //             )
    //         );
    //         alert(`Successfully dropped "${course.title}".`);
    //     } catch (err) {
    //         console.error("Error unenrolling from course:", err);
    //         alert(err.response?.data?.detail || "Failed to drop course.");
    //     }
    // };

    const handleDownload = (material) => {
        if (material.fileUrl && (material.fileUrl.startsWith("http://") || material.fileUrl.startsWith("https://"))) {
            window.open(material.fileUrl, "_blank");
        } else {
            const fileName = material.fileUrl
                ? material.fileUrl.split("/").pop()
                : `${(material.title || "material").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
            const content = `Emerger LMS Study Material\n\nTitle: ${material.title}\nFormat: ${material.fileType}\nDescription: ${material.description || "—"}\nFile Reference: ${material.fileUrl || "—"}`;
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setCurrentPage(1);
    };

    const handleClearFilters = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (activeTab === "video") {
            setSelectedCategories(["All"]);
            setSelectedProviders(["All"]);
            setSelectedStatuses(["All"]);
            setStatusFilter("all");
        } else {
            setSelectedMaterialCategories(["All"]);
            setSelectedMaterialFormats(["All"]);
            setSelectedMaterialType("All");
        }
        setCurrentPage(1);
    };

    const handleApplyFilters = ({ categories, providers, statuses }) => {
        setSelectedCategories(categories);
        setSelectedProviders(providers);
        if (statuses) {
            setSelectedStatuses(statuses);
            const hasSpecificStatuses =
                statuses.length > 0 &&
                !statuses.includes("All") &&
                !statuses.includes("All Statuses");
            if (hasSpecificStatuses) {
                const single = statuses.length === 1 ? statuses[0].toLowerCase().replace(/[\s-_]+/g, "") : null;
                if (single === "inprogress") setStatusFilter("in-progress");
                else if (single === "assigned") setStatusFilter("assigned");
                else if (single === "completed") setStatusFilter("completed");
                else setStatusFilter("all");
            }
        }
        setCurrentPage(1);
    };

    // Close sort dropdown on outside click or Escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
                setIsSortOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") setIsSortOpen(false);
        };
        if (isSortOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isSortOpen]);

    // Close filter popover on outside click or Escape (drawers in video & materials tabs are closed ONLY via close icon)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (activeTab === "video" || activeTab === "materials") return;
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
                setIsFilterPopoverOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (activeTab === "video" || activeTab === "materials") return;
            if (e.key === "Escape") setIsFilterPopoverOpen(false);
        };
        if (isFilterPopoverOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isFilterPopoverOpen, activeTab]);

    // Available categories & providers strictly from CourseCategories & CourseProviders
    const availableCategories = useMemo(() => {
        const map = new Map();
        (liveCategoryNames || []).forEach((cat) => {
            const key = cat.trim().toUpperCase();
            if (key && key !== "OTHER" && key !== "OTHERS") map.set(key, cat.trim());
        });
        return Array.from(map.values());
    }, [liveCategoryNames]);

    const availableProviders = useMemo(() => {
        const map = new Map();
        (liveProviderNames || []).forEach((prov) => {
            const key = prov.trim().toUpperCase();
            if (key && key !== "OTHER" && key !== "OTHERS") map.set(key, prov.trim());
        });
        return Array.from(map.values());
    }, [liveProviderNames]);

    const categoryOptions = useMemo(() => [
        { value: "All", label: "All Categories" },
        ...availableCategories.map((c) => ({ value: c, label: c })),
    ], [availableCategories]);

    const availableMaterialFormats = useMemo(
        () => deriveMaterialFormatOptions(materials),
        [materials]
    );

    const providerOptions = useMemo(() => [
        { value: "All", label: "All Providers" },
        ...availableProviders.map((p) => ({ value: p, label: p })),
    ], [availableProviders]);

    const materialTypeOptions = useMemo(() => [
        { value: "All", label: "All Formats" },
        { value: "PDF", label: "PDF Document" },
        { value: "PPTX", label: "Presentation (PPTX)" },
        { value: "DOCX", label: "Word Document (DOCX)" },
        { value: "VIDEO", label: "Video" },
        { value: "LINK", label: "Web Link" },
    ], []);

    const availableStatuses = useMemo(() => [
        "In Progress",
        "Assigned",
        "Completed",
        "Pending",
        "Enroll Now",
        "Not Started",
        "On Hold",
    ], []);

    const activeCategoriesCount = selectedCategories.includes("All") || selectedCategories.length === 0 ? 0 : selectedCategories.length;
    const activeProvidersCount = selectedProviders.includes("All") || selectedProviders.length === 0 ? 0 : selectedProviders.length;
    const activeStatusesCount = selectedStatuses.includes("All") || selectedStatuses.includes("All Statuses") || selectedStatuses.length === 0 ? 0 : selectedStatuses.length;

    const activeMaterialCategoriesCount = selectedMaterialCategories.includes("All") || selectedMaterialCategories.length === 0 ? 0 : selectedMaterialCategories.length;
    const activeMaterialFormatsCount = selectedMaterialFormats.includes("All") || selectedMaterialFormats.length === 0 ? 0 : selectedMaterialFormats.length;

    const activeFilterCount = activeTab === "video"
        ? (activeCategoriesCount + activeProvidersCount + activeStatusesCount)
        : (activeMaterialCategoriesCount + activeMaterialFormatsCount);

    const filterTooltip = activeTab === "video"
        ? [
            activeCategoriesCount > 0 ? `Categories (${activeCategoriesCount})` : null,
            activeProvidersCount > 0 ? `Providers (${activeProvidersCount})` : null,
            activeStatusesCount > 0 ? `Statuses (${activeStatusesCount})` : null,
        ].filter(Boolean).join(", ") || "Filter courses"
        : [
            activeMaterialCategoriesCount > 0 ? `Categories (${activeMaterialCategoriesCount})` : null,
            activeMaterialFormatsCount > 0 ? `Formats (${activeMaterialFormatsCount})` : null,
        ].filter(Boolean).join(", ") || "Filter study materials";

    return (
        <div className="emp-course-library-page">
            {/* ===================================================
                FIXED TOP HEADER & FILTER CONTROLS
            =================================================== */}
            <div className="emp-course-library-fixed-header">
                {/* 1. HEADER */}
                <PageHeader
                    title="Course Library"
                    subtitle="Discover new courses, request enrollments, and expand your professional skill set."
                />

                {/* 2. ACTION BAR (SEARCH + TRACK + REQUEST) */}
                <section className="emp-course-library-action-bar">
                    <div className="emp-course-search-container">
                        <span className="emp-course-search-icon">
                            <img src={searchIcon} alt="Search" />
                        </span>
                        <input
                            type="text"
                            className="emp-course-search-input"
                            placeholder={activeTab === "video" ? "Search by course name" : "Search by resource name"}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    const trimmed = (searchQuery || "").trim();
                                    if (trimmed !== searchQuery) {
                                        setSearchQuery(trimmed);
                                        setCurrentPage(1);
                                    }
                                }
                            }}
                            onBlur={() => {
                                const trimmed = (searchQuery || "").trim();
                                if (trimmed !== searchQuery) {
                                    setSearchQuery(trimmed);
                                    setCurrentPage(1);
                                }
                            }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="emp-course-search-clear-btn"
                                onClick={() => {
                                    setSearchQuery("");
                                    setCurrentPage(1);
                                }}
                                aria-label="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="emp-course-action-buttons">
                        <button
                            type="button"
                            className="emp-btn-track-status"
                            onClick={() => {
                                fetchTrackerItems();
                                setIsTrackModalOpen(true);
                            }}
                        >
                            <img src={trackIcon} alt="Track" />
                            <span className="emp-track-request-text">Track Request Status</span>
                        </button>

                        <button
                            type="button"
                            className="emp-btn-request-courses"
                            onClick={() => setIsRequestModalOpen(true)}
                        >
                            <span className="emp-request-courses-text">+ Request Course</span>
                        </button>
                    </div>
                </section>

                <hr className="emp-course-library-divider" />

                {/* 3. FILTER BAR & TABS */}
                <div className="emp-course-filter-bar">
                    {/* TABS (LEFT) */}
                    <div className="emp-course-tabs">
                        <button
                            type="button"
                            className={`emp-tab-pill ${activeTab === "video" ? "active" : "inactive"}`}
                            onClick={() => handleTabChange("video")}
                        >
                            <span className="emp-tab-pill-text-video">Emergere Library</span>
                        </button>

                        <button
                            type="button"
                            className={`emp-tab-pill ${activeTab === "materials" ? "active" : "inactive"}`}
                            onClick={() => handleTabChange("materials")}
                        >
                            <span className="emp-tab-pill-text-materials">Resources</span>
                        </button>
                    </div>

                    {/* FILTER + SORT (RIGHT) */}
                    <div className="emp-course-controls">
                        <div className="emp-custom-filter-container" ref={filterPopoverRef}>
                            <button
                                type="button"
                                className={`emp-btn-filter-toggle ${activeFilterCount > 0 ? "filter-active" : ""} ${isFilterPopoverOpen ? "open" : ""}`}
                                title={filterTooltip}
                                onClick={() => setIsFilterPopoverOpen((prev) => !prev)}
                                aria-haspopup="true"
                                aria-expanded={isFilterPopoverOpen}
                            >
                                <img src={filterIcon} alt="Filter" />
                                <span>Filter</span>
                                {activeFilterCount > 0 && (
                                    <span
                                        className="emp-filter-clear-cross"
                                        onClick={handleClearFilters}
                                        title="Clear filter"
                                    >
                                        ×
                                    </span>
                                )}
                            </button>

                            {isFilterPopoverOpen && (
                                activeTab === "video" ? (
                                    <CourseFilterPopover
                                        isOpen={isFilterPopoverOpen}
                                        onClose={() => setIsFilterPopoverOpen(false)}
                                        selectedCategories={selectedCategories}
                                        selectedProviders={selectedProviders}
                                        selectedStatuses={selectedStatuses}
                                        availableCategories={availableCategories}
                                        availableProviders={availableProviders}
                                        availableStatuses={availableStatuses}
                                        onApply={handleApplyFilters}
                                        onClearAll={handleClearFilters}
                                    />
                                ) : (
                                    <ResourceFilterDrawer
                                        isOpen={isFilterPopoverOpen}
                                        onClose={() => setIsFilterPopoverOpen(false)}
                                        selectedCategories={selectedMaterialCategories}
                                        selectedFormats={selectedMaterialFormats}
                                        availableCategories={availableCategories}
                                        availableFormats={availableMaterialFormats}
                                        onApply={({ categories, formats }) => {
                                            setSelectedMaterialCategories(categories);
                                            setSelectedMaterialFormats(formats);
                                            setCurrentPage(1);
                                        }}
                                        onClearAll={() => {
                                            setSelectedMaterialCategories(["All"]);
                                            setSelectedMaterialFormats(["All"]);
                                            setCurrentPage(1);
                                        }}
                                    />
                                )
                            )}
                        </div>

                        {/* Custom Sort Dropdown */}
                        <div className="emp-custom-sort-container" ref={sortDropdownRef}>
                            <button
                                type="button"
                                className={`emp-sort-dropdown emp-custom-sort-trigger ${isSortOpen ? "open" : ""}`}
                                onClick={() => setIsSortOpen(prev => !prev)}
                                aria-haspopup="listbox"
                                aria-expanded={isSortOpen}
                            >
                                <span className="emp-sort-label-prefix">Sort by:</span>
                                <span className="emp-sort-selected-value">{sortBy}</span>
                                <ChevronDown
                                    size={14}
                                    className={`emp-sort-chevron ${isSortOpen ? "rotate" : ""}`}
                                />
                            </button>

                            {isSortOpen && (
                                <div className="emp-custom-sort-menu" role="listbox">
                                    {[
                                        { value: "Latest", label: "Latest" },
                                        { value: "Oldest", label: "Oldest" },
                                    ].map((opt) => {
                                        const isSelected = sortBy === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                className={`emp-custom-sort-option ${isSelected ? "selected" : ""}`}
                                                onClick={() => {
                                                    setSortBy(opt.value);
                                                    setCurrentPage(1);
                                                    setIsSortOpen(false);
                                                }}
                                                role="option"
                                                aria-selected={isSelected}
                                            >
                                                <span className="emp-sort-option-label">{opt.label}</span>
                                                {isSelected && (
                                                    <Check size={14} className="emp-sort-check-icon" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* ===================================================
                SCROLLABLE BODY CONTENT (COURSES / MATERIALS)
            =================================================== */}
            <div className="emp-course-library-scrollable-content" ref={scrollContainerRef}>
                {/* VIDEO COURSES TAB (GRID) */}
                {activeTab === "video" && (
                    isLoadingCourses ? (
                        <>
                            <section
                                className="emp-course-grid"
                                style={{ "--course-grid-rows": screenItemsPerPage.rows }}
                            >
                                {Array.from({ length: coursesPerPage }, (_, idx) => idx + 1).map((n) => (
                                    <div key={n} className="emp-course-card-skeleton">
                                        <div className="ld-skeleton-block emp-skeleton-thumb" />
                                        <div className="emp-skeleton-card-body">
                                            <div className="emp-skeleton-badge-row">
                                                <div className="ld-skeleton-block" style={{ width: 68, height: 16, borderRadius: 4 }} />
                                                <div className="ld-skeleton-block" style={{ width: 44, height: 14, borderRadius: 4 }} />
                                            </div>
                                            <div className="ld-skeleton-block" style={{ width: "90%", height: 15, borderRadius: 4, marginTop: 6 }} />
                                            <div className="ld-skeleton-block" style={{ width: "65%", height: 13, borderRadius: 4, marginTop: 4 }} />
                                            <div className="emp-skeleton-footer-row">
                                                <div className="ld-skeleton-block" style={{ width: 55, height: 14, borderRadius: 4 }} />
                                                <div className="ld-skeleton-block" style={{ width: 65, height: 24, borderRadius: 4 }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </section>

                            <div className="emp-course-pagination-bar emp-pagination-skeleton">
                                <div className="ld-skeleton-block" style={{ width: 170, height: 13, borderRadius: 4 }} />
                                <div className="ld-skeleton-block" style={{ width: 100, height: 24, borderRadius: 6 }} />
                            </div>
                        </>
                    ) : paginatedCourses.length > 0 ? (
                        <>
                            <section
                                className="emp-course-grid"
                                style={{ "--course-grid-rows": screenItemsPerPage.rows }}
                            >
                                {paginatedCourses.map((course) => (
                                    <CourseCard
                                        key={course.id}
                                        course={course}
                                        onEnroll={handleOpenEnrollModal}
                                        isHighlighted={
                                            highlightedTarget?.type === "video" &&
                                            Number(highlightedTarget.id) === Number(course.id)
                                        }
                                    />
                                ))}
                            </section>

                            <Pagination
                                currentPage={currentPage}
                                setCurrentPage={setCurrentPage}
                                total={sortedCourses.length}
                                itemsPerPage={coursesPerPage}
                                type="Courses"
                            />
                        </>
                    ) : (
                        <div className="emp-empty-state">
                            <img
                                src={openBookIcon}
                                alt="No courses found"
                                className="emp-empty-state-icon"
                            />
                            <h3>No courses found</h3>
                        </div>
                    )
                )}

                {/* STUDY MATERIALS TAB */}
                {activeTab === "materials" && (
                    <StudyMaterials
                        materials={sortedMaterials}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        itemsPerPage={materialsPerPage}
                        gridRows={screenItemsPerPage.materialRows}
                        gridCols={screenItemsPerPage.materialCols}
                        onDownload={handleDownload}
                        isLoading={isLoadingMaterials}
                        highlightedMaterialId={
                            highlightedTarget?.type === "materials" ? highlightedTarget.id : null
                        }
                    />
                )}
            </div>

            {/* ===================================================
                MODALS
            =================================================== */}
            <RequestCourseModal
                isOpen={isRequestModalOpen}
                onClose={() => {
                    if (!isSubmittingRequest) {
                        resetRequestIdemKey();
                        setIsRequestModalOpen(false);
                    }
                }}
                onSubmit={handleFormSubmit}
                formData={formData}
                setFormData={setFormData}
                isSubmitting={isSubmittingRequest}
            />

            <TopToastNotification
                isOpen={toast.isOpen}
                type={toast.type}
                message={toast.message}
                onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
            />

            <CourseRequestTracker
                isOpen={isTrackModalOpen}
                onClose={() => setIsTrackModalOpen(false)}
                trackerItems={trackerItems}
                highlightedItemId={highlightedTrackerId}
                isLoading={isTrackerLoading || !trackerFetched}
            />

            <EnrollConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseEnrollModal}
                onConfirm={handleConfirmEnroll}
                course={confirmCourse}
                isSubmitting={isSubmittingEnroll}
            />

            {/* Request Tracker Modal */}
        </div>
    );
};

export default CourseLibrary;