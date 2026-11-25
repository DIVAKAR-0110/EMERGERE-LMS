import React, { useState, useEffect } from "react";
import { X, Download, FileText } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchTeamMembers } from "../../../services/teamService";

export default function ViewReportModal({ isOpen, onClose, onOpenDownload, reportSummary: propSummary }) {
    const { token } = useAuth();
    const [liveSummary, setLiveSummary] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || propSummary) return;
        let isMounted = true;
        const load = async () => {
            setIsLoading(true);
            try {
                const members = await fetchTeamMembers(token);
                if (isMounted && Array.isArray(members)) {
                    const depts = {};
                    members.forEach((m) => {
                        const dept = m.department || "—";
                        if (!depts[dept]) {
                            depts[dept] = {
                                department: dept,
                                teamSize: 0,
                                activeLearners: 0,
                                hours: 0,
                                completed: 0,
                                certs: 0,
                            };
                        }
                        depts[dept].teamSize += 1;
                        if ((m.learningStatus || m.learning_status) === "Active") {
                            depts[dept].activeLearners += 1;
                        }
                        depts[dept].hours += Number(m.hours || m.total_learning_hours || 0);
                        depts[dept].completed += Number(m.completedCourses || m.courses_completed || 0);
                        depts[dept].certs += Number(m.certificates || m.certifications_count || 0);
                    });
                    setLiveSummary(Object.values(depts));
                }
            } catch (err) {
                console.warn("[ViewReportModal] Failed to load team summary:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [isOpen, propSummary, token]);

    if (!isOpen) return null;

    const data = propSummary || liveSummary;

    return (
        <div className="rm-ra-modal-overlay">
            <div className="rm-ra-modal-content rm-ra-view-report-modal" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="rm-ra-modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                <div className="rm-ra-modal-header">
                    <h2 className="rm-ra-modal-title">Overall Employee Learning Report Preview</h2>
                    <p className="rm-ra-modal-subtitle">
                        Organization-wide team summaries, learning hours, and completion metrics.
                    </p>
                </div>

                <div style={{ overflowX: "auto", maxHeight: "360px" }}>
                    {isLoading && data.length === 0 ? (
                        <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                            Loading real-time team report data...
                        </div>
                    ) : data.length === 0 ? (
                        <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                            No team learning records found in database.
                        </div>
                    ) : (
                        <table className="rm-ra-report-summary-table">
                            <thead>
                                <tr>
                                    <th>Department</th>
                                    <th>Team Size</th>
                                    <th>Active Learners</th>
                                    <th>Total Hours</th>
                                    <th>Courses Done</th>
                                    <th>Certificates</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => (
                                    <tr key={row.department}>
                                        <td style={{ fontWeight: 500 }}>{row.department}</td>
                                        <td>{row.teamSize}</td>
                                        <td>{row.activeLearners}</td>
                                        <td>{Math.round(row.hours)}h</td>
                                        <td>{row.completed}</td>
                                        <td>{row.certs}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="rm-ra-modal-actions">
                    <button type="button" className="rm-ra-btn-cancel" onClick={onClose}>
                        Close
                    </button>
                    <button
                        type="button"
                        className="rm-ra-btn-download-action"
                        onClick={() => {
                            onClose();
                            onOpenDownload?.();
                        }}
                    >
                        <Download size={14} />
                        <span>Download Report</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
