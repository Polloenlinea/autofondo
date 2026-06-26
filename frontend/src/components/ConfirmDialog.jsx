import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Diálogo de confirmación para acciones destructivas (reiniciar, volver atrás
 * perdiendo trabajo, etc). Evita perder el procesamiento por un click accidental.
 */
export default function ConfirmDialog({
  title, message, confirmLabel = 'Continuar', cancelLabel = 'Cancelar',
  onConfirm, onCancel,
}) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3"
        onClick={e => e.stopPropagation()}>
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={17} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 px-3 py-2.5 text-xs font-semibold rounded-lg border border-slate-200
              text-slate-700 hover:bg-slate-50 transition-colors">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-3 py-2.5 text-xs font-semibold rounded-lg bg-red-500
              text-white hover:bg-red-600 transition-colors">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
