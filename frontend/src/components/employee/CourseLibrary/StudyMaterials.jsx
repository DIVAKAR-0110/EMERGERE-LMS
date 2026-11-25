import React, { useEffect, useRef } from "react";
import Pagination from "./Pagination";

import pdfIcon from "../../../assets/course_library/pdf.svg";
import pptIcon from "../../../assets/course_library/ppt.svg";
import ebookIcon from "../../../assets/course_library/e-book.svg";
import downloadIcon from "../../../assets/course_library/material-symbols_download.svg";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";
import {
    FileText,
    BookOpen,
    Briefcase,
    FileSpreadsheet,
    FileCode,
} from "lucide-react";
import { formatMaterialFileSize } from "../../../utils/materialUtils";

export const normalizeMaterialType = (type) => {
    if (!type) return "PDF";
    const clean = type.trim().toLowerCase();
    if (clean.includes("pdf")) return "PDF";
    if (clean.includes("ppt") || clean.includes("present") || clean.includes("slide") || clean.includes("powerpoint")) return "PPT";
    if (clean.includes("ebook") || clean.includes("e-book") || clean.includes("book") || clean.includes("epub") || clean.includes("mobi")) return "E-BOOK";
    if (clean.includes("research") || clean.includes("paper")) return "RESEARCH";
    if (clean.includes("case")) return "CASE";
    if (clean.includes("white")) return "WHITEPAPER";
    if (clean.includes("sheet") || clean.includes("excel") || clean.includes("csv") || clean.includes("xls")) return "EXCEL";
    return "OTHER";
};

export const getMaterialPillLabel = (fileType) => {
    const norm = normalizeMaterialType(fileType);
    switch (norm) {
        case "PDF": return "PDF";
        case "PPT": return "PPT";
        case "E-BOOK": return "E-BOOK";
        case "RESEARCH": return "PAPER";
        case "CASE": return "CASE";
        case "WHITEPAPER": return "WHITE";
        case "EXCEL": return "EXCEL";
        default: return (fileType || "DOC").toUpperCase().slice(0, 6);
    }
};

const StudyMaterials = ({
    materials,
    currentPage = 1,
    setCurrentPage,
    itemsPerPage = 12,
    gridRows,
    gridCols = 4,
    onDownload,
    isLoading = false,
    highlightedMaterialId = null,
}) => {
    const highlightedRef = useRef(null);

    useEffect(() => {
        if (!highlightedMaterialId || !highlightedRef.current) return;
        const timer = setTimeout(() => {
            highlightedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return () => clearTimeout(timer);
    }, [highlightedMaterialId]);
    const renderFileIcon = (fileType) => {
        const norm = normalizeMaterialType(fileType);
        switch (norm) {
            case "PPT":
                return (
                    <img
                        src={pptIcon}
                        alt="PPT"
                        className="emp-material-icon-svg emp-icon-ppt"
                    />
                );

            case "E-BOOK":
                return (
                    <img
                        src={ebookIcon}
                        alt="E-Book"
                        className="emp-material-icon-svg emp-icon-ebook"
                    />
                );

            case "RESEARCH":
                return <FileText size={27} strokeWidth={1.8} color="#0D9488" />;

            case "CASE":
                return <Briefcase size={25} strokeWidth={1.8} color="#2563EB" />;

            case "WHITEPAPER":
                return <BookOpen size={25} strokeWidth={1.8} color="#7C3AED" />;

            case "EXCEL":
                return <FileSpreadsheet size={26} strokeWidth={1.8} color="#059669" />;

            case "OTHER":
                return <FileCode size={25} strokeWidth={1.8} color="#475569" />;

            case "PDF":
            default:
                return (
                    <img
                        src={pdfIcon}
                        alt="PDF"
                        className="emp-material-icon-svg emp-icon-pdf"
                    />
                );
        }
    };

    const getBoxClass = (fileType) => {
        const norm = normalizeMaterialType(fileType);
        switch (norm) {
            case "PPT":
                return "emp-file-box-ppt";
            case "E-BOOK":
                return "emp-file-box-ebook";
            case "RESEARCH":
                return "emp-file-box-research";
            case "CASE":
                return "emp-file-box-casestudy";
            case "WHITEPAPER":
                return "emp-file-box-whitepaper";
            case "EXCEL":
                return "emp-file-box-sheet";
            case "OTHER":
                return "emp-file-box-other";
            case "PDF":
            default:
                return "emp-file-box-pdf";
        }
    };

    if (isLoading) {
        const skeletonCount = Math.max(1, itemsPerPage || 9);
        const skeletonRows = gridRows || Math.max(1, Math.ceil(skeletonCount / Math.max(1, gridCols || 3)));
        return (
            <div className="emp-study-materials-frame">
                <div
                    className="emp-materials-grid"
                    style={{ "--material-grid-rows": skeletonRows }}
                >
                    {Array.from({ length: skeletonCount }, (_, idx) => idx + 1).map((i) => (
                        <article className="emp-material-card" key={i} style={{ padding: 16 }}>
                            <div className="emp-material-card-top" style={{ display: "flex", gap: 12 }}>
                                <div className="ld-skeleton-block" style={{ width: 61, height: 61, borderRadius: 8, flexShrink: 0 }} />
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div className="ld-skeleton-block" style={{ width: "85%", height: 16 }} />
                                    <div className="ld-skeleton-block" style={{ width: "60%", height: 12 }} />
                                </div>
                            </div>
                            <div className="emp-material-card-footer" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div className="ld-skeleton-block" style={{ width: 45, height: 12 }} />
                                <div className="ld-skeleton-block" style={{ width: 70, height: 12 }} />
                                <div className="ld-skeleton-block" style={{ width: 28, height: 28, borderRadius: 6 }} />
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        );
    }

    const start = (currentPage - 1) * itemsPerPage;
    const paginatedMaterials = (materials || []).slice(start, start + itemsPerPage);

    if (paginatedMaterials.length === 0) {
        return (
            <div className="emp-empty-state">
                <img
                    src={openBookIcon}
                    alt="No study materials found"
                    className="emp-empty-state-icon"
                />
                <h3>No study materials found</h3>
            </div>
        );
    }

    return (
        <div className="emp-study-materials-frame">
            <div
                className="emp-materials-grid"
                style={{ "--material-grid-rows": gridRows || 3 }}
            >
                {paginatedMaterials.map((item) => {
                    const isHighlighted =
                        highlightedMaterialId !== null &&
                        highlightedMaterialId !== undefined &&
                        String(highlightedMaterialId) === String(item.id);
                    return (
                        <article
                            ref={isHighlighted ? highlightedRef : null}
                            data-material-id={item.id}
                            className={`emp-material-card ${isHighlighted ? "emp-material-card-highlighted" : ""}`}
                            key={item.id}
                        >
                            {isHighlighted && (
                                <span className="emp-notif-highlight-pill">Selected Material</span>
                            )}
                            <div className="emp-material-card-top">
                                {/* LEFT: 61x61 FILE ICON BOX + 61x19 FILE TYPE PILL */}
                                <div className="emp-material-file-wrapper">
                                    <div className={`emp-material-file-box ${getBoxClass(item.fileType)}`}>
                                        {renderFileIcon(item.fileType)}
                                    </div>
                                    <div className="emp-material-file-type-pill" title={item.fileType}>
                                        <span className="emp-file-type-text">{getMaterialPillLabel(item.fileType)}</span>
                                    </div>
                                </div>

                                {/* RIGHT: TITLE & DESCRIPTION */}
                                <div className="emp-material-info">
                                    <h3 className="emp-material-title" title={item.title}>
                                        {item.title}
                                    </h3>
                                    <p className="emp-material-description" title={item.description}>
                                        {item.description}
                                    </p>
                                </div>
                            </div>

                            {/* FOOTER: FILE SIZE + DATE + DOWNLOAD BUTTON */}
                            <div className="emp-material-card-footer">
                                <span className="emp-material-file-size">
                                    {formatMaterialFileSize(item)}
                                </span>

                                <span className="emp-material-date">
                                    {item.date}
                                </span>

                                <button
                                    type="button"
                                    className="emp-btn-material-download"
                                    onClick={() => onDownload?.(item)}
                                    aria-label={`Download ${item.title}`}
                                >
                                    <img src={downloadIcon} alt="Download" />
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>

            <Pagination
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                total={materials.length}
                itemsPerPage={itemsPerPage}
                type="Study Materials"
                isMaterialsFrame={true}
            />
        </div>
    );
};

export default StudyMaterials;