/**
 * Provider Login Automation Content Script
 * Automates email submission and OTP verification on Udemy / Coursera login pages.
 */

(function () {
    const isLoginPage = (
        window.location.href.includes("/login") ||
        window.location.href.includes("/join") ||
        window.location.href.includes("/auth") ||
        window.location.href.includes("passwordless-auth")
    );

    if (!isLoginPage) return;

    console.log("[LMS Provider Login] Initialized on auth page:", window.location.href);

    let targetEmail = "rdivakar0110@outlook.com";

    try {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: "GET_ACTIVE_SESSION" }, (response) => {
                if (response?.activeSession?.accountEmail) {
                    targetEmail = response.activeSession.accountEmail;
                }
                console.log("[LMS Provider Login] Target email set to:", targetEmail);
                startAutomationLoop();
            });
        } else {
            startAutomationLoop();
        }
    } catch {
        startAutomationLoop();
    }

    /**
     * Creates / updates the floating status pill
     */
    function showStatusBadge(htmlContent, state = "info", interactive = false) {
        let badge = document.getElementById("lms-login-badge");
        if (!badge) {
            badge = document.createElement("div");
            badge.id = "lms-login-badge";
            badge.style.position = "fixed";
            badge.style.top = "18px";
            badge.style.left = "50%";
            badge.style.transform = "translateX(-50%)";
            badge.style.zIndex = "2147483647";
            badge.style.padding = "10px 24px";
            badge.style.borderRadius = "24px";
            badge.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
            badge.style.fontSize = "13px";
            badge.style.fontWeight = "600";
            badge.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
            badge.style.transition = "all 0.3s ease";
            badge.style.display = "flex";
            badge.style.alignItems = "center";
            badge.style.gap = "8px";
            document.documentElement.appendChild(badge);
        }

        badge.style.pointerEvents = interactive ? "auto" : "none";

        if (state === "info") {
            badge.style.background = "#2563EB";
            badge.style.color = "#FFFFFF";
        } else if (state === "success") {
            badge.style.background = "#059669";
            badge.style.color = "#FFFFFF";
        } else if (state === "warn") {
            badge.style.background = "#D97706";
            badge.style.color = "#FFFFFF";
        } else if (state === "error") {
            badge.style.background = "#DC2626";
            badge.style.color = "#FFFFFF";
        }

        badge.innerHTML = `🎓 <b>Emergere LMS:</b> <span>${htmlContent}</span>`;
    }

    function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none" && window.getComputedStyle(el).visibility !== "hidden";
    }

    function setReactInputValue(input, val) {
        if (!input) return;
        input.focus();
        input.dispatchEvent(new Event("focus", { bubbles: true }));

        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
        )?.set;

        if (nativeSetter) {
            nativeSetter.call(input, val);
        } else {
            input.value = val;
        }

        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: val }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
    }

    function triggerButtonClick(btn) {
        if (!btn) return;
        console.log("[LMS Provider Login] Triggering click on button:", btn);
        btn.removeAttribute("disabled");
        btn.focus();
        btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        btn.click();
    }

    /**
     * Finds the email/identifier input field on the page
     */
    function findEmailInput() {
        const authContainers = document.querySelectorAll(
            'form, main, [class*="login" i], [class*="auth" i], [data-purpose*="login" i]'
        );

        for (const container of authContainers) {
            const inputs = Array.from(container.querySelectorAll('input')).filter(inp => {
                if (['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(inp.type)) return false;
                if (inp.name === 'q' || inp.type === 'search' || (inp.placeholder && inp.placeholder.toLowerCase().includes('search'))) return false;
                return isVisible(inp);
            });
            if (inputs.length > 0) return inputs[0];
        }

        const labels = Array.from(document.querySelectorAll('label'));
        for (const lbl of labels) {
            if (/email|phone|identifier/i.test(lbl.textContent || '')) {
                const forId = lbl.getAttribute('for') || lbl.htmlFor;
                if (forId) {
                    const el = document.getElementById(forId);
                    if (el && isVisible(el)) return el;
                }
            }
        }

        return null;
    }

    function findSubmitButton() {
        const allButtons = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"));
        for (const btn of allButtons) {
            if (!isVisible(btn)) continue;
            const txt = (btn.textContent || btn.value || "").trim().toLowerCase();
            if (txt === "continue" || txt === "next" || txt === "log in" || txt === "submit" || txt.includes("continue") || txt.includes("log in")) {
                return btn;
            }
        }
        return document.querySelector('button[type="submit"]');
    }

    /**
     * Accurately detects OTP screen and finds the 6-digit code input
     */
    function findOtpInputs() {
        const bodyText = document.body ? document.body.innerText : "";
        const isOtpScreen = /check your inbox|6-digit code|enter the 6-digit|resend code/i.test(bodyText);

        if (isOtpScreen) {
            // Find visible input on the card (excluding search)
            const candidateInputs = Array.from(document.querySelectorAll('input')).filter(inp => {
                if (['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(inp.type)) return false;
                if (inp.name === 'q' || inp.type === 'search') return false;
                return isVisible(inp);
            });

            if (candidateInputs.length > 0) {
                console.log("[LMS Provider Login] Found OTP input on screen:", candidateInputs);
                return candidateInputs;
            }
        }

        // Multi-box split inputs (e.g. 6 boxes)
        const multiBoxes = Array.from(document.querySelectorAll(
            'input[maxlength="1"], input[type="tel"], input[data-testid*="otp" i], input[aria-label*="digit" i]'
        )).filter(isVisible);

        if (multiBoxes.length >= 4) {
            return multiBoxes;
        }

        return [];
    }

    let emailSubmitted = false;
    let otpPolled = false;

    function startAutomationLoop() {
        showStatusBadge(`Automating login for ${targetEmail}...`, "info");

        const interval = setInterval(() => {
            // STEP 2: Check for OTP Screen
            const otpInputs = findOtpInputs();
            if (otpInputs.length > 0) {
                if (!otpPolled) {
                    otpPolled = true;
                    clearInterval(interval);
                    handleOtpWorkflow(otpInputs);
                }
                return;
            }

            // STEP 1: Check for Email Input Screen
            if (!emailSubmitted) {
                const emailInput = findEmailInput();
                if (emailInput && !emailInput.dataset.lmsProcessed) {
                    emailInput.dataset.lmsProcessed = "true";
                    emailSubmitted = true;

                    showStatusBadge(`Filling email: ${targetEmail}`, "info");
                    setReactInputValue(emailInput, targetEmail);

                    setTimeout(() => {
                        const submitBtn = findSubmitButton();
                        if (submitBtn) {
                            showStatusBadge("Submitting email to generate OTP...", "info");
                            triggerButtonClick(submitBtn);
                        } else {
                            emailInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", keyCode: 13 }));
                        }
                    }, 500);
                }
            }
        }, 400);

        // Keep polling for up to 90 seconds
        setTimeout(() => {
            clearInterval(interval);
        }, 90000);
    }

    /**
     * Handles OTP polling and provides interactive prompt option
     */
    function handleOtpWorkflow(inputs) {
        renderWaitingForOtpBadge(inputs);

        const requestSince = new Date(Date.now() - 120000).toISOString();

        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: "FETCH_OTP",
                payload: { email: targetEmail, since: requestSince }
            }, (response) => {
                if (response && response.success && response.otp) {
                    const otp = String(response.otp).trim();
                    showStatusBadge(`OTP received: <b>${otp}</b>! Filling code...`, "success");
                    fillOtpCode(inputs, otp);
                } else {
                    renderManualPromptBadge(inputs, response?.error);
                }
            });
        }
    }

    function renderWaitingForOtpBadge(inputs) {
        showStatusBadge(`
            Polling inbox for OTP... 
            <button id="lms-btn-manual-otp" style="margin-left: 8px; background: #FFFFFF; color: #1E40AF; border: none; padding: 3px 10px; border-radius: 12px; font-weight: 700; cursor: pointer;">
                Enter OTP
            </button>
        `, "warn", true);

        const btn = document.getElementById("lms-btn-manual-otp");
        if (btn) {
            btn.onclick = () => {
                const code = prompt("Enter the 6-digit OTP code sent to " + targetEmail + ":");
                if (code && code.trim()) {
                    fillOtpCode(inputs, code.trim());
                }
            };
        }
    }

    function renderManualPromptBadge(inputs, reason) {
        showStatusBadge(`
            OTP waiting: 
            <button id="lms-btn-manual-otp" style="margin-left: 8px; background: #FFFFFF; color: #DC2626; border: none; padding: 3px 10px; border-radius: 12px; font-weight: 700; cursor: pointer;">
                Click to Enter OTP
            </button>
        `, "warn", true);

        const btn = document.getElementById("lms-btn-manual-otp");
        if (btn) {
            btn.onclick = () => {
                const code = prompt("Enter the 6-digit code sent to " + targetEmail + ":");
                if (code && code.trim()) {
                    fillOtpCode(inputs, code.trim());
                }
            };
        }
    }

    function fillOtpCode(inputs, otp) {
        const digits = otp.replace(/[^\d]/g, "").split("");

        if (inputs.length === 1) {
            setReactInputValue(inputs[0], otp);
        } else {
            inputs.forEach((inp, idx) => {
                if (digits[idx] != null) {
                    setReactInputValue(inp, digits[idx]);
                }
            });
        }

        setTimeout(() => {
            const verifyBtn = findSubmitButton();
            if (verifyBtn) {
                showStatusBadge("Code entered! Logging into course...", "success");
                triggerButtonClick(verifyBtn);
            }
        }, 500);
    }
})();
