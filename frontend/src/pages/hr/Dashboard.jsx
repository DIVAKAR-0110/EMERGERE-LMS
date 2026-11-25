import React, { useState, useEffect } from "react";
import PageHeader from "../../components/common/PageHeader";
import HRMetricCards from "../../components/hr/Dashboard/HRMetricCards";
import RecentHRActivity from "../../components/hr/Dashboard/RecentHRActivity";
import ReimbursementOverview from "../../components/hr/Dashboard/ReimbursementOverview";
import EmployeeDistribution from "../../components/common/EmployeeDistribution";
import LearningByDepartment from "../../components/common/LearningByDepartment";
import {
  fetchCEOKpiStats,
  fetchDepartmentLearningStats,
  fetchReimbursementClaims,
  fetchCatalogCourses,
  fetchCEOBudgetStats,
} from "../../services/teamService";
import { useAuth } from "../../context/AuthContext";
import "../../styles/hr/Dashboard.css";

export default function HRDashboard() {
  const { token } = useAuth();
  const [kpiStats, setKpiStats] = useState(null);
  const [departmentLearning, setDepartmentLearning] = useState(null);
  const [budgetUtilisedPercent, setBudgetUtilisedPercent] = useState(null);
  const [reimbursementData, setReimbursementData] = useState(null);
  const [isReimbursementLoading, setIsReimbursementLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadHRData = async () => {
      try {
        const [kpis, deptStats, claimsRes, coursesRes, budgetRes] = await Promise.allSettled([
          fetchCEOKpiStats(token),
          fetchDepartmentLearningStats(token),
          fetchReimbursementClaims(token),
          fetchCatalogCourses(token),
          fetchCEOBudgetStats(token),
        ]);

        if (isMounted) {
          if (kpis.status === "fulfilled" && kpis.value) {
            setKpiStats(kpis.value);
          }
          if (deptStats.status === "fulfilled" && Array.isArray(deptStats.value) && deptStats.value.length > 0) {
            setDepartmentLearning(deptStats.value);
          }
          if (budgetRes.status === "fulfilled" && budgetRes.value) {
            if (budgetRes.value.budget_utilization_pct !== undefined && budgetRes.value.budget_utilization_pct !== null) {
              setBudgetUtilisedPercent(budgetRes.value.budget_utilization_pct);
            }
          } else if (deptStats.status === "fulfilled" && Array.isArray(deptStats.value) && deptStats.value.length > 0) {
            const totalSpend = deptStats.value.reduce((sum, d) => sum + (d.amount_raw || 0), 0);
            const totalBudget = deptStats.value.reduce((sum, d) => sum + (d.budget_amount || 0), 0);
            const util = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : null;
            setBudgetUtilisedPercent(util);
          }

          const hasClaims = claimsRes.status === "fulfilled" && Array.isArray(claimsRes.value);
          const hasCourses = coursesRes.status === "fulfilled" && Array.isArray(coursesRes.value);

          if (!hasClaims && !hasCourses) {
            setReimbursementData(null);
            setIsReimbursementLoading(false);
          } else {
            const claims = hasClaims ? claimsRes.value : [];
            const courses = hasCourses ? coursesRes.value : [];

            // Course Reimbursement Requests (aligns directly with ApprovalsWorkflow.jsx Course tab)
            const courseApproved = courses.filter((c) => c.hr_status === "Approved").length;
            const coursePending = courses.filter((c) => (c.hr_status || "Pending") === "Pending").length;
            const courseRejected = courses.filter((c) => c.hr_status === "Rejected").length;

            // Certification Reimbursement Claims (aligns directly with ApprovalsWorkflow.jsx Cert tab)
            const certApproved = claims.filter(
              (c) => c.status === "Approved" || c.processing_status === "Paid"
            ).length;
            const certPending = claims.filter(
              (c) => (c.status || "Pending") === "Pending"
            ).length;
            const certRejected = claims.filter((c) => c.status === "Rejected").length;

            // Harmonized Enterprise Totals
            const totalClaimsCount = courses.length + claims.length;
            const totalApproved = courseApproved + certApproved;
            const totalPending = coursePending + certPending;
            const totalRejected = courseRejected + certRejected;

            // Month-over-month submission velocity calculation
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
            const prevMonth = prevMonthDate.getMonth();
            const prevYear = prevMonthDate.getFullYear();

            let thisMonthCount = 0;
            let lastMonthCount = 0;

            const checkItemDate = (dateVal) => {
              if (!dateVal) return null;
              const d = new Date(dateVal);
              return isNaN(d.getTime()) ? null : d;
            };

            [...claims, ...courses].forEach((item) => {
              const d = checkItemDate(item.submitted_on || item.created_at || item.employee_request_date);
              if (d) {
                if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                  thisMonthCount++;
                } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
                  lastMonthCount++;
                }
              } else {
                thisMonthCount++;
              }
            });

            let growthPercent = null;
            if (lastMonthCount > 0) {
              growthPercent = Math.round(
                ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100
              );
            } else if (thisMonthCount > 0) {
              growthPercent = Math.min(100, thisMonthCount * 8);
            }

            setReimbursementData({
              totalClaims: totalClaimsCount,
              approvedCount: totalApproved,
              pendingCount: totalPending,
              rejectedCount: totalRejected,
              growthPercent,
              certClaimsCount: claims.length,
              courseRequestsCount: courses.length,
            });
            setIsReimbursementLoading(false);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch HR dashboard data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsReimbursementLoading(false);
        }
      }
    };

    loadHRData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="hr-dashboard-page">
      {/* Top Page Header */}
      <PageHeader
        title="HR Dashboard"
        subtitle="Oversee organization-wide learning records, certification claims, and training budget utilization."
      />

      {/* Top 4 Summary Stat Cards */}
      <HRMetricCards
        totalEmployeesCount={kpiStats?.total_employees}
        certifiedEmployeesCount={kpiStats?.certified_employees}
        pendingClaimsCount={reimbursementData?.pendingCount}
        budgetUtilisedPercent={budgetUtilisedPercent}
        isLoading={isLoading}
      />

      {/* Main Dashboard Grid */}
      <div className="hr-dashboard-main-grid">
        <RecentHRActivity />
        <ReimbursementOverview
          totalClaims={reimbursementData?.totalClaims}
          growthPercent={reimbursementData?.growthPercent}
          approvedCount={reimbursementData?.approvedCount}
          pendingCount={reimbursementData?.pendingCount}
          rejectedCount={reimbursementData?.rejectedCount}
          certClaimsCount={reimbursementData?.certClaimsCount}
          courseRequestsCount={reimbursementData?.courseRequestsCount}
          isLoading={isReimbursementLoading}
        />
        <EmployeeDistribution
          distribution={kpiStats?.employee_distribution}
          totalCount={kpiStats?.total_employees}
          variant="hr"
        />
        <LearningByDepartment
          departments={departmentLearning}
          showAmount={false}
          variant="hr"
        />
      </div>
    </div>
  );
}
