import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import useCourseMetadata from "../../../hooks/useCourseMetadata";
import {
    createCourseCategory,
    createCourseProvider,
} from "../../../services/courseMetadataService";
import DrawerDropdownField, {
    toggleFilterMultiOption,
} from "../../common/DrawerDropdownField";
import "../../../styles/employee/CourseLibrary.css";

const DEFAULT_COURSE_STATUSES = [
    "In Progress",
    "Assigned",
    "Completed",
    "Pending",
    "Enroll Now",
    "Not Started",
    "On Hold",
];

export default function CourseFilterPopover({
    isOpen,
    onClose,
    selectedCategories = ["All"],
    selectedProviders = ["All"],
    selectedStatuses = ["All"],
    availableCategories = [],
    availableProviders = [],
    availableStatuses = DEFAULT_COURSE_STATUSES,
    onApply,
    onClearAll,
}) {
    const popoverRef = useRef(null);
    const { categoryNames, providerNames } = useCourseMetadata(undefined, isOpen);

    const mergedCategories = useMemo(() => {
        const map = new Map();
        (categoryNames || []).forEach((c) => {
            const clean = String(c || "").trim();
            const key = clean.toUpperCase();
            if (key && key !== "OTHER" && key !== "OTHERS" && !map.has(key)) map.set(key, clean);
        });
        return Array.from(map.values());
    }, [categoryNames]);

    const mergedProviders = useMemo(() => {
        const map = new Map();
        (providerNames || []).forEach((p) => {
            const clean = String(p || "").trim();
            const key = clean.toUpperCase();
            if (key && key !== "OTHER" && key !== "OTHERS" && !map.has(key)) map.set(key, clean);
        });
        return Array.from(map.values());
    }, [providerNames]);

    // Draft local filter states so user can pick options and then click "Apply Filter"
    const [draftCategories, setDraftCategories] = useState(selectedCategories);
    const [draftProviders, setDraftProviders] = useState(selectedProviders);
    const [draftStatuses, setDraftStatuses] = useState(selectedStatuses);

    // Sync draft states when drawer opens
    useEffect(() => {
        if (isOpen) {
            setDraftCategories(selectedCategories?.length ? selectedCategories : ["All"]);
            setDraftProviders(selectedProviders?.length ? selectedProviders : ["All"]);
            setDraftStatuses(selectedStatuses?.length ? selectedStatuses : ["All"]);
        }
    }, [isOpen, selectedCategories, selectedProviders, selectedStatuses]);

    // Lock background body scroll while drawer is open (no outside/backdrop or escape key dismiss)
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    const handleClearAllInternal = () => {
        setDraftCategories(["All"]);
        setDraftProviders(["All"]);
        setDraftStatuses(["All"]);
        if (onClearAll) {
            onClearAll();
        }
    };

    const handleApplyInternal = () => {
        if (onApply) {
            onApply({
                categories: draftCategories,
                providers: draftProviders,
                statuses: draftStatuses,
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    const isAllStatusesChecked =
        !draftStatuses?.length ||
        draftStatuses.includes("All") ||
        draftStatuses.includes("All Statuses");

    return createPortal(
        <div className="emp-filter-drawer-root">
            {/* Blurred semi-transparent backdrop (DOES NOT close on click; only X icon closes) */}
            <div
                className="emp-filter-drawer-backdrop"
                aria-hidden="true"
            />

            {/* Right side drawer panel */}
            <aside
                className="emp-filter-drawer-panel"
                ref={popoverRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. HEADER */}
                <div className="emp-filter-panel-header">
                    <span className="emp-filter-panel-title">Filters</span>
                    <button
                        type="button"
                        className="emp-filter-panel-close-btn"
                        onClick={onClose}
                        aria-label="Close filters"
                        title="Close filters"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 2. SCROLLABLE FILTER CONTENT */}
                <div className="emp-filter-panel-body">
                    {/* ── COURSE CATEGORY DROPDOWN ── */}
                    <DrawerDropdownField
                        title="Course Category"
                        allLabel="All Categories"
                        searchPlaceholder="Search category..."
                        options={mergedCategories}
                        selectedValues={draftCategories}
                        onToggleOption={(cat) =>
                            toggleFilterMultiOption(cat, draftCategories, setDraftCategories)
                        }
                        onClearField={() => setDraftCategories(["All"])}
                        showAllOption={false}
                    />

                    {/* ── COURSE PROVIDER DROPDOWN ── */}
                    <DrawerDropdownField
                        title="Course Provider"
                        allLabel="All Providers"
                        searchPlaceholder="Search provider..."
                        options={mergedProviders}
                        selectedValues={draftProviders}
                        onToggleOption={(prov) =>
                            toggleFilterMultiOption(prov, draftProviders, setDraftProviders)
                        }
                        onClearField={() => setDraftProviders(["All"])}
                        showAllOption={false}
                    />

                    {/* ── STATUS CHECKBOX LIST (2-COLUMN GRID) ── */}
                    <div className="emp-filter-group">
                        <h4 className="emp-filter-group-heading">Status</h4>

                        <div className="emp-filter-status-grid">
                            <label
                                className="emp-filter-checkbox-row"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setDraftStatuses(["All"]);
                                }}
                            >
                                <span className={`emp-filter-custom-checkbox ${isAllStatusesChecked ? "checked" : ""}`}>
                                    {isAllStatusesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                </span>
                                <span className="emp-filter-checkbox-label">
                                    All Statuses
                                </span>
                            </label>

                            {availableStatuses.map((status) => {
                                const isChecked =
                                    !isAllStatusesChecked &&
                                    draftStatuses.some(
                                        (s) => s.toLowerCase() === status.toLowerCase()
                                    );
                                return (
                                    <label
                                        key={status}
                                        className="emp-filter-checkbox-row"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            toggleFilterMultiOption(
                                                status,
                                                draftStatuses,
                                                setDraftStatuses
                                            );
                                        }}
                                    >
                                        <span className={`emp-filter-custom-checkbox ${isChecked ? "checked" : ""}`}>
                                            {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span className="emp-filter-checkbox-label">
                                            {status}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 3. STICKY FOOTER */}
                <div className="emp-filter-panel-footer">
                    <button
                        type="button"
                        className="emp-filter-panel-clear-btn"
                        onClick={handleClearAllInternal}
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        className="emp-filter-panel-apply-btn"
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
