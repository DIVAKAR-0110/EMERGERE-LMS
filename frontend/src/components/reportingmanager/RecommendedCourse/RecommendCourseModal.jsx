import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import closeIcon from "../../../assets/course_library/close.svg";
import downArrowIcon from "../../../assets/course_library/down_arrow.svg";
import ChooseEmployeeDropdown from "./ChooseEmployeeDropdown";
import { useAuth } from "../../../context/AuthContext";

import "../../../styles/reportingmanager/RecommendCourseModal.css";

const RecommendCourseModal = ({
    isOpen,
    onClose,
    onSend,
    initialCourse,
    availableCourses = [],
}) => {
    const { token, user } = useAuth();
    const [teamMembers, setTeamMembers] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [selectedCourseTitle, setSelectedCourseTitle] = useState("Python for Data Science");
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [courseUrl, setCourseUrl] = useState("");
    const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isMaterial = initialCourse?.resourceType === "material";

    // List of courses for the dropdown
    const [courseList, setCourseList] = useState([]);

    // Validation State
    const [errors, setErrors] = useState({
        member: "",
        course: "",
        url: "",
    });
    const [touched, setTouched] = useState({
        member: false,
        course: false,
        url: false,
    });

    const employeeSelectRef = useRef(null);
    const courseSelectRef = useRef(null);
    const submittingRef = useRef(false);

    // Fetch or map course options
    useEffect(() => {
        if (!isOpen) return;

        if (Array.isArray(availableCourses) && availableCourses.length > 0) {
            setCourseList(availableCourses);
        } else {
            // Fetch live courses from database
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
            axios.get(`${API_BASE_URL}/api/courses?is_active=true`)
                .then((res) => {
                    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                        const mapped = res.data.map((c) => ({
                            id: c.id,
                            course_id: c.id,
                            title: c.course_title,
                            courseUrl: c.course_url,
                            provider: c.provider_name || "—",
                            category: c.category_name || "—",
                            duration: c.duration || "2h 30m"
                        }));
                        setCourseList(mapped);
                    } else {
                        setCourseList([]);
                    }
                })
                .catch(() => {
                    setCourseList([]);
                });
        }
    }, [isOpen, availableCourses]);

    // Fetch live direct reports and all enterprise employees from Azure AD / API
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchTeamMembers = async () => {
            setIsLoadingMembers(true);
            try {
                const authToken = token || localStorage.getItem("lms_token");
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
                const AVATAR_COLORS = [
                    "#F97FFF", "#BED60E", "#5CDE8A", "#FF7FAE", "#A87FFF",
                    "#fdba74", "#93c5fd", "#7dd3fc", "#fb7185", "#38bdf8"
                ];

                const mapEmployee = (m, idx) => {
                    const rawName = m.full_name || m.name || "—";
                    const cleanName = rawName.split("(")[0].trim();
                    const initials = cleanName
                        .split(" ")
                        .filter(Boolean)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                    return {
                        id: m.employee_id || `EMP${String(idx + 1).padStart(3, "0")}`,
                        employee_id: m.employee_id,
                        name: cleanName,
                        initials: initials || "EM",
                        avatarBg: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                        email: m.work_email || m.email || "",
                        department: m.department || "",
                        role: m.role || m.job_title || "",
                    };
                };

                const [teamRes, allRes] = await Promise.allSettled([
                    axios.get(`${API_BASE_URL}/api/auth/team-members`, {
                        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                    }),
                    axios.get(`${API_BASE_URL}/api/auth/employees`, {
                        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
                    }),
                ]);

                if (isMounted) {
                    if (teamRes.status === "fulfilled" && teamRes.value.data?.members) {
                        setTeamMembers(teamRes.value.data.members.map(mapEmployee));
                    }
                    if (allRes.status === "fulfilled" && allRes.value.data?.employees) {
                        const emps = allRes.value.data.employees
                            .filter(e => (e.role || "").toLowerCase() === "employee")
                            .map(mapEmployee);
                        setAllEmployees(emps);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch assigned team members from Azure AD:", err);
            } finally {
                if (isMounted) setIsLoadingMembers(false);
            }
        };

        fetchTeamMembers();
        return () => {
            isMounted = false;
        };
    }, [isOpen, token]);

    // Initialize course when opened with specific initialCourse
    useEffect(() => {
        if (isOpen) {
            setSelectedMemberIds([]);
            setErrors({ member: "", course: "", url: "" });
            setTouched({ member: false, course: false, url: false });
            setIsSubmitting(false);

            if (initialCourse) {
                const title = initialCourse.title || initialCourse.course_title || (isMaterial ? "Study Material" : "Python for Data Science");
                let url = initialCourse.courseUrl || initialCourse.course_url || initialCourse.fileUrl || "";
                if (isMaterial && !url) {
                    url = window.location.origin + "/reporting-manager/recommend-course";
                }
                const id = initialCourse.id || initialCourse.course_id || initialCourse.material_id || null;
                setSelectedCourseTitle(title);
                setCourseUrl(url);
                setSelectedCourseId(id);
            } else {
                setSelectedCourseTitle(isMaterial ? "Study Material" : "Python for Data Science");
                setCourseUrl("");
                setSelectedCourseId(null);
            }
            setIsEmployeeDropdownOpen(false);
            setMemberSearchQuery("");
            setIsCourseDropdownOpen(false);
        }
    }, [isOpen, initialCourse, isMaterial]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (employeeSelectRef.current && !employeeSelectRef.current.contains(e.target)) {
                setIsEmployeeDropdownOpen(false);
                setMemberSearchQuery("");
            }
            if (courseSelectRef.current && !courseSelectRef.current.contains(e.target)) {
                setIsCourseDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen) return null;

    // Field-level validation
    const validateField = (name, value) => {
        let errorMsg = "";
        if (name === "member") {
            if (!value || value.length === 0) {
                errorMsg = "Please select at least one team member";
            }
        } else if (name === "course") {
            if (!value || !value.trim()) {
                errorMsg = "Please select a course to recommend";
            }
        }
        setErrors((prev) => ({ ...prev, [name]: errorMsg }));
        return errorMsg;
    };

    const handleToggleMember = (memberId) => {
        setSelectedMemberIds((prev) => {
            const updated = prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId];
            validateField("member", updated);
            return updated;
        });
        setTouched((prev) => ({ ...prev, member: true }));
    };

    const handleSelectAllMembers = (currentList = null) => {
        const targetList = (Array.isArray(currentList) && currentList.length > 0)
            ? currentList
            : teamMembers;
        setSelectedMemberIds((prev) => {
            const allTargetSelected = targetList.every((m) => prev.includes(m.id) || prev.includes(m.employee_id));
            const targetIds = targetList.map((m) => m.id || m.employee_id);
            const updated = allTargetSelected
                ? prev.filter((id) => !targetIds.includes(id))
                : Array.from(new Set([...prev, ...targetIds]));
            validateField("member", updated);
            return updated;
        });
        setTouched((prev) => ({ ...prev, member: true }));
    };

    const getSelectedMemberDisplayText = () => {
        if (isLoadingMembers) return "Loading team members...";
        const allList = [...teamMembers, ...allEmployees];
        if (allList.length === 0) return "No team members assigned";
        if (selectedMemberIds.length === 0) return "Choose employees";
        if (selectedMemberIds.length === 1) {
            const member = allList.find((m) => m.id === selectedMemberIds[0]);
            return member ? member.name : "1 employee selected";
        }
        if (teamMembers.length > 0 && selectedMemberIds.length === teamMembers.length) {
            return "All direct reports selected";
        }
        const names = allList.filter((m) => selectedMemberIds.includes(m.id)).map((m) => m.name);
        const uniqueNames = Array.from(new Set(names));
        return uniqueNames.join(", ");
    };

    const handleSelectCourse = (course) => {
        setSelectedCourseTitle(course.title);
        const nextUrl = course.courseUrl || course.course_url || "";
        setCourseUrl(nextUrl);
        setSelectedCourseId(course.id || course.course_id || null);
        setIsCourseDropdownOpen(false);

        validateField("course", course.title);
        setTouched((prev) => ({ ...prev, course: true }));
    };

    const handleUrlChange = (e) => {
        let val = e.target.value;
        val = val.replace(/[<>{}`"']/g, "");
        if (val.length > 500) {
            val = val.slice(0, 500);
        }
        setCourseUrl(val);
    };

    const handleUrlBlur = () => {
        setTouched((prev) => ({ ...prev, url: true }));
    };

    const handleSendSubmit = async (e) => {
        e.preventDefault();
        if (submittingRef.current || isSubmitting) return;

        const memberErr = validateField("member", selectedMemberIds);
        const courseErr = validateField("course", selectedCourseTitle);

        setTouched({
            member: true,
            course: true,
            url: true,
        });

        if (memberErr || courseErr) {
            return;
        }

        let formattedUrl = (courseUrl || "").trim();
        if (
            formattedUrl &&
            !isMaterial &&
            !formattedUrl.startsWith("http://") &&
            !formattedUrl.startsWith("https://") &&
            !formattedUrl.startsWith("materials/") &&
            !formattedUrl.startsWith("/materials/")
        ) {
            formattedUrl = `https://${formattedUrl}`;
        }

        submittingRef.current = true;
        setIsSubmitting(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
            const authToken = token || localStorage.getItem("lms_token");
            const activeEmpId = user?.employee_id || localStorage.getItem("lms_active_employee_id") || "EMP004";

            // Submit recommendation to backend notification API
            await axios.post(
                `${API_BASE_URL}/api/notifications/recommend-course`,
                {
                    course_id: isMaterial ? null : selectedCourseId,
                    study_material_id: isMaterial ? selectedCourseId : null,
                    course_title: selectedCourseTitle,
                    course_url: formattedUrl,
                    employee_ids: selectedMemberIds,
                    resource_type: isMaterial ? "material" : "course",
                    message: isMaterial
                        ? `${user?.name || "Reporting Manager"} recommended the study material '${selectedCourseTitle}' to support your learning journey.`
                        : `${user?.name || "Reporting Manager"} recommended the course '${selectedCourseTitle}' to support your learning journey.`
                },
                {
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    }
                }
            );

            onSend?.({
                memberIds: selectedMemberIds,
                courseTitle: selectedCourseTitle,
                courseUrl: formattedUrl,
            });
        } catch (err) {
            if (err?.isDuplicateInFlight) return;
            console.error("Error submitting recommendation to backend:", err);
            if (err?.response?.status === 409) return;
            // Fall back to invoking success callback
            onSend?.({
                memberIds: selectedMemberIds,
                courseTitle: selectedCourseTitle,
                courseUrl: formattedUrl,
            });
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <div className="rm-custom-modal-overlay">
            <div className="rm-recommend-team-modal" onClick={(e) => e.stopPropagation()}>
                {/* CLOSE BUTTON */}
                <button
                    type="button"
                    className="rm-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                    disabled={isSubmitting}
                >
                    <img src={closeIcon} alt="close-icon" width={12} height={12} />
                </button>

                {/* HEADER */}
                <div className="rm-recommend-modal-header">
                    <h2 className="rm-recommend-modal-blue-title">
                        {isMaterial ? "Recommend Study Material for Team" : "Recommend Course for Team"}
                    </h2>
                    <p className="rm-recommend-modal-subtitle">
                        {isMaterial
                            ? "Recommend relevant study materials for your team members to enhance their skills and learning."
                            : "Recommend relevant courses for your team members to enhance their skills and learning."}
                    </p>
                </div>

                {/* FORM */}
                <form onSubmit={handleSendSubmit} className="rm-recommend-team-form" noValidate>
                    {/* FIELD 1: SELECT TEAM MEMBER */}
                    <div className="rm-form-group" ref={employeeSelectRef}>
                        <label className="rm-recommend-form-label">
                            Select Team Member<span style={{ color: "#EF4444", marginLeft: "4px" }}>*</span>
                        </label>
                        <div
                            className={`rm-recommend-select-box ${isEmployeeDropdownOpen ? "is-active" : ""} ${touched.member && errors.member ? "has-error" : ""
                                }`}
                            onClick={() => {
                                setIsEmployeeDropdownOpen(true);
                                setTouched((prev) => ({ ...prev, member: true }));
                            }}
                        >
                            <input
                                type="text"
                                className={`rm-select-search-input ${selectedMemberIds.length > 0 && !memberSearchQuery ? "has-selection" : ""}`}
                                placeholder={memberSearchQuery ? "Type to search..." : getSelectedMemberDisplayText()}
                                value={memberSearchQuery}
                                onKeyDown={(e) => {
                                    if (e.key === " ") {
                                        const input = e.target;
                                        const val = input.value || "";
                                        const selStart = input.selectionStart ?? 0;
                                        const selEnd = input.selectionEnd ?? selStart;
                                        if (selStart === 0 || val[selStart - 1] === " " || val[selEnd] === " ") {
                                            e.preventDefault();
                                        }
                                    }
                                }}
                                onPaste={(e) => {
                                    e.preventDefault();
                                    const paste = (e.clipboardData || window.clipboardData)?.getData("text") || "";
                                    const input = e.target;
                                    const val = input.value || "";
                                    const start = input.selectionStart ?? 0;
                                    const end = input.selectionEnd ?? start;
                                    const nextVal = (val.slice(0, start) + paste + val.slice(end))
                                        .replace(/^\s+/, "")
                                        .replace(/\s{2,}/g, " ");
                                    setMemberSearchQuery(nextVal);
                                    if (!isEmployeeDropdownOpen) setIsEmployeeDropdownOpen(true);
                                    setTouched((prev) => ({ ...prev, member: true }));
                                }}
                                onChange={(e) => {
                                    const cleanVal = e.target.value.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
                                    setMemberSearchQuery(cleanVal);
                                    if (!isEmployeeDropdownOpen) setIsEmployeeDropdownOpen(true);
                                    setTouched((prev) => ({ ...prev, member: true }));
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isEmployeeDropdownOpen) setIsEmployeeDropdownOpen(true);
                                }}
                                aria-label="Select Team Member"
                            />
                            {memberSearchQuery && (
                                <button
                                    type="button"
                                    className="rm-search-clear-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMemberSearchQuery("");
                                    }}
                                    aria-label="Clear search"
                                >
                                    ✕
                                </button>
                            )}
                            <button
                                type="button"
                                className="rm-dropdown-arrow-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEmployeeDropdownOpen((prev) => !prev);
                                    setTouched((prev) => ({ ...prev, member: true }));
                                }}
                                aria-label="Toggle dropdown"
                            >
                                <img
                                    src={downArrowIcon}
                                    alt=""
                                    className={`rm-recommend-dropdown-arrow ${isEmployeeDropdownOpen ? "rotate-180" : ""}`}
                                />
                            </button>
                        </div>

                        {touched.member && errors.member && (
                            <span className="rm-recommend-error-text" role="alert">
                                {errors.member}
                            </span>
                        )}

                        {/* CHOOSE EMPLOYEE DROPDOWN */}
                        {isEmployeeDropdownOpen && (
                            <ChooseEmployeeDropdown
                                teamMembers={teamMembers}
                                searchQuery={memberSearchQuery}
                                selectedMemberIds={selectedMemberIds}
                                onToggleMember={handleToggleMember}
                                onSelectAll={handleSelectAllMembers}
                                isLoading={isLoadingMembers}
                            />
                        )}
                    </div>

                    {/* FIELD 2: SELECT COURSE OR STUDY MATERIAL */}
                    <div className="rm-form-group" ref={courseSelectRef}>
                        <label className="rm-recommend-form-label" >
                            {isMaterial ? "Study Material" : "Select Course"} <span style={{ color: "#EF4444", marginLeft: "4px" }}>*</span>
                        </label>
                        <div
                            className="rm-recommend-select-box is-disabled"
                            aria-disabled="true"
                            tabIndex={-1}
                            role="button"
                        >
                            <span className="rm-select-text-active">
                                {selectedCourseTitle}
                            </span>
                        </div>
                    </div>

                    {/* FIELD 3: COURSE / DOCUMENT URL */}
                    <div className="rm-form-group">
                        <label className="rm-recommend-form-label">
                            {isMaterial ? "Document Link / URL" : "Course URL"}
                        </label>
                        <input
                            type="text"
                            className="rm-recommend-text-input"
                            placeholder={isMaterial ? "https://emergere.com/documents/handbook.pdf" : "https://udemy.com/course/python-for-data-science"}
                            value={courseUrl}
                            onChange={handleUrlChange}
                            onBlur={handleUrlBlur}
                            maxLength={500}
                            autoComplete="off"
                            spellCheck="false"
                            disabled
                        />
                    </div>

                    {/* FOOTER BUTTONS */}
                    <div className="rm-recommend-modal-footer">
                        <button
                            type="button"
                            className="rm-btn-recommend-cancel"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rm-btn-recommend-send"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Sending..." : "Send"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RecommendCourseModal;
