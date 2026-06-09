// ── Componentes de UI compartidos ─────────────────────────────────────────────

/** Convierte base64 a Blob binario (para FormData) */
export function b64ToBlob(b64, mime) {
  const bytes = atob(b64)
  const arr   = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** Slider táctil con label y valor */
export function Slider({ label, value, min, max, unit, onChange }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm text-slate-600 font-medium">{label}</span>
        <span className="text-sm font-bold text-blue-600 tabular-nums">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full cursor-pointer"
      />
    </div>
  )
}

/** Toggle switch */
export function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none py-0.5">
      <div
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0
          ${value ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
          transition-transform duration-200 ${value ? 'translate-x-6' : ''}`} />
      </div>
      <span className="text-sm text-slate-600 font-medium">{label}</span>
    </label>
  )
}

/** Spinner de carga */
export function Spinner({ size = 'sm', color = 'text-white' }) {
  const s = size === 'lg' ? 'w-10 h-10 border-4' : size === 'md' ? 'w-6 h-6 border-[3px]' : 'w-4 h-4 border-2'
  return (
    <div className={`${s} ${color} border-current border-t-transparent rounded-full animate-spin`} />
  )
}
