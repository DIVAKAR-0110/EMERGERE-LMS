import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ShieldAlert } from "lucide-react";

import emergere_logo from "../../assets/emergere_logo2.png";
import bgSvg from "../../assets/bg.svg";
import { useAuth } from "../../context/AuthContext";

import "../../styles/Login.css";

export default function Login() {
  const [error, setError] = useState("");
  const { login, isLoading, authError, idleMessage } = useAuth();
  const navigate = useNavigate();

  // If this page was ever opened as a popup window, immediately close it!
  useEffect(() => {
    if (typeof window !== "undefined" && window.opener && window.opener !== window) {
      window.close();
    }
  }, []);

  const handlePortalRedirect = (primaryPortal) => {
    switch (primaryPortal) {
      case "employee":
        navigate("/employee/dashboard");
        break;
      case "reporting-manager":
        navigate("/reporting-manager/dashboard");
        break;
      case "ld":
        navigate("/ld/dashboard");
        break;
      case "hr":
        navigate("/hr/dashboard");
        break;
      case "ceo":
      case "executive":
        navigate("/ceo/dashboard");
        break;
      default:
        navigate("/employee/dashboard");
        break;
    }
  };

  const handleMicrosoftSignIn = async () => {
    setError("");
    try {
      const result = await login();
      if (result && result.access) {
        handlePortalRedirect(result.access.primary_portal);
      }
    } catch (err) {
      setError(
        err.message ||
        "Authentication failed. Please check your Microsoft credentials."
      );
    }
  };

  const displayError = error || authError;

  return (
    <div className="login-page">
      {/* Background */}
      <div
        className="login-background"
        style={{ backgroundImage: `url(${bgSvg})` }}
      />

      {/* Background overlay */}
      <div className="login-overlay" />

      {/* Login Card */}
      <div className="login-card">
        {/* Logo */}
        <div className="login-brand">
          <img
            src={emergere_logo}
            alt="Emergere Technologies"
            className="login-logo"
          />
        </div>

        {/* Heading */}
        <h1 className="login-title">Welcome to LMS Portal</h1>

        {/* Description */}
        <p className="login-description">
          A centralized platform for employee learning and growth
        </p>

        {/* Divider */}
        <div className="login-divider" />

        {/* Sign-in text */}
        <p className="login-sign-text">Sign in with your Microsoft organization account</p>

        {/* Session Timeout Idle Notification Banner */}
        {idleMessage && (
          <div
            className="login-error"
            style={{
              backgroundColor: "rgba(180, 120, 20, 0.3)",
              borderColor: "rgba(255, 180, 50, 0.6)",
              color: "#ffebb3",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textAlign: "left",
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{idleMessage}</span>
          </div>
        )}

        {/* Error Notification */}
        {displayError && (
          <div
            className="login-error"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textAlign: "left",
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{displayError}</span>
          </div>
        )}

        {/* Single Primary Sign In with Microsoft Button */}
        <button
          type="button"
          id="microsoft-sso-btn"
          className="microsoft-button"
          onClick={handleMicrosoftSignIn}
          disabled={isLoading}
        >
          {/* Microsoft 4-square Logo */}
          <span className="microsoft-logo" aria-hidden="true">
            <span className="ms-red" />
            <span className="ms-green" />
            <span className="ms-blue" />
            <span className="ms-yellow" />
          </span>

          <span className="microsoft-text">
            {isLoading ? "Signing in..." : "Sign in with Microsoft"}
          </span>
        </button>
      </div>
    </div>
  );
}
