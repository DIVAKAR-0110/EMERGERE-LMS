import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import EmpDatePicker from "../../employee/Certification/EmpDatePicker";
import DrawerDropdownField, { toggleFilterMultiOption } from "../../common/DrawerDropdownField";
import "../../../styles/reportingmanager/RecommendCourse.css";
import "../../../styles/reportingmanager/LearningRecords.css";
import "../../../styles/L&D/CourseManagement.css";

export default function CourseRequestsFilterDrawer({
    isOpen = false,
    onClose,
    departments = [],
    selectedDepartments = ["All"],
    selectedReqStartDate = "",
    selectedReqEndDate = "",
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    // Staged draft states
    const [draftDepartments, setDraftDepartments] = useState(selectedDepartments);
    const [draftReqStartDate, setDraftReqStartDate] = useState(selectedReqStartDate);
    const [draftReqEndDate, setDraftReqEndDate] = useState(selectedReqEndDate);

    // Sync state when opening
    useEffect(() => {
        if (isOpen) {
            setDraftDepartments(selectedDepartments?.length ? selectedDepartments : ["All"]);
            setDraftReqStartDate(selectedReqStartDate || "");
            setDraftReqEndDate(selectedReqEndDate || "");
        }
    }, [isOpen, selectedDepartments, selectedReqStartDate, selectedReqEndDate]);

    // Lock body scroll while drawer is open (filter closes ONLY when X icon is clicked)
    useEffect(() => {
        if (!isOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    const handleClearAllInternal = () => {
        setDraftDepartments(["All"]);
        setDraftReqStartDate("");
        setDraftReqEndDate("");
        onClearAll?.();
    };

    const handleApplyInternal = () => {
        onApply?.({
            departments: draftDepartments,
            reqStartDate: draftReqStartDate,
            reqEndDate: draftReqEndDate,
        });
        onClose?.();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="rm-filter-drawer-root">
            {/* Backdrop: closes ONLY via the top-right X button */}
            <div className="rm-filter-drawer-backdrop" aria-hidden="true" />
            <aside
                className="rm-filter-drawer-panel"
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Header */}
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

                {/* 2. Scrollable Body */}
                <div className="rm-filter-panel-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Department Dropdown */}
                    <DrawerDropdownField
                        title="Department"
                        allLabel="All Departments"
                        options={departments}
                        selectedValues={draftDepartments}
                        showAllOption={false}
                        onToggleOption={(item) =>
                            toggleFilterMultiOption(item, draftDepartments, setDraftDepartments)
                        }
                        onClearField={() => setDraftDepartments(["All"])}
                    />

                    {/* Request Date Range */}
                    <div className="rm-filter-group">
                        <div className="rm-filter-group-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 className="rm-filter-group-heading">Request Date</h4>
                            {(draftReqStartDate || draftReqEndDate) && (
                                <button
                                    type="button"
                                    className="rm-filter-clear-link"
                                    onClick={() => {
                                        setDraftReqStartDate("");
                                        setDraftReqEndDate("");
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
                                    value={draftReqStartDate}
                                    onChange={(e) => setDraftReqStartDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>

                            <span className="rm-filter-date-separator">to</span>

                            <div className="rm-filter-date-field">
                                <span className="rm-filter-date-sublabel">Ending Date</span>
                                <EmpDatePicker
                                    value={draftReqEndDate}
                                    onChange={(e) => setDraftReqEndDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                    min={draftReqStartDate || undefined}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Sticky Footer */}
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
