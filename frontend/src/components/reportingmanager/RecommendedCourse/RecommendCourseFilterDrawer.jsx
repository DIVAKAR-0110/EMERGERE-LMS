import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import DrawerDropdownField, { toggleFilterMultiOption } from "../../common/DrawerDropdownField";
import "../../../styles/reportingmanager/RecommendCourse.css";

export default function RecommendCourseFilterDrawer({
    isOpen,
    onClose,
    selectedCategories = ["All"],
    selectedPlatforms = ["All"],
    availableCategories = [],
    availablePlatforms = [],
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    // Staged draft filter states for user selection before clicking "Apply Filter"
    const [draftCategories, setDraftCategories] = useState(selectedCategories);
    const [draftPlatforms, setDraftPlatforms] = useState(selectedPlatforms);

    // Sync draft states when drawer opens
    useEffect(() => {
        if (isOpen) {
            setDraftCategories(selectedCategories?.length ? selectedCategories : ["All"]);
            setDraftPlatforms(selectedPlatforms?.length ? selectedPlatforms : ["All"]);
        }
    }, [isOpen, selectedCategories, selectedPlatforms]);

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
        setDraftPlatforms(["All"]);
        if (onClearAll) {
            onClearAll();
        }
    };

    const handleApplyInternal = () => {
        if (onApply) {
            onApply({
                categories: draftCategories,
                platforms: draftPlatforms,
            });
        }
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="rm-filter-drawer-root">
            {/* Blurred semi-transparent backdrop (DOES NOT close on click; only X icon closes) */}
            <div
                className="rm-filter-drawer-backdrop"
                aria-hidden="true"
            />

            {/* Right side drawer panel */}
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
                    {/* ── 1. CATEGORY DROPDOWN ── */}
                    <DrawerDropdownField
                        title="Category"
                        allLabel="All Categories"
                        searchPlaceholder="Search category..."
                        options={availableCategories}
                        selectedValues={draftCategories}
                        onToggleOption={(cat) =>
                            toggleFilterMultiOption(cat, draftCategories, setDraftCategories)
                        }
                        onClearField={() => setDraftCategories(["All"])}
                        showAllOption={false}
                    />

                    {/* ── 2. PLATFORM (PROVIDER) DROPDOWN ── */}
                    <DrawerDropdownField
                        title="Platform"
                        allLabel="All Platforms"
                        searchPlaceholder="Search platform..."
                        options={availablePlatforms}
                        selectedValues={draftPlatforms}
                        onToggleOption={(p) =>
                            toggleFilterMultiOption(p, draftPlatforms, setDraftPlatforms)
                        }
                        onClearField={() => setDraftPlatforms(["All"])}
                        showAllOption={false}
                    />
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
