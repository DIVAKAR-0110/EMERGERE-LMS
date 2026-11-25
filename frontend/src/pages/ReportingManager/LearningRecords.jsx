import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import searchIcon from "../../assets/course_library/search.svg";
import filterIcon from "../../assets/course_library/filter.svg";
import { X } from "lucide-react";
import CoursesTable from "../../components/reportingmanager/Learning Records/CoursesTable";
import CertificationTable from "../../components/reportingmanager/Learning Records/CertificationTable";
import LearningRecordsFilterDrawer from "../../components/reportingmanager/Learning Records/LearningRecordsFilterDrawer";
import useCourseMetadata from "../../hooks/useCourseMetadata";
import { fetchTeamCertifications, fetchTeamMembers } from "../../services/teamService";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import "../../styles/reportingmanager/LearningRecords.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";



// Helper to parse dates from course records robustly
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

export default function LearningRecords() {
    const { token } = useAuth();
    const { providerNames } = useCourseMetadata(token);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") === "certification" ? "certification" : "courses";
    const [searchQuery, setSearchQuery] = useState("");
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

    // Courses Tab Filter States
    const [selectedCourseDepartments, setSelectedCourseDepartments] = useState(["All"]);
    const [selectedCourseCourses, setSelectedCourseCourses] = useState(["All"]);
    const [selectedCourseStatuses, setSelectedCourseStatuses] = useState(["All"]);
    const [courseEnrollmentStartDate, setCourseEnrollmentStartDate] = useState("");
    const [courseEnrollmentEndDate, setCourseEnrollmentEndDate] = useState("");

    // Certification Tab Filter States
    const [selectedCertDepartments, setSelectedCertDepartments] = useState(["All"]);
    const [selectedCertProviders, setSelectedCertProviders] = useState(["All"]);
    const [selectedCertStatuses, setSelectedCertStatuses] = useState(["All"]);

    const [courses, setCourses] = useState([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState(false);
    const [certifications, setCertifications] = useState([]);
    const [isLoadingCerts, setIsLoadingCerts] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]);



    // Fetch live team course enrollments from DB
    useEffect(() => {
        let isMounted = true;
        const loadCourses = async () => {
            try {
                setIsLoadingCourses(true);
                const res = await axios.get(`${API_BASE_URL}/api/enrollments/team-progress`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (isMounted) {
                    setCourses(Array.isArray(res.data) ? res.data : []);
                }
            } catch (err) {
                console.error("Failed to load team course progress:", err);
                if (isMounted) setCourses([]);
            } finally {
                if (isMounted) setIsLoadingCourses(false);
            }
        };
        loadCourses();
        return () => { isMounted = false; };
    }, [token]);

    // Fetch live team certifications (strictly professional certification of direct reports)
    useEffect(() => {
        let isMounted = true;
        const loadCerts = async () => {
            try {
                setIsLoadingCerts(true);
                const data = await fetchTeamCertifications(token);
                if (isMounted) {
                    const certList = data?.certifications || (Array.isArray(data) ? data : []);
                    setCertifications(certList);
                }
            } catch (err) {
                console.error("Failed to load certifications in LearningRecords:", err);
                if (isMounted) {
                    setCertifications([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingCerts(false);
                }
            }
        };

        loadCerts();
        return () => {
            isMounted = false;
        };
    }, [token]);

    // Fetch live team members to derive authentic department list
    useEffect(() => {
        let isMounted = true;
        const loadMembers = async () => {
            try {
                const members = await fetchTeamMembers(token);
                if (isMounted) {
                    setTeamMembers(Array.isArray(members) ? members : []);
                }
            } catch (err) {
                console.error("Failed to load team members in LearningRecords:", err);
            }
        };
        loadMembers();
        return () => {
            isMounted = false;
        };
    }, [token]);

    const handleTabChange = (newTab) => {
        setSearchParams(newTab === "certification" ? { tab: "certification" } : {});
    };

    // Derive unique available departments from live courses, certifications, and team members (no mock data)
    const availableDepartments = useMemo(() => {
        const depts = new Set();
        courses.forEach((c) => {
            const d = c.department || c.designation;
            if (d && typeof d === "string" && d.trim()) depts.add(d.trim());
        });
        certifications.forEach((c) => {
            const d = c.department || c.designation;
            if (d && typeof d === "string" && d.trim()) depts.add(d.trim());
        });
        teamMembers.forEach((m) => {
            const d = m.department;
            if (d && typeof d === "string" && d.trim()) depts.add(d.trim());
        });
        return Array.from(depts).sort((a, b) => a.localeCompare(b));
    }, [courses, certifications, teamMembers]);

    // Derive unique available providers from live DB + certifications (case-insensitive)
    const availableProviders = useMemo(() => {
        const map = new Map();
        (providerNames || []).forEach((p) => {
            const trimmed = typeof p === "string" ? p.trim() : "";
            if (trimmed && !map.has(trimmed.toUpperCase())) map.set(trimmed.toUpperCase(), trimmed);
        });
        certifications.forEach((c) => {
            if (c.provider && typeof c.provider === "string" && c.provider.trim()) {
                const trimmed = c.provider.trim();
                const key = trimmed.toUpperCase();
                if (!map.has(key)) map.set(key, trimmed);
            }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [certifications, providerNames]);

    // Derive unique available courses from courses list
    const availableCourses = useMemo(() => {
        const set = new Set();
        courses.forEach((c) => {
            const name = c.course || c.courseName || c.courseTitle;
            if (name && typeof name === "string" && name.trim()) {
                set.add(name.trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [courses]);

    // Active filter counts for badge / filter indicator
    const activeCourseFilterCount = useMemo(() => {
        let count = 0;
        if (!selectedCourseDepartments.includes("All") && !selectedCourseDepartments.includes("All Departments") && selectedCourseDepartments.length > 0) {
            count += selectedCourseDepartments.length;
        }
        if (!selectedCourseCourses.includes("All") && !selectedCourseCourses.includes("All Courses") && selectedCourseCourses.length > 0) {
            count += selectedCourseCourses.length;
        }
        if (!selectedCourseStatuses.includes("All") && !selectedCourseStatuses.includes("All Statuses") && selectedCourseStatuses.length > 0) {
            count += selectedCourseStatuses.length;
        }
        if (courseEnrollmentStartDate || courseEnrollmentEndDate) {
            count += 1;
        }
        return count;
    }, [selectedCourseDepartments, selectedCourseCourses, selectedCourseStatuses, courseEnrollmentStartDate, courseEnrollmentEndDate]);

    const activeCertFilterCount = useMemo(() => {
        let count = 0;
        if (!selectedCertDepartments.includes("All") && !selectedCertDepartments.includes("All Departments") && selectedCertDepartments.length > 0) {
            count += selectedCertDepartments.length;
        }
        if (!selectedCertProviders.includes("All") && !selectedCertProviders.includes("All Providers") && selectedCertProviders.length > 0) {
            count += selectedCertProviders.length;
        }
        if (!selectedCertStatuses.includes("All") && !selectedCertStatuses.includes("All Statuses") && selectedCertStatuses.length > 0) {
            count += selectedCertStatuses.length;
        }
        return count;
    }, [selectedCertDepartments, selectedCertProviders, selectedCertStatuses]);

    const activeFilterCount = activeTab === "courses" ? activeCourseFilterCount : activeCertFilterCount;

    const handleClearCurrentFilters = () => {
        if (activeTab === "courses") {
            setSelectedCourseDepartments(["All"]);
            setSelectedCourseCourses(["All"]);
            setSelectedCourseStatuses(["All"]);
            setCourseEnrollmentStartDate("");
            setCourseEnrollmentEndDate("");
        } else {
            setSelectedCertDepartments(["All"]);
            setSelectedCertProviders(["All"]);
            setSelectedCertStatuses(["All"]);
        }
    };

    const dataset = activeTab === "courses" ? courses : certifications;

    const filteredData = dataset
        .filter((item) => {
            if (activeTab === "courses") {
                // 1. Department Filter
                const dept = (item.department || item.designation || "").trim();
                const matchesDept =
                    selectedCourseDepartments.includes("All") ||
                    selectedCourseDepartments.includes("All Departments") ||
                    selectedCourseDepartments.length === 0 ||
                    selectedCourseDepartments.some((d) => d.toLowerCase() === dept.toLowerCase());

                // 2. Course Filter
                const courseName = (item.course || item.courseName || item.courseTitle || "").trim();
                const matchesCourse =
                    selectedCourseCourses.includes("All") ||
                    selectedCourseCourses.includes("All Courses") ||
                    selectedCourseCourses.length === 0 ||
                    selectedCourseCourses.some((c) => c.toLowerCase() === courseName.toLowerCase());

                // 3. Status Filter
                const status = (item.status || item.statusType || "").trim();
                const matchesStatus =
                    selectedCourseStatuses.includes("All") ||
                    selectedCourseStatuses.includes("All Statuses") ||
                    selectedCourseStatuses.length === 0 ||
                    selectedCourseStatuses.some((s) => s.toLowerCase() === status.toLowerCase());

                // 4. Enrollment Date Range Filter
                const dateObj = parseCourseDate(item.enrollmentDate, item.submissionDate || item.created_at || item.createdAt);
                const matchesDate = matchesDateRange(dateObj, courseEnrollmentStartDate, courseEnrollmentEndDate);

                if (!matchesDept || !matchesCourse || !matchesStatus || !matchesDate) return false;
            } else {
                // 1. Department Filter
                const dept = (item.department || item.designation || "").trim();
                const matchesDept =
                    selectedCertDepartments.includes("All") ||
                    selectedCertDepartments.some((d) => d.toLowerCase() === dept.toLowerCase());

                // 2. Provider Filter
                const provider = (item.provider || "").trim();
                const matchesProvider =
                    selectedCertProviders.includes("All") ||
                    selectedCertProviders.some((p) => p.toLowerCase() === provider.toLowerCase());

                // 3. Status Filter
                const status = (item.status || item.statusType || "").trim();
                const matchesStatus =
                    selectedCertStatuses.includes("All") ||
                    selectedCertStatuses.some((s) => s.toLowerCase() === status.toLowerCase());

                if (!matchesDept || !matchesProvider || !matchesStatus) return false;
            }

            const query = searchQuery.toLowerCase().trim();
            if (!query) return true;
            const titleField = activeTab === "courses"
                ? (item.course || item.courseName || item.courseTitle || "")
                : (item.certificate || item.certification || item.course || item.certification_name || "");
            const empName = String(item.employeeName || item.name || "").toLowerCase();
            const courseTitle = String(titleField).toLowerCase();

            const empId = String(item.employee_id || item.employeeId || "").toLowerCase();
            return empName.includes(query) || courseTitle.includes(query) || empId.includes(query);
        })
        .sort((a, b) => {
            const dateA = new Date(a.submissionDate || a.rawExpiryDate || 0);
            const dateB = new Date(b.submissionDate || b.rawExpiryDate || 0);
            return dateB - dateA;
        });

    return (
        <div className="rm-learning-records-page">
            {/* Page Header */}
            <PageHeader
                title="Learning Records"
                subtitle="Review comprehensive course completions, exam schedules, and team certification records."
            />

            {/* Toolbar Row: Tabs + Search & Filters */}
            <div className="rm-learning-records-toolbar">
                {/* Left Tabs */}
                <div className="rm-pill-tabs-container">
                    <button
                        type="button"
                        className={`rm-pill-tab-btn ${activeTab === "courses" ? "active" : ""}`}
                        onClick={() => handleTabChange("courses")}
                    >
                        Courses
                    </button>

                    <button
                        type="button"
                        className={`rm-pill-tab-btn ${activeTab === "certification" ? "active" : ""}`}
                        onClick={() => handleTabChange("certification")}
                    >
                        Certification
                    </button>
                </div>

                {/* Right Controls */}
                <div className="rm-toolbar-controls-right">
                    {/* Search Input */}
                    <div className="rm-records-search-wrapper">
                        <img src={searchIcon} alt="" className="rm-records-search-icon-img" />
                        <input
                            type="text"
                            placeholder={
                                activeTab === "courses"
                                    ? "Search by employee id/name or course"
                                    : "Search by employee id/name or certification"
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="rm-records-search-input"
                            aria-label={
                                activeTab === "courses"
                                    ? "Search by employee id, employee name or course"
                                    : "Search by employee id, employee name or certification"
                            }
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                style={{
                                    position: "absolute",
                                    right: "10px",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                    display: "flex",
                                    alignItems: "center"
                                }}
                                aria-label="Clear search"
                            >
                                <X size={14} color="#94A3B8" />
                            </button>
                        )}
                    </div>

                    {/* Modern Filter Action Button */}
                    <button
                        type="button"
                        className={`rm-btn-filter-action ${activeFilterCount > 0 ? "filtered" : ""}`}
                        onClick={() => setIsFilterDrawerOpen(true)}
                    >
                        <img src={filterIcon} alt="" className="rm-records-filter-icon-img" />
                        <span>Filter</span>
                        {activeFilterCount > 0 && (
                            <span
                                className="rm-filter-clear-cross"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearCurrentFilters();
                                }}
                                title="Clear filters"
                            >
                                ×
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Modular Table Views */}
            {activeTab === "courses" ? (
                <CoursesTable data={filteredData} isLoading={isLoadingCourses} />
            ) : (
                <CertificationTable data={filteredData} isLoading={isLoadingCerts} />
            )}

            {/* Slide-over Filter Drawer */}
            <LearningRecordsFilterDrawer
                isOpen={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                activeTab={activeTab}
                selectedCourseDepartments={selectedCourseDepartments}
                selectedCourseCourses={selectedCourseCourses}
                selectedCourseStatuses={selectedCourseStatuses}
                courseEnrollmentStartDate={courseEnrollmentStartDate}
                courseEnrollmentEndDate={courseEnrollmentEndDate}
                selectedCertDepartments={selectedCertDepartments}
                selectedCertProviders={selectedCertProviders}
                selectedCertStatuses={selectedCertStatuses}
                availableDepartments={availableDepartments}
                availableCourses={availableCourses}
                availableProviders={availableProviders}
                onApply={({
                    courseDepartments,
                    courseCourses,
                    courseStatuses,
                    courseEnrollmentStartDate,
                    courseEnrollmentEndDate,
                    certDepartments,
                    certProviders,
                    certStatuses,
                }) => {
                    if (activeTab === "courses") {
                        setSelectedCourseDepartments(courseDepartments);
                        setSelectedCourseCourses(courseCourses);
                        setSelectedCourseStatuses(courseStatuses);
                        setCourseEnrollmentStartDate(courseEnrollmentStartDate);
                        setCourseEnrollmentEndDate(courseEnrollmentEndDate);
                    } else {
                        setSelectedCertDepartments(certDepartments);
                        setSelectedCertProviders(certProviders);
                        setSelectedCertStatuses(certStatuses);
                    }
                }}
                onClearAll={handleClearCurrentFilters}
            />
        </div>
    );
}
