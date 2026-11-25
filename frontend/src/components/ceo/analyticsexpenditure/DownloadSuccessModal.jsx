import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import closeIcon from "../../../assets/Leaderboard/close.svg";
import greentickIcon from "../../../assets/Leaderboard/greentick.svg";
import "../../../styles/ceo/DownloadReportModal.css";

export default function DownloadSuccessModal({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose?.();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="hr-modal-overlay">
      <div
        className="hr-success-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          className="hr-modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <img src={closeIcon} alt="close" width={14} height={14} />
        </button>

        {/* Green Tick Icon Circle */}
        <div className="hr-success-icon-circle">
          <img
            src={greentickIcon}
            alt="Success"
            className="hr-success-icon-img"
            width={53}
            height={53}
          />
        </div>

        {/* Title */}
        <h3 className="hr-success-title">
          Report Downloaded
          <br />
          Successfully!
        </h3>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
