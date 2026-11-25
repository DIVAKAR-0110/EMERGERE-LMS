import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import {
    Plus,
    Bell,
    X,
    ChevronDown,
    Check,
} from "lucide-react";

import StudyMaterials from "../../components/reportingmanager/RecommendedCourse/StudyMaterials";
import RequestCourseModal from "../../components/reportingmanager/RecommendedCourse/RequestCourseModal";
import RecommendCourseModal from "../../components/reportingmanager/RecommendedCourse/RecommendCourseModal";
import RequestSuccessModal from "../../components/reportingmanager/RecommendedCourse/RequestSuccessModal";
import CourseRequestTracker from "../../components/employee/CourseLibrary/CourseRequestTracker";
import CourseCard from "../../components/reportingmanager/RecommendedCourse/CourseCard";
import Pagination from "../../components/employee/CourseLibrary/Pagination";
import PageHeader from "../../components/common/PageHeader";
import CourseModalDropdown from "../../components/L&D/CourseManagement/CourseModalDropdown";
import RecommendCourseFilterDrawer from "../../components/reportingmanager/RecommendedCourse/RecommendCourseFilterDrawer";
import RecommendResourceFilterDrawer from "../../components/reportingmanager/RecommendedCourse/RecommendResourceFilterDrawer";
import useCourseMetadata from "../../hooks/useCourseMetadata";
import useSubmitLock from "../../hooks/useSubmitLock";
import { resolveAndPersistFormMetadata } from "../../services/courseMetadataService";

import filterIcon from "../../assets/course_library/filter.svg";
import searchIcon from "../../assets/course_library/search.svg";
import trackIcon from "../../assets/course_library/track.svg";
import downArrowIcon from "../../assets/course_library/down_arrow.svg";
import openBookIcon from "../../assets/course_library/open_book_icon.svg";
import { useAuth } from "../../context/AuthContext";
import { COURSE_ICONS } from "../../constants/courseIcons";
import { formatMaterialFileSize, deriveMaterialFormatOptions } from "../../utils/materialUtils";
import { normalizeSingleSpacing } from "../../utils/validationUtils";

import "../../styles/reportingmanager/RecommendCourse.css";
import "../../styles/employee/StudyMaterials.css";
import "../../styles/employee/CourseLibrary.css";

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

const Recommendcourse = () => {
    console.log("Recommendcourse COMPONENT MOUNTED NOW");
    const { token, user } = useAuth();
    /* =========================================================
       STATE
    ========================================================= */

    const { categoryNames: liveCategoryNames, providerNames: liveProviderNames } = useCourseMetadata();
    const { isSubmitting: isSubmittingRecommend, runWithLock: runRecommendWithLock, resetIdempotencyKey: resetRecommendIdemKey } = useSubmitLock();

    const [courses, setCourses] = useState([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);

    const [activeTab, setActiveTab] = useState("video");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // Filters & Sort
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const filterPopoverRef = useRef(null);

    const [selectedCategories, setSelectedCategories] = useState(["All"]);
    const [selectedPlatforms, setSelectedPlatforms] = useState(["All"]);
    const [selectedMaterialType, setSelectedMaterialType] = useState("All");
    const [selectedMaterialCategories, setSelectedMaterialCategories] = useState(["All"]);
    const [selectedMaterialFormats, setSelectedMaterialFormats] = useState(["All"]);
    const SORT_OPTIONS = [
        { value: "Latest", label: "Latest" },
        { value: "Oldest", label: "Oldest" },
    ];

    const [sortBy, setSortBy] = useState("Latest");
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortDropdownRef = useRef(null);
    const [categoryFilter, setCategoryFilter] = useState("All");

    // Close sort dropdown when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
                setIsSortOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setIsSortOpen(false);
            }
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


    // Modals
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
    const [selectedCourseForModal, setSelectedCourseForModal] = useState(null);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
    const [trackerItems, setTrackerItems] = useState([]);

    // Request Form Data for "Recommend New Course" (RequestCourseModal)
    const [formData, setFormData] = useState({
        course_name: "",
        employee_ids: [],
        provider: "",
        category: "",
        course_link: "",
        reason: "",
    });

    /* =========================================================
       DYNAMIC ITEMS PER PAGE & GRID ROWS BY SCREEN SIZE / ZOOM
       - Standard Desktop / Laptop (width >= 1024):
         5 cards per row, 3 rows = 15 video courses
         4 cards per row, 3 rows = 12 materials
       - Tall screens / Zoom-out (80%, 75%, 67%, 50%):
         Height >= 1550: 7 rows (35 courses / 28 materials)
         Height >= 1400: 6 rows (30 courses / 24 materials)
         Height >= 1150: 5 rows (25 courses / 20 materials)
         Height >= 920:  4 rows (20 courses / 16 materials)
       - Compact / Shorter screens (height < 520):
         2 rows (10 courses / 8 materials)
       - Tablet (768-1023px):
         3-col grid → 3 rows (9 courses / 9 materials)
       - Mobile (<768px):
         2-col grid → 6 courses / 1-col 4-5 materials
    ========================================================= */
    const getItemsPerPage = useCallback((width, height) => {
        if (width >= 1024) {
            const courseCols = 5;
            const materialCols = 4;
            let courseRows = 3;
            let materialRows = 3;

            if (height >= 1550) {
                courseRows = 7;
                materialRows = 7;
            } else if (height >= 1400) {
                courseRows = 6;
                materialRows = 6;
            } else if (height >= 1150) {
                courseRows = 5;
                materialRows = 5;
            } else if (height >= 920) {
                courseRows = 4;
                materialRows = 4;
            } else if (height < 520) {
                courseRows = 2;
                materialRows = 2;
            } else {
                courseRows = 3;
                materialRows = 3;
            }

            return {
                courses: courseCols * courseRows,
                materials: materialCols * materialRows,
                rows: courseRows,
                cols: courseCols,
                materialRows,
                materialCols,
            };
        }
        if (width >= 768) {
            const courseCols = 3;
            let courseRows = 3;
            if (height >= 1200) courseRows = 5;
            else if (height >= 920) courseRows = 4;
            else if (height < 520) courseRows = 2;
            else courseRows = 3;

            const materialRows = height >= 940 ? 4 : (height >= 550 ? 3 : 2);
            return {
                courses: courseCols * courseRows,
                materials: 3 * materialRows,
                rows: courseRows,
                cols: courseCols,
                materialRows,
                materialCols: 3,
            };
        }
        const courseCols = 2;
        let courseRows = 3;
        if (height >= 800) courseRows = 4;
        else if (height < 500) courseRows = 2;
        else courseRows = 3;

        const materialRows = height >= 750 ? 5 : 4;
        return {
            courses: courseCols * courseRows,
            materials: materialRows,
            rows: courseRows,
            cols: courseCols,
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
                    prev.cols !== next.cols ||
                    prev.materialRows !== next.materialRows
                ) {
                    return next;
                }
                return prev;
            });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [getItemsPerPage]);

    const coursesPerPage = screenItemsPerPage.courses;
    const materialsPerPage = screenItemsPerPage.materials;

    const scrollContainerRef = useRef(null);

    // Fetch live course request tracker data for Reporting Manager
    const fetchTrackerItems = useCallback(async () => {
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
            const authToken = token || localStorage.getItem("lms_token");
            const managerId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "EMP004";
            const res = await axios.get(`${API_BASE_URL}/api/course-requests/tracker`, {
                params: {
                    manager_id: managerId,
                    employee_id: managerId,
                },
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
            });
            if (Array.isArray(res.data) && res.data.length > 0) {
                setTrackerItems(res.data);
            }
        } catch (err) {
            console.warn("Could not load course request tracker in Recommendcourse:", err);
        }
    }, [token, user]);

    useEffect(() => {
        fetchTrackerItems();
    }, [fetchTrackerItems]);



    // Fetch live courses from database table lms_courses
    useEffect(() => {
        let active = true;
        const fetchLiveCourses = async () => {
            console.log("--> fetchLiveCourses starting...");
            setIsLoadingCourses(true);
            try {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
                console.log("--> fetching from", `${API_BASE_URL}/api/courses?is_active=true`);
                const response = await fetch(`${API_BASE_URL}/api/courses?is_active=true`);
                console.log("--> fetch response status:", response.status);
                if (!response.ok) throw new Error(`HTTP error ${response.status}`);
                const data = await response.json();
                console.log("--> data received, length:", data.length);
                if (Array.isArray(data) && data.length > 0) {
                    const mapped = data.map((c) => {
                        const cat = (c.category_name || "—").toUpperCase();
                        const iconKey = mapCategoryToIconType(cat);
                        return {
                            id: c.id,
                            course_id: c.id,
                            title: c.course_title,
                            courseUrl: c.course_url,
                            provider: c.provider_name || "—",
                            category: cat,
                            duration: c.duration || "2h 30m",
                            iconType: iconKey,
                            icon: COURSE_ICONS[iconKey] || COURSE_ICONS.development,
                            providerIcon: COURSE_ICONS.webLogo,
                            description: c.description,
                            supported_document: c.supported_document,
                            is_active: c.is_active
                        };
                    });
                    console.log("--> calling setCourses with mapped:", mapped.length);
                    setCourses(mapped);
                }
            } catch (err) {
                console.error("--> Error loading courses:", err);
            } finally {
                console.log("--> setIsLoadingCourses(false)");
                setIsLoadingCourses(false);
            }
        };

        fetchLiveCourses();
        return () => {
            active = false;
        };
    }, []);

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
                console.error("Error loading study materials from lms_study_materials:", err);
            } finally {
                if (isMounted) setIsLoadingMaterials(false);
            }
        };

        fetchStudyMaterials();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [currentPage, activeTab, categoryFilter]);

    /* =========================================================
       SEARCH & FILTER
    ========================================================= */

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

    const filteredCourses = useMemo(() => {
        return courses.filter((course) => {
            const title = (course.title || "").toLowerCase();
            const provider = (course.provider || "").toLowerCase();
            const cat = (course.category || "").toLowerCase();

            // 1. Search query
            const query = (searchQuery || "").toLowerCase().trim();
            const matchesSearch = !query || title.includes(query) || provider.includes(query) || cat.includes(query);

            // 2. Category
            const cCat = (course.category || "").toUpperCase();
            const matchesCategory =
                selectedCategories.includes("All") ||
                selectedCategories.length === 0 ||
                selectedCategories.some((c) => c.toUpperCase() === cCat);

            // 3. Platform (Provider)
            const cProv = (course.provider || "").toUpperCase();
            const matchesPlatform =
                selectedPlatforms.includes("All") ||
                selectedPlatforms.length === 0 ||
                selectedPlatforms.some((p) => p.toUpperCase() === cProv);

            return matchesSearch && matchesCategory && matchesPlatform;
        });
    }, [
        courses,
        searchQuery,
        selectedCategories,
        selectedPlatforms,
    ]);

    const sortedCourses = useMemo(() => {
        return [...filteredCourses].sort((a, b) => {
            if (sortBy === "Latest") {
                return (b.id || 0) - (a.id || 0);
            } else if (sortBy === "Oldest") {
                return (a.id || 0) - (b.id || 0);
            }
            return 0;
        });
    }, [filteredCourses, sortBy]);

    const paginatedCourses = useMemo(() => {
        const startIndex = (currentPage - 1) * coursesPerPage;
        return sortedCourses.slice(startIndex, startIndex + coursesPerPage);
    }, [sortedCourses, currentPage, coursesPerPage]);

    // Ensure currentPage remains valid if screen resize or zoom changes coursesPerPage
    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(sortedCourses.length / (coursesPerPage || 1)));
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [coursesPerPage, sortedCourses.length, currentPage]);

    const availableMaterialFormats = useMemo(
        () => deriveMaterialFormatOptions(materials),
        [materials]
    );

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
            const query = (searchQuery || "").toLowerCase().trim();
            const titleMatch = (material.title || "").toLowerCase().includes(query);
            const descMatch = (material.description || "").toLowerCase().includes(query);
            const typeMatch = (material.fileType || "").toLowerCase().includes(query);
            const matchesSearch = !query || titleMatch || descMatch || typeMatch;

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
    }, [materials, searchQuery, selectedMaterialCategories, selectedMaterialFormats]);

    const sortedMaterials = useMemo(() => {
        return [...filteredMaterials].sort((a, b) => {
            if (sortBy === "Latest") {
                return (b.id || 0) - (a.id || 0);
            } else if (sortBy === "Oldest") {
                return (a.id || 0) - (b.id || 0);
            }
            return 0;
        });
    }, [filteredMaterials, sortBy]);

    /* =========================================================
       HANDLERS
    ========================================================= */

    // Card "Recommend" button clicked -> opens RecommendCourseModal with pre-populated course
    const handleRecommendCourse = (course) => {
        setSelectedCourseForModal({
            ...course,
            resourceType: "course"
        });
        setIsRecommendModalOpen(true);
    };

    // Study Material card "Recommend" icon clicked -> opens RecommendCourseModal with pre-populated material
    const handleRecommendMaterial = (material) => {
        setSelectedCourseForModal({
            id: material.id || material.material_id,
            course_id: material.id || material.material_id,
            title: material.title,
            course_title: material.title,
            courseUrl: material.fileUrl || (typeof window !== "undefined" ? window.location.href : "https://emergere.com"),
            course_url: material.fileUrl || (typeof window !== "undefined" ? window.location.href : "https://emergere.com"),
            resourceType: "material",
            fileType: material.fileType || "PDF",
            category: material.category || "Study Material"
        });
        setIsRecommendModalOpen(true);
    };

    // "Send" in RecommendCourseModal -> opens RequestSuccessModal
    const handleSendRecommendation = (recommendedData) => {
        setIsRecommendModalOpen(false);
        setIsSuccessModalOpen(true);
    };

    // Submit form in RequestCourseModal ("+ Recommend New Course")
    const handleRequestFormSubmit = async (e) => {
        e.preventDefault();
        const newCourse = {
            id: Date.now(),
            title: formData.course_name,
            provider: formData.provider,
            category: (formData.category || "—").toUpperCase(),
            iconType: "devops",
            icon: COURSE_ICONS.devops,
            providerIcon: COURSE_ICONS.webLogo,
            totalVideos: 10,
            duration: "2h 30m",
            isRequested: true,
        };

        try {
            const { skipped } = await runRecommendWithLock(async (idemKey) => {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
                const authToken = token || localStorage.getItem("lms_token");
                const activeEmpId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "EMP004";
                const resolvedMeta = await resolveAndPersistFormMetadata({
                    provider: formData.provider,
                    isCustomProvider: formData.providerSelect === "Other",
                    category: formData.category,
                    isCustomCategory: formData.categorySelect === "Other",
                    explicitToken: authToken,
                });

                await axios.post(
                    `${API_BASE_URL}/api/recommendations/manager-course`,
                    {
                        course_name: formData.course_name,
                        employee_ids: formData.employee_ids || [],
                        provider: resolvedMeta.provider || formData.provider,
                        provider_id: resolvedMeta.provider_id || null,
                        category: resolvedMeta.category || formData.category,
                        category_id: resolvedMeta.category_id || null,
                        course_link: formData.course_link,
                        reason_for_new_course: normalizeSingleSpacing(formData.reason || "", { trimEdges: true }).slice(0, 500),
                        manager_id: activeEmpId,
                        manager_name: user?.name || "Reporting Manager",
                    },
                    {
                        headers: {
                            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                            "X-Employee-Id": activeEmpId,
                            "X-Idempotency-Key": idemKey,
                        }
                    }
                );
                fetchTrackerItems();
                setCourses((prev) => [newCourse, ...prev]);
                setIsRequestModalOpen(false);
                setIsSuccessModalOpen(true);

                setFormData({
                    course_name: "",
                    employee_ids: [],
                    provider: "",
                    category: "",
                    course_link: "",
                    reason: "",
                });
            });
            if (skipped) return;
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Failed to persist course recommendation request:", err);
        }
    };

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
        let val = e.target.value;
        val = val.replace(/[<>{}`]/g, "");
        if (val.length > 80) {
            val = val.slice(0, 80);
        }
        setSearchQuery(val);
        setCurrentPage(1);
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        setCurrentPage(1);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setCurrentPage(1);
    };

    const handleSort = () => {
        setSortBy((prev) => (prev === "Latest" ? "Oldest" : "Latest"));
        setCurrentPage(1);
    };

    const handleClearFilters = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (activeTab === "video") {
            setSelectedCategories(["All"]);
            setSelectedPlatforms(["All"]);
        } else {
            setSelectedMaterialCategories(["All"]);
            setSelectedMaterialFormats(["All"]);
            setSelectedMaterialType("All");
        }
        setCategoryFilter("All");
        setCurrentPage(1);
    };

    const handleApplyFilters = ({ categories, platforms }) => {
        setSelectedCategories(categories);
        setSelectedPlatforms(platforms);
        setCurrentPage(1);
    };

    const activeCatCount = selectedCategories.includes("All") || selectedCategories.length === 0 ? 0 : selectedCategories.length;
    const activePlatCount = selectedPlatforms.includes("All") || selectedPlatforms.length === 0 ? 0 : selectedPlatforms.length;

    const activeMaterialCategoriesCount = selectedMaterialCategories.includes("All") || selectedMaterialCategories.length === 0 ? 0 : selectedMaterialCategories.length;
    const activeMaterialFormatsCount = selectedMaterialFormats.includes("All") || selectedMaterialFormats.length === 0 ? 0 : selectedMaterialFormats.length;

    const activeFilterCount = activeTab === "video"
        ? (activeCatCount + activePlatCount)
        : (activeMaterialCategoriesCount + activeMaterialFormatsCount);

    const filterTooltip = activeTab === "video"
        ? [
            activeCatCount > 0 ? `Category (${activeCatCount})` : null,
            activePlatCount > 0 ? `Platform (${activePlatCount})` : null,
        ].filter(Boolean).join(", ") || "Filter courses"
        : [
            activeMaterialCategoriesCount > 0 ? `Category (${activeMaterialCategoriesCount})` : null,
            activeMaterialFormatsCount > 0 ? `Formats (${activeMaterialFormatsCount})` : null,
        ].filter(Boolean).join(", ") || "Filter study materials";

    return (
        <div className="rm-recommend-course-page">
            {/* ===================================================
                FIXED TOP HEADER & FILTER CONTROLS
            =================================================== */}
            <div
                className="rm-recommend-course-fixed-header"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                {/* 1. HEADER */}
                <PageHeader
                    title="Recommend Learning Resources"
                    subtitle="Curate and assign relevant courses and study materials to accelerate team member growth."
                />

                {/* 2. ACTION BAR (SEARCH + RECOMMEND NEW COURSE) */}
                <section className="rm-recommend-course-action-bar">
                    <div className="rm-recommend-search-container">
                        <span className="rm-recommend-search-icon">
                            <img src={searchIcon} alt="Search" />
                        </span>
                        <input
                            type="text"
                            className="rm-recommend-search-input"
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
                            maxLength={80}
                            autoComplete="off"
                            spellCheck="false"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="rm-recommend-search-clear-btn"
                                onClick={handleClearSearch}
                                aria-label="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="rm-recommend-action-buttons">


                        <button
                            type="button"
                            className="rm-btn-recommend-new-course"
                            onClick={() => {
                                setIsRequestModalOpen(true);
                            }}
                        >
                            <span>
                                <span className="plus">+</span> Recommend New Course
                            </span>
                        </button>
                    </div>
                </section>

                <hr className="rm-recommend-course-divider" />

                {/* 3. FILTER BAR & TABS */}
                <div className="rm-recommend-filter-bar">
                    {/* TABS (LEFT) */}
                    <div className="rm-recommend-tabs">
                        <button
                            type="button"
                            className={`rm-tab-pill ${activeTab === "video" ? "active" : "inactive"}`}
                            onClick={() => handleTabChange("video")}
                        >
                            <span className="rm-tab-pill-text-video">Emergere Library</span>
                        </button>

                        <button
                            type="button"
                            className={`rm-tab-pill ${activeTab === "materials" ? "active" : "inactive"}`}
                            onClick={() => handleTabChange("materials")}
                        >
                            <span className="rm-tab-pill-text-materials">Resources</span>
                        </button>
                    </div>

                    {/* FILTER + SORT (RIGHT) */}
                    <div className="rm-recommend-controls">
                        <div className="rm-custom-filter-container" ref={filterPopoverRef}>
                            <button
                                type="button"
                                className={`rm-btn-filter-toggle ${activeFilterCount > 0 ? "filter-active" : ""} ${isFilterPopoverOpen ? "open" : ""}`}
                                title={filterTooltip}
                                onClick={() => setIsFilterPopoverOpen(true)}
                                aria-haspopup="true"
                                aria-expanded={isFilterPopoverOpen}
                            >
                                <img src={filterIcon} alt="" className="rm-filter-icon" />
                                <span className="rm-filter-text">Filter</span>
                                {activeFilterCount > 0 && (
                                    <span
                                        className="rm-filter-clear-cross"
                                        onClick={handleClearFilters}
                                        title="Clear filter"
                                    >
                                        ×
                                    </span>
                                )}
                            </button>

                            {isFilterPopoverOpen && (
                                activeTab === "video" ? (
                                    <RecommendCourseFilterDrawer
                                        isOpen={isFilterPopoverOpen}
                                        onClose={() => setIsFilterPopoverOpen(false)}
                                        selectedCategories={selectedCategories}
                                        selectedPlatforms={selectedPlatforms}
                                        availableCategories={availableCategories}
                                        availablePlatforms={availableProviders}
                                        onApply={handleApplyFilters}
                                        onClearAll={handleClearFilters}
                                    />
                                ) : (
                                    <RecommendResourceFilterDrawer
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
                        <div className="rm-sort-dropdown-container" ref={sortDropdownRef}>
                            <button
                                type="button"
                                className={`rm-sort-dropdown ${isSortOpen ? "open" : ""}`}
                                onClick={() => setIsSortOpen(prev => !prev)}
                                aria-haspopup="listbox"
                                aria-expanded={isSortOpen}
                            >
                                <span>Sort by: {sortBy}</span>
                                <ChevronDown
                                    size={12}
                                    className={`rm-sort-chevron ${isSortOpen ? "rotate" : ""}`}
                                />
                            </button>

                            {isSortOpen && (
                                <div className="rm-sort-dropdown-menu" role="listbox">
                                    {SORT_OPTIONS.map((opt) => {
                                        const isSelected = sortBy === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                className={`rm-sort-dropdown-item ${isSelected ? "selected" : ""}`}
                                                onClick={() => {
                                                    setSortBy(opt.value);
                                                    setIsSortOpen(false);
                                                    setCurrentPage(1);
                                                }}
                                                role="option"
                                                aria-selected={isSelected}
                                            >
                                                <span>{opt.label}</span>
                                                {isSelected && <Check size={14} className="rm-sort-check-icon" />}
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
                BODY CONTENT (COURSES / MATERIALS)
            =================================================== */}
            <div className="rm-recommend-course-scrollable-content" ref={scrollContainerRef}>
                {/* VIDEO COURSES TAB */}
                {activeTab === "video" && (
                    isLoadingCourses ? (
                        <section
                            className="rm-recommend-course-grid"
                            style={{
                                "--rm-course-grid-rows": screenItemsPerPage.rows,
                                "--rm-course-grid-cols": screenItemsPerPage.cols || 5
                            }}
                        >
                            {Array.from({ length: coursesPerPage }, (_, idx) => idx + 1).map((i) => (
                                <div key={`skel-course-${i}`} className="rm-recommend-card" style={{ opacity: 0.85, padding: "6px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                                    <span className="ld-skeleton-block" style={{ width: "100%", height: "70px", borderRadius: "6px", marginBottom: "6px" }} />
                                    <span className="ld-skeleton-block" style={{ width: "65%", height: "14px", borderRadius: "4px", marginBottom: "4px" }} />
                                    <span className="ld-skeleton-block" style={{ width: "40%", height: "10px", borderRadius: "4px", marginBottom: "8px" }} />
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", width: "100%" }}>
                                        <span className="ld-skeleton-block" style={{ width: "100%", height: "25px", borderRadius: "4px" }} />
                                    </div>
                                </div>
                            ))}
                        </section>
                    ) : paginatedCourses.length > 0 ? (
                        <>
                            <section
                                className="rm-recommend-course-grid"
                                style={{
                                    "--rm-course-grid-rows": screenItemsPerPage.rows,
                                    "--rm-course-grid-cols": screenItemsPerPage.cols || 5
                                }}
                            >
                                {paginatedCourses.map((course) => (
                                    <CourseCard
                                        key={course.id || course.course_id}
                                        course={course}
                                        onRecommend={handleRecommendCourse}
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
                        <div className="rm-empty-state">
                            <img
                                src={openBookIcon}
                                alt="No courses found"
                                className="rm-empty-state-icon"
                            />
                            <h3>No courses found</h3>
                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    style={{
                                        marginTop: "12px",
                                        padding: "6px 14px",
                                        background: "#EFF6FF",
                                        color: "#2563EB",
                                        border: "1px solid #BFDBFE",
                                        borderRadius: "6px",
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        cursor: "pointer"
                                    }}
                                >
                                    Reset Filters
                                </button>
                            )}
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
                        onRecommend={handleRecommendMaterial}
                        isLoading={isLoadingMaterials}
                    />
                )}
            </div>

            {/* ===================================================
                MODALS
            =================================================== */}
            {/* 1. Recommend Course for Team Modal (Triggered by Card "Recommend" button) */}
            <RecommendCourseModal
                isOpen={isRecommendModalOpen}
                initialCourse={selectedCourseForModal}
                availableCourses={courses}
                onClose={() => setIsRecommendModalOpen(false)}
                onSend={handleSendRecommendation}
            />

            {/* 2. Recommend New Course Modal (Triggered by Top "+ Recommend New Course" button) */}
            <RequestCourseModal
                isOpen={isRequestModalOpen}
                onClose={() => {
                    if (!isSubmittingRecommend) {
                        resetRecommendIdemKey();
                        setIsRequestModalOpen(false);
                    }
                }}
                onSubmit={handleRequestFormSubmit}
                formData={formData}
                setFormData={setFormData}
                isSubmitting={isSubmittingRecommend}
            />

            {/* 3. Success Modal ("Recommendation Submitted") */}
            <RequestSuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
            />

            {/* 4. Request Tracker Modal */}
            <CourseRequestTracker
                isOpen={isTrackModalOpen}
                onClose={() => setIsTrackModalOpen(false)}
                trackerItems={trackerItems}
            />
        </div>
    );
};

export default Recommendcourse;