import { useState, useRef, useEffect } from 'react'
import { Camera, Images, Plus, Scissors, EyeOff, Info, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import ImageCard from '../components/ImageCard'
import { Btn } from '../components/ui'

export default function StepUpload({ images, rejected, addFiles, toggleType, effectiveType, removeImage, onZoom, onNext, stats, plateOptions, onPlateOptions }) {
  const [dragging,  setDragging]  = useState(false)
  const [plateOpen, setPlateOpen] = useState(false)
  const inputRef  = useRef()
  const cameraRef = useRef()

  const canContinue = images.length > 0

  // ── Drag & drop global (desktop) ──────────────────────────────────────────
  useEffect(() => {
    const over  = e => { e.preventDefault(); setDragging(true) }
    const leave = e => { if (!e.relatedTarget) setDragging(false) }
    const drop  = e => {
      e.preventDefault(); setDragging(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragover',  over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop',      drop)
    return () => {
      window.removeEventListener('dragover',  over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop',      drop)
    }
  }, [addFiles])

  return (
    <div className="space-y-4 pb-32">

      {/* ── Inputs ocultos ── */}
      {/* Galería / archivos */}
      <input ref={inputRef} type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        multiple className="hidden"
        onChange={e => addFiles(e.target.files)} />
      {/* Cámara directa (solo mobile) */}
      <input ref={cameraRef} type="file"
        accept="image/*" capture="environment"
        className="hidden"
        onChange={e => addFiles(e.target.files)} />

      {images.length === 0 ? (<>

        {/* ══ MOBILE: botones grandes Cámara + Galería ══ */}
        <div className={`sm:hidden rounded-2xl border-2 border-dashed transition-all
          ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
          {dragging ? (
            <div className="py-14 flex flex-col items-center gap-3">
              <Images size={44} className="text-blue-500" strokeWidth={1.5} />
              <p className="text-lg font-bold text-blue-700">Soltá las imágenes aquí</p>
            </div>
          ) : (
            <div className="p-5 flex flex-col items-center gap-4">
              <p className="text-base font-semibold text-slate-600 text-center">
                ¿Cómo querés cargar las fotos?
              </p>
              <div className="w-full grid grid-cols-2 gap-3">
                <button onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 py-8 px-4
                    bg-blue-700 text-white rounded-2xl active:scale-95 transition-all hover:bg-blue-800">
                  <Camera size={36} strokeWidth={1.5} />
                  <div className="text-center">
                    <p className="font-bold text-base leading-tight">Cámara</p>
                    <p className="text-xs text-blue-200 mt-0.5">Sacar foto ahora</p>
                  </div>
                </button>
                <button onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 py-8 px-4
                    bg-slate-100 text-slate-700 rounded-2xl active:scale-95 transition-all
                    hover:bg-slate-200 border border-slate-200">
                  <Images size={36} strokeWidth={1.5} className="text-slate-500" />
                  <div className="text-center">
                    <p className="font-bold text-base leading-tight">Galería</p>
                    <p className="text-xs text-slate-400 mt-0.5">Elegir del celular</p>
                  </div>
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center">JPG · PNG · WEBP</p>
            </div>
          )}
        </div>

        {/* ══ DESKTOP: drag & drop clásico ══ */}
        <div
          onClick={() => inputRef.current?.click()}
          className={`hidden sm:flex cursor-pointer rounded-2xl border-2 border-dashed transition-all
            flex-col items-center justify-center text-center
            ${dragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-blue-400 py-16 px-8'
            }`}>
          {dragging ? (
            <div className="py-14 flex flex-col items-center gap-3">
              <Images size={48} className="text-blue-500" strokeWidth={1.5} />
              <p className="text-xl font-bold text-blue-700">Soltá las imágenes aquí</p>
            </div>
          ) : (
            <>
              <Images size={48} className="text-slate-300 mb-4" strokeWidth={1.5} />
              <p className="text-xl font-semibold text-slate-700 mb-1">
                Arrastrá las imágenes aquí
              </p>
              <p className="text-sm text-slate-400 mb-8">
                JPG · PNG · WEBP — múltiples archivos a la vez
              </p>
              <button
                onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
                className="px-6 py-3 bg-blue-700 text-white rounded-xl font-semibold
                  text-sm hover:bg-blue-800 transition-colors">
                Seleccionar archivos
              </button>
            </>
          )}
        </div>

      </>) : (
        /* ── Ya hay imágenes: zona compacta para agregar más ── */
        <div className={`rounded-2xl border-2 border-dashed transition-all
          ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Cámara — solo mobile */}
            <button
              onClick={() => cameraRef.current?.click()}
              className="sm:hidden flex items-center gap-2 px-4 py-3 bg-blue-700 text-white
                rounded-xl text-sm font-semibold active:scale-95 transition-all hover:bg-blue-800 min-h-[48px]">
              <Camera size={18} />
              <span>Cámara</span>
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700
                rounded-xl text-sm font-semibold active:scale-95 transition-all hover:bg-slate-200 min-h-[48px]">
              <Plus size={18} />
              <span className="sm:hidden">Galería</span>
              <span className="hidden sm:inline">Agregar imágenes</span>
            </button>
            <span className="text-xs text-slate-400 ml-auto">
              {stats.total} imagen{stats.total !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── Motor de recorte (calidad) ── */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-blue-700" />
          <span className="text-sm font-semibold text-slate-700">Calidad del recorte</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'imgly',         label: 'Rápido',  sub: '~2s' },
            { id: 'birefnet-lite', label: 'Calidad', sub: '~9s' },
          ].map(opt => {
            const active = (plateOptions.engine ?? 'birefnet-lite') === opt.id
            return (
              <button key={opt.id}
                onClick={() => onPlateOptions({ ...plateOptions, engine: opt.id })}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl border-2 transition-all min-h-[52px]
                  ${active
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-[10px] opacity-70">{opt.sub}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-500">Calidad</span> usa IA de mejor recorte (bordes, ruedas, vidrios) — tarda un poco más pero queda mucho más prolijo. Recomendado.
        </p>
      </div>

      {/* ── Opciones de matrícula ── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setPlateOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors min-h-[56px]">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className={plateOptions.hidePlate ? 'text-blue-700' : 'text-slate-400'} />
            <span className="text-sm font-semibold text-slate-700">Tapar matrícula</span>
            {plateOptions.hidePlate && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
                Activo
              </span>
            )}
          </div>
          {plateOpen
            ? <ChevronUp size={18} className="text-slate-400" />
            : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {plateOpen && (
          <div className="px-4 pb-5 border-t border-slate-100 pt-4 space-y-4">
            <p className="text-sm text-slate-500">
              Detecta y tapa automáticamente la matrícula al quitar el fondo.
            </p>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input type="checkbox" className="sr-only peer"
                  checked={plateOptions.hidePlate}
                  onChange={e => onPlateOptions({ ...plateOptions, hidePlate: e.target.checked })} />
                <div className="w-12 h-7 bg-slate-200 rounded-full peer-checked:bg-blue-700
                  after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white
                  after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Tapar matrícula automáticamente</p>
                <p className="text-xs text-slate-400 mt-0.5">Se cubre con un rectángulo negro</p>
              </div>
            </label>

            {plateOptions.hidePlate && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                <span className="inline-block w-10 h-3.5 rounded bg-black opacity-80 flex-shrink-0" />
                <p className="text-xs text-slate-500">Se tapa con un rectángulo negro</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Archivos rechazados ── */}
      {rejected?.length > 0 && (
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3.5">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 mb-1">
              {rejected.length} archivo{rejected.length !== 1 ? 's' : ''} no compatible{rejected.length !== 1 ? 's' : ''} — solo JPG, PNG y WEBP
            </p>
            <p className="text-xs text-red-500 leading-relaxed">{rejected.join(' · ')}</p>
          </div>
        </div>
      )}

      {/* ── Grid de imágenes ── */}
      {images.length > 0 && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg">
              <Scissors size={12} strokeWidth={2} /> {stats.exterior} con recorte
            </div>
            {stats.interior > 0 && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                <EyeOff size={12} strokeWidth={2} /> {stats.interior} sin recorte
              </div>
            )}
          </div>

          <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
            <Info size={16} className="text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
            <p className="text-sm text-slate-500 leading-relaxed">
              Se quitará el fondo a todas las fotos. Si alguna es interior, tocá <span className="font-semibold text-slate-700">No quitar fondo</span> en esa imagen.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map(img => (
              <ImageCard
                key={img.id}
                img={img}
                effectiveType={effectiveType}
                onToggleType={() => toggleType(img.id)}
                onRemove={() => removeImage(img.id)}
                onZoom={onZoom}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Sticky bottom bar ── */}
      {images.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm
          border-t border-slate-200 px-4 py-4 pb-safe">
          <div className="max-w-2xl mx-auto">
            <Btn variant="primary" size="full" onClick={onNext} disabled={!canContinue}>
              Siguiente: procesar {stats.exterior} imagen{stats.exterior !== 1 ? 'es' : ''} →
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
