import React from "react";

const TimeFilterTabs = ({ activeTab, onTabChange }) => {
    const tabs = ["This Week", "This Month", "All Time"];

    return (
        <div className="emp-time-filter-tabs">
            {tabs.map((tab) => (
                <button
                    key={tab}
                    type="button"
                    className={`emp-time-filter-pill ${activeTab === tab ? "active" : ""
                        }`}
                    onClick={() => onTabChange(tab)}
                >
                    {tab}
                </button>
            ))}
        </div>
    );
};

export default TimeFilterTabs;