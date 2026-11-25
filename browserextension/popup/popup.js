/**
 * Popup UI Logic
 */

document.addEventListener("DOMContentLoaded", () => {
    const activeView = document.getElementById("session-active-view");
    const idleView = document.getElementById("session-idle-view");
    const courseTitleEl = document.getElementById("course-title");
    const accountEmailEl = document.getElementById("account-email");
    const timerDisplayEl = document.getElementById("timer-display");
    const syncStatusEl = document.getElementById("sync-status");
    const btnSync = document.getElementById("btn-manual-sync");
    const backendHealthText = document.getElementById("backend-health-text");

    // Check backend health
    fetch("http://localhost:5000/api/extension/health")
        .then((res) => res.json())
        .then((data) => {
            backendHealthText.textContent = `Backend: ${data.status === "online" ? "Online ✅" : "Offline ❌"}`;
            backendHealthText.style.color = data.status === "online" ? "#10B981" : "#EF4444";
        })
        .catch(() => {
            backendHealthText.textContent = "Backend: Disconnected ❌";
            backendHealthText.style.color = "#EF4444";
        });

    // Check active session from storage
    chrome.storage.local.get(["activeSession"], (data) => {
        const session = data.activeSession;
        if (session) {
            activeView.style.display = "flex";
            idleView.style.display = "none";

            courseTitleEl.textContent = session.courseTitle || "Assigned Course";
            accountEmailEl.textContent = session.accountEmail || "rdivakar0110@outlook.com";

            const secs = session.activeSeconds || 0;
            const mins = Math.floor(secs / 60);
            const remainingSecs = secs % 60;
            timerDisplayEl.textContent = `${mins}m ${remainingSecs < 10 ? "0" : ""}${remainingSecs}s`;
        } else {
            activeView.style.display = "none";
            idleView.style.display = "flex";
        }
    });

    // Manual sync button
    btnSync.addEventListener("click", () => {
        chrome.storage.local.get(["activeSession"], (data) => {
            const session = data.activeSession;
            if (!session) return;

            btnSync.textContent = "Syncing...";
            btnSync.disabled = true;

            chrome.runtime.sendMessage({
                type: "SYNC_LEARNING_PROGRESS",
                payload: {
                    employee_id: session.employeeId,
                    course_id: session.courseId,
                    session_seconds: session.activeSeconds || 0,
                    is_completed: false
                }
            }, (res) => {
                btnSync.disabled = false;
                if (res?.success) {
                    btnSync.textContent = "Synced Successfully! ✅";
                    setTimeout(() => { btnSync.textContent = "Sync Progress Now"; }, 2000);
                } else {
                    btnSync.textContent = "Sync Failed ❌";
                    setTimeout(() => { btnSync.textContent = "Sync Progress Now"; }, 2000);
                }
            });
        });
    });
});
