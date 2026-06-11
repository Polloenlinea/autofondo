import { useState, useEffect, useCallback } from 'react'
import {
  X, RotateCw, RefreshCw, Download, Sun, Contrast,
  ChevronLeft, ChevronRight, Car, Armchair, Scissors, Zap, AlertTriangle
} from 'lucide-react'
import { Btn, Slider, Spinner } from './ui'
import MaskEditor from './MaskEditor'

/**
 * Modal de edición individual
 * Pestañas: Ajustes | Máscara
 */
export default function EditModal({ img, images, effectiveType, onClose, onApply, onReprocess, onToggleType }) {
  const [tab,           setTab]          = useState('adjust') // 'adjust' | 'mask'
  const [brightness,    setBrightness]   = useState(img.adjustments?.brightness ?? 1)
  const [contrast,      setContrast]     = useState(img.adjustments?.contrast   ?? 1)
  const [rotation,      setRotation]     = useState(img.adjustments?.rotation   ?? 0)
  const [applying,      setApplying]     = useState(false)
  const [bgMode,        setBgMode]       = useState('checker')
  const [confirmHQ,     setConfirmHQ]    = useState(false) // mostrar aviso antes de reprocesar con large

  const currentIdx = images.findIndex(i => i.id === img.id)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < images.length - 1

  useEffect(() => {
    setBrightness(img.adjustments?.brightness ?? 1)
    setContrast(img.adjustments?.contrast     ?? 1)
    setRotation(img.adjustments?.rotation     ?? 0)
    setTab('adjust')
  }, [img.id])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isDirty = brightness !== (img.adjustments?.brightness ?? 1)
    || contrast !== (img.adjustments?.contrast ?? 1)
    || rotation !== (img.adjustments?.rotation ?? 0)

  const handleApply = async () => {
    setApplying(true)
    await onApply(img.id, { brightness, contrast, rotation })
    setApplying(false)
  }

  const handleReset = () => { setBrightness(1); setContrast(1); setRotation(0) }
  const handleRotate = () => setRotation(r => (r + 90) % 360)

  // Guardar máscara editada (viene como b64 desde MaskEditor)
  const handleMaskSave = useCallback(async (newB64) => {
    setApplying(true)
    await onApply(img.id, { brightness, contrast, rotation, _maskB64: newB64 })
    setApplying(false)
    setTab('adjust')
  }, [img.id, brightness, contrast, rotation, onApply])

  const type = effectiveType(img)
  const previewFilter = `brightness(${brightness}) contrast(${contrast})`
  const previewTransform = rotation ? `rotate(${rotation}deg)` : undefined
  const bgClass = bgMode === 'checker' ? 'checker' : bgMode === 'white' ? 'bg-white' : 'bg-slate-900'
  const resultB64 = img.cutoutB64

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl overflow-hidden shadow-2xl flex flex-col"
          style={{ height: tab === 'mask' ? 'min(92vh, 780px)' : 'auto', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1">
              <button onClick={() => canPrev && onClose('prev')} disabled={!canPrev}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400
                  hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-slate-400 tabular-nums">
                {currentIdx + 1}/{images.length}
              </span>
              <button onClick={() => canNext && onClose('next')} disabled={!canNext}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400
                  hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="text-sm font-semibold text-slate-700 truncate">{img.file.name}</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400
              hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ── */}
        {resultB64 && (
          <div className="flex border-b border-slate-100 flex-shrink-0">
            {[
              { id: 'adjust', label: 'Ajustes' },
              { id: 'mask',   label: 'Editar máscara', icon: <Scissors size={12} /> },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors
                  ${tab === t.id
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab: Máscara ── */}
        {tab === 'mask' && resultB64 ? (
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MaskEditor
              cutoutB64={resultB64}
              originalUrl={img.previewUrl}
              onSave={handleMaskSave}
              onCancel={() => setTab('adjust')}
            />
          </div>
        ) : (
          /* ── Tab: Ajustes ── */
          <div className="overflow-y-auto flex-1">

            {/* Imágenes */}
            <div className="grid grid-cols-2 gap-3 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Original</p>
                <div className="rounded-lg overflow-hidden bg-slate-100 aspect-square flex items-center justify-center">
                  <img src={img.previewUrl} className="w-full h-full object-contain" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Resultado</p>
                  <div className="flex gap-1">
                    {[['checker','▦'],['white','□'],['dark','■']].map(([m, icon]) => (
                      <button key={m} onClick={() => setBgMode(m)}
                        className={`w-5 h-5 rounded text-[11px] flex items-center justify-center transition-colors
                          ${bgMode === m ? 'bg-blue-700 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`rounded-lg overflow-hidden aspect-square flex items-center justify-center ${bgClass}`}>
                  {img.status === 'processing'
                    ? <Spinner size="md" color="text-blue-700" />
                    : resultB64
                      ? <img
                          src={`data:image/png;base64,${resultB64}`}
                          className="w-full h-full object-contain transition-all duration-150"
                          style={{ filter: previewFilter, transform: previewTransform }}
                        />
                      : <div className="text-xs text-slate-400 text-center p-4">
                          {img.status === 'error' ? img.error : 'Sin resultado'}
                        </div>
                  }
                </div>
              </div>
            </div>

            <div className="px-4 pb-4 space-y-5">

              {/* Clasificación */}
              <div className="flex items-center justify-between py-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {type === 'exterior'
                    ? <Car size={14} className="text-blue-700" strokeWidth={2} />
                    : <Armchair size={14} className="text-slate-500" strokeWidth={2} />}
                  <span className="text-sm font-medium text-slate-700">
                    {type === 'exterior' ? 'Exterior — se recorta el fondo' : 'Interior — sin recorte'}
                  </span>
                </div>
                <button onClick={() => onToggleType(img.id)}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 underline underline-offset-2">
                  cambiar
                </button>
              </div>

              {/* Ajustes de imagen */}
              {resultB64 && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Ajustes</p>
                    {isDirty && (
                      <button onClick={handleReset}
                        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                        <RefreshCw size={11} /> Restablecer
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Sun size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1">
                        <Slider label="Brillo" value={Math.round((brightness-0.5)*100)}
                          min={-50} max={50} unit=""
                          onChange={v => setBrightness(+(0.5+v/100).toFixed(2))} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
                        {brightness>1?'+':''}{Math.round((brightness-1)*100)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Contrast size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1">
                        <Slider label="Contraste" value={Math.round((contrast-0.5)*100)}
                          min={-50} max={50} unit=""
                          onChange={v => setContrast(+(0.5+v/100).toFixed(2))} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
                        {contrast>1?'+':''}{Math.round((contrast-1)*100)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={handleRotate}
                      className="flex items-center gap-2 text-sm font-medium text-slate-600
                        hover:text-blue-700 bg-slate-50 hover:bg-blue-50 px-3 py-2 rounded-lg
                        transition-colors border border-slate-200">
                      <RotateCw size={14} /> Rotar 90°
                    </button>
                    {rotation !== 0 && <span className="text-xs text-slate-400">{rotation}° aplicado</span>}
                  </div>
                </div>
              )}

              {/* Re-procesar con modelo large */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Corrección IA</p>

                {!confirmHQ ? (
                  <>
                    <button onClick={() => setConfirmHQ(true)}
                      disabled={img.status === 'processing'}
                      className="flex items-center gap-2 text-sm font-medium text-slate-600
                        hover:text-blue-700 bg-slate-50 hover:bg-blue-50 px-3 py-2 rounded-lg
                        transition-colors border border-slate-200 disabled:opacity-40">
                      <Zap size={14} /> Reprocesar en alta calidad
                    </button>
                    <p className="text-xs text-slate-400 mt-1.5">
                      Usa el modelo más preciso para bordes difíciles
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2.5">
                    <div className="flex gap-2">
                      <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-800">¿Confirmar reprocesado?</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          El modelo de alta calidad puede tardar <strong>hasta 60 segundos</strong> y
                          consume significativamente más recursos del servidor. Usalo solo cuando el
                          recorte estándar no haya quedado bien.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmHQ(false)}
                        className="flex-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200
                          px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          setConfirmHQ(false)
                          onReprocess(img.id, { model: 'large' })
                          onClose()
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold
                          text-white bg-amber-600 hover:bg-amber-700 px-3 py-2 rounded-lg transition-colors">
                        <Zap size={12} /> Sí, reprocesar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer — solo en tab ajustes ── */}
        {tab === 'adjust' && (
          <div className="border-t border-slate-100 px-4 py-3 flex gap-2 flex-shrink-0">
            {resultB64 && (
              <a href={`data:image/png;base64,${resultB64}`}
                download={img.file.name.replace(/\.[^.]+$/,'')+'.png'}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200
                  text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <Download size={14} /> PNG
              </a>
            )}
            <Btn variant="secondary" onClick={onClose} className="flex-shrink-0">Cerrar</Btn>
            {isDirty && resultB64 && (
              <Btn variant="primary" size="full" onClick={handleApply} disabled={applying}>
                {applying ? <><Spinner size="sm" /> Aplicando…</> : 'Aplicar ajustes'}
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
