import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || "c0f0ca41-d3de-4e5e-805f-694fb712c61d",
    authority: `https://login.microsoftonline.com/${
      import.meta.env.VITE_MICROSOFT_TENANT_ID || "ed46c376-8c4e-4be3-be8f-c8d60026c6b2"
    }`,
    // redirectUri must match EXACTLY what is registered in Azure Portal → Authentication → SPA.
    // Currently registered: http://localhost:3000/login
    redirectUri: typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : "/login",
    postLogoutRedirectUri: typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : "/login",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",  // localStorage survives popup closure; sessionStorage can lose state
    storeAuthStateInCookie: true,   // needed for some browsers that block cross-origin cookies
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error("[MSAL Error]", message);
            return;
          case LogLevel.Warning:
            console.warn("[MSAL Warning]", message);
            return;
          default:
            return;
        }
      },
    },
  },
};

// Default scopes for user authentication
export const loginRequest = {
  scopes: ["openid", "profile", "email", "User.Read"],
  prompt: "select_account",
};

// Singleton PublicClientApplication instance
export const msalInstance = new PublicClientApplication(msalConfig);
