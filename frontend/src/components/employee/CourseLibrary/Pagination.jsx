import React from "react";
import leftarrowIcon from "../../../assets/course_library/leftarrow.svg";
import rightarrowIcon from "../../../assets/course_library/rightarrow.svg";
import dotIcon from "../../../assets/course_library/dot.svg";
import "../../../styles/employee/CourseCard.css";

const Pagination = ({
    currentPage,
    setCurrentPage,
    total = 0,
    itemsPerPage = 8,
    type = "Courses",
    isMaterialsFrame = false,
}) => {
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    const startItem = total === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
    const endItem = total === 0 ? 0 : Math.min(safeCurrentPage * itemsPerPage, total);
    const displayTotal = total;

    const goToPreviousPage = () => {
        if (safeCurrentPage > 1) {
            setCurrentPage(safeCurrentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (safeCurrentPage < totalPages) {
            setCurrentPage(safeCurrentPage + 1);
        }
    };

    // Calculate dynamic page numbers to display
    const getPageItems = () => {
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        // Pages 1 to (totalPages - 3), e.g. Pages 1, 2, 3, 4:
        // Page 1: < 1 2 ... 7 >
        // Page 2: < 2 3 ... 7 >
        // Page 3: < 3 4 ... 7 >
        // Page 4: < 4 5 ... 7 >
        if (safeCurrentPage <= totalPages - 3) {
            return [safeCurrentPage, safeCurrentPage + 1, "dots", totalPages];
        }

        // Pages (totalPages - 2) to totalPages, e.g. Pages 5, 6, 7:
        // Page 5, 6, 7: < 5 ... 6 7 >
        return [totalPages - 2, "dots", totalPages - 1, totalPages];
    };

    const pageItems = getPageItems();

    return (
        <footer className={`emp-course-pagination-bar ${isMaterialsFrame ? "emp-materials-pagination-bar" : ""}`}>
            <span className="emp-pagination-text">
                Showing {startItem} to {endItem} of {total} {type}
            </span>

            <div className="emp-pagination-controls">
                <button
                    type="button"
                    className="emp-page-btn emp-prev-btn"
                    disabled={safeCurrentPage === 1}
                    onClick={goToPreviousPage}
                    aria-label="Previous Page"
                >
                    <img src={leftarrowIcon} alt="Previous" className="emp-pagination-arrow-icon" />
                </button>

                {pageItems.map((item, index) => {
                    if (item === "dots") {
                        return (
                            <div key={`dots-${index}`} className="emp-page-dots" aria-hidden="true">
                                <img src={dotIcon} alt="" className="emp-dot-icon" />
                                <img src={dotIcon} alt="" className="emp-dot-icon" />
                                <img src={dotIcon} alt="" className="emp-dot-icon" />
                            </div>
                        );
                    }

                    return (
                        <button
                            key={`page-${item}`}
                            type="button"
                            className={`emp-page-btn ${safeCurrentPage === item ? "active" : ""}`}
                            onClick={() => setCurrentPage(item)}
                        >
                            <span className="emp-page-number-text">{item}</span>
                        </button>
                    );
                })}

                <button
                    type="button"
                    className="emp-page-btn emp-next-btn"
                    disabled={safeCurrentPage === totalPages}
                    onClick={goToNextPage}
                    aria-label="Next Page"
                >
                    <img src={rightarrowIcon} alt="Next" className="emp-pagination-arrow-icon" />
                </button>
            </div>
        </footer>
    );
};

export default Pagination;
