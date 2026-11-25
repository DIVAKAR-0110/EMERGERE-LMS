import React, { useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import OverallLearningReportBanner from "../../components/hr/EmployeeRecords/OverallLearningReportBanner";
import EmployeeRecordsOverview from "../../components/hr/EmployeeRecords/EmployeeRecordsOverview";
import CoursesData from "../../components/hr/EmployeeRecords/CoursesData";
import MonthlyLearningTrends from "../../components/hr/EmployeeRecords/MonthlyLearningTrends";
import EmployeeRecordsTable from "../../components/hr/EmployeeRecords/EmployeeRecordsTable";
import DownloadLearningReportModal from "../../components/hr/EmployeeRecords/DownloadLearningReportModal";
import DownloadSuccessModal from "../../components/hr/EmployeeRecords/DownloadSuccessModal";
import ViewLearningReportModal from "../../components/hr/EmployeeRecords/ViewLearningReportModal";
import EmployeeProfileView from "../L&D/EmployeeProfileView";
import "../../styles/hr/EmployeeRecords.css";

export default function HREmployeeRecords() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isViewReportModalOpen, setIsViewReportModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // If viewing an employee profile
  if (selectedEmployee) {
    return (
      <EmployeeProfileView
        employee={selectedEmployee}
        onBack={() => setSelectedEmployee(null)}
      />
    );
  }

  return (
    <div className="hr-employee-records-page">
      {/* 1. Static Pinned Top: Header + Overall Employee Learning Report Banner */}
      <div className="hr-records-static-top">
        <PageHeader
          title="Employee Records"
          subtitle="Access employee learning profiles, verified credentials, and organizational skill distribution."
        />
        <OverallLearningReportBanner
          onViewReport={() => setIsViewReportModalOpen(true)}
          onOpenDownload={() => setIsDownloadModalOpen(true)}
        />
      </div>

      {/* 2. Vertically Scrollable Content Below */}
      <div
        className="hr-employee-records-scrollable"
        onScroll={(e) => {
          const cardsGrid = e.currentTarget.querySelector(".hr-middle-cards-grid");
          const cardsHeight = cardsGrid ? cardsGrid.offsetHeight + 14 : 224;
          if (e.currentTarget.scrollTop > cardsHeight) {
            e.currentTarget.scrollTop = cardsHeight;
          }
        }}
      >

        {/* 3. Middle 3 Cards Grid */}
        <div className="hr-middle-cards-grid">
          <EmployeeRecordsOverview />
          <CoursesData />
          <MonthlyLearningTrends />
        </div>

        {/* 4. Bottom Table with Filters */}
        <EmployeeRecordsTable
          onSelectEmployee={(emp) => setSelectedEmployee(emp)}
        />
      </div>

      {/* 5. Modals */}
      <DownloadLearningReportModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        onDownloadSuccess={() => setIsSuccessModalOpen(true)}
      />

      <DownloadSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
      />

      <ViewLearningReportModal
        isOpen={isViewReportModalOpen}
        onClose={() => setIsViewReportModalOpen(false)}
        onOpenDownload={() => setIsDownloadModalOpen(true)}
      />
    </div>
  );
}
