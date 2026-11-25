import React, { useMemo, useState, useEffect, useRef } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import Pagination from "../CourseLibrary/Pagination";
import uploadIcon from "../../../assets/Certification/upload.svg";
import deleteIcon from "../../../assets/Certification/delete.svg";
import verifiedIcon from "../../../assets/Certification/verified.svg";
import warningIcon from "../../../assets/Certification/download_blue.svg";
import webIcon from "../../../assets/Certification/web.svg";
import downloadIcon from "../../../assets/Certification/download.svg";
import completedIcon from "../../../assets/Certification/Completed.svg";
import bookIcon from "../../../assets/Certification/book.svg";
import badgeIcon from "../../../assets/Certification/badge.svg";
import bluebiglineSvg from "../../../assets/Certification/bluebigline.svg";
import RequestCertificationCard from "./RequestCertificationCard";
import { getApprovalHighlightKey } from "../../../utils/notificationHighlight";
import "../../../styles/employee/CertificationReimb.css";

export const CERT_SUB_TABS = ["All", "Request", "My Certificates"];

// Parse date string to timestamp for chronological sorting
const parseDateMs = (dStr) => {
    if (!dStr || dStr === "—") return 0;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

const renderSortIcon = (columnKey, sortConfig) => {
    if (sortConfig.key !== columnKey) {
        return <ArrowUpDown size={12} className="emp-cert-sort-icon inactive" />;
    }
    return sortConfig.direction === "asc" ? (
        <ArrowUp size={12} className="emp-cert-sort-icon active" />
    ) : (
        <ArrowDown size={12} className="emp-cert-sort-icon active" />
    );
};

export default function MyCertificatesTab({
    filteredCertificates = [],
    filteredCertRequests = [],
    mode = "my-certificates",
    expandedRequestId = null,
    setExpandedRequestId,
    highlightedRequestId = null,
    onUploadClick,
    onRequestClick,
    onDownloadCertificate,
    onDeleteCertificate,
    isLoading = false,
}) {
    const wrapperRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Sorting state for Requests Table
    const [requestSortConfig, setRequestSortConfig] = useState({ key: null, direction: null });
    const handleRequestSort = (key) => {
        setRequestSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: "asc" };
            }
            if (prev.direction === "asc") {
                return { key, direction: "desc" };
            }
            return { key: null, direction: null };
        });
        setCurrentPage(1);
    };

    // Sorting state for My Certificates Table
    const [certSortConfig, setCertSortConfig] = useState({ key: null, direction: null });
    const handleCertSort = (key) => {
        setCertSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: "asc" };
            }
            if (prev.direction === "asc") {
                return { key, direction: "desc" };
            }
            return { key: null, direction: null };
        });
        setCurrentPage(1);
    };

    // Sorted requests
    const sortedRequests = useMemo(() => {
        const raw = filteredCertRequests || [];
        if (!requestSortConfig.key || !requestSortConfig.direction) {
            return raw;
        }
        const { key, direction } = requestSortConfig;
        return [...raw].sort((a, b) => {
            let res = 0;
            if (key === "name") {
                const nameA = (a.certification_name || a.title || "").trim();
                const nameB = (b.certification_name || b.title || "").trim();
                res = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
            } else if (key === "provider") {
                const provA = (a.provider_name || a.provider || "").trim();
                const provB = (b.provider_name || b.provider || "").trim();
                res = provA.localeCompare(provB, undefined, { sensitivity: "base" });
            } else if (key === "examDate") {
                const dateA = parseDateMs(a.scheduled_exam_date || a.exam_date || a.created_at);
                const dateB = parseDateMs(b.scheduled_exam_date || b.exam_date || b.created_at);
                res = dateA - dateB;
            } else if (key === "status") {
                const statusA = (a.status || "").trim();
                const statusB = (b.status || "").trim();
                res = statusA.localeCompare(statusB, undefined, { sensitivity: "base" });
            }
            return direction === "asc" ? res : -res;
        });
    }, [filteredCertRequests, requestSortConfig]);

    // Sorted certificates
    const sortedCertificates = useMemo(() => {
        const raw = filteredCertificates || [];
        if (!certSortConfig.key || !certSortConfig.direction) {
            // Default: last uploaded certificate displayed first (created_at desc, then numeric id desc)
            return [...raw].sort((a, b) => {
                const timeA = parseDateMs(a.created_at || a.createdAt);
                const timeB = parseDateMs(b.created_at || b.createdAt);
                if (timeA !== timeB && timeA > 0 && timeB > 0) {
                    return timeB - timeA;
                }
                const idA = parseInt(String(a.certification_id || a.id || "").replace(/[^0-9]/g, ""), 10) || 0;
                const idB = parseInt(String(b.certification_id || b.id || "").replace(/[^0-9]/g, ""), 10) || 0;
                return idB - idA;
            });
        }
        const { key, direction } = certSortConfig;
        return [...raw].sort((a, b) => {
            let res = 0;
            if (key === "name") {
                const nameA = (a.title || a.certification_name || "").trim();
                const nameB = (b.title || b.certification_name || "").trim();
                res = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
            } else if (key === "provider") {
                const provA = (a.provider || "").trim();
                const provB = (b.provider || "").trim();
                res = provA.localeCompare(provB, undefined, { sensitivity: "base" });
            } else if (key === "schedule") {
                const dateA = parseDateMs(a.expiryDate || a.expiry_date || a.scheduled_exam_date || a.valid_till || a.created_at);
                const dateB = parseDateMs(b.expiryDate || b.expiry_date || b.scheduled_exam_date || b.valid_till || b.created_at);
                res = dateA - dateB;
            }
            return direction === "asc" ? res : -res;
        });
    }, [filteredCertificates, certSortConfig]);

    // Reset pagination to page 1 on mode switch, list length changes, or sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [mode, filteredCertificates.length, filteredCertRequests.length, requestSortConfig, certSortConfig]);

    // Keep scroll container strictly pinned to top (single-page view, zero scroll cutoff)
    useEffect(() => {
        const scrollParent = wrapperRef.current?.closest(".emp-cert-scrollable-content");
        if (scrollParent) {
            scrollParent.scrollTop = 0;
        }
    }, [expandedRequestId, currentPage, mode]);

    // Requests pagination: 10 per page default
    const requestsItemsPerPage = 10;
    const totalRequestPages = Math.max(1, Math.ceil(sortedRequests.length / requestsItemsPerPage));
    const safeRequestPage = Math.min(Math.max(1, currentPage), totalRequestPages);
    const paginatedRequests = useMemo(() => {
        const start = (safeRequestPage - 1) * requestsItemsPerPage;
        return sortedRequests.slice(start, start + requestsItemsPerPage);
    }, [sortedRequests, safeRequestPage, requestsItemsPerPage]);

    // My Certificates pagination: 10 per page default
    const certsItemsPerPage = 10;
    const totalCertPages = Math.max(1, Math.ceil(sortedCertificates.length / certsItemsPerPage));
    const safeCertPage = Math.min(Math.max(1, currentPage), totalCertPages);
    const paginatedCertificates = useMemo(() => {
        const start = (safeCertPage - 1) * certsItemsPerPage;
        return sortedCertificates.slice(start, start + certsItemsPerPage);
    }, [sortedCertificates, safeCertPage, certsItemsPerPage]);

    const renderRequestCard = (req) => {
        const reqKey = req.request_code || String(req.id ?? req.request_id);
        const isHighlighted =
            Boolean(highlightedRequestId) &&
            getApprovalHighlightKey(req) === String(highlightedRequestId);
        return (
            <RequestCertificationCard
                key={`req-${reqKey}`}
                request={req}
                isExpanded={expandedRequestId === reqKey}
                onToggleExpand={() =>
                    setExpandedRequestId?.(expandedRequestId === reqKey ? null : reqKey)
                }
                isHighlighted={isHighlighted}
            />
        );
    };

    const renderCertificateRow = (item) => {
        const isCourseCert =
            item.type === "Course Completion Certificate" ||
            item.type === "Course Certificate" ||
            item.certificate_type === "Course Completion Certificate" ||
            item.certificate_type === "Course Certificate" ||
            String(item.type || "").includes("Course Completion") ||
            String(item.type || "").includes("Course Certificate") ||
            (item.type !== "Professional Certification" && item.type !== "Certifications");

        const providerName =
            item.provider || (isCourseCert ? "Udemy" : "Amazon Web Services");

        const isExpired = item.status === "expired" || (() => {
            if (item.validityText && /^expired/i.test(String(item.validityText).trim())) return true;
            const rawDate = item.expiryDate || item.expiry_date || item.scheduled_exam_date;
            if (rawDate) {
                try {
                    const d = new Date(rawDate);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    if (!isNaN(d.getTime())) {
                        return d < now;
                    }
                } catch {
                    return false;
                }
            }
            return false;
        })();

        let completionText = "Completed";
        if (item.issueDate || item.issue_date) {
            try {
                const d = new Date(item.issueDate || item.issue_date);
                if (!isNaN(d.getTime())) {
                    completionText = `Completed on ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
                }
            } catch {
                completionText = `Completed on ${item.issueDate || item.issue_date}`;
            }
        } else if (item.validityText && !item.validityText.toLowerCase().startsWith("valid till")) {
            completionText = item.validityText;
        }

        let validityDisplay = item.validityText;
        if (isExpired && (!validityDisplay || !validityDisplay.toLowerCase().startsWith("expired"))) {
            const rawDate = item.expiryDate || item.expiry_date;
            if (rawDate) {
                try {
                    const d = new Date(rawDate);
                    if (!isNaN(d.getTime())) {
                        validityDisplay = `Expired on ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
                    } else {
                        validityDisplay = `Expired on ${rawDate}`;
                    }
                } catch {
                    validityDisplay = `Expired on ${rawDate}`;
                }
            } else {
                validityDisplay = "Expired";
            }
        } else if (!validityDisplay && (item.expiryDate || item.expiry_date)) {
            try {
                const d = new Date(item.expiryDate || item.expiry_date);
                if (!isNaN(d.getTime())) {
                    validityDisplay = `Valid till ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
                }
            } catch {
                validityDisplay = "Valid Certificate";
            }
        }
        if (!validityDisplay) {
            validityDisplay = isExpired ? "Expired" : "Valid Certificate";
        }

        const scheduleText = isCourseCert ? completionText : validityDisplay;

        return (
            <div key={item.id} className={`emp-my-certs-card-wrapper ${!isCourseCert ? "has-bottom-line" : ""}`}>
                <div className="emp-my-certs-card-row">
                    {/* 1. Names */}
                    <div className="emp-cert-col-name">
                        <div className={`emp-cert-type-icon-box ${isCourseCert ? "emp-book-navy" : "emp-badge-blue"}`}>
                            <img
                                src={isCourseCert ? bookIcon : badgeIcon}
                                alt={isCourseCert ? "Course Completion Certificate" : "Professional Certification"}
                                style={{ width: 30, height: 30 }}
                            />
                        </div>

                        <div className="emp-cert-main-details">
                            <span className="emp-cert-title-text" title={item.title}>
                                {item.title}
                            </span>
                            <span className="emp-cert-category-text">
                                {isCourseCert ? "Course Completion Certificate" : "Professional Certification"}
                            </span>
                        </div>
                    </div>

                    {/* 2. Provider */}
                    <div className="emp-cert-col-provider">
                        <div className="emp-cert-provider-info" title={providerName}>
                            <img src={webIcon} alt="Provider" style={{ width: 15, height: 15 }} />
                            <span>{providerName}</span>
                        </div>
                    </div>

                    {/* 3. Schedule Dates */}
                    <div className="emp-cert-col-schedule">
                        <div className={`emp-cert-status-info ${isCourseCert ? "course-completed" : isExpired ? "expired" : "completed"}`} title={scheduleText}>
                            <img
                                src={isCourseCert ? completedIcon : (isExpired ? warningIcon : verifiedIcon)}
                                alt={isCourseCert ? "Completed" : (isExpired ? "Expired" : "Valid")}
                                style={{ width: 15, height: 15 }}
                            />
                            <span className={isExpired ? "emp-cert-expired-text" : ""}>
                                {scheduleText}
                            </span>
                        </div>
                    </div>

                    {/* 4. Actions */}
                    <div className="emp-cert-col-action">
                        <button
                            className="emp-icon-action-btn"
                            title="Download Certification"
                            onClick={() => onDownloadCertificate(item.title, item.id, item.certificateUrl)}
                        >
                            <img src={downloadIcon} alt="Download" style={{ width: 15, height: 15 }} />
                        </button>

                        <button
                            className="emp-icon-action-btn emp-delete-btn"
                            title="Delete Certification"
                            onClick={() =>
                                onDeleteCertificate(
                                    item.title,
                                    item.id,
                                    isCourseCert ? "course certificate" : "certification"
                                )
                            }
                        >
                            <img src={deleteIcon} alt="Delete" style={{ width: 11, height: 12 }} />
                        </button>
                    </div>
                </div>

                {/* Bottom accent line for only Professional Certifications */}
                {!isCourseCert && (
                    <img
                        src={bluebiglineSvg}
                        alt=""
                        className="emp-my-certs-bottom-line"
                    />
                )}
            </div>
        );
    };

    // Render Requests Table View when mode === "requests"
    if (mode === "requests") {
        return (
            <div className="emp-requests-table-wrapper" ref={wrapperRef}>
                <div className="emp-requests-table-container">
                    {/* Header Row */}
                    <div className="emp-requests-header-row" style={{ flexShrink: 0 }}>
                        <span
                            className={`emp-req-col-name emp-sortable-header ${requestSortConfig.key === "name" ? "active-sort" : ""}`}
                            onClick={() => handleRequestSort("name")}
                            title="Sort by Names"
                        >
                            <span>Names</span>
                            {renderSortIcon("name", requestSortConfig)}
                        </span>

                        <span
                            className={`emp-req-col-provider emp-sortable-header ${requestSortConfig.key === "provider" ? "active-sort" : ""}`}
                            onClick={() => handleRequestSort("provider")}
                            title="Sort by Provider"
                        >
                            <span>Provider</span>
                            {renderSortIcon("provider", requestSortConfig)}
                        </span>

                        <span
                            className={`emp-req-col-exam-date emp-sortable-header ${requestSortConfig.key === "examDate" ? "active-sort" : ""}`}
                            onClick={() => handleRequestSort("examDate")}
                            title="Sort by Exam Dates"
                        >
                            <span>Exam Dates</span>
                            {renderSortIcon("examDate", requestSortConfig)}
                        </span>

                        <span
                            className={`emp-req-col-status emp-sortable-header ${requestSortConfig.key === "status" ? "active-sort" : ""}`}
                            onClick={() => handleRequestSort("status")}
                            title="Sort by Status"
                        >
                            <span>Status</span>
                            {renderSortIcon("status", requestSortConfig)}
                        </span>
                        <span className="emp-req-col-action"></span>
                    </div>

                    {/* Scrollable Requests Rows List */}
                    <div className="emp-requests-cards-list">
                        {isLoading ? (
                            <div className="emp-cert-skeleton-list" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                                {Array.from({ length: 6 }).map((_, idx) => (
                                    <div key={`req-skel-${idx}`} className="emp-requests-card-wrapper">
                                        <div className="emp-requests-card-row">
                                            <div className="emp-req-col-name" style={{ gap: 10 }}>
                                                <span className="ld-skeleton-block" style={{ width: 30, height: 30, borderRadius: 6 }} />
                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                    <span className="ld-skeleton-block" style={{ width: 140, height: 14, borderRadius: 4 }} />
                                                    <span className="ld-skeleton-block" style={{ width: 90, height: 11, borderRadius: 4 }} />
                                                </div>
                                            </div>
                                            <div className="emp-req-col-provider">
                                                <span className="ld-skeleton-block" style={{ width: 90, height: 14, borderRadius: 4 }} />
                                            </div>
                                            <div className="emp-req-col-exam-date">
                                                <span className="ld-skeleton-block" style={{ width: 100, height: 14, borderRadius: 4 }} />
                                            </div>
                                            <div className="emp-req-col-status">
                                                <span className="ld-skeleton-block" style={{ width: 60, height: 22, borderRadius: 12 }} />
                                            </div>
                                            <div className="emp-req-col-action">
                                                <span className="ld-skeleton-block" style={{ width: 24, height: 24, borderRadius: 4 }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : sortedRequests.length === 0 ? (
                            <div className="emp-empty-cert-state">
                                <img
                                    src={openBookIcon}
                                    alt="No Requests Found"
                                    className="emp-empty-cert-icon"
                                />
                                <h3>No Requests Found</h3>
                            </div>
                        ) : (
                            paginatedRequests.map((req) => renderRequestCard(req))
                        )}
                    </div>

                    {/* Pagination INSIDE the table view */}
                    {!isLoading && sortedRequests.length > 0 && (
                        <Pagination
                            currentPage={safeRequestPage}
                            setCurrentPage={setCurrentPage}
                            total={sortedRequests.length}
                            itemsPerPage={requestsItemsPerPage}
                            type="Requests"
                        />
                    )}
                </div>
            </div>
        );
    }

    // Render My Certificates Table View when mode === "my-certificates"
    return (
        <div className="emp-my-certs-table-wrapper" ref={wrapperRef}>
            <div className="emp-my-certs-table-container">
                {/* Header Row */}
                <div className="emp-my-certs-header-row" style={{ flexShrink: 0 }}>
                    <span
                        className={`emp-cert-col-name emp-sortable-header ${certSortConfig.key === "name" ? "active-sort" : ""}`}
                        onClick={() => handleCertSort("name")}
                        title="Sort by Names"
                    >
                        <span>Names</span>
                        {renderSortIcon("name", certSortConfig)}
                    </span>

                    <span
                        className={`emp-cert-col-provider emp-sortable-header ${certSortConfig.key === "provider" ? "active-sort" : ""}`}
                        onClick={() => handleCertSort("provider")}
                        title="Sort by Provider"
                    >
                        <span>Provider</span>
                        {renderSortIcon("provider", certSortConfig)}
                    </span>

                    <span
                        className={`emp-cert-col-schedule emp-sortable-header ${certSortConfig.key === "schedule" ? "active-sort" : ""}`}
                        onClick={() => handleCertSort("schedule")}
                        title="Sort by Schedule Dates"
                    >
                        <span>Date & Validity</span>
                        {renderSortIcon("schedule", certSortConfig)}
                    </span>

                    <span className="emp-cert-col-action">
                        <span>Actions</span>
                    </span>
                </div>

                {/* Scrollable Certificates Rows List */}
                <div className="emp-my-certs-cards-list">
                    {isLoading ? (
                        <div className="emp-cert-skeleton-list" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                            {Array.from({ length: 6 }).map((_, idx) => (
                                <div key={`cert-skel-${idx}`} className="emp-my-certs-card-wrapper">
                                    <div className="emp-my-certs-card-row">
                                        <div className="emp-cert-col-name" style={{ gap: 10 }}>
                                            <span className="ld-skeleton-block" style={{ width: 30, height: 30, borderRadius: 6 }} />
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                <span className="ld-skeleton-block" style={{ width: 140, height: 14, borderRadius: 4 }} />
                                                <span className="ld-skeleton-block" style={{ width: 90, height: 11, borderRadius: 4 }} />
                                            </div>
                                        </div>
                                        <div className="emp-cert-col-provider">
                                            <span className="ld-skeleton-block" style={{ width: 100, height: 14, borderRadius: 4 }} />
                                        </div>
                                        <div className="emp-cert-col-schedule">
                                            <span className="ld-skeleton-block" style={{ width: 110, height: 14, borderRadius: 4 }} />
                                        </div>
                                        <div className="emp-cert-col-action" style={{ gap: 8, justifyContent: "flex-end" }}>
                                            <span className="ld-skeleton-block" style={{ width: 28, height: 28, borderRadius: 6 }} />
                                            <span className="ld-skeleton-block" style={{ width: 28, height: 28, borderRadius: 6 }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : sortedCertificates.length === 0 ? (
                        <div className="emp-empty-cert-state">
                            <img
                                src={openBookIcon}
                                alt="No Certifications Found"
                                className="emp-empty-cert-icon"
                            />
                            <h3>No Certifications Found</h3>
                        </div>
                    ) : (
                        paginatedCertificates.map((cert) => renderCertificateRow(cert))
                    )}
                </div>

                {/* Pagination INSIDE the table view */}
                {!isLoading && sortedCertificates.length > 0 && (
                    <Pagination
                        currentPage={safeCertPage}
                        setCurrentPage={setCurrentPage}
                        total={sortedCertificates.length}
                        itemsPerPage={certsItemsPerPage}
                        type="Certificates"
                    />
                )}
            </div>
        </div>
    );
}
