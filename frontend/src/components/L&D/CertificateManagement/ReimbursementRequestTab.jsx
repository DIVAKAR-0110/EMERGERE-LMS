import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { getEmployeeAvatarBg } from "../../../utils/avatarUtils";
import { RANK_COLORS } from "../../../services/leaderboardService";
import { getApprovalHighlightKey } from "../../../utils/notificationHighlight";

// Parse date string to timestamp for chronological sorting
const parseDateMs = (dStr) => {
    if (!dStr || dStr === "—" || dStr === "Pending" || dStr === "Recent") return 0;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

// Parse amount string to number (e.g., "₹6,500" -> 6500)
const parseAmount = (val) => {
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.]/g, "");
    return parseFloat(clean) || 0;
};

export default function ReimbursementRequestTab({ reimbursements = [], isLoading = false, highlightedItemId = null }) {
    const isWaiting = Boolean(isLoading);
    const highlightedRowRef = useRef(null);

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

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
            return <ArrowUpDown size={12} className="ld-aw-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={12} className="ld-aw-sort-icon active" />
        ) : (
            <ArrowDown size={12} className="ld-aw-sort-icon active" />
        );
    };

    // Reset to page 1 on data count or sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [reimbursements?.length, sortConfig]);

    // If highlightedItemId is passed, auto-navigate to its page
    useEffect(() => {
        if (!highlightedItemId || !Array.isArray(reimbursements) || reimbursements.length === 0) return;
        const itemIndex = reimbursements.findIndex(
            (item) => getApprovalHighlightKey(item) === String(highlightedItemId)
        );
        if (itemIndex !== -1) {
            const targetPage = Math.floor(itemIndex / pageSize) + 1;
            setCurrentPage(targetPage);
        }
    }, [highlightedItemId, reimbursements, pageSize]);

    // Sort reimbursements based on active sort configuration
    const sortedReimbursements = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction || !Array.isArray(reimbursements)) {
            return reimbursements;
        }

        return [...reimbursements].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "id": {
                    const idA = String(a.id || "").trim();
                    const idB = String(b.id || "").trim();
                    comparison = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
                    break;
                }
                case "employee": {
                    const nameA = String(a.employee || "").trim();
                    const nameB = String(b.employee || "").trim();
                    comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
                    break;
                }
                case "certificate": {
                    const certA = String(a.certificate || "").trim();
                    const certB = String(b.certificate || "").trim();
                    comparison = certA.localeCompare(certB, undefined, { sensitivity: "base" });
                    break;
                }
                case "provider": {
                    const provA = String(a.provider || "").trim();
                    const provB = String(b.provider || "").trim();
                    comparison = provA.localeCompare(provB, undefined, { sensitivity: "base" });
                    break;
                }
                case "amount": {
                    comparison = parseAmount(a.amount) - parseAmount(b.amount);
                    break;
                }
                case "submittedOn": {
                    const dateA = parseDateMs(a.submittedOn || a.submitted_on || a.created_at);
                    const dateB = parseDateMs(b.submittedOn || b.submitted_on || b.created_at);
                    comparison = dateA - dateB;
                    break;
                }
                case "approvedOn": {
                    const rawA = a.raw?.approved_on || (a.approvedOn !== "Pending" && a.approvedOn !== "N/A" && a.approvedOn !== "—" ? a.approvedOn : null);
                    const rawB = b.raw?.approved_on || (b.approvedOn !== "Pending" && b.approvedOn !== "N/A" && b.approvedOn !== "—" ? b.approvedOn : null);
                    const dateA = rawA ? parseDateMs(rawA) : 0;
                    const dateB = rawB ? parseDateMs(rawB) : 0;
                    if (dateA !== dateB) {
                        comparison = dateA - dateB;
                    } else {
                        const strA = String(a.approvedOn || "").trim().toLowerCase();
                        const strB = String(b.approvedOn || "").trim().toLowerCase();
                        comparison = strA.localeCompare(strB, undefined, { sensitivity: "base" });
                    }
                    break;
                }
                case "status": {
                    const stA = String(a.status || "").trim().toLowerCase();
                    const stB = String(b.status || "").trim().toLowerCase();
                    comparison = stA.localeCompare(stB, undefined, { sensitivity: "base" });
                    break;
                }
                default:
                    break;
            }
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [reimbursements, sortConfig]);

    const totalCount = Array.isArray(sortedReimbursements) ? sortedReimbursements.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);

    const startItem = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endItem = Math.min(safePage * pageSize, totalCount);

    const paginatedReimbursements = useMemo(() => {
        if (!Array.isArray(sortedReimbursements)) return [];
        const start = (safePage - 1) * pageSize;
        return sortedReimbursements.slice(start, start + pageSize);
    }, [sortedReimbursements, safePage, pageSize]);

    const getPageNumbers = () => {
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (safePage <= 2) {
            return [1, 2, "dots", totalPages];
        }
        if (safePage >= totalPages - 1) {
            return [1, "dots", totalPages - 1, totalPages];
        }
        return [safePage - 1, safePage, "dots", totalPages];
    };

    useEffect(() => {
        if (!highlightedItemId || !highlightedRowRef.current) return;
        const t = setTimeout(() => {
            highlightedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [highlightedItemId, reimbursements]);

    const tableContainerRef = useRef(null);

    return (
        <div className="ld-aw-table-card">
            <div
                className={`ld-aw-table-scroll-container ${paginatedReimbursements.length === 0 ? "ld-table-container-empty" : ""}`}
                ref={tableContainerRef}
            >
                <table className={`ld-cm-table ld-cm-reimb-table ${paginatedReimbursements.length >= pageSize || paginatedReimbursements.length === 0 ? "ld-table-fill" : ""}`}>
                    <colgroup>
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "19%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "11%" }} />
                        <col style={{ width: "13%" }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("id")}
                                title="Sort by Request ID"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Request ID</span>
                                    {renderSortIcon("id")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("employee")}
                                title="Sort by Employee"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Employee</span>
                                    {renderSortIcon("employee")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("certificate")}
                                title="Sort by Certificate / Course"
                            >
                                <div className="ld-aw-th-content">
                                    <span> Course / Certification </span>
                                    {renderSortIcon("certificate")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("provider")}
                                title="Sort by Provider"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Provider</span>
                                    {renderSortIcon("provider")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("amount")}
                                title="Sort by Amount"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Amount</span>
                                    {renderSortIcon("amount")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("submittedOn")}
                                title="Sort by Submitted On"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Submitted On</span>
                                    {renderSortIcon("submittedOn")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("approvedOn")}
                                title="Sort by Approved On"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Approved On</span>
                                    {renderSortIcon("approvedOn")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("status")}
                                title="Sort by Status"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Status</span>
                                    {renderSortIcon("status")}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isWaiting ? (
                            <TableSkeletonRows rows={pageSize} columns={8} />
                        ) : paginatedReimbursements.length > 0 ? (
                            paginatedReimbursements.map((item, idx) => {
                                const badgeClass =
                                    item.status === "Paid"
                                        ? "paid"
                                        : item.status === "In Progress"
                                            ? "in-progress"
                                            : item.status === "Rejected"
                                                ? "rejected"
                                                : "submitted-to-hr";

                                const isHighlighted =
                                    Boolean(highlightedItemId) &&
                                    getApprovalHighlightKey(item) === String(highlightedItemId);

                                return (
                                    <tr
                                        key={`${item.id}-${idx}`}
                                        ref={isHighlighted ? highlightedRowRef : null}
                                        data-request-id={item.id}
                                        className={isHighlighted ? "aw-row-highlighted" : ""}
                                    >
                                        {/* Request ID */}
                                        <td className="ld-aw-cell-id">
                                            <div className="aw-id-highlight-wrap">
                                                <span className="ld-aw-request-id-text">
                                                    {item.id}
                                                </span>
                                                {isHighlighted && (
                                                    <span className="aw-notif-highlight-badge">Selected Claim</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Employee */}
                                        <td>
                                            <div className="ld-cm-emp-cell ld-cm-emp-cell-vertical">
                                                <span className="ld-cm-emp-name" title={item.employee}>{item.employee}</span>
                                                {(item.empId || item.employeeId || item.raw?.employee_id) && (
                                                    <span
                                                        className="ld-cm-emp-id"
                                                        title={item.empId || item.employeeId || item.raw?.employee_id}
                                                    >
                                                        {item.empId || item.employeeId || item.raw?.employee_id}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Certificate / Course */}
                                        <td className="ld-cm-cell-cert">
                                            <div
                                                className="ld-cm-reimb-cert-title"
                                                title={item.certificate}
                                            >
                                                <span>{item.certificate}</span>
                                            </div>
                                        </td>

                                        {/* Provider */}
                                        <td className="ld-cm-cell-provider">
                                            <span className="ld-cm-regular-text ld-cm-provider-text" title={item.provider}>
                                                {item.provider}
                                            </span>
                                        </td>

                                        {/* Amount */}
                                        <td>
                                            <span className="ld-cm-amount-text">
                                                {item.amount}
                                            </span>
                                        </td>

                                        {/* Submitted On */}
                                        <td>
                                            <span className="ld-cm-regular-text">{item.submittedOn}</span>
                                        </td>

                                        {/* Approved On */}
                                        <td>
                                            <span className="ld-cm-regular-text">
                                                {item.approvedOn === "Pending" || !item.approvedOn || item.approvedOn === "—"
                                                    ? "N/A"
                                                    : item.approvedOn}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td>
                                            <span className={`ld-cm-status-badge ${badgeClass}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr className="ld-empty-table-row">
                                <td colSpan={8} className="ld-empty-table-cell">
                                    <div className="ld-empty-table-state">
                                        <img
                                            src={openBookIcon}
                                            alt="No reimbursement requests"
                                            className="ld-empty-table-icon"
                                        />
                                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No reimbursement requests recorded yet.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Pagination Footer */}
            <div className="ld-directory-footer">
                <span>Showing {startItem} to {endItem} of {totalCount} requests</span>

                <div className="ld-pagination-controls">
                    <button
                        type="button"
                        className="ld-page-btn"
                        disabled={safePage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        title="Previous Page"
                        aria-label="Previous Page"
                    >
                        <ChevronLeft size={14} />
                    </button>

                    {getPageNumbers().map((item, index) => {
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
                                className={`ld-page-btn ${safePage === item ? "active" : ""}`}
                                onClick={() => setCurrentPage(item)}
                            >
                                {item}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        className="ld-page-btn"
                        disabled={safePage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        title="Next Page"
                        aria-label="Next Page"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
