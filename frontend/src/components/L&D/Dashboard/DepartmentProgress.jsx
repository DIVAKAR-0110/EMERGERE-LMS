import React from "react";

export default function DepartmentProgress({ departmentData = [] }) {
    const formattedCount = String(departmentData.length).padStart(2, "0");
    return (
        <div className="ld-section-card">
            <div className="ld-section-header">
                <h3 className="ld-section-title">
                    <span>Learning by Department</span>
                    <span className="ld-title-count">({formattedCount})</span>
                </h3>
            </div>

            <div className="ld-dept-list">
                {departmentData.map((dept, index) => (
                    <div key={index} className="ld-dept-row">
                        <span className="ld-dept-name">{dept.label}</span>
                        <div className="ld-dept-progress-track">
                            <div
                                className="ld-dept-progress-fill"
                                style={{
                                    width: `${dept.value}%`,
                                    backgroundColor: dept.color || "#215EF8",
                                }}
                            />
                        </div>
                        <span className="ld-dept-percent">{dept.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
