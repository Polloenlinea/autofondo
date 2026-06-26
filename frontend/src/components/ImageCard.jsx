import { X, Scissors, EyeOff, Loader2, AlertCircle, ZoomIn, Pencil } from 'lucide-react'
import { Spinner } from './ui'

export default function ImageCard({
  img, effectiveType, onToggleType, onRemove,
  onZoom, onEdit,
  showResult = false,
}) {
  const type = effectiveType(img)

  const resultB64  = showResult ? (img.composedB64 || img.cutoutB64) : null
  const resultMime = img.composedB64 ? 'jpeg' : 'png'
  const displaySrc = resultB64
    ? `data:image/${resultMime};base64,${resultB64}`
    : img.previewUrl

  const canInteract = img.status !== 'processing'

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden">

      {/* ── Imagen ── */}
      <div
        className={`aspect-square overflow-hidden relative
          ${resultB64 && !img.composedB64 ? 'checker' : 'bg-slate-50'}
          ${onZoom && canInteract ? 'cursor-zoom-in' : ''}`}
        onClick={canInteract && onZoom ? () => onZoom(img.id) : undefined}
      >
        <img src={displaySrc} className="w-full h-full object-contain" alt="" />

        {/* Zoom hint — solo desktop (hover) */}
        {onZoom && canInteract && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors
            hidden sm:flex items-center justify-center pointer-events-none">
            <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Procesando */}
        {img.status === 'processing' && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2">
            <Loader2 size={22} className="text-blue-700 animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Procesando…</span>
          </div>
        )}

        {/* Error */}
        {img.status === 'error' && (
          <div className="absolute inset-0 bg-red-50/95 flex flex-col items-center justify-center p-3 gap-1.5">
            <AlertCircle size={20} className="text-red-500" />
            <span className="text-xs text-red-600 text-center leading-snug font-medium">{img.error}</span>
          </div>
        )}

        {/* Botón quitar — siempre visible (intuitivo, no escondido en hover) */}
        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            title="Eliminar imagen"
            className="absolute top-2 left-2 w-8 h-8 bg-black/55 text-white rounded-xl
              flex items-center justify-center transition-colors hover:bg-red-500 active:bg-red-600"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}

        {/* Badge sin recorte */}
        {img.status === 'skipped' && (
          <div className="absolute top-2 right-2">
            <span className="bg-slate-800/80 text-white text-[10px] font-semibold px-2 py-1 rounded-lg">
              Sin recorte
            </span>
          </div>
        )}
      </div>

      {/* ── Footer — acciones siempre visibles, nada escondido detrás de un hover ── */}
      <div className="px-2 py-2 space-y-1.5">
        {onEdit && canInteract && resultB64 && (
          <button
            onClick={() => onEdit(img.id)}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
              text-[11px] font-semibold transition-colors min-h-[36px]
              bg-blue-700 text-white hover:bg-blue-800 active:bg-blue-900"
          >
            <Pencil size={11} /> Editar
          </button>
        )}

        {onToggleType ? (
          <button
            onClick={onToggleType}
            className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
              text-[11px] font-semibold transition-colors min-h-[36px]
              ${type === 'interior'
                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
          >
            {type === 'interior'
              ? <><Scissors size={11} strokeWidth={2} /> Quitar fondo</>
              : <><EyeOff size={11} strokeWidth={2} /> No quitar fondo</>
            }
          </button>
        ) : (
          <span className="text-[11px] text-slate-300 truncate block px-1">{img.file.name}</span>
        )}
      </div>
    </div>
  )
}
