import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import axios from "axios";
import dropdownIcon from "../../../assets/coursemanagement/dropdown.svg";
import useSubmitLock from "../../../hooks/useSubmitLock";
import TopToastNotification from "../../common/TopToastNotification";
import CourseModalDropdown from "./CourseModalDropdown";
import EmpDatePicker from "../../employee/Certification/EmpDatePicker";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
    sanitizeSingleSpaceInput,
} from "../../../utils/validationUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Helper for formatted today ISO (YYYY-MM-DD)
const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

// Helper for 1 month later ISO (YYYY-MM-DD)
const getOneMonthLaterStr = (baseDateStr) => {
    let d;
    if (baseDateStr) {
        const parts = baseDateStr.split("-");
        if (parts.length === 3) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            d = new Date(baseDateStr);
        }
    } else {
        d = new Date();
    }
    d.setMonth(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

export default function AssignCourseModal({ isOpen, onClose, onAssign }) {
    const [coursesList, setCoursesList] = useState([]);
    const [employeesList, setEmployeesList] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState("");
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [showEmpDropdown, setShowEmpDropdown] = useState(false);
    const [empSearchTerm, setEmpSearchTerm] = useState("");
    const empDropdownRef = useRef(null);
    const empInputRef = useRef(null);

    // Toast and error validation state
    const [toast, setToast] = useState({ isOpen: false, message: "", type: "error" });
    const [isCourseError, setIsCourseError] = useState(false);
    const [isEmployeeError, setIsEmployeeError] = useState(false);
    const [isStartDateError, setIsStartDateError] = useState(false);
    const [isTargetDateError, setIsTargetDateError] = useState(false);
    const [targetDateErrorMsg, setTargetDateErrorMsg] = useState("This field is required");

    // Date state with exact requirements
    const [startDate, setStartDate] = useState("");
    const [targetDate, setTargetDate] = useState("");

    const [note, setNote] = useState("");
    const maxChars = 250;
    const { isSubmitting, runWithLock } = useSubmitLock();

    // Close employee dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (empDropdownRef.current && !empDropdownRef.current.contains(event.target)) {
                setShowEmpDropdown(false);
                setEmpSearchTerm("");
            }
        }

        if (showEmpDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showEmpDropdown]);

    useEffect(() => {
        if (!isOpen) {
            setToast({ isOpen: false, message: "", type: "error" });
            setIsCourseError(false);
            setIsEmployeeError(false);
            setIsStartDateError(false);
            setIsTargetDateError(false);
            setTargetDateErrorMsg("This field is required");
            setStartDate("");
            setTargetDate("");
            setSelectedCourseId("");
            setSelectedEmployees([]);
            setShowEmpDropdown(false);
            setEmpSearchTerm("");
            return;
        }

        const loadLiveOptions = async () => {
            try {
                const token = localStorage.getItem("lms_token");
                const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP001";
                const headers = {
                    "Content-Type": "application/json",
                    "X-Employee-Id": activeEmpId,
                };
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const [cRes, eRes, enrRes, assignRes, rawEnrRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/courses?is_active=true`, { headers }).catch(() => null),
                    axios.get(`${API_BASE_URL}/api/auth/employees`, { headers }).catch(() => null),
                    axios.get(`${API_BASE_URL}/api/enrollments/requests`, { headers }).catch(() => null),
                    axios.get(`${API_BASE_URL}/api/ld/assigned-courses`, { headers }).catch(() => null),
                    axios.get(`${API_BASE_URL}/api/enrollments`, { headers }).catch(() => null),
                ]);

                const enrollments = Array.isArray(enrRes?.data) ? enrRes.data : [];
                const assignedList = Array.isArray(assignRes?.data) ? assignRes.data : [];
                const rawEnrollments = Array.isArray(rawEnrRes?.data) ? rawEnrRes.data : [];

                if (cRes && Array.isArray(cRes.data) && cRes.data.length > 0) {
                    const mappedCourses = cRes.data.map((c) => {
                        const activeEmpIds = new Set();
                        const completedEmpIds = new Set();
                        assignedList.forEach((a) => {
                            if (Number(a.course_id) === Number(c.id) || Number(a.courseId) === Number(c.id)) {
                                const st = a.learning_status || a.status;
                                const eid = a.employee_id || a.employee_code || a.employeeId;
                                if (st === "Completed") {
                                    if (eid) completedEmpIds.add(String(eid).trim().toUpperCase());
                                } else if (["Assigned", "Not Started", "In Progress"].includes(st)) {
                                    if (eid) activeEmpIds.add(String(eid).trim().toUpperCase());
                                }
                            }
                        });
                        enrollments.forEach((r) => {
                            if (
                                (Number(r.courseId) === Number(c.id) || Number(r.course_id) === Number(c.id)) &&
                                r.status === "Approved"
                            ) {
                                const eid = r.employeeId || r.employee_id;
                                if (eid) activeEmpIds.add(String(eid).trim().toUpperCase());
                            }
                        });
                        rawEnrollments.forEach((e) => {
                            if (Number(e.course_id) === Number(c.id) || Number(e.courseId) === Number(c.id)) {
                                const eid = e.employee_id || e.employeeId;
                                if (e.status === "Completed") {
                                    if (eid) completedEmpIds.add(String(eid).trim().toUpperCase());
                                } else if (["Assigned", "Not Started", "In Progress"].includes(e.status)) {
                                    if (eid) activeEmpIds.add(String(eid).trim().toUpperCase());
                                }
                            }
                        });

                        // Concurrency seat pool: only active learners occupy the 4 seats
                        const approvedCount = Math.min(4, activeEmpIds.size);
                        const avail = Math.max(0, 4 - approvedCount);
                        const usagePct = Math.round((approvedCount / 4) * 100);

                        return {
                            id: c.id,
                            course_id: c.id,
                            title: c.course_title,
                            provider: c.provider_name || "—",
                            category: c.category_name || "Data Analytics",
                            duration: c.duration || "28h 30m",
                            availableSeats: avail,
                            occupiedSeats: approvedCount,
                            accountUsage: `${approvedCount}/4`,
                            usagePercent: usagePct,
                            activeEmpIds: Array.from(activeEmpIds),
                            completedEmpIds: Array.from(completedEmpIds),
                        };
                    });
                    setCoursesList(mappedCourses);

                } else {
                    setCoursesList([]);
                }

                const emps = Array.isArray(eRes?.data?.employees)
                    ? eRes.data.employees
                    : Array.isArray(eRes?.data)
                        ? eRes.data
                        : [];

                if (emps.length > 0) {
                    const mappedEmps = emps.map((e) => ({
                        id: e.employee_id || e.id,
                        code: e.employee_id || e.id,
                        name: e.name || e.full_name || e.displayName || "—",
                        role: e.job_title || e.jobTitle || e.role || "—",
                        department: e.department || "—",
                    }));
                    setEmployeesList(mappedEmps);
                    setSelectedEmployees([]);
                } else {
                    setEmployeesList([]);
                }
            } catch (err) {
                console.warn("[AssignCourseModal] Error fetching options:", err);
            }
        };

        loadLiveOptions();
        setNote("");
        setEmpSearchTerm("");
        setShowEmpDropdown(false);
        setIsEmployeeError(false);
        setIsStartDateError(false);
        setIsTargetDateError(false);

        // Reset dates: initially empty so required validation triggers if unselected
        setStartDate("");
        setTargetDate("");
        setTargetDateErrorMsg("This field is required");
    }, [isOpen]);

    if (!isOpen) return null;

    const course = selectedCourseId
        ? coursesList.find((c) => String(c.id) === String(selectedCourseId)) || null
        : null;

    const removeEmployee = (id, e) => {
        e.stopPropagation();
        setSelectedEmployees((prev) => prev.filter((emp) => emp.id !== id));
    };

    const activeLearnerIds = new Set(
        (course?.activeEmpIds || []).map((id) => String(id).trim().toUpperCase())
    );
    const completedLearnerIds = new Set(
        (course?.completedEmpIds || []).map((id) => String(id).trim().toUpperCase())
    );

    const addEmployee = (emp) => {
        const empCode = String(emp.code || emp.id || "").trim().toUpperCase();
        if (activeLearnerIds.has(empCode)) {
            setToast({
                isOpen: true,
                message: `${emp.name} (${emp.code}) is already actively enrolled or learning this course.`,
                type: "error",
            });
            setShowEmpDropdown(false);
            return;
        }
        if (completedLearnerIds.has(empCode)) {
            setToast({
                isOpen: true,
                message: `${emp.name} (${emp.code}) has already completed this course.`,
                type: "error",
            });
            setShowEmpDropdown(false);
            return;
        }

        if (!selectedEmployees.find((item) => item.id === emp.id)) {
            if ((course?.availableSeats ?? 4) <= 0) {
                setToast({
                    isOpen: true,
                    message: "Cannot assign: Course license capacity of 4 concurrent members has already been reached.",
                    type: "error",
                });
                return;
            }
            if (selectedEmployees.length >= (course?.availableSeats || 4)) {
                setToast({
                    isOpen: true,
                    message: `Cannot assign more than ${course?.availableSeats || 4} employee(s) to this course.`,
                    type: "error",
                });
                return;
            }
            setSelectedEmployees((prev) => [...prev, emp]);
            setIsEmployeeError(false);
        }
        setShowEmpDropdown(false);
    };

    // Filter out employees who are currently learning or have already completed this course
    const unassignedEmployees = employeesList.filter((emp) => {
        const empCode = String(emp.code || emp.id || "").trim().toUpperCase();
        return !activeLearnerIds.has(empCode) && !completedLearnerIds.has(empCode);
    });

    const filteredEmployees = unassignedEmployees.filter((emp) => {
        if (!empSearchTerm.trim()) return true;
        const term = empSearchTerm.toLowerCase();
        return (
            (emp.name && emp.name.toLowerCase().includes(term)) ||
            (emp.code && emp.code.toLowerCase().includes(term)) ||
            (emp.department && emp.department.toLowerCase().includes(term)) ||
            (emp.role && emp.role.toLowerCase().includes(term))
        );
    });

    const handleStartDateChange = (e) => {
        let val = e?.target?.value || "";
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setStartDate(val);
        if (val) setIsStartDateError(false);
        if (targetDate && val && targetDate < val) {
            setIsTargetDateError(true);
            setTargetDateErrorMsg("Target completion date must be on or after the learning start date.");
        } else if (targetDate) {
            setIsTargetDateError(false);
            setTargetDateErrorMsg("This field is required");
        }
    };

    const handleTargetDateChange = (e) => {
        let val = e?.target?.value || "";
        if (val) {
            const parts = val.split("-");
            if (parts[0] && parts[0].length > 4) {
                parts[0] = parts[0].slice(0, 4);
                val = parts.join("-");
            }
        }
        setTargetDate(val);
        if (val) {
            if (startDate && val < startDate) {
                setIsTargetDateError(true);
                setTargetDateErrorMsg("Target completion date must be on or after the learning start date.");
            } else {
                setIsTargetDateError(false);
                setTargetDateErrorMsg("This field is required");
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        let hasError = false;
        if (!selectedCourseId) {
            setIsCourseError(true);
            hasError = true;
        }
        if (selectedEmployees.length === 0) {
            setIsEmployeeError(true);
            hasError = true;
        }
        if (!startDate || !String(startDate).trim()) {
            setIsStartDateError(true);
            hasError = true;
        }
        if (!targetDate || !String(targetDate).trim()) {
            setIsTargetDateError(true);
            setTargetDateErrorMsg("This field is required");
            hasError = true;
        } else if (startDate && targetDate < startDate) {
            setIsTargetDateError(true);
            setTargetDateErrorMsg("Target completion date must be on or after the learning start date.");
            hasError = true;
        }
        if (hasError) return;
        if (course && selectedEmployees.length > (course.availableSeats ?? 4)) {
            setToast({
                isOpen: true,
                message: `Cannot assign course: Course license capacity is limited to 4 members. Only ${course.availableSeats ?? 0} seat(s) available.`,
                type: "error",
            });
            return;
        }
        setIsCourseError(false);
        setIsEmployeeError(false);
        setIsStartDateError(false);
        setIsTargetDateError(false);
        const cleanNote = normalizeSingleSpacing(note, { trimEdges: true }).slice(0, maxChars);
        const { skipped } = await runWithLock(async (idemKey) => {
            if (onAssign) {
                await onAssign({ course, employees: selectedEmployees, startDate, targetDate, note: cleanNote, idempotencyKey: idemKey });
            }
        });
        if (!skipped) {
            onClose();
        }
    };

    const availableSeatsRemaining = Math.max(0, (course?.availableSeats ?? 4) - selectedEmployees.length);
    const todayStr = getTodayStr();

    return (
        <>
            <TopToastNotification
                isOpen={toast.isOpen}
                type={toast.type}
                message={toast.message}
                duration={5000}
                onClose={() => setToast((prev) => ({ ...prev, isOpen: false }))}
            />
            <div className="ld-cm-modal-overlay">
                <div className="ld-cm-assign-modal-card" onClick={(e) => e.stopPropagation()}>
                    {/* Close button */}
                    <button
                        type="button"
                        className="ld-cm-assign-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>

                    {/* Header */}
                    <div className="ld-cm-assign-header">
                        <h2 className="ld-cm-assign-title">Assign Course</h2>
                        <p className="ld-cm-assign-subtitle">
                            Assign a purchased course to one or more employees.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="ld-cm-assign-form" noValidate>
                        <div className="ld-cm-assign-form-body">
                            {/* Select Course */}
                            <div className="ld-cm-assign-field-group">
                                <label className="ld-cm-assign-label">
                                    Select Course <span className="required">*</span>
                                </label>
                                <CourseModalDropdown
                                    value={selectedCourseId}
                                    options={coursesList.map((c) => ({ value: c.id, label: c.title }))}
                                    onChange={(val) => {
                                        setSelectedCourseId(val);
                                        setIsCourseError(false);
                                        setSelectedEmployees([]);
                                        setEmpSearchTerm("");
                                    }}
                                    placeholder="Select a course"
                                    triggerHeight={34}
                                    required
                                    searchable={true}
                                    searchPlaceholder="Search course by title..."
                                    hasError={isCourseError}
                                />
                                {isCourseError && (
                                    <span className="ld-cm-assign-error-text">This field is required</span>
                                )}
                            </div>

                            {/* Course Details Card (Matching Figma UI/UX - only shown when course selected) */}
                            {course && (
                                <div className="ld-cm-assign-course-card">
                                    {/* Course meta info */}
                                    <div className="ld-cm-assign-course-info">
                                        <span className="ld-cm-assign-course-name">
                                            {course?.title || "—"}
                                        </span>
                                        <div className="ld-cm-assign-meta-row">
                                            <span className="ld-cm-assign-meta-label">Provider</span>
                                            <span className="ld-cm-assign-meta-value">{course?.provider || "—"}</span>
                                        </div>
                                        <div className="ld-cm-assign-meta-row">
                                            <span className="ld-cm-assign-meta-label">Category</span>
                                            <span className="ld-cm-assign-meta-value">{course?.category || "—"}</span>
                                        </div>
                                        <div className="ld-cm-assign-meta-row">
                                            <span className="ld-cm-assign-meta-label">Duration</span>
                                            <span className="ld-cm-assign-meta-value">{course?.duration || "—"}</span>
                                        </div>
                                    </div>

                                    {/* Vertical divider */}
                                    <div className="ld-cm-assign-divider" />

                                    {/* Right: Account Usage + Available Seats */}
                                    <div className="ld-cm-assign-usage-col">
                                        <div className="ld-cm-assign-usage-metric">
                                            <span className="ld-cm-assign-usage-label">Account Usage</span>
                                            <span className="ld-cm-assign-usage-val">
                                                {course.occupiedSeats !== undefined ? `${course.occupiedSeats}/4` : (course.accountUsage || "0/4")}
                                            </span>
                                            <div className="ld-cm-assign-progress-bar">
                                                <div
                                                    className="ld-cm-assign-progress-fill"
                                                    style={{ width: `${course.usagePercent ?? 0}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="ld-cm-assign-usage-metric">
                                            <span className="ld-cm-assign-usage-label">Available Seats</span>
                                            <span
                                                className="ld-cm-assign-seats-val"
                                                style={{
                                                    color: (course.availableSeats ?? 4) === 0 ? "#EF4444" : "#16A34A",
                                                }}
                                            >
                                                {course.availableSeats ?? 4}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Select Employees */}
                            <div className="ld-cm-assign-field-group">
                                <label className="ld-cm-assign-label">
                                    Select Employees <span className="required" style={{ color: "#EF4444" }}>*</span>
                                </label>
                                <div className="ld-cm-assign-multiselect-wrap" ref={empDropdownRef} style={{ position: "relative" }}>
                                    <div
                                        className={`ld-cm-assign-multiselect ${isEmployeeError ? "has-error" : ""}`}
                                        onClick={() => {
                                            setShowEmpDropdown(true);
                                            empInputRef.current?.focus();
                                        }}
                                    >
                                        {selectedEmployees.map((emp) => (
                                            <span key={emp.id} className="ld-cm-assign-tag">
                                                {emp.name} ({emp.code})
                                                <button
                                                    type="button"
                                                    className="ld-cm-assign-tag-del"
                                                    onClick={(e) => removeEmployee(emp.id, e)}
                                                    title="Remove employee"
                                                >
                                                    <X size={12} strokeWidth={2.5} />
                                                </button>
                                            </span>
                                        ))}
                                        <input
                                            ref={empInputRef}
                                            type="text"
                                            className="ld-cm-assign-emp-search-input"
                                            placeholder={
                                                selectedEmployees.length === 0
                                                    ? "Select employees to assign..."
                                                    : availableSeatsRemaining > 0
                                                        ? "Search by name, code or department..."
                                                        : ""
                                            }
                                            value={empSearchTerm}
                                            onChange={(e) => {
                                                setEmpSearchTerm(sanitizeSingleSpaceInput(e.target.value));
                                                if (!showEmpDropdown) setShowEmpDropdown(true);
                                            }}
                                            onFocus={() => {
                                                if (!showEmpDropdown) setShowEmpDropdown(true);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Backspace" && !empSearchTerm && selectedEmployees.length > 0) {
                                                    removeEmployee(selectedEmployees[selectedEmployees.length - 1].id, e);
                                                } else if (e.key === "Escape") {
                                                    setShowEmpDropdown(false);
                                                    setEmpSearchTerm("");
                                                }
                                            }}
                                            disabled={availableSeatsRemaining <= 0}
                                            autoComplete="off"
                                            spellCheck="false"
                                        />
                                        {selectedEmployees.length > 0 && (
                                            <button
                                                type="button"
                                                className="ld-cm-assign-emp-clear-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedEmployees([]);
                                                    setEmpSearchTerm("");
                                                    empInputRef.current?.focus();
                                                }}
                                                title="Clear all selected employees"
                                                style={{
                                                    position: "absolute",
                                                    right: 30,
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    background: "transparent",
                                                    border: "none",
                                                    padding: 2,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    color: "#94A3B8",
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                        <img
                                            src={dropdownIcon}
                                            alt=""
                                            className={`ld-cm-modal-dropdown-chevron ${showEmpDropdown ? "open" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowEmpDropdown((prev) => !prev);
                                                if (!showEmpDropdown) {
                                                    empInputRef.current?.focus();
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Dropdown menu - Directly under multiselect box, compact width, no inner search box */}
                                    {showEmpDropdown && (
                                        <div className="ld-cm-assign-emp-dropdown-menu" role="listbox">
                                            {filteredEmployees.length > 0 ? (
                                                filteredEmployees.map((emp) => {
                                                    const isSelected = selectedEmployees.some((item) => item.id === emp.id);
                                                    return (
                                                        <button
                                                            key={emp.id}
                                                            type="button"
                                                            className={`ld-cm-modal-dropdown-item ${isSelected ? "selected" : ""}`}
                                                            onClick={() => addEmployee(emp)}
                                                            role="option"
                                                            aria-selected={isSelected}
                                                            style={{
                                                                whiteSpace: "nowrap",
                                                                gap: 12,
                                                                cursor: isSelected ? "default" : "pointer",
                                                            }}
                                                        >
                                                            <span className="ld-cm-modal-dropdown-item-text">
                                                                {emp.name} ({emp.code}) — {emp.role} • {emp.department}
                                                            </span>
                                                            {isSelected ? (
                                                                <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 600, flexShrink: 0 }}>
                                                                    Selected
                                                                </span>
                                                            ) : (
                                                                <span style={{ width: 13, flexShrink: 0 }} />
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div style={{ padding: "12px 10px", fontSize: 11.5, color: "#64748B", textAlign: "center" }}>
                                                    {empSearchTerm
                                                        ? `No employees found matching "${empSearchTerm}"`
                                                        : "All eligible employees are already enrolled in this course."}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isEmployeeError ? (
                                    <span style={{ color: "#EF4444", fontSize: "11px", marginTop: "4px", display: "block", fontWeight: 400 }}>
                                        Please select at least one employee.
                                    </span>
                                ) : !course ? null : (course.availableSeats ?? 4) === 0 ? (
                                    <span className="ld-cm-assign-hint" style={{ color: "#EF4444", fontWeight: 500 }}>
                                        Course license capacity of 4 members has been reached. No seats available.
                                    </span>
                                ) : (
                                    <span className="ld-cm-assign-hint">
                                        You can assign up to {availableSeatsRemaining} more employee{availableSeatsRemaining > 1 ? "s" : ""}.
                                    </span>
                                )}
                            </div>

                            {/* Date Pickers (Grid with strict date constraints & custom EmpDatePicker UI) */}
                            <div className="ld-cm-assign-date-grid">
                                <div className="ld-cm-assign-field-group">
                                    <label className="ld-cm-assign-label">
                                        Learning Start Date <span className="required">*</span>
                                    </label>
                                    <EmpDatePicker
                                        id="assign-start-date"
                                        placeholder="dd/mm/yyyy"
                                        value={startDate}
                                        onChange={handleStartDateChange}
                                        min={todayStr}
                                        max="9999-12-31"
                                        hasError={isStartDateError}
                                    />
                                    {isStartDateError && (
                                        <span className="ld-cm-assign-error-text">This field is required</span>
                                    )}
                                </div>

                                <div className="ld-cm-assign-field-group">
                                    <label className="ld-cm-assign-label">
                                        Target Completion Date <span className="required">*</span>
                                    </label>
                                    <EmpDatePicker
                                        id="assign-target-date"
                                        placeholder="dd/mm/yyyy"
                                        value={targetDate}
                                        onChange={handleTargetDateChange}
                                        min={startDate || todayStr}
                                        max="9999-12-31"
                                        hasError={isTargetDateError}
                                    />
                                    {isTargetDateError && (
                                        <span className="ld-cm-assign-error-text">{targetDateErrorMsg}</span>
                                    )}
                                </div>
                            </div>

                            {/* Assignment Note */}
                            <div className="ld-cm-assign-field-group">
                                <label className="ld-cm-assign-label">
                                    Assignment Note <span className="optional">(Optional)</span>
                                </label>
                                <div className="ld-cm-assign-textarea-wrap">
                                    <textarea
                                        className="ld-cm-assign-textarea"
                                        placeholder="Add instructions or a note for the employee.."
                                        maxLength={maxChars}
                                        value={note}
                                        onKeyDown={handleSingleSpaceKeyDown}
                                        onChange={(e) => setNote(applySingleSpaceTextChange(e, maxChars))}
                                        onPaste={(e) => handleSingleSpacePaste(e, maxChars, setNote)}
                                        onBlur={() =>
                                            setNote((prev) =>
                                                normalizeSingleSpacing(prev, { trimEdges: true }).slice(0, maxChars)
                                            )
                                        }
                                        style={{ color: note.length > 0 ? "#080808" : undefined }}
                                    />
                                    <span className="ld-cm-assign-char-count">
                                        {note.length}/{maxChars}
                                    </span>
                                </div>
                            </div>

                        </div>

                        {/* Footer buttons */}
                        <div className="ld-cm-assign-footer">
                            <button
                                type="button"
                                className="ld-cm-assign-btn-cancel"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="ld-cm-assign-btn-submit"
                                disabled={isSubmitting}
                                style={isSubmitting ? { opacity: 0.7, cursor: "not-allowed" } : {}}
                            >
                                {isSubmitting ? "Assigning..." : "Assign Course"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
