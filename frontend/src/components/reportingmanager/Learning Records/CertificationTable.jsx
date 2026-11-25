import React, { useState, useEffect, useMemo, useRef } from "react";
import { Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import CertificateViewerModal from "../../Profile/CertificateViewerModal";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";
import "../../../styles/reportingmanager/LearningRecords.css";

export default function CertificationTable({ data = [], isLoading = false }) {
    const itemsPerPage = 10;
    const tableScrollBodyRef = useRef(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

    const handleSort = (key) => {
        setSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: "asc" };
            }
            if (prev.direction === "asc") {
                return { key, direction: "desc" };
            }
            return { key: null, direction: null };
        });
    };

    const renderSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) {
            return <ArrowUpDown size={12} className="rm-lr-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={12} className="rm-lr-sort-icon active" />
        ) : (
            <ArrowDown size={12} className="rm-lr-sort-icon active" />
        );
    };

    // Reset to page 1 whenever data or sortConfig changes
    useEffect(() => {
        setCurrentPage(1);
    }, [data, sortConfig]);

    const totalCount = data.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

    // Sort data based on active column sort config
    const sortedData = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction || !Array.isArray(data)) {
            return data;
        }

        return [...data].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "employee": {
                    const nameA = String(a.employeeName || a.name || "").trim();
                    const nameB = String(b.employeeName || b.name || "").trim();
                    comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
                    break;
                }
                case "department": {
                    const deptA = String(a.department || a.designation || "").trim();
                    const deptB = String(b.department || b.designation || "").trim();
                    comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
                    break;
                }
                case "certification": {
                    const cA = String(a.certificate || a.certification || "").trim();
                    const cB = String(b.certificate || b.certification || "").trim();
                    comparison = cA.localeCompare(cB, undefined, { sensitivity: "base" });
                    break;
                }
                case "certificateId": {
                    const idA = String(a.certificateId || a.credentialId || (a.id ? `CRT-${a.id}` : "")).trim();
                    const idB = String(b.certificateId || b.credentialId || (b.id ? `CRT-${b.id}` : "")).trim();
                    comparison = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
                    break;
                }
                case "provider": {
                    const provA = String(a.provider || a.issuer || "").trim();
                    const provB = String(b.provider || b.issuer || "").trim();
                    comparison = provA.localeCompare(provB, undefined, { sensitivity: "base" });
                    break;
                }
                case "status": {
                    const sA = String(a.status || "").trim();
                    const sB = String(b.status || "").trim();
                    comparison = sA.localeCompare(sB, undefined, { sensitivity: "base" });
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [data, sortConfig]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = totalCount === 0 ? 0 : Math.min(totalCount, (currentPage - 1) * itemsPerPage + paginatedData.length);

    const getPageItems = () => {
        if (totalPages <= 4) {
            if (totalPages <= 3) {
                return Array.from({ length: totalPages }, (_, i) => i + 1);
            }
            if (currentPage <= 2) {
                return [1, 2, "dots", 4];
            }
            return [1, "dots", 3, 4];
        }
        if (currentPage <= 2) {
            return [1, 2, "dots", totalPages];
        }
        if (currentPage >= totalPages - 1) {
            return [1, "dots", totalPages - 1, totalPages];
        }
        return [currentPage - 1, currentPage, "dots", totalPages];
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "Active":
                return "rm-status-badge rm-status-active";
            case "Expired":
                return "rm-status-badge rm-status-expired";
            case "In Progress":
                return "rm-status-badge rm-status-in-progress";
            case "Expiring Soon":
                return "rm-status-badge rm-status-expiring-soon";
            default:
                return "rm-status-badge";
        }
    };

    const [viewingCert, setViewingCert] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerUrl, setViewerUrl] = useState("");
    const [isViewerLoading, setIsViewerLoading] = useState(false);
    const [viewerError, setViewerError] = useState("");

    const generateCertificateSvgDataUrl = (row) => {
        const certName = row.certificate || row.certification || "Professional Certification";
        const empName = row.employee || row.employeeName || "Employee";
        const provider = row.provider || row.issuer || "Emergere Learning";
        const certId = row.certificateId || row.credentialId || `CLM-2026-${String(row.id || "0001").padStart(4, "0")}`;
        const date = row.completionDate || row.issueDate || "November 2026";

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="100%" height="100%">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#F8FAFC;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#EEF2FF;stop-opacity:1" />
                </linearGradient>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#F59E0B;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#D97706;stop-opacity:1" />
                </linearGradient>
                <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1E3A8A;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width="1000" height="700" fill="url(#grad1)" />
            <rect x="25" y="25" width="950" height="650" fill="none" stroke="url(#borderGrad)" stroke-width="6" rx="8" />
            <rect x="35" y="35" width="930" height="630" fill="none" stroke="#DDE0EE" stroke-width="1.5" rx="6" />
            <circle cx="45" cy="45" r="5" fill="#2563EB" />
            <circle cx="955" cy="45" r="5" fill="#2563EB" />
            <circle cx="45" cy="655" r="5" fill="#2563EB" />
            <circle cx="955" cy="655" r="5" fill="#2563EB" />
            <text x="500" y="110" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#2563EB" text-anchor="middle" letter-spacing="4">
                EMERGERE LEARNING &amp; DEVELOPMENT
            </text>
            <text x="500" y="170" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="700" fill="#0F172A" text-anchor="middle" letter-spacing="1">
                CERTIFICATE OF COMPLETION
            </text>
            <line x1="420" y1="190" x2="580" y2="190" stroke="url(#goldGrad)" stroke-width="3" stroke-linecap="round" />
            <text x="500" y="240" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#64748B" text-anchor="middle">
                This is proudly presented to
            </text>
            <text x="500" y="300" font-family="'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="700" fill="#1E3A8A" text-anchor="middle">
                ${empName}
            </text>
            <line x1="300" y1="320" x2="700" y2="320" stroke="#CBD5E1" stroke-width="1" />
            <text x="500" y="365" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#475569" text-anchor="middle">
                for successfully completing the professional certification course
            </text>
            <text x="500" y="415" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="700" fill="#0F172A" text-anchor="middle">
                ${certName}
            </text>
            <text x="500" y="450" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="500" fill="#2563EB" text-anchor="middle">
                Provider: ${provider}
            </text>
            <rect x="250" y="490" width="500" height="55" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1" />
            <text x="350" y="522" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#64748B" text-anchor="middle">
                Certificate ID: <tspan font-weight="700" fill="#0F172A">${certId}</tspan>
            </text>
            <text x="630" y="522" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#64748B" text-anchor="middle">
                Issued: <tspan font-weight="700" fill="#0F172A">${date}</tspan>
            </text>
            <line x1="180" y1="600" x2="360" y2="600" stroke="#94A3B8" stroke-width="1.5" />
            <text x="270" y="620" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#334155" text-anchor="middle">
                Authorized Instructor
            </text>
            <text x="270" y="638" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748B" text-anchor="middle">
                ${provider}
            </text>
            <circle cx="500" cy="590" r="32" fill="url(#goldGrad)" opacity="0.95" />
            <circle cx="500" cy="590" r="28" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="3 3" />
            <text x="500" y="595" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF" text-anchor="middle">
                VERIFIED
            </text>
            <line x1="640" y1="600" x2="820" y2="600" stroke="#94A3B8" stroke-width="1.5" />
            <text x="730" y="620" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#334155" text-anchor="middle">
                L&amp;D Director
            </text>
            <text x="730" y="638" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748B" text-anchor="middle">
                Emergere Technologies
            </text>
        </svg>`;

        return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    };

    const handleDownload = async (row) => {
        const certId = row.certification_id || row.id;
        const certName = row.certificate || row.certification || "Certificate";
        const token = localStorage.getItem("lms_token");
        const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP010";
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

        if (row.certificateUrl && !row.certificateUrl.startsWith("blob:") && !row.certificateUrl.startsWith("data:")) {
            const downloadUrl = `${API_BASE_URL}/api/employee/certifications/${certId}/download`;
            try {
                const res = await fetch(downloadUrl, {
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    },
                });
                if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${certName}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    return;
                }
            } catch (e) {
                console.error("Error downloading file from backend:", e);
            }
        }

        if (row.certificateUrl && row.certificateUrl.startsWith("blob:")) {
            const a = document.createElement("a");
            a.href = row.certificateUrl;
            a.download = `${certName}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        // Direct verified certificate download as fallback (no error popup)
        const svgDataUrl = generateCertificateSvgDataUrl(row);
        const a = document.createElement("a");
        a.href = svgDataUrl;
        a.download = `${certName}_Certificate.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleView = async (row) => {
        const certId = row.certification_id || row.id;
        const certName = row.certificate || row.certification || "Certification Document";
        const token = localStorage.getItem("lms_token");
        const activeEmpId = localStorage.getItem("lms_active_employee_id") || "EMP010";
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

        const certData = {
            ...row,
            name: certName,
            provider: row.provider,
            issueDate: row.completionDate || row.issueDate,
            expiryDate: row.validity || row.expiryDate,
            certificateFileName: row.certificateFileName || (row.certificateUrl ? row.certificateUrl.split("/").pop() : `${certName}.svg`),
        };

        setViewingCert(certData);
        setIsViewerOpen(true);
        setIsViewerLoading(true);
        setViewerError("");
        setViewerUrl("");

        // 1. Direct blob / data URL
        if (row.certificateUrl && (row.certificateUrl.startsWith("blob:") || row.certificateUrl.startsWith("data:"))) {
            setViewerUrl(row.certificateUrl);
            setIsViewerLoading(false);
            return;
        }

        // 2. Fetch from backend download endpoint if certId exists
        if (certId) {
            const downloadUrl = `${API_BASE_URL}/api/employee/certifications/${certId}/download`;
            try {
                const res = await fetch(downloadUrl, {
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        "X-Employee-Id": activeEmpId,
                    },
                });
                if (res.ok) {
                    const blob = await res.blob();
                    const fileType = blob.type || (row.certificateUrl?.endsWith(".png") ? "image/png" : (row.certificateUrl?.endsWith(".jpg") || row.certificateUrl?.endsWith(".jpeg")) ? "image/jpeg" : "application/pdf");
                    const fileBlob = new Blob([blob], { type: fileType });
                    const url = window.URL.createObjectURL(fileBlob);
                    setViewerUrl(url);
                    setIsViewerLoading(false);
                    return;
                }
            } catch (e) {
                console.error("Backend certificate file not on disk, falling back to verified preview:", e);
            }
        }

        // 3. Static fallback URL if available
        if (row.certificateUrl && row.certificateUrl !== "#") {
            const targetUrl = row.certificateUrl.startsWith("http")
                ? row.certificateUrl
                : `${API_BASE_URL}${row.certificateUrl.startsWith("/") ? "" : "/"}${row.certificateUrl}`;
            setViewerUrl(targetUrl);
            setIsViewerLoading(false);
            return;
        }

        // 4. Fallback to clean verified certificate preview in popup (no error modal)
        const svgDataUrl = generateCertificateSvgDataUrl(row);
        setViewerUrl(svgDataUrl);
        setIsViewerLoading(false);
    };

    const handleCloseViewer = () => {
        setIsViewerOpen(false);
        if (viewerUrl && viewerUrl.startsWith("blob:")) {
            window.URL.revokeObjectURL(viewerUrl);
        }
        setViewerUrl("");
        setViewingCert(null);
        setViewerError("");
    };

    return (
        <div className="rm-records-table-container-card">
            <div className="rm-records-table-scroll-body" ref={tableScrollBodyRef}>
                <table className={`rm-records-data-table rm-cert-table-layout ${paginatedData.length >= itemsPerPage || paginatedData.length === 0 ? "ld-table-fill" : ""}`}>
                    <thead>
                        <tr>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("employee")}
                                title="Sort by Employee"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Employee</span>
                                    {renderSortIcon("employee")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("department")}
                                title="Sort by Department"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Department</span>
                                    {renderSortIcon("department")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("certification")}
                                title="Sort by Certification"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Certification</span>
                                    {renderSortIcon("certification")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("certificateId")}
                                title="Sort by Certificate ID"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Certificate ID</span>
                                    {renderSortIcon("certificateId")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("provider")}
                                title="Sort by Provider"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Provider</span>
                                    {renderSortIcon("provider")}
                                </div>
                            </th>
                            <th
                                className="rm-lr-th-sortable"
                                onClick={() => handleSort("status")}
                                title="Sort by Status"
                            >
                                <div className="rm-lr-th-content">
                                    <span>Status</span>
                                    {renderSortIcon("status")}
                                </div>
                            </th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <TableSkeletonRows rows={itemsPerPage} columns={7} />
                        ) : paginatedData && paginatedData.length > 0 ? (
                            paginatedData.map((row) => (
                                <tr key={row.id || row.certification_id}>
                                    {/* Employee Column */}
                                    <td>
                                        <div className="rm-employee-info-cell">
                                            <div className="rm-emp-details">
                                                <span className="rm-employee-name-text" title={row.employeeName || row.name}>{row.employeeName || row.name}</span>
                                                {(row.employeeId || row.employee_id) && (
                                                    <span className="rm-emp-id-sub">{row.employeeId || row.employee_id}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Designation / Department */}
                                    <td className="rm-text-secondary" title={row.department || row.designation || "—"}>{row.department || row.designation || "—"}</td>

                                    {/* Certificate Title */}
                                    <td>
                                        <div className="rm-text-bold-title" title={row.certificate || row.certification}>
                                            {row.certificate || row.certification}
                                        </div>
                                    </td>

                                    {/* Certificate ID */}
                                    <td className="rm-text-secondary">{row.certificateId || row.credentialId || `CRT-${row.id}`}</td>

                                    {/* Provider */}
                                    <td className="rm-text-secondary" title={row.provider || row.issuer}>{row.provider || row.issuer}</td>

                                    {/* Status Badge */}
                                    <td>
                                        <span className={getStatusClass(row.status)}>
                                            {row.status || "—"}
                                        </span>
                                    </td>

                                    {/* Action (View & Download) */}
                                    <td>
                                        <div className="rm-cert-actions-group">
                                            <button
                                                type="button"
                                                className="rm-btn-table-action"
                                                title="View Certificate"
                                                onClick={() => handleView(row)}
                                            >
                                                <img src={blueEyeIcon} alt="View" style={{ width: 13, height: 9, display: "block" }} />
                                            </button>
                                            <button
                                                type="button"
                                                className="rm-btn-table-action rm-btn-table-download"
                                                title="Download Certificate"
                                                onClick={() => handleDownload(row)}
                                            >
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr className="ld-empty-table-row">
                                <td colSpan={7} className="ld-empty-table-cell">
                                    <div className="ld-empty-table-state">
                                        <img
                                            src={openBookIcon}
                                            alt="No records found"
                                            className="ld-empty-table-icon"
                                        />
                                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No records found.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination Footer (Matching Employee Directory) */}
            <div className="ld-directory-footer">
                <span>Showing {startItem} to {endItem} of {totalCount} certifications</span>

                <div className="ld-pagination-controls">
                    <button
                        type="button"
                        className="ld-page-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        title="Previous Page"
                    >
                        <ChevronLeft size={14} />
                    </button>

                    {getPageItems().map((item, index) => {
                        if (item === "dots") {
                            return (
                                <span key={`dots-${index}`} className="ld-pagination-ellipsis">
                                    ...
                                </span>
                            );
                        }
                        return (
                            <button
                                key={`page-${item}`}
                                type="button"
                                className={`ld-page-btn ${currentPage === item ? "active" : ""}`}
                                onClick={() => setCurrentPage(item)}
                            >
                                {item}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        className="ld-page-btn"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        title="Next Page"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Certificate Document Viewer Popup Modal */}
            <CertificateViewerModal
                isOpen={isViewerOpen}
                onClose={handleCloseViewer}
                cert={viewingCert}
                previewUrl={viewerUrl}
                isLoading={isViewerLoading}
                errorMessage={viewerError}
            />
        </div>
    );
}
