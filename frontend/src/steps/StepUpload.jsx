import { useState, useRef, useEffect } from 'react'
import { UploadCloud, Plus, Car, Armchair, Info, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, ImagePlus, X } from 'lucide-react'
import ImageCard from '../components/ImageCard'
import { Btn, Badge, Spinner } from '../components/ui'

export default function StepUpload({ images, rejected, addFiles, toggleType, effectiveType, removeImage, onNext, stats, plateOptions, onPlateOptions }) {
  const [dragging,       setDragging]       = useState(false)
  const [plateOpen,      setPlateOpen]      = useState(false)
  const [plateLogoPreview, setPlateLogoPreview] = useState(null)
  const inputRef      = useRef()
  const plateLogoRef  = useRef()

  const detecting = images.some(i => i.detectedType === 'detecting')
  const canContinue = images.length > 0 && !detecting

  // ── Drag & drop global ────────────────────────────────────────────────────
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
    <div className="space-y-4 pb-24">

      {/* ── Drop zone ── */}
      <div
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed transition-all
          flex flex-col items-center justify-center text-center
          ${dragging
            ? 'border-blue-600 bg-blue-50'
            : images.length > 0
              ? 'border-slate-200 bg-white hover:border-slate-300 py-5'
              : 'border-slate-300 bg-white hover:border-blue-400 py-16 px-8'
          }`}
      >
        <input ref={inputRef} type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple className="hidden"
          onChange={e => addFiles(e.target.files)} />

        {dragging ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <UploadCloud size={40} className="text-blue-600" strokeWidth={1.5} />
            <p className="text-base font-semibold text-blue-700">Soltá las imágenes aquí</p>
          </div>
        ) : images.length > 0 ? (
          <div className="flex items-center gap-2.5 px-4 py-3 text-slate-500">
            <Plus size={16} strokeWidth={2} />
            <span className="text-sm font-medium">Agregar más imágenes</span>
          </div>
        ) : (
          <>
            <UploadCloud size={44} className="text-slate-300 mb-4" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-slate-700 mb-1">
              Arrastrá las imágenes aquí
            </p>
            <p className="text-sm text-slate-400 mb-7">
              JPG · PNG · WEBP — múltiples archivos a la vez
            </p>
            <Btn variant="primary" className="pointer-events-none">
              Seleccionar archivos
            </Btn>
          </>
        )}
      </div>

      {/* ── Opciones de procesamiento ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setPlateOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={15} className={plateOptions.hidePlate ? 'text-blue-700' : 'text-slate-400'} />
            <span className="text-sm font-semibold text-slate-700">Opciones de matrícula</span>
            {plateOptions.hidePlate && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                Activo
              </span>
            )}
          </div>
          {plateOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>

        {plateOpen && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
            <p className="text-xs text-slate-500">
              Detecta y oculta automáticamente la matrícula al quitar el fondo.
            </p>

            {/* Toggle ocultar matrícula */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input type="checkbox" className="sr-only peer"
                  checked={plateOptions.hidePlate}
                  onChange={e => onPlateOptions({ ...plateOptions, hidePlate: e.target.checked })} />
                <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-blue-700
                  after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white
                  after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Ocultar matrícula automáticamente</p>
                <p className="text-xs text-slate-400">Se detecta la chapa y se tapa con negro o tu logo</p>
              </div>
            </label>

            {/* Opciones de logo (solo cuando hidePlate=true) */}
            {plateOptions.hidePlate && (
              <div className="pl-13 space-y-2 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-[52px]">Reemplazar con</p>
                <div className="ml-[52px] space-y-2">
                  {/* Opción: chapa negra */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="radio" name="plateMode"
                      checked={!plateOptions.plateLogoFile}
                      onChange={() => {
                        onPlateOptions({ ...plateOptions, plateLogoFile: null })
                        setPlateLogoPreview(null)
                      }}
                      className="accent-blue-700" />
                    <span className="text-sm text-slate-700">Chapa negra</span>
                    <span className="inline-block w-12 h-4 rounded bg-black opacity-80" />
                  </label>

                  {/* Opción: logo del dealer */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="radio" name="plateMode"
                      checked={!!plateOptions.plateLogoFile}
                      onChange={() => plateLogoRef.current?.click()}
                      className="accent-blue-700" />
                    <span className="text-sm text-slate-700">Logo de mi automotora</span>
                  </label>

                  {/* Input oculto para el logo */}
                  <input ref={plateLogoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files[0]
                      if (!f) return
                      onPlateOptions({ ...plateOptions, plateLogoFile: f })
                      const url = URL.createObjectURL(f)
                      setPlateLogoPreview(url)
                    }} />

                  {/* Preview del logo cargado */}
                  {plateLogoPreview && (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 w-fit">
                      <img src={plateLogoPreview} className="h-7 max-w-[80px] object-contain" alt="Logo" />
                      <button
                        onClick={() => {
                          onPlateOptions({ ...plateOptions, plateLogoFile: null })
                          setPlateLogoPreview(null)
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X size={11} />
                      </button>
                    </div>
                  )}

                  {plateOptions.plateLogoFile && !plateLogoPreview && (
                    <button onClick={() => plateLogoRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs text-blue-700 hover:underline">
                      <ImagePlus size={12} /> Cargar logo
                    </button>
                  )}
                  {!plateOptions.plateLogoFile && plateOptions.hidePlate && (
                    <button onClick={() => plateLogoRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-700 transition-colors">
                      <ImagePlus size={12} /> Cargar logo para usar en las chapas
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Archivos rechazados ── */}
      {rejected?.length > 0 && (
        <div className="flex gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-700 mb-1">
              {rejected.length} archivo{rejected.length !== 1 ? 's' : ''} no compatible{rejected.length !== 1 ? 's' : ''} — solo se aceptan JPG, PNG y WEBP
            </p>
            <p className="text-[11px] text-red-500 leading-relaxed">
              {rejected.join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {images.length > 0 && (
        <>
          {/* Counters */}
          <div className="flex items-center gap-2 flex-wrap">
            {detecting
              ? <><Spinner size="xs" color="text-slate-400" /><span className="text-xs text-slate-500">Analizando imágenes…</span></>
              : <>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                    <Car size={11} strokeWidth={2} /> {stats.exterior} exteriores
                  </div>
                  {stats.interior > 0 && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                      <Armchair size={11} strokeWidth={2} /> {stats.interior} interiores
                    </div>
                  )}
                </>
            }
            <span className="text-xs text-slate-400 ml-auto">{stats.total} imagen{stats.total !== 1 ? 'es' : ''}</span>
          </div>

          {/* Info interiores */}
          {!detecting && stats.interior > 0 && (
            <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Info size={15} className="text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
              <p className="text-xs text-slate-500 leading-relaxed">
                Las imágenes de <span className="font-semibold text-slate-700">interior</span> (tablero, asientos, cuentakilómetros) no se recortan.
                Si alguna está mal clasificada, tocá <span className="font-semibold">cambiar</span>.
              </p>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map(img => (
              <ImageCard
                key={img.id}
                img={img}
                effectiveType={effectiveType}
                onToggleType={() => toggleType(img.id)}
                onRemove={() => removeImage(img.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Sticky bar ── */}
      {images.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200
          px-4 py-3 pb-safe">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Btn variant="secondary" onClick={() => inputRef.current?.click()}>
              <Plus size={15} /> Agregar
            </Btn>
            <Btn variant="primary" size="full" onClick={onNext} disabled={!canContinue}>
              {detecting
                ? <><Spinner size="sm" /> Analizando…</>
                : `Continuar — procesar ${stats.exterior} imagen${stats.exterior !== 1 ? 'es' : ''}`
              }
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
