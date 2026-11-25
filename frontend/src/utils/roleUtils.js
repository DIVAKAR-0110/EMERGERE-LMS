/**
 * Role name normalization utility.
 * Separated from AuthContext to keep Fast Refresh working cleanly.
 */

/**
 * Normalizes role strings to match system roles across views.
 * Handles variations like "ld", "L&D Team", "Learning & Development", etc.
 */
export const normalizeRoleName = (r) => {
  if (!r) return "";
  const s = String(r).trim().toLowerCase();
  if (s.includes("l&d") || s.includes("l_d") || s === "ld" || s.includes("learning")) return "L&D Team";
  if (s.includes("reporting") || s.includes("manager")) return "Reporting Manager";
  if (s === "employee") return "Employee";
  if (s === "hr" || s.includes("human resources")) return "HR Team";
  if (s === "ceo" || s.includes("executive")) return "CEO";
  return r;
};

/** Returns true if the given role is a management/non-employee primary role */
export const isManagementRoleName = (r) => {
  return normalizeRoleName(r) !== "Employee";
};

/** Maps primary roles to their portal route prefix */
export const ROLE_PORTALS = {
  "Employee": "employee",
  "Reporting Manager": "reporting-manager",
  "L&D Team": "ld",
  "HR Team": "hr",
  "CEO": "ceo",
};
