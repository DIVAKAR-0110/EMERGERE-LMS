import { useState, useRef, useCallback } from "react";
import { generateIdempotencyKey } from "../utils/axiosIdempotency";

/**
 * Extracts a readable backend/network error message from an Axios error,
 * safely ignoring aborted duplicate-in-flight errors.
 */
export function extractApiErrorMessage(err, fallback = "Request failed. Please try again.") {
  if (err?.isDuplicateInFlight) return "";
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => d?.msg || JSON.stringify(d)).join(", ");
  }
  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }
  if (err?.code === "ECONNABORTED") {
    return "The server took too long to respond. Please check if your action completed before retrying.";
  }
  return fallback;
}

/**
 * Reusable synchronous + React-state submission lock with per-attempt X-Idempotency-Key.
 * Prevents double-clicks, Enter-key bursts, and slow-server duplicate POSTs.
 */
export default function useSubmitLock() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const idemKeyRef = useRef(generateIdempotencyKey());

  const resetIdempotencyKey = useCallback(() => {
    idemKeyRef.current = generateIdempotencyKey();
  }, []);

  const runWithLock = useCallback(async (asyncTask) => {
    if (submittingRef.current) {
      return { skipped: true };
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await asyncTask(idemKeyRef.current);
      // Rotate key after completion so a new submission gets a fresh key
      idemKeyRef.current = generateIdempotencyKey();
      return { skipped: false, result };
    } catch (err) {
      // Keep the same idempotency key on network timeouts or 5xx so safe retries replay/deduplicate,
      // but rotate on deterministic 4xx errors so the user can edit fields and resubmit cleanly.
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) {
        idemKeyRef.current = generateIdempotencyKey();
      }
      throw err;
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return {
    isSubmitting,
    submittingRef,
    runWithLock,
    resetIdempotencyKey,
    getIdempotencyKey: () => idemKeyRef.current,
  };
}
