import { useState, useRef, useEffect } from 'react'
import { Camera, Images, Plus, X, Check, AlertTriangle, ShieldCheck, Zap, Star, FolderOpen } from 'lucide-react'

const DEMO_FILES = [
  '32bb1d56.jpg','7f057d7e.jpg','9d50e2a5-0f79-4895-a9c1-031187afc223.png',
  'CAR572178-1-1.jpg','ce93641b.jpg','ej01.png','f25556fd.jpg',
]

function DemoPicker({ onAdd }) {
  const [open,     setOpen]     = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [loading,  setLoading]  = useState(false)

  const toggle = (name) => setSelected(prev => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  const confirm = async () => {
    if (!selected.size) return
    setLoading(true)
    try {
      const files = await Promise.all(
        [...selected].map(name =>
          fetch(`/demo/${name}`)
            .then(r => r.blob())
            .then(blob => new File([blob], name, { type: blob.type }))
        )
      )
      onAdd(files)
      setSelected(new Set())
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-sm font-semibold
        hover:bg-slate-200 active:scale-95 transition-all">
      <FolderOpen size={15} /> Fotos de muestra
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-bold text-slate-700 text-sm">Fotos de muestra</span>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        <div className="p-3 grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
          {DEMO_FILES.map(name => {
            const sel = selected.has(name)
            return (
              <button key={name} onClick={() => toggle(name)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[4/3]
                  ${sel ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}>
                <img src={`/demo/${name}`} className="w-full h-full object-cover" alt="" />
                {sel && (
                  <div className="absolute top-1 left-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div className="px-3 pb-3">
          <button onClick={confirm} disabled={!selected.size || loading}
            className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm
              disabled:opacity-40 transition-all">
            {loading ? 'Cargando…' : selected.size ? `Agregar ${selected.size} foto${selected.size !== 1 ? 's' : ''}` : 'Seleccioná fotos'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StepUpload({ images, rejected, addFiles, toggleType, effectiveType, removeImage, onZoom, onNext, stats, plateOptions, onPlateOptions }) {
  const [dragging, setDragging] = useState(false)
  const inputRef   = useRef()
  const cameraRef  = useRef()

  const exterior = images.filter(img => effectiveType(img) === 'exterior')

  // Drag & drop global
  useEffect(() => {
    const over  = e => { e.preventDefault(); setDragging(true) }
    const leave = e => { if (!e.relatedTarget) setDragging(false) }
    const drop  = e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [addFiles])

  return (
    <div className="space-y-3 pb-32">

      {/* Inputs ocultos */}
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={e => addFiles(e.target.files)} />

      {/* ══ ZONA DE CARGA — hero siempre visible ══ */}
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all
          flex flex-col items-center justify-center text-center px-6
          ${dragging ? 'border-blue-500 bg-blue-50 py-10' : 'border-slate-200 bg-white hover:border-blue-400 py-8'}`}>

        {dragging ? (
          <>
            <Images size={40} className="text-blue-500 mb-2" strokeWidth={1.5} />
            <p className="text-base font-bold text-blue-700">Soltá las fotos aquí</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-200">
              <Images size={26} className="text-white" strokeWidth={1.5} />
            </div>
            <p className="text-base font-bold text-slate-700 mb-1">
              {images.length === 0 ? 'Arrastrá las fotos acá' : 'Agregar más fotos'}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {images.length === 0 ? 'o tocá para elegir · JPG, PNG, WEBP' : 'JPG, PNG, WEBP'}
            </p>
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold
                  hover:bg-blue-700 active:scale-95 transition-all sm:hidden">
                <Camera size={15} /> Cámara
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold
                  hover:bg-slate-200 active:scale-95 transition-all">
                <Plus size={15} />
                <span className="sm:hidden">Galería</span>
                <span className="hidden sm:inline">Seleccionar archivos</span>
              </button>
              <DemoPicker onAdd={addFiles} />
            </div>
          </>
        )}
      </div>

      {/* ══ FOTOS SELECCIONADAS ══ */}
      {images.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Header con contador */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Fotos seleccionadas
            </span>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
              {images.length} {images.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>

          {/* Grid 3 columnas */}
          <div className="px-3 pb-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.map(img => {
              const isInterior = effectiveType(img) === 'interior'
              const src = img.previewUrl
              return (
                <div key={img.id} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  {/* Imagen */}
                  <div className="aspect-[4/3] relative cursor-zoom-in"
                    onClick={() => onZoom && onZoom(img.id)}>
                    <img src={src} className="w-full h-full object-cover" alt="" />
                    {/* Check verde — exterior */}
                    {!isInterior && (
                      <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                    {/* Badge interior */}
                    {isInterior && (
                      <div className="absolute inset-0 bg-black/30 flex items-end p-1">
                        <span className="text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">Interior</span>
                      </div>
                    )}
                  </div>
                  {/* Acciones */}
                  <div className="px-1.5 py-1.5 flex items-center gap-1">
                    <button
                      onClick={() => toggleType(img.id)}
                      title={isInterior ? 'Marcar como exterior' : 'Marcar como interior'}
                      className={`flex-1 text-[9px] font-bold py-1 rounded-lg transition-colors
                        ${isInterior ? 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600' : 'bg-green-50 text-green-700 hover:bg-slate-100 hover:text-slate-500'}`}>
                      {isInterior ? 'Sin recorte' : '✓ Recorte'}
                    </button>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0">
                      <X size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ OPCIONES ══ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">

        {/* Tapar matrícula */}
        <label className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none">
          <ShieldCheck size={17} className={plateOptions.hidePlate ? 'text-blue-600' : 'text-slate-400'} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">Tapar matrícula</p>
            <p className="text-[11px] text-slate-400">Oculta la patente en la foto final</p>
          </div>
          <div className="relative flex-shrink-0">
            <input type="checkbox" className="sr-only peer"
              checked={plateOptions.hidePlate}
              onChange={e => onPlateOptions({ ...plateOptions, hidePlate: e.target.checked })} />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-blue-600
              after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white
              after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </div>
        </label>

        {/* Calidad de recorte */}
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-700">Calidad de recorte</p>
              <p className="text-[11px] text-slate-400">Precisión del fondo removido</p>
            </div>
            <div className="flex gap-1.5">
              {[
                { id: 'imgly',         label: 'Auto', Icon: Zap },
                { id: 'birefnet-lite', label: 'Alta', Icon: Star },
              ].map(opt => {
                const active = (plateOptions.engine ?? 'birefnet-lite') === opt.id
                return (
                  <button key={opt.id}
                    onClick={() => onPlateOptions({ ...plateOptions, engine: opt.id })}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                      ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    <opt.Icon size={11} /> {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Archivos rechazados */}
      {rejected?.length > 0 && (
        <div className="flex gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700">
            <span className="font-semibold">{rejected.length} archivo{rejected.length !== 1 ? 's' : ''} no compatible{rejected.length !== 1 ? 's' : ''}</span>
            {' '}— solo JPG, PNG y WEBP
          </p>
        </div>
      )}

      {/* ── Barra fija inferior ── */}
      {images.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 pt-3 pb-4">
          <div className="max-w-2xl mx-auto">
            <button onClick={onNext}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm
                flex items-center justify-center gap-2 transition-colors active:scale-[0.99]">
              <Images size={16} />
              Procesar {exterior.length} foto{exterior.length !== 1 ? 's' : ''} →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
