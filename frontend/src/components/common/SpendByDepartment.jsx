import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function SpendByDepartment({
    prefix = "ceo",
    departments,
    isLoading = false,
}) {
    const [showAllDepts, setShowAllDepts] = useState(false);
    const [isDeptAccordionOpen, setIsDeptAccordionOpen] = useState(true);

    const data = departments || [];
    const getBarWidth = (pct) => `${Math.min(Math.max(Number(pct) || 0, 0), 100)}%`;
    const tabletDisplayedDepts = showAllDepts ? data : data.slice(0, 3);

    const skeletonBlockClass = `${prefix}-skeleton-block`;

    return (
        <div className={`${prefix}-budget-section-card ${prefix}-budget-dept-card`}>
            {/* Desktop & Tablet Title */}
            <h2 className={`${prefix}-budget-section-title ${prefix}-dept-header-desktop`}>
                Spend by Department
            </h2>

            {/* 1. Desktop Table View */}
            <div className={`${prefix}-budget-dept-table-scroll`}>
                <table className={`${prefix}-budget-dept-table`}>
                    <colgroup>
                        <col className={`${prefix}-dept-col`} style={{ width: "35%" }} />
                        <col className={`${prefix}-amount-col`} style={{ width: "25%" }} />
                        <col className={`${prefix}-percentage-col`} style={{ width: "40%" }} />
                        {/* <col className={`${prefix}-utilization-col`} /> */}
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Department</th>
                            <th>Amount Spend</th>
                            <th style={{ textAlign: "left" }}>Percentage</th>
                            {/* <th style={{ textAlign: "center" }}>Budget Utilization</th> */}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading || !departments ? (
                            [1, 2, 3, 4, 5].map((idx) => (
                                <tr key={idx}>
                                    <td className={`${prefix}-dept-name-cell`}>
                                        <span className={skeletonBlockClass} style={{ width: "130px", height: "14px" }} />
                                    </td>
                                    <td className={`${prefix}-dept-amount-cell`}>
                                        <span className={skeletonBlockClass} style={{ width: "70px", height: "14px" }} />
                                    </td>
                                    <td className={`${prefix}-dept-pct-cell`}>
                                        <div className={`${prefix}-dept-pct-inner`}>
                                            <div className={`${prefix}-dept-pct-bar-wrap`}>
                                                <div className={`${prefix}-dept-pct-bar-fill ${skeletonBlockClass}`} style={{ width: "50%" }} />
                                            </div>
                                            <span className={`${prefix}-dept-pct-label`}>
                                                <span className={skeletonBlockClass} style={{ width: "24px", height: "12px" }} />
                                            </span>
                                        </div>
                                    </td>
                                    {/* <td className={`${prefix}-dept-util-cell`}>
                                        <span className={`${prefix}-dept-util-badge`} style={{ background: "#F1F5F9" }}>
                                            <span className={skeletonBlockClass} style={{ width: "24px", height: "12px" }} />
                                        </span>
                                    </td> */}
                                </tr>
                            ))
                        ) : (
                            data.map((dept) => (
                                <tr key={dept.department || dept.id}>
                                    <td className={`${prefix}-dept-name-cell`}>{dept.department || dept.name}</td>
                                    <td className={`${prefix}-dept-amount-cell`}>{dept.amount}</td>
                                    <td className={`${prefix}-dept-pct-cell`}>
                                        <div className={`${prefix}-dept-pct-inner`}>
                                            <div className={`${prefix}-dept-pct-bar-wrap`}>
                                                <div
                                                    className={`${prefix}-dept-pct-bar-fill`}
                                                    style={{
                                                        width: getBarWidth(dept.pct),
                                                        backgroundColor: dept.color || "#215EF8"
                                                    }}
                                                />
                                            </div>
                                            <span className={`${prefix}-dept-pct-label`}>{dept.pct}%</span>
                                        </div>
                                    </td>
                                    {/* <td className={`${prefix}-dept-util-cell`}>
                                        <span className={`${prefix}-dept-util-badge`}>
                                            {dept.utilization}%
                                        </span>
                                    </td> */}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 2. Tablet Department List View (768px - 1023px) */}
            <div className={`${prefix}-budget-dept-tablet-list`}>
                {isLoading || !departments ? (
                    [1, 2, 3].map((idx) => (
                        <div key={idx} className={`${prefix}-budget-dept-tablet-row`}>
                            <span className={`${prefix}-dept-tablet-name`}>
                                <span className={skeletonBlockClass} style={{ width: "120px", height: "14px" }} />
                            </span>
                            <span className={`${prefix}-dept-tablet-amount`}>
                                <span className={skeletonBlockClass} style={{ width: "60px", height: "14px" }} />
                            </span>
                            <div className={`${prefix}-dept-tablet-bar-wrap`}>
                                <div className={`${prefix}-dept-tablet-bar-fill ${skeletonBlockClass}`} style={{ width: "50%" }} />
                            </div>
                            <span className={`${prefix}-dept-tablet-pct`}>
                                <span className={skeletonBlockClass} style={{ width: "22px", height: "12px" }} />
                            </span>
                            <span className={`${prefix}-dept-tablet-badge`} style={{ background: "#F1F5F9" }}>
                                <span className={skeletonBlockClass} style={{ width: "22px", height: "12px" }} />
                            </span>
                        </div>
                    ))
                ) : (
                    tabletDisplayedDepts.map((dept) => (
                        <div key={dept.department || dept.id} className={`${prefix}-budget-dept-tablet-row`}>
                            <span className={`${prefix}-dept-tablet-name`}>{dept.department || dept.name}</span>
                            <span className={`${prefix}-dept-tablet-amount`}>{dept.amount}</span>
                            <div className={`${prefix}-dept-tablet-bar-wrap`}>
                                <div
                                    className={`${prefix}-dept-tablet-bar-fill`}
                                    style={{
                                        width: getBarWidth(dept.pct),
                                        backgroundColor: dept.color || "#215EF8"
                                    }}
                                />
                            </div>
                            <span className={`${prefix}-dept-tablet-pct`}>{dept.pct}%</span>
                            <span className={`${prefix}-dept-tablet-badge`}>{dept.utilization}%</span>
                        </div>
                    ))
                )}

                {data.length > 3 && (
                    <button
                        type="button"
                        className={`${prefix}-budget-dept-view-all-btn`}
                        onClick={() => setShowAllDepts(!showAllDepts)}
                    >
                        {showAllDepts ? "View Less Departments" : "View All Departments"}
                    </button>
                )}
            </div>

            {/* 3. Mobile Collapsible Accordion & Department Cards (<= 767px) */}
            <div className={`${prefix}-budget-dept-mobile-accordion`}>
                <button
                    type="button"
                    className={`${prefix}-budget-accordion-header`}
                    onClick={() => setIsDeptAccordionOpen(!isDeptAccordionOpen)}
                    aria-expanded={isDeptAccordionOpen}
                >
                    <span className={`${prefix}-budget-accordion-title`}>Spend by Department</span>
                    {isDeptAccordionOpen ? (
                        <ChevronUp size={18} className={`${prefix}-budget-accordion-chevron`} />
                    ) : (
                        <ChevronDown size={18} className={`${prefix}-budget-accordion-chevron`} />
                    )}
                </button>

                {isDeptAccordionOpen && (
                    <div className={`${prefix}-budget-dept-mobile-cards`}>
                        {isLoading || !departments ? (
                            [1, 2, 3].map((idx) => (
                                <div key={idx} className={`${prefix}-budget-dept-mobile-card`}>
                                    <div className={`${prefix}-budget-dept-mcard-name`}>
                                        <span className={skeletonBlockClass} style={{ width: "140px", height: "14px" }} />
                                    </div>
                                    <div className={`${prefix}-budget-dept-mcard-body`}>
                                        <div className={`${prefix}-budget-dept-mcard-row`}>
                                            <span className={`${prefix}-budget-dept-mcard-label`}>Amount Spend</span>
                                            <span className={skeletonBlockClass} style={{ width: "60px", height: "14px" }} />
                                        </div>
                                        <div className={`${prefix}-budget-dept-mcard-row`}>
                                            <span className={`${prefix}-budget-dept-mcard-label`}>Percentage</span>
                                            <span className={skeletonBlockClass} style={{ width: "50px", height: "14px" }} />
                                        </div>
                                        <div className={`${prefix}-budget-dept-mcard-row`}>
                                            <span className={`${prefix}-budget-dept-mcard-label`}>Budget Utilization</span>
                                            <span className={skeletonBlockClass} style={{ width: "40px", height: "14px" }} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            data.map((dept) => (
                                <div key={dept.department || dept.id} className={`${prefix}-budget-dept-mobile-card`}>
                                    <div className={`${prefix}-budget-dept-mcard-name`}>{dept.department || dept.name}</div>
                                    <div className={`${prefix}-budget-dept-mcard-body`}>
                                        <div className={`${prefix}-budget-dept-mcard-row`}>
                                            <span className={`${prefix}-budget-dept-mcard-label`}>Amount Spend</span>
                                            <span className={`${prefix}-budget-dept-mcard-val`}>{dept.amount}</span>
                                        </div>
                                        <div className={`${prefix}-budget-dept-mcard-row`}>
                                            <span className={`${prefix}-budget-dept-mcard-label`}>Percentage</span>
                                            <div className={`${prefix}-budget-dept-mcard-pct-group`}>
                                                <div className={`${prefix}-budget-dept-mcard-bar-wrap`}>
                                                    <div
                                                        className={`${prefix}-dept-pct-bar-fill`}
                                                        style={{
                                                            width: getBarWidth(dept.pct),
                                                            backgroundColor: dept.color || "#215EF8"
                                                        }}
                                                    />
                                                </div>
                                                <span className={`${prefix}-budget-dept-mcard-pct`}>{dept.pct}%</span>
                                            </div>
                                        </div>
                                        <div className={`${prefix}-budget-dept-mcard-row`}>
                                            <span className={`${prefix}-budget-dept-mcard-label`}>Budget Utilization</span>
                                            <span className={`${prefix}-budget-dept-mcard-badge`}>{dept.utilization}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
