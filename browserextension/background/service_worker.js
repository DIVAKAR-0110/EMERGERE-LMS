/**
 * LMS Learning Tracker - Background Service Worker (Manifest V3)
 * Orchestrates:
 * 1. Active session lifecycle (LMS click -> Provider Tab -> Tracking -> Tab close)
 * 2. Polling LMS backend for Microsoft Graph OTP codes
 * 3. Listening for OTP codes from Outlook Web App reader
 * 4. Forwarding learning progress heartbeats to backend
 */

const API_BASE_URL = "http://localhost:5000";

let latestDetectedOtp = null;
let latestDetectedOtpTime = 0;

// Initialize state
chrome.runtime.onInstalled.addListener(() => {
    console.log("[LMS Extension] Service Worker installed successfully.");
    chrome.storage.local.set({
        activeSession: null,
        lastSyncedAt: null,
        totalActiveSeconds: 0
    });
});

// Message listener for content scripts & popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    if (type === "REPORT_DETECTED_OTP") {
        latestDetectedOtp = payload?.otp;
        latestDetectedOtpTime = Date.now();
        console.log("[LMS Extension] Service worker received OTP from Outlook Web:", latestDetectedOtp);
        sendResponse({ success: true });
        return true;
    }

    if (type === "INIT_COURSE_SESSION") {
        handleInitSession(payload, sendResponse);
        return true;
    }

    if (type === "GET_ACTIVE_SESSION") {
        chrome.storage.local.get(["activeSession"], (data) => {
            sendResponse({ activeSession: data.activeSession || null });
        });
        return true;
    }

    if (type === "FETCH_OTP") {
        handleFetchOtp(payload, sendResponse);
        return true;
    }

    if (type === "SYNC_LEARNING_PROGRESS") {
        handleSyncLearning(payload, sendResponse);
        return true;
    }

    if (type === "CLEAR_SESSION") {
        chrome.storage.local.set({ activeSession: null }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

function handleInitSession(payload, sendResponse) {
    const { courseId, courseUrl, courseTitle, accountEmail, employeeId } = payload;
    const sessionStartTime = new Date().toISOString();

    const targetEmail = accountEmail || "rdivakar0110@outlook.com";
    const targetUrl = courseUrl || "https://www.udemy.com";

    chrome.tabs.create({ url: targetUrl }, (tab) => {
        const sessionData = {
            courseId: courseId || 1,
            courseTitle: courseTitle || "Assigned Video Course",
            courseUrl: targetUrl,
            accountEmail: targetEmail,
            employeeId: employeeId || "EMP019",
            tabId: tab.id,
            startTime: sessionStartTime,
            activeSeconds: 0,
            status: "logging_in"
        };

        chrome.storage.local.set({ activeSession: sessionData }, () => {
            console.log("[LMS Extension] Session created for tab", tab.id, sessionData);
            sendResponse({
                success: true,
                tabId: tab.id,
                session: sessionData
            });
        });
    });
}

/**
 * Polls backend /api/extension/latest-otp or checks Outlook Web captured OTP
 */
async function handleFetchOtp(payload, sendResponse) {
    const email = payload?.email || "rdivakar0110@outlook.com";
    const since = payload?.since || new Date(Date.now() - 3 * 60000).toISOString();
    const maxRetries = 20; // 20 attempts * 2.5 sec = 50 sec max wait
    const delayMs = 2500;

    console.log(`[LMS Extension] Polling OTP for ${email} since ${since}...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // 1. Check if Outlook Web reader already captured the OTP
        if (latestDetectedOtp && (Date.now() - latestDetectedOtpTime) < 180000) {
            console.log(`[LMS Extension] ✅ Found OTP via Outlook Web Reader:`, latestDetectedOtp);
            sendResponse({ success: true, otp: latestDetectedOtp, source: "outlook_web" });
            return;
        }

        // 2. Poll LMS Backend
        try {
            const queryUrl = `${API_BASE_URL}/api/extension/latest-otp?email=${encodeURIComponent(email)}&since=${encodeURIComponent(since)}`;
            const res = await fetch(queryUrl);

            if (res.ok) {
                const data = await res.json();
                if (data.found && data.otp) {
                    console.log(`[LMS Extension] ✅ OTP found on attempt ${attempt}:`, data.otp);
                    sendResponse({ success: true, otp: data.otp, source: "backend_api", attempt });
                    return;
                }
            }
        } catch (err) {
            console.warn(`[LMS Extension] OTP poll attempt ${attempt} failed:`, err);
        }

        await new Promise((r) => setTimeout(r, delayMs));
    }

    console.warn(`[LMS Extension] ❌ OTP timed out after ${maxRetries} attempts.`);
    sendResponse({ success: false, error: "OTP email not received yet. Click 'Enter OTP' on the badge or enter manually." });
}

async function handleSyncLearning(payload, sendResponse) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/extension/sync-learning`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: payload.employee_id || "EMP019",
                course_id: Number(payload.course_id || 1),
                session_seconds: Number(payload.session_seconds || 0),
                is_completed: Boolean(payload.is_completed),
                progress_percentage: payload.progress_percentage != null ? Number(payload.progress_percentage) : undefined
            })
        });

        if (res.ok) {
            const data = await res.json();
            chrome.storage.local.set({ lastSyncedAt: new Date().toISOString() });
            sendResponse({ success: true, data });
        } else {
            const errData = await res.json().catch(() => ({}));
            sendResponse({ success: false, error: errData.detail || "Sync failed" });
        }
    } catch (err) {
        console.error("[LMS Extension] Sync error:", err);
        sendResponse({ success: false, error: err.message });
    }
}

chrome.tabs.onRemoved.addListener((closedTabId) => {
    chrome.storage.local.get(["activeSession"], (data) => {
        const session = data.activeSession;
        if (session && session.tabId === closedTabId) {
            if (session.activeSeconds > 0) {
                handleSyncLearning({
                    employee_id: session.employeeId,
                    course_id: session.courseId,
                    session_seconds: session.activeSeconds,
                    is_completed: false
                }, () => {});
            }
            chrome.storage.local.set({ activeSession: null });
        }
    });
});
