/**
 * Outlook OTP Reader Content Script
 * Injected into https://outlook.live.com/* and https://outlook.office.com/*
 * Automatically detects incoming verification emails from Udemy / Coursera,
 * extracts the 6-digit code, and sends it to the extension service worker.
 */

(function () {
    console.log("[LMS Outlook Reader] Active on Outlook Web App:", window.location.href);

    function extractOtpCode(text) {
        if (!text) return null;
        // Targeted regex for verification codes
        const match = text.match(/(?:verification\s*code|security\s*code|code\s*is|code\s*:?)\s*(\b\d{6}\b)/i) ||
                      text.match(/\b(\d{6})\b/);
        return match ? match[1] : null;
    }

    let lastReportedOtp = null;

    function scanInboxForOtp() {
        // Inspect email list items and reading pane
        const items = document.querySelectorAll(
            '[role="listitem"], [aria-label*="Udemy" i], [aria-label*="verification" i], [aria-label*="code" i], [data-convid], .customScrollBar'
        );

        for (const item of items) {
            const text = item.innerText || item.getAttribute("aria-label") || "";
            if (/udemy|coursera|verification|security code/i.test(text)) {
                const otp = extractOtpCode(text);
                if (otp && otp !== lastReportedOtp) {
                    lastReportedOtp = otp;
                    console.log("[LMS Outlook Reader] ✅ Detected OTP in Outlook:", otp);

                    // Send to background service worker
                    chrome.runtime.sendMessage({
                        type: "REPORT_DETECTED_OTP",
                        payload: { otp, source: "outlook_web", timestamp: Date.now() }
                    });
                    break;
                }
            }
        }
    }

    // Scan every 2 seconds
    setInterval(scanInboxForOtp, 2000);
    scanInboxForOtp();
})();
