import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import badgeIcon from "../../../assets/Certification/badge.svg";
import webIcon from "../../../assets/Certification/web.svg";
import calIcon from "../../../assets/Certification/cal.svg";
import lineIcon from "../../../assets/Certification/line.svg";
import blackdownarrowIcon from "../../../assets/Certification/blackdownarrow.svg";
import blackrightarrowIcon from "../../../assets/Certification/blackrightarrow.svg";
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

function resolveWorkflowSteps(req) {
    const submittedDate = formatShortDate(req.employee_stage_date || req.created_at) || "-";
    const reqStatus = (req.request_status || req.status || "Pending").toLowerCase();
    const isApproved = reqStatus === "approved";

    const empStatus = req.employee_stage_status || "Completed";
    const ldStatus = req.ld_stage_status || (isApproved ? "Completed" : "Pending");
    const ceoStatus = req.ceo_stage_status || (isApproved ? "Completed" : "Upcoming");
    const certStatus = req.cert_stage_status || (isApproved ? "Completed" : "Upcoming");
    const ceoBypassed = Boolean(req.is_ceo_bypassed);

    // Identify where rejection occurred
    const isLdRejected =
        String(ldStatus).toLowerCase() === "rejected" ||
        (reqStatus === "rejected" && String(ldStatus).toLowerCase() !== "completed");
    const isCeoRejected =
        !isLdRejected &&
        (String(ceoStatus).toLowerCase() === "rejected" ||
            (reqStatus === "rejected" && String(ceoStatus).toLowerCase() !== "completed"));

    // Resolve Notified to RM milestone
    const rmStageFromArr = Array.isArray(req.stages)
        ? req.stages.find((s) => s.stage_name === "Notified to RM" || s.stage_name === "RM" || s.stage_name === "Notify RM")
        : null;
    const rmStatus = rmStageFromArr?.stage_status || req.rm_stage_status || (empStatus === "Completed" ? "Completed" : "Upcoming");
    const rmRawDate = rmStageFromArr?.stage_date || req.notified_reporting_manager || req.rm_stage_date || (empStatus === "Completed" ? (req.employee_stage_date || req.created_at) : null);
    const rmDate = formatShortDate(rmRawDate) || (rmStatus === "Completed" ? submittedDate : "-");

    const normalizeStatus = (val, isFinal = false) => {
        const s = String(val || "").toLowerCase();
        if (s === "completed" || s === "approved") {
            return isFinal ? "completed_final" : "completed";
        }
        if (s === "rejected") return "rejected";
        if (s === "pending") return "pending";
        return "upcoming";
    };

    const resolveSubtext = (stageKey, statusVal, rawDate, extraBypass = false) => {
        const s = String(statusVal || "").toLowerCase();
        if (s === "rejected") {
            if (stageKey === "ld" && isLdRejected) return "Rejected";
            if (stageKey === "ceo" && isCeoRejected) return "Rejected";
            return "-";
        }
        if (extraBypass && s === "completed") {
            const d = formatShortDate(rawDate);
            return d ? `Bypassed · ${d}` : "Bypassed";
        }
        if (s === "completed" || s === "approved") return formatShortDate(rawDate) || "Completed";
        if (s === "pending") return "Pending";
        return "-";
    };

    return [
        {
            label: "Employee",
            status: normalizeStatus(empStatus, false),
            subtext: empStatus === "Completed" ? submittedDate : resolveSubtext("emp", empStatus, req.employee_stage_date),
        },
        {
            label: "Notified to RM",
            status: normalizeStatus(rmStatus, false),
            subtext: rmStatus === "Completed" ? rmDate : resolveSubtext("rm", rmStatus, rmDate),
        },
        {
            label: "L&D Approval",
            status: normalizeStatus(ldStatus, false),
            subtext: resolveSubtext("ld", ldStatus, req.ld_status_date),
        },
        {
            label: "CEO Approval",
            status: normalizeStatus(ceoStatus, false),
            subtext: resolveSubtext("ceo", ceoStatus, req.ceo_status_date, ceoBypassed),
        },
        {
            label: "Certificate Approved",
            status: normalizeStatus(certStatus, true),
            subtext: resolveSubtext("cert", certStatus, req.cert_status_date),
        },
    ];
}

export default function RequestCertificationCard({
    request,
    isExpanded = false,
    onToggleExpand,
    isHighlighted = false,
}) {
    const cardRef = useRef(null);

    useEffect(() => {
        if (!isHighlighted || !cardRef.current) return;
        const t = setTimeout(() => {
            cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(t);
    }, [isHighlighted]);

    const reqStatus = request.request_status || request.status || "Pending";
    const statusLower = String(reqStatus).toLowerCase();
    const providerName = request.provider_name || request.provider || "—";
    const reqCode = request.request_code || "";

    const formattedExamDate = formatShortDate(request.scheduled_exam_date || request.exam_date);
    const formattedCreatedDate = formatShortDate(request.created_at);
    const metaScheduleText = formattedExamDate
        ? `Exam: ${formattedExamDate}`
        : formattedCreatedDate
            ? `Requested: ${formattedCreatedDate}`
            : "Pending Schedule";

    const workflowSteps = resolveWorkflowSteps(request);

    return (
        <div
            ref={cardRef}
            data-request-id={reqCode || request.id}
            className={`emp-requests-card-wrapper ${isExpanded ? "is-expanded" : ""} ${isHighlighted ? "aw-card-highlighted" : ""}`}
        >
            <div className={`emp-requests-card-row ${isExpanded ? "is-expanded" : ""}`}>
                {/* 1. Names */}
                <div className="emp-req-col-name">
                    <div className="emp-cert-type-icon-box emp-badge-blue">
                        <img
                            src={badgeIcon}
                            alt="Request Certification"
                            style={{ width: 30, height: 30 }}
                        />
                    </div>

                    <div className="emp-cert-main-details">
                        <div className="emp-cert-title-row">
                            <span className="emp-cert-title-text" title={request.certification_name}>
                                {request.certification_name}
                            </span>
                            {isHighlighted && (
                                <span className="aw-notif-highlight-badge">Selected Request</span>
                            )}
                        </div>
                        <span className="emp-cert-category-text">
                            Request Certification
                        </span>
                    </div>
                </div>

                {/* 2. Provider */}
                <div className="emp-req-col-provider">
                    <div className="emp-cert-provider-info" title={providerName}>
                        <img src={webIcon} alt="Provider" style={{ width: 15, height: 15 }} />
                        <span>{providerName}</span>
                    </div>
                </div>

                {/* 3. Exam Dates */}
                <div className="emp-req-col-exam-date">
                    <div className="emp-cert-status-info" title={metaScheduleText}>
                        <img src={calIcon} alt="Schedule" style={{ width: 14, height: 14 }} />
                        <span>{metaScheduleText}</span>
                    </div>
                </div>

                {/* 4. Status */}
                <div className="emp-req-col-status">
                    <span className={`emp-reimb-status-pill ${statusLower}`}>
                        {reqStatus}
                    </span>
                </div>

                {/* 5. Action Arrow */}
                <div className="emp-req-col-action">
                    <button
                        type="button"
                        className={`emp-cert-req-arrow-btn ${isExpanded ? "expanded" : ""}`}
                        title={isExpanded ? "Hide Workflow" : "View Workflow"}
                        aria-label={isExpanded ? "Hide Request Workflow" : "Show Request Workflow"}
                        aria-expanded={isExpanded}
                        onClick={onToggleExpand}
                    >
                        <img
                            src={isExpanded ? blackdownarrowIcon : blackrightarrowIcon}
                            alt=""
                            style={isExpanded ? { width: 9, height: 5 } : { width: 5, height: 9 }}
                        />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="emp-cert-timeline-expanded-container">
                    <div className="emp-timeline-header-box">
                        <div className="emp-corner-icon-square">
                            <img src={cornerDownRightIcon} alt="" style={{ width: 19, height: 15 }} />
                        </div>
                        <span className="emp-timeline-title-text">Certification Request Workflow</span>
                    </div>

                    <div className="emp-timeline-stepper-row">
                        {workflowSteps.map((step, idx) => (
                            <React.Fragment key={step.label}>
                                <div className="emp-timeline-step-item">
                                    {step.status === "rejected" ? (
                                        <div className="emp-step-circle red" title="Rejected" style={{ width: 24, height: 24, marginBottom: 6 }}>
                                            <X size={13} strokeWidth={2.5} />
                                        </div>
                                    ) : (
                                        <img
                                            src={getTrackerStepIcon(step.status)}
                                            alt={step.status}
                                            style={{ width: 24, height: 24, marginBottom: 6 }}
                                        />
                                    )}
                                    <span className="emp-step-label">{step.label}</span>
                                    <span className={`emp-step-date ${step.subtext?.toLowerCase() === "rejected" ? "rejected" : ""}`}>
                                        {step.subtext}
                                    </span>
                                </div>
                                {idx < workflowSteps.length - 1 && (
                                    <div className="emp-tracker-timeline-connector" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
