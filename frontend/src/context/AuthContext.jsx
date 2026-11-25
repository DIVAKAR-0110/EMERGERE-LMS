import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useMsal } from "@azure/msal-react";
import axios from "axios";
import { loginRequest } from "../config/msalConfig";
import { normalizeRoleName } from "../utils/roleUtils";
import { clearCourseMetadataCache } from "../services/courseMetadataService";

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout

/**
 * Returns true if the current window is an MSAL popup (opened by loginPopup).
 * MSAL popup windows have window.opener pointing to the parent window.
 */
const isInsideMsalPopup = () => {
  try {
    return (
      typeof window !== "undefined" &&
      window.opener !== null &&
      window.opener !== window
    );
  } catch {
    return false;
  }
};

export function AuthProvider({ children }) {
  const { instance } = useMsal();

  // Primary user state from backend source of truth
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("lms_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [primaryRole, setPrimaryRole] = useState(() => {
    return localStorage.getItem("lms_primary_role") || null;
  });

  // Current access mode: "PRIMARY" or "EMPLOYEE"
  const [currentMode, setCurrentMode] = useState(() => {
    return localStorage.getItem("lms_current_mode") || "PRIMARY";
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("lms_token") || null;
  });

  const [isProfileCompleted, setIsProfileCompleted] = useState(() => {
    const saved = localStorage.getItem("lms_profile_completed");
    return saved !== null ? saved === "true" : true;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [idleMessage, setIdleMessage] = useState(null);

  const idleTimerRef = useRef(null);

  // Derived role for UI presentation
  const isViewingAsEmployee = currentMode === "EMPLOYEE";
  const activeRole = isViewingAsEmployee ? "Employee" : primaryRole;

  // Check if user is a management role eligible for the switcher
  const isManagementRole = primaryRole && normalizeRoleName(primaryRole) !== "Employee";

  // Backward-compatible currentUser object for legacy components
  const currentUser = user
    ? {
      ...user,
      role: activeRole,
      title: activeRole,
    }
    : null;

  /**
   * Reset idle timeout timer on user activity
   */
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // Only set idle timer if user is authenticated
    if (user && token) {
      idleTimerRef.current = setTimeout(() => {
        console.warn("Session expired due to 30 minutes of inactivity.");
        logout("Your session has expired due to 30 minutes of inactivity. Please sign in again.");
      }, IDLE_TIMEOUT_MS);
    }
  }, [user, token]);

  // Set up activity listeners for 30-minute idle session timeout
  useEffect(() => {
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    const handleActivity = () => resetIdleTimer();

    activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity));
    resetIdleTimer();

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  // Handle Microsoft auth response on page load.
  //
  // POPUP flow:  popup loads /login → handleRedirectPromise() processes the auth code
  //              → MSAL sends token to main window via BroadcastChannel → popup closes
  //              → main window's loginPopup() resolves → we navigate to dashboard
  //
  // REDIRECT flow (fallback): main window reloads /login → handleRedirectPromise()
  //              → processes token → we navigate to dashboard directly
  useEffect(() => {
    let isMounted = true;
    const inPopup = isInsideMsalPopup();

    // If loaded inside any lingering popup window, immediately close it!
    if (inPopup) {
      instance.handleRedirectPromise().finally(() => {
        window.close();
      });
      return;
    }

    const handleRedirectReturn = async () => {
      const hasAuthCode =
        typeof window !== "undefined" &&
        (window.location.hash.includes("code=") || window.location.search.includes("code="));
      if (hasAuthCode && isMounted) {
        setIsLoading(true);
      }
      try {
        const response = await instance.handleRedirectPromise();

        // In the main window: navigate to correct dashboard.
        if (response && (response.idToken || response.accessToken) && isMounted) {
          const authToken = response.idToken || response.accessToken;
          setIsLoading(true);
          const result = await verifyTokenWithBackend(authToken);
          if (result && result.access) {
            const portal = result.access.primary_portal;
            window.location.replace(portal ? `/${portal}/dashboard` : "/employee/dashboard");
          }
        }
      } catch (err) {
        // Ignore expected MSAL startup noise.
        const ignoredCodes = [
          "no_token_request_cache_error",
          "no_cached_authority_error",
          "interaction_in_progress",
        ];
        const isIgnored = ignoredCodes.some(
          (code) => err?.errorCode === code || err?.message?.includes(code)
        );
        if (!isIgnored && isMounted) {
          console.error("[AuthContext] Microsoft redirect error:", err);
          setAuthError(err.message || "Failed to process Microsoft authentication.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    handleRedirectReturn();

    return () => {
      isMounted = false;
    };
  }, [instance]);

  // On mount, silently re-verify stored token with backend to keep active user in sync with Azure AD
  useEffect(() => {
    let isMounted = true;
    const storedToken = localStorage.getItem("lms_token");
    if (!storedToken) return;

    axios
      .get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
      .then((res) => {
        if (isMounted && res.data?.authenticated && res.data?.user) {
          const verifiedUser = res.data.user;
          const verifiedRole = verifiedUser.role;
          const completed = Boolean(
            res.data.is_profile_completed ?? verifiedUser.is_profile_completed
          );
          setUser(verifiedUser);
          setPrimaryRole(verifiedRole);
          setIsProfileCompleted(completed);
          localStorage.setItem("lms_user", JSON.stringify(verifiedUser));
          localStorage.setItem("lms_primary_role", verifiedRole);
          localStorage.setItem("lms_profile_completed", String(completed));
          if (verifiedUser.employee_id) {
            localStorage.setItem("lms_active_employee_id", verifiedUser.employee_id);
          }
        }
      })
      .catch((err) => {
        console.warn("[AuthContext] Session auto-sync notice:", err?.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);


  /**
   * Validates backend token and updates LMS user profile
   */
  const verifyTokenWithBackend = async (authToken) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = response.data;
      if (data.authenticated && data.user) {
        const verifiedUser = data.user;
        const verifiedRole = verifiedUser.role;
        const completed = Boolean(
          data.is_profile_completed ?? verifiedUser.is_profile_completed
        );

        setUser(verifiedUser);
        setPrimaryRole(verifiedRole);
        setCurrentMode("PRIMARY");
        setToken(authToken);
        setIsProfileCompleted(completed);
        setAuthError(null);

        localStorage.setItem("lms_user", JSON.stringify(verifiedUser));
        localStorage.setItem("lms_primary_role", verifiedRole);
        localStorage.setItem("lms_current_mode", "PRIMARY");
        localStorage.setItem("lms_token", authToken);
        localStorage.setItem("lms_profile_completed", String(completed));
        if (verifiedUser.employee_id) {
          localStorage.setItem("lms_active_employee_id", verifiedUser.employee_id);
        }
        clearCourseMetadataCache();

        return { user: verifiedUser, access: data.access, isProfileCompleted: completed };
      } else {
        throw new Error("Invalid authentication response from LMS server.");
      }
    } catch (err) {
      const status = err.response?.status;
      const debugAcc = err.response?.data?.debug_account;
      let errorMsg =
        err.response?.data?.error ||
        (status === 403
          ? "Your Microsoft account is authenticated, but you are not registered in the LMS. Please contact the L&D or HR team."
          : "Authentication verification failed. Please check server connection.");
      
      if (debugAcc) {
        const who = debugAcc.preferred_username || debugAcc.email || debugAcc.name || debugAcc.oid;
        if (who) {
          errorMsg += ` (Signed-in Microsoft account: ${who})`;
        }
      }
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  /**
   * Primary Microsoft SSO Login via Full-Page Redirect
   * Navigates directly to Microsoft Entra ID sign-in page, avoiding popup blockers and timeout errors.
   */
  const login = async () => {
    setIsLoading(true);
    setAuthError(null);
    setIdleMessage(null);

    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      if (err?.errorCode !== "user_cancelled") {
        console.error("Microsoft Login error:", err);
      }
      setIsLoading(false);
      throw err;
    }
  };

  /**
   * Developer login shortcut to test all 5 roles locally
   */
  const devLogin = async (identifier) => {
    setIsLoading(true);
    setAuthError(null);
    setIdleMessage(null);

    try {
      const isEmail = String(identifier).includes("@");
      const payload = isEmail ? { email: identifier } : { employee_id: identifier };
      const response = await axios.post(`${API_BASE_URL}/api/auth/dev-login`, payload);

      const data = response.data;
      if (data.authenticated && data.user) {
        const verifiedUser = data.user;
        const verifiedRole = verifiedUser.role;
        const devToken = data.token;
        const completed = Boolean(
          data.is_profile_completed ?? verifiedUser.is_profile_completed
        );

        setUser(verifiedUser);
        setPrimaryRole(verifiedRole);
        setCurrentMode("PRIMARY");
        setToken(devToken);
        setIsProfileCompleted(completed);

        localStorage.setItem("lms_user", JSON.stringify(verifiedUser));
        localStorage.setItem("lms_primary_role", verifiedRole);
        localStorage.setItem("lms_current_mode", "PRIMARY");
        localStorage.setItem("lms_token", devToken);
        localStorage.setItem("lms_profile_completed", String(completed));
        if (verifiedUser.employee_id) {
          localStorage.setItem("lms_active_employee_id", verifiedUser.employee_id);
        }
        clearCourseMetadataCache();

        return { user: verifiedUser, access: data.access, isProfileCompleted: completed };
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Developer login failed. Check backend connection.";
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Switch to Employee Self-Service Mode (UI only, never changes DB role)
   */
  const switchToEmployeeMode = () => {
    if (!isManagementRole) return;
    setCurrentMode("EMPLOYEE");
    localStorage.setItem("lms_current_mode", "EMPLOYEE");
  };

  /**
   * Switch back to Primary Role View
   */
  const switchToPrimaryMode = () => {
    setCurrentMode("PRIMARY");
    localStorage.setItem("lms_current_mode", "PRIMARY");
  };

  /**
   * Toggle between primary and employee mode
   */
  const toggleViewMode = () => {
    if (isViewingAsEmployee) {
      switchToPrimaryMode();
    } else {
      switchToEmployeeMode();
    }
  };

  /**
   * Proper MSAL & Application Logout
   */
  const logout = async (customMessage = null) => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    const activeEmp = user?.employee_id || localStorage.getItem("lms_active_employee_id");
    if (activeEmp) {
      try {
        await axios.post(`${API_BASE_URL}/api/auth/logout`, { employee_id: activeEmp }).catch(() => null);
      } catch (logErr) {
        // Non-blocking logout audit record
      }
    }

    setUser(null);
    setPrimaryRole(null);
    setCurrentMode("PRIMARY");
    setToken(null);
    if (customMessage) {
      setIdleMessage(customMessage);
    }

    localStorage.removeItem("lms_user");
    localStorage.removeItem("lms_primary_role");
    localStorage.removeItem("lms_current_mode");
    localStorage.removeItem("lms_token");
    localStorage.removeItem("lms_profile_completed");
    localStorage.removeItem("lms_active_employee_id");
    localStorage.removeItem("userPrimaryRole");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userViewMode");
    clearCourseMetadataCache();

    try {
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        await instance.logoutRedirect({
          account: accounts[0],
          postLogoutRedirectUri: window.location.origin + "/login",
        });
        return;
      }
    } catch (err) {
      console.warn("MSAL logout note:", err);
    }

    window.location.replace("/login");
  };

  /**
   * Authorization check helper
   */
  const hasRole = (allowedRoles) => {
    if (!primaryRole) return false;
    const targets = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(
      normalizeRoleName
    );

    // All 5 LMS system roles have Employee Self-Service capabilities
    if (targets.includes("Employee")) {
      return true;
    }

    const normPrimary = normalizeRoleName(primaryRole);
    return targets.includes(normPrimary);
  };

  // Legacy setRole helper to maintain compatibility
  const setRole = (newRole) => {
    if (!newRole) {
      logout();
    } else {
      setPrimaryRole(newRole);
      localStorage.setItem("lms_primary_role", newRole);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        primaryRole,
        currentMode,
        isAuthenticated: !!user && !!token,
        isLoading,
        authError,
        idleMessage,
        token,
        login,
        devLogin,
        logout,
        switchToEmployeeMode,
        switchToPrimaryMode,
        isProfileCompleted,
        setIsProfileCompleted,
        // Backward-compatible properties:
        role: activeRole,
        isManagementRole,
        isViewingAsEmployee,
        toggleViewMode,
        currentUser,
        loading: isLoading,
        hasRole,
        setRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
