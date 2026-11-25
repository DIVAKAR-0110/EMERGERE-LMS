import React from "react";

/**
 * Reusable Table Skeleton Rows Component
 * Renders pulse skeleton rows for tables across LMS modules (L&D, CEO, HR, Employee).
 *
 * @param {number} rows - Number of skeleton rows to render (default 5)
 * @param {number} columns - Number of columns per row (default 6)
 * @param {Array<string|number>} columnWidths - Optional array of width strings/numbers per column
 */
export default function TableSkeletonRows({ rows = 5, columns = 6, columnWidths = [] }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, rIdx) => (
                <tr key={`skel-row-${rIdx}`} className="ld-table-skeleton-row">
                    {Array.from({ length: columns }).map((_, cIdx) => {
                        const width = columnWidths[cIdx] || (cIdx === 0 ? "65%" : cIdx === columns - 1 ? "40px" : "80%");
                        return (
                            <td key={`skel-cell-${rIdx}-${cIdx}`} className="ld-table-skeleton-cell">
                                <span
                                    className="ld-skeleton-block"
                                    style={{
                                        width: typeof width === "number" ? `${width}px` : width,
                                        height: "16px",
                                    }}
                                />
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );
}
