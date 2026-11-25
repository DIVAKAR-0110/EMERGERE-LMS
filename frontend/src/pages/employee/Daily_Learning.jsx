import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/common/PageHeader";

import LearningForm from "../../components/employee/DailyLearning/LearningForm";
import LearningCalendar from "../../components/employee/DailyLearning/LearningCalendar";
import RecentLearningLog from "../../components/employee/DailyLearning/RecentLearningLog";
import MonthlySummary from "../../components/employee/DailyLearning/MonthlySummary";
import AllLearningLogsView from "../../components/employee/DailyLearning/AllLearningLogsView";

import "../../styles/employee/Dashboard.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function Daily_Learning() {
    const { user, currentUser } = useAuth();
    const activeUser = user || currentUser;

    const getActiveEmpId = () => {
        if (activeUser?.employee_id) return activeUser.employee_id;
        if (activeUser?.empId) return activeUser.empId;
        const storedUser = localStorage.getItem("lms_user");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed?.employee_id) return parsed.employee_id;
                if (parsed?.empId) return parsed.empId;
            } catch (e) {}
        }
        return localStorage.getItem("lms_active_employee_id") || "EMP004";
    };

    const activeEmpId = getActiveEmpId();
    const [learningLogs, setLearningLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [durationError, setDurationError] = useState(false);
    const [showAllLogs, setShowAllLogs] = useState(false);
    const scrollContainerRef = useRef(null);

    // Fetch live logs from LMS_DAILY_LEARNING table for individual employee
    useEffect(() => {
        let isMounted = true;
        const fetchLogs = async () => {
            try {
                const authToken = localStorage.getItem("lms_token");
                const currentEmpId = getActiveEmpId();
                const res = await axios.get(`${API_BASE_URL}/api/daily-learning`, {
                    params: {
                        employee_id: currentEmpId,
                    },
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": currentEmpId,
                    }
                });
                if (isMounted && Array.isArray(res.data)) {
                    setLearningLogs(res.data);
                }
            } catch (err) {
                console.warn("[Daily_Learning] Could not fetch daily learning logs:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchLogs();
        return () => { isMounted = false; };
    }, [activeEmpId]);

    // Called by LearningForm when "Save Learning Log" is clicked
    const handleSaveLog = (newLog) => {
        setLearningLogs((prev) => [newLog, ...prev]);
    };

    // Called by RecentLearningLog when an entry is edited and saved
    const handleUpdateLog = async (logId, updatedData) => {
        try {
            const authToken = localStorage.getItem("lms_token");
            const currentEmpId = getActiveEmpId();
            
            // Extract numeric ID
            let numericId = updatedData.daily_learning_id;
            if (!numericId && typeof logId === "string") {
                numericId = parseInt(logId.replace("log-", ""), 10);
            } else if (!numericId) {
                numericId = logId;
            }

            const res = await axios.put(
                `${API_BASE_URL}/api/daily-learning/${numericId}`,
                {
                    employee_id: currentEmpId,
                    course_id: updatedData.course_id,
                    title: updatedData.title,
                    video_hours: updatedData.videoHours,
                    video_minutes: updatedData.videoMinutes,
                    video_learning_duration_min: updatedData.video_learning_duration_min,
                    practice_hours: updatedData.practiceHours,
                    practice_minutes: updatedData.practiceMinutes,
                    practice_handson_min: updatedData.practice_handson_min,
                    learning_description: updatedData.description,
                },
                {
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        "X-Employee-Id": currentEmpId,
                    }
                }
            );

            const savedRecord = res.data;
            setLearningLogs((prev) =>
                prev.map((log) => {
                    const curId = log.daily_learning_id || log.id;
                    const targetId = savedRecord.daily_learning_id || savedRecord.id || logId;
                    return (curId === targetId || log.id === logId) ? { ...log, ...savedRecord } : log;
                })
            );
        } catch (err) {
            console.error("[Daily_Learning] Error persisting updated log:", err);
            throw err;
        }
    };

    return (
        <div className={`emp-daily-learning-page ${showAllLogs ? "is-all-logs-active" : ""}`}>
            {showAllLogs ? (
                <AllLearningLogsView
                    logs={learningLogs}
                    onBack={() => setShowAllLogs(false)}
                    onUpdateLog={handleUpdateLog}
                    isLoading={isLoading}
                />
            ) : (
                <>
                    {/* FIXED TOP HEADER (PageHeader matching Screenshot 3) */}
                    <div
                        className="emp-daily-learning-fixed-header"
                        onWheel={(e) => {
                            if (scrollContainerRef.current) {
                                scrollContainerRef.current.scrollTop += e.deltaY;
                            }
                        }}
                    >
                        <PageHeader
                            title="Daily Learning Log"
                            subtitle="Track your daily learning activities and build consistent habits."
                        />
                    </div>

                    {/* SCROLLABLE MAIN CONTENT */}
                    <div className="emp-daily-learning-scrollable-content" ref={scrollContainerRef}>
                        <div className="emp-daily-learning-grid emp-daily-learning-container">
                            <div className={`emp-daily-learning-col-left ${durationError ? "has-warning" : ""}`}>
                                <div className="emp-daily-learning-card-form">
                                    <LearningForm
                                        onSaveLog={handleSaveLog}
                                        employeeId={activeEmpId}
                                        onDurationErrorChange={setDurationError}
                                        logs={learningLogs}
                                    />
                                </div>
                                <div className="emp-daily-learning-card-summary">
                                    <MonthlySummary logs={learningLogs} isLoading={isLoading} />
                                </div>
                            </div>

                            <div className="emp-daily-learning-col-right">
                                <div className="emp-daily-learning-card-calendar">
                                    <LearningCalendar logs={learningLogs} />
                                </div>
                                <div className="emp-daily-learning-card-recent">
                                    <RecentLearningLog
                                        logs={learningLogs}
                                        onUpdateLog={handleUpdateLog}
                                        isLoading={isLoading}
                                        onViewAll={() => setShowAllLogs(true)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}