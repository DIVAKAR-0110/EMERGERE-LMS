import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import EmpDatePicker from "./EmpDatePicker";
import "../../../styles/employee/CertificationReimb.css";

export default function ReimbursementClaimFilterDrawer({
    isOpen,
    onClose,
    filters = {},
    maxPriceLimit = 50000,
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    const minLimit = 0;
    const maxLimit = maxPriceLimit > 0 ? maxPriceLimit : 5000;
    const step = maxLimit <= 2000 ? 50 : maxLimit <= 10000 ? 100 : 500;

    // Staged draft filter states
    const [draftMinPrice, setDraftMinPrice] = useState(
        filters.minPrice !== "" && filters.minPrice !== undefined ? Number(filters.minPrice) : minLimit
    );
    const [draftMaxPrice, setDraftMaxPrice] = useState(
        filters.maxPrice !== "" && filters.maxPrice !== undefined ? Math.min(Number(filters.maxPrice), maxLimit) : maxLimit
    );
    const [draftPurchaseStartDate, setDraftPurchaseStartDate] = useState(filters.purchaseStartDate || "");
    const [draftPurchaseEndDate, setDraftPurchaseEndDate] = useState(filters.purchaseEndDate || "");
    const [draftSubmittedStartDate, setDraftSubmittedStartDate] = useState(filters.submittedStartDate || "");
    const [draftSubmittedEndDate, setDraftSubmittedEndDate] = useState(filters.submittedEndDate || "");
    const [draftRequestedStartDate, setDraftRequestedStartDate] = useState(filters.requestedStartDate || "");
    const [draftRequestedEndDate, setDraftRequestedEndDate] = useState(filters.requestedEndDate || "");

    // Synchronize draft states whenever drawer opens or active filters change
    useEffect(() => {
        if (isOpen) {
            setDraftMinPrice(
                filters.minPrice !== "" && filters.minPrice !== undefined ? Number(filters.minPrice) : minLimit
            );
            setDraftMaxPrice(
                filters.maxPrice !== "" && filters.maxPrice !== undefined ? Math.min(Number(filters.maxPrice), maxLimit) : maxLimit
            );
            setDraftPurchaseStartDate(filters.purchaseStartDate || "");
            setDraftPurchaseEndDate(filters.purchaseEndDate || "");
            setDraftSubmittedStartDate(filters.submittedStartDate || "");
            setDraftSubmittedEndDate(filters.submittedEndDate || "");
            setDraftRequestedStartDate(filters.requestedStartDate || "");
            setDraftRequestedEndDate(filters.requestedEndDate || "");
        }
    }, [isOpen, filters, maxLimit]);

    // Handle Escape key & lock background body scroll
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    const isPriceFiltered = draftMinPrice > minLimit || draftMaxPrice < maxLimit;

    const handleClearAmount = () => {
        setDraftMinPrice(minLimit);
        setDraftMaxPrice(maxLimit);
    };

    const handleClearPurchaseDates = () => {
        setDraftPurchaseStartDate("");
        setDraftPurchaseEndDate("");
    };

    const handleClearSubmittedDates = () => {
        setDraftSubmittedStartDate("");
        setDraftSubmittedEndDate("");
    };

    const handleClearRequestedDates = () => {
        setDraftRequestedStartDate("");
        setDraftRequestedEndDate("");
    };

    const handleClearAllInternal = () => {
        handleClearAmount();
        handleClearPurchaseDates();
        handleClearSubmittedDates();
        handleClearRequestedDates();
        if (onClearAll) {
            onClearAll();
        }
    };

    const handleApplyInternal = () => {
        if (onApply) {
            onApply({
                minPrice: draftMinPrice > minLimit ? String(draftMinPrice) : "",
                maxPrice: draftMaxPrice < maxLimit ? String(draftMaxPrice) : "",
                purchaseStartDate: draftPurchaseStartDate || "",
                purchaseEndDate: draftPurchaseEndDate || "",
                submittedStartDate: draftSubmittedStartDate || "",
                submittedEndDate: draftSubmittedEndDate || "",
                requestedStartDate: draftRequestedStartDate || "",
                requestedEndDate: draftRequestedEndDate || "",
            });
        }
        onClose();
    };

    // Calculate percentage coordinates for slider progress bar
    const minPercent = Math.min(100, Math.max(0, ((draftMinPrice - minLimit) / (maxLimit - minLimit)) * 100));
    const maxPercent = Math.min(100, Math.max(0, ((draftMaxPrice - minLimit) / (maxLimit - minLimit)) * 100));

    if (!isOpen) return null;

    return createPortal(
        <div className="emp-cert-filter-drawer-root">
            {/* Blurred semi-transparent backdrop */}
            <div
                className="emp-cert-filter-drawer-backdrop"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Right side drawer panel */}
            <aside
                className="emp-cert-filter-drawer-panel emp-reimb-filter-drawer-panel"
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. HEADER */}
                <div className="emp-cert-filter-panel-header">
                    <span className="emp-cert-filter-panel-title">Filters</span>
                    <button
                        type="button"
                        className="emp-cert-filter-panel-close-btn"
                        onClick={onClose}
                        aria-label="Close filters"
                        title="Close filters"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 2. SCROLLABLE FILTER CONTENT */}
                <div className="emp-cert-filter-panel-body emp-reimb-filter-panel-body">
                    {/* ── 1. PRICE SCALING SLIDER (AMAZON-STYLE) ── */}
                    <div id="priceRefinements" className="emp-cert-filter-group price-refinements">
                        <div className="emp-cert-filter-group-header-row">
                            <h4 className="emp-cert-filter-group-heading">Price</h4>
                            {isPriceFiltered && (
                                <button
                                    type="button"
                                    className="emp-cert-filter-clear-link"
                                    onClick={handleClearAmount}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="emp-price-scale-wrapper">
                            <div className="emp-price-display-text">
                                ₹{draftMinPrice.toLocaleString("en-IN")} – ₹{draftMaxPrice.toLocaleString("en-IN")}
                            </div>

                            <div className="emp-range-slider-track-box">
                                <div className="emp-range-slider-bar" />
                                <div
                                    className="emp-range-slider-progress"
                                    style={{
                                        left: `${minPercent}%`,
                                        width: `${Math.max(0, maxPercent - minPercent)}%`,
                                    }}
                                />
                                <input
                                    id="low-price"
                                    name="low-price"
                                    type="range"
                                    min={minLimit}
                                    max={maxLimit}
                                    step={step}
                                    value={draftMinPrice}
                                    onChange={(e) => {
                                        const val = Math.min(Number(e.target.value), draftMaxPrice - step);
                                        setDraftMinPrice(val);
                                    }}
                                    className="emp-price-range-slider-input emp-range-input-low"
                                    style={{ zIndex: draftMinPrice > maxLimit - step * 2 ? 5 : 3 }}
                                    aria-label="Minimum price"
                                />
                                <input
                                    id="high-price"
                                    name="high-price"
                                    type="range"
                                    min={minLimit}
                                    max={maxLimit}
                                    step={step}
                                    value={draftMaxPrice}
                                    onChange={(e) => {
                                        const val = Math.max(Number(e.target.value), draftMinPrice + step);
                                        setDraftMaxPrice(val);
                                    }}
                                    className="emp-price-range-slider-input emp-range-input-high"
                                    style={{ zIndex: 4 }}
                                    aria-label="Maximum price"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 2. DATE OF PURCHASE RANGE ── */}
                    <div className="emp-cert-filter-group">
                        <div className="emp-cert-filter-group-header-row">
                            <h4 className="emp-cert-filter-group-heading">Date of Purchase</h4>
                            {(draftPurchaseStartDate || draftPurchaseEndDate) && (
                                <button
                                    type="button"
                                    className="emp-cert-filter-clear-link"
                                    onClick={handleClearPurchaseDates}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="emp-filter-date-range-row">
                            <div className="emp-filter-date-field">
                                <span className="emp-filter-date-sublabel">Starting Date</span>
                                <EmpDatePicker
                                    value={draftPurchaseStartDate}
                                    onChange={(e) => setDraftPurchaseStartDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>

                            <span className="emp-filter-date-separator">to</span>

                            <div className="emp-filter-date-field">
                                <span className="emp-filter-date-sublabel">Ending Date</span>
                                <EmpDatePicker
                                    value={draftPurchaseEndDate}
                                    onChange={(e) => setDraftPurchaseEndDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                    min={draftPurchaseStartDate || undefined}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 3. SUBMITTED ON RANGE ── */}
                    <div className="emp-cert-filter-group">
                        <div className="emp-cert-filter-group-header-row">
                            <h4 className="emp-cert-filter-group-heading">Submitted on</h4>
                            {(draftSubmittedStartDate || draftSubmittedEndDate) && (
                                <button
                                    type="button"
                                    className="emp-cert-filter-clear-link"
                                    onClick={handleClearSubmittedDates}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="emp-filter-date-range-row">
                            <div className="emp-filter-date-field">
                                <span className="emp-filter-date-sublabel">Starting Date</span>
                                <EmpDatePicker
                                    value={draftSubmittedStartDate}
                                    onChange={(e) => setDraftSubmittedStartDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>

                            <span className="emp-filter-date-separator">to</span>

                            <div className="emp-filter-date-field">
                                <span className="emp-filter-date-sublabel">Ending Date</span>
                                <EmpDatePicker
                                    value={draftSubmittedEndDate}
                                    onChange={(e) => setDraftSubmittedEndDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                    min={draftSubmittedStartDate || undefined}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 4. REQUESTED AT RANGE ── */}
                    <div className="emp-cert-filter-group">
                        <div className="emp-cert-filter-group-header-row">
                            <h4 className="emp-cert-filter-group-heading">Requested at</h4>
                            {(draftRequestedStartDate || draftRequestedEndDate) && (
                                <button
                                    type="button"
                                    className="emp-cert-filter-clear-link"
                                    onClick={handleClearRequestedDates}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="emp-filter-date-range-row">
                            <div className="emp-filter-date-field">
                                <span className="emp-filter-date-sublabel">Starting Date</span>
                                <EmpDatePicker
                                    value={draftRequestedStartDate}
                                    onChange={(e) => setDraftRequestedStartDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                />
                            </div>

                            <span className="emp-filter-date-separator">to</span>

                            <div className="emp-filter-date-field">
                                <span className="emp-filter-date-sublabel">Ending Date</span>
                                <EmpDatePicker
                                    value={draftRequestedEndDate}
                                    onChange={(e) => setDraftRequestedEndDate(e.target.value)}
                                    placeholder="dd/mm/yyyy"
                                    min={draftRequestedStartDate || undefined}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. STICKY FOOTER */}
                <div className="emp-cert-filter-panel-footer">
                    <button
                        type="button"
                        className="emp-cert-filter-panel-clear-btn"
                        onClick={handleClearAllInternal}
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        className="emp-cert-filter-panel-apply-btn"
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
