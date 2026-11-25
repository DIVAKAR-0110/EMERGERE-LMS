import { useState, useEffect } from "react";

/**
 * Calculates the optimal number of skeleton rows / items per page
 * for the Certification & Reimbursement tabs based on viewport dimensions.
 */
export const getCertSkeletonRowCount = () => {
    if (typeof window === "undefined") return 5;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Small Mobile (≤ 480px)
    if (w <= 480) {
        if (h >= 750) return 4;
        return 3;
    }

    // Mobile / Phablet (481px - 767px)
    if (w < 768) {
        if (h >= 800) return 4;
        return 3;
    }

    // Tablet (768px - 1023px)
    if (w < 1024) {
        if (h >= 1000) return 6;
        if (h >= 800) return 5;
        return 4;
    }

    // Laptop (1024px - 1279px)
    if (w < 1280) {
        if (h >= 850) return 6;
        if (h >= 640) return 5;
        return 4;
    }

    // Standard & Large Desktop (≥ 1280px)
    if (h >= 950) return 7;
    if (h >= 800) return 6; // Fits 1440x900 and 1080p
    if (h >= 640) return 5;
    return 4;
};

/**
 * Hook that listens to viewport changes and returns the dynamic row count.
 */
export const useCertSkeletonRowCount = () => {
    const [count, setCount] = useState(() => getCertSkeletonRowCount());

    useEffect(() => {
        const handleResize = () => {
            const next = getCertSkeletonRowCount();
            setCount((prev) => (prev !== next ? next : prev));
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return count;
};

