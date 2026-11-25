import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import EmpDatePicker from "../../employee/Certification/EmpDatePicker";
import DrawerDropdownField from "../../common/DrawerDropdownField";
import "../../../styles/reportingmanager/RecommendCourse.css";
import "../../../styles/reportingmanager/LearningRecords.css";

const COURSE_STATUSES = [
    "On track",
    "Excellent",
    "Low Progress",
    "Completed",
    "Not Started"
];

const CERT_STATUSES = [
    "Active",
    "Expiring Soon",
    "Expired"
];

export default function LearningRecordsFilterDrawer({
    isOpen,
    onClose,
    activeTab = "courses",
    selectedCourseDepartments = ["All"],
    selectedCourseCourses = ["All"],
    selectedCourseStatuses = ["All"],
    courseEnrollmentStartDate = "",
    courseEnrollmentEndDate = "",
    selectedCertDepartments = ["All"],
    selectedCertProviders = ["All"],
    selectedCertStatuses = ["All"],
    availableDepartments = [],
    availableCourses = [],
    availableProviders = [],
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    // Draft local states for Courses tab
    const [draftCourseDepts, setDraftCourseDepts] = useState(selectedCourseDepartments);
    const [draftCourseCourses, setDraftCourseCourses] = useState(selectedCourseCourses);
    const [draftCourseStatuses, setDraftCourseStatuses] = useState(selectedCourseStatuses);
    const [draftEnrollmentStartDate, setDraftEnrollmentStartDate] = useState(courseEnrollmentStartDate);
    const [draftEnrollmentEndDate, setDraftEnrollmentEndDate] = useState(courseEnrollmentEndDate);

    // Draft local states for Certification tab
    const [draftCertDepts, setDraftCertDepts] = useState(selectedCertDepartments);
    const [draftCertProviders, setDraftCertProviders] = useState(selectedCertProviders);
    const [draftCertStatuses, setDraftCertStatuses] = useState(selectedCertStatuses);

    // Sync draft state on open or tab change
    useEffect(() => {
        if (isOpen) {
            setDraftCourseDepts(selectedCourseDepartments?.length ? selectedCourseDepartments : ["All"]);
            setDraftCourseCourses(selectedCourseCourses?.length ? selectedCourseCourses : ["All"]);
            setDraftCourseStatuses(selectedCourseStatuses?.length ? selectedCourseStatuses : ["All"]);
            setDraftEnrollmentStartDate(courseEnrollmentStartDate || "");
            setDraftEnrollmentEndDate(courseEnrollmentEndDate || "");
            setDraftCertDepts(selectedCertDepartments?.length ? selectedCertDepartments : ["All"]);
            setDraftCertProviders(selectedCertProviders?.length ? selectedCertProviders : ["All"]);
            setDraftCertStatuses(selectedCertStatuses?.length ? selectedCertStatuses : ["All"]);
        }
    }, [
        isOpen,
        activeTab,
        selectedCourseDepartments,
        selectedCourseCourses,
        selectedCourseStatuses,
        courseEnrollmentStartDate,
        courseEnrollmentEndDate,
        selectedCertDepartments,
        selectedCertProviders,
        selectedCertStatuses,
    ]);

    // Lock background body scroll while drawer is open (no outside/backdrop or escape key dismiss)
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    // Generic multi-select option toggle
    const handleToggleOption = (item, currentList, setter, allLabels = ["All"]) => {
        if (allLabels.includes(item) || item === "All") {
            setter(["All"]);
            return;
        }

        const withoutAll = currentList.filter((x) => !allLabels.includes(x) && x !== "All");
        const exists = withoutAll.some((x) => x.toLowerCase() === item.toLowerCase());

        let next;
        if (exists) {
            next = withoutAll.filter((x) => x.toLowerCase() !== item.toLowerCase());
            if (next.length === 0) {
                next = ["All"];
            }
        } else {
            next = [...withoutAll, item];
        }
        setter(next);
    };

    const handleClearAllInternal = () => {
        if (activeTab === "courses") {
            setDraftCourseDepts(["All"]);
            setDraftCourseCourses(["All"]);
            setDraftCourseStatuses(["All"]);
            setDraftEnrollmentStartDate("");
            setDraftEnrollmentEndDate("");
        } else {
            setDraftCertDepts(["All"]);
            setDraftCertProviders(["All"]);
            setDraftCertStatuses(["All"]);
        }
        if (onClearAll) {
            onClearAll();
        }
    };

    const handleApplyInternal = () => {
        if (onApply) {
            onApply({
                courseDepartments: draftCourseDepts,
                courseCourses: draftCourseCourses,
                courseStatuses: draftCourseStatuses,
                courseEnrollmentStartDate: draftEnrollmentStartDate,
                courseEnrollmentEndDate: draftEnrollmentEndDate,
                certDepartments: draftCertDepts,
                certProviders: draftCertProviders,
                certStatuses: draftCertStatuses,
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    // Checked status checks
    const isAllCourseStatusesChecked = draftCourseStatuses.includes("All") || draftCourseStatuses.length === 0;
    const isAllCertStatusesChecked = draftCertStatuses.includes("All") || draftCertStatuses.length === 0;

    return createPortal(
        <div className="rm-filter-drawer-root">
            {/* Blurred semi-transparent backdrop (DOES NOT close on click; only X icon closes) */}
            <div
                className="rm-filter-drawer-backdrop"
                aria-hidden="true"
            />

            {/* Right side drawer panel with click bubbling prevention */}
            <aside
                className="rm-filter-drawer-panel"
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. HEADER */}
                <div className="rm-filter-panel-header">
                    <span className="rm-filter-panel-title">Filters</span>
                    <button
                        type="button"
                        className="rm-filter-panel-close-btn"
                        onClick={onClose}
                        aria-label="Close filters"
                        title="Close filters"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 2. SCROLLABLE FILTER CONTENT */}
                <div className="rm-filter-panel-body">
                    {activeTab === "courses" ? (
                        <>
                            {/* ── COURSES: SECTION 1 - DEPARTMENT DROPDOWN ── */}
                            <DrawerDropdownField
                                title="Department"
                                allLabel="All Departments"
                                searchPlaceholder="Search department..."
                                options={availableDepartments}
                                selectedValues={draftCourseDepts}
                                onToggleOption={(item) =>
                                    handleToggleOption(item, draftCourseDepts, setDraftCourseDepts, ["All", "All Departments"])
                                }
                                onClearField={() => setDraftCourseDepts(["All"])}
                                showAllOption={false}
                            />

                            {/* ── COURSES: SECTION 2 - COURSE DROPDOWN ── */}
                            <DrawerDropdownField
                                title="Course"
                                allLabel="All Courses"
                                searchPlaceholder="Search course..."
                                options={availableCourses}
                                selectedValues={draftCourseCourses}
                                onToggleOption={(item) =>
                                    handleToggleOption(item, draftCourseCourses, setDraftCourseCourses, ["All", "All Courses"])
                                }
                                onClearField={() => setDraftCourseCourses(["All"])}
                                showAllOption={false}
                            />

                            {/* ── COURSES: SECTION 3 - STATUS ── */}
                            <div className="rm-filter-group">
                                <h4 className="rm-filter-group-heading">Status</h4>

                                <div className="rm-filter-options-list rm-filter-options-grid-2col">
                                    <label className="rm-filter-checkbox-row">
                                        <span
                                            className={`rm-filter-custom-checkbox ${isAllCourseStatusesChecked ? "checked" : ""}`}
                                            onClick={() =>
                                                handleToggleOption("All", draftCourseStatuses, setDraftCourseStatuses, ["All", "All Statuses", "All Status"])
                                            }
                                        >
                                            {isAllCourseStatusesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span
                                            className="rm-filter-checkbox-label"
                                            onClick={() =>
                                                handleToggleOption("All", draftCourseStatuses, setDraftCourseStatuses, ["All", "All Statuses", "All Status"])
                                            }
                                        >
                                            All Status
                                        </span>
                                    </label>

                                    {COURSE_STATUSES.map((status) => {
                                        const isChecked = !isAllCourseStatusesChecked && draftCourseStatuses.some((s) => s.toLowerCase() === status.toLowerCase());
                                        return (
                                            <label key={status} className="rm-filter-checkbox-row">
                                                <span
                                                    className={`rm-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                    onClick={() =>
                                                        handleToggleOption(status, draftCourseStatuses, setDraftCourseStatuses, ["All", "All Statuses", "All Status"])
                                                    }
                                                >
                                                    {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                                </span>
                                                <span
                                                    className="rm-filter-checkbox-label"
                                                    onClick={() =>
                                                        handleToggleOption(status, draftCourseStatuses, setDraftCourseStatuses, ["All", "All Statuses", "All Status"])
                                                    }
                                                >
                                                    {status}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── COURSES: SECTION 4 - ENROLLMENT DATE (STARTING DATE TO ENDING DATE) ── */}
                            <div className="rm-filter-group">
                                <div className="rm-filter-group-header-row">
                                    <h4 className="rm-filter-group-heading">Enrollment Date</h4>
                                    {(draftEnrollmentStartDate || draftEnrollmentEndDate) && (
                                        <button
                                            type="button"
                                            className="rm-filter-clear-link"
                                            onClick={() => {
                                                setDraftEnrollmentStartDate("");
                                                setDraftEnrollmentEndDate("");
                                            }}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <div className="rm-filter-date-range-row">
                                    <div className="rm-filter-date-field">
                                        <span className="rm-filter-date-sublabel">Starting Date</span>
                                        <EmpDatePicker
                                            value={draftEnrollmentStartDate}
                                            onChange={(e) => setDraftEnrollmentStartDate(e.target.value)}
                                            placeholder="dd/mm/yyyy"
                                        />
                                    </div>

                                    <span className="rm-filter-date-separator">to</span>

                                    <div className="rm-filter-date-field">
                                        <span className="rm-filter-date-sublabel">Ending Date</span>
                                        <EmpDatePicker
                                            value={draftEnrollmentEndDate}
                                            onChange={(e) => setDraftEnrollmentEndDate(e.target.value)}
                                            placeholder="dd/mm/yyyy"
                                            min={draftEnrollmentStartDate || undefined}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* ── CERTIFICATION: SECTION 1 - DEPARTMENT DROPDOWN ── */}
                            <DrawerDropdownField
                                title="Department"
                                allLabel="All Departments"
                                searchPlaceholder="Search department..."
                                options={availableDepartments}
                                selectedValues={draftCertDepts}
                                onToggleOption={(item) => handleToggleOption(item, draftCertDepts, setDraftCertDepts)}
                                onClearField={() => setDraftCertDepts(["All"])}
                                showAllOption={false}
                            />

                            {/* ── CERTIFICATION: SECTION 2 - PROVIDER DROPDOWN ── */}
                            <DrawerDropdownField
                                title="Provider"
                                allLabel="All Providers"
                                searchPlaceholder="Search provider..."
                                options={availableProviders}
                                selectedValues={draftCertProviders}
                                onToggleOption={(item) => handleToggleOption(item, draftCertProviders, setDraftCertProviders)}
                                onClearField={() => setDraftCertProviders(["All"])}
                                showAllOption={false}
                            />

                            {/* ── CERTIFICATION: SECTION 3 - STATUS ── */}
                            <div className="rm-filter-group">
                                <h4 className="rm-filter-group-heading">Status</h4>

                                <div className="rm-filter-options-list">
                                    <label className="rm-filter-checkbox-row">
                                        <span
                                            className={`rm-filter-custom-checkbox ${isAllCertStatusesChecked ? "checked" : ""}`}
                                            onClick={() => handleToggleOption("All", draftCertStatuses, setDraftCertStatuses)}
                                        >
                                            {isAllCertStatusesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span
                                            className="rm-filter-checkbox-label"
                                            onClick={() => handleToggleOption("All", draftCertStatuses, setDraftCertStatuses)}
                                        >
                                            All Status
                                        </span>
                                    </label>

                                    {CERT_STATUSES.map((status) => {
                                        const isChecked = !isAllCertStatusesChecked && draftCertStatuses.some((s) => s.toLowerCase() === status.toLowerCase());
                                        return (
                                            <label key={status} className="rm-filter-checkbox-row">
                                                <span
                                                    className={`rm-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                    onClick={() => handleToggleOption(status, draftCertStatuses, setDraftCertStatuses)}
                                                >
                                                    {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                                </span>
                                                <span
                                                    className="rm-filter-checkbox-label"
                                                    onClick={() => handleToggleOption(status, draftCertStatuses, setDraftCertStatuses)}
                                                >
                                                    {status}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* 3. STICKY FOOTER */}
                <div className="rm-filter-panel-footer">
                    <button
                        type="button"
                        className="rm-filter-panel-clear-btn"
                        onClick={handleClearAllInternal}
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        className="rm-filter-panel-apply-btn"
                        onClick={handleApplyInternal}
                    >
                        Apply Filter
                    </button>
                </div>
            </aside>
        </div>,
        document.body
    );
}
