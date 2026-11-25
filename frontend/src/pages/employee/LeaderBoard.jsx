import React, { useState, useEffect, useRef } from "react";
import LeaderboardHeader from "../../components/employee/Leaderboard/LeaderboardHeader";
import TimeFilterTabs from "../../components/employee/Leaderboard/TimeFilterTabs";
import LearningReportBanner from "../../components/employee/Leaderboard/LearningReportBanner";
import TeamLeaderboard from "../../components/employee/Leaderboard/TeamLeaderboard";
import JuneOverview from "../../components/employee/Leaderboard/JuneOverview";
import YourStats from "../../components/employee/Leaderboard/YourStats";
import DepartmentLearning from "../../components/employee/Leaderboard/DepartmentLearning";
import TopDomainsDonut from "../../components/employee/Leaderboard/TopDomainsDonut";
import DownloadReportModal from "../../components/employee/Leaderboard/DownloadReportModal";
import DownloadSuccessModal from "../../components/employee/Leaderboard/DownloadSuccessModal";

import { useAuth } from "../../context/AuthContext";
import { fetchLeaderboardData } from "../../services/leaderboardService";
import "../../styles/employee/Leaderboard.css";

const LeaderBoard = () => {
    const { user, token } = useAuth();
    const activeEmpId =
        user?.employee_id ||
        user?.empId ||
        user?.Emp_Obj_Id ||
        user?.id ||
        user?.work_email ||
        user?.email ||
        localStorage.getItem("lms_active_employee_id") ||
        null;

    const [activeTab, setActiveTab] = useState("This Week");
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [liveData, setLiveData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const scrollContainerRef = useRef(null);

    // Fetch dynamic live leaderboard from backend database
    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;

        const loadLeaderboard = async () => {
            setIsLoading(true);
            try {
                const res = await fetchLeaderboardData(activeTab, token, activeEmpId, {
                    signal: controller.signal,
                });
                if (isMounted && !controller.signal.aborted && res?.success) {
                    setLiveData(res);
                }
            } catch (err) {
                if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || controller.signal.aborted) {
                    return;
                }
                console.warn("[Leaderboard] Live fetch notice:", err);
            } finally {
                if (isMounted && !controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadLeaderboard();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [activeTab, token, activeEmpId]);

    // Keep skeleton CSS loading state until live data arrives from the database
    const showSkeletonLoading = isLoading || liveData === null;

    // Pure dynamic database records with empty fallbacks
    const leaderboardList = liveData?.leaderboard || [];
    const userStats = liveData?.userStats || {};
    const overviewData = liveData?.overview || {};
    const departmentsData = liveData?.departments || [];
    const domainsData = liveData?.domains || [];

    const handleViewReport = () => {
        setIsDownloadModalOpen(true);
    };

    const handleDownloadReport = () => {
        setIsDownloadModalOpen(true);
    };

    const handleDownloadSuccess = () => {
        setIsSuccessModalOpen(true);
    };

    return (
        <div className="emp-leaderboard-page-container">
            {/* FIXED TOP HEADER (LeaderboardHeader + TimeFilterTabs matching Screenshot 4) */}
            <div
                className="emp-leaderboard-fixed-header"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                {/* HEADER */}
                <LeaderboardHeader />

                {/* TIME FILTER TABS */}
                <TimeFilterTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </div>

            {/* SCROLLABLE MAIN CONTENT */}
            <div className="emp-leaderboard-scrollable-content" ref={scrollContainerRef}>
                {/* BANNER: OVERALL EMPLOYEE LEARNING REPORT */}
                <LearningReportBanner
                    onViewReport={handleViewReport}
                    onDownloadReport={handleDownloadReport}
                />

                {/* MAIN GRID: ROW-ALIGNED TO PREVENT MISALIGNMENT */}
                <div className="emp-leaderboard-main-grid">
                    {/* TOP ROW: Team Leaderboard on left, Overview + YourStats on right */}
                    <div className="emp-leaderboard-top-row">
                        <div className="emp-leaderboard-top-left">
                            <TeamLeaderboard data={leaderboardList} isLoading={showSkeletonLoading} />
                        </div>
                        <div className="emp-leaderboard-top-right">
                            <JuneOverview
                                activeTab={activeTab}
                                overviewData={overviewData}
                                isLoading={showSkeletonLoading}
                            />
                            <YourStats stats={userStats} isLoading={showSkeletonLoading} />
                        </div>
                    </div>

                    {/* BOTTOM ROW: Department Learning & Top Certification Domains ALWAYS ALIGNED SIDE-BY-SIDE */}
                    <div className="emp-leaderboard-bottom-row">
                        <DepartmentLearning departments={departmentsData} isLoading={showSkeletonLoading} />
                        <TopDomainsDonut domains={domainsData} isLoading={showSkeletonLoading} />
                    </div>
                </div>
            </div>

            {/* DOWNLOAD REPORT MODAL */}
            <DownloadReportModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                onDownloadSuccess={handleDownloadSuccess}
                timeFilter={activeTab}
            />

            {/* DOWNLOAD SUCCESS MODAL */}
            <DownloadSuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
            />
        </div>
    );
};

export default LeaderBoard;
