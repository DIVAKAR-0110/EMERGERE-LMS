import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, X, ChevronRight, ChevronLeft, ChevronDown, CornerDownRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import { getApprovalHighlightKey } from "../../../utils/notificationHighlight";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";
import blueCheckIcon from "../../../assets/course_library/bluecheck.svg";
import greenCheckIcon from "../../../assets/course_library/greencheck.svg";
import clockIcon from "../../../assets/course_library/clock.svg";
import circleDotIcon from "../../../assets/course_library/CircleDot.svg";

const getTrackerStepIcon = (status) => {
    switch (status) {
        case "completed":
        case "approved":
            return blueCheckIcon;
        case "completed_final":
            return greenCheckIcon;
        case "pending":
            return clockIcon;
        case "upcoming":
        default:
            return circleDotIcon;
    }
};

// Parse date string to timestamp for chronological sorting
const parseDateMs = (dStr) => {
    if (!dStr || dStr === "—") return 0;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

export default function CourseRequestsTab({
    requests = [],
    isLoading = false,
    statusFilter = "All",
    highlightedItemId = null,
    onApprove,
    onReject,
    onUndoReject,
    onViewDetails,
    currentAdminId,
    currentUser,
}) {
    const isWaiting = Boolean(isLoading);
    const highlightedRowRef = useRef(null);
    const [expandedKey, setExpandedKey] = useState(null);

    const toggleExpand = (key) => {
        setExpandedKey((prevKey) => (prevKey === key ? null : key));
    };

    const getCourseSteps = (item) => {
        if (Array.isArray(item.steps) && item.steps.length > 0) {
            return item.steps;
        }
        const raw = item.raw || {};
        const reqDateStr = raw.created_at ? raw.created_at.slice(0, 10) : (item.requestDate || "—");
        const rmDateStr = raw.notified_reporting_manager
            ? (typeof raw.notified_reporting_manager === "string" ? raw.notified_reporting_manager.slice(0, 10) : reqDateStr)
            : reqDateStr;
        const isLdApproved =
            String(raw.ld_status || item.ld_status || "").toLowerCase() === "approved" ||
            String(raw.ld_stage_status || "").toLowerCase() === "completed" ||
            String(item.status || "").toLowerCase() === "approved";
        const isLdRejected =
            String(raw.ld_status || item.ld_status || "").toLowerCase() === "rejected" ||
            String(raw.ld_stage_status || "").toLowerCase() === "rejected" ||
            String(item.status || "").toLowerCase() === "rejected";
        const ldDateStr = raw.ld_status_date ? raw.ld_status_date.slice(0, 10) : (isLdApproved ? reqDateStr : (isLdRejected ? "Rejected" : "Pending"));
        const isCeoApproved = raw.ceo_status === "Approved";
        const isCeoRejected = raw.ceo_status === "Rejected";
        const isCeoBypassed = Boolean(raw.is_ceo_bypassed);
        const ceoDateStr = isLdRejected
            ? "—"
            : isCeoApproved
                ? (raw.ceo_status_date ? raw.ceo_status_date.slice(0, 10) : "Approved")
                : (isCeoRejected ? "Rejected" : (isLdApproved ? "Pending" : "—"));

        const isPurchased = raw.purchase_status === "Purchased";
        const purchaseDateStr = isLdRejected || isCeoRejected
            ? "—"
            : isPurchased
                ? (raw.purchase_date ? raw.purchase_date.slice(0, 10) : "Purchased")
                : (isCeoApproved || isCeoBypassed ? "Pending" : "—");

        const s3Status = isLdRejected ? "rejected" : (isLdApproved ? "completed" : "pending");
        const s4Status = isLdRejected || isCeoRejected
            ? "rejected"
            : (isCeoApproved || isCeoBypassed ? "completed" : (isLdApproved ? "pending" : "upcoming"));
        const s5Status = isLdRejected || isCeoRejected
            ? "rejected"
            : isPurchased
                ? "completed_final"
                : ((isCeoApproved || isCeoBypassed) ? "pending" : "upcoming");

        return [
            { label: "Employee Request", date: reqDateStr, done: true, status: "completed" },
            { label: "Notified to RM", date: rmDateStr, done: true, status: "completed" },
            {
                label: "L&D Approval",
                date: isLdRejected ? "Rejected" : (isLdApproved ? ldDateStr : "Pending"),
                done: isLdApproved,
                status: s3Status
            },
            {
                label: isCeoBypassed ? "Bypassed by L&D" : "CEO Approval",
                date: isCeoBypassed ? (ldDateStr || "Bypassed") : ceoDateStr,
                done: !isLdRejected && (isCeoApproved || isCeoBypassed),
                status: s4Status
            },
            {
                label: "Course Purchased",
                date: purchaseDateStr,
                done: !isLdRejected && !isCeoRejected && isPurchased,
                status: s5Status
            },
        ];
    };

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

    // Reset to page 1 on filter, data count, or sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [requests?.length, statusFilter, sortConfig]);

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
                    const dateA = parseDateMs(a.requestDate || a.date || a.raw?.created_at);
                    const dateB = parseDateMs(b.requestDate || b.date || b.raw?.created_at);
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

    useEffect(() => {
        if (!highlightedItemId || !highlightedRowRef.current) return;
        const t = setTimeout(() => {
            highlightedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [highlightedItemId, requests]);

    const tableContainerRef = useRef(null);

    return (
        <div className="ld-aw-table-card">
            <div
                className={`ld-aw-table-scroll-container ${paginatedRequests.length === 0 ? "ld-table-container-empty" : ""}`}
                ref={tableContainerRef}
            >
                <table className={`ld-aw-table ld-aw-course-table ${paginatedRequests.length >= pageSize || paginatedRequests.length === 0 ? "ld-table-fill" : ""}`}>
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
                                onClick={() => handleSort("department")}
                                title="Sort by Department"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Department</span>
                                    {renderSortIcon("department")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("course")}
                                title="Sort by Course"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Course</span>
                                    {renderSortIcon("course")}
                                </div>
                            </th>
                            <th
                                className="ld-aw-th-sortable"
                                onClick={() => handleSort("requestDate")}
                                title="Sort by Request Date"
                            >
                                <div className="ld-aw-th-content">
                                    <span>Request Date</span>
                                    {renderSortIcon("requestDate")}
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
                            <th className="ld-aw-th-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isWaiting ? (
                            <TableSkeletonRows rows={pageSize} columns={7} />
                        ) : paginatedRequests.length === 0 ? (
                            <tr className="ld-empty-table-row">
                                <td colSpan={7} className="ld-empty-table-cell">
                                    <div className="ld-empty-table-state">
                                        <img
                                            src={openBookIcon}
                                            alt="No course requests"
                                            className="ld-empty-table-icon"
                                        />
                                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#7f7f7f" }}>No {statusFilter !== "All" ? statusFilter.toLowerCase() : ""} course requests recorded yet.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedRequests.map((item, index) => {
                                const isHighlighted =
                                    Boolean(highlightedItemId) &&
                                    getApprovalHighlightKey(item) === String(highlightedItemId);
                                const itemKey = item.new_course_id ? `course-${item.new_course_id}` : (item.id ? `${item.id}-${index}` : `course-req-${index}`);
                                const isExpanded = expandedKey === itemKey;
                                const steps = getCourseSteps(item);

                                return (
                                    <React.Fragment key={itemKey}>
                                        <tr
                                            ref={isHighlighted ? highlightedRowRef : null}
                                            data-request-id={item.id}
                                            className={`${isHighlighted ? "aw-row-highlighted" : ""} ${isExpanded ? "ld-aw-parent-row-expanded" : ""}`}
                                        >
                                            {/* Request ID */}
                                            <td className="ld-aw-cell-id">
                                                <div className="aw-id-highlight-wrap">
                                                    <span className="ld-aw-request-id-text">
                                                        {item.id}
                                                    </span>
                                                    {isHighlighted && (
                                                        <span className="aw-notif-highlight-badge">Selected Request</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Employee */}
                                            <td className="ld-aw-cell-employee">
                                                <div className="ld-aw-employee-cell">
                                                    <div className="ld-aw-employee-meta">
                                                        <span className="ld-aw-employee-name" title={item.name}>{item.name}</span>
                                                        {(item.empId || item.employeeId || item.title) && (
                                                            <span className="ld-aw-employee-title" title={item.empId || item.employeeId || item.title}>
                                                                {item.empId || item.employeeId || item.title}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Department */}
                                            <td className="ld-aw-cell-department">
                                                <span className="ld-aw-course-name" title={item.department}>
                                                    {item.department || "—"}
                                                </span>
                                            </td>

                                            {/* Course Name */}
                                            <td className="ld-aw-cell-course">
                                                <span className="ld-aw-course-name" title={item.course}>
                                                    {item.course}
                                                </span>
                                            </td>

                                            {/* Request Date */}
                                            <td className="ld-aw-cell-date">{item.requestDate}</td>

                                            {/* Status */}
                                            <td>
                                                {item.status === "Pending" ? (
                                                    <span className="ld-aw-badge-pending">
                                                        Pending
                                                    </span>
                                                ) : item.status === "Approved" ? (
                                                    <span className="ld-aw-badge-approved">Approved</span>
                                                ) : (
                                                    <span className="ld-aw-badge-rejected">Rejected</span>
                                                )}
                                            </td>

                                            {/* Action (Eye + Workflow Chevron) */}
                                            <td className="ld-aw-cell-action">
                                                <div className="ld-aw-history-action-group">
                                                    <button
                                                        type="button"
                                                        className="ld-aw-history-eye-btn"
                                                        title="View Course Approval Details"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onViewDetails && onViewDetails(item);
                                                        }}
                                                    >
                                                        <img
                                                            src={blueEyeIcon}
                                                            alt="View Details"
                                                            style={{ width: "13px", height: "9px", display: "block" }}
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="ld-aw-history-chevron-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleExpand(itemKey);
                                                        }}
                                                        title={isExpanded ? "Collapse Workflow" : "View Workflow"}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown size={16} />
                                                        ) : (
                                                            <ChevronRight size={16} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Dropdown View Workflow Drawer */}
                                        {isExpanded && (
                                            <tr className="ld-aw-expanded-row">
                                                <td colSpan={7} style={{ padding: "0 16px 14px 16px", background: "#FFFFFF", borderBottom: "1px solid #DDE0EE" }}>
                                                    <div className="ld-aw-history-drawer" style={{ margin: "0" }}>
                                                        {/* Subcard (Left Info Box) */}
                                                        <div className="ld-aw-history-subcard">
                                                            <div className="ld-aw-history-subcard-icon">
                                                                <CornerDownRight size={14} color="#215EF8" />
                                                            </div>
                                                            <div className="ld-aw-history-subcard-details">
                                                                <span className="ld-aw-history-subcard-name" title={item.name}>
                                                                    {item.name}
                                                                </span>
                                                                <span className="ld-aw-history-subcard-course" title={item.course}>
                                                                    {item.course}
                                                                </span>
                                                                <span className="ld-aw-history-subcard-date">
                                                                    {steps[0]?.date || (item.raw?.created_at ? item.raw.created_at.slice(0, 10) : item.requestDate)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* 5-Step Stepper (Right Pipeline) */}
                                                        <div className="ld-aw-history-stepper">
                                                            {steps.map((step, sIdx) => {
                                                                const isLast = sIdx === steps.length - 1;
                                                                const isRejected = step.status === "rejected" || step.date?.toLowerCase() === "rejected";
                                                                let stepStatus = step.status;
                                                                if (!stepStatus) {
                                                                    if (isRejected) {
                                                                        stepStatus = "rejected";
                                                                    } else if (step.done) {
                                                                        stepStatus = isLast ? "completed_final" : "completed";
                                                                    } else {
                                                                        stepStatus = "upcoming";
                                                                    }
                                                                }

                                                                return (
                                                                    <React.Fragment key={step.label}>
                                                                        <div className="ld-aw-hstepper-node">
                                                                            <div className="ld-aw-hstepper-icon-wrapper">
                                                                                {stepStatus === "rejected" ? (
                                                                                    <div
                                                                                        className="ld-aw-hstepper-circle rejected"
                                                                                        style={{
                                                                                            width: 22,
                                                                                            height: 22,
                                                                                            borderRadius: "50%",
                                                                                            background: "#EF4444",
                                                                                            border: "1.5px solid #DC2626",
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            justifyContent: "center",
                                                                                            color: "#FFFFFF",
                                                                                            fontSize: 11,
                                                                                            fontWeight: "bold",
                                                                                            margin: 0,
                                                                                            flexShrink: 0
                                                                                        }}
                                                                                        title="Rejected"
                                                                                    >
                                                                                        ✕
                                                                                    </div>
                                                                                ) : (
                                                                                    <img
                                                                                        src={getTrackerStepIcon(stepStatus)}
                                                                                        alt={stepStatus}
                                                                                        className="ld-aw-hstepper-icon-img"
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <span className="ld-aw-hstepper-label">{step.label}</span>
                                                                            <span className={`ld-aw-hstepper-date ${(stepStatus === "rejected" || isRejected) && step.date !== "—" && step.date !== "-" ? "rejected" : ""}`}>{step.date || "—"}</span>
                                                                        </div>
                                                                        {!isLast && <div className="ld-aw-hstepper-dotted-line" />}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
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
