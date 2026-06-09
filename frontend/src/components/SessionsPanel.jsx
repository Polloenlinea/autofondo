import { useState, useCallback } from 'react'
import { X, Trash2, Download, ChevronDown, ChevronUp, History, Loader2 } from 'lucide-react'

// Detecta MIME a partir del primer byte del base64 (sin necesitar el array images)
function thumbMime(b64) {
  if (!b64) return 'jpeg'
  return b64.startsWith('/9j/') ? 'jpeg' : 'png'
}

export default function SessionsPanel({ open, onClose, sessions, onDelete, onLoadSession }) {
  const [expanded,     setExpanded]     = useState(null)
  const [deleting,     setDeleting]     = useState(null)
  const [loadingId,    setLoadingId]    = useState(null)
  // Cache de sesiones completas (con imágenes) indexadas por _id
  const [loadedImages, setLoadedImages] = useState({})

  if (!open) return null

  const fmt = (ts) => new Date(ts).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const downloadImg = (img) => {
    const mime = img.isComposed ? 'jpeg' : 'png'
    const ext  = img.isComposed ? 'jpg'  : 'png'
    const b64  = img.composedB64 || img.cutoutB64
    const a    = document.createElement('a')
    a.href     = `data:image/${mime};base64,${b64}`
    a.download = img.fileName.replace(/\.[^.]+$/, '') + `_af.${ext}`
    a.click()
  }

  const handleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    // Si ya tenemos las imágenes en caché, no volvemos a cargar
    if (loadedImages[id]) return
    // Cargar la sesión completa (con imágenes) desde la API
    if (!onLoadSession) return
    setLoadingId(id)
    try {
      const session = await onLoadSession(id)
      setLoadedImages(prev => ({ ...prev, [id]: session.images || [] }))
    } catch {
      setLoadedImages(prev => ({ ...prev, [id]: [] }))
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await onDelete(id) } finally { setDeleting(null) }
    // Limpiar caché si existía
    setLoadedImages(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <History size={16} className="text-blue-700" />
            <h2 className="text-base font-semibold text-slate-800">Historial de sesiones</h2>
            {sessions.length > 0 && (
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                {sessions.length}
              </span>
            )}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {sessions.length === 0 ? (
            <div className="py-16 text-center">
              <History size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">No hay sesiones guardadas</p>
              <p className="text-xs text-slate-300 mt-1">Guardá una sesión desde la pantalla de Exportar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => {
                const sid    = s._id        // MongoDB siempre usa _id
                const imgs   = loadedImages[sid]
                const isOpen = expanded === sid
                return (
                  <div key={sid} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Session row */}
                    <div className="flex items-center gap-3 p-3">
                      {/* Thumbnail */}
                      <div className="w-16 h-12 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                        {s.thumbnail ? (
                          <img
                            src={`data:image/${thumbMime(s.thumbnail)};base64,${s.thumbnail}`}
                            className="w-full h-full object-cover" alt=""
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-200" />
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{s.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {fmt(s.date)} · {s.count} imagen{s.count !== 1 ? 'es' : ''}
                        </p>
                      </div>
                      {/* Ver fotos */}
                      <button onClick={() => handleExpand(sid)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        {loadingId === sid
                          ? <Loader2 size={12} className="animate-spin" />
                          : isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        Ver fotos
                      </button>
                      {/* Eliminar */}
                      <button
                        onClick={() => handleDelete(sid)}
                        disabled={deleting === sid}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Expanded gallery */}
                    {isOpen && (
                      <div className="border-t border-slate-100 p-3 bg-slate-50">
                        {loadingId === sid ? (
                          <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                            <Loader2 size={14} className="animate-spin" /> Cargando imágenes…
                          </div>
                        ) : imgs && imgs.length > 0 ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {imgs.map((img, i) => (
                              <div key={i}
                                className={`rounded-lg overflow-hidden ${img.isComposed ? 'bg-slate-200' : 'checker'}`}>
                                <div className="aspect-[4/3] relative group cursor-pointer"
                                  onClick={() => downloadImg(img)}>
                                  <img
                                    src={`data:image/${img.isComposed ? 'jpeg' : 'png'};base64,${img.composedB64 || img.cutoutB64}`}
                                    className="w-full h-full object-contain" alt=""
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <Download size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                <p className="text-[9px] text-slate-400 px-1.5 py-1 truncate">{img.fileName}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 text-center py-4">No hay imágenes disponibles</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
