import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import calIcon from "../../../assets/Certification/cal.svg";
import "../../../styles/employee/EmpDatePicker.css";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatToDisplay(dateStr, separator = "/") {
    if (!dateStr) return "";
    const parts = String(dateStr).split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return `${parts[2]}${separator}${parts[1]}${separator}${parts[0]}`;
        }
        return `${parts[0]}${separator}${parts[1]}${separator}${parts[2]}`;
    }
    return dateStr;
}

function toIsoString(year, month, day) {
    const y = String(year).padStart(4, "0");
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default function EmpDatePicker({
    value = "",
    onChange,
    onBlur,
    placeholder = "dd/mm/yyyy",
    min,
    max,
    hasError = false,
    disabled = false,
    className = "",
    id,
    dropUp: forcedDropUp,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDropUp, setIsDropUp] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState({});
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    const separator = placeholder.includes("-") ? "-" : "/";

    // Compute fixed viewport coordinates for Portal dropdown to prevent any clipping from parent overflow containers
    const updatePosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dropdownWidth = 250;
        const estimatedHeight = 265;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        const shouldDropUp = forcedDropUp !== undefined
            ? forcedDropUp
            : (spaceBelow < estimatedHeight && spaceAbove > spaceBelow);

        setIsDropUp(shouldDropUp);

        // Smart horizontal alignment: if trigger is on the right half of the screen, align dropdown right edge to trigger right edge
        let left = rect.left;
        if (rect.right - dropdownWidth >= 0 && (rect.left + dropdownWidth > window.innerWidth || rect.left > window.innerWidth / 2)) {
            left = rect.right - dropdownWidth;
        }

        // Keep inside viewport horizontal boundaries
        if (left < 8) left = 8;
        if (left + dropdownWidth > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - dropdownWidth - 8);
        }

        setDropdownStyle({
            position: "fixed",
            top: shouldDropUp ? undefined : `${rect.bottom + 4}px`,
            bottom: shouldDropUp ? `${window.innerHeight - rect.top + 4}px` : undefined,
            left: `${left}px`,
            width: `${dropdownWidth}px`,
            zIndex: 99999999,
        });
    }, [forcedDropUp]);

    // Recalculate position on open, window resize, and captured scroll events across all scrollable containers
    useEffect(() => {
        if (!isOpen) return;
        updatePosition();

        const handleScrollOrResize = () => {
            updatePosition();
        };

        window.addEventListener("resize", handleScrollOrResize);
        window.addEventListener("scroll", handleScrollOrResize, true);

        return () => {
            window.removeEventListener("resize", handleScrollOrResize);
            window.removeEventListener("scroll", handleScrollOrResize, true);
        };
    }, [isOpen, updatePosition]);

    // Formatted text in the input (DD-MM-YYYY)
    const [inputValue, setInputValue] = useState(() => formatToDisplay(value, placeholder.includes('-') ? '-' : '/'));

    // When value prop changes from outside, sync inputValue
    useEffect(() => {
        setInputValue(formatToDisplay(value, separator));
    }, [value]);

    // Parse value or default to current date
    const parsedDate = useMemo(() => {
        if (!value) return null;
        const parts = String(value).split("-");
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                return { year: y, month: m, day: d };
            }
        }
        return null;
    }, [value]);

    const today = useMemo(() => {
        const d = new Date();
        return {
            year: d.getFullYear(),
            month: d.getMonth(),
            day: d.getDate(),
            iso: toIsoString(d.getFullYear(), d.getMonth(), d.getDate()),
        };
    }, []);

    // Current viewing month and year in calendar
    const [viewYear, setViewYear] = useState(() => parsedDate?.year || today.year);
    const [viewMonth, setViewMonth] = useState(() => (parsedDate ? parsedDate.month : today.month));

    // When parsedDate changes, update view
    useEffect(() => {
        if (parsedDate) {
            setViewYear(parsedDate.year);
            setViewMonth(parsedDate.month);
        }
    }, [parsedDate]);

    // Click outside listener handling both container and portalled dropdown
    useEffect(() => {
        function handleOutsideClick(e) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                if (isOpen) {
                    setIsOpen(false);
                    if (onBlur) onBlur();
                }
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
        }
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [isOpen, onBlur]);

    // Manual typing handler with smart clamping (DD/MM/YYYY)
    const handleInputChange = (e) => {
        const nextVal = e.target.value;
        const isDeleting = nextVal.length < inputValue.length;

        let formatted = nextVal;
        if (!isDeleting) {
            const rawDigits = nextVal.replace(/\D/g, "");

            let dayPart = "";
            let monthPart = "";
            let yearPart = "";

            if (rawDigits.length > 0) {
                if (rawDigits.length === 1 && parseInt(rawDigits[0], 10) > 3) {
                    dayPart = "0" + rawDigits[0];
                } else if (rawDigits.length >= 2) {
                    let d = parseInt(rawDigits.slice(0, 2), 10);
                    if (d === 0) d = 1;
                    if (d > 31) d = 31;
                    dayPart = String(d).padStart(2, "0");
                } else {
                    dayPart = rawDigits.slice(0, 1);
                }
            }

            if (rawDigits.length >= 3) {
                const monthDigits = rawDigits.slice(2);
                if (monthDigits.length === 1 && parseInt(monthDigits[0], 10) > 1) {
                    monthPart = "0" + monthDigits[0];
                } else if (monthDigits.length >= 2) {
                    let m = parseInt(monthDigits.slice(0, 2), 10);
                    if (m === 0) m = 1;
                    if (m > 12) m = 12;
                    monthPart = String(m).padStart(2, "0");
                } else {
                    monthPart = monthDigits.slice(0, 1);
                }
            }

            if (rawDigits.length >= 5) {
                yearPart = rawDigits.slice(4, 8);
            }

            if (yearPart) {
                formatted = `${dayPart}${separator}${monthPart}${separator}${yearPart}`;
            } else if (monthPart) {
                formatted = `${dayPart}${separator}${monthPart}${monthPart.length === 2 ? separator : ""}`;
            } else if (dayPart) {
                formatted = `${dayPart}${dayPart.length === 2 ? separator : ""}`;
            } else {
                formatted = "";
            }
        }

        setInputValue(formatted);

        // When complete (DD/MM/YYYY = 10 chars):
        if (formatted.length === 10) {
            const parts = formatted.split(/[\/\-]/);
            if (parts.length === 3) {
                let d = parseInt(parts[0], 10);
                let m = parseInt(parts[1], 10);
                const y = parseInt(parts[2], 10);

                if (y >= 1900 && y <= 2099 && m >= 1 && m <= 12) {
                    const maxDays = new Date(y, m, 0).getDate();
                    if (d > maxDays) {
                        d = maxDays;
                        formatted = `${String(d).padStart(2, "0")}${separator}${String(m).padStart(2, "0")}${separator}${y}`;
                        setInputValue(formatted);
                    }
                    if (d >= 1 && d <= maxDays) {
                        const iso = toIsoString(y, m - 1, d);
                        if (onChange) {
                            onChange({ target: { value: iso } });
                        }
                        setViewYear(y);
                        setViewMonth(m - 1);
                    }
                }
            }
        } else if (formatted.trim() === "") {
            if (onChange) {
                onChange({ target: { value: "" } });
            }
        }
    };

    const handleInputBlur = (e) => {
        // If related target is inside container or portalled dropdown, ignore blur for now
        if (
            (containerRef.current && containerRef.current.contains(e.relatedTarget)) ||
            (dropdownRef.current && dropdownRef.current.contains(e.relatedTarget))
        ) {
            return;
        }

        // Revert to valid value if incomplete or invalid
        if (inputValue.length > 0 && inputValue.length < 10) {
            setInputValue(formatToDisplay(value, separator));
            if (!value && onChange) {
                onChange({ target: { value: "" } });
            }
        } else if (inputValue.length === 10) {
            const parts = inputValue.split(/[\/\-]/);
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            const maxDays = (y && m >= 1 && m <= 12) ? new Date(y, m, 0).getDate() : 0;
            if (isNaN(d) || isNaN(m) || isNaN(y) || y < 1900 || y > 2099 || m < 1 || m > 12 || d < 1 || d > maxDays) {
                setInputValue(formatToDisplay(value, separator));
                if (!value && onChange) {
                    onChange({ target: { value: "" } });
                }
            }
        }

        if (onBlur) onBlur();
    };

    // Navigation handlers
    const handlePrevMonth = (e) => {
        e.stopPropagation();
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const handleNextMonth = (e) => {
        e.stopPropagation();
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    // Calendar grid calculation
    const calendarCells = useMemo(() => {
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const cells = [];

        // Previous month padding days
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const m = viewMonth === 0 ? 11 : viewMonth - 1;
            const y = viewMonth === 0 ? viewYear - 1 : viewYear;
            const iso = toIsoString(y, m, d);
            cells.push({
                day: d,
                month: m,
                year: y,
                iso,
                isOutside: true,
            });
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const iso = toIsoString(viewYear, viewMonth, d);
            cells.push({
                day: d,
                month: viewMonth,
                year: viewYear,
                iso,
                isOutside: false,
            });
        }

        // Next month padding days to complete 35 or 42 cells (7-day rows)
        const totalRows = Math.ceil(cells.length / 7);
        const totalCells = totalRows * 7;
        const remaining = totalCells - cells.length;
        for (let d = 1; d <= remaining; d++) {
            const m = viewMonth === 11 ? 0 : viewMonth + 1;
            const y = viewMonth === 11 ? viewYear + 1 : viewYear;
            const iso = toIsoString(y, m, d);
            cells.push({
                day: d,
                month: m,
                year: y,
                iso,
                isOutside: true,
            });
        }

        return cells;
    }, [viewYear, viewMonth]);

    const isDateDisabled = (iso) => {
        if (min && iso < min) return true;
        if (max && iso > max) return true;
        return false;
    };

    const handleSelectDate = (iso) => {
        if (isDateDisabled(iso)) return;
        setInputValue(formatToDisplay(iso, separator));
        if (onChange) {
            onChange({ target: { value: iso } });
        }
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setInputValue("");
        if (onChange) {
            onChange({ target: { value: "" } });
        }
        setIsOpen(false);
    };

    const handleToday = (e) => {
        e.stopPropagation();
        if (!isDateDisabled(today.iso)) {
            handleSelectDate(today.iso);
        }
    };

    return (
        <div ref={containerRef} className={`emp-datepicker-wrapper ${className}`} id={id}>
            <div
                className={`emp-datepicker-trigger ${isOpen ? "is-open" : ""} ${hasError ? "has-error" : ""} ${disabled ? "is-disabled" : ""}`}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(true);
                        inputRef.current?.focus();
                    }
                }}
            >
                <img
                    src={calIcon}
                    alt="Open calendar"
                    className="emp-datepicker-icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) {
                            setIsOpen((prev) => !prev);
                        }
                    }}
                />
                <input
                    ref={inputRef}
                    type="text"
                    className="emp-datepicker-input"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleInputChange}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) {
                            setIsOpen(true);
                        }
                    }}
                    onFocus={() => {
                        if (!disabled) setIsOpen(true);
                    }}
                    onBlur={handleInputBlur}
                    disabled={disabled}
                    maxLength={10}
                />
            </div>

            {isOpen &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        className={`emp-datepicker-dropdown ${isDropUp ? "drop-up" : ""}`}
                        style={dropdownStyle}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="emp-datepicker-header">
                            <span className="emp-datepicker-title">
                                {MONTH_NAMES[viewMonth]} {viewYear}
                            </span>
                            <div className="emp-datepicker-nav-btns">
                                <button
                                    type="button"
                                    className="emp-datepicker-nav-btn"
                                    onClick={handlePrevMonth}
                                    title="Previous Month"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="emp-datepicker-nav-btn"
                                    onClick={handleNextMonth}
                                    title="Next Month"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Weekdays */}
                        <div className="emp-datepicker-weekdays">
                            {WEEKDAYS.map((w, idx) => (
                                <div key={idx} className="emp-datepicker-weekday">
                                    {w}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="emp-datepicker-grid">
                            {calendarCells.map((cell, idx) => {
                                const disabledDate = isDateDisabled(cell.iso);
                                const selected = value === cell.iso;
                                const isTodayDate = today.iso === cell.iso;

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`emp-datepicker-cell ${cell.isOutside ? "is-outside" : ""} ${
                                            selected ? "is-selected" : ""
                                        } ${isTodayDate ? "is-today" : ""} ${disabledDate ? "is-disabled" : ""}`}
                                        onClick={() => handleSelectDate(cell.iso)}
                                        disabled={disabledDate}
                                    >
                                        {cell.day}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="emp-datepicker-footer">
                            <button
                                type="button"
                                className="emp-datepicker-footer-btn clear-btn"
                                onClick={handleClear}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="emp-datepicker-footer-btn"
                                onClick={handleToday}
                                disabled={isDateDisabled(today.iso)}
                            >
                                Today
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
