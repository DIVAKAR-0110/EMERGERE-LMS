import React, { useState, useEffect, useRef, useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";
import { sanitizeSingleSpaceInput } from "../../utils/validationUtils";
import "../../styles/common/DrawerDropdownField.css";

/**
 * Shared multi-select toggle helper for filter drawers.
 * Selecting "All" resets to ["All"]; toggling off the last specific item falls back to ["All"].
 */
export function toggleFilterMultiOption(item, currentList, setter) {
    if (item === "All" || (typeof item === "string" && item.trim().toLowerCase().startsWith("all "))) {
        setter(["All"]);
        return;
    }

    const withoutAll = (currentList || []).filter(
        (x) => x !== "All" && !(typeof x === "string" && x.trim().toLowerCase().startsWith("all "))
    );
    const exists = withoutAll.some(
        (x) => String(x).toLowerCase() === String(item).toLowerCase()
    );

    if (exists) {
        const next = withoutAll.filter(
            (x) => String(x).toLowerCase() !== String(item).toLowerCase()
        );
        setter(next.length === 0 ? ["All"] : next);
        return;
    }

    setter([...withoutAll, item]);
}

/**
 * Searchable multi-select dropdown section for filter drawers.
 * Combobox input directly inside the trigger box.
 */
export default function DrawerDropdownField({
    title,
    allLabel,
    searchPlaceholder,
    options = [],
    selectedValues = ["All"],
    onToggleOption,
    onClearField,
    showAllOption = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setIsTyping(false);
                setSearchTerm("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const isAllChecked =
        !selectedValues?.length ||
        selectedValues.includes("All") ||
        (typeof allLabel === "string" && selectedValues.includes(allLabel)) ||
        selectedValues.some(
            (v) => typeof v === "string" && v.trim().toLowerCase().startsWith("all ")
        );

    const normalizedOptions = useMemo(
        () => (Array.isArray(options) ? options : Array.from(options || []))
            .filter((opt) => {
                if (!opt) return false;
                const str = String(opt).trim().toLowerCase();
                const allStr = String(allLabel || "").trim().toLowerCase();
                return str !== "all" && str !== allStr && !str.startsWith("all ");
            }),
        [options, allLabel]
    );

    // Live search filtered options
    const filteredOptions = isTyping && searchTerm.trim()
        ? normalizedOptions.filter((opt) =>
            String(opt).toLowerCase().includes(searchTerm.trim().toLowerCase())
        )
        : normalizedOptions;

    const displayText = isAllChecked
        ? allLabel
        : selectedValues.length === 1
            ? selectedValues[0]
            : `${selectedValues.length} selected`;

    const handleInputChange = (e) => {
        const val = sanitizeSingleSpaceInput(e.target.value);
        setSearchTerm(val);
        setIsTyping(true);
        if (!isOpen) setIsOpen(true);
    };

    const handleInputFocus = () => {
        if (!isOpen) setIsOpen(true);
    };

    const handleInputClick = (e) => {
        e.stopPropagation();
        if (!isOpen) setIsOpen(true);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setSearchTerm("");
        setIsTyping(false);
        onClearField?.();
        inputRef.current?.focus();
    };

    const handleChevronClick = (e) => {
        e.stopPropagation();
        setIsOpen((prev) => !prev);
        if (isOpen) {
            setIsTyping(false);
            setSearchTerm("");
        } else {
            inputRef.current?.focus();
        }
    };

    return (
        <div className="emp-drawer-dropdown-group" ref={dropdownRef}>
            <h4 className="emp-drawer-dropdown-heading">{title}</h4>

            {/* Dropdown Trigger Box (Searchable Combobox) */}
            <div
                className={`emp-drawer-dropdown-trigger searchable ${!isAllChecked ? "filtered" : ""} ${isOpen ? "open" : ""}`}
                onClick={handleInputClick}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="emp-drawer-dropdown-input"
                    value={isOpen ? searchTerm : (displayText || "")}
                    placeholder={displayText || allLabel}
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
                    autoComplete="off"
                    spellCheck="false"
                />

                <div
                    className="emp-drawer-dropdown-actions"
                    onClick={(e) => e.stopPropagation()}
                >
                    {(!isAllChecked || (isTyping && searchTerm)) && (
                        <span
                            className="emp-drawer-dropdown-clear-x"
                            title="Reset to All"
                            onClick={handleClear}
                        >
                            ×
                        </span>
                    )}
                    <ChevronDown
                        size={14}
                        className={`emp-drawer-dropdown-chevron ${isOpen ? "open" : ""}`}
                        onClick={handleChevronClick}
                    />
                </div>
            </div>

            {isOpen && (
                <div
                    className="emp-drawer-dropdown-menu"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="emp-drawer-dropdown-list">
                        {showAllOption && (!isTyping || !searchTerm.trim()) && (
                            <div
                                className={`emp-drawer-dropdown-item ${isAllChecked ? "selected" : ""}`}
                                onClick={() => onToggleOption("All")}
                            >
                                <span
                                    className={`emp-drawer-dropdown-checkbox ${isAllChecked ? "checked" : ""}`}
                                >
                                    {isAllChecked && (
                                        <Check size={12} strokeWidth={3} color="#FFFFFF" />
                                    )}
                                </span>
                                <span className="emp-drawer-dropdown-item-label">
                                    {allLabel}
                                </span>
                            </div>
                        )}

                        {filteredOptions.map((opt) => {
                            const isChecked =
                                !isAllChecked &&
                                selectedValues.some(
                                    (v) =>
                                        String(v).toLowerCase() ===
                                        String(opt).toLowerCase()
                                );
                            return (
                                <div
                                    key={opt}
                                    className={`emp-drawer-dropdown-item ${isChecked ? "selected" : ""}`}
                                    onClick={() => onToggleOption(opt)}
                                >
                                    <span
                                        className={`emp-drawer-dropdown-checkbox ${isChecked ? "checked" : ""}`}
                                    >
                                        {isChecked && (
                                            <Check size={12} strokeWidth={3} color="#FFFFFF" />
                                        )}
                                    </span>
                                    <span className="emp-drawer-dropdown-item-label">
                                        {opt}
                                    </span>
                                </div>
                            );
                        })}

                        {filteredOptions.length === 0 && (
                            <div className="emp-drawer-dropdown-empty">
                                No options found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
