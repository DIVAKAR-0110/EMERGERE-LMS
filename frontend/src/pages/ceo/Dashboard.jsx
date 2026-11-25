import React, { useState, useEffect } from "react";
import PageHeader from "../../components/common/PageHeader";
import CEOMetricCards from "../../components/ceo/Dashboard/CEOMetricCards";
import LearningByDepartment from "../../components/common/LearningByDepartment";
import EmployeeDistribution from "../../components/common/EmployeeDistribution";
import TopPerformers from "../../components/ceo/Dashboard/TopPerformers";
import { fetchCEOKpiStats, fetchDepartmentLearningStats } from "../../services/teamService";
import { useAuth } from "../../context/AuthContext";
import "../../styles/ceo/Dashboard.css";

export default function CEODashboard() {
    const { token } = useAuth();
    const [kpiStats, setKpiStats] = useState(null);
    const [departmentLearning, setDepartmentLearning] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadDashboardData = async () => {
            try {
                const [kpis, deptStats] = await Promise.allSettled([
                    fetchCEOKpiStats(token),
                    fetchDepartmentLearningStats(token),
                ]);

                if (isMounted) {
                    if (kpis.status === "fulfilled" && kpis.value) {
                        setKpiStats(kpis.value);
                    }
                    if (deptStats.status === "fulfilled" && Array.isArray(deptStats.value) && deptStats.value.length > 0) {
                        setDepartmentLearning(deptStats.value);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch CEO dashboard data:", err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        loadDashboardData();
        return () => {
            isMounted = false;
        };
    }, [token]);

    return (
        <div className="ceo-dashboard-page">
            {/* Top Page Header */}
            <PageHeader
                title="CEO Dashboard"
                subtitle="Executive insights into organizational skill growth, learning investments, and workforce capabilities."
            />

            {/* Top 4 KPI Metric Cards */}
            <CEOMetricCards kpiStats={kpiStats} isLoading={isLoading} />

            {/* Main 2-Column Dashboard Grid */}
            <div className="ceo-dashboard-main-grid">
                {/* Left Column: Learning by Department & Employee Distribution */}
                <div className="ceo-dashboard-column">
                    <LearningByDepartment
                        departments={departmentLearning || undefined}
                        showAmount={false}
                        variant="ceo"
                    />
                    <EmployeeDistribution 
                        distribution={kpiStats?.employee_distribution}
                        totalCount={kpiStats?.total_employees}
                    />
                </div>

                {/* Right Column: Top Performers */}
                <div className="ceo-dashboard-column">
                    <TopPerformers />
                </div>
            </div>
        </div>
    );
}

