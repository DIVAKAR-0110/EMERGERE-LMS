export default function ProgressBar({ value = 0, color = '#3B5FE2', trackColor = '#E9EEFA', height = 8, className = '' }) {
    return (
        <div
            className={className}
            style={{ width: '100%', height, backgroundColor: trackColor, borderRadius: 999, overflow: 'hidden' }}
        >
            <div
                style={{
                    width: `${Math.min(100, Math.max(0, value))}%`,
                    height: '100%',
                    backgroundColor: color,
                    borderRadius: 999,
                    transition: 'width 0.4s ease',
                }}
            />
        </div>
    );
}
