import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import useCourseMetadata from "../../../hooks/useCourseMetadata";
import DrawerDropdownField, {
    toggleFilterMultiOption,
} from "../../common/DrawerDropdownField";
import "../../../styles/employee/CertificationReimb.css";

const CERTIFICATE_TYPES = [
    "Professional Certification",
    "Course Completion Certificate"
];

const CERTIFICATE_STATUS_OPTIONS = [
    "Valid",
    "Expired"
];

const REQUEST_STATUS_OPTIONS = [
    "Pending",
    "Approved",
    "Rejected"
];

const EXAM_SCHEDULE_OPTIONS = [
    "Scheduled",
    "Expired Schedule"
];

export default function CertificateFilterDrawer({
    isOpen,
    onClose,
    mode = "my-certificates",
    // My Certificates filter states
    selectedCertTypes = ["All"],
    selectedStatuses = ["All"],
    certificates = [],
    // Requests filter states
    selectedRequestStatuses = ["All"],
    selectedSchedules = ["All"],
    requests = [],
    // Shared provider state
    selectedProviders = ["All"],
    onApply,
    onClearAll,
}) {
    const drawerRef = useRef(null);

    // Draft local filter states for My Certificates
    const [draftTypes, setDraftTypes] = useState(selectedCertTypes);
    const [draftStatuses, setDraftStatuses] = useState(selectedStatuses);

    // Draft local filter states for Requests
    const [draftRequestStatuses, setDraftRequestStatuses] = useState(selectedRequestStatuses);
    const [draftSchedules, setDraftSchedules] = useState(selectedSchedules);

    // Shared provider draft state
    const [draftProviders, setDraftProviders] = useState(selectedProviders);

    const { providerNames } = useCourseMetadata(undefined, isOpen);

    // Derive and deduplicate available providers from live DB catalog + current tab records
    const availableProviders = useMemo(() => {
        const map = new Map();

        // 1. Add active canonical provider names from DB catalog
        (providerNames || []).forEach((prov) => {
            const p = prov.trim();
            if (p && p.toUpperCase() !== "OTHER") {
                const key = p.toUpperCase();
                if (!map.has(key)) map.set(key, p);
            }
        });

        // 2. Providers from current tab items
        const items = mode === "requests" ? (requests || []) : (certificates || []);
        items.forEach((item) => {
            const p = (item.provider || item.provider_name || item.issuer || "").trim();
            if (p && p.toUpperCase() !== "OTHER") {
                const key = p.toUpperCase();
                if (!map.has(key)) map.set(key, p);
            }
        });

        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    }, [mode, certificates, requests, providerNames]);

    // Sync draft states when drawer opens or tab mode / selected values change
    useEffect(() => {
        if (isOpen) {
            if (mode === "requests") {
                setDraftRequestStatuses(selectedRequestStatuses?.length ? selectedRequestStatuses : ["All"]);
                setDraftProviders(selectedProviders?.length ? selectedProviders : ["All"]);
                setDraftSchedules(selectedSchedules?.length ? selectedSchedules : ["All"]);
            } else {
                setDraftTypes(selectedCertTypes?.length ? selectedCertTypes : ["All"]);
                setDraftProviders(selectedProviders?.length ? selectedProviders : ["All"]);
                setDraftStatuses(selectedStatuses?.length ? selectedStatuses : ["All"]);
            }
        }
    }, [
        isOpen,
        mode,
        selectedCertTypes,
        selectedStatuses,
        selectedRequestStatuses,
        selectedSchedules,
        selectedProviders,
    ]);

    // Lock background body scroll while drawer is open (no outside/backdrop or escape key dismiss)
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    const handleClearAllInternal = () => {
        if (mode === "requests") {
            setDraftRequestStatuses(["All"]);
            setDraftProviders(["All"]);
            setDraftSchedules(["All"]);
        } else {
            setDraftTypes(["All"]);
            setDraftProviders(["All"]);
            setDraftStatuses(["All"]);
        }
        if (onClearAll) {
            onClearAll();
        }
    };

    const handleApplyInternal = () => {
        if (onApply) {
            if (mode === "requests") {
                onApply({
                    statuses: draftRequestStatuses,
                    providers: draftProviders,
                    schedules: draftSchedules,
                });
            } else {
                onApply({
                    types: draftTypes,
                    providers: draftProviders,
                    statuses: draftStatuses,
                });
            }
        }
        onClose();
    };

    if (!isOpen) return null;

    // Checks for My Certificates
    const isAllTypesChecked = draftTypes.includes("All") || draftTypes.length === 0;
    const isAllCertStatusesChecked = draftStatuses.includes("All") || draftStatuses.length === 0;

    // Checks for Requests
    const isAllRequestStatusesChecked = draftRequestStatuses.includes("All") || draftRequestStatuses.length === 0;
    const isAllSchedulesChecked = draftSchedules.includes("All") || draftSchedules.length === 0;

    return createPortal(
        <div className="emp-cert-filter-drawer-root">
            {/* Blurred semi-transparent backdrop (DOES NOT close on click; only X icon closes) */}
            <div
                className="emp-cert-filter-drawer-backdrop"
                aria-hidden="true"
            />

            {/* Right side drawer panel */}
            <aside
                className="emp-cert-filter-drawer-panel"
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
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
                <div className="emp-cert-filter-panel-body">
                    {mode === "requests" ? (
                        /* ════════════════════════════════════════════
                           REQUESTS TAB FILTER SECTIONS
                        ════════════════════════════════════════════ */
                        <>
                            {/* SECTION 1: REQUEST STATUS */}
                            <div className="emp-cert-filter-group">
                                <h4 className="emp-cert-filter-group-heading">Request Status</h4>

                                <div className="emp-cert-filter-options-list">
                                    <label className="emp-cert-filter-checkbox-row">
                                        <span
                                            className={`emp-cert-filter-custom-checkbox ${isAllRequestStatusesChecked ? "checked" : ""}`}
                                            onClick={() => toggleFilterMultiOption("All", draftRequestStatuses, setDraftRequestStatuses)}
                                        >
                                            {isAllRequestStatusesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span
                                            className="emp-cert-filter-checkbox-label"
                                            onClick={() => toggleFilterMultiOption("All", draftRequestStatuses, setDraftRequestStatuses)}
                                        >
                                            All Statuses
                                        </span>
                                    </label>

                                    {REQUEST_STATUS_OPTIONS.map((st) => {
                                        const isChecked = !isAllRequestStatusesChecked && draftRequestStatuses.some((s) => s.toLowerCase() === st.toLowerCase());
                                        return (
                                            <label key={st} className="emp-cert-filter-checkbox-row">
                                                <span
                                                    className={`emp-cert-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                    onClick={() => toggleFilterMultiOption(st, draftRequestStatuses, setDraftRequestStatuses)}
                                                >
                                                    {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                                </span>
                                                <span
                                                    className="emp-cert-filter-checkbox-label"
                                                    onClick={() => toggleFilterMultiOption(st, draftRequestStatuses, setDraftRequestStatuses)}
                                                >
                                                    {st}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* SECTION 2: PROVIDER DROPDOWN */}
                            <DrawerDropdownField
                                title="Provider"
                                allLabel="All Providers"
                                searchPlaceholder="Search provider..."
                                options={availableProviders}
                                selectedValues={draftProviders}
                                onToggleOption={(prov) =>
                                    toggleFilterMultiOption(prov, draftProviders, setDraftProviders)
                                }
                                onClearField={() => setDraftProviders(["All"])}
                                showAllOption={false}
                            />

                            {/* SECTION 3: EXAM SCHEDULE */}
                            <div className="emp-cert-filter-group">
                                <h4 className="emp-cert-filter-group-heading">Exam Schedule</h4>

                                <div className="emp-cert-filter-options-list">
                                    <label className="emp-cert-filter-checkbox-row">
                                        <span
                                            className={`emp-cert-filter-custom-checkbox ${isAllSchedulesChecked ? "checked" : ""}`}
                                            onClick={() => toggleFilterMultiOption("All", draftSchedules, setDraftSchedules)}
                                        >
                                            {isAllSchedulesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span
                                            className="emp-cert-filter-checkbox-label"
                                            onClick={() => toggleFilterMultiOption("All", draftSchedules, setDraftSchedules)}
                                        >
                                            All Schedules
                                        </span>
                                    </label>

                                    {EXAM_SCHEDULE_OPTIONS.map((sch) => {
                                        const isChecked = !isAllSchedulesChecked && draftSchedules.some((s) => s.toLowerCase() === sch.toLowerCase());
                                        return (
                                            <label key={sch} className="emp-cert-filter-checkbox-row">
                                                <span
                                                    className={`emp-cert-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                    onClick={() => toggleFilterMultiOption(sch, draftSchedules, setDraftSchedules)}
                                                >
                                                    {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                                </span>
                                                <span
                                                    className="emp-cert-filter-checkbox-label"
                                                    onClick={() => toggleFilterMultiOption(sch, draftSchedules, setDraftSchedules)}
                                                >
                                                    {sch}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* ════════════════════════════════════════════
                           MY CERTIFICATES TAB FILTER SECTIONS
                        ════════════════════════════════════════════ */
                        <>
                            {/* SECTION 1: CERTIFICATE TYPE */}
                            <div className="emp-cert-filter-group">
                                <h4 className="emp-cert-filter-group-heading">Certificate Type</h4>

                                <div className="emp-cert-filter-options-list">
                                    <label className="emp-cert-filter-checkbox-row">
                                        <span
                                            className={`emp-cert-filter-custom-checkbox ${isAllTypesChecked ? "checked" : ""}`}
                                            onClick={() => toggleFilterMultiOption("All", draftTypes, setDraftTypes)}
                                        >
                                            {isAllTypesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span
                                            className="emp-cert-filter-checkbox-label"
                                            onClick={() => toggleFilterMultiOption("All", draftTypes, setDraftTypes)}
                                        >
                                            All Certificate Types
                                        </span>
                                    </label>

                                    {CERTIFICATE_TYPES.map((type) => {
                                        const isChecked = !isAllTypesChecked && draftTypes.some((t) => t.toLowerCase() === type.toLowerCase());
                                        return (
                                            <label key={type} className="emp-cert-filter-checkbox-row">
                                                <span
                                                    className={`emp-cert-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                    onClick={() => toggleFilterMultiOption(type, draftTypes, setDraftTypes)}
                                                >
                                                    {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                                </span>
                                                <span
                                                    className="emp-cert-filter-checkbox-label"
                                                    onClick={() => toggleFilterMultiOption(type, draftTypes, setDraftTypes)}
                                                >
                                                    {type}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* SECTION 2: PROVIDER DROPDOWN */}
                            <DrawerDropdownField
                                title="Provider"
                                allLabel="All Providers"
                                searchPlaceholder="Search provider..."
                                options={availableProviders}
                                selectedValues={draftProviders}
                                onToggleOption={(prov) =>
                                    toggleFilterMultiOption(prov, draftProviders, setDraftProviders)
                                }
                                onClearField={() => setDraftProviders(["All"])}
                                showAllOption={false}
                            />

                            {/* SECTION 3: CERTIFICATE STATUS */}
                            <div className="emp-cert-filter-group">
                                <h4 className="emp-cert-filter-group-heading">Certificate Status</h4>

                                <div className="emp-cert-filter-options-list">
                                    <label className="emp-cert-filter-checkbox-row">
                                        <span
                                            className={`emp-cert-filter-custom-checkbox ${isAllCertStatusesChecked ? "checked" : ""}`}
                                            onClick={() => toggleFilterMultiOption("All", draftStatuses, setDraftStatuses)}
                                        >
                                            {isAllCertStatusesChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                        </span>
                                        <span
                                            className="emp-cert-filter-checkbox-label"
                                            onClick={() => toggleFilterMultiOption("All", draftStatuses, setDraftStatuses)}
                                        >
                                            All Statuses
                                        </span>
                                    </label>

                                    {CERTIFICATE_STATUS_OPTIONS.map((st) => {
                                        const isChecked = !isAllCertStatusesChecked && draftStatuses.some((s) => s.toLowerCase() === st.toLowerCase());
                                        return (
                                            <label key={st} className="emp-cert-filter-checkbox-row">
                                                <span
                                                    className={`emp-cert-filter-custom-checkbox ${isChecked ? "checked" : ""}`}
                                                    onClick={() => toggleFilterMultiOption(st, draftStatuses, setDraftStatuses)}
                                                >
                                                    {isChecked && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                                                </span>
                                                <span
                                                    className="emp-cert-filter-checkbox-label"
                                                    onClick={() => toggleFilterMultiOption(st, draftStatuses, setDraftStatuses)}
                                                >
                                                    {st}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
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
