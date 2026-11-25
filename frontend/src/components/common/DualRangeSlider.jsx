import React from "react";
import "../../styles/common/DualRangeSlider.css";

export default function DualRangeSlider({
    title = "Price",
    min = 0,
    max = 50000,
    step = 500,
    value = [0, 50000],
    showPlusAtMax = false,
    onChange,
    onClear,
}) {
    const rawMin = value?.[0] !== undefined ? value[0] : min;
    const rawMax = value?.[1] !== undefined ? value[1] : max;

    const minVal = Math.max(min, Math.min(rawMin, max));
    const maxVal = Math.max(minVal, Math.min(rawMax, max));

    const minPercent = Math.max(0, Math.min(100, Math.round(((minVal - min) / (max - min || 1)) * 100)));
    const maxPercent = Math.max(0, Math.min(100, Math.round(((maxVal - min) / (max - min || 1)) * 100)));

    const isFiltered = minVal > min || maxVal < max;

    const handleMinChange = (e) => {
        const val = Math.min(Number(e.target.value), maxVal - step);
        onChange?.([val, maxVal]);
    };

    const handleMaxChange = (e) => {
        const val = Math.max(Number(e.target.value), minVal + step);
        onChange?.([minVal, val]);
    };

    return (
        <div className="rm-filter-group dual-range-slider-group">
            <div className="rm-filter-group-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 className="rm-filter-group-heading">{title}</h4>
                {isFiltered && onClear && (
                    <button
                        type="button"
                        className="rm-filter-clear-link"
                        onClick={onClear}
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="dual-slider-value-label">
                ₹{minVal.toLocaleString("en-IN")} – ₹{maxVal.toLocaleString("en-IN")}{showPlusAtMax && maxVal >= max ? "+" : ""}
            </div>

            <div className="dual-slider-track-wrap">
                <div className="dual-slider-rail" />
                <div
                    className="dual-slider-track-highlight"
                    style={{
                        left: `${minPercent}%`,
                        width: `${maxPercent - minPercent}%`,
                    }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={minVal}
                    onChange={handleMinChange}
                    className="dual-slider-input dual-slider-input-left"
                    aria-label={`${title} minimum`}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={maxVal}
                    onChange={handleMaxChange}
                    className="dual-slider-input dual-slider-input-right"
                    aria-label={`${title} maximum`}
                />
            </div>
        </div>
    );
}
