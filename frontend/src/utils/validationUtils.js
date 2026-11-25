/**
 * Profile & Form Validation Utilities
 */

/**
 * Validates a LinkedIn profile URL according to LMS profile rules:
 * - Mandatory field: empty or whitespace-only returns required error.
 * - Maximum URL length: 100 characters for the complete URL.
 * - Profile format: Must use linkedin.com/in/
 * - Supports valid URLs with or without www, and with or without http/https protocol.
 * - Allowed characters in profile slug: Letters, numbers, and hyphens (-)
 * - Spaces and special characters are not allowed.
 *
 * @param {string} url - The URL string to validate
 * @param {Object} options - Validation options { required: boolean }
 * @returns {string} Error message if invalid, or empty string if valid.
 */
export function validateLinkedInUrl(url, { required = true } = {}) {
    if (!url) return required ? "LinkedIn URL is required." : "";
    const trimmed = String(url).trim();
    if (!trimmed) return required ? "LinkedIn URL is required." : "";

    if (trimmed.length > 100) {
        return "Maximum URL length is 100 characters.";
    }

    if (/\s/.test(trimmed)) {
        return "Spaces are not allowed in LinkedIn URL.";
    }

    // Must follow linkedin.com/in/ format, with letters, numbers, and hyphens (-) only
    const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+(\/)?$/i;
    if (!linkedinRegex.test(trimmed)) {
        return "Invalid LinkedIn profile URL (e.g., https://www.linkedin.com/in/your-name). Letters, numbers, and hyphens (-) only.";
    }

    return "";
}

/**
 * Normalizes prose whitespace so tab characters and repeated consecutive spaces
 * are collapsed to a single horizontal space, leading spaces are stripped,
 * and repeated blank lines are collapsed.
 */
export function normalizeSingleSpacing(value, { allowNewlines = true, trimEdges = false } = {}) {
    let text = String(value ?? "")
        .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
        .replace(/\r\n?/g, "\n")
        .replace(/\t/g, " ");

    if (!allowNewlines) {
        text = text.replace(/\n+/g, " ");
    }

    text = text
        .replace(/ {2,}/g, " ")
        .replace(/ +\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .replace(/(^|\n) +/g, "$1")
        .replace(/^\n+/, "");

    return trimEdges ? text.trim() : text;
}

const restoreCaret = (el, caretPos) => {
    if (typeof window !== "undefined" && el && typeof el.setSelectionRange === "function") {
        window.requestAnimationFrame(() => {
            if (document.activeElement === el) {
                el.setSelectionRange(caretPos, caretPos);
            }
        });
    }
};

/**
 * Prevents typing leading spaces or consecutive horizontal spaces (> 1 space) in prose fields.
 * Standard Tab key navigation remains untouched.
 */
export function handleSingleSpaceKeyDown(e) {
    if (e.key !== " " || e.ctrlKey || e.metaKey || e.altKey) return;

    const el = e.target;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const val = el.value || "";

    if (start === 0) {
        e.preventDefault();
        return;
    }

    if (val[start - 1] === " " || val[start - 1] === "\n" || val[end] === " ") {
        e.preventDefault();
    }
}

/**
 * Normalizes change events for bounded single-space prose textareas while preserving caret position.
 */
export function applySingleSpaceTextChange(e, maxLength) {
    const el = e.target;
    const raw = el.value ?? "";
    const rawSelStart = el.selectionStart ?? raw.length;
    const nextVal = normalizeSingleSpacing(raw).slice(0, maxLength);
    const normalizedPrefix = normalizeSingleSpacing(raw.slice(0, rawSelStart));
    const nextCaret = Math.min(normalizedPrefix.length, nextVal.length);

    if (nextVal !== raw || nextCaret !== rawSelStart) {
        restoreCaret(el, nextCaret);
    }
    return nextVal;
}

/**
 * Handles clipboard paste in bounded single-space prose textareas, collapsing pasted tabs and multi-spaces.
 */
export function handleSingleSpacePaste(e, maxLength, onApplyValue) {
    e.preventDefault();
    const pasteText = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    if (!pasteText) return;

    const el = e.target;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const nextVal = normalizeSingleSpacing(before + pasteText + after).slice(0, maxLength);
    const nextCaret = Math.min(normalizeSingleSpacing(before + pasteText).length, nextVal.length);

    onApplyValue(nextVal);
    restoreCaret(el, nextCaret);
}

/**
 * Strips leading whitespace and collapses multiple consecutive spaces into a single horizontal space.
 * Used for single-line text inputs and search bars.
 */
export function sanitizeSingleSpaceInput(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/^\s+/, "").replace(/\s{2,}/g, " ");
}

/**
 * Converts the first letter of a string or word to uppercase, preserving subsequent characters.
 * Useful for fields like Course Name, Certification Title, etc.
 *
 * @param {string} value
 * @returns {string}
 */
export function capitalizeFirstLetter(value) {
    if (!value) return "";
    const str = String(value);
    return str.replace(/^(\s*)([a-z])/i, (_, space, char) => space + char.toUpperCase());
}

/**
 * Automatically formats text into proper sentence case:
 * 1. Capitalizes the very first letter of the text.
 * 2. Capitalizes the first letter following a full stop (period) and optional spaces, quotes, or newlines.
 *
 * @param {string} value
 * @returns {string}
 */
export function formatSentenceCase(value) {
    if (!value) return "";
    let str = String(value);
    // 1. Capitalize first letter of the whole text
    str = str.replace(/^(\s*)([a-z])/i, (_, space, char) => space + char.toUpperCase());
    // 2. Capitalize first letter following a full stop (period), handling spaces, newlines, quotes
    str = str.replace(/(\.[\s"'\u201C\u201D\u2018\u2019)]*)([a-z])/g, (_, punct, char) => punct + char.toUpperCase());
    return str;
}
