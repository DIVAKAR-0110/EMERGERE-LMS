/**
 * LMS Bridge Content Script
 * Injected into the LMS Web App (http://localhost:3000/*).
 * Listens for DOM events from CourseCard.jsx and communicates with the extension service worker.
 */

(function () {
    console.log("[LMS Bridge] Injected into LMS Web App.");

    // Announce to LMS frontend that extension is installed and ready
    window.__LMS_EXTENSION_INSTALLED__ = true;
    document.documentElement.setAttribute("data-lms-extension-ready", "true");

    // Listen for course launch triggers dispatched by CourseCard.jsx
    document.addEventListener("lt:startCourse", (event) => {
        const detail = event.detail || {};
        console.log("[LMS Bridge] Received lt:startCourse event from LMS:", detail);

        // Check if extension was reloaded in chrome://extensions without refreshing this page
        if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn("[LMS Bridge] Extension runtime unavailable (extension was reloaded). Please refresh this LMS page (F5 or Ctrl+R) to reconnect!");
            return;
        }

        try {
            chrome.runtime.sendMessage({
                type: "INIT_COURSE_SESSION",
                payload: {
                    courseId: detail.courseId,
                    courseUrl: detail.courseUrl,
                    courseTitle: detail.courseTitle,
                    accountEmail: detail.accountEmail || detail.employeeEmail,
                    employeeId: detail.employeeId || "EMP019"
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("[LMS Bridge] Extension message error:", chrome.runtime.lastError.message);
                    return;
                }

                console.log("[LMS Bridge] Service worker initialized session:", response);

                // Acknowledge back to LMS page that session has been handled
                document.dispatchEvent(
                    new CustomEvent("lt:sessionLaunched", {
                        detail: {
                            success: response?.success || false,
                            tabId: response?.tabId,
                            courseUrl: detail.courseUrl
                        }
                    })
                );
            });
        } catch (err) {
            console.warn("[LMS Bridge] Exception sending message to service worker:", err);
        }
    });
})();
