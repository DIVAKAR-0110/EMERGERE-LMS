import React, { useState, useEffect } from "react";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import { fetchTopPerformingCourses } from "../../../services/teamService";
import { useAuth } from "../../../context/AuthContext";

export default function TopPerformingCoursesCard() {
    const { token } = useAuth();
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadTopCourses = async () => {
            try {
                setIsLoading(true);
                const data = await fetchTopPerformingCourses(token);
                if (isMounted) {
                    setCourses(Array.isArray(data) ? data.slice(0, 5) : []);
                }
            } catch (err) {
                console.error("Failed to load team top performing courses:", err);
                if (isMounted) {
                    setCourses([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadTopCourses();
        return () => {
            isMounted = false;
        };
    }, [token]);

    return (
        <div className="rm-card rm-top-courses-card">
            <div className="rm-card-header">
                <h3 className="rm-card-title">Top Performing Courses</h3>
            </div>

            <div className={`rm-top-courses-list ${courses.length === 0 ? "rm-courses-list-empty" : ""}`}>
                {isLoading ? (
                    [1, 2, 3, 4].map((i) => (
                        <div key={`course-skel-${i}`} className="rm-top-course-row" style={{ opacity: 0.85 }}>
                            <span className="rm-top-course-title">
                                <span className="ld-skeleton-block" style={{ width: '130px', height: '14px', borderRadius: '4px' }} />
                            </span>
                            <div className="rm-top-course-track">
                                <span className="ld-skeleton-block" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
                            </div>
                            <span className="rm-top-course-count">
                                <span className="ld-skeleton-block" style={{ width: '20px', height: '14px', borderRadius: '4px' }} />
                            </span>
                        </div>
                    ))
                ) : courses.length > 0 ? (
                    courses.slice(0, 5).map((course, index) => {
                        const enrolled = course.enrolledCount ?? course.enrolled_count ?? 0;
                        const learningProgress = Math.min(
                            100,
                            Math.max(
                                0,
                                Math.round(
                                    course.learningProgress ??
                                    course.learning_progress ??
                                    course.avgProgress ??
                                    course.avg_progress ??
                                    course.progress ??
                                    0
                                )
                            )
                        );

                        return (
                            <div key={course.id || course.course_id || index} className="rm-top-course-row">
                                <span
                                    className="rm-top-course-title"
                                    title={`${course.course_name || course.title} • ${course.category || 'General'} (${enrolled} enrolled • ${learningProgress}% avg learning progress)`}
                                >
                                    {course.course_name || course.title}
                                </span>
                                <div
                                    className="rm-top-course-track"
                                    title={`Team Learning Progress: ${learningProgress}%`}
                                >
                                    <div
                                        className="rm-top-course-fill"
                                        style={{
                                            width: `${learningProgress}%`,
                                            backgroundColor: course.color || "#2667F9",
                                        }}
                                    />
                                </div>
                                <span
                                    className="rm-top-course-count"
                                    title={`${enrolled} team member${enrolled !== 1 ? 's' : ''} enrolled`}
                                >
                                    {course.count || String(enrolled).padStart(2, "0")}
                                </span>
                            </div>
                        );
                    })
                ) : (
                    <div className="rm-empty-state-content">
                        <img
                            src={openBookIcon}
                            alt="No learning activities"
                            className="emp-recent-log-empty-icon"
                        />
                        <span className="rm-empty-state-text">
                            No enrolled courses for team members yet.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
