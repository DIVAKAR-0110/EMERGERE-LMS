import tick from "../../../assets/l&d/budget/tick.svg";
import alertIcon from "../../../assets/l&d/budget/alert.svg";
import education from "../../../assets/l&d/budget/education.svg";
import report from "../../../assets/l&d/budget/report.svg";

const ICONS = {
    tick,
    alert: alertIcon,
    education,
    report,
};

const TINT_COLORS = {
    success: "#2FC47E",
    info: "#215EF8",
    purple: "#9E5DF9",
    danger: "#FE7356",
};

export default function BudgetStats({
    icon = "tick",
    label = "",
    value = "",
    tint = "info",
    isLoading = false,
}) {
    const iconSrc = ICONS[icon] || ICONS.tick;
    const color = TINT_COLORS[tint] || TINT_COLORS.info;

    return (
        <div className="ld-budget-stat-card">
            <div
                className={`ld-budget-stat-icon ld-tint-${tint}`}
                style={{
                    color,
                    backgroundColor: `${color}15`,
                }}
            >
                <img
                    src={iconSrc}
                    alt=""
                    width={16}
                    height={16}
                />
            </div>

            <div>
                <div className="ld-budget-stat-value">
                    {isLoading || value === null || value === undefined ? (
                        <span
                            className="ld-skeleton-block"
                            style={{ width: "90px", height: "18px", display: "inline-block" }}
                        />
                    ) : (
                        value
                    )}
                </div>

                <div className="ld-budget-stat-label">
                    {label}
                </div>
            </div>
        </div>
    );
}
