import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import EmpDatePicker from "../../employee/Certification/EmpDatePicker";
import DrawerDropdownField, { toggleFilterMultiOption } from "../../common/DrawerDropdownField";
import DualRangeSlider from "../../common/DualRangeSlider";
import "../../../styles/reportingmanager/RecommendCourse.css";
import "../../../styles/reportingmanager/LearningRecords.css";
import "../../../styles/L&D/CourseManagement.css";

const DEFAULT_REIMB_STATUSES = ["Submitted to HR", "In Progress", "Paid", "Rejected"];

export default function ReimbursementFilterDrawer({
    isOpen = false,
    onClose,
    providers = [],
    selectedProviders = ["All"],
    statuses = DEFAULT_REIMB_STATUSES,
    selectedStatuses = ["All"],
    amountLimits = { min: 0, max: 1000, step: 100 },
    selectedAmountRange = null,
    selectedSubStartDate = "",
    selectedSubEndDate = "",
    selectedAppStartDate = "",
    selectedAppEndDate = "",
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    // Staged draft states
    const [draftProviders, setDraftProviders] = useState(selectedProviders);
    const [draftStatuses, setDraftStatuses] = useState(selectedStatuses);
    const [draftAmountRange, setDraftAmountRange] = useState(
        selectedAmountRange || [amountLimits.min, amountLimits.max]
    );
    const [draftSubStartDate, setDraftSubStartDate] = useState(selectedSubStartDate);
    const [draftSubEndDate, setDraftSubEndDate] = useState(selectedSubEndDate);
    const [draftAppStartDate, setDraftAppStartDate] = useState(selectedAppStartDate);
    const [draftAppEndDate, setDraftAppEndDate] = useState(selectedAppEndDate);

    // Sync state when opening
    useEffect(() => {
        if (isOpen) {
            setDraftProviders(selectedProviders?.length ? selectedProviders : ["All"]);
            setDraftStatuses(selectedStatuses?.length ? selectedStatuses : ["All"]);
            const safeRange =
                selectedAmountRange?.length === 2 && selectedAmountRange[1] <= amountLimits.max
                    ? selectedAmountRange
                    : [amountLimits.min, amountLimits.max];
            setDraftAmountRange(safeRange);
            setDraftSubStartDate(selectedSubStartDate || "");
            setDraftSubEndDate(selectedSubEndDate || "");
            setDraftAppStartDate(selectedAppStartDate || "");
            setDraftAppEndDate(selectedAppEndDate || "");
        }
    }, [
        isOpen,
        selectedProviders,
        selectedStatuses,
        selectedAmountRange,
        selectedSubStartDate,
        selectedSubEndDate,
        selectedAppStartDate,
        selectedAppEndDate,
        amountLimits,
    ]);

    // Lock body scroll while drawer is open (filter closes ONLY when X icon is clicked)
    useEffect(() => {
        if (!isOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    const isAllStatusesChecked =
        !draftStatuses?.length ||
        draftStatuses.includes("All") ||
        draftStatuses.includes("All Statuses") ||
        draftStatuses.includes("All Status");

    const handleToggleStatusOption = (item) => {
        if (item === "All" || item === "All Statuses" || item === "All Status") {
            setDraftStatuses(["All"]);
            return;
        }

        const withoutAll = (draftStatuses || []).filter(
            (x) => x !== "All" && x !== "All Statuses" && x !== "All Status"
        );
        const exists = withoutAll.some(
            (x) => String(x).toLowerCase() === String(item).toLowerCase()
        );

        if (exists) {
            const next = withoutAll.filter(
                (x) => String(x).toLowerCase() !== String(item).toLowerCase()
            );
            setDraftStatuses(next.length === 0 ? ["All"] : next);
        } else {
            setDraftStatuses([...withoutAll, item]);
        }
    };

    const handleClearAllInternal = () => {
        setDraftProviders(["All"]);
        setDraftStatuses(["All"]);
        setDraftAmountRange([amountLimits.min, amountLimits.max]);
        setDraftSubStartDate("");
        setDraftSubEndDate("");
        setDraftAppStartDate("");
        setDraftAppEndDate("");
        onClearAll?.();
    };

    const handleApplyInternal = () => {
        onApply?.({
            providers: draftProviders,
            statuses: draftStatuses,
            amountRange: draftAmountRange,
            subStartDate: draftSubStartDate,
            subEndDate: draftSubEndDate,
            appStartDate: draftAppStartDate,
            appEndDate: draftAppEndDate,
        });
        onClose?.();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="rm-filter-drawer-root">
            {/* Backdrop: closes ONLY via the top-right X button */}
            <div className="rm-filter-drawer-backdrop" aria-hidden="true" />
            <aside
                className="rm-filter-drawer-panel"
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Header */}
                <div className="rm-filter-panel-header">
                    <span className="rm-filter-panel-title">Filters</span>
                    <button
                        type="button"
                        className="rm-filter-panel-close-btn"
                        onClick={onClose}
                        aria-label="Close filters"
                        title="Close filters"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 2. Scrollable Body */}
                <div className="rm-filter-panel-body" style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                    {/* Provider Dropdown */}
                    <DrawerDropdownField
                        title="Provider"
                        allLabel="All Providers"
                        options={providers}
                        selectedValues={draftProviders}
                        showAllOption={false}
                        onToggleOption={(item) =>
                            toggleFilterMultiOption(item, draftProviders, setDraftProviders)
                        }
                        onClearField={() => setDraftProviders(["All"])}
                    />

                    {/* Status Checkbox Grid (Matching Learning Records Filter) */}
                    <div className="rm-filter-group">
                        <div className="rm-filter-group-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 className="rm-filter-group-heading">Status</h4>
                            {!isAllStatusesChecked && (
                                <button
                                    type="button"
                                    className="rm-filter-clear-link"
                                    onClick={() => setDraftStatuses(["All"])}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="rm-filter-options-list rm-filter-options-grid-2col">
                            <label className="rm-filter-checkbox-row">
                                <span
                                    className={`rm-filter-custom-checkbox ${isAllStatusesChecked ? "checked" : ""}`}
                                    onClick={() => handleToggleStatusOption("All")}
                                >
                                    {isAllStatusesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                </span>
                                <span
                                    className="rm-filter-checkbox-label"
                                    onClick={() => handleToggleStatusOption("All")}
                                >
                                    All Statuses
                                </span>
                            </label>

                            {statuses.map((status) => {
                                const isChecked =
                                    !isAllStatusesChecked &&
                                    draftStatuses.some((s) => s.toLowerCase() === status.toLowerCase());
                                return (
                                    <label key={status} className="rm-filter-checkbox-row">
                                        <span
                                            className={`rm-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                            onClick={() => handleToggleStatusOption(status)}
                                        >
                                            {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span
                                            className="rm-filter-checkbox-label"
                                            onClick={() => handleToggleStatusOption(status)}
                                        >
                                            {status}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Amount Range Slider */}
                    <DualRangeSlider
                        title="Amount"
                        min={amountLimits.min}
                        max={amountLimits.max}
                        step={amountLimits.step || 100}
                        value={draftAmountRange}
                        showPlusAtMax={false}
                        onChange={setDraftAmountRange}
                        onClear={() => setDraftAmountRange([amountLimits.min, amountLimits.max])}
                    />

                    {/* Submitted Date Range */}
                    <div className="rm-filter-group">
                        <div className="rm-filter-group-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 className="rm-filter-group-heading">Submitted Date</h4>
                            {(draftSubStartDate || draftSubEndDate) && (
                                <button
                                    type="button"
                                    className="rm-filter-clear-link"
                                    onClick={() => {
                                        setDraftSubStartDate("");
                                        setDraftSubEndDate("");
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="rm-filter-date-range-row">
                            <div className="rm-filter-date-field">
                                <span className="rm-filter-date-sublabel">Starting Date</span>
                                <EmpDatePicker
                                    value={draftSubStartDate}
                                    onChange={(e) => setDraftSubStartDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>

                            <span className="rm-filter-date-separator">to</span>

                            <div className="rm-filter-date-field">
                                <span className="rm-filter-date-sublabel">Ending Date</span>
                                <EmpDatePicker
                                    value={draftSubEndDate}
                                    onChange={(e) => setDraftSubEndDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                    min={draftSubStartDate || undefined}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Approved Date Range */}
                    <div className="rm-filter-group">
                        <div className="rm-filter-group-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 className="rm-filter-group-heading">Approved Date</h4>
                            {(draftAppStartDate || draftAppEndDate) && (
                                <button
                                    type="button"
                                    className="rm-filter-clear-link"
                                    onClick={() => {
                                        setDraftAppStartDate("");
                                        setDraftAppEndDate("");
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="rm-filter-date-range-row">
                            <div className="rm-filter-date-field">
                                <span className="rm-filter-date-sublabel">Starting Date</span>
                                <EmpDatePicker
                                    value={draftAppStartDate}
                                    onChange={(e) => setDraftAppStartDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>

                            <span className="rm-filter-date-separator">to</span>

                            <div className="rm-filter-date-field">
                                <span className="rm-filter-date-sublabel">Ending Date</span>
                                <EmpDatePicker
                                    value={draftAppEndDate}
                                    onChange={(e) => setDraftAppEndDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                    min={draftAppStartDate || undefined}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Sticky Footer */}
                <div className="rm-filter-panel-footer">
                    <button
                        type="button"
                        className="rm-filter-panel-clear-btn"
                        onClick={handleClearAllInternal}
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        className="rm-filter-panel-apply-btn"
                        onClick={handleApplyInternal}
                    >
                        Apply Filter
                    </button>
                </div>
            </aside>
        </div>,
        document.body
    );
}
