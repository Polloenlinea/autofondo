import { useState } from 'react'
import { Save, Check } from 'lucide-react'
import { Btn, Spinner } from './ui'

/**
 * Modal global para guardar un borrador desde CUALQUIER etapa.
 * Guarda recortes + fondos + ajustes para retomar después desde el historial.
 */
export default function SaveDraftModal({ images, saveSession, onClose }) {
  const [name,   setName]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)
  const [done,   setDone]   = useState(false)

  const hasWork = (images || []).some(i => i.cutoutB64 || i.composedB64)

  const handleSave = async () => {
    if (!hasWork) return
    setError(null); setSaving(true)
    try {
      await saveSession(name, images)
      setDone(true)
      setTimeout(onClose, 1300)
    } catch (e) {
      setError(e.message || 'Error al guardar — revisá la conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={() => { if (!saving) onClose() }}>
      <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="py-4 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <Check size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Borrador guardado</p>
            <p className="text-xs text-slate-500">Lo retomás desde el historial 🕘</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Save size={16} className="text-blue-700" />
              <h3 className="text-base font-semibold text-slate-800">Guardar borrador</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Guarda recortes, fondos y ajustes para <strong>retomarlo después</strong> desde el historial.
            </p>
            {!hasWork && (
              <p className="text-xs text-amber-600 mb-3">Todavía no hay fotos procesadas para guardar.</p>
            )}
            <input
              type="text"
              placeholder={`Borrador ${new Date().toLocaleDateString('es-AR')}`}
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              autoFocus disabled={saving}
            />
            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">⚠️ {error}</div>
            )}
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Btn>
              <Btn variant="primary" size="full" onClick={handleSave} disabled={saving || !hasWork}>
                {saving ? <><Spinner size="sm" /> Guardando…</> : 'Guardar'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
