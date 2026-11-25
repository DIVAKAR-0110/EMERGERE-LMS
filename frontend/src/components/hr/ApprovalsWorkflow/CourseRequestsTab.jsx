import React, { useState, useMemo, useEffect, useRef } from "react";
import { Check, X, MoreVertical, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import { getApprovalHighlightKey } from "../../../utils/notificationHighlight";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import blackdownarrowIcon from "../../../assets/Certification/blackdownarrow.svg";
import blackrightarrowIcon from "../../../assets/Certification/blackrightarrow.svg";
import HRWorkflowTimeline from "./HRWorkflowTimeline";

const isItemPaid = (item) => Boolean(
    !item ? false : (
        String(item.payment_status || item.processingStatus || item.raw?.payment_status || "").toLowerCase() === "paid" ||
        item.status === "Paid" ||
        item.raw?.status === "Paid" ||
        item.paid_on ||
        item.payment_code ||
        item.payment_slip_path ||
        item.raw?.paid_on ||
        item.raw?.payment_code ||
        item.raw?.payment_slip_path
    )
);

export default function CourseRequestsTab({
    requests = [],
    statusFilter = "All",
    isLoading = false,
    highlightedItemId = null,
    onApprove,
    onReject,
    onViewDetails,
}) {
    const highlightedRowRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [expandedRowId, setExpandedRowId] = useState(null);

    const toggleExpand = (id) => {
        setExpandedRowId((prev) => (prev === id ? null : id));
    };

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
            return <ArrowUpDown size={12} className="hr-aw-sort-icon inactive" />;
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp size={12} className="hr-aw-sort-icon active" />
        ) : (
            <ArrowDown size={12} className="hr-aw-sort-icon active" />
        );
    };

    // Reset to page 1 on filter, data count, or sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [requests?.length, statusFilter, sortConfig]);

    useEffect(() => {
        if (!highlightedItemId || !highlightedRowRef.current) return;
        const t = setTimeout(() => {
            highlightedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [highlightedItemId, requests]);

    // If highlightedItemId is passed, auto-navigate to its page
    useEffect(() => {
        if (!highlightedItemId || !Array.isArray(requests) || requests.length === 0) return;
        const itemIndex = requests.findIndex(
            (item) => getApprovalHighlightKey(item) === String(highlightedItemId)
        );
        if (itemIndex !== -1) {
            const targetPage = Math.floor(itemIndex / pageSize) + 1;
            setCurrentPage(targetPage);
        }
    }, [highlightedItemId, requests, pageSize]);

    // Sort requests based on active sort configuration
    const sortedRequests = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction || !Array.isArray(requests)) {
            return requests;
        }

        return [...requests].sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case "id": {
                    const idA = String(a.id || "").trim();
                    const idB = String(b.id || "").trim();
                    comparison = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
                    break;
                }
                case "employee": {
                    const nameA = String(a.name || a.employeeName || "").trim();
                    const nameB = String(b.name || b.employeeName || "").trim();
                    comparison = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
                    break;
                }
                case "department": {
                    const deptA = String(a.department || a.title || "").trim();
                    const deptB = String(b.department || b.title || "").trim();
                    comparison = deptA.localeCompare(deptB, undefined, { sensitivity: "base" });
                    break;
                }
                case "course": {
                    const cA = String(a.course || a.courseTitle || "").trim();
                    const cB = String(b.course || b.courseTitle || "").trim();
                    comparison = cA.localeCompare(cB, undefined, { sensitivity: "base" });
                    break;
                }
                case "requestDate": {
                    const dateA = new Date(a.requestDate || a.date || a.raw?.created_at || 0).getTime();
                    const dateB = new Date(b.requestDate || b.date || b.raw?.created_at || 0).getTime();
                    comparison = dateA - dateB;
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
    }, [requests, sortConfig]);

    const totalCount = Array.isArray(sortedRequests) ? sortedRequests.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);

    const startItem = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endItem = Math.min(safePage * pageSize, totalCount);

    const paginatedRequests = useMemo(() => {
        if (!Array.isArray(sortedRequests)) return [];
        const start = (safePage - 1) * pageSize;
        return sortedRequests.slice(start, start + pageSize);
    }, [sortedRequests, safePage, pageSize]);

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

    const renderPagination = (extraClass = "") => (
        <div className={`hr-aw-pagination-footer ${extraClass}`}>
            <span>Showing {startItem} to {endItem} of {totalCount} requests</span>

            <div className="hr-aw-pagination-controls">
                <button
                    type="button"
                    className="hr-aw-page-btn"
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
                            <span key={`dots-${index}`} className="hr-aw-pagination-ellipsis">
                                ...
                            </span>
                        );
                    }
                    return (
                        <button
                            key={`page-${item}`}
                            type="button"
                            className={`hr-aw-page-btn ${safePage === item ? "active" : ""}`}
                            onClick={() => setCurrentPage(item)}
                        >
                            {item}
                        </button>
                    );
                })}

                <button
                    type="button"
                    className="hr-aw-page-btn"
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="Next Page"
                    aria-label="Next Page"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="hr-aw-requests-container">
            {/* Desktop Table View */}
            <div className="hr-aw-table-card">
                <div className={`hr-aw-table-scroll-container ${paginatedRequests.length === 0 ? "is-empty" : ""}`}>
                    <table className={`hr-aw-table hr-aw-course-table ${paginatedRequests.length === 0 ? "is-empty" : ""}`}>
                        <colgroup>
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "16%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "21%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "9%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th
                                    className="hr-aw-th-sortable"
                                    onClick={() => handleSort("id")}
                                    title="Sort by Request ID"
                                >
                                    <div className="hr-aw-th-content">
                                        <span>Request ID</span>
                                        {renderSortIcon("id")}
                                    </div>
                                </th>
                                <th
                                    className="hr-aw-th-sortable"
                                    onClick={() => handleSort("employee")}
                                    title="Sort by Employee"
                                >
                                    <div className="hr-aw-th-content">
                                        <span>Employee</span>
                                        {renderSortIcon("employee")}
                                    </div>
                                </th>
                                <th
                                    className="hr-aw-th-sortable"
                                    onClick={() => handleSort("department")}
                                    title="Sort by Department"
                                >
                                    <div className="hr-aw-th-content">
                                        <span>Department</span>
                                        {renderSortIcon("department")}
                                    </div>
                                </th>
                                <th
                                    className="hr-aw-th-sortable"
                                    onClick={() => handleSort("course")}
                                    title="Sort by Course"
                                >
                                    <div className="hr-aw-th-content">
                                        <span>Course</span>
                                        {renderSortIcon("course")}
                                    </div>
                                </th>
                                <th
                                    className="hr-aw-th-sortable"
                                    onClick={() => handleSort("requestDate")}
                                    title="Sort by Request Date"
                                >
                                    <div className="hr-aw-th-content">
                                        <span>Request Date</span>
                                        {renderSortIcon("requestDate")}
                                    </div>
                                </th>
                                <th
                                    className="hr-aw-th-sortable"
                                    onClick={() => handleSort("status")}
                                    title="Sort by Status"
                                >
                                    <div className="hr-aw-th-content">
                                        <span>Status</span>
                                        {renderSortIcon("status")}
                                    </div>
                                </th>
                                <th style={{ textAlign: "center" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading || requests === null ? (
                                <TableSkeletonRows columns={7} rows={4} />
                            ) : paginatedRequests.length === 0 ? (
                                <tr className="hr-empty-table-row">
                                    <td colSpan={7} className="hr-empty-table-cell">
                                        <div className="hr-empty-table-state">
                                            <img src={openBookIcon} alt="" className="hr-empty-table-icon" />
                                            <span>No {statusFilter !== "All" ? statusFilter.toLowerCase() : ""} requests found.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRequests.map((item, index) => {
                                    const isHighlighted =
                                        Boolean(highlightedItemId) &&
                                        getApprovalHighlightKey(item) === String(highlightedItemId);
                                    const isExpanded = expandedRowId === item.id;
                                    return (
                                        <React.Fragment key={`${item.id}-${index}`}>
                                            <tr
                                                ref={isHighlighted ? highlightedRowRef : null}
                                                data-request-id={item.id}
                                                className={`${isHighlighted ? "aw-row-highlighted" : ""} ${isExpanded ? "hr-aw-row-expanded" : ""}`}
                                            >
                                                {/* Request ID */}
                                                <td className="hr-aw-cell-id">
                                                    <div className="aw-id-highlight-wrap">
                                                        <span className="hr-aw-request-id-text">
                                                            {item.id}
                                                        </span>
                                                        {isHighlighted && (
                                                            <span className="aw-notif-highlight-badge">Selected Request</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Employee */}
                                                <td>
                                                    <div className="hr-aw-employee-cell">
                                                        <div className="hr-aw-employee-meta">
                                                            <span className="hr-aw-employee-name" title={item.name}>{item.name}</span>
                                                            {(item.empId || item.employeeId || item.employee_id || item.raw?.employee_id) && (
                                                                <span className="hr-aw-employee-title" title={item.empId || item.employeeId || item.employee_id || item.raw?.employee_id}>
                                                                    {item.empId || item.employeeId || item.employee_id || item.raw?.employee_id}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Department */}
                                                <td>
                                                    <span className="hr-aw-course-name" title={item.department || item.title || "—"}>
                                                        {item.department || item.title || "—"}
                                                    </span>
                                                </td>

                                                {/* Course Name */}
                                                <td>
                                                    <span className="hr-aw-course-name">
                                                        {item.course}
                                                    </span>
                                                </td>

                                                {/* Request Date */}
                                                <td className="hr-aw-cell-date">{item.requestDate}</td>

                                                {/* Status */}
                                                <td>
                                                    {item.status === "Pending" ? (
                                                        <span className="hr-aw-badge-pending">Pending</span>
                                                    ) : item.status === "Rejected" ? (
                                                        <span className="hr-aw-badge-rejected">Rejected</span>
                                                    ) : isItemPaid(item) ? (
                                                        <span className="hr-aw-badge-paid">Paid</span>
                                                    ) : (
                                                        <span className="hr-aw-badge-approved">Approved</span>
                                                    )}
                                                </td>

                                                {/* Action */}
                                                <td className="hr-aw-cell-action">
                                                    <div className="hr-aw-action-btns-wrap">
                                                        <button
                                                            type="button"
                                                            className="hr-aw-eye-btn"
                                                            onClick={() => onViewDetails && onViewDetails(item)}
                                                            title="View Course Approval Details"
                                                        >
                                                            <img
                                                                src={blueEyeIcon}
                                                                alt="View Details"
                                                                style={{ width: "13px", height: "9px", display: "block" }}
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`hr-aw-expand-btn ${isExpanded ? "expanded" : ""}`}
                                                            onClick={() => toggleExpand(item.id)}
                                                            title={isExpanded ? "Hide Workflow Timeline" : "View Workflow Timeline"}
                                                            aria-label={isExpanded ? "Hide Workflow Timeline" : "View Workflow Timeline"}
                                                            aria-expanded={isExpanded}
                                                        >
                                                            <img
                                                                src={isExpanded ? blackdownarrowIcon : blackrightarrowIcon}
                                                                alt=""
                                                                style={isExpanded ? { width: 9, height: 5 } : { width: 5, height: 9 }}
                                                            />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Workflow Timeline Row */}
                                            {isExpanded && (
                                                <tr className="hr-aw-timeline-row">
                                                    <td colSpan={7} className="hr-aw-timeline-cell">
                                                        <HRWorkflowTimeline
                                                            title="Course Request Workflow"
                                                            item={item}
                                                            type="course"
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Pagination Footer for Table Card */}
                {renderPagination()}
            </div>

            {/* Responsive Card List (Tablet & Mobile) */}
            <div className="hr-aw-cards-list">
                {paginatedRequests.length === 0 ? (
                    <div className="hr-aw-cards-empty">
                        <img src={openBookIcon} alt="" className="hr-empty-table-icon" />
                        <span>No {statusFilter !== "All" ? statusFilter.toLowerCase() : ""} requests found.</span>
                    </div>
                ) : (
                    paginatedRequests.map((item, index) => (
                        <div key={`${item.id}-${index}`} className="hr-aw-card-item">
                            {/* Top header row: ID on left, 3-dots on right */}
                            <div className="hr-aw-card-top">
                                <button
                                    type="button"
                                    className="hr-aw-card-id"
                                    onClick={() => onViewDetails && onViewDetails(item)}
                                    title="View Course Approval Details"
                                >
                                    {item.id}
                                </button>
                                <button
                                    type="button"
                                    className="hr-aw-card-dots"
                                    onClick={() => onViewDetails && onViewDetails(item)}
                                    aria-label="View Details"
                                >
                                    <MoreVertical size={16} />
                                </button>
                            </div>

                            {/* Card Content Row */}
                            <div className="hr-aw-card-main">
                                <div className="hr-aw-card-user-info">
                                    <div className="hr-aw-card-meta">
                                        <span className="hr-aw-card-emp-name">{item.name}</span>
                                        <span className="hr-aw-card-emp-title">{item.department || item.title || "—"}</span>
                                    </div>
                                </div>

                                <div className="hr-aw-card-course-info">
                                    <span className="hr-aw-card-course-title">{item.course}</span>
                                    <span className="hr-aw-card-date">{item.requestDate}</span>
                                </div>

                                <div className="hr-aw-card-status-col">
                                    {item.status === "Pending" ? (
                                        <span className="hr-aw-badge-pending">Pending</span>
                                    ) : item.status === "Rejected" ? (
                                        <span className="hr-aw-badge-rejected">Rejected</span>
                                    ) : isItemPaid(item) ? (
                                        <span className="hr-aw-badge-paid">Paid</span>
                                    ) : (
                                        <span className="hr-aw-badge-approved">Approved</span>
                                    )}
                                    <button
                                        type="button"
                                        className={`hr-aw-expand-btn ${expandedRowId === item.id ? "expanded" : ""}`}
                                        onClick={() => toggleExpand(item.id)}
                                        title={expandedRowId === item.id ? "Hide Workflow Timeline" : "View Workflow Timeline"}
                                        style={{ marginLeft: 6 }}
                                    >
                                        <img
                                            src={expandedRowId === item.id ? blackdownarrowIcon : blackrightarrowIcon}
                                            alt=""
                                            style={expandedRowId === item.id ? { width: 9, height: 5 } : { width: 5, height: 9 }}
                                        />
                                    </button>
                                </div>
                            </div>
                            {expandedRowId === item.id && (
                                <div className="hr-aw-card-timeline-wrap">
                                    <HRWorkflowTimeline
                                        title="Course Request Workflow"
                                        item={item}
                                        type="course"
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}
                {/* Pagination for Card List on Mobile/Tablet */}
                {renderPagination("hr-aw-cards-pagination")}
            </div>
        </div>
    );
}
