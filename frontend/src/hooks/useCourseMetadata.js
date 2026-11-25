import { useState, useEffect, useCallback } from "react";
import { fetchCourseMetadata } from "../services/courseMetadataService";

const EMPTY_METADATA = {
    providers: [],
    categories: [],
    domains: [],
    emails: [],
    providerNames: [],
    categoryNames: [],
    domainNames: [],
    emailNames: [],
};

/**
 * React hook providing live active CourseProviders and CourseCategories from database.
 */
export function useCourseMetadata(explicitToken, enabled = true) {
    const [metadata, setMetadata] = useState(EMPTY_METADATA);
    const [loading, setLoading] = useState(Boolean(enabled));
    const [error, setError] = useState(null);

    const load = useCallback(
        async (forceRefresh = false) => {
            if (!enabled) return;
            setLoading(true);
            setError(null);
            try {
                const data = await fetchCourseMetadata(explicitToken, forceRefresh);
                setMetadata(data);
            } catch (err) {
                console.error("Failed to load live course metadata:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        },
        [explicitToken, enabled]
    );

    useEffect(() => {
        if (enabled) {
            load(false);
        }
    }, [enabled, load]);

    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;
        const handleUpdated = () => {
            load(true);
        };
        window.addEventListener("lms-course-metadata-updated", handleUpdated);
        return () => {
            window.removeEventListener("lms-course-metadata-updated", handleUpdated);
        };
    }, [enabled, load]);

    return {
        providers: metadata.providers,
        categories: metadata.categories,
        domains: metadata.domains,
        emails: metadata.emails,
        providerNames: metadata.providerNames,
        categoryNames: metadata.categoryNames,
        domainNames: metadata.domainNames,
        emailNames: metadata.emailNames,
        loading,
        error,
        refresh: () => load(true),
    };
}

export default useCourseMetadata;

