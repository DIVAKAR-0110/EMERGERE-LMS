/**
 * Role-scoped pill suggestions for live chat input auto-suggest.
 * Computed instantaneously on the client side without database or network overhead.
 * STRICT SECURITY: Never includes or reveals database table names.
 */

const EMPLOYEE_SUGGESTION_POOL = [
    { id: "s-c1", label: "Show my enrolled courses", query: "Show my currently enrolled courses and completion status.", keywords: ["enroll", "enrolled", "my course", "courses", "current"] },
    { id: "s-c2", label: "What is my course progress?", query: "What is my overall course progress and completion percentage?", keywords: ["progress", "completion", "hours", "percentage", "rate"] },
    { id: "s-c3", label: "Recommend courses for my skills", query: "Recommend courses tailored to my technical skills and learning goals.", keywords: ["recommend", "suggest", "skills", "learn", "course"] },
    { id: "s-c4", label: "Give me one course to learn", query: "Give me one course to learn.", keywords: ["one", "single", "best course", "pick"] },
    { id: "s-r1", label: "Where is my course request pending?", query: "Where is my course request currently pending and who is reviewing it?", keywords: ["request", "pending", "status", "approval", "review", "waiting"] },
    { id: "s-r2", label: "How do I request a course?", query: "How do I submit a new course request in the LMS?", keywords: ["how", "request", "apply", "submit", "new course"] },
    { id: "s-ct1", label: "What certifications have I earned?", query: "What certifications and credentials do I currently have on record?", keywords: ["cert", "certs", "certification", "credential", "certificate"] },
    { id: "s-ct2", label: "Recommend certifications for me", query: "What industry certifications should I pursue for my career advancement?", keywords: ["cert", "certification", "career", "exam", "recommend cert"] },
    { id: "s-rm1", label: "Show my reimbursement claims", query: "Show all my reimbursement claims and current payment status.", keywords: ["reimb", "claim", "claims", "refund", "paid", "amount"] },
    { id: "s-rm2", label: "Reimbursement policy limits", query: "What are the rules and deadlines for reimbursement submissions?", keywords: ["policy", "reimbursement", "rules", "budget", "limit"] },
    { id: "s-sk1", label: "Tell me about my technical skills", query: "Tell me about my technical skills and areas of expertise.", keywords: ["skill", "skills", "technical", "stack", "expertise"] },
    { id: "s-sm1", label: "Show my learning summary", query: "Give me a complete summary of my learning metrics and course progress.", keywords: ["summary", "counts", "metrics", "dashboard", "overall"] },
    { id: "s-wf-enr", label: "How does course approval work?", query: "How does the course enrollment approval workflow work?", keywords: ["approval", "course approval", "enrollment approval", "workflow", "how", "process"] },
    { id: "s-wf-hold", label: "Why is enrollment on hold?", query: "Why is my course enrollment on hold?", keywords: ["hold", "on hold", "onhold", "paused", "reason", "why on hold"] },
    { id: "s-wf-myhold", label: "Check my on-hold requests", query: "Check my on-hold course requests and status.", keywords: ["on hold", "my hold", "hold status", "pending hold", "requests on hold"] },
    { id: "s-comp", label: "List my completed courses", query: "List my completed courses", keywords: ["completed", "finish", "finished", "completed courses", "done"] },
    { id: "s-pend-rev", label: "Status of pending requests & reviewers", query: "What is the status of my pending course requests and who is reviewing them?", keywords: ["pending", "review", "reviewing", "who is reviewing", "who reviews", "course requests"] }
];

const LD_SUGGESTION_POOL = [
    { id: "s-ld-a1", label: "Show all pending course requests", query: "Show all pending course approval requests across the company.", keywords: ["pending", "approval", "requests", "all pending", "course request"] },
    { id: "s-ld-a2", label: "Pending certification requests", query: "Show all pending certification approval requests awaiting review.", keywords: ["cert", "certification", "pending", "approvals", "exam"] },
    { id: "s-ld-asgn", label: "How do I assign a course?", query: "How do I assign a course to an employee in the LD module?", keywords: ["assign", "assign course", "csv", "batch", "how to assign"] },
    { id: "s-ld-hold-pol", label: "Course approval & on-hold policy", query: "How does course enrollment approval and on hold status work?", keywords: ["approval", "on hold", "license limit", "batch limit", "policy"] },
    { id: "s-ld-e1", label: "Org-wide enrollment summary", query: "Show the complete organization-wide enrollment summary and metrics.", keywords: ["enroll", "org", "summary", "company", "total enrollments", "all employee"] },
    { id: "s-ld-e2", label: "Top enrolled courses", query: "What are the most popular and top-enrolled courses across the organization?", keywords: ["top", "popular", "enrolled", "courses", "best"] },
    { id: "s-ld-d1", label: "Department completion rates", query: "What are the course completion rates across different departments?", keywords: ["department", "completion", "rates", "dept", "analytics"] },
    { id: "s-ld-d2", label: "Departments needing upskilling", query: "Which departments have the lowest course completion rates?", keywords: ["lowest", "support", "behind", "upskilling", "department"] },
    { id: "s-ld-b1", label: "Training budget status", query: "What is the organization training budget allocation and utilization status?", keywords: ["budget", "spend", "utilization", "annual", "cost", "money"] },
    { id: "s-ld-b2", label: "Department budget breakdown", query: "Show budget allocation and spend breakdown by department.", keywords: ["budget", "department", "spend", "allocation"] },
    { id: "s-ld-r1", label: "Org reimbursement summary", query: "Show total reimbursement claims and settled amounts across all employees.", keywords: ["reimb", "claims", "org reimbursement", "total claims", "settled"] },
    { id: "s-ld-rec", label: "Recommend org-wide training", query: "Recommend organization-wide training and skill development initiatives.", keywords: ["recommend", "training", "org", "initiatives", "upskill"] }
];

/**
 * Returns matching pill suggestions based on user query and user role.
 */
export const getTypingSuggestions = (text = "", role = "Employee", limit = 4) => {
    const q = (text || "").trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const isLd = ["L&D Team", "L&D", "L_D", "LD"].includes(role);
    const pool = isLd ? LD_SUGGESTION_POOL : EMPLOYEE_SUGGESTION_POOL;

    const matches = pool.filter((item) => {
        const inLabel = item.label.toLowerCase().includes(q);
        const inQuery = item.query.toLowerCase().includes(q);
        const inKw = (item.keywords || []).some((kw) => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()));
        return inLabel || inQuery || inKw;
    });

    return matches.slice(0, limit);
};
