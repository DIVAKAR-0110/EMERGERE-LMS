import React from "react";
import { X } from "lucide-react";
import cornerDownRightIcon from "../../../assets/Certification/CornerDownRight.svg";
import blueCheckIcon from "../../../assets/course_library/bluecheck.svg";
import greenCheckIcon from "../../../assets/course_library/greencheck.svg";
import clockIcon from "../../../assets/course_library/clock.svg";
import circleDotIcon from "../../../assets/course_library/CircleDot.svg";

const getTrackerStepIcon = (status) => {
    switch (status) {
        case "completed":
            return blueCheckIcon;
        case "completed_final":
            return greenCheckIcon;
        case "pending":
            return clockIcon;
        case "upcoming":
        default:
            return circleDotIcon;
    }
};

function formatShortDate(rawDate) {
    if (!rawDate) return null;
    const str = String(rawDate).trim().slice(0, 10);
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (isoMatch) {
        const parsed = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
        if (!isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
        }
    }
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }
    return str;
}

export function resolveCourseTimelineSteps(course) {
    const rawStages = Array.isArray(course?.stages) ? course.stages : (Array.isArray(course?.raw?.stages) ? course.raw.stages : []);
    const stageMap = {};
    rawStages.forEach((s) => {
        const key = String(s.stage_name || "").toLowerCase().trim();
        stageMap[key] = s;
    });

    const isHrApproved = (course?.status || course?.hr_status || course?.raw?.hr_status || "").toLowerCase() === "approved";
    const isHrRejected = (course?.status || course?.hr_status || course?.raw?.hr_status || "").toLowerCase() === "rejected";

    // 1. Employee Request
    const s1 = stageMap["employee request"] || stageMap["employee"] || {};
    const s1Date = s1.stage_date || course?.employee_request_date || course?.raw?.employee_request_date || course?.created_at || course?.raw?.created_at;
    const s1Status = s1.stage_status || "Completed";

    // 2. L&D Approval
    const s2 = stageMap["l&d approval"] || stageMap["l&d"] || stageMap["l&d status"] || {};
    const s2Date = s2.stage_date || course?.ld_approval_date || course?.raw?.ld_approval_date || s1Date;
    const s2Status = s2.stage_status || "Completed";

    // 3. CEO Approval / CEO Bypass
    const isCeoBypassed = Boolean(
        course?.is_ceo_bypassed ||
        course?.raw?.is_ceo_bypassed ||
        String(course?.id || "").toUpperCase().replace(/[\s_]+/g, "-").startsWith("PUR") ||
        String(course?.claim_id || "").toUpperCase().replace(/[\s_]+/g, "-").startsWith("PUR") ||
        String(course?.course_request_code || "").toUpperCase().replace(/[\s_]+/g, "-").startsWith("PUR") ||
        String(course?.raw?.claim_id || "").toUpperCase().replace(/[\s_]+/g, "-").startsWith("PUR") ||
        stageMap["ceo bypass"]
    );
    const ceoStageLabel = isCeoBypassed ? "CEO Bypass" : "CEO Approval";

    const s3 = stageMap["ceo bypass"] || stageMap["ceo approval"] || stageMap["ceo"] || {};
    const s3Date = s3.stage_date || course?.ceo_status_date || course?.raw?.ceo_status_date || s2Date;
    const s3Status = s3.stage_status || "Completed";

    const isLdRejected = String(s2Status || "").toLowerCase() === "rejected";
    const isLdPending = String(s2Status || "").toLowerCase() === "pending";
    const isCeoRejected = String(s3Status || "").toLowerCase() === "rejected";
    const isCeoPending = String(s3Status || "").toLowerCase() === "pending";
    const isPriorRejected = isLdRejected || isCeoRejected;
    const isPriorPending = isLdPending || isCeoPending;

    // 4. Course Purchase
    const s4 = stageMap["course purchase"] || stageMap["purchase"] || {};
    const s4Date = s4.stage_date || course?.created_at || course?.raw?.created_at || s3Date;
    let s4Status = s4.stage_status || "Completed";
    if (isPriorRejected) {
        s4Status = "rejected";
    } else if (isPriorPending) {
        s4Status = "upcoming";
    }

    // 5. HR Reimbursement Claim Approval
    const s5 = stageMap["hr claim approval"] || stageMap["hr approval"] || {};
    const s5Date = s5.stage_date || course?.hr_reviewed_at || course?.raw?.hr_reviewed_at;
    let s5Status = s5.stage_status || course?.status || "Pending";
    if (isPriorRejected) {
        s5Status = "rejected";
    } else if (isPriorPending) {
        s5Status = "upcoming";
    } else if (isHrApproved) {
        s5Status = "Completed";
    } else if (isHrRejected) {
        s5Status = "Rejected";
    }

    // 6. Claimed (Amount paid by HR team after payment slip upload)
    const isCoursePaid =
        !isPriorRejected &&
        !isPriorPending &&
        ((course?.payment_status || course?.raw?.payment_status || "").toLowerCase() === "paid" ||
            Boolean(course?.payment_slip_path || course?.raw?.payment_slip_path) ||
            Boolean(course?.payment_code || course?.raw?.payment_code));

    const coursePaidDate =
        course?.paid_on ||
        course?.raw?.paid_on ||
        stageMap["claimed"]?.stage_date ||
        stageMap["reimbursed"]?.stage_date ||
        (isCoursePaid ? (course?.updated_at || course?.raw?.updated_at) : null);

    let s6Status = "upcoming";
    let s6Subtext = "-";
    if (isPriorRejected) {
        s6Status = "rejected";
        s6Subtext = "-";
    } else if (isPriorPending) {
        s6Status = "upcoming";
        s6Subtext = "-";
    } else if (isCoursePaid) {
        s6Status = "completed_final";
        s6Subtext = formatShortDate(coursePaidDate) || "Claimed";
    } else if (isHrApproved) {
        s6Status = "pending";
        s6Subtext = "Pending";
    } else if (isHrRejected) {
        s6Status = "rejected";
        s6Subtext = "-";
    }

    const normalize = (val, isFinal = false) => {
        const s = String(val || "").toLowerCase();
        if (s === "completed" || s === "approved") return isFinal ? "completed_final" : "completed";
        if (s === "rejected") return "rejected";
        if (s === "pending") return "pending";
        return "upcoming";
    };

    const subtext = (statusVal, dateVal) => {
        const s = String(statusVal || "").toLowerCase();
        if (s === "rejected") return "Rejected";
        if (s === "completed" || s === "approved") return formatShortDate(dateVal) || "Completed";
        if (s === "pending") return "Pending";
        return "-";
    };

    return [
        { label: "Employee Request", status: normalize(s1Status), subtext: subtext(s1Status, s1Date) },
        { label: "L&D Approval", status: normalize(s2Status), subtext: subtext(s2Status, s2Date) },
        { label: ceoStageLabel, status: normalize(s3Status), subtext: subtext(s3Status, s3Date) },
        { label: "Course Purchase", status: normalize(s4Status), subtext: subtext(s4Status, s4Date) },
        { label: "HR Claim Approval", status: normalize(s5Status, false), subtext: subtext(s5Status, s5Date) },
        { label: "Claimed", status: s6Status, subtext: s6Subtext },
    ];
}

export function resolveCertificationTimelineSteps(claim) {
    const rawStages = Array.isArray(claim?.stages) ? claim.stages : (Array.isArray(claim?.raw?.stages) ? claim.raw.stages : []);
    const stageMap = {};
    rawStages.forEach((s) => {
        const key = String(s.stage_name || "").toLowerCase().trim();
        stageMap[key] = s;
    });

    const isHrApproved = (claim?.status || claim?.raw?.status || "").toLowerCase() === "approved";
    const isHrRejected = (claim?.status || claim?.raw?.status || "").toLowerCase() === "rejected";

    // 1. Employee Request
    const s1 = stageMap["employee request"] || stageMap["employee"] || {};
    const s1Date = s1.stage_date || claim?.submitted_on || claim?.raw?.submitted_on || claim?.created_at || claim?.raw?.created_at;
    const s1Status = s1.stage_status || "Completed";

    // 2. L&D Approval
    const s2 = stageMap["l&d approval"] || stageMap["l&d status"] || stageMap["l&d"] || stageMap["notified to rm"] || {};
    const s2Date = s2.stage_date || s1Date;
    const s2Status = s2.stage_status || "Completed";

    // 3. CEO Approval / CEO Bypass
    const isCeoBypassed = Boolean(
        claim?.is_ceo_bypassed ||
        claim?.raw?.is_ceo_bypassed ||
        String(claim?.id || "").toUpperCase().replace(/[\s_]+/g, "-").startsWith("PUR") ||
        String(claim?.claim_code || "").toUpperCase().replace(/[\s_]+/g, "-").startsWith("PUR") ||
        String(claim?.raw?.claim_code || "").toUpperCase().replace(/[\s_]+/g, "-").startsWith("PUR") ||
        stageMap["ceo bypass"]
    );
    const ceoStageLabel = isCeoBypassed ? "CEO Bypass" : "CEO Approval";

    const s3 = stageMap["ceo bypass"] || stageMap["ceo approval"] || stageMap["ceo"] || {};
    const s3Date = s3.stage_date || s2Date;
    const s3Status = s3.stage_status || "Completed";

    const isLdRejected = String(s2Status || "").toLowerCase() === "rejected";
    const isLdPending = String(s2Status || "").toLowerCase() === "pending";
    const isCeoRejected = String(s3Status || "").toLowerCase() === "rejected";
    const isCeoPending = String(s3Status || "").toLowerCase() === "pending";
    const isPriorRejected = isLdRejected || isCeoRejected;
    const isPriorPending = isLdPending || isCeoPending;

    // 4. Certificate Approved (or Exam Completed)
    const s4 = stageMap["certificate approved"] || stageMap["certificate validation"] || {};
    const s4Date = s4.stage_date || claim?.scheduledExamDate || claim?.raw?.completion_exam_date || claim?.raw?.purchase_date || s3Date;
    let s4Status = s4.stage_status || "Completed";
    if (isPriorRejected) {
        s4Status = "rejected";
    } else if (isPriorPending) {
        s4Status = "upcoming";
    }

    // 5. HR Reimbursement Claim Approval
    const s5 = stageMap["hr approval"] || stageMap["hr claim approval"] || {};
    const s5Date = claim?.approved_on || claim?.raw?.approved_on || s5.stage_date || (isHrApproved ? (claim?.updated_at || claim?.raw?.updated_at) : null);
    let s5Status = isHrApproved ? "Completed" : (isHrRejected ? "Rejected" : (s5.stage_status || claim?.status || "Pending"));
    if (isPriorRejected) {
        s5Status = "rejected";
    } else if (isPriorPending) {
        s5Status = "upcoming";
    }

    // 6. Claimed (Amount paid by HR team after payment slip upload)
    const isCertPaid =
        !isPriorRejected &&
        !isPriorPending &&
        ((claim?.processing_status || claim?.processingStatus || claim?.raw?.processing_status || "").toLowerCase() === "paid" ||
            Boolean(claim?.payment_slip_path || claim?.raw?.payment_slip_path) ||
            Boolean(claim?.payment_code || claim?.raw?.payment_code) ||
            (stageMap["reimbursed"]?.stage_status || "").toLowerCase() === "completed");

    const certPaidDate =
        claim?.paid_on ||
        claim?.raw?.paid_on ||
        stageMap["reimbursed"]?.stage_date ||
        stageMap["claimed"]?.stage_date ||
        (isCertPaid ? (claim?.updated_at || claim?.raw?.updated_at) : null);

    let s6CertStatus = "upcoming";
    let s6CertSubtext = "-";
    if (isPriorRejected) {
        s6CertStatus = "rejected";
        s6CertSubtext = "-";
    } else if (isPriorPending) {
        s6CertStatus = "upcoming";
        s6CertSubtext = "-";
    } else if (isCertPaid) {
        s6CertStatus = "completed_final";
        s6CertSubtext = formatShortDate(certPaidDate) || "Claimed";
    } else if (isHrApproved) {
        s6CertStatus = "pending";
        s6CertSubtext = "Pending";
    } else if (isHrRejected) {
        s6CertStatus = "rejected";
        s6CertSubtext = "-";
    }

    const normalize = (val, isFinal = false) => {
        const s = String(val || "").toLowerCase();
        if (s === "completed" || s === "approved" || s === "reimbursed") return isFinal ? "completed_final" : "completed";
        if (s === "rejected") return "rejected";
        if (s === "pending") return "pending";
        return "upcoming";
    };

    const subtext = (statusVal, dateVal) => {
        const s = String(statusVal || "").toLowerCase();
        if (s === "rejected") return "Rejected";
        if (s === "completed" || s === "approved" || s === "reimbursed") return formatShortDate(dateVal) || "Completed";
        if (s === "pending") return "Pending";
        return "-";
    };

    return [
        { label: "Employee Request", status: normalize(s1Status), subtext: subtext(s1Status, s1Date) },
        { label: "L&D Approval", status: normalize(s2Status), subtext: subtext(s2Status, s2Date) },
        { label: ceoStageLabel, status: normalize(s3Status), subtext: subtext(s3Status, s3Date) },
        { label: "Certificate Approved", status: normalize(s4Status), subtext: subtext(s4Status, s4Date) },
        { label: "HR Claim Approval", status: normalize(s5Status, false), subtext: subtext(s5Status, s5Date) },
        { label: "Claimed", status: s6CertStatus, subtext: s6CertSubtext },
    ];
}

export default function HRWorkflowTimeline({
    title = "Request Workflow",
    steps = [],
    item = null,
    type = "course"
    }) {
        const finalSteps = steps && steps.length > 0
            ? steps
            : (type === "course" ? resolveCourseTimelineSteps(item) : resolveCertificationTimelineSteps(item));

        return (
            <div className="hr-aw-timeline-expanded-container">
                <div className="hr-timeline-header-box">
                    <div className="hr-corner-icon-square">
                        <img src={cornerDownRightIcon} alt="" style={{ width: 19, height: 15 }} />
                    </div>
                    <span className="hr-timeline-title-text">{title}</span>
                </div>

                <div className="hr-timeline-stepper-row">
                    {finalSteps.map((step, idx) => (
                        <React.Fragment key={step.label || idx}>
                            <div className="hr-timeline-step-item">
                                {step.status === "rejected" ? (
                                    <div className="hr-step-circle-red" title="Rejected">
                                        <X size={13} strokeWidth={2.5} />
                                    </div>
                                ) : (
                                    <img
                                        src={getTrackerStepIcon(step.status)}
                                        alt={step.status}
                                        className="hr-timeline-step-icon"
                                    />
                                )}
                                <span className="hr-step-label">{step.label}</span>
                                <span className={`hr-step-date ${step.status === "rejected" ? "rejected" : ""}`}>
                                    {step.subtext}
                                </span>
                            </div>
                            {idx < finalSteps.length - 1 && (
                                <div className="hr-timeline-dotted-line" />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    }
