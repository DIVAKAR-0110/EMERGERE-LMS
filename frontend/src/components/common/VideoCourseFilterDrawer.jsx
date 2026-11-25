import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Filter, ChevronDown } from "lucide-react";
import "../../styles/common/VideoCourseFilterDrawer.css";
import useCourseMetadata from "../../hooks/useCourseMetadata";
import CustomSelectDropdown from "./CustomSelectDropdown";

/**
 * VideoCourseFilterDrawer
 * Right-side slide-over drawer for filtering Video Courses by Category and Provider.
 */
export default function VideoCourseFilterDrawer({
    isOpen,
    onClose,
    selectedCategory = "All",
    selectedProvider = "All",
    onApply,
    onReset,
    courses = [],
}) {
    const { categoryNames, providerNames } = useCourseMetadata(undefined, isOpen);

    // Strictly active canonical names from CourseCategories & CourseProviders (excluding "Other")
    const availableCategories = useMemo(() => {
        const map = new Map();
        categoryNames.forEach((cat) => {
            const key = cat.trim().toUpperCase();
            if (key && key !== "OTHER" && key !== "OTHERS") map.set(key, cat.trim());
        });
        return Array.from(map.values());
    }, [categoryNames]);

    const availableProviders = useMemo(() => {
        const map = new Map();
        providerNames.forEach((prov) => {
            const key = prov.trim().toUpperCase();
            if (key && key !== "OTHER" && key !== "OTHERS") map.set(key, prov.trim());
        });
        return Array.from(map.values());
    }, [providerNames]);

    const [localCategory, setLocalCategory] = useState(selectedCategory);
    const [localProvider, setLocalProvider] = useState(selectedProvider);

    // Reset local state when opened with props, normalizing to canonical case
    useEffect(() => {
        if (isOpen) {
            const canonicalCat = availableCategories.find(
                (c) => c.toUpperCase() === (selectedCategory || "").toUpperCase()
            ) || selectedCategory || "All";

            const canonicalProv = availableProviders.find(
                (p) => p.toUpperCase() === (selectedProvider || "").toUpperCase()
            ) || selectedProvider || "All";

            setLocalCategory(canonicalCat);
            setLocalProvider(canonicalProv);
        }
    }, [isOpen, selectedCategory, selectedProvider, availableCategories, availableProviders]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Compute preview count based on local filters
    const previewCount = courses.filter((course) => {
        const cCat = (course.category || course.category_name || "").toUpperCase();
        const cProv = (course.provider || course.provider_name || "").toUpperCase();

        const matchesCategory =
            localCategory === "All" ||
            cCat === localCategory.toUpperCase();

        const matchesProvider =
            localProvider === "All" ||
            cProv === localProvider.toUpperCase();

        return matchesCategory && matchesProvider;
    }).length;

    const handleApply = () => {
        if (onApply) {
            onApply({
                category: localCategory,
                provider: localProvider,
            });
        }
        onClose();
    };

    const handleReset = () => {
        setLocalCategory("All");
        setLocalProvider("All");
        if (onReset) {
            onReset();
        }
        onClose();
    };

    const drawerContent = (
        <div className="vc-filter-drawer-overlay">
            <div
                className="vc-filter-drawer-container"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. HEADER */}
                <div className="vc-filter-drawer-header">
                    <div className="vc-filter-header-left">
                        <div className="vc-filter-icon-box">
                            <Filter size={18} />
                        </div>
                        <div>
                            <h3 className="vc-filter-title">Filter Courses</h3>
                            <p className="vc-filter-subtitle">Filter by Category and Provider from DB</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="vc-filter-drawer-close"
                        onClick={onClose}
                        aria-label="Close filters"
                        title="Close filters"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 2. BODY */}
                <div className="vc-filter-drawer-body">
                    {/* Category Section (from lms_course_categories) */}
                    <div className="vc-filter-section">
                        <div className="vc-filter-label">
                            <span>Course Category</span>
                            {localCategory !== "All" && (
                                <span className="vc-filter-active-pill">
                                    {localCategory}
                                </span>
                            )}
                        </div>

                        <CustomSelectDropdown
                            value={localCategory}
                            options={[
                                { value: "All", label: "All Categories" },
                                ...availableCategories.map((cat) => ({ value: cat, label: cat })),
                            ]}
                            onChange={(val) => setLocalCategory(val)}
                            height={36}
                        />

                        <span className="vc-filter-chips-label">Quick Select Category:</span>
                        <div className="vc-filter-chips">
                            <button
                                type="button"
                                className={`vc-filter-chip ${localCategory === "All" ? "active" : ""}`}
                                onClick={() => setLocalCategory("All")}
                            >
                                All
                            </button>
                            {availableCategories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`vc-filter-chip ${localCategory.toUpperCase() === cat.toUpperCase() ? "active" : ""}`}
                                    onClick={() => setLocalCategory(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Provider Section (from lms_course_providers) */}
                    <div className="vc-filter-section">
                        <div className="vc-filter-label">
                            <span>Course Provider</span>
                            {localProvider !== "All" && (
                                <span className="vc-filter-active-pill">
                                    {localProvider}
                                </span>
                            )}
                        </div>

                        <CustomSelectDropdown
                            value={localProvider}
                            options={[
                                { value: "All", label: "All Providers" },
                                ...availableProviders.map((prov) => ({ value: prov, label: prov })),
                            ]}
                            onChange={(val) => setLocalProvider(val)}
                            height={36}
                        />

                        <span className="vc-filter-chips-label">Quick Select Provider:</span>
                        <div className="vc-filter-chips">
                            <button
                                type="button"
                                className={`vc-filter-chip ${localProvider === "All" ? "active" : ""}`}
                                onClick={() => setLocalProvider("All")}
                            >
                                All
                            </button>
                            {availableProviders.map((prov) => (
                                <button
                                    key={prov}
                                    type="button"
                                    className={`vc-filter-chip ${localProvider.toUpperCase() === prov.toUpperCase() ? "active" : ""}`}
                                    onClick={() => setLocalProvider(prov)}
                                >
                                    {prov}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Match Count Summary */}
                    <div className="vc-filter-match-box">
                        <span className="vc-filter-match-text">
                            Courses available with this filter:
                        </span>
                        <span className="vc-filter-match-count">
                            {previewCount}
                        </span>
                    </div>
                </div>

                {/* 3. FOOTER */}
                <div className="vc-filter-drawer-footer">
                    <button
                        type="button"
                        className="vc-btn-filter-reset"
                        onClick={handleReset}
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        className="vc-btn-filter-apply"
                        onClick={handleApply}
                    >
                        Apply Filter
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
}
