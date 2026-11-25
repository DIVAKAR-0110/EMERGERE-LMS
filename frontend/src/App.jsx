import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/auth/Login.jsx";
import Daily_Learning from "./pages/employee/Daily_Learning.jsx";
import { AppLayout } from "./components/Sidebar/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import "./App.css";
import "./styles/common/NotificationHighlight.css";
import CourseLibrary from "./pages/employee/CourseLibrary.jsx";
import LeaderBoard from "./pages/employee/LeaderBoard.jsx";
import AIAssistant from "./pages/ai-assistant/AIAssistant.jsx";
import CertificationReimb from "./pages/employee/CertificationReimb.jsx";
import TeamManagement from "./pages/ReportingManager/TeamManagement.jsx";
import LearningRecords from "./pages/ReportingManager/LearningRecords.jsx";
import Dashboard from "./pages/employee/Dashboard.jsx";
import RMDashboard from "./pages/ReportingManager/Dashboard.jsx";
import Recommendcourse from "./pages/ReportingManager/Recommendcourse.jsx";
import ReportsAnalytics from "./pages/ReportingManager/ReportsAnalytics.jsx";
import LDDashboard from "./pages/L&D/Dashboard.jsx";
import LDEmployeeDirectory from "./pages/L&D/EmployeeDirectory.jsx";
import Profile from "./pages/Profile/Profile.jsx";
import Budget from "./pages/L&D/Budget.jsx";
import ApprovalsWorkflow from "./pages/L&D/ApprovalsWorkflow.jsx";
import ApprovalsWorkflows from "./pages/hr/ApprovalsWorkflow.jsx";
import WorkshopsTraining from "./pages/L&D/WorkshopsTraining.jsx";
import CourseManagement from "./pages/L&D/CourseManagement.jsx";
import LDLearningRecords from "./pages/L&D/LearningRecords.jsx";
import HRDashboard from "./pages/hr/Dashboard.jsx";
import HREmployeeRecords from "./pages/hr/EmployeeRecords.jsx";
import CEODashboard from "./pages/ceo/Dashboard.jsx";
import CEOApprovalsAnalytics from "./pages/ceo/ApprovalsAnalytics.jsx";

function App() {
  return (
    <Routes>

      {/* =========================
          PUBLIC ROUTES
      ========================== */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/unauthorized"
        element={
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <h1>403 - Access Denied</h1>
            <p>You do not have permission to view this page.</p>
          </div>
        }
      />


      {/* =========================
          EMPLOYEE ROUTES
      ========================== */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={["Employee"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >

        <Route index element={<Navigate to="dashboard" replace />} />

        {/* AI Assistant */}
        <Route path="ai-assistant" element={<div>Employee AI assistant</div>} />

        {/* Dashboard */}
        <Route
          path="dashboard"
          element={<Dashboard />}
        />

        {/* Course Library */}
        <Route
          path="course-library"
          element={<CourseLibrary />}
        />

        {/* Daily Learning */}
        <Route
          path="daily-learning-log"
          element={<Daily_Learning />}
        />

        {/* Leaderboard */}
        <Route
          path="leaderboard"
          element={<LeaderBoard />}
        />

        {/* Certification */}
        <Route
          path="certification-reimb"
          element={<CertificationReimb />}
        />

        <Route path="LMS Copilot"
          element={<AIAssistant />}
        />

        {/* Profile */}
        <Route
          path="profile"
          element={<Profile />}
        />

      </Route>


      {/* =========================
          REPORTING MANAGER ROUTES
      ========================== */}
      <Route
        path="/reporting-manager"
        element={
          <ProtectedRoute allowedRoles={["Reporting_Manager", "ReportingManager", "Reporting Manager"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* AI Assistant */}
        <Route path="ai-assistant" element={<div>Reporting Manager AI assistant</div>} />

        <Route
          path="dashboard"
          element={<RMDashboard />}
        />

        <Route
          path="team-management"
          element={<TeamManagement />}
        />

        <Route
          path="learning-records"
          element={<LearningRecords />}
        />

        <Route
          path="recommend-course"
          element={<Recommendcourse />}
        />

        <Route
          path="reports-analytics"
          element={<ReportsAnalytics />}
        />

        {/* Profile */}
        <Route
          path="profile"
          element={<Profile />}
        />

      </Route>


      {/* =========================
          L&D ROUTES
      ========================== */}
      <Route
        path="/ld"
        element={
          <ProtectedRoute allowedRoles={["L_D", "L&D", "LD", "L&D Team"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* AI Assistant */}
        <Route path="ai-assistant" element={<div>L&D AI assistant</div>} />

        <Route
          path="dashboard"
          element={<LDDashboard />}
        />

        <Route
          path="employee-directory"
          element={<LDEmployeeDirectory />}
        />

        <Route
          path="learning-records"
          element={<LDLearningRecords />}
        />

        <Route
          path="course-management"
          element={<CourseManagement />}
        />

        <Route
          path="workshops-training"
          element={<WorkshopsTraining />}
        />

        <Route
          path="approvals-workflow"
          element={<ApprovalsWorkflow />}
        />

        <Route
          path="budget"
          element={<Budget />}
        />

        <Route path="LMS Copilot" element={<AIAssistant />} />

        {/* Profile */}
        <Route
          path="profile"
          element={<Profile />}
        />

      </Route>


      {/* =========================
          HR ROUTES
      ========================== */}
      <Route
        path="/hr"
        element={
          <ProtectedRoute allowedRoles={["HR", "HR Team"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* AI Assistant */}
        <Route path="ai-assistant" element={<div>HR AI assistant</div>} />

        <Route
          path="dashboard"
          element={<HRDashboard />}
        />

        <Route
          path="employee-records"
          element={<HREmployeeRecords />}
        />

        <Route
          path="approvals-workflow"
          element={<ApprovalsWorkflows />}
        />

        <Route
          path="budget-expenditure"
          element={<Budget />}
        />

        {/* Profile */}
        <Route
          path="profile"
          element={<Profile />}
        />

      </Route>


      {/* =========================
          CEO / EXECUTIVE ROUTES
      ========================== */}
      <Route
        path="/ceo"
        element={
          <ProtectedRoute allowedRoles={["CEO"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* AI Assistant */}
        <Route path="ai-assistant" element={<div>CEO AI assistant</div>} />

        <Route
          path="dashboard"
          element={<CEODashboard />}
        />

        <Route
          path="approvals-analytics"
          element={<CEOApprovalsAnalytics />}
        />

        <Route
          path="budget-expenditure"
          element={<Budget />}
        />

        {/* Profile */}
        <Route
          path="profile"
          element={<Profile />}
        />

      </Route>

      {/* Executive path aliases */}
      <Route path="/executive" element={<Navigate to="/ceo/dashboard" replace />} />
      <Route path="/executive/dashboard" element={<Navigate to="/ceo/dashboard" replace />} />
      <Route path="/executive/*" element={<Navigate to="/ceo/dashboard" replace />} />


      {/* =========================
          FALLBACK
      ========================== */}
      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />

    </Routes>
  );
}

export default App;
