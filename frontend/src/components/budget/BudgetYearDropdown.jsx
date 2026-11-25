import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export default function BudgetYearDropdown({
    value = "This Month",
    onChange,
    availableYears = [],
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const options = [
        "This Month",
        "Last Quarter",
        ...availableYears.filter((y) => y !== "This Month" && y !== "Last Quarter"),
    ];

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = (option) => {
        if (onChange) onChange(option);
        setIsOpen(false);
    };

    return (
        <div className="budget-fy-dropdown-anchor" ref={dropdownRef}>
            <button
                type="button"
                className={`budget-fy-selector ${isOpen ? "active" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <Calendar size={14} color="#64748B" />
                <span className="budget-fy-label">Year:</span>
                <span className="budget-fy-value">{value}</span>
                <ChevronDown
                    size={14}
                    className={`budget-fy-chevron ${isOpen ? "open" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="budget-fy-menu" role="listbox">
                    {options.map((opt) => {
                        const isSelected = opt === value;
                        return (
                            <div
                                key={opt}
                                className={`budget-fy-option ${isSelected ? "selected" : ""}`}
                                onClick={() => handleSelect(opt)}
                                role="option"
                                aria-selected={isSelected}
                            >
                                <span>{opt}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
