import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./config/msalConfig.js";

import "./utils/disableEmojiInput.js";
import "./utils/axiosIdempotency.js";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

// Initialize MSAL instance and mount React application
msalInstance
  .initialize()
  .catch((err) => {
    console.warn("MSAL initialization note:", err);
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </MsalProvider>
      </React.StrictMode>
    );
  });
