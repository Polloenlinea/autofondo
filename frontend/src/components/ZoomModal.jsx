import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export default function ZoomModal({ img, images = [], onClose, onNavigate }) {
  const src = img.composedB64
    ? `data:image/jpeg;base64,${img.composedB64}`
    : img.cutoutB64
    ? `data:image/png;base64,${img.cutoutB64}`
    : img.previewUrl

  const hasCutout    = !!img.cutoutB64
  const hasComposed  = !!img.composedB64
  const showChecker  = hasCutout && !hasComposed

  // Navegación entre imágenes sin cerrar el zoom
  const idx     = images.findIndex(i => i.id === img.id)
  const canPrev = idx > 0
  const canNext = idx >= 0 && idx < images.length - 1
  const go = useCallback((dir) => {
    if (!onNavigate || idx < 0) return
    if (dir === 'prev' && canPrev) onNavigate(images[idx - 1].id)
    if (dir === 'next' && canNext) onNavigate(images[idx + 1].id)
  }, [onNavigate, idx, canPrev, canNext, images])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft')  go('prev')
      else if (e.key === 'ArrowRight') go('next')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, go])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center
          rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
      >
        <X size={18} />
      </button>

      {/* Filename + contador */}
      <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
        <p className="text-sm text-white/60 truncate max-w-xs">{img.file.name}</p>
        {images.length > 1 && idx >= 0 && (
          <span className="text-xs text-white/40 tabular-nums">{idx + 1} / {images.length}</span>
        )}
      </div>

      {/* Flecha anterior */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); go('prev') }}
          disabled={!canPrev}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
            rounded-full bg-white/20 text-white hover:bg-blue-600 disabled:opacity-15 disabled:cursor-not-allowed
            border border-white/20 shadow-lg transition-colors z-20"
          aria-label="Anterior (flecha izquierda)"
        >
          <ChevronLeft size={26} strokeWidth={2.5} />
        </button>
      )}

      {/* Flecha siguiente */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); go('next') }}
          disabled={!canNext}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
            rounded-full bg-white/20 text-white hover:bg-blue-600 disabled:opacity-15 disabled:cursor-not-allowed
            border border-white/20 shadow-lg transition-colors z-20"
          aria-label="Siguiente (flecha derecha)"
        >
          <ChevronRight size={26} strokeWidth={2.5} />
        </button>
      )}

      {/* Image */}
      <div
        className={`max-w-[92vw] max-h-[90vh] rounded-xl overflow-hidden flex items-center justify-center ${showChecker ? 'checker' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          className="max-w-[92vw] max-h-[90vh] object-contain"
          alt={img.file.name}
        />
      </div>
    </div>
  )
}
