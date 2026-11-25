/**
 * Course Metadata Helpers, Shared Domain Constants, and Duplicate Validation.
 * Static mock provider/category lists have been removed; active options are fetched
 * live from dbo.CourseProviders and dbo.CourseCategories via useCourseMetadata().
 */

export const normalizeMetadataValue = (value) =>
    String(value || "").trim().replace(/\s+/g, " ");

export const normalizeMetadataKey = (value) =>
    normalizeMetadataValue(value).toLowerCase();

const extractItemName = (item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    return item.name || item.provider_name || item.category_name || item.ProviderName || item.CategoryName || item.label || item.value || "";
};

/**
 * Checks whether `inputValue` matches any item in `existingList` case-insensitively.
 * Returns the canonical existing name if found (or "Other"/"Others"), otherwise null.
 */
export const findDuplicateMetadataName = (inputValue, existingList = []) => {
    const key = normalizeMetadataKey(inputValue);
    if (!key) return null;
    if (key === "other" || key === "others") return "Other";

    for (const item of existingList || []) {
        const candidate = normalizeMetadataValue(extractItemName(item));
        if (candidate && candidate.toLowerCase() === key) {
            return candidate;
        }
    }
    return null;
};

/**
 * Strict validation for custom ("Other" / "Others") provider or category inputs.
 * Prevents repeating existing active DB options regardless of letter casing.
 */
export const validateCustomMetadataEntry = (inputValue, existingList = [], entityLabel = "provider") => {
    const cleaned = normalizeMetadataValue(inputValue);
    if (!cleaned) {
        return `Please enter ${entityLabel} name.`;
    }
    if (cleaned.length < 2) {
        return `Custom ${entityLabel} name must be at least 2 characters.`;
    }
    if (cleaned.length > 150) {
        return `Custom ${entityLabel} name cannot exceed 150 characters.`;
    }
    const key = cleaned.toLowerCase();
    if (key === "other" || key === "others") {
        return `Please specify a valid custom ${entityLabel} name.`;
    }
    if (/^\d+$/.test(cleaned) || !/[a-zA-Z]/.test(cleaned)) {
        return `Custom ${entityLabel} name must contain at least one letter.`;
    }
    const duplicate = findDuplicateMetadataName(cleaned, existingList);
    if (duplicate) {
        return `"${duplicate}" already exists in the ${entityLabel} list. Please select "${duplicate}" from the dropdown instead.`;
    }
    return "";
};

export const getProviderName = (name, providers = []) => {
    const cleaned = normalizeMetadataValue(name);
    if (!cleaned) return "";
    const match = findDuplicateMetadataName(cleaned, providers);
    return match && match !== "Other" ? match : cleaned;
};

export const getCategoryName = (name, categories = []) => {
    const cleaned = normalizeMetadataValue(name);
    if (!cleaned) return "";
    const match = findDuplicateMetadataName(cleaned, categories);
    return match && match !== "Other" ? match : cleaned;
};

export const MATERIAL_TYPES = ["PDF", "PPT", "PPTX", "EPUB", "MOBI"];
