import devopsIcon from "../assets/course_library/devops.svg";
import datascienceIcon from "../assets/course_library/datascience.svg";
import securityIcon from "../assets/course_library/security.svg";
import aimlIcon from "../assets/course_library/aiml.svg";
import cloudIcon from "../assets/course_library/cloud.svg";
import developmentIcon from "../assets/course_library/development.svg";
import managementIcon from "../assets/course_library/management.svg";
import premiumIcon from "../assets/course_library/premium.svg";
import webLogoIcon from "../assets/course_library/web_logo.svg";

// Legacy category-based icon map (retained for RM module and backward compatibility)
export const COURSE_ICONS = {
    devops: devopsIcon,
    datascience: datascienceIcon,
    security: securityIcon,
    aiml: aimlIcon,
    cloud: cloudIcon,
    development: developmentIcon,
    management: managementIcon,
    premium: premiumIcon,
    webLogo: webLogoIcon,
};

// Common status-based icons for course cards as specified:
// - completed: cloud.svg
// - assigned: datascience.svg
// - onhold: development.svg
// - not started: security.svg
// - in progress: security.svg
// - enrollnow / available: management.svg
// - pending: aiml.svg
export const STATUS_ICONS = {
    // 1. Pending (Awaiting manager / L&D approval) -> aiml.svg
    pending: aimlIcon,
    requested: aimlIcon,

    // 2. Enroll Now / Available -> management.svg
    available: managementIcon,
    enrollnow: managementIcon,
    "enroll-now": managementIcon,
    "enroll now": managementIcon,

    // 3. Not Started -> security.svg
    "not-started": securityIcon,
    "not started": securityIcon,
    not_started: securityIcon,

    // 4. In Progress -> security.svg
    "in-progress": securityIcon,
    "in progress": securityIcon,
    progress: securityIcon,

    // 5. Assigned -> datascience.svg
    assigned: datascienceIcon,

    // 6. Completed -> cloud.svg
    completed: cloudIcon,
    complete: cloudIcon,

    // 7. On Hold -> development.svg
    "on-hold": developmentIcon,
    "on hold": developmentIcon,
    onhold: developmentIcon,
};

/**
 * Resolves the common status icon for any course status string
 */
export const getStatusIcon = (status) => {
    if (!status) return STATUS_ICONS.available;
    const clean = String(status).toLowerCase().trim().replace(/[\s_]+/g, "-");
    return STATUS_ICONS[clean] || STATUS_ICONS[String(status).toLowerCase().trim()] || STATUS_ICONS.available;
};

export default COURSE_ICONS;
