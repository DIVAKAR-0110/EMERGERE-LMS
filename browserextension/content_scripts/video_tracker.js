/**
 * Course Video Playback & Learning Hours Tracker
 * Runs on course player pages (Udemy / Coursera).
 * Auto-plays video, detects play/pause/visibility, and logs active study duration.
 */

(function () {
    // Only run on course viewing / lecture pages
    const isPlayerPage = (
        window.location.href.includes("/lecture/") ||
        window.location.href.includes("/learn/") ||
        window.location.href.includes("/course/") ||
        window.location.href.includes("/player")
    );

    if (!isPlayerPage) return;

    console.log("[LMS Video Tracker] Initialized on course player page:", window.location.href);

    let activeSession = null;
    let trackedVideo = null;
    let isPlaying = false;
    let activeSeconds = 0;
    let timerInterval = null;

    // Retrieve active session from extension background
    chrome.runtime.sendMessage({ type: "GET_ACTIVE_SESSION" }, (response) => {
        activeSession = response?.activeSession;
        if (!activeSession) {
            console.log("[LMS Video Tracker] No active LMS session. Running in passive mode.");
        }
        setupVideoObserver();
        createLearningPill();
    });

    /**
     * Creates an unobtrusive floating timer pill in the bottom-left corner
     */
    function createLearningPill() {
        let pill = document.getElementById("lms-learning-tracker-pill");
        if (!pill) {
            pill = document.createElement("div");
            pill.id = "lms-learning-tracker-pill";
            pill.style.position = "fixed";
            pill.style.bottom = "16px";
            pill.style.left = "16px";
            pill.style.zIndex = "999999";
            pill.style.background = "#0F172A";
            pill.style.color = "#FFFFFF";
            pill.style.padding = "8px 14px";
            pill.style.borderRadius = "20px";
            pill.style.fontFamily = "system-ui, -apple-system, sans-serif";
            pill.style.fontSize = "12px";
            pill.style.fontWeight = "600";
            pill.style.display = "flex";
            pill.style.alignItems = "center";
            pill.style.gap = "8px";
            pill.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
            pill.style.border = "1px solid #334155";
            document.body.appendChild(pill);
        }
        updatePillDisplay();
    }

    function formatTime(totalSecs) {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
    }

    function updatePillDisplay() {
        const pill = document.getElementById("lms-learning-tracker-pill");
        if (!pill) return;

        const statusDot = isPlaying
            ? `<span style="width:8px;height:8px;border-radius:50%;background:#10B981;display:inline-block;box-shadow:0 0 6px #10B981;"></span>`
            : `<span style="width:8px;height:8px;border-radius:50%;background:#F59E0B;display:inline-block;"></span>`;

        pill.innerHTML = `
            ${statusDot}
            <span>LMS Logged: ${formatTime(activeSeconds)}</span>
            <span style="color:#94A3B8;font-size:11px;">(${isPlaying ? "Active" : "Paused"})</span>
        `;
    }

    /**
     * Watches the DOM for the HTML5 <video> element
     */
    function setupVideoObserver() {
        const findAndHookVideo = () => {
            const video = document.querySelector("video");
            if (video && video !== trackedVideo) {
                trackedVideo = video;
                hookVideoEvents(video);
            }
        };

        findAndHookVideo();

        const observer = new MutationObserver(() => {
            findAndHookVideo();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Attaches play, pause, ended, and visibility hooks to the video element
     */
    function hookVideoEvents(video) {
        console.log("[LMS Video Tracker] Hooked into video element:", video);

        // Auto-play video on initial load
        setTimeout(() => {
            if (video.paused) {
                video.play().catch((err) => {
                    console.log("[LMS Video Tracker] Autoplay prevented by browser policy. Waiting for user interaction:", err);
                });
            }
        }, 1200);

        video.addEventListener("play", () => {
            if (!document.hidden) {
                startActiveTimer();
            }
        });

        video.addEventListener("pause", () => {
            stopActiveTimer();
            if (activeSeconds > 0) {
                syncProgressToLms(false);
            }
        });

        video.addEventListener("ended", () => {
            stopActiveTimer();
            syncProgressToLms(true);
        });

        // Anti-idling: pause counter if tab is switched or minimized
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                console.log("[LMS Video Tracker] Tab hidden — pausing learning timer.");
                stopActiveTimer();
                if (activeSeconds > 0) {
                    syncProgressToLms(false);
                }
            } else if (trackedVideo && !trackedVideo.paused) {
                console.log("[LMS Video Tracker] Tab visible — resuming learning timer.");
                startActiveTimer();
            }
        });

        // Periodic 30-second sync heartbeat
        setInterval(() => {
            if (activeSeconds > 0) {
                syncProgressToLms(false);
            }
        }, 30000);

        // Final sync on tab close / reload
        window.addEventListener("beforeunload", () => {
            if (activeSeconds > 0 && activeSession) {
                const payload = JSON.stringify({
                    employee_id: activeSession.employeeId || "EMP019",
                    course_id: Number(activeSession.courseId || 1),
                    session_seconds: activeSeconds,
                    is_completed: false
                });

                // sendBeacon ensures request completes even after tab closes
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(
                        "http://localhost:5000/api/extension/sync-learning",
                        new Blob([payload], { type: "application/json" })
                    );
                }
            }
        });
    }

    function startActiveTimer() {
        if (timerInterval) return;
        isPlaying = true;
        updatePillDisplay();

        timerInterval = setInterval(() => {
            activeSeconds += 1;
            updatePillDisplay();
        }, 1000);
    }

    function stopActiveTimer() {
        isPlaying = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        updatePillDisplay();
    }

    function syncProgressToLms(isCompleted = false) {
        if (!activeSession) return;

        console.log(`[LMS Video Tracker] Syncing ${activeSeconds} active seconds to LMS (completed: ${isCompleted})...`);

        chrome.runtime.sendMessage({
            type: "SYNC_LEARNING_PROGRESS",
            payload: {
                employee_id: activeSession.employeeId || "EMP019",
                course_id: activeSession.courseId || 1,
                session_seconds: activeSeconds,
                is_completed: isCompleted
            }
        }, (res) => {
            if (res?.success) {
                console.log("[LMS Video Tracker] ✅ Synced successfully to LMS database.");
            }
        });
    }
})();
