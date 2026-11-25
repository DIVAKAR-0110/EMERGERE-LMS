import React, { useState, useEffect } from "react";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import downloadIcon from "../../../assets/reportsanalytics/download.svg";
import { useAuth } from "../../../context/AuthContext";
import { fetchAllEmployees, fetchReimbursementClaims } from "../../../services/teamService";

function buildDepartmentSummary(employees = [], claims = []) {
  const map = {};
  employees.forEach((emp) => {
    const dept = emp.department || "Other";
    if (!map[dept]) {
      map[dept] = {
        department: dept,
        teamSize: 0,
        activeLearners: 0,
        hours: 0,
        coursesDone: 0,
        certs: 0,
      };
    }
    map[dept].teamSize += 1;
    if ((emp.learning_status || emp.learningStatus) === "Active") {
      map[dept].activeLearners += 1;
    }
    const hrs = typeof emp.hours === "string" ? parseFloat(emp.hours) || 0 : (emp.total_learning_hours || 0);
    map[dept].hours += hrs;
    map[dept].coursesDone += (emp.courses ?? emp.courses_count ?? 0);
    map[dept].certs += (emp.certificates ?? emp.certificates_count ?? emp.certifications ?? 0);
  });

  claims.forEach((c) => {
    const dept = c.department || "Other";
    if (!map[dept]) {
      map[dept] = {
        department: dept,
        teamSize: 0,
        activeLearners: 0,
        hours: 0,
        coursesDone: 0,
        certs: 0,
      };
    }
  });

  return Object.values(map).sort((a, b) => b.teamSize - a.teamSize);
}

export default function ViewLearningReportModal({
  isOpen,
  onClose,
  onOpenDownload,
  departmentSummary: propSummary,
}) {
  const { token } = useAuth();
  const [liveSummary, setLiveSummary] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || propSummary) return;
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [empData, claimsData] = await Promise.all([
          fetchAllEmployees(token),
          fetchReimbursementClaims(token)
        ]);
        if (isMounted) {
          const employees = Array.isArray(empData) ? empData : empData?.employees || [];
          const claims = Array.isArray(claimsData) ? claimsData : [];
          setLiveSummary(buildDepartmentSummary(employees, claims));
        }
      } catch (err) {
        console.warn("[ViewLearningReportModal] Failed to load live department summary:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [isOpen, propSummary, token]);

  if (!isOpen) return null;

  const departmentSummary = [];

  return (
    <div className="hr-modal-overlay">
      <div
        className="hr-modal-content hr-view-report-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="hr-modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <img src={closeIcon} alt="Close" width={10} height={10} />
        </button>

        <div className="hr-modal-header">
          <h2 className="hr-modal-title">Overall Employee Learning Report Preview</h2>
          <p className="hr-modal-subtitle">
            Organization-wide team summaries, learning hours, and completion metrics.
          </p>
        </div>

        <div className="hr-view-report-table-wrap">
          {isLoading && data.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
              Loading real-time learning report data...
            </div>
          ) : data.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
              No departmental learning records found in database.
            </div>
          ) : (
            <table className="hr-view-report-table">
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
                {data.map((dept) => (
                  <tr key={dept.department}>
                    <td className="hr-td-dept-name">{dept.department}</td>
                    <td>{dept.teamSize}</td>
                    <td>{dept.activeLearners}</td>
                    <td>{Math.round(dept.hours)}h</td>
                    <td>{dept.coursesDone}</td>
                    <td>{dept.certs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="hr-modal-actions">
          <button type="button" className="hr-btn-cancel" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="hr-btn-download-action"
            onClick={() => {
              onClose();
              onOpenDownload?.();
            }}
          >
            <img src={downloadIcon} alt="Download" className="hr-action-btn-icon" />
            <span>Download Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
