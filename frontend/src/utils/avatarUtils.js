/**
 * Utility for consistent, deterministic avatar background color assignment.
 * Generates visually varied yet fixed colors for employees across modules.
 */

export const AVATAR_PALETTE = [
    "#F97FFF",
    "#5CDE8A",
    "#A87FFF",
    "#FF7FAE",
    "#FFBC64",
    "#7FCEFF",
    "#BED60E"
];

/**
 * Returns a fixed background color for a given employee identifier (e.g., name or ID).
 * The assignment is deterministic (stable across re-renders, tabs, and filters).
 * 
 * @param {string|number} identifier 
 * @returns {string} Hex color code from AVATAR_PALETTE
 */
export const getEmployeeAvatarBg = (identifier) => {
    if (!identifier) return AVATAR_PALETTE[0];
    const str = String(identifier).trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};
