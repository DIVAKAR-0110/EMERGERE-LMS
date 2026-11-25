import React from "react";
import book from "../../assets/book.svg";
import certificationIcon from "../../assets/certification.svg";
import summarylayoutIcon from "../../assets/summarylayout.svg";
import learningcontentIcon from "../../assets/learningcontent.svg";
import howIcon from "../../assets/how.svg";
import documentation from "../../assets/documentation.svg";
import insights from "../../assets/insights.svg";

// 4 Default Pills for Employee / RM / HR / CEO
export const defaultEmployeePromptPills = [
    {
        id: "emp-recommend",
        label: "Recommend courses for me",
        query: "Recommend courses for me based on my technical skills and learning goals.",
        className: "pill-recommend",
        type: "book",
    },
    {
        id: "emp-certifications",
        label: "What certifications should I get?",
        query: "What certifications should I pursue for advancing as a Software Professional?",
        className: "pill-certifications",
        type: "cert",
    },
    {
        id: "emp-summary",
        label: "Show my learning summary",
        query: "Can you show my current learning summary, hours logged, and completion rate?",
        className: "pill-summary",
        type: "summary",
    },
    {
        id: "emp-request",
        label: "How do I request a course?",
        query: "How do I submit a new course request or reimbursement claim in the LMS?",
        className: "pill-request",
        type: "how",
    },
];

// Default 8 Pills for L&D Team
export const defaultLdPromptPills = [
    {
        id: "ld-org-enrollment",
        label: "Org enrollment summary",
        query: "Show the complete organization-wide enrollment summary and metrics.",
        className: "pill-summary",
        type: "summary",
    },
    {
        id: "ld-pending-approvals",
        label: "Pending approvals count",
        query: "Show all pending course and certification requests across the company.",
        className: "pill-doc",
        type: "doc",
    },
    {
        id: "ld-dept-completion",
        label: "Department completion rates",
        query: "What are the course completion rates across different departments?",
        className: "pill-growth",
        type: "growth",
    },
    {
        id: "ld-budget-status",
        label: "Training budget status",
        query: "What is the organization training budget allocation and utilization status?",
        className: "pill-summary",
        type: "summary",
    },
    {
        id: "ld-top-courses",
        label: "Top enrolled courses",
        query: "Which courses have the highest enrollment and completion counts?",
        className: "pill-recommend",
        type: "book",
    },
    {
        id: "ld-org-reimb",
        label: "Org reimbursement summary",
        query: "Show total reimbursement claims and settled amounts across all employees.",
        className: "pill-summary",
        type: "summary",
    },
    {
        id: "ld-support-needed",
        label: "Which teams need support?",
        query: "Which teams or departments currently have learners behind schedule?",
        className: "pill-how",
        type: "growth",
    },
    {
        id: "ld-org-upskill",
        label: "Recommend org upskilling",
        query: "Recommend organization-wide training and skill development initiatives.",
        className: "pill-recommend",
        type: "book",
    },
];

const renderDynamicIcon = (type) => {
    switch (type) {
        case "cert":
            return (
                <div className="pill-icon-wrapper pill-icon-cert">
                    <img src={certificationIcon} alt="" className="pill-img-cert" />
                </div>
            );
        case "summary":
            return (
                <div className="pill-icon-wrapper pill-icon-summary">
                    <img src={summarylayoutIcon} alt="" className="pill-img-summary-frame" />
                    <img src={learningcontentIcon} alt="" className="pill-img-summary-content" />
                </div>
            );
        case "how":
            return (
                <div className="pill-icon-wrapper pill-icon-how">
                    <img src={howIcon} alt="" className="pill-img-how" />
                </div>
            );
        case "growth":
            return (
                <div className="pill-icon-wrapper pill-icon-growth">
                    <img src={insights} alt="" className="pill-img-growth" style={{ width: 14, height: 14 }} />
                </div>
            );
        case "doc":
            return (
                <div className="pill-icon-wrapper pill-icon-doc">
                    <img src={documentation} alt="" className="pill-img-doc" style={{ width: 14, height: 14 }} />
                </div>
            );
        case "book":
        default:
            return (
                <div className="pill-icon-wrapper pill-icon-book">
                    <img src={book} alt="" className="pill-img-book" />
                </div>
            );
    }
};

const SuggestedPromptPills = ({
    onSelectPrompt,
    disabled = false,
    role = "Employee",
    customPills = null,
}) => {
    const isLd = ["L&D Team", "L&D", "L_D", "LD"].includes(role);
    const fallbackPills = isLd ? defaultLdPromptPills : defaultEmployeePromptPills;

    const rawList = customPills && customPills.length > 0 ? customPills : fallbackPills;

    const activePills = rawList.map((p, idx) => ({
        id: p.id || `dyn-${idx}`,
        label: p.label,
        query: p.query || p.label,
        type: p.type || "book",
        className: p.className || (p.type === "cert" ? "pill-certifications" : p.type === "summary" ? "pill-summary" : p.type === "growth" ? "pill-growth" : "pill-recommend"),
    }));

    return (
        <div className={`suggested-pills-row ${isLd ? "suggested-pills-ld-grid" : ""}`}>
            {activePills.map((pill) => (
                <button
                    key={pill.id}
                    type="button"
                    className={`suggested-pill-btn ${pill.className}`}
                    onClick={() => onSelectPrompt(pill.query || pill.label)}
                    disabled={disabled}
                    title={pill.label}
                >
                    {renderDynamicIcon(pill.type)}
                    <span className="suggested-pill-label">{pill.label}</span>
                </button>
            ))}
        </div>
    );
};

export default SuggestedPromptPills;
