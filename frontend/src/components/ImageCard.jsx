import { X, Scissors, EyeOff, Loader2, AlertCircle, ZoomIn } from 'lucide-react'
import { Spinner } from './ui'

export default function ImageCard({ img, effectiveType, onToggleType, onRemove, onZoom, showResult = false }) {
  const type = effectiveType(img)

  const resultB64  = showResult ? (img.composedB64 || img.cutoutB64) : null
  const resultMime = img.composedB64 ? 'jpeg' : 'png'
  const displaySrc = resultB64
    ? `data:image/${resultMime};base64,${resultB64}`
    : img.previewUrl

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden group
      hover:border-slate-300 transition-colors">

      {/* ── Imagen ── */}
      <div
        className={`aspect-square overflow-hidden relative cursor-pointer
          ${resultB64 && !img.composedB64 ? 'checker' : 'bg-slate-50'}`}
        onClick={onZoom}
      >
        <img src={displaySrc} className="w-full h-full object-contain" alt="" />

        {/* Hover overlay con zoom icon */}
        {onZoom && img.status !== 'processing' && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors
            flex items-center justify-center">
            <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Procesando */}
        {img.status === 'processing' && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2">
            <Loader2 size={20} className="text-blue-700 animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Procesando</span>
          </div>
        )}

        {/* Error */}
        {img.status === 'error' && (
          <div className="absolute inset-0 bg-red-50/95 flex flex-col items-center justify-center p-3 gap-1.5">
            <AlertCircle size={18} className="text-red-500" />
            <span className="text-xs text-red-600 text-center leading-snug font-medium">{img.error}</span>
          </div>
        )}

        {/* Botón quitar */}
        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="absolute top-1.5 left-1.5 w-6 h-6 bg-black/50 text-white rounded-md
              flex items-center justify-center opacity-0 group-hover:opacity-100
              active:opacity-100 transition-opacity hover:bg-black/70"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}

        {/* Badge interior sin recorte */}
        {img.status === 'skipped' && (
          <div className="absolute top-1.5 right-1.5">
            <span className="bg-slate-800/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
              Sin recorte
            </span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-2.5 py-2 space-y-1.5">
        <p className="text-xs text-slate-400 truncate leading-none">{img.file.name}</p>

        <div className="flex items-center justify-between gap-1">
          {/* Tipo */}
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold
            ${type === 'exterior'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-slate-100 text-slate-500'
            }`}>
            {type === 'exterior'
              ? <Scissors size={10} strokeWidth={2} />
              : <EyeOff size={10} strokeWidth={2} />
            }
            {type === 'exterior' ? 'Quitar fondo' : 'No recortar'}
          </div>

          {/* Cambiar tipo */}
          {onToggleType && (
            <button
              onClick={onToggleType}
              className="text-[11px] text-slate-400 hover:text-blue-700 transition-colors
                font-medium leading-none underline underline-offset-2"
            >
              cambiar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
