import React from "react";
import { COURSE_ICONS } from "../../../constants/courseIcons";
import "../../../styles/reportingmanager/CourseCard.css";

const CourseCard = ({ course, onRecommend }) => {
    const courseIcon = course.icon || COURSE_ICONS[course.iconType];
    const providerIcon = course.providerIcon || COURSE_ICONS.webLogo;

    return (
        <div className="rm-recommend-card">
            {/* THUMBNAIL (SOLID VIBRANT BLUE THEME AS PER FIGMA IMAGE 1) */}
            <div className="rm-course-thumbnail">
                <span className="rm-category-badge" title={course.category}>
                    {course.category}
                </span>

                {courseIcon && (
                    <img
                        src={courseIcon}
                        alt={course.category || "Course Icon"}
                        className="rm-thumbnail-icon"
                    />
                )}
            </div>

            {/* CARD BODY */}
            <div className="rm-course-card-body">
                <div className="rm-course-info">
                    <h3 className="rm-course-title" title={course.title}>
                        {course.title}
                    </h3>

                    <div className="rm-course-provider">
                        {providerIcon && (
                            <img
                                src={providerIcon}
                                alt={course.provider || "Provider"}
                            />
                        )}
                        <span>{course.provider}</span>
                    </div>
                </div>

                {/* RECOMMEND BUTTON (FIGMA: 187px x 28px) */}
                <button
                    type="button"
                    className="rm-btn-course-recommend"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRecommend?.(course);
                    }}
                >
                    Recommend
                </button>
            </div>
        </div>
    );
};

export default CourseCard;