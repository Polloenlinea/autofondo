import { useRef, useEffect, useState, useCallback } from 'react'
import { X, RotateCcw, AlertCircle, Settings2, ChevronDown, ChevronUp, Sun, Contrast, Car } from 'lucide-react'
import ImageCard from '../components/ImageCard'
import CarSelector from '../components/CarSelector'
import { Btn, Slider, Spinner, Card } from '../components/ui'

const OUTPUT_SIZES = [
  { id: 'original', label: 'Original', px: 0    },
  { id: 'large',    label: '2000 px',  px: 2000 },
  { id: 'medium',   label: '1200 px',  px: 1200 },
  { id: 'web',      label: '800 px',   px: 800  },
]

export default function StepReview({
  images, effectiveType, toggleType,
  processAll, reprocess, applyAdjustments, applyBlobSelection, removeImage,
  stats, plateOptions,
  onEdit, onZoom,
  onNext, onBack,
}) {
  const stopRef  = useRef(false)
  const ranRef   = useRef(false)

  const [blobImg,       setBlobImg]       = useState(null)
  const [outputSize,    setOutputSize]    = useState('original')
  const [showBatch,     setShowBatch]     = useState(false)

  const [batchBrightness, setBatchBrightness] = useState(1)
  const [batchContrast,   setBatchContrast]   = useState(1)
  const [batchApplying,   setBatchApplying]   = useState(false)
  const [batchProgress,   setBatchProgress]   = useState(0)

  const isRunning  = stats.processing > 0
  const allDone    = images.length > 0 && images.every(i => ['done','error','skipped'].includes(i.status))
  const progress   = stats.total
    ? Math.round(((stats.done + stats.error + stats.interior) / stats.total) * 100)
    : 0
  const canContinue = allDone && stats.done > 0

  useEffect(() => {
    if (!ranRef.current) {
      ranRef.current = true
      stopRef.current = false
      processAll(stopRef, plateOptions)
    }
  }, [])

  const applyBatchAdjustments = useCallback(async () => {
    const targets = images.filter(i => i.status === 'done' && i.cutoutB64)
    if (!targets.length) return
    setBatchApplying(true)
    setBatchProgress(0)
    let done = 0
    for (const img of targets) {
      try {
        await applyAdjustments(img.id, { brightness: batchBrightness, contrast: batchContrast, rotation: 0 })
      } catch { /* continuar */ }
      done++
      setBatchProgress(Math.round(done / targets.length * 100))
    }
    setBatchApplying(false)
  }, [images, applyAdjustments, batchBrightness, batchContrast])

  const doneDone  = images.filter(i => i.status === 'done').length
  const batchDirty = batchBrightness !== 1 || batchContrast !== 1 || outputSize !== 'original'

  return (
    <div className="space-y-4 pb-28">

      {/* ── Barra de progreso ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">
            {isRunning
              ? 'Eliminando fondos…'
              : allDone
                ? `Completado — ${stats.done} procesada${stats.done !== 1 ? 's' : ''}`
                : 'Listo para procesar'}
          </p>
          <span className="text-sm font-semibold text-blue-700 tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-700 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
        {stats.error > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <AlertCircle size={12} className="text-red-500" />
            <span className="text-xs text-red-500 font-medium">{stats.error} con error</span>
          </div>
        )}
      </Card>

      {/* ── Chips de estado ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {stats.done > 0 && (
          <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
            {stats.done} recortadas
          </div>
        )}
        {stats.interior > 0 && (
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
            {stats.interior} sin recorte
          </div>
        )}
        {stats.error > 0 && (
          <div className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-md">
            {stats.error} con error
          </div>
        )}
        <div className="ml-auto">
          <span className="text-xs text-slate-400 font-medium">
            Salida: {OUTPUT_SIZES.find(s => s.id === outputSize)?.label}
          </span>
        </div>
      </div>

      {/* ── Panel de ajustes batch ── */}
      {allDone && doneDone > 1 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowBatch(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <Settings2 size={14} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Ajustes para todas las fotos</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{doneDone} imágenes</span>
            </div>
            {showBatch ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </button>

          {showBatch && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Se aplica a <strong>todas</strong> las imágenes recortadas a la vez.
              </p>

              {/* Tamaño de salida */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Resolución de salida</p>
                <div className="grid grid-cols-4 sm:flex bg-slate-100 p-0.5 rounded-lg gap-0.5 sm:w-fit">
                  {OUTPUT_SIZES.map(s => (
                    <button key={s.id} onClick={() => setOutputSize(s.id)}
                      className={`px-2 sm:px-3 py-2.5 sm:py-1.5 text-[11px] font-semibold rounded-md transition-all min-h-[40px] sm:min-h-0
                        ${outputSize === s.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brillo — neutro en 0, rango -100..+100 */}
              <div className="flex items-center gap-3">
                <Sun size={14} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Slider label="Brillo global" value={Math.round((batchBrightness-1)*100)}
                    min={-100} max={100} unit=""
                    onChange={v => setBatchBrightness(+(1+v/100).toFixed(2))} />
                </div>
                <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
                  {batchBrightness > 1 ? '+' : ''}{Math.round((batchBrightness-1)*100)}
                </span>
              </div>

              {/* Contraste */}
              <div className="flex items-center gap-3">
                <Contrast size={14} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Slider label="Contraste global" value={Math.round((batchContrast-1)*100)}
                    min={-100} max={100} unit=""
                    onChange={v => setBatchContrast(+(1+v/100).toFixed(2))} />
                </div>
                <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
                  {batchContrast > 1 ? '+' : ''}{Math.round((batchContrast-1)*100)}
                </span>
              </div>

              {batchApplying && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500">Aplicando…</span>
                    <span className="text-xs font-semibold text-blue-700">{batchProgress}%</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-700 rounded-full transition-all"
                      style={{ width: `${batchProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Btn variant="secondary" onClick={() => { setBatchBrightness(1); setBatchContrast(1) }}>
                  Restablecer
                </Btn>
                <Btn variant="primary" size="full"
                  onClick={applyBatchAdjustments}
                  disabled={!batchDirty || batchApplying}>
                  {batchApplying ? <><Spinner size="sm" />Aplicando…</> : `Aplicar a ${doneDone} imágenes`}
                </Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Tip ── */}
      {allDone && stats.done > 0 && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
          <Settings2 size={13} className="text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-500">
            Tocá <strong>Editar</strong> en cualquier imagen para ajustar brillo, contraste, rotar o editar el recorte.
            Tocá la imagen para ampliarla.
          </p>
        </div>
      )}

      {/* ── Aviso múltiples autos ── */}
      {images.some(i => i.blobs?.length > 0) && (
        <div className="flex gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Car size={15} className="text-blue-600 mt-0.5 flex-shrink-0" strokeWidth={2} />
          <p className="text-xs text-blue-700 leading-relaxed">
            Se detectaron <strong>múltiples autos</strong> en algunas imágenes.
            Tocá el botón <strong>"Seleccionar auto"</strong> en la imagen para elegir cuál conservar.
          </p>
        </div>
      )}

      {/* ── Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map(img => (
          <div key={img.id} className="relative">
            <ImageCard
              img={img}
              effectiveType={effectiveType}
              onToggleType={() => toggleType(img.id)}
              onZoom={onZoom}
              onEdit={onEdit}
              onRemove={() => removeImage(img.id)}
              showResult
            />
            {img.blobs?.length > 0 && img.status === 'done' && (
              <button
                onClick={() => setBlobImg(img)}
                className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1
                  bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-bold min-h-[36px]
                  px-2 py-2 rounded-md shadow-lg transition-colors z-10">
                <Car size={10} /> {img.blobs.length + 1} autos — seleccionar
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Modal selección de auto ── */}
      {blobImg && (
        <CarSelector
          cutoutB64={blobImg.cutoutB64}
          blobs={blobImg.blobs}
          onSelect={(newB64) => { applyBlobSelection(blobImg.id, newB64); setBlobImg(null) }}
          onCancel={() => setBlobImg(null)}
        />
      )}

      {/* ── Barra de acciones fija ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Btn variant="secondary" onClick={onBack}>Atrás</Btn>

          {isRunning && (
            <Btn variant="secondary" onClick={() => { stopRef.current = true }}>
              <X size={14} /> Detener
            </Btn>
          )}
          {!isRunning && stats.error > 0 && (
            <Btn variant="secondary" onClick={() => { stopRef.current = false; processAll(stopRef, plateOptions) }}>
              <RotateCcw size={14} /> Reintentar
            </Btn>
          )}

          <Btn variant="primary" size="full" disabled={!canContinue} onClick={() => onNext(outputSize)}>
            {canContinue ? 'Siguiente: elegir fondos →' : <><Spinner size="sm" /> Procesando…</>}
          </Btn>
        </div>
      </div>
    </div>
  )
}
