import React from 'react';

const StatCard = ({ icon, value, label, title }) => {
    return (
        <div className="emp-stat-card-container" title={title || label}>
            <div className="emp-dashboard-stat-card">
                <div className="emp-stat-icon-circle">
                    {icon}
                </div>
                <div className="emp-stat-info">
                    <span className="emp-stat-value">
                        {value !== null && value !== undefined ? (
                            value
                        ) : (
                            <span className="ld-skeleton-block" style={{ width: 44, height: 24, display: "inline-block" }} />
                        )}
                    </span>
                    <span className="emp-stat-label">{label}</span>
                </div>
            </div>
            <div className="emp-stat-card-bottom-bar" />
        </div>
    );
};

export default StatCard;