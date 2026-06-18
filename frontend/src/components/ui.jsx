// ─── Primitivos de UI ────────────────────────────────────────────────────────

export function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', className = '', type = 'button' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all select-none tracking-wide active:scale-[0.97]'
  const sizes = {
    sm:   'px-3 py-2 text-xs min-h-[36px]',
    md:   'px-5 py-3 text-sm min-h-[48px]',
    lg:   'px-6 py-4 text-base min-h-[56px]',
    full: 'w-full px-5 py-4 text-base min-h-[56px]',
  }
  const variants = {
    primary:   'bg-blue-700 text-white hover:bg-blue-800 active:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:active:scale-100',
    secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40',
    ghost:     'text-slate-500 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40',
    danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    success:   'bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function Slider({ label, value, min, max, unit = '', onChange }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm text-slate-600 font-medium">{label}</span>
        <span className="text-sm font-semibold text-blue-700 tabular-nums w-12 text-right">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-2 accent-blue-700" />
    </div>
  )
}

export function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0
          ${value ? 'bg-blue-700' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm
          transition-transform duration-200 ${value ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm text-slate-700 font-medium">{label}</span>}
    </label>
  )
}

export function Spinner({ size = 'sm', color = 'text-white' }) {
  const s = { xs: 'w-3 h-3 border', sm: 'w-4 h-4 border-2', md: 'w-5 h-5 border-2', lg: 'w-8 h-8 border-[3px]' }[size]
  return <div className={`${s} ${color} border-current border-t-transparent rounded-full animate-spin flex-shrink-0`} />
}

export function Badge({ children, variant = 'default' }) {
  const variants = {
    default:  'bg-slate-100 text-slate-600',
    blue:     'bg-blue-50 text-blue-700',
    green:    'bg-emerald-50 text-emerald-700',
    amber:    'bg-amber-50 text-amber-700',
    violet:   'bg-violet-50 text-violet-700',
    red:      'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
      {children}
    </p>
  )
}

export function Divider() {
  return <hr className="border-slate-100 my-1" />
}
