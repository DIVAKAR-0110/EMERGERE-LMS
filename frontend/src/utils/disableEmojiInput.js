/**
 * Global Emoji Blocker for LMS Application
 * 
 * Prevents typing, pasting, or dropping Unicode emojis into any <input>, <textarea>,
 * or contenteditable elements across the entire application.
 * 
 * Handled events:
 * 1. beforeinput (capture): Blocks typing emojis from keyboard / emoji pickers (Win + ., macOS, mobile)
 * 2. paste (capture): Strips emojis from clipboard text and inserts only clean text
 * 3. drop (capture): Strips emojis from dragged text
 * 4. input (capture): Safety net fallback that removes any emojis that bypass beforeinput
 */

// Regex covering all Unicode emojis, skin-tone modifiers, flags, zero-width joiners, and variation selectors
export const EMOJI_TEST_REGEX = /(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|[\uFE0E\uFE0F\u200D\u20E3])/u;
export const EMOJI_CLEAN_REGEX = /(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]|[\uFE0E\uFE0F\u200D\u20E3])/gu;

/**
 * Checks whether the target is an editable text field
 */
function isTextInputElement(target) {
  if (!target || typeof target !== "object") return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName;
  if (tagName === "TEXTAREA") return true;

  if (tagName === "INPUT") {
    const nonTextTypes = [
      "checkbox",
      "radio",
      "file",
      "button",
      "submit",
      "reset",
      "color",
      "range",
      "image",
    ];
    return !nonTextTypes.includes((target.type || "text").toLowerCase());
  }

  return false;
}

/**
 * Inserts sanitized text into an input/textarea and updates React's internal value tracker
 */
function insertCleanedText(target, textToInsert) {
  if (target.isContentEditable) {
    document.execCommand("insertText", false, textToInsert);
    return;
  }

  // Try document.execCommand first (preserves native undo stack)
  const isFocused = document.activeElement === target;
  if (!isFocused && target.focus) {
    target.focus();
  }

  const success = document.execCommand("insertText", false, textToInsert);
  if (success) return;

  // Fallback: update value manually and notify React
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const currentVal = target.value || "";
  const nextVal = currentVal.slice(0, start) + textToInsert + currentVal.slice(end);

  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (nativeSetter) {
    nativeSetter.call(target, nextVal);
  } else {
    target.value = nextVal;
  }

  const newPos = start + textToInsert.length;
  if (target.setSelectionRange) {
    target.setSelectionRange(newPos, newPos);
  }

  target.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * 1. Typing: Intercept beforeinput to block emoji insertion
 */
function handleBeforeInput(e) {
  if (!isTextInputElement(e.target)) return;

  // e.data contains the incoming string (e.g. from emoji picker or keyboard)
  if (e.data && EMOJI_TEST_REGEX.test(e.data)) {
    e.preventDefault();
  }
}

/**
 * 2. Pasting: Strip emojis and insert sanitized text
 */
function handlePaste(e) {
  const target = e.target;
  if (!isTextInputElement(target)) return;
  if (!e.clipboardData) return;

  const pastedText = e.clipboardData.getData("text");
  if (!pastedText || !EMOJI_TEST_REGEX.test(pastedText)) {
    return; // No emojis in pasted content; allow default paste
  }

  e.preventDefault();
  const cleanedText = pastedText.replace(EMOJI_CLEAN_REGEX, "");

  if (cleanedText) {
    insertCleanedText(target, cleanedText);
  }
}

/**
 * 3. Drag & Drop: Strip emojis from dropped text
 */
function handleDrop(e) {
  const target = e.target;
  if (!isTextInputElement(target)) return;

  const droppedText = e.dataTransfer?.getData("text");
  if (!droppedText || !EMOJI_TEST_REGEX.test(droppedText)) {
    return;
  }

  e.preventDefault();
  const cleanedText = droppedText.replace(EMOJI_CLEAN_REGEX, "");
  if (cleanedText) {
    insertCleanedText(target, cleanedText);
  }
}

/**
 * 4. Input fallback: Real-time sanitization if any emoji bypassed beforeinput
 */
function handleInput(e) {
  const target = e.target;
  if (!isTextInputElement(target)) return;

  const currentVal = target.value;
  if (typeof currentVal === "string" && EMOJI_TEST_REGEX.test(currentVal)) {
    const start = target.selectionStart;
    const cleaned = currentVal.replace(EMOJI_CLEAN_REGEX, "");
    const removedCount = currentVal.length - cleaned.length;
    const newCursor = Math.max(0, (start || 0) - removedCount);

    const prototype = target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (nativeSetter) {
      nativeSetter.call(target, cleaned);
    } else {
      target.value = cleaned;
    }

    if (target.setSelectionRange) {
      target.setSelectionRange(newCursor, newCursor);
    }

    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

let initialized = false;

/**
 * Initializes the global emoji blocker listeners on the document
 */
export function initEmojiBlocker() {
  if (initialized || typeof document === "undefined") return;

  // Attach in capture phase (true) so it intercepts before any component-level handlers
  document.addEventListener("beforeinput", handleBeforeInput, true);
  document.addEventListener("paste", handlePaste, true);
  document.addEventListener("drop", handleDrop, true);
  document.addEventListener("input", handleInput, true);

  initialized = true;
}

// Auto-initialize upon import
if (typeof document !== "undefined") {
  initEmojiBlocker();
}

