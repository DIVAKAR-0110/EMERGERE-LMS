import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import dropdownIcon from "../../../assets/coursemanagement/dropdown.svg";
import { sanitizeSingleSpaceInput } from "../../../utils/validationUtils";

/**
 * CourseModalDropdown
 * Sleek custom UI dropdown replacement for raw HTML <select> elements in modal forms,
 * matching RequestCourseModal CustomDropdown design language.
 * Supports inline live search directly in the input field when searchable={true}.
 *
 * Props:
 * - value: string | number
 * - options: Array<string | { value: string | number, label: string }>
 * - onChange: (newValue: string | number) => void
 * - placeholder: string
 * - required: boolean
 * - triggerHeight: number (default 30)
 * - disabled: boolean
 * - id: string
 * - dropUp: boolean (optional override)
 * - searchable: boolean (enables direct typing/search in the input field)
 * - searchPlaceholder: string (custom placeholder when searching)
 * - hasError: boolean
 * - compactMenu: boolean (hugs option width, eliminating dead right whitespace)
 * - menuWidth: string (optional explicit width override)
 */
export default function CourseModalDropdown({
    value,
    options = [],
    onChange,
    placeholder = "Select...",
    required = false,
    triggerHeight = "30px",
    disabled = false,
    id,
    dropUp: forcedDropUp,
    searchable = false,
    searchPlaceholder,
    hasError = false,
    compactMenu = true,
    menuWidth,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [autoDropUp, setAutoDropUp] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);
    const itemRefs = useRef([]);

    // Auto-detect if menu should open upwards when space below is limited
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const estimatedHeight = Math.min(options.length * 30 + 12, 210);

            if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
                setAutoDropUp(true);
            } else {
                setAutoDropUp(false);
            }
        }
    }, [isOpen, options.length]);

    const isDropUp = forcedDropUp !== undefined ? forcedDropUp : autoDropUp;

    // Filter options by search term if searchable is active and user is typing
    const filteredOptions = searchable && isTyping && searchTerm.trim()
        ? options.filter((opt) => {
            const optLabel = typeof opt === "object" && opt !== null ? opt.label : opt;
            return String(optLabel).toLowerCase().includes(searchTerm.trim().toLowerCase());
        })
        : options;

    // Close on click outside or Escape
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setIsTyping(false);
                setSearchTerm("");
            }
        }

        function handleKeyDown(event) {
            if (event.key === "Escape" && isOpen) {
                setIsOpen(false);
                setIsTyping(false);
                setSearchTerm("");
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    // Set initial highlighted index on open
    useEffect(() => {
        if (isOpen) {
            const idx = filteredOptions.findIndex((opt) => {
                const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                return String(optVal) === String(value);
            });
            const targetIdx = idx >= 0 ? idx : 0;
            setHighlightedIndex(targetIdx);
            if (idx >= 0 && itemRefs.current[idx]) {
                itemRefs.current[idx].scrollIntoView({ block: "nearest" });
            }
        }
    }, [isOpen, value, filteredOptions]);

    const scrollToIndex = (idx) => {
        if (itemRefs.current[idx]) {
            itemRefs.current[idx].scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            });
        }
    };

    const handleSelect = (optionValue) => {
        if (disabled) return;
        if (onChange) {
            onChange(optionValue);
        }
        setSearchTerm("");
        setIsTyping(false);
        setIsOpen(false);
    };

    // Keyboard navigation
    const handleTriggerKeyDown = (e) => {
        if (disabled) return;

        if (!isOpen) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                const opt = filteredOptions[highlightedIndex];
                const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                handleSelect(optVal);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIdx = highlightedIndex < filteredOptions.length - 1 ? highlightedIndex + 1 : 0;
            setHighlightedIndex(nextIdx);
            scrollToIndex(nextIdx);
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIdx = highlightedIndex > 0 ? highlightedIndex - 1 : filteredOptions.length - 1;
            setHighlightedIndex(prevIdx);
            scrollToIndex(prevIdx);
            return;
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

    const hasMoreThanFive = filteredOptions.length > 5;

    const handleClear = (e) => {
        e.stopPropagation();
        setSearchTerm("");
        setIsTyping(false);
        if (onChange) onChange("");
        if (!isOpen) setIsOpen(true);
        inputRef.current?.focus();
    };

    const handleInputChange = (e) => {
        const val = sanitizeSingleSpaceInput(e.target.value);
        setSearchTerm(val);
        setIsTyping(true);
        if (!isOpen) setIsOpen(true);
    };

    const handleInputFocus = () => {
        if (!disabled) {
            setIsOpen(true);
        }
    };

    const handleInputClick = (e) => {
        if (!disabled) {
            e.stopPropagation();
            if (!isOpen) setIsOpen(true);
        }
    };

    const handleChevronClick = (e) => {
        e.stopPropagation();
        if (disabled) return;
        setIsOpen((prev) => !prev);
        if (!isOpen && searchable) {
            inputRef.current?.focus();
        }
    };

    return (
        <div ref={dropdownRef} className="ld-cm-modal-dropdown-wrap" id={id} onKeyDown={handleTriggerKeyDown}>
            {/* Hidden input to support native HTML5 form required validation */}
            {required && (
                <input
                    tabIndex={-1}
                    autoComplete="off"
                    style={{
                        opacity: 0,
                        width: 0,
                        height: 0,
                        position: "absolute",
                        pointerEvents: "none",
                        bottom: 0,
                        left: "50%",
                    }}
                    value={value || ""}
                    required={required}
                    onChange={() => { }}
                />
            )}

            {/* Custom Trigger */}
            {searchable ? (
                /* Searchable Combobox Trigger: Direct typing in the input field */
                <div
                    className={`ld-cm-modal-dropdown-trigger searchable ${disabled ? "disabled" : ""} ${isOpen ? "open" : ""} ${!value && !searchTerm ? "placeholder" : ""} ${hasError ? "has-error" : ""}`}
                    style={triggerHeight ? { height: "30px" } : undefined}
                    onClick={handleInputClick}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        className="ld-cm-modal-dropdown-input"
                        value={isTyping ? searchTerm : (displayLabel || "")}
                        placeholder={placeholder || searchPlaceholder || "Select a course"}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setIsOpen(false);
                                setIsTyping(false);
                                setSearchTerm("");
                            } else if (e.key === "ArrowDown" && !isOpen) {
                                setIsOpen(true);
                            }
                        }}
                        disabled={disabled}
                        autoComplete="off"
                        spellCheck="false"
                    />
                    {(value || (isTyping && searchTerm)) && !disabled && (
                        <button
                            type="button"
                            className="ld-cm-modal-dropdown-clear-btn"
                            onClick={handleClear}
                            title="Clear selection"
                            aria-label="Clear selection"
                        >
                            <X size={12} color="#94A3B8" />
                        </button>
                    )}
                    <img
                        src={dropdownIcon}
                        alt=""
                        className={`ld-cm-modal-dropdown-chevron ${isOpen ? "open" : ""}`}
                        onClick={handleChevronClick}
                    />
                </div>
            ) : (
                /* Standard Dropdown Button Trigger for non-searchable dropdowns */
                <button
                    type="button"
                    className={`ld-cm-modal-dropdown-trigger ${disabled ? "disabled" : ""} ${isOpen ? "open" : ""} ${!value ? "placeholder" : ""} ${hasError ? "has-error" : ""}`}
                    style={triggerHeight ? { height: triggerHeight } : undefined}
                    onClick={() => !disabled && setIsOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    disabled={disabled}
                >
                    <span className={`ld-cm-modal-dropdown-text ${!value ? "placeholder" : ""}`} title={displayLabel || placeholder}>
                        {displayLabel || placeholder}
                    </span>
                    <img
                        src={dropdownIcon}
                        alt=""
                        className={`ld-cm-modal-dropdown-chevron ${isOpen ? "open" : ""}`}
                    />
                </button>
            )}

            {/* Custom Dropdown Menu with Vertical Scrolling */}
            {isOpen && (
                <div
                    className={`ld-cm-modal-dropdown-menu ${isDropUp ? "drop-up" : ""} ${compactMenu ? "compact" : ""}`}
                    style={menuWidth ? { width: menuWidth } : undefined}
                    role="listbox"
                >
                    {/* Scrollable Options List */}
                    <div
                        className="ld-cm-modal-dropdown-list"
                        style={{
                            maxHeight: hasMoreThanFive || searchable ? 190 : "none",
                        }}
                    >
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => {
                                const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                                const optLabel = typeof opt === "object" && opt !== null ? opt.label : opt;
                                const isSelected = String(value) === String(optVal);
                                const isHighlighted = highlightedIndex === idx;

                                return (
                                    <div
                                        key={`${String(optVal)}-${idx}`}
                                        ref={(el) => (itemRefs.current[idx] = el)}
                                        className={`ld-cm-modal-dropdown-item ${isSelected ? "selected" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                                        onClick={() => handleSelect(optVal)}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        role="option"
                                        aria-selected={isSelected}
                                        title={String(optLabel)}
                                    >
                                        <span className="ld-cm-modal-dropdown-item-text">
                                            {optLabel}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="ld-cm-modal-dropdown-empty">
                                No options found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
