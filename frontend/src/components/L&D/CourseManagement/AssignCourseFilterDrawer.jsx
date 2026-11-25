import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import EmpDatePicker from "../../employee/Certification/EmpDatePicker";
import { sanitizeSingleSpaceInput } from "../../../utils/validationUtils";
import "../../../styles/reportingmanager/RecommendCourse.css";
import "../../../styles/reportingmanager/LearningRecords.css";
import "../../../styles/L&D/CourseManagement.css";

function DrawerDropdownField({
    title,
    allLabel,
    options = [],
    selectedValues = ["All"],
    onToggleOption,
    onClearField,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setIsTyping(false);
                setSearchTerm("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const isAllChecked =
        selectedValues.includes("All") ||
        selectedValues.includes(allLabel) ||
        selectedValues.length === 0;

    const normalizedOptions = useMemo(() => {
        const raw = Array.isArray(options) ? options : Array.from(options || []);
        return raw.filter((opt) => {
            const str = String(opt).trim().toLowerCase();
            return str !== "all" && str !== String(allLabel).trim().toLowerCase();
        });
    }, [options, allLabel]);

    // Live search filtered options
    const filteredOptions = isTyping && searchTerm.trim()
        ? normalizedOptions.filter((opt) =>
            String(opt).toLowerCase().includes(searchTerm.trim().toLowerCase())
        )
        : normalizedOptions;

    // Display text for the trigger button
    const getDisplayText = () => {
        if (isAllChecked) return allLabel;
        if (selectedValues.length === 1) return selectedValues[0];
        return `${selectedValues.length} selected`;
    };

    const handleInputChange = (e) => {
        const val = sanitizeSingleSpaceInput(e.target.value);
        setSearchTerm(val);
        setIsTyping(true);
        if (!isOpen) setIsOpen(true);
    };

    const handleInputFocus = () => {
        if (!isOpen) setIsOpen(true);
    };

    const handleInputClick = (e) => {
        e.stopPropagation();
        if (!isOpen) setIsOpen(true);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setSearchTerm("");
        setIsTyping(false);
        onClearField();
        inputRef.current?.focus();
    };

    const handleChevronClick = (e) => {
        e.stopPropagation();
        setIsOpen((prev) => !prev);
        if (isOpen) {
            setIsTyping(false);
            setSearchTerm("");
        } else {
            inputRef.current?.focus();
        }
    };

    return (
        <div className="rm-filter-group" ref={dropdownRef} style={{ position: "relative" }}>
            <h4 className="rm-filter-group-heading">{title}</h4>

            {/* Dropdown Trigger Box (Searchable Combobox) */}
            <div
                className={`rm-drawer-dropdown-trigger searchable ${!isAllChecked ? "filtered" : ""} ${isOpen ? "open" : ""}`}
                onClick={handleInputClick}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="rm-drawer-dropdown-input"
                    value={isOpen ? searchTerm : (getDisplayText() || "")}
                    placeholder={getDisplayText() || allLabel}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            setIsOpen(false);
                            setIsTyping(false);
                            setSearchTerm("");
                        } else if (e.key === "ArrowDown" && !isOpen) {
                            setIsOpen(true);
                        }
                    }}
                    autoComplete="off"
                    spellCheck="false"
                />

                <div className="rm-drawer-dropdown-actions" onClick={(e) => e.stopPropagation()}>
                    {(!isAllChecked || (isTyping && searchTerm)) && (
                        <span
                            className="rm-drawer-dropdown-clear-x"
                            title="Reset to All"
                            onClick={handleClear}
                        >
                            ×
                        </span>
                    )}
                    <ChevronDown
                        size={14}
                        className={`rm-drawer-dropdown-chevron ${isOpen ? "open" : ""}`}
                        onClick={handleChevronClick}
                    />
                </div>
            </div>

            {/* Dropdown Menu (Opens on click) */}
            {isOpen && (
                <div className="rm-drawer-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="rm-drawer-dropdown-list">
                        {/* Option Items */}
                        {filteredOptions.map((opt) => {
                            const isChecked =
                                !isAllChecked &&
                                selectedValues.some(
                                    (v) => String(v).toLowerCase() === String(opt).toLowerCase()
                                );
                            return (
                                <div
                                    key={opt}
                                    className={`rm-drawer-dropdown-item ${isChecked ? "selected" : ""}`}
                                    onClick={() => onToggleOption(opt)}
                                >
                                    <span className={`rm-filter-custom-checkbox ${isChecked ? "checked" : ""}`}>
                                        {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                    </span>
                                    <span className="rm-drawer-dropdown-item-label">{opt}</span>
                                </div>
                            );
                        })}

                        {filteredOptions.length === 0 && (
                            <div className="rm-drawer-dropdown-empty">No options found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AssignCourseFilterDrawer({
    isOpen,
    onClose,
    selectedDepartments = ["All"],
    selectedProviders = ["All"],
    selectedStatuses = ["All"],
    assignedStartDate = "",
    assignedEndDate = "",
    availableDepartments = [],
    availableProviders = [],
    availableStatuses = ["Assigned", "Not Started", "In Progress", "Completed", "Overdue"],
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    // Staged draft states
    const [draftDepartments, setDraftDepartments] = useState(selectedDepartments);
    const [draftProviders, setDraftProviders] = useState(selectedProviders);
    const [draftStatuses, setDraftStatuses] = useState(selectedStatuses);
    const [draftAssignedStartDate, setDraftAssignedStartDate] = useState(assignedStartDate);
    const [draftAssignedEndDate, setDraftAssignedEndDate] = useState(assignedEndDate);

    // Sync draft states when opened or external selection changes
    useEffect(() => {
        if (isOpen) {
            setDraftDepartments(selectedDepartments?.length ? selectedDepartments : ["All"]);
            setDraftProviders(selectedProviders?.length ? selectedProviders : ["All"]);
            setDraftStatuses(selectedStatuses?.length ? selectedStatuses : ["All"]);
            setDraftAssignedStartDate(assignedStartDate || "");
            setDraftAssignedEndDate(assignedEndDate || "");
        }
    }, [
        isOpen,
        selectedDepartments,
        selectedProviders,
        selectedStatuses,
        assignedStartDate,
        assignedEndDate,
    ]);

    // Handle Escape key & lock background body scroll
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    // Multi-select option toggle
    const handleToggleOption = (item, currentList, setter, allLabels = ["All"]) => {
        if (allLabels.includes(item) || item === "All") {
            setter(["All"]);
            return;
        }

        const withoutAll = currentList.filter((x) => !allLabels.includes(x) && x !== "All");
        const exists = withoutAll.some((x) => String(x).toLowerCase() === String(item).toLowerCase());

        let next;
        if (exists) {
            next = withoutAll.filter((x) => String(x).toLowerCase() !== String(item).toLowerCase());
            if (next.length === 0) {
                next = ["All"];
            }
        } else {
            next = [...withoutAll, item];
        }
        setter(next);
    };

    const handleClearAllInternal = () => {
        setDraftDepartments(["All"]);
        setDraftProviders(["All"]);
        setDraftStatuses(["All"]);
        setDraftAssignedStartDate("");
        setDraftAssignedEndDate("");
        if (onClearAll) {
            onClearAll();
        }
    };

    const handleApplyInternal = () => {
        if (onApply) {
            onApply({
                departments: draftDepartments,
                providers: draftProviders,
                statuses: draftStatuses,
                assignedStartDate: draftAssignedStartDate,
                assignedEndDate: draftAssignedEndDate,
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    const isAllStatusesChecked =
        draftStatuses.includes("All") ||
        draftStatuses.includes("All Status") ||
        draftStatuses.includes("All Statuses") ||
        draftStatuses.length === 0;

    return createPortal(
        <div className="rm-filter-drawer-root">
            {/* Blurred semi-transparent backdrop */}
            <div
                className="rm-filter-drawer-backdrop"
                onClick={onClose}
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
                <div
                    className="rm-filter-panel-body"
                    style={{ display: "flex", flexDirection: "column", gap: "18px" }}
                >
                    {/* ── 1. DEPARTMENT DROPDOWN ── */}
                    <DrawerDropdownField
                        title="Department"
                        allLabel="All Departments"
                        options={availableDepartments}
                        selectedValues={draftDepartments}
                        onToggleOption={(item) =>
                            handleToggleOption(item, draftDepartments, setDraftDepartments, ["All", "All Departments"])
                        }
                        onClearField={() => setDraftDepartments(["All"])}
                    />

                    {/* ── 2. COURSE PROVIDER DROPDOWN ── */}
                    <DrawerDropdownField
                        title="Course Provider"
                        allLabel="All Providers"
                        options={availableProviders}
                        selectedValues={draftProviders}
                        onToggleOption={(item) =>
                            handleToggleOption(item, draftProviders, setDraftProviders, ["All", "All Providers"])
                        }
                        onClearField={() => setDraftProviders(["All"])}
                    />

                    {/* ── 3. STATUS (CHECKBOX LIST - 2 COLUMNS) ── */}
                    <div className="rm-filter-group">
                        <h4 className="rm-filter-group-heading">Status</h4>

                        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                            <div className="rm-filter-options-list" style={{ flex: 1, minWidth: 0, gap: 10 }}>
                                <label className="rm-filter-checkbox-row" style={{ whiteSpace: "nowrap" }}>
                                    <span
                                        className={`rm-filter-custom-checkbox ${isAllStatusesChecked ? "checked" : ""}`}
                                        onClick={() =>
                                            handleToggleOption("All", draftStatuses, setDraftStatuses, ["All", "All Status", "All Statuses"])
                                        }
                                    >
                                        {isAllStatusesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                    </span>
                                    <span
                                        className="rm-filter-checkbox-label"
                                        onClick={() =>
                                            handleToggleOption("All", draftStatuses, setDraftStatuses, ["All", "All Status", "All Statuses"])
                                        }
                                    >
                                        All Status
                                    </span>
                                </label>

                                {availableStatuses.slice(0, 2).map((status) => {
                                    const isChecked =
                                        !isAllStatusesChecked &&
                                        draftStatuses.some(
                                            (s) => String(s).toLowerCase() === String(status).toLowerCase()
                                        );
                                    return (
                                        <label key={status} className="rm-filter-checkbox-row" style={{ whiteSpace: "nowrap" }}>
                                            <span
                                                className={`rm-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                onClick={() =>
                                                    handleToggleOption(status, draftStatuses, setDraftStatuses, ["All", "All Status", "All Statuses"])
                                                }
                                            >
                                                {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                            </span>
                                            <span
                                                className="rm-filter-checkbox-label"
                                                onClick={() =>
                                                    handleToggleOption(status, draftStatuses, setDraftStatuses, ["All", "All Status", "All Statuses"])
                                                }
                                            >
                                                {status}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="rm-filter-options-list" style={{ flex: 1, minWidth: 0, gap: 10 }}>
                                {availableStatuses.slice(2).map((status) => {
                                    const isChecked =
                                        !isAllStatusesChecked &&
                                        draftStatuses.some(
                                            (s) => String(s).toLowerCase() === String(status).toLowerCase()
                                        );
                                    return (
                                        <label key={status} className="rm-filter-checkbox-row" style={{ whiteSpace: "nowrap" }}>
                                            <span
                                                className={`rm-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                onClick={() =>
                                                    handleToggleOption(status, draftStatuses, setDraftStatuses, ["All", "All Status", "All Statuses"])
                                                }
                                            >
                                                {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                            </span>
                                            <span
                                                className="rm-filter-checkbox-label"
                                                onClick={() =>
                                                    handleToggleOption(status, draftStatuses, setDraftStatuses, ["All", "All Status", "All Statuses"])
                                                }
                                            >
                                                {status}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── 4. ASSIGNED DATE (STARTING DATE TO ENDING DATE) ── */}
                    <div className="rm-filter-group">
                        <div className="rm-filter-group-header-row">
                            <h4 className="rm-filter-group-heading">Assigned Date</h4>
                            {(draftAssignedStartDate || draftAssignedEndDate) && (
                                <button
                                    type="button"
                                    className="rm-filter-clear-link"
                                    onClick={() => {
                                        setDraftAssignedStartDate("");
                                        setDraftAssignedEndDate("");
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
                                    value={draftAssignedStartDate}
                                    onChange={(e) => setDraftAssignedStartDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>

                            <span className="rm-filter-date-separator">to</span>

                            <div className="rm-filter-date-field">
                                <span className="rm-filter-date-sublabel">Ending Date</span>
                                <EmpDatePicker
                                    value={draftAssignedEndDate}
                                    onChange={(e) => setDraftAssignedEndDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                    min={draftAssignedStartDate || undefined}
                                />
                            </div>
                        </div>
                    </div>
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
