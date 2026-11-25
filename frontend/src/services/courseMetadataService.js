import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const METADATA_CACHE_TTL_MS = 30 * 1000;
let cachedMetadata = null;
let cachedTokenKey = null;
let cachedAt = 0;
let inflightPromise = null;

const deduplicateMetadataObjects = (items = [], nameKeys = []) => {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        let rawName = "";
        if (typeof item === "string") {
            rawName = item;
        } else if (item && typeof item === "object") {
            for (const k of nameKeys) {
                if (item[k]) {
                    rawName = String(item[k]);
                    break;
                }
            }
            if (!rawName) {
                rawName = String(item.name || item.label || item.value || "");
            }
        }
        const trimmed = rawName.trim().replace(/\s+/g, " ");
        if (!trimmed) continue;
        const normKey = trimmed.toLowerCase();
        if (normKey === "other" || normKey === "others" || seen.has(normKey)) continue;
        seen.add(normKey);
        if (typeof item === "object" && item !== null) {
            result.push({
                ...item,
                name: trimmed,
                value: trimmed,
                label: trimmed,
            });
        } else {
            result.push({ name: trimmed, value: trimmed, label: trimmed });
        }
    }
    return result;
};

export const clearCourseMetadataCache = () => {
    cachedMetadata = null;
    cachedTokenKey = null;
    cachedAt = 0;
    inflightPromise = null;
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lms-course-metadata-updated"));
    }
};

const getAuthHeaders = (explicitToken) => {
    const activeEmpId = localStorage.getItem("lms_active_employee_id") || "";
    const token = explicitToken || localStorage.getItem("lms_token") || (activeEmpId ? `dev-token-${activeEmpId}` : "");
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (activeEmpId) headers["x-employee-id"] = activeEmpId;
    return { token, headers };
};

/**
 * Fetches active, deduplicated CourseProviders and CourseCategories from backend DB.
 */
export const fetchCourseMetadata = async (explicitToken, forceRefresh = false) => {
    const { token, headers } = getAuthHeaders(explicitToken);
    const tokenKey = token.slice(-16);
    const isFresh = cachedMetadata && cachedTokenKey === tokenKey && (Date.now() - cachedAt) < METADATA_CACHE_TTL_MS;

    if (!forceRefresh && isFresh) {
        return cachedMetadata;
    }

    if (!forceRefresh && inflightPromise && cachedTokenKey === tokenKey) {
        return inflightPromise;
    }

    cachedTokenKey = tokenKey;
    inflightPromise = axios
        .get(`${API_BASE_URL}/api/course-metadata`, { headers })
        .then((res) => {
            const payload = res.data || {};
            const providers = deduplicateMetadataObjects(payload.providers || payload.provider_names || [], [
                "name",
                "provider_name",
                "ProviderName",
            ]).map((p) => ({
                ...p,
                provider_name: p.provider_name || p.name,
            }));

            const categories = deduplicateMetadataObjects(payload.categories || payload.category_names || [], [
                "name",
                "category_name",
                "CategoryName",
            ]).map((c) => ({
                ...c,
                category_name: c.category_name || c.name,
            }));

            const domains = deduplicateMetadataObjects(payload.domains || payload.domain_names || [], [
                "name",
                "domain_name",
                "DomainName",
            ]).map((d) => ({
                ...d,
                domain_name: d.domain_name || d.name,
                name: d.domain_name || d.name,
                domain_id: d.domain_id || d.id,
            }));

            const emails = deduplicateMetadataObjects(payload.emails || payload.email_names || [], [
                "name",
                "email",
                "course_email",
                "CourseEmail",
            ]).map((e) => ({
                ...e,
                email: e.email || e.course_email || e.CourseEmail || e.name,
                course_email: e.email || e.course_email || e.CourseEmail || e.name,
            }));

            const normalized = {
                providers,
                categories,
                domains,
                emails,
                providerNames: providers.map((p) => p.name),
                categoryNames: categories.map((c) => c.name),
                domainNames: domains.map((d) => d.name),
                emailNames: emails.map((e) => e.email || e.name),
            };
            if (token) {
                cachedMetadata = normalized;
                cachedAt = Date.now();
            }
            inflightPromise = null;
            return normalized;
        })
        .catch((err) => {
            inflightPromise = null;
            throw err;
        });

    return inflightPromise;
};

/**
 * Persists a new custom provider into dbo.CourseProviders and refreshes cache.
 */
export const createCourseProvider = async (name, explicitToken) => {
    const { headers } = getAuthHeaders(explicitToken);
    const res = await axios.post(
        `${API_BASE_URL}/api/course-metadata/providers`,
        { name: String(name || "").trim() },
        { headers }
    );
    clearCourseMetadataCache();
    return res.data?.provider || res.data;
};

/**
 * Persists a new custom category into dbo.CourseCategories and refreshes cache.
 */
export const createCourseCategory = async (name, explicitToken) => {
    const { headers } = getAuthHeaders(explicitToken);
    const res = await axios.post(
        `${API_BASE_URL}/api/course-metadata/categories`,
        { name: String(name || "").trim() },
        { headers }
    );
    clearCourseMetadataCache();
    return res.data?.category || res.data;
};

/**
 * Persists a new custom certification domain into dbo.lms_certification_domains and refreshes cache.
 */
export const createCertificationDomain = async (name, explicitToken) => {
    const { headers } = getAuthHeaders(explicitToken);
    const res = await axios.post(
        `${API_BASE_URL}/api/certification-domains`,
        { name: String(name || "").trim() },
        { headers }
    );
    clearCourseMetadataCache();
    return res.data?.domain || res.data;
};

/**
 * Persists a new custom course email into dbo.CourseEmails and refreshes cache.
 */
export const createCourseEmail = async (email, explicitToken) => {
    const { headers } = getAuthHeaders(explicitToken);
    const res = await axios.post(
        `${API_BASE_URL}/api/course-metadata/emails`,
        { email: String(email || "").trim() },
        { headers }
    );
    clearCourseMetadataCache();
    return res.data?.email || res.data;
};

/**
 * Explicitly persists custom ("Other") provider and/or category selections from
 * Form/Request Modals to dbo.CourseProviders and dbo.CourseCategories before parent
 * record submission, returning canonical names and refreshing the metadata cache.
 */
export const resolveAndPersistFormMetadata = async ({
    provider = "",
    isCustomProvider = false,
    category = "",
    isCustomCategory = false,
    domain = "",
    isCustomDomain = false,
    explicitToken = undefined,
} = {}) => {
    let resolvedProvider = String(provider || "").trim();
    let resolvedProviderId = null;
    let resolvedCategory = String(category || "").trim();
    let resolvedCategoryId = null;
    let resolvedDomain = String(domain || "").trim();
    let resolvedDomainId = null;
    let persistedAny = false;

    if (isCustomProvider && resolvedProvider && !["other", "others"].includes(resolvedProvider.toLowerCase())) {
        const createdProv = await createCourseProvider(resolvedProvider, explicitToken);
        if (createdProv?.name) {
            resolvedProvider = createdProv.name;
        }
        if (createdProv?.id || createdProv?.ProviderId) {
            resolvedProviderId = createdProv.id || createdProv.ProviderId;
        }
        persistedAny = true;
    }

    if (isCustomCategory && resolvedCategory && !["other", "others"].includes(resolvedCategory.toLowerCase())) {
        const createdCat = await createCourseCategory(resolvedCategory, explicitToken);
        if (createdCat?.name) {
            resolvedCategory = createdCat.name;
        }
        if (createdCat?.id || createdCat?.CategoryId) {
            resolvedCategoryId = createdCat.id || createdCat.CategoryId;
        }
        persistedAny = true;
    }

    if (isCustomDomain && resolvedDomain && !["other", "others"].includes(resolvedDomain.toLowerCase())) {
        const createdDom = await createCertificationDomain(resolvedDomain, explicitToken);
        if (createdDom?.name || createdDom?.domain_name) {
            resolvedDomain = createdDom.name || createdDom.domain_name;
        }
        if (createdDom?.domain_id || createdDom?.id) {
            resolvedDomainId = createdDom.domain_id || createdDom.id;
        }
        persistedAny = true;
    }

    // Resolve IDs from metadata cache or fetch if not custom
    if (
        (!resolvedProviderId && resolvedProvider) ||
        (!resolvedCategoryId && resolvedCategory) ||
        (!resolvedDomainId && resolvedDomain)
    ) {
        try {
            const meta = await fetchCourseMetadata(explicitToken);
            if (!resolvedProviderId && resolvedProvider) {
                const foundProv = (meta.providers || []).find(
                    (p) => String(p.name || p.provider_name).trim().toLowerCase() === resolvedProvider.toLowerCase()
                );
                if (foundProv) resolvedProviderId = foundProv.id || foundProv.ProviderId;
            }
            if (!resolvedCategoryId && resolvedCategory) {
                const foundCat = (meta.categories || []).find(
                    (c) => String(c.name || c.category_name).trim().toLowerCase() === resolvedCategory.toLowerCase()
                );
                if (foundCat) resolvedCategoryId = foundCat.id || foundCat.CategoryId;
            }
            if (!resolvedDomainId && resolvedDomain) {
                const foundDom = (meta.domains || []).find(
                    (d) => String(d.name || d.domain_name).trim().toLowerCase() === resolvedDomain.toLowerCase()
                );
                if (foundDom) resolvedDomainId = foundDom.domain_id || foundDom.id;
            }
        } catch (e) {
            console.warn("[CourseMetadata] Could not resolve metadata IDs:", e);
        }
    }

    if (!persistedAny) {
        clearCourseMetadataCache();
    }

    return {
        provider: resolvedProvider,
        provider_id: resolvedProviderId,
        category: resolvedCategory,
        category_id: resolvedCategoryId,
        domain: resolvedDomain,
        domain_id: resolvedDomainId,
    };
};

