import React, { useState, useRef } from "react";
import PageHeader from "../../components/common/PageHeader";
import TeamMembers from "../../components/reportingmanager/TeamManager/TeamMembers";
import MembersLearningLog from "../../components/reportingmanager/TeamManager/MembersLearningLog";
import CourseApprovalStatus from "../../components/reportingmanager/TeamManager/CourseApprovalStatus";
import "../../styles/reportingmanager/TeamManagement.css";

export default function TeamManagement() {
    const [selectedMember, setSelectedMember] = useState(null);
    const scrollContainerRef = useRef(null);

    return (
        <div className="rm-team-management-page">
            {/* FIXED TOP HEADER */}
            <div
                className="rm-team-management-fixed-header"
                onWheel={(e) => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop += e.deltaY;
                    }
                }}
            >
                <PageHeader
                    title="Team Management"
                    subtitle="View team member learning logs, active courses, and skill development activities."
                />
            </div>

            {/* SCROLLABLE MAIN CONTENT */}
            <div className="rm-team-management-scrollable-content" ref={scrollContainerRef}>
                {/* Top Row: Team Members (Table) & Members Learning Log */}
                <div className="rm-tm-top-grid">
                    <TeamMembers
                        onSelectMember={setSelectedMember}
                        selectedMemberId={selectedMember?.employee_id || selectedMember?.id}
                    />
                    <MembersLearningLog
                        selectedMember={selectedMember}
                        onSelectMember={setSelectedMember}
                    />
                </div>

                {/* Bottom Row: Course Approval Status Pipeline */}
                <CourseApprovalStatus />
            </div>
        </div>
    );
}
