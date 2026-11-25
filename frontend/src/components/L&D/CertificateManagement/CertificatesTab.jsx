import React from "react";
import blueEyeIcon from "../../../assets/L&D/blue eye.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import TableSkeletonRows from "../../common/TableSkeletonRows";
import { getEmployeeAvatarBg } from "../../../utils/avatarUtils";
import { RANK_COLORS } from "../../../services/leaderboardService";

export default function CertificatesTab({ certificates = [], isLoading = false, onViewDetails }) {
    return (
        <table className="ld-cm-table ld-cm-cert-table">
            <colgroup>
                <col style={{ width: "19%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
                <tr>
                    <th>Employee</th>
                    <th>Certificate</th>
                    <th>Provider</th>
                    <th>Submitted On</th>
                    <th>Amount</th>
                    <th>Exam Scheduled On</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {isLoading || certificates === null ? (
                    <TableSkeletonRows rows={5} columns={7} />
                ) : certificates.length > 0 ? (
                    certificates.map((item, idx) => (
                        <tr key={`${item.id}-${idx}`}>
                            {/* Employee */}
                            <td>
                                <div className="ld-cm-emp-cell">
                                    <div
                                        className="ld-cm-emp-avatar"
                                        style={{ backgroundColor: item.avatarBg || RANK_COLORS[idx % RANK_COLORS.length] }}
                                    >
                                        {item.initials}
                                    </div>
                                    <span className="ld-cm-emp-name" title={item.name}>{item.name}</span>
                                </div>
                            </td>

                            {/* Certificate */}
                            <td>
                                <div style={{ minWidth: 0, overflow: "hidden" }}>
                                    <div className="ld-cm-cert-title" title={item.certificate}>
                                        {item.certificate}
                                    </div>
                                    <div className="ld-cm-cert-id">{item.id}</div>
                                </div>
                            </td>

                            {/* Provider */}
                            <td>
                                <span className="ld-cm-regular-text ld-cm-provider-text" title={item.provider}>
                                    {item.provider}
                                </span>
                            </td>

                            {/* Submitted On */}
                            <td>
                                <span className="ld-cm-regular-text">{item.submittedOn}</span>
                            </td>

                            {/* Amount */}
                            <td>
                                <span className="ld-cm-amount-text">{item.amount}</span>
                            </td>

                            {/* Exam Scheduled On */}
                            <td>
                                <span className="ld-cm-regular-text">{item.examScheduledOn}</span>
                            </td>

                            {/* Action */}
                            <td>
                                <button
                                    type="button"
                                    className="ld-cm-view-btn"
                                    onClick={() => onViewDetails && onViewDetails(item)}
                                    title="View details"
                                >
                                    <img src={blueEyeIcon} alt="View" className="ld-cm-eye-icon" />
                                </button>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr className="ld-empty-table-row">
                        <td colSpan={7} className="ld-empty-table-cell">
                            <div className="ld-empty-table-state">
                                <img
                                    src={openBookIcon}
                                    alt="No certificates"
                                    className="ld-empty-table-icon"
                                />
                                <span>No certificates recorded yet.</span>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
