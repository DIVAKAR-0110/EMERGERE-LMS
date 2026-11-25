import React from "react";
import { useNavigate } from "react-router-dom";
import walletIcon from "../../../assets/hr/Dashboard/file.svg";
import bigCircleSvg from "../../../assets/hr/Dashboard/big circle.svg";
import circlesSvg from "../../../assets/hr/Dashboard/circles.svg";
import tickIcon from "../../../assets/hr/Dashboard/tick.svg";
import pendingIcon from "../../../assets/hr/Dashboard/pending.svg";
import rejectedIcon from "../../../assets/hr/Dashboard/rejected.svg";

export default function ReimbursementOverview({
  totalClaims = null,
  growthPercent = null,
  approvedCount = null,
  pendingCount = null,
  rejectedCount = null,
  certClaimsCount,
  courseRequestsCount,
  isLoading = false,
}) {
  const navigate = useNavigate();

  const handleNavigateToApprovals = (statusFilter = "All") => {
    navigate("/hr/approvals-workflow", { state: { statusFilter } });
  };

  const isPositiveGrowth = growthPercent !== null && growthPercent > 0;

  return (
    <div className="hr-dashboard-card hr-reimbursement-card">
      <div className="hr-card-header-row">
        <h3 className="hr-card-title">Reimbursement Overview</h3>
        {/* <button
          type="button"
          className="hr-card-view-all"
          onClick={() => handleNavigateToApprovals("All")}
          aria-label="View all in Approvals & Workflow"
        >
          View All
        </button> */}
      </div>

      <div className="hr-reimbursement-body hr-card-body">
        {/* Top Section: Wallet Icon + Total Claims Stats */}
        <div className="hr-reimbursement-top">
          <div className="hr-wallet-circle-wrap">
            <img src={bigCircleSvg} alt="" className="hr-wallet-big-circle" />
            <img src={circlesSvg} alt="" className="hr-wallet-circles" />
            <img src={walletIcon} alt="Claims Wallet" className="hr-wallet-icon" />
          </div>

          <div className="hr-reimbursement-stats-info">
            <div className="hr-reimbursement-claims-label">Total Claims</div>
            <div className="hr-reimbursement-claims-num">
              {isLoading || totalClaims === null ? (
                <span className="ld-skeleton-block" style={{ width: 48, height: 28, display: "inline-block" }} />
              ) : (
                totalClaims
              )}
            </div>
            <div className="hr-reimbursement-period-wrap">
              <span className="hr-reimbursement-period">This Month</span>
              {isLoading || growthPercent === null ? (
                <span className="ld-skeleton-block" style={{ width: 100, height: 16, display: "inline-block", marginLeft: 6 }} />
              ) : (
                <div className={`hr-reimbursement-growth ${isPositiveGrowth ? "positive" : "negative"}`}>
                  <span className="hr-growth-arrow">{isPositiveGrowth ? "▲" : "▼"}</span>
                  <span className="hr-growth-pct">{Math.abs(growthPercent)}%</span>
                  <span className="hr-growth-vs">vs last month</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: 3 Status Boxes */}
        <div className="hr-reimbursement-status-grid">
          <div
            className="hr-status-box hr-status-approved"
            onClick={() => handleNavigateToApprovals("Approved")}
            role="button"
            tabIndex={0}
            title="View approved requests in Approvals & Workflow"
          >
            <div className="hr-status-icon-wrap">
              <img src={tickIcon} alt="Approved" className="hr-status-icon" />
            </div>
            <div className="hr-status-info">
              <div className="hr-status-num">
                {isLoading || approvedCount === null ? (
                  <span className="ld-skeleton-block" style={{ width: 28, height: 20, display: "inline-block" }} />
                ) : (
                  approvedCount
                )}
              </div>
              <div className="hr-status-label">Approved</div>
            </div>
          </div>

          <div
            className="hr-status-box hr-status-pending"
            onClick={() => handleNavigateToApprovals("Pending")}
            role="button"
            tabIndex={0}
            title="View pending requests in Approvals & Workflow"
          >
            <div className="hr-status-icon-wrap">
              <img src={pendingIcon} alt="Pending" className="hr-status-icon" />
            </div>
            <div className="hr-status-info">
              <div className="hr-status-num">
                {isLoading || pendingCount === null ? (
                  <span className="ld-skeleton-block" style={{ width: 28, height: 20, display: "inline-block" }} />
                ) : (
                  pendingCount
                )}
              </div>
              <div className="hr-status-label">Pending</div>
            </div>
          </div>

          <div
            className="hr-status-box hr-status-rejected"
            onClick={() => handleNavigateToApprovals("Rejected")}
            role="button"
            tabIndex={0}
            title="View rejected requests in Approvals & Workflow"
          >
            <div className="hr-status-icon-wrap">
              <img src={rejectedIcon} alt="Rejected" className="hr-status-icon" />
            </div>
            <div className="hr-status-info">
              <div className="hr-status-num">
                {isLoading || rejectedCount === null ? (
                  <span className="ld-skeleton-block" style={{ width: 28, height: 20, display: "inline-block" }} />
                ) : (
                  rejectedCount
                )}
              </div>
              <div className="hr-status-label">Rejected</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
