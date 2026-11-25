import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
    return (
        <div className={`relative w-full sm:w-[280px] shrink-0 ${className}`}>
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 pl-10 pr-3 rounded-xl border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
            />
        </div>
    );
}

export function Select({ value, onChange, options, className = '' }) {
    return (
        <div className={`relative ${className}`}>
            <select
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                className="w-full h-10 pl-3.5 pr-9 rounded-xl border border-ink-200 bg-white text-sm text-ink-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 appearance-none cursor-pointer transition-all"
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>
    );
}

export function FilterButton({ onClick, label = 'Filters', withChevron = false }) {
    return (
        <button
            onClick={onClick}
            className="h-10 px-4 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-700 flex items-center gap-2 hover:bg-ink-100 transition-colors shrink-0"
        >
            <SlidersHorizontal size={15} />
            {label}
            {withChevron && <ChevronDown size={14} />}
        </button>
    );
}

export function PageHeader({ title, subtitle, right }) {
    return (
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
                <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
                {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
            </div>
            {right}
        </div>
    );
}

export function TabButton({ active, onClick, icon: Icon, children }) {
    return (
        <button
            onClick={onClick}
            className={`h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors border ${active
                ? 'bg-primary-500 border-primary-500 text-white shadow-sm'
                : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-100'
                }`}
        >
            {Icon && <Icon size={16} />}
            {children}
        </button>
    );
}

export function SectionCard({ title, subtitle, right, children, className = '' }) {
    return (
        <div className={`bg-white rounded-card shadow-card p-6 ${className}`}>
            {(title || right) && (
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                    <div>
                        {title && <h3 className="text-base font-bold text-ink-900">{title}</h3>}
                        {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {right}
                </div>
            )}
            {children}
        </div>
    );
}

export function PrimaryButton({ children, onClick, icon: Icon, type = 'button', className = '', disabled }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`h-10 px-4 rounded-xl bg-primary-500 text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 ${className}`}
        >
            {Icon && <Icon size={16} />}
            {children}
        </button>
    );
}

export function SecondaryButton({ children, onClick, icon: Icon, type = 'button', className = '' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            className={`h-10 px-4 rounded-xl bg-white border border-ink-200 text-ink-700 text-sm font-semibold flex items-center gap-2 hover:bg-ink-100 transition-colors shrink-0 ${className}`}
        >
            {Icon && <Icon size={16} />}
            {children}
        </button>
    );
}

export function OutlinePrimaryButton({ children, onClick, icon: Icon, className = '' }) {
    return (
        <button
            onClick={onClick}
            className={`h-10 px-4 rounded-xl bg-white border border-primary-500 text-primary-500 text-sm font-semibold flex items-center gap-2 hover:bg-primary-50 transition-colors shrink-0 ${className}`}
        >
            {Icon && <Icon size={16} />}
            {children}
        </button>
    );
}
