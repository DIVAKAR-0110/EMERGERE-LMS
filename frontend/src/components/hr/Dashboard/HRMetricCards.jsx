import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchAllEmployees,
  fetchCEOBudgetStats,
  fetchCertifiedEmployeesCount,
} from "../../../services/teamService";
import totalEmployeesIcon from "../../../assets/hr/Dashboard/totalemployees.svg";
import certifiedEmployeesIcon from "../../../assets/hr/Dashboard/certified-employees.svg";
import alertsIcon from "../../../assets/hr/Dashboard/alerts.svg";
import budgetIcon from "../../../assets/hr/Dashboard/budget.svg";
import metricBg from "../../../assets/hr/Dashboard/background.svg";
import bluebiglineSvg from "../../../assets/Certification/bluebigline.svg";

const DEFAULT_METRICS = [
  {
    id: "total-employees",
    title: "Total Employees",
    value: null,
    icon: totalEmployeesIcon,
    alt: "Total Employees",
  },
  {
    id: "certified-employees",
    title: "Certified Employees",
    value: null,
    icon: certifiedEmployeesIcon,
    alt: "Certified Employees",
  },
  {
    id: "pending-claims",
    title: "Pending Claim",
    value: null,
    icon: alertsIcon,
    alt: "Pending Claim",
  },
  {
    id: "budget-utilised",
    title: "Budget Utilised",
    value: null,
    icon: budgetIcon,
    alt: "Budget Utilised",
  },
];

export default function HRMetricCards({
  metrics = DEFAULT_METRICS,
  totalEmployeesCount,
  pendingClaimsCount,
  certifiedEmployeesCount,
  budgetUtilisedPercent,
  isLoading: externalLoading,
}) {
  const { token } = useAuth();
  const [liveEmployeeCount, setLiveEmployeeCount] = useState(totalEmployeesCount ?? null);
  const [liveCertifiedCount, setLiveCertifiedCount] = useState(
    certifiedEmployeesCount !== undefined && certifiedEmployeesCount !== null
      ? certifiedEmployeesCount
      : null
  );
  const [liveBudgetUtilised, setLiveBudgetUtilised] = useState(
    budgetUtilisedPercent !== undefined && budgetUtilisedPercent !== null
      ? budgetUtilisedPercent
      : null
  );
  const [internalLoading, setInternalLoading] = useState(
    totalEmployeesCount === undefined || certifiedEmployeesCount === undefined || budgetUtilisedPercent === undefined
  );

  useEffect(() => {
    if (totalEmployeesCount !== undefined && totalEmployeesCount !== null) {
      setLiveEmployeeCount(totalEmployeesCount);
      return;
    }
    let isMounted = true;
    const loadEmployeeCount = async () => {
      try {
        const emps = await fetchAllEmployees(token);
        if (isMounted && Array.isArray(emps)) {
          setLiveEmployeeCount(emps.length);
        }
      } catch (err) {
        console.warn("Failed to fetch employees count from Azure AD:", err);
        if (isMounted) setLiveEmployeeCount(0);
      } finally {
        if (isMounted) setInternalLoading(false);
      }
    };
    loadEmployeeCount();
    return () => {
      isMounted = false;
    };
  }, [token, totalEmployeesCount]);

  useEffect(() => {
    if (certifiedEmployeesCount !== undefined && certifiedEmployeesCount !== null) {
      setLiveCertifiedCount(certifiedEmployeesCount);
      return;
    }
    let isMounted = true;
    const loadCertifiedCount = async () => {
      try {
        const count = await fetchCertifiedEmployeesCount(token);
        if (isMounted && count !== null && count !== undefined) {
          setLiveCertifiedCount(count);
        }
      } catch (err) {
        console.warn("Failed to fetch live certified employees count:", err);
        if (isMounted) setLiveCertifiedCount(0);
      } finally {
        if (isMounted) setInternalLoading(false);
      }
    };
    loadCertifiedCount();
    return () => {
      isMounted = false;
    };
  }, [token, certifiedEmployeesCount]);

  useEffect(() => {
    if (budgetUtilisedPercent !== undefined && budgetUtilisedPercent !== null) {
      setLiveBudgetUtilised(budgetUtilisedPercent);
      return;
    }
    let isMounted = true;
    const loadBudgetStats = async () => {
      try {
        const stats = await fetchCEOBudgetStats(token);
        if (isMounted && stats) {
          if (stats.budget_utilization_pct !== undefined && stats.budget_utilization_pct !== null) {
            setLiveBudgetUtilised(stats.budget_utilization_pct);
          } else if (Array.isArray(stats.spend_by_department) && stats.spend_by_department.length > 0) {
            const totalSpend = stats.spend_by_department.reduce((sum, d) => sum + (d.amount_raw || 0), 0);
            const totalBudget = stats.spend_by_department.reduce((sum, d) => sum + (d.budget_amount || 0), 0);
            const util = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : null;
            setLiveBudgetUtilised(util);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch live budget stats for HR metric cards:", err);
        if (isMounted) setLiveBudgetUtilised(0);
      } finally {
        if (isMounted) setInternalLoading(false);
      }
    };
    loadBudgetStats();
    return () => {
      isMounted = false;
    };
  }, [token, budgetUtilisedPercent]);

  const isLoading = externalLoading !== undefined ? externalLoading : internalLoading;

  const displayMetrics = metrics.map((item) => {
    let val = item.value;
    let tooltip = undefined;

    if (item.id === "total-employees") {
      const eVal = totalEmployeesCount ?? liveEmployeeCount;
      val = eVal !== null && eVal !== undefined ? String(eVal) : "0";
    } else if (item.id === "pending-claims") {
      val = (pendingClaimsCount !== undefined && pendingClaimsCount !== null)
        ? String(pendingClaimsCount)
        : "0";
    } else if (item.id === "certified-employees") {
      const cVal = certifiedEmployeesCount ?? liveCertifiedCount;
      val = (cVal !== undefined && cVal !== null)
        ? String(cVal)
        : "0";
      if (val !== "0") {
        tooltip = `${val} employees with at least one active, valid certification`;
      }
    } else if (item.id === "budget-utilised") {
      const bVal = budgetUtilisedPercent ?? liveBudgetUtilised;
      val = (bVal !== null && bVal !== undefined)
        ? (String(bVal).endsWith("%") ? String(bVal) : `${bVal}%`)
        : "0%";
    }
    return { ...item, value: val, tooltip };
  });

  return (
    <div className="hr-metric-cards-grid">
      {displayMetrics.map((item) => (
        <div key={item.id} className="hr-metric-card" title={item.tooltip}>
          <div
            className="hr-metric-icon-wrapper"
            style={{
              backgroundImage: `url(${metricBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <img src={item.icon} alt={item.alt} className="hr-metric-icon" />
          </div>
          <div className="hr-metric-info">
            <div className="hr-metric-value">
              {isLoading ? (
                <span className="ld-skeleton-block" style={{ width: 44, height: 26, display: "inline-block" }} />
              ) : (
                item.value
              )}
            </div>
            <div className="hr-metric-title">{item.title}</div>
          </div>
          <img
            src={bluebiglineSvg}
            alt=""
            className="hr-metric-bottom-line"
          />
        </div>
      ))}
    </div>
  );
}
