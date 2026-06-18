import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function ZoomModal({ img, onClose }) {
  const src = img.composedB64
    ? `data:image/jpeg;base64,${img.composedB64}`
    : img.cutoutB64
    ? `data:image/png;base64,${img.cutoutB64}`
    : img.previewUrl

  const hasCutout    = !!img.cutoutB64
  const hasComposed  = !!img.composedB64
  const showChecker  = hasCutout && !hasComposed

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center
          rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X size={18} />
      </button>

      {/* Filename */}
      <p className="absolute top-4 left-4 text-sm text-white/60 truncate max-w-xs">
        {img.file.name}
      </p>

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
