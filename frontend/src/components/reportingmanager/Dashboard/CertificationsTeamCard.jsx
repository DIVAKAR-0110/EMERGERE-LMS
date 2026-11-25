import React, { useState, useEffect, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import eye from "../../../assets/coursemanagement/eye.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { useNavigate } from "react-router-dom";
import { fetchTeamCertifications } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

// Parse date string to timestamp for chronological sorting
const parseDateMs = (dStr) => {
    if (!dStr || dStr === "—" || dStr === "-" || dStr.toLowerCase() === "lifetime" || dStr.toLowerCase() === "never") return 0;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

const renderSortIcon = (columnKey, sortConfig) => {
    if (sortConfig.key !== columnKey) {
        return <ArrowUpDown size={12} className="rm-sort-icon inactive" />;
    }
    return sortConfig.direction === "asc" ? (
        <ArrowUp size={12} className="rm-sort-icon active" />
    ) : (
        <ArrowDown size={12} className="rm-sort-icon active" />
    );
};

export default function CertificationsTeamCard() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const resolvedToken = token || localStorage.getItem("lms_token");
    const [certs, setCerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

    useEffect(() => {
        let isMounted = true;
        const loadTeamCerts = async () => {
            try {
                setIsLoading(true);
                const res = await fetchTeamCertifications(resolvedToken);
                if (isMounted) {
                    setCerts(res.certifications || []);
                }
            } catch (err) {
                console.error("Failed to load team certifications for card:", err);
                if (isMounted) {
                    setCerts([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        if (resolvedToken) {
            loadTeamCerts();
        } else {
            setIsLoading(false);
        }
        return () => {
            isMounted = false;
        };
    }, [resolvedToken]);

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

    const sortedCerts = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) {
            return certs;
        }
        const { key, direction } = sortConfig;
        return [...certs].sort((a, b) => {
            let res = 0;
            if (key === "employee") {
                const nameA = ((a.name || a.employeeName) || "").trim();
                const nameB = ((b.name || b.employeeName) || "").trim();
                res = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
            } else if (key === "certification") {
                const certA = ((a.certification || a.certificate) || "").trim();
                const certB = ((b.certification || b.certificate) || "").trim();
                res = certA.localeCompare(certB, undefined, { sensitivity: "base" });
            } else if (key === "status") {
                const statA = (a.status || "").trim();
                const statB = (b.status || "").trim();
                res = statA.localeCompare(statB, undefined, { sensitivity: "base" });
            } else if (key === "expiryDate") {
                const dateA = parseDateMs(a.expiryDate || a.expiry_date);
                const dateB = parseDateMs(b.expiryDate || b.expiry_date);
                res = dateA - dateB;
            }
            return direction === "asc" ? res : -res;
        });
    }, [certs, sortConfig]);

    // Only display the last 3 certifications
    const displayedCerts = useMemo(() => {
        return sortedCerts.slice(0, 3);
    }, [sortedCerts]);

    const handleViewAll = () => {
        navigate("/reporting-manager/learning-records?tab=certification");
    };

    return (
        <div className="rm-card rm-certs-team-card">
            <div className="rm-card-header rm-header-with-action">
                <h3 className="rm-card-title">
                    Certifications of Team Members
                </h3>
                <button
                    type="button"
                    className="rm-view-all-btn"
                    onClick={handleViewAll}
                    aria-label="View all certifications"
                >
                    <img src={eye} className="rm-view-all-icon" alt="View" />
                    <span>View All</span>
                </button>
            </div>

            <div className="rm-certs-table-wrapper">
                <table className={`rm-certs-table ${!isLoading && certs.length === 0 ? "rm-table-empty" : ""}`}>
                    <thead>
                        <tr>
                            <th
                                className={`rm-th-cert-employee rm-sortable-th ${sortConfig.key === "employee" ? "active-sort" : ""}`}
                                onClick={() => handleSort("employee")}
                                title="Sort by Employee"
                            >
                                <div className="rm-th-sortable">
                                    <span>Employee</span>
                                    {renderSortIcon("employee", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-cert-name rm-sortable-th ${sortConfig.key === "certification" ? "active-sort" : ""}`}
                                onClick={() => handleSort("certification")}
                                title="Sort by Certification"
                            >
                                <div className="rm-th-sortable">
                                    <span>Certification</span>
                                    {renderSortIcon("certification", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-cert-status rm-sortable-th ${sortConfig.key === "status" ? "active-sort" : ""}`}
                                onClick={() => handleSort("status")}
                                title="Sort by Status"
                            >
                                <div className="rm-th-sortable">
                                    <span>Status</span>
                                    {renderSortIcon("status", sortConfig)}
                                </div>
                            </th>
                            <th
                                className={`rm-th-cert-expiry rm-sortable-th ${sortConfig.key === "expiryDate" ? "active-sort" : ""}`}
                                onClick={() => handleSort("expiryDate")}
                                title="Sort by Expiry Date"
                            >
                                <div className="rm-th-sortable">
                                    <span>Expiry Date</span>
                                    {renderSortIcon("expiryDate", sortConfig)}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            [1, 2, 3].map((i) => (
                                <tr key={`rm-cert-skel-${i}`} className="rm-table-row rm-certs-skeleton-row" style={{ pointerEvents: "none" }}>
                                    {/* Employee */}
                                    <td className="rm-td-cert-employee" data-label="Employee">
                                        <div className="rm-avatar-pill">
                                            <div className="rm-emp-details">
                                                <span className="ld-skeleton-block" style={{ width: "90px", height: "13px", borderRadius: "4px" }} />
                                                <span className="ld-skeleton-block" style={{ width: "50px", height: "10px", borderRadius: "3px", marginTop: "3px" }} />
                                            </div>
                                        </div>
                                    </td>

                                    {/* Certification Title */}
                                    <td className="rm-td-cert-name" data-label="Certification">
                                        <span className="ld-skeleton-block" style={{ width: "130px", height: "14px", borderRadius: "4px" }} />
                                    </td>

                                    {/* Status */}
                                    <td className="rm-td-cert-status" data-label="Status">
                                        <span className="ld-skeleton-block" style={{ width: "52px", height: "18px", borderRadius: "9px" }} />
                                    </td>

                                    {/* Expiry Date */}
                                    <td className="rm-td-cert-expiry" data-label="Expiry Date">
                                        <span className="ld-skeleton-block" style={{ width: "72px", height: "14px", borderRadius: "4px" }} />
                                    </td>
                                </tr>
                            ))
                        ) : displayedCerts.length > 0 ? (
                            displayedCerts.map((cert) => (
                                <tr key={cert.id} className="rm-table-row">
                                    {/* Employee */}
                                    <td className="rm-td-cert-employee" data-label="Employee" title={`${cert.name || cert.employeeName}${cert.employeeId || cert.employee_id ? ` (${cert.employeeId || cert.employee_id})` : ""}`}>
                                        <div className="rm-avatar-pill">
                                            <div className="rm-emp-details">
                                                <span className="rm-member-name">{cert.name || cert.employeeName}</span>
                                                {(cert.employeeId || cert.employee_id) && (
                                                    <span className="rm-emp-id-sub">{cert.employeeId || cert.employee_id}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Certification Title */}
                                    <td className="rm-td-cert-name" data-label="Certification">
                                        <span className="rm-cert-title-text">
                                            {cert.certification || cert.certificate}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="rm-td-cert-status" data-label="Status">
                                        <span className={`rm-cert-badge ${cert.statusType || "active"}`}>
                                            {cert.status || "—"}
                                        </span>
                                    </td>

                                    {/* Expiry Date */}
                                    <td className="rm-td-cert-expiry" data-label="Expiry Date">
                                        <span className="rm-cert-expiry-text">
                                            {cert.expiryDate || "—"}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr className="rm-empty-state-row">
                                <td colSpan={4} className="rm-empty-state-cell">
                                    <div className="rm-empty-state-content">
                                        <img
                                            src={openBookIcon}
                                            alt="No learning activities"
                                            className="emp-recent-log-empty-icon"
                                        />
                                        <span className="rm-empty-state-text">
                                            No team certifications earned yet.
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

