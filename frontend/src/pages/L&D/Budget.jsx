// SPA 2-Column Layout Redesign (Refreshed & Aligned)
import React, { useState, useEffect, useMemo } from "react";
import PageHeader from "../../components/common/PageHeader";
import TimeHorizonStatsRow from "../../components/budget/TimeHorizonStatsRow";
import BudgetDynamicLedgerTable from "../../components/budget/BudgetDynamicLedgerTable";
import BudgetComponentsDropdown from "../../components/budget/BudgetComponentsDropdown";
import SpendDistributionSummaryCard from "../../components/budget/SpendDistributionSummaryCard";
import TransactionDetailsModal from "../../components/budget/TransactionDetailsModal";
import BudgetAuditExportModal from "../../components/budget/BudgetAuditExportModal";

import { fetchCEOBudgetStats } from "../../services/teamService";
import {
    fetchBudgetHorizonStats,
    fetchCoursePurchaseHistory,
    fetchCertificationClaimsHistory,
    fetchDepartmentBudgets,
    fetchWorkshopsHistory,
    fetchTopCertificationProviders,
    fetchTopCourseProviders,
    isDateInPeriod,
    parseRecordDate,
    initialBudgetTimeHorizonStats
} from "../../services/budgetService";
import { useAuth } from "../../context/AuthContext";
import { Download, Calendar } from "lucide-react";
import BudgetYearDropdown from "../../components/budget/BudgetYearDropdown";
import "../../styles/L&D/BudgetModern.css";

export default function Budget() {
    const { token } = useAuth();

    // Left Column View Mode: 'summary' (Spend Distribution Default) | 'table' (Dynamic Ledger Table)
    const [currentLeftView, setCurrentLeftView] = useState("summary");

    // Active Category Selection on the Right Column: 'courses' | 'certifications' | 'workshops' | 'departments'
    const [activeCategory, setActiveCategory] = useState("courses");
    const [activeSubCategory, setActiveSubCategory] = useState("All");

    // Filter Bar expand state
    const [isCategoryExpanded, setIsCategoryExpanded] = useState(true);

    // Fiscal Year filter state
    const [selectedFiscalYear, setSelectedFiscalYear] = useState("This Month");

    // Modal states
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [transactionType, setTransactionType] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Dynamic stats data with local state
    const [horizonStats, setHorizonStats] = useState(initialBudgetTimeHorizonStats);
    const [coursePurchases, setCoursePurchases] = useState([]);
    const [certClaims, setCertClaims] = useState([]);
    const [workshops, setWorkshops] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [topCertProviders, setTopCertProviders] = useState(null);
    const [topCourseProviders, setTopCourseProviders] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Background sync with live database APIs
    useEffect(() => {
        let isMounted = true;
        const syncBackendData = async () => {
            setIsLoading(true);
            try {
                // Sync dynamic Top 4 KPI Horizon Stats from backend
                const statsRes = await fetchBudgetHorizonStats(token);
                if (isMounted && statsRes) {
                    setHorizonStats(statsRes);
                } else {
                    const ceoRes = await fetchCEOBudgetStats(token);
                    if (isMounted && ceoRes && ceoRes.total_investment) {
                        setHorizonStats((prev) => ({
                            ...prev,
                            all_time: {
                                ...prev,
                                amount: ceoRes.total_investment,
                                amount_formatted: ceoRes.total_investment_formatted,
                            },
                            this_year: {
                                ...prev.this_year,
                                amount: ceoRes.ytd_learning_spend || prev.this_year?.amount,
                                amount_formatted: ceoRes.ytd_learning_spend_formatted || prev.this_year?.amount_formatted,
                            }
                        }));
                    }
                }

                // Sync live Course Purchase History from LMS database
                const courseRes = await fetchCoursePurchaseHistory(token);
                if (isMounted && courseRes && courseRes.records && courseRes.records.length > 0) {
                    setCoursePurchases(courseRes.records);
                }

                // Sync live Certification Claims History from LMS database
                const certRes = await fetchCertificationClaimsHistory(token);
                if (isMounted && certRes && certRes.records && certRes.records.length > 0) {
                    setCertClaims(certRes.records);
                }

                // Sync live Workshops & Training Events from database
                const workshopRes = await fetchWorkshopsHistory(token);
                if (isMounted && workshopRes && workshopRes.records && workshopRes.records.length > 0) {
                    setWorkshops(workshopRes.records);
                }

                // Sync live Spend By Department from database & Azure AD
                const deptRes = await fetchDepartmentBudgets(token);
                if (isMounted && deptRes && deptRes.records && deptRes.records.length > 0) {
                    setDepartments(deptRes.records);
                }
            } catch (err) {
                console.error("Budget sync error:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        syncBackendData();
        return () => {
            isMounted = false;
        };
    }, [token]);

    // Fetch live Top 3 Certification & Course Providers dynamically from backend
    useEffect(() => {
        let isMounted = true;
        const fetchProviders = async () => {
            try {
                const [certRes, courseRes] = await Promise.all([
                    fetchTopCertificationProviders(selectedFiscalYear, token),
                    fetchTopCourseProviders(selectedFiscalYear, token),
                ]);
                if (isMounted) {
                    if (certRes && certRes.providers) setTopCertProviders(certRes.providers);
                    if (courseRes && courseRes.providers) setTopCourseProviders(courseRes.providers);
                }
            } catch (err) {
                console.error("Top providers sync error:", err);
            }
        };
        fetchProviders();
        return () => {
            isMounted = false;
        };
    }, [selectedFiscalYear, token]);


    const handleOpenTransactionDetail = (item, type) => {
        setSelectedTransaction(item);
        setTransactionType(type);
        setIsDetailModalOpen(true);
    };

    const handleCloseTransactionDetail = () => {
        setIsDetailModalOpen(false);
        setSelectedTransaction(null);
        setTransactionType(null);
    };

    const handleCategorySelect = (categoryKey, sub = "All") => {
        setActiveCategory(categoryKey);
        setActiveSubCategory(sub);
        setCurrentLeftView("table");
        setIsCategoryExpanded(true);
    };

    const handleViewCategoryTable = (categoryKey) => {
        setActiveCategory(categoryKey || "courses");
        setActiveSubCategory("All");
        setCurrentLeftView("table");
        setIsCategoryExpanded(true);
    };

    const handleBackToSummary = () => {
        setCurrentLeftView("summary");
        setActiveSubCategory("All");
        setIsCategoryExpanded(true);
    };

    // Filtered stream records based on active Period / Year dropdown ("This Month", "Last Quarter", "2026")
    const filteredCoursePurchases = useMemo(() => {
        return coursePurchases.filter((c) => isDateInPeriod(c.date || c.timestamp, selectedFiscalYear));
    }, [coursePurchases, selectedFiscalYear]);

    const filteredCertClaims = useMemo(() => {
        return certClaims.filter((c) => isDateInPeriod(c.payment_time || c.approval_time || c.submission_time, selectedFiscalYear));
    }, [certClaims, selectedFiscalYear]);

    const filteredWorkshops = useMemo(() => {
        return workshops.filter((w) => isDateInPeriod(w.start_date || w.dates, selectedFiscalYear));
    }, [workshops, selectedFiscalYear]);

    // Dynamically recompute Spend By Department from filtered records with 100.0% sharp percentage
    const activeDepartments = useMemo(() => {
        const deptNames = Array.from(new Set(
            departments.map((d) => d.department)
        ));

        const deptMap = {};
        deptNames.forEach((d) => {
            deptMap[d] = {
                department: d,
                spend_courses: 0,
                spend_certifications: 0,
                spend_workshops: 0,
                amount: 0,
            };
        });

        filteredCoursePurchases.forEach((c) => {
            const d = c.department || "Other";
            if (!deptMap[d]) deptMap[d] = { department: d, spend_courses: 0, spend_certifications: 0, spend_workshops: 0, amount: 0 };
            deptMap[d].spend_courses += Number(c.price || 0);
        });

        filteredCertClaims.forEach((c) => {
            const d = c.department || "Other";
            if (!deptMap[d]) deptMap[d] = { department: d, spend_courses: 0, spend_certifications: 0, spend_workshops: 0, amount: 0 };
            deptMap[d].spend_certifications += Number(c.claim_amount || c.amount || 0);
        });

        filteredWorkshops.forEach((w) => {
            const d = w.department || "Other";
            if (!deptMap[d]) deptMap[d] = { department: d, spend_courses: 0, spend_certifications: 0, spend_workshops: 0, amount: 0 };
            deptMap[d].spend_workshops += Number(w.actual_spent || 0);
        });

        Object.values(deptMap).forEach((d) => {
            d.amount = d.spend_courses + d.spend_certifications + d.spend_workshops;
        });

        const list = Object.values(deptMap);
        const total = list.reduce((sum, d) => sum + d.amount, 0);

        // Largest Remainder Method for strictly 100.0% sharp sum
        if (total > 0) {
            const exact = list.map((d) => (d.amount / total) * 100);
            const scaled = exact.map((e) => e * 10);
            const floored = scaled.map((s) => Math.floor(s));
            const remainders = scaled.map((s, idx) => s - floored[idx]);
            const diff = 1000 - floored.reduce((a, b) => a + b, 0);

            const sortedIndices = list
                .map((d, idx) => ({ idx, rem: remainders[idx], amt: d.amount }))
                .filter((item) => item.amt > 0)
                .sort((a, b) => b.rem - a.rem || b.amt - a.amt);

            for (let k = 0; k < Math.min(diff, sortedIndices.length); k++) {
                floored[sortedIndices[k].idx] += 1;
            }
            list.forEach((d, idx) => {
                d.percentage = floored[idx] / 10;
            });
        } else {
            list.forEach((d) => {
                d.percentage = 0.0;
            });
        }

        list.sort((a, b) => b.amount - a.amount || a.department.localeCompare(b.department));

        return list.map((item, idx) => ({
            id: idx + 1,
            department: item.department,
            spend_courses: item.spend_courses,
            spend_courses_formatted: `₹${item.spend_courses.toLocaleString("en-IN")}`,
            spend_certifications: item.spend_certifications,
            spend_certifications_formatted: `₹${item.spend_certifications.toLocaleString("en-IN")}`,
            spend_workshops: item.spend_workshops,
            spend_workshops_formatted: `₹${item.spend_workshops.toLocaleString("en-IN")}`,
            amount: item.amount,
            amount_formatted: `₹${item.amount.toLocaleString("en-IN")}`,
            ytd_spent: item.amount,
            ytd_spent_formatted: `₹${item.amount.toLocaleString("en-IN")}`,
            percentage: item.percentage,
            percentage_formatted: `${item.percentage.toFixed(1)}%`,
            utilization_pct: item.percentage,
            status: "On Track",
        }));
    }, [departments, filteredCoursePurchases, filteredCertClaims, filteredWorkshops]);

    // Calculate subcategory record counts for activeCategory
    const categorySubCounts = useMemo(() => {
        if (currentLeftView === "summary") {
            return {
                All: filteredCoursePurchases.length + filteredCertClaims.length + filteredWorkshops.length,
                courses: filteredCoursePurchases.length,
                certifications: filteredCertClaims.length,
                workshops: filteredWorkshops.length,
                departments: activeDepartments.length,
            };
        }
        if (activeCategory === "courses") {
            const counts = { All: filteredCoursePurchases.length };
            filteredCoursePurchases.forEach((c) => {
                counts[c.provider] = (counts[c.provider] || 0) + 1;
            });
            return counts;
        }
        if (activeCategory === "certifications") {
            const counts = { All: filteredCertClaims.length };
            filteredCertClaims.forEach((c) => {
                counts[c.issuing_body] = (counts[c.issuing_body] || 0) + 1;
            });
            return counts;
        }
        if (activeCategory === "workshops") {
            const counts = { All: filteredWorkshops.length };
            filteredWorkshops.forEach((w) => {
                const type = w.event_type || "Workshop";
                counts[type] = (counts[type] || 0) + 1;
            });
            return counts;
        }
        if (activeCategory === "departments") {
            const counts = { All: activeDepartments.length };
            activeDepartments.forEach((d) => {
                counts[d.department] = (counts[d.department] || 0) + 1;
            });
            return counts;
        }
        return {};
    }, [currentLeftView, activeCategory, filteredCoursePurchases, filteredCertClaims, filteredWorkshops, activeDepartments]);

    // Dynamic Lakh calculation for Components Dropdown & Spend Summary Cards
    const computedAmounts = useMemo(() => {
        const coursesSum = filteredCoursePurchases.reduce((sum, c) => sum + (c.price || 0), 0);
        const certsSum = filteredCertClaims.reduce((sum, c) => sum + (c.claim_amount || c.amount || 0), 0);
        const workshopsSum = filteredWorkshops.reduce((sum, w) => sum + (w.actual_spent || 0), 0);
        const deptsSum = activeDepartments.reduce((sum, d) => sum + (d.amount || d.ytd_spent || 0), 0);
        const summarySum = coursesSum + certsSum + workshopsSum;

        const toLakhs = (amt) => {
            if (!amt) return "₹0.00L";
            const l = amt / 100000;
            return `₹${l.toFixed(2)}L`;
        };

        return {
            summary: toLakhs(summarySum),
            courses: toLakhs(coursesSum),
            certifications: toLakhs(certsSum),
            workshops: toLakhs(workshopsSum),
            departments: toLakhs(deptsSum),
        };
    }, [filteredCoursePurchases, filteredCertClaims, filteredWorkshops, activeDepartments]);

    // Dynamic stream summaries for Spend Distribution Donut & Summary
    const dynamicStreamSummary = useMemo(() => {
        const coursesSum = filteredCoursePurchases.reduce((sum, c) => sum + (c.price || 0), 0);
        const certsSum = filteredCertClaims.reduce((sum, c) => sum + (c.claim_amount || c.amount || 0), 0);
        const workshopsSum = filteredWorkshops.reduce((sum, w) => sum + (w.actual_spent || w.amount || 0), 0);
        const total = coursesSum + certsSum + workshopsSum;

        const formatINR = (amt) => "₹" + Number(amt || 0).toLocaleString("en-IN");

        // Largest Remainder Method (Hare-Niemeyer) to ensure integer percentages sum exactly to 100% when total > 0
        let coursesPct = 0;
        let certsPct = 0;
        let workshopsPct = 0;

        if (total > 0) {
            const raw = [
                { key: "courses", exact: (coursesSum / total) * 100 },
                { key: "certifications", exact: (certsSum / total) * 100 },
                { key: "workshops", exact: (workshopsSum / total) * 100 },
            ];

            const withFloor = raw.map((item) => ({
                ...item,
                floor: Math.floor(item.exact),
                rem: item.exact - Math.floor(item.exact),
            }));

            const sumFloor = withFloor.reduce((acc, curr) => acc + curr.floor, 0);
            const diff = 100 - sumFloor;

            // Sort by remainder descending
            const sortedByRem = [...withFloor].sort((a, b) => b.rem - a.rem);
            for (let i = 0; i < diff && i < sortedByRem.length; i++) {
                sortedByRem[i].floor += 1;
            }

            const finalMap = {};
            sortedByRem.forEach((item) => {
                finalMap[item.key] = item.floor;
            });

            coursesPct = finalMap["courses"] || 0;
            certsPct = finalMap["certifications"] || 0;
            workshopsPct = finalMap["workshops"] || 0;
        }

        return [
            {
                key: "courses",
                label: "Individual Course Purchases",
                amount: coursesSum,
                amount_formatted: formatINR(coursesSum),
                pct: coursesPct,
                color: "#8B5CF6",
                count_label: `${filteredCoursePurchases.length} Courses Licensed`,
                description: "Direct course catalog licenses, employee requests, and subscription seats"
            },
            {
                key: "certifications",
                label: "Certification Reimbursement Claims",
                amount: certsSum,
                amount_formatted: formatINR(certsSum),
                pct: certsPct,
                color: "#F59E0B",
                count_label: `${filteredCertClaims.length} Claims Disbursed`,
                description: "Official industry exam fee reimbursements (AWS, Azure, GCP, CKA, PMP)"
            },
            {
                key: "workshops",
                label: "Workshops & College Events",
                amount: workshopsSum,
                amount_formatted: formatINR(workshopsSum),
                pct: workshopsPct,
                color: "#06B6D4",
                count_label: `${filteredWorkshops.length} Events Conducted`,
                description: "Campus symposiums, instructor-led bootcamps, and technical seminars"
            }
        ];
    }, [filteredCoursePurchases, filteredCertClaims, filteredWorkshops]);

    // Dynamic fiscal years discovered strictly from database records
    const availableFiscalYears = useMemo(() => {
        const yearSet = new Set();

        if (horizonStats?.available_years && Array.isArray(horizonStats.available_years)) {
            horizonStats.available_years.forEach((yr) => {
                const parsed = parseInt(yr, 10);
                if (!isNaN(parsed)) yearSet.add(parsed);
            });
        }

        [...coursePurchases, ...certClaims, ...workshops].forEach((rec) => {
            const d = parseRecordDate(rec.date || rec.timestamp || rec.payment_time || rec.submission_time || rec.start_date || rec.dates);
            if (d && !isNaN(d.getFullYear())) {
                yearSet.add(d.getFullYear());
            }
        });

        if (yearSet.size === 0) {
            yearSet.add(new Date().getFullYear());
        }

        return Array.from(yearSet).sort((a, b) => b - a).map(String);
    }, [horizonStats, coursePurchases, certClaims, workshops]);

    // Safety effect: if the selected year is not 'This Month', 'Last Quarter', or in availableFiscalYears, reset to 'This Month'
    useEffect(() => {
        if (
            selectedFiscalYear !== "This Month" &&
            selectedFiscalYear !== "Last Quarter" &&
            availableFiscalYears.length > 0 &&
            !availableFiscalYears.includes(selectedFiscalYear)
        ) {
            setSelectedFiscalYear("This Month");
        }
    }, [availableFiscalYears, selectedFiscalYear]);

    return (
        <div className="budget-modern-container">
            {/* 1. Page Header (Clean title and subtitle matching Approvals & Workflow) */}
            <div className="budget-top-header-row">
                <PageHeader
                    title="Budget & Spend Analytics"
                    subtitle="Track multi-year enterprise learning expenditures, course procurements, certification claims & workshops."
                />
            </div>

            {/* 2. Top Metric Cards (Exact design matching Approvals & Workflow reference) */}
            <TimeHorizonStatsRow stats={horizonStats} isLoading={isLoading} />

            {/* 3. Controls Row BELOW the stats: Period Selector & Components/Export Buttons */}
            <div className="budget-controls-row">
                <BudgetYearDropdown
                    value={selectedFiscalYear}
                    onChange={setSelectedFiscalYear}
                    availableYears={availableFiscalYears}
                />

                <div className="budget-controls-actions">
                    {currentLeftView !== "summary" && (
                        <BudgetComponentsDropdown
                            activeCategory={activeCategory}
                            currentView={currentLeftView}
                            onSelectCategory={handleCategorySelect}
                            onSelectSummaryView={() => {
                                setCurrentLeftView("summary");
                                setActiveSubCategory("All");
                            }}
                            counts={{
                                courses: filteredCoursePurchases.length,
                                certifications: filteredCertClaims.length,
                                workshops: filteredWorkshops.length,
                                departments: activeDepartments.length,
                            }}
                            amounts={computedAmounts}
                        />
                    )}

                    <button
                        type="button"
                        className="budget-export-btn"
                        onClick={() => setIsExportModalOpen(true)}
                    >
                        <Download size={14} />
                        <span>Generate Report</span>
                    </button>
                </div>
            </div>

            {/* 4. Full-Width Workspace: Table / Spend Summary (100% width, no sticky sidebar) */}
            <div className="budget-fullwidth-workspace">
                {/* Full-Width Canvas: Matches 100% width of the 4 stat cards above */}
                <div className="budget-fullwidth-main-content">
                    {currentLeftView === "summary" ? (
                        <SpendDistributionSummaryCard
                            streams={dynamicStreamSummary}
                            departments={activeDepartments}
                            selectedPeriod={selectedFiscalYear}
                            topCertProviders={topCertProviders}
                            certClaims={filteredCertClaims}
                            topCourseProviders={topCourseProviders}
                            courses={filteredCoursePurchases}
                            onViewCategoryTable={handleViewCategoryTable}
                            counts={{
                                courses: filteredCoursePurchases.length,
                                certifications: filteredCertClaims.length,
                                workshops: filteredWorkshops.length,
                                departments: activeDepartments.length,
                            }}
                            amounts={computedAmounts}
                        />
                    ) : (
                        <BudgetDynamicLedgerTable
                            activeCategory={activeCategory}
                            activeSubCategory={activeSubCategory}
                            onSelectSubCategory={setActiveSubCategory}
                            categorySubCounts={categorySubCounts}
                            coursePurchases={filteredCoursePurchases}
                            certClaims={filteredCertClaims}
                            workshops={filteredWorkshops}
                            departments={activeDepartments}
                            onSelectTransaction={handleOpenTransactionDetail}
                            isLoading={isLoading}
                            onBackToSummary={handleBackToSummary}
                        />
                    )}
                </div>
            </div>

            {/* Slide-out / Modal: Itemized Transaction Details & Audit Trail */}
            <TransactionDetailsModal
                isOpen={isDetailModalOpen}
                onClose={handleCloseTransactionDetail}
                transaction={selectedTransaction}
                type={transactionType}
            />

            {/* Modal: Generate Report */}
            <BudgetAuditExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                coursePurchases={coursePurchases}
                certClaims={certClaims}
                workshops={workshops}
                departments={departments}
            />
        </div>
    );
}
