import React, { useState, useRef } from "react";
import PageHeader from "../../components/common/PageHeader";
import ReportBanner from "../../components/reportingmanager/Reports&Analytics/ReportBanner";
import TeamOverviewCard from "../../components/reportingmanager/Reports&Analytics/TeamOverviewCard";
import TeamLearningProgressCard from "../../components/reportingmanager/Reports&Analytics/TeamLearningProgressCard";
import MonthlyLearningHoursCard from "../../components/reportingmanager/Reports&Analytics/MonthlyLearningHoursCard";
import CoursesDataCard from "../../components/reportingmanager/Reports&Analytics/CoursesDataCard";
import CertificationsStatusCard from "../../components/reportingmanager/Reports&Analytics/CertificationsStatusCard";
import TopCertificationDomainsCard from "../../components/reportingmanager/Reports&Analytics/TopCertificationDomainsCard";
import DownloadReportModal from "../../components/reportingmanager/Reports&Analytics/DownloadReportModal";
import DownloadSuccessModal from "../../components/reportingmanager/Reports&Analytics/DownloadSuccessModal";
import ViewReportModal from "../../components/reportingmanager/Reports&Analytics/ViewReportModal";
import { fetchTeamReportData, downloadLearningReport } from "../../services/teamService";
import { exportTeamReport } from "../../utils/reportExportUtil";
import { useAuth } from "../../context/AuthContext";

import "../../styles/reportingmanager/ReportsAnalytics.css";

export default function ReportsAnalytics() {
    const { token, user } = useAuth();
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isViewReportModalOpen, setIsViewReportModalOpen] = useState(false);
    const scrollContainerRef = useRef(null);

    const handleDownload = async (downloadParams) => {
        try {
            const data = await fetchTeamReportData(downloadParams, token);
            exportTeamReport({
                title: "Team Learning & Analytics Report",
                managerName: data?.manager_name || user?.name || user?.full_name || user?.displayName || "Reporting Manager",
                managerId: data?.manager_id || user?.employee_id || user?.id || "—",
                dateRange: downloadParams?.dateRange || "This Month",
                overview: data?.overview || {},
                courseProgress: data?.course_progress || [],
                learningHours: data?.learning_hours || [],
                certifications: data?.certifications || [],
                leaderboard: data?.leaderboard || [],
                includes: downloadParams?.includes || {},
                exportFormat: downloadParams?.exportFormat || "PDF",
            });
        } catch (err) {
            console.warn("fetchTeamReportData failed, falling back to backend download:", err);
            await downloadLearningReport(downloadParams, token);
        }
    };

    const handleDownloadSuccess = (downloadParams) => {
        console.log("[Reports & Analytics] Download finished with params:", downloadParams);
        setIsDownloadModalOpen(false);
        setIsSuccessModalOpen(true);
    };

    return (
        <div className="rm-reports-analytics-page">
            {/* FIXED TOP HEADER */}
            <div
                className="rm-reports-analytics-fixed-header"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                {/* Header: Title, Subtitle, "⇄ Employee View" Toggle Pill & Notification Bell */}
                <PageHeader
                    title="Reports & Analytics"
                    subtitle="Analyze team skill acquisition, completion rates, and department-wide learning metrics."
                />
            </div>

            {/* SCROLLABLE MAIN CONTENT */}
            <div className="rm-reports-analytics-scrollable-content" ref={scrollContainerRef}>
                {/* Top Report Banner (Overall Employee Learning Report) */}
                <ReportBanner
                    onViewReport={() => setIsViewReportModalOpen(true)}
                    onOpenDownloadModal={() => setIsDownloadModalOpen(true)}
                />

                {/* Unified 4-Track 2-Row Master Grid (Exact Figma Alignment & Same Baseline) */}
                <div className="rm-ra-dashboard-grid-container">
                    {/* ── Row 1 ── */}
                    <div className="rm-ra-grid-slot rm-ra-slot-team-overview">
                        <TeamOverviewCard />
                    </div>
                    <div className="rm-ra-grid-slot rm-ra-slot-progress">
                        <TeamLearningProgressCard />
                    </div>
                    <div className="rm-ra-grid-slot rm-ra-slot-monthly">
                        <MonthlyLearningHoursCard />
                    </div>

                    {/* ── Row 2 ── */}
                    <div className="rm-ra-grid-slot rm-ra-slot-courses">
                        <CoursesDataCard />
                    </div>
                    <div className="rm-ra-grid-slot rm-ra-slot-certs">
                        <CertificationsStatusCard />
                    </div>
                    <div className="rm-ra-grid-slot rm-ra-slot-domains">
                        <TopCertificationDomainsCard />
                    </div>
                </div>
            </div>

            {/* Download Report Modal with Form Validations */}
            <DownloadReportModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                onDownload={handleDownload}
                onDownloadSuccess={handleDownloadSuccess}
            />

            {/* Download Success Popup */}
            <DownloadSuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
            />

            {/* View Report Detail Preview Modal */}
            <ViewReportModal
                isOpen={isViewReportModalOpen}
                onClose={() => setIsViewReportModalOpen(false)}
                onOpenDownload={() => setIsDownloadModalOpen(true)}
            />
        </div>
    );
}
