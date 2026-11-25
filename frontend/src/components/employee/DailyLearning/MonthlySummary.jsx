import React, { useMemo } from "react";

import hourglassIcon from "../../../assets/Daily_Learning_Log/hourglass.svg";
import calendarIcon from "../../../assets/Daily_Learning_Log/green_calendar.svg";
import flameIcon from "../../../assets/Daily_Learning_Log/flame.svg";
import courseIcon from "../../../assets/Daily_Learning_Log/course.svg";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlySummary({ logs = [], isLoading = false }) {
    const currentMonthYear = useMemo(() => {
        return new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    }, []);

    const summaryData = useMemo(() => {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth(); // 0-indexed
        const curMonthShort = SHORT_MONTHS[curMonth];

        // Filter logs belonging to the current month & year
        let totalMinutes = 0;
        const currentMonthActiveDays = new Set();
        const allActiveDates = new Set();

        (logs || []).forEach((log) => {
            // Check created_at or date
            let logDateObj = null;
            if (log.created_at) {
                try {
                    logDateObj = new Date(String(log.created_at).replace(" ", "T"));
                } catch (e) {
                    logDateObj = null;
                }
            }

            let dayNum = null;
            let monthIdx = null;
            let logYear = curYear;

            if (logDateObj && !isNaN(logDateObj.getTime())) {
                dayNum = logDateObj.getDate();
                monthIdx = logDateObj.getMonth();
                logYear = logDateObj.getFullYear();
            } else if (log.date) {
                const parts = log.date.trim().split(" ");
                dayNum = parseInt(parts[0], 10);
                monthIdx = SHORT_MONTHS.indexOf(parts[1]);
            }

            if (dayNum !== null && monthIdx !== null && monthIdx >= 0) {
                const dateKey = `${logYear}-${String(monthIdx + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                allActiveDates.add(dateKey);

                if (logYear === curYear && monthIdx === curMonth) {
                    currentMonthActiveDays.add(dayNum);
                    const vMin = log.video_learning_duration_min ?? ((log.videoHours || 0) * 60 + (log.videoMinutes || 0));
                    const pMin = log.practice_handson_min ?? ((log.practiceHours || 0) * 60 + (log.practiceMinutes || 0));
                    const durMin = log.total_duration_min ?? (vMin + pMin);
                    totalMinutes += Math.max(0, durMin);
                }
            }
        });

        // 1. Total Hours
        const totHoursNum = totalMinutes / 60;
        const totalHoursFormatted = totHoursNum >= 10 
            ? `${Math.round(totHoursNum)}h` 
            : `${totHoursNum.toFixed(1).replace(/\.0$/, "")}h`;

        // 2. Days Active
        const daysActiveCount = currentMonthActiveDays.size;

        // 3. Streak (consecutive days up to today or yesterday)
        let streak = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            if (allActiveDates.has(dKey)) {
                streak++;
            } else if (i === 0) {
                // If today is not yet logged, check if yesterday was logged before breaking
                continue;
            } else {
                break;
            }
        }

        // 4. Avg / Day
        const avgMinutesPerActiveDay = daysActiveCount > 0 ? totalMinutes / daysActiveCount : 0;
        const avgHours = avgMinutesPerActiveDay / 60;
        const avgPerDayFormatted = `${avgHours.toFixed(1).replace(/\.0$/, "")}h`;

        return [
            {
                value: totalHoursFormatted,
                label: "Total Hours",
                imgSrc: hourglassIcon,
                imgAlt: "Total Hours",
                color: "blue",
            },
            {
                value: String(daysActiveCount),
                label: "Days Active",
                imgSrc: calendarIcon,
                imgAlt: "Days Active",
                color: "green",
            },
            {
                value: `${streak} day${streak === 1 ? "" : "s"}`,
                label: "Streak",
                imgSrc: flameIcon,
                imgAlt: "Streak",
                color: "orange",
            },
            {
                value: avgPerDayFormatted,
                label: "Avg / Day",
                imgSrc: courseIcon,
                imgAlt: "Avg / Day",
                color: "purple",
            },
        ];
    }, [logs]);

    return (
        <section className="emp-learning-card emp-monthly-summary-card">
            <h2 className="emp-card-title">{currentMonthYear} Summary</h2>

            <div className="emp-summary-grid">
                {summaryData.map((item) => (
                    <div className="emp-summary-item" key={item.label} data-color={item.color}>
                        <div className="emp-summary-svg-icon">
                            <img
                                src={item.imgSrc}
                                alt={item.imgAlt}
                                className={`emp-summary-icon-img ${item.label === 'Streak' ? 'flame-streak-icon' : ''}`}
                            />
                        </div>

                        <div className="emp-summary-content">
                            <strong>
                                {isLoading ? (
                                    <span className="ld-skeleton-block" style={{ width: 44, height: 18, display: "inline-block" }} />
                                ) : (
                                    item.value
                                )}
                            </strong>
                            <span>{item.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
