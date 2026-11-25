import React, { useRef } from "react";
import PageHeader from "../../components/common/PageHeader";
import KPIStatsGrid from "../../components/reportingmanager/Dashboard/KPIStatsGrid";
import TeamMembersCard from "../../components/reportingmanager/Dashboard/TeamMembersCard";
import TopPerformingCoursesCard from "../../components/reportingmanager/Dashboard/TopPerformingCoursesCard";
import CertificationsTeamCard from "../../components/reportingmanager/Dashboard/CertificationsTeamCard";

import "../../styles/reportingmanager/Dashboard.css";

export default function Dashboard() {
    const scrollContainerRef = useRef(null);

    return (
        <div className="rm-dashboard-page">
            {/* FIXED TOP HEADER: Page Header & 4 KPI Stat Cards */}
            <div
                className="rm-dashboard-fixed-header"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                <PageHeader
                    title="Team Dashboard"
                    subtitle="Track team learning engagement, weekly study hours, and completed certifications."
                />

                {/* 1. Top KPI Stats Grid (4 Cards: Team Members, Active Learners, Avg. Hours/Week, Certificates Earned) */}
                <KPIStatsGrid />
            </div>

            {/* SCROLLABLE MAIN CONTENT */}
            <div className="rm-dashboard-scrollable-content" ref={scrollContainerRef}>
                {/* 2. Middle Row: Team Members Table Card */}
                <TeamMembersCard />

                {/* 3. Bottom Row: 2-Column Grid (Top Performing Courses & Certifications of Team Members) */}
                <div className="rm-dashboard-bottom-grid">
                    <TopPerformingCoursesCard />
                    <CertificationsTeamCard />
                </div>
            </div>
        </div>
    );
}
