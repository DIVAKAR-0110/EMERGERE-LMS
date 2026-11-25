import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Filter, ChevronDown, Check } from "lucide-react";
import "../../styles/common/StudyMaterialFilterDrawer.css";
import CustomSelectDropdown from "./CustomSelectDropdown";

export const FILTER_MATERIAL_TYPES = [
    "PDF",
    "PPT",
    "PPTX",
    "EPUB",
    "MOBI",
];

/**
 * StudyMaterialFilterDrawer
 * Right-side slide-over drawer for filtering Study Materials by Material Type.
 */
export default function StudyMaterialFilterDrawer({
    isOpen,
    onClose,
    selectedType = "All",
    onApply,
    onReset,
    materials = [],
}) {
    // Local state inside drawer for pending changes before Apply
    const [localType, setLocalType] = useState(selectedType);

    useEffect(() => {
        if (isOpen) {
            setLocalType(selectedType || "All");
        }
    }, [isOpen, selectedType]);

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

    // Calculate preview count for local selection
    const previewCount = materials.filter((m) => {
        if (localType === "All") return true;
        const norm = (m.fileType || "").trim().toLowerCase();
        const file = (m.fileUrl || "").trim().toLowerCase();
        const target = localType.trim().toLowerCase();

        if (target === "pdf") {
            return norm.includes("pdf") || file.endsWith(".pdf");
        }
        if (target === "pptx") {
            return norm.includes("pptx") || file.endsWith(".pptx");
        }
        if (target === "ppt") {
            return norm.includes("ppt") || norm.includes("presentation") || file.endsWith(".ppt") || file.endsWith(".pptx");
        }
        if (target === "epub") {
            return norm.includes("epub") || norm.includes("ebook") || norm.includes("e-book") || file.endsWith(".epub");
        }
        if (target === "mobi") {
            return norm.includes("mobi") || file.endsWith(".mobi");
        }
        return norm === target || norm.includes(target);
    }).length;

    const handleApply = () => {
        if (onApply) {
            onApply(localType);
        }
        onClose();
    };

    const handleReset = () => {
        setLocalType("All");
        if (onReset) {
            onReset();
        }
        onClose();
    };

    const drawerContent = (
        <div className="sm-filter-drawer-overlay">
            <div
                className="sm-filter-drawer-container"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. HEADER */}
                <div className="sm-filter-drawer-header">
                    <div className="sm-filter-header-left">
                        <div className="sm-filter-icon-box">
                            <Filter size={17} />
                        </div>
                        <div>
                            <h3 className="sm-filter-title">Filter Materials</h3>
                            <p className="sm-filter-subtitle">Narrow down study resources by format</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sm-filter-drawer-close"
                        onClick={onClose}
                        aria-label="Close filters"
                        title="Close filters"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 2. BODY */}
                <div className="sm-filter-drawer-body">
                    {/* Material Type Section */}
                    <div className="sm-filter-section">
                        <div className="sm-filter-label">
                            <span>Material Type</span>
                            {localType !== "All" && (
                                <span className="sm-filter-active-indicator">
                                    Active: {localType}
                                </span>
                            )}
                        </div>

                        <CustomSelectDropdown
                            value={localType}
                            options={[
                                { value: "All", label: "All Formats (Default)" },
                                ...FILTER_MATERIAL_TYPES.map((type) => ({
                                    value: type,
                                    label: `${type} Document`,
                                })),
                            ]}
                            onChange={(val) => setLocalType(val)}
                            height={42}
                        />

                        {/* Quick Filter Tag Chips */}
                        <span className="sm-filter-chips-label">Quick Select:</span>
                        <div className="sm-filter-chips">
                            <button
                                type="button"
                                className={`sm-filter-chip ${localType === "All" ? "active" : ""}`}
                                onClick={() => setLocalType("All")}
                            >
                                All Types
                            </button>
                            {FILTER_MATERIAL_TYPES.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={`sm-filter-chip ${localType === type ? "active" : ""}`}
                                    onClick={() => setLocalType(type)}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Match Count Summary */}
                    <div className="sm-filter-match-box">
                        <span className="sm-filter-match-text">
                            Materials available with this filter:
                        </span>
                        <span className="sm-filter-match-count">
                            {previewCount}
                        </span>
                    </div>
                </div>

                {/* 3. FOOTER */}
                <div className="sm-filter-drawer-footer">
                    <button
                        type="button"
                        className="sm-btn-filter-reset"
                        onClick={handleReset}
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        className="sm-btn-filter-apply"
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
