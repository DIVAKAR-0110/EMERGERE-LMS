import React, { useState, useRef, useEffect } from "react";
import {
    Layers,
    ChevronDown,
    PieChart,
    BookOpen,
    Award,
    GraduationCap,
    Building2,
    CheckCircle2
} from "lucide-react";

export default function BudgetComponentsDropdown({
    activeCategory,
    currentView = "table",
    onSelectCategory,
    onSelectSummaryView,
    counts = {},
    amounts = {},
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Click outside listener to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const categories = [
        {
            key: "summary",
            title: "Spend Distribution Summary",
            shortLabel: "Summary",
            icon: PieChart,
            color: "#2563EB",
            count: "3 Streams",
            amountFormatted: amounts.summary || "₹0.00L",
        },
        {
            key: "courses",
            title: "Course Purchase History",
            shortLabel: "Courses",
            icon: BookOpen,
            color: "#2667F9",
            count: `${counts.courses || 0} Courses`,
            amountFormatted: amounts.courses || "₹0.00L",
        },
        {
            key: "certifications",
            title: "Certification Claims",
            shortLabel: "Certifications",
            icon: Award,
            color: "#31C27E",
            count: `${counts.certifications || 0} Claims`,
            amountFormatted: amounts.certifications || "₹0.00L",
        },
        {
            key: "workshops",
            title: "Workshops & Training",
            shortLabel: "Workshops",
            icon: GraduationCap,
            color: "#9E5DF9",
            count: `${counts.workshops || 0} Events`,
            amountFormatted: amounts.workshops || "₹0.00L",
        },
        {
            key: "departments",
            title: "Department Budgets",
            shortLabel: "Department",
            icon: Building2,
            color: "#FDAD33",
            count: `${counts.departments || 0} Depts`,
            amountFormatted: amounts.departments || "₹0.00L",
        },
    ];

    const handleSelect = (cat) => {
        if (cat.key === "summary") {
            if (onSelectSummaryView) onSelectSummaryView();
        } else {
            if (onSelectCategory) onSelectCategory(cat.key);
        }
        setIsOpen(false);
    };

    return (
        <div className="budget-components-dropdown-anchor" ref={dropdownRef}>
            <button
                type="button"
                className={`budget-components-btn ${isOpen ? "active" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
                title="Choose Budget Component Category"
                aria-expanded={isOpen}
            >
                <Layers size={14} className="budget-components-btn-icon" />
                <span>Components</span>
                <ChevronDown size={13} className={`budget-components-chevron ${isOpen ? "open" : ""}`} />
            </button>

            {isOpen && (
                <div className="budget-components-dropdown-menu">
                    <div className="budget-dropdown-header">
                        <span>Select Category</span>
                    </div>
                    {categories.map((cat) => {
                        const Icon = cat.icon;
                        const isCatActive = cat.key === "summary"
                            ? currentView === "summary"
                            : currentView === "table" && activeCategory === cat.key;

                        return (
                            <button
                                key={cat.key}
                                type="button"
                                className={`budget-dropdown-item ${isCatActive ? "active" : ""}`}
                                onClick={() => handleSelect(cat)}
                            >
                                <div className="budget-dropdown-item-left">
                                    <div
                                        className="budget-dropdown-icon-box"
                                        style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                                    >
                                        <Icon size={15} />
                                    </div>
                                    <div className="budget-dropdown-item-text">
                                        <span className="budget-dropdown-item-title">{cat.shortLabel}</span>
                                        <span className="budget-dropdown-item-sub">
                                            {cat.count}
                                        </span>
                                    </div>
                                </div>
                                {isCatActive && (
                                    <CheckCircle2 size={15} style={{ color: cat.color }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
