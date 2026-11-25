import React, { useState, useRef, useEffect } from "react";
import downArrowIcon from "../../../assets/course_library/down_arrow.svg";

/**
 * EmpModalSelect
 * Sleek, modern custom UI dropdown matching RequestCourseModal CustomDropdown
 * in employee certification, reimbursement, and workshop modals.
 *
 * Props:
 * - value: string | number
 * - options: Array<string | { value: string | number, label: string }>
 * - onChange: (e: { target: { value: string | number } }) => void
 * - onBlur: () => void
 * - placeholder: string
 * - hasError: boolean
 * - disabled: boolean
 * - id: string
 * - className: string
 */
export default function EmpModalSelect({
    value,
    options = [],
    onChange,
    onBlur,
    placeholder = "Select...",
    hasError = false,
    disabled = false,
    id,
    className = "",
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDropUp, setIsDropUp] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef(null);
    const menuRef = useRef(null);
    const itemRefs = useRef([]);
    const searchTimeoutRef = useRef(null);

    // Auto-detect whether to drop up or drop down based on available space
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const estimatedHeight = Math.min(options.length * 30 + 12, 210);

            if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
                setIsDropUp(true);
            } else {
                setIsDropUp(false);
            }
        }
    }, [isOpen, options.length]);

    // Handle outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                if (isOpen) {
                    setIsOpen(false);
                    setSearchQuery("");
                    if (onBlur) onBlur();
                }
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onBlur]);

    // Set initial highlighted index when dropdown opens
    useEffect(() => {
        if (isOpen) {
            const idx = options.findIndex((opt) => {
                const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                return String(optVal) === String(value);
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

    const handleToggle = () => {
        if (disabled) return;
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (!nextState) {
            setSearchQuery("");
            if (onBlur) onBlur();
        }
    };

    const handleSelect = (optionValue) => {
        if (disabled) return;
        setIsOpen(false);
        setSearchQuery("");
        if (onChange) {
            onChange({ target: { value: optionValue } });
        }
    };

    // Keyboard typeahead search & Arrow navigation
    const handleKeyDown = (e) => {
        if (disabled) return;

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
            if (onBlur) onBlur();
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                const opt = options[highlightedIndex];
                const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
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

        // Typeahead: User types letters to jump to matching option
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const char = e.key.toLowerCase();
            const newQuery = searchQuery + char;
            setSearchQuery(newQuery);

            const matchIdx = options.findIndex((opt) => {
                const optLabel = typeof opt === "object" && opt !== null ? opt.label : String(opt);
                return String(optLabel).toLowerCase().startsWith(newQuery);
            });

            if (matchIdx !== -1) {
                setHighlightedIndex(matchIdx);
                scrollToIndex(matchIdx);
            } else {
                const fallbackIdx = options.findIndex((opt) => {
                    const optLabel = typeof opt === "object" && opt !== null ? opt.label : String(opt);
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

    // Find display label for current value
    const selectedOption = options.find((opt) => {
        const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
        return String(optVal) === String(value);
    });

    const displayLabel = selectedOption
        ? (typeof selectedOption === "object" ? selectedOption.label : selectedOption)
        : "";

    return (
        <div
            ref={dropdownRef}
            className={`emp-modal-select-wrapper ${isOpen ? "open" : ""} ${className}`}
            id={id}
            onKeyDown={handleKeyDown}
        >
            {/* Custom Trigger */}
            <button
                type="button"
                className={`emp-modal-select-trigger ${isOpen ? "active" : ""} ${hasError ? "emp-form-input-error" : ""}`}
                onClick={handleToggle}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                disabled={disabled}
            >
                <span
                    className={`emp-modal-select-value ${!displayLabel ? "placeholder" : ""}`}
                    title={displayLabel || placeholder}
                >
                    {displayLabel || placeholder}
                </span>

                <img
                    src={downArrowIcon}
                    alt=""
                    className={`emp-modal-select-chevron ${isOpen ? "open" : ""}`}
                />
            </button>

            {/* Floating Dropdown Menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    className={`emp-modal-select-menu ${isDropUp ? "drop-up" : ""}`}
                    role="listbox"
                >
                    {options.map((opt, idx) => {
                        const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                        const optLabel = typeof opt === "object" && opt !== null ? opt.label : opt;
                        const isSelected = String(value) === String(optVal);
                        const isHighlighted = highlightedIndex === idx;
                        const isOther = String(optVal).toLowerCase() === "other";

                        return (
                            <div
                                key={`${String(optVal)}-${idx}`}
                                ref={(el) => (itemRefs.current[idx] = el)}
                                className={`emp-modal-select-item ${isSelected ? "selected" : ""} ${isHighlighted ? "is-highlighted" : ""} ${isOther ? "other-option" : ""}`}
                                onClick={() => handleSelect(optVal)}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                role="option"
                                aria-selected={isSelected}
                                title={String(optLabel)}
                            >
                                <span className="emp-modal-select-item-text">
                                    {optLabel}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
