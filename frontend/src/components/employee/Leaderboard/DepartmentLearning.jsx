import React from "react";

const DEFAULT_DEPT_COLORS = ["#2667F9", "#31C27E", "#9E5DF9", "#FDAD33", "#2BC3F3", "#EC4899", "#8B5CF6", "#10B981"];

const DepartmentLearning = ({ departments = [], isLoading = false }) => {
    return (
        <div className="emp-leaderboard-card emp-department-learning-card">
            <h3 className="emp-leaderboard-card-title">Learning by Department</h3>
            <div className="emp-department-learning-list">
                {isLoading ? (
                    [1, 2, 3, 4].map((i) => (
                        <div key={`dept-skel-${i}`} className="emp-department-row" style={{ opacity: 0.85 }}>
                            <span className="emp-department-name">
                                <span className="ld-skeleton-block" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
                            </span>
                            <div className="emp-department-progress-track">
                                <span className="ld-skeleton-block" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
                            </div>
                            <span className="emp-department-percentage">
                                <span className="ld-skeleton-block" style={{ width: '28px', height: '14px', borderRadius: '4px' }} />
                            </span>
                        </div>
                    ))
                ) : departments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px 0", color: "#94a3b8", fontSize: "13px" }}>
                        No department learning data available.
                    </div>
                ) : (
                    departments.map((dept, index) => {
                        const pct = Number(dept.percentage ?? dept.progress ?? 0);
                        const color = dept.color || DEFAULT_DEPT_COLORS[index % DEFAULT_DEPT_COLORS.length];
                        return (
                            <div key={dept.name || index} className="emp-department-row">
                                <span className="emp-department-name" title={dept.name}>{dept.name}</span>
                                <div className="emp-department-progress-track">
                                    <div
                                        className="emp-department-progress-fill"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: color,
                                        }}
                                    />
                                </div>
                                <span className="emp-department-percentage">{pct}%</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DepartmentLearning;
