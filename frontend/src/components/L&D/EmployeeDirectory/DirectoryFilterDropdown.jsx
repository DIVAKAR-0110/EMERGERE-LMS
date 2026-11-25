import React, { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import downArrowIcon from "../../../assets/Daily_Learning_Log/down_arrow.svg";

export default function DirectoryFilterDropdown({
    value,
    options = [],
    onChange,
    placeholder = "Select...",
    align = "left",
    defaultValue,
    isMulti = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef(null);
    const itemRefs = useRef([]);
    const searchTimeoutRef = useRef(null);

    const defaultVal = defaultValue || (options.length > 0 && typeof options[0] === "string" && options[0].startsWith("All") ? options[0] : placeholder);

    const isAllSelected = (val) => {
        if (!val) return true;
        if (Array.isArray(val)) {
            return (
                val.length === 0 ||
                val.includes(defaultVal) ||
                val.includes("All") ||
                val.includes(placeholder) ||
                val.includes("All Departments")
            );
        }
        return val === defaultVal || val === "All" || val === placeholder || val === "All Departments";
    };

    const isFiltered = isMulti
        ? !isAllSelected(value)
        : Boolean(
            value &&
            value !== defaultVal &&
            value !== placeholder &&
            value !== "All" &&
            !String(value).startsWith("All ")
        );

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) {
            onChange(isMulti ? [defaultVal] : defaultVal);
        }
        setIsOpen(false);
    };

    // Close dropdown on click outside or Escape key
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery("");
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("touchstart", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [isOpen]);

    // Set initial highlighted index on open
    useEffect(() => {
        if (isOpen) {
            const idx = options.findIndex((opt) => {
                const optVal = typeof opt === "object" ? opt.value : opt;
                return optVal === value;
            });
            const targetIdx = idx >= 0 ? idx : 0;
            setHighlightedIndex(targetIdx);
            if (idx >= 0 && itemRefs.current[idx]) {
                itemRefs.current[idx].scrollIntoView({ block: "nearest" });
            }
        } else {
            setSearchQuery("");
        }
    }, [isOpen, value, options]);

    const scrollToIndex = (idx) => {
        if (itemRefs.current[idx]) {
            itemRefs.current[idx].scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            });
        }
    };

    const handleSelect = (optionValue) => {
        if (!isMulti) {
            if (onChange) {
                if (value === optionValue) {
                    onChange(defaultVal);
                } else {
                    onChange(optionValue);
                }
            }
            setIsOpen(false);
            setSearchQuery("");
            return;
        }

        // Multi-select mode
        const isDefault =
            optionValue === defaultVal ||
            optionValue === "All" ||
            optionValue === placeholder ||
            optionValue === "All Departments";

        if (isDefault) {
            if (onChange) onChange([defaultVal]);
            return;
        }

        const currentSelected = Array.isArray(value)
            ? value.filter(
                (v) =>
                    v !== defaultVal &&
                    v !== "All" &&
                    v !== placeholder &&
                    v !== "All Departments"
            )
            : [];

        const exists = currentSelected.some(
            (v) => String(v).trim().toLowerCase() === String(optionValue).trim().toLowerCase()
        );

        let nextSelected;
        if (exists) {
            nextSelected = currentSelected.filter(
                (v) => String(v).trim().toLowerCase() !== String(optionValue).trim().toLowerCase()
            );
            if (nextSelected.length === 0) {
                nextSelected = [defaultVal];
            }
        } else {
            nextSelected = [...currentSelected, optionValue];
        }

        if (onChange) {
            onChange(nextSelected);
        }
    };

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        if (e.key === "Escape") {
            e.preventDefault();
            setIsOpen(false);
            setSearchQuery("");
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                const opt = options[highlightedIndex];
                const optVal = typeof opt === "object" ? opt.value : opt;
                handleSelect(optVal);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIdx = highlightedIndex < options.length - 1 ? highlightedIndex + 1 : 0;
            setHighlightedIndex(nextIdx);
            scrollToIndex(nextIdx);
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIdx = highlightedIndex > 0 ? highlightedIndex - 1 : options.length - 1;
            setHighlightedIndex(prevIdx);
            scrollToIndex(prevIdx);
            return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const char = e.key.toLowerCase();
            const newQuery = searchQuery + char;
            setSearchQuery(newQuery);

            const matchIdx = options.findIndex((opt) => {
                const optLabel = typeof opt === "object" ? opt.label : String(opt);
                return String(optLabel).toLowerCase().startsWith(newQuery);
            });

            if (matchIdx !== -1) {
                setHighlightedIndex(matchIdx);
                scrollToIndex(matchIdx);
            } else {
                const fallbackIdx = options.findIndex((opt) => {
                    const optLabel = typeof opt === "object" ? opt.label : String(opt);
                    return String(optLabel).toLowerCase().startsWith(char);
                });
                if (fallbackIdx !== -1) {
                    setHighlightedIndex(fallbackIdx);
                    scrollToIndex(fallbackIdx);
                    setSearchQuery(char);
                }
            }

            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = setTimeout(() => {
                setSearchQuery("");
            }, 700);
        }
    };

    let displayLabel = placeholder;
    if (isMulti) {
        if (isAllSelected(value)) {
            displayLabel = placeholder;
        } else if (Array.isArray(value) && value.length === 1) {
            const opt = options.find((o) => (typeof o === "object" ? o.value : o) === value[0]);
            displayLabel = opt ? (typeof opt === "object" ? opt.label : opt) : value[0];
        } else if (Array.isArray(value) && value.length > 1) {
            displayLabel = `${value.length} selected`;
        }
    } else {
        const selectedOption = options.find(
            (opt) => (typeof opt === "object" ? opt.value : opt) === value
        );
        displayLabel = selectedOption
            ? typeof selectedOption === "object"
                ? selectedOption.label
                : selectedOption
            : value || placeholder;
    }

    return (
        <div ref={dropdownRef} className="ld-filter-select-wrapper" onKeyDown={handleKeyDown}>
            {/* Custom Trigger Button */}
            <button
                type="button"
                className={`ld-filter-select-btn ${isOpen ? "open" : ""} ${isFiltered ? "filtered" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="ld-filter-select-text" title={displayLabel}>
                    {displayLabel}
                </span>
                {isFiltered ? (
                    <span
                        className="ld-filter-clear-cross"
                        onClick={handleClear}
                        title={`Clear ${displayLabel}`}
                    >
                        ×
                    </span>
                ) : (
                    <img
                        src={downArrowIcon}
                        alt=""
                        className={`ld-select-chevron ${isOpen ? "open" : ""}`}
                    />
                )}
            </button>

            {/* Floating Dropdown Menu */}
            {isOpen && (
                <div
                    className={`ld-filter-dropdown-menu ${align === "right" ? "align-right" : ""}`}
                    role="listbox"
                >
                    {options
                        .filter((opt) => {
                            const optVal = typeof opt === "object" ? opt.value : opt;
                            return (
                                optVal !== defaultVal &&
                                optVal !== placeholder &&
                                optVal !== "All" &&
                                optVal !== "All Departments" &&
                                optVal !== "Departments" &&
                                optVal !== "Status"
                            );
                        })
                        .map((opt, idx) => {
                        const optVal = typeof opt === "object" ? opt.value : opt;
                        const optLabel = typeof opt === "object" ? opt.label : opt;
                        const isSelected = isMulti
                            ? (optVal === defaultVal || optVal === "All" || optVal === placeholder || optVal === "All Departments")
                                ? isAllSelected(value)
                                : Array.isArray(value) &&
                                  value.some((v) => String(v).trim().toLowerCase() === String(optVal).trim().toLowerCase())
                            : value === optVal;
                        const isHighlighted = highlightedIndex === idx;

                        return (
                            <div
                                key={`${String(optVal)}-${idx}`}
                                ref={(el) => (itemRefs.current[idx] = el)}
                                className={`ld-filter-dropdown-item ${isSelected ? "selected" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                                onClick={() => handleSelect(optVal)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                role="option"
                                aria-selected={isSelected}
                                title={optLabel}
                            >
                                {isMulti && (
                                    <span className={`ld-filter-checkbox ${isSelected ? "checked" : ""}`}>
                                        {isSelected && <Check size={10} strokeWidth={3} color="#FFFFFF" />}
                                    </span>
                                )}
                                <span className="ld-filter-dropdown-item-text">{optLabel}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
