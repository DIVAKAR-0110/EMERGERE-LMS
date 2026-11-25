import React, { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "../../components/common/PageHeader";
import CertificatesTab from "../../components/L&D/CertificateManagement/CertificatesTab";
import CertificateDetailsModal from "../../components/L&D/CertificateManagement/CertificateDetailsModal";
import searchIcon from "../../assets/course_library/search.svg";
import downArrowIcon from "../../assets/Daily_Learning_Log/down_arrow.svg";
import filterIcon from "../../assets/course_library/filter.svg";
import axios from "axios";
import { getEmployeeAvatarBg } from "../../utils/avatarUtils";
import { RANK_COLORS } from "../../services/leaderboardService";
import useCustomScrollbar from "../../hooks/useCustomScrollbar";
import "../../styles/L&D/CertificateManagement.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function CertificateManagement() {
    // Live state (null while waiting/offline)
    const [certificates, setCertificates] = useState(null);

    // Search query
    const [searchQuery, setSearchQuery] = useState("");

    // Filters
    const [statusFilter, setStatusFilter] = useState("All Status");
    const [providerFilter, setProviderFilter] = useState("All Providers");

    // Dropdown open states
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Selected item for modal details
    const [selectedItem, setSelectedItem] = useState(null);

    // Close dropdowns on outside click
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsStatusOpen(false);
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    // Fetch live certificates
    useEffect(() => {
        let isMounted = true;
        const loadLiveCertData = async () => {
            try {
                const token = localStorage.getItem("lms_token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                const certReqsRes = await axios.get(`${API_BASE_URL}/api/certifications/requests`, { headers }).catch(() => null);

                if (!certReqsRes) {
                    if (isMounted) {
                        setCertificates(null);
                    }
                    return;
                }

                if (isMounted) {
                    const rawReqs = Array.isArray(certReqsRes?.data) ? certReqsRes.data : [];

                    const approvedReqs = rawReqs.filter(r => r.status === "Approved");

                    const mappedReqs = approvedReqs.map((r, idx) => {
                        const empName = r.employee_name || `Employee ${r.employee_id}`;
                        const inits = empName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                        return {
                            id: r.request_code || `CLM-2026-${String(r.id || idx + 1).padStart(4, "0")}`,
                            requestId: r.id,
                            name: empName,
                            initials: inits,
                            avatarBg: RANK_COLORS[idx % RANK_COLORS.length],
                            certificate: r.certification_name,
                            provider: r.provider_name || "—",
                            submittedOn: r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent",
                            amount: r.estimated_cost_inr ? `₹${Number(r.estimated_cost_inr).toLocaleString()}` : "—",
                            examScheduledOn: r.scheduled_exam_date || "—",
                            status: "Approved",
                            raw: r
                        };
                    });

                    setCertificates(mappedReqs);
                }
            } catch (err) {
                console.error("Failed to load live certificates:", err);
                if (isMounted) {
                    setCertificates(null);
                }
            }
        };
        loadLiveCertData();
        return () => { isMounted = false; };
    }, []);

    // Filtered Certificates
    const filteredCertificates = useMemo(() => {
        if (!certificates) return null;
        return certificates.filter((item) => {
            const matchesSearch =
                (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.certificate && item.certificate.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.id && String(item.id).toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus =
                statusFilter === "All Status" || item.status === statusFilter;

            const matchesProvider =
                providerFilter === "All Providers" || item.provider === providerFilter;

            return matchesSearch && matchesStatus && matchesProvider;
        });
    }, [certificates, searchQuery, statusFilter, providerFilter]);

    // Status options
    const statusOptions = ["All Status", "Approved", "Pending", "Rejected"];

    // Provider options
    const providerOptions = [
        "All Providers",
        "AWS",
        "Tableau",
        "Google",
        "CNCF",
        "Microsoft",
        "Scrum Alliance",
    ];

    // Custom 7px width, 80px height, #D9D9D9 scrollbar as in CEO module
    const {
        containerRef,
        trackRef,
        thumbRef,
        thumbOffset,
        hasOverflow,
        isDragging,
        handleScroll,
        handlePointerDown,
        handleTrackClick,
    } = useCustomScrollbar({
        thumbHeight: 80,
        deps: [filteredCertificates, statusFilter, providerFilter],
    });

    return (
        <div className="ld-certificate-management-page">
            {/* 1. Header with View Switcher & Notification */}
            <PageHeader
                title="Certificate Management"
                subtitle="Verify employee examination credentials."
                showNotification={true}
                showViewSwitcher={true}
            />

            {/* 2. Search & Filter Bar */}
            <div className="ld-cm-filter-bar">
                {/* Search box */}
                <div className="ld-cm-search-box">
                    <img src={searchIcon} alt="" className="ld-cm-search-icon" />
                    <input
                        type="text"
                        placeholder="Search Employees or Certificate"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="ld-cm-search-input"
                    />
                </div>

                {/* Right controls: Status dropdown & Filter button */}
                <div className="ld-cm-filter-controls" ref={dropdownRef}>
                    {/* Status Dropdown */}
                    <div className="ld-cm-dropdown-wrapper">
                        <div
                            className={`ld-cm-dropdown-btn ${statusFilter !== "All Status" && statusFilter !== "All" ? "filtered" : ""}`}
                            onClick={() => {
                                setIsStatusOpen(!isStatusOpen);
                                setIsFilterOpen(false);
                            }}
                        >
                            <span>{statusFilter}</span>
                            {statusFilter !== "All Status" && statusFilter !== "All" ? (
                                <span
                                    className="ld-cm-clear-cross"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusFilter("All Status");
                                    }}
                                    title="Clear status filter"
                                >
                                    ×
                                </span>
                            ) : (
                                <img src={downArrowIcon} alt="" className="ld-cm-chevron" />
                            )}
                        </div>

                        {isStatusOpen && (
                            <div className="ld-cm-dropdown-menu">
                                {statusOptions.map((opt) => (
                                    <div
                                        key={opt}
                                        className={`ld-cm-dropdown-item ${statusFilter === opt ? "selected" : ""}`}
                                        onClick={() => {
                                            setStatusFilter(opt);
                                            setIsStatusOpen(false);
                                        }}
                                    >
                                        {opt}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Filters (Provider Filter) */}
                    <div className="ld-cm-dropdown-wrapper">
                        <div
                            className={`ld-cm-filter-btn ${providerFilter !== "All Providers" && providerFilter !== "All" ? "filtered" : ""}`}
                            onClick={() => {
                                setIsFilterOpen(!isFilterOpen);
                                setIsStatusOpen(false);
                            }}
                        >
                            <img src={filterIcon} alt="" className="ld-cm-filter-icon" />
                            <span>{providerFilter !== "All Providers" && providerFilter !== "All" ? providerFilter : "Filters"}</span>
                            {providerFilter !== "All Providers" && providerFilter !== "All" ? (
                                <span
                                    className="ld-cm-clear-cross"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setProviderFilter("All Providers");
                                    }}
                                    title="Clear provider filter"
                                >
                                    ×
                                </span>
                            ) : (
                                <img src={downArrowIcon} alt="" className="ld-cm-chevron" />
                            )}
                        </div>

                        {isFilterOpen && (
                            <div className="ld-cm-dropdown-menu ld-cm-filter-menu">
                                {providerOptions.map((opt) => (
                                    <div
                                        key={opt}
                                        className={`ld-cm-dropdown-item ${providerFilter === opt ? "selected" : ""}`}
                                        onClick={() => {
                                            setProviderFilter(opt);
                                            setIsFilterOpen(false);
                                        }}
                                    >
                                        {opt}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Table Card */}
            <div className="ld-cm-table-card">
                <div
                    className="ld-cm-table-wrap ld-cm-table-container"
                    ref={containerRef}
                    onScroll={handleScroll}
                >
                    <CertificatesTab
                        certificates={filteredCertificates || []}
                        isLoading={certificates === null}
                        onViewDetails={(item) => setSelectedItem(item)}
                    />
                </div>

                {/* Custom 7px x 80px scrollbar (#D9D9D9) */}
                {hasOverflow && (
                    <div
                        className="ld-cm-table-scroll-track"
                        ref={trackRef}
                        onClick={handleTrackClick}
                        title="Scroll"
                    >
                        <div
                            className={`ld-cm-table-scroll-thumb ${isDragging ? "dragging" : ""}`}
                            ref={thumbRef}
                            style={{ transform: `translateY(${thumbOffset}px)` }}
                            onPointerDown={handlePointerDown}
                        />
                    </div>
                )}
            </div>

            {/* 5. View Details Modal */}
            <CertificateDetailsModal
                selectedItem={selectedItem}
                onClose={() => setSelectedItem(null)}
            />
        </div>
    );
}
