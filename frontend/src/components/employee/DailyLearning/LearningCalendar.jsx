import React, { useState, useMemo, useEffect } from "react";
import leftArrowIcon from "../../../assets/course_library/leftarrow.svg";
import rightArrowIcon from "../../../assets/course_library/rightarrow.svg";
import lightBlueBoxIcon from "../../../assets/Daily_Learning_Log/lightbluebox.svg";
import blueBoxIcon from "../../../assets/Daily_Learning_Log/bluebox.svg";
import DayActivitiesModal from "./DayActivitiesModal";
import MonthlyHistoryModal from "./MonthlyHistoryModal";

// Month names array for header display
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Min Date bound: January 2025
const MIN_YEAR = 2025;
const MIN_MONTH = 0; // January

// Short month name lookup
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildLoggedDaysSet(logs) {
    const set = new Set();
    const today = new Date();
    const curYear = today.getFullYear();

    if (!logs || !logs.length) return set;

    for (const log of logs) {
        let y = curYear;
        let m = null;
        let d = null;

        if (log.created_at) {
            try {
                const dt = new Date(String(log.created_at).replace(" ", "T"));
                if (!isNaN(dt.getTime())) {
                    y = dt.getFullYear();
                    m = dt.getMonth();
                    d = dt.getDate();
                }
            } catch (e) {
                // ignore
            }
        }

        if (d === null && log.date) {
            const parts = log.date.trim().split(" ");
            if (parts.length >= 2) {
                const parsedDay = parseInt(parts[0], 10);
                const monthIndex = SHORT_MONTHS.indexOf(parts[1]);
                if (!isNaN(parsedDay) && monthIndex >= 0) {
                    d = parsedDay;
                    m = monthIndex;
                }
            }
        }

        if (d !== null && m !== null) {
            set.add(`${y}-${m}-${d}`);
        }
    }
    return set;
}


export default function LearningCalendar({ logs = [] }) {
    // Dynamic reference today's date state
    const [realToday, setRealToday] = useState(() => new Date());

    // Currently viewed month/year in calendar header
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalDate, setModalDate] = useState(null);
    const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const todayReal = new Date();
    const maxYear = todayReal.getFullYear();
    const maxMonth = todayReal.getMonth();

    // Check bounds for navigation
    const canGoPrev = year > MIN_YEAR || (year === MIN_YEAR && month > MIN_MONTH);
    const canGoNext = year < maxYear || (year === maxYear && month < maxMonth);

    // Handle day click to open details modal (only allowed for highlighted/logged dates or today)
    const handleDayClick = (dayNumber, isFuture, isLogged, isToday) => {
        if (isFuture || (!isLogged && !isToday)) return;
        setSelectedDay(dayNumber);
        setModalDate({
            day: dayNumber,
            monthIndex: month,
            monthName: MONTH_NAMES[month],
            year: year,
        });
        setIsModalOpen(true);
    };

    // Navigate to previous month (Min: Jan 2025)
    const handlePrevMonth = () => {
        if (canGoPrev) {
            setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        }
    };

    // Navigate to next month (Max: Current Date / Month)
    const handleNextMonth = () => {
        if (canGoNext) {
            setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        }
    };

    // Generate dynamic calendar grid days for Sunday-first format
    const calendarDays = useMemo(() => {
        const days = [];

        const todayYear = realToday.getFullYear();
        const todayMonth = realToday.getMonth();
        const todayDay = realToday.getDate();

        // Build set of logged day keys from real logs data
        const loggedDays = buildLoggedDaysSet(logs);

        // 1st day of month weekday (0 = Sun, 1 = Mon ... 6 = Sat)
        const firstDayIndex = new Date(year, month, 1).getDay();

        // Total days in current month
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        // 1. Previous month trailing slots (empty)
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            days.push({
                day: null,
                muted: true,
                logged: false,
                future: false,
                today: false,
                key: `prev-${i}`,
            });
        }

        // 2. Current month days
        for (let d = 1; d <= totalDaysInMonth; d++) {
            const isTodayDate = (year === todayYear && month === todayMonth && d === todayDay);
            const isFutureDate = (year > todayYear) ||
                (year === todayYear && month > todayMonth) ||
                (year === todayYear && month === todayMonth && d > todayDay);

            const dayKey = `${year}-${month}-${d}`;
            const hasLog = loggedDays.has(dayKey);

            days.push({
                day: d,
                muted: false,
                logged: !isFutureDate && hasLog,
                future: isFutureDate,
                today: isTodayDate,
                key: `current-${d}`,
            });
        }

        // 3. Next month leading slots (empty) to fill 35 or 42 slots
        const totalGridSlots = days.length <= 35 ? 35 : 42;
        const nextMonthDaysCount = totalGridSlots - days.length;
        for (let n = 1; n <= nextMonthDaysCount; n++) {
            days.push({
                day: null,
                muted: true,
                logged: false,
                future: false,
                today: false,
                key: `next-${n}`,
            });
        }

        return days;
    }, [year, month, realToday, logs]);

    return (
        <section className="emp-learning-card emp-calendar-card">
            <div className="emp-calendar-header">
                <h2 className="emp-card-title" style={{ margin: 0 }}>Learning Calendar</h2>

                <div className="emp-calendar-navigation">
                    <button
                        type="button"
                        className={`emp-calendar-nav-btn ${!canGoPrev ? "disabled" : ""}`}
                        aria-label="Previous Month"
                        onClick={handlePrevMonth}
                        disabled={!canGoPrev}
                    >
                        <img src={leftArrowIcon} alt="Previous Month" className="emp-nav-arrow-icon" />
                    </button>

                    <button
                        type="button"
                        className="emp-calendar-month-text-btn"
                        onClick={() => setIsMonthModalOpen(true)}
                        title="Click to view full month learning history"
                    >
                        {MONTH_NAMES[month]} {year}
                    </button>

                    <button
                        type="button"
                        className={`emp-calendar-nav-btn ${!canGoNext ? "disabled" : ""}`}
                        aria-label="Next Month"
                        onClick={handleNextMonth}
                        disabled={!canGoNext}
                    >
                        <img src={rightArrowIcon} alt="Next Month" className="emp-nav-arrow-icon" />
                    </button>
                </div>
            </div>

            <div className="emp-calendar-weekdays">
                <span>S</span>
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
            </div>

            <div className="emp-calendar-days">
                {calendarDays.map((item) => {
                    if (item.muted || !item.day) {
                        return <div key={item.key} className="emp-calendar-day emp-muted" />;
                    }

                    const isClickable = !item.future && (item.logged || item.today);

                    return (
                        <button
                            type="button"
                            key={item.key}
                            className={`
                                emp-calendar-day
                                ${item.logged && !item.today && !item.future ? "logged" : ""}
                                ${item.today ? "today" : ""}
                                ${item.future ? "future-day" : ""}
                                ${!isClickable && !item.future ? "unlogged-day" : ""}
                                ${selectedDay === item.day ? "selected" : ""}
                            `}
                            onClick={() => handleDayClick(item.day, item.future, item.logged, item.today)}
                            disabled={!isClickable}
                        >
                            <span>{item.day}</span>
                            {item.logged && !item.today && !item.future && <span className="emp-logged-dot" />}
                            {item.today && <span className="emp-today-yellow-dot" />}
                        </button>
                    );
                })}
            </div>

            <div className="emp-calendar-legend">
                <div className="emp-legend-item">
                    <img src={lightBlueBoxIcon} alt="" className="emp-legend-box-img" />
                    <span>Learning logged</span>
                </div>

                <div className="emp-legend-item">
                    <img src={blueBoxIcon} alt="" className="emp-legend-box-img" />
                    <span>Today</span>
                </div>
            </div>

            {/* Day Activities Modal */}
            <DayActivitiesModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                selectedDate={modalDate}
                logs={logs}
            />

            {/* Monthly Learning History Modal */}
            <MonthlyHistoryModal
                isOpen={isMonthModalOpen}
                onClose={() => setIsMonthModalOpen(false)}
                currentMonth={month}
                currentYear={year}
                logs={logs}
            />
        </section>
    );
}
