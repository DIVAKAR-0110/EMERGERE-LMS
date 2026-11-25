import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import useCourseMetadata from "../../../hooks/useCourseMetadata";
import DrawerDropdownField, {
    toggleFilterMultiOption,
} from "../../common/DrawerDropdownField";
import "../../../styles/employee/CourseLibrary.css";

export default function ResourceFilterDrawer({
    isOpen,
    onClose,
    selectedCategories = ["All"],
    selectedFormats = ["All"],
    availableCategories = [],
    availableFormats = [],
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    // Draft local filter states for category and format
    const [draftCategories, setDraftCategories] = useState(selectedCategories);
    const [draftFormats, setDraftFormats] = useState(selectedFormats);

    const { categoryNames } = useCourseMetadata(undefined, isOpen);

    // Categories strictly from CourseCategories table
    const allCategoriesList = useMemo(() => {
        const map = new Map();
        (categoryNames || []).forEach((c) => {
            const trimmed = (c || "").trim();
            const key = trimmed.toUpperCase();
            if (key && key !== "OTHER" && key !== "OTHERS" && !map.has(key)) {
                map.set(key, trimmed);
            }
        });
        return Array.from(map.values());
    }, [categoryNames]);

    // Sync draft state whenever drawer opens
    useEffect(() => {
        if (isOpen) {
            setDraftCategories(selectedCategories?.length ? selectedCategories : ["All"]);
            setDraftFormats(selectedFormats?.length ? selectedFormats : ["All"]);
        }
    }, [isOpen, selectedCategories, selectedFormats]);

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
        setDraftFormats(["All"]);
        if (onClearAll) {
            onClearAll();
        }
    };

    const handleApplyInternal = () => {
        if (onApply) {
            onApply({
                categories: draftCategories,
                formats: draftFormats,
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    const isAllFormatsChecked = draftFormats.includes("All") || draftFormats.length === 0;

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
                ref={drawerRef}
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
                    {/* ── SECTION 1: CATEGORY DROPDOWN ── */}
                    <DrawerDropdownField
                        title="Category"
                        allLabel="All Categories"
                        searchPlaceholder="Search category..."
                        options={allCategoriesList}
                        selectedValues={draftCategories}
                        onToggleOption={(cat) =>
                            toggleFilterMultiOption(cat, draftCategories, setDraftCategories)
                        }
                        onClearField={() => setDraftCategories(["All"])}
                        showAllOption={false}
                    />

                    {/* ── SECTION 2: FORMATS ── */}
                    <div className="emp-filter-group">
                        <h4 className="emp-filter-group-heading">Format</h4>

                        <div className="emp-filter-options-list">
                            {availableFormats.length === 0 ? (
                                <div className="emp-filter-empty-note" style={{ fontSize: "12px", color: "#7F7F7F", padding: "4px 2px" }}>
                                    No formats available
                                </div>
                            ) : (
                                availableFormats.map((fmt) => {
                                    const fmtId = typeof fmt === "string" ? fmt : fmt.id;
                                    const fmtLabel = typeof fmt === "string" ? fmt : fmt.label;
                                    const isChecked = !isAllFormatsChecked && draftFormats.some((f) => f.toLowerCase() === fmtId.toLowerCase());
                                    return (
                                        <label key={fmtId} className="emp-filter-checkbox-row">
                                            <span
                                                className={`emp-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                onClick={() => toggleFilterMultiOption(fmtId, draftFormats, setDraftFormats)}
                                            >
                                                {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                            </span>
                                            <span
                                                className="emp-filter-checkbox-label"
                                                onClick={() => toggleFilterMultiOption(fmtId, draftFormats, setDraftFormats)}
                                            >
                                                {fmtLabel}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
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