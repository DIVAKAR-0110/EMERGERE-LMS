import React, { useState, useRef, useEffect } from "react";
import dropdownIcon from "../../../assets/coursemanagement/dropdown.svg";

export default function CourseFilterDropdown({
    value,
    options = [],
    onChange,
    placeholder = "Select...",
    width = 140,
    minMenuWidth = 180,
    align = "left",
    defaultValue,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef(null);
    const itemRefs = useRef([]);
    const searchTimeoutRef = useRef(null);

    const defaultVal = defaultValue || (options.length > 0 && typeof options[0] === "string" && options[0].startsWith("All") ? options[0] : placeholder);
    const isFiltered = Boolean(
        value &&
        value !== defaultVal &&
        value !== placeholder &&
        value !== "All" &&
        !String(value).startsWith("All ")
    );

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) {
            onChange(defaultVal);
        }
        setIsOpen(false);
    };

    // Close on click outside or Escape key
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery("");
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
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
        if (onChange) {
            onChange(optionValue);
        }
        setIsOpen(false);
        setSearchQuery("");
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

    const hasMoreThanFive = options.length > 5;

    return (
        <div
            ref={dropdownRef}
            className="ld-cm-custom-dropdown-container"
            onKeyDown={handleKeyDown}
        >
            {/* Trigger Button */}
            <button
                type="button"
                className={`ld-cm-custom-dropdown-trigger ${isOpen ? "open" : ""} ${isFiltered ? "filtered" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="ld-cm-custom-dropdown-text" title={value || placeholder}>
                    {value || placeholder}
                </span>
                {isFiltered ? (
                    <span
                        className="ld-cm-filter-clear-cross"
                        onClick={handleClear}
                        title={`Clear ${value || placeholder}`}
                    >
                        ×
                    </span>
                ) : (
                    <img
                        src={dropdownIcon}
                        alt=""
                        className={`ld-cm-custom-dropdown-chevron ${isOpen ? "open" : ""}`}
                    />
                )}
            </button>

            {/* Dropdown Menu with Vertical Scrolling if > 5 items */}
            {isOpen && (
                <div
                    className={`ld-cm-custom-dropdown-menu ${align === "right" ? "align-right" : ""}`}
                    style={{
                        minWidth: minMenuWidth || width,
                        maxHeight: hasMoreThanFive ? 190 : "none",
                        overflowY: hasMoreThanFive ? "auto" : "visible",
                    }}
                    role="listbox"
                >
                    {options.map((opt, idx) => {
                        const optVal = typeof opt === "object" ? opt.value : opt;
                        const optLabel = typeof opt === "object" ? opt.label : opt;
                        const isSelected = value === optVal;
                        const isHighlighted = highlightedIndex === idx;

                        return (
                            <div
                                key={`${String(optVal)}-${idx}`}
                                ref={(el) => (itemRefs.current[idx] = el)}
                                className={`ld-cm-custom-dropdown-item ${isSelected ? "selected" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                                onClick={() => handleSelect(optVal)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                role="option"
                                aria-selected={isSelected}
                                title={optLabel}
                            >
                                <span className="ld-cm-custom-dropdown-item-text">{optLabel}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
