import { useState, useEffect, useCallback } from 'react'
import {
  X, RotateCw, RefreshCw, Download, Sun, Contrast,
  ChevronLeft, ChevronRight, Scissors,
  LogOut, ImagePlus, Layers,
} from 'lucide-react'
import { Btn, Slider, Toggle, Spinner, SectionLabel } from './ui'
import MaskEditor from './MaskEditor'
import { BG_PRESETS } from '../constants/bgPresets'

/**
 * Modal de edición individual — disponible en todos los pasos.
 *
 * context: 'review' | 'background' | 'export'
 *   'review'             → tabs: Ajustes · Recorte
 *   'background'|'export'→ tabs: Ajustes · Recorte · Fondo
 *
 * onRecompose(id, bgConfig, cutoutB64Override?) — recompone con nuevos ajustes
 */
export default function EditModal({
  img, images, effectiveType,
  context = 'review',
  onClose, onApply, onReprocess, onToggleType, onRecompose,
}) {
  const canEditBg = context !== 'review'

  // ── Ajustes (tab adjust) ──────────────────────────────────────────────────
  const [tab,          setTab]         = useState('adjust')
  const [brightness,   setBrightness]  = useState(img.adjustments?.brightness ?? 1)
  const [contrast,     setContrast]    = useState(img.adjustments?.contrast   ?? 1)
  const [rotation,     setRotation]    = useState(img.adjustments?.rotation   ?? 0)
  const [applying,     setApplying]    = useState(false)
  const [bgMode,       setBgMode]      = useState('checker')
  const [maskDirty,    setMaskDirty]   = useState(false)
  const [confirmExit,  setConfirmExit] = useState(false)

  // ── Fondo (tab bg) ────────────────────────────────────────────────────────
  const [bgPreset,    setBgPreset]   = useState(img.bgSettings?.preset  ?? 'gray')
  const [bgFile,      setBgFile]     = useState(img.bgSettings?.bgFile  ?? null)
  const [bgFileUrl,   setBgFileUrl]  = useState(img.bgSettings?.bgFile ? URL.createObjectURL(img.bgSettings.bgFile) : null)
  const [bgScale,     setBgScale]    = useState(img.bgSettings?.scale   ?? 80)
  const [bgPosX,      setBgPosX]     = useState(img.bgSettings?.posX    ?? 50)
  const [bgPosY,      setBgPosY]     = useState(img.bgSettings?.posY    ?? 60)
  const [bgShadow,     setBgShadow]     = useState(img.bgSettings?.shadow     ?? true)
  const [bgShadowInt,     setBgShadowInt]     = useState(img.bgSettings?.shadowIntensity     ?? 100)
  const [bgApplying,  setBgApplying] = useState(false)

  const currentIdx = images.findIndex(i => i.id === img.id)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < images.length - 1

  // Resetear al cambiar de imagen
  useEffect(() => {
    setBrightness(img.adjustments?.brightness ?? 1)
    setContrast(img.adjustments?.contrast     ?? 1)
    setRotation(img.adjustments?.rotation     ?? 0)
    setTab('adjust')
    setMaskDirty(false)
    setConfirmExit(false)
    setBgPreset(img.bgSettings?.preset ?? 'gray')
    setBgFile(img.bgSettings?.bgFile   ?? null)
    setBgFileUrl(img.bgSettings?.bgFile ? URL.createObjectURL(img.bgSettings.bgFile) : null)
    setBgScale(img.bgSettings?.scale   ?? 80)
    setBgPosX(img.bgSettings?.posX     ?? 50)
    setBgPosY(img.bgSettings?.posY     ?? 60)
    setBgShadow(img.bgSettings?.shadow ?? true)
    setBgShadowInt(img.bgSettings?.shadowIntensity ?? 100)
  }, [img.id])

  const handleAttemptClose = useCallback((arg) => {
    if (tab === 'mask' && maskDirty) {
      setConfirmExit(true)
    } else {
      onClose(arg)
    }
  }, [tab, maskDirty, onClose])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleAttemptClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleAttemptClose])

  const isDirty = brightness !== (img.adjustments?.brightness ?? 1)
    || contrast !== (img.adjustments?.contrast ?? 1)
    || rotation !== (img.adjustments?.rotation ?? 0)

  // Aplicar ajustes y, si estamos en contexto bg, recomponer
  const handleApply = async () => {
    setApplying(true)
    const newCutout = await onApply(img.id, { brightness, contrast, rotation })
    setApplying(false)
    if (canEditBg && img.bgSettings && onRecompose && newCutout) {
      await onRecompose(img.id, img.bgSettings, newCutout)
    }
  }

  const handleReset  = () => { setBrightness(1); setContrast(1); setRotation(0) }
  // Normaliza a (-180, 180] para que el slider y el botón de 90° queden sincronizados
  const normDeg = (d) => { const r = (((d + 180) % 360) + 360) % 360 - 180; return r === -180 ? 180 : r }
  const handleRotate = () => setRotation(r => normDeg(r + 90))

  const handleMaskSave = useCallback(async (newB64) => {
    setApplying(true)
    const newCutout = await onApply(img.id, { brightness, contrast, rotation, _maskB64: newB64 })
    setApplying(false)
    setMaskDirty(false)
    setTab('adjust')
    if (canEditBg && img.bgSettings && onRecompose) {
      await onRecompose(img.id, img.bgSettings, newCutout ?? newB64)
    }
  }, [img.id, img.bgSettings, brightness, contrast, rotation, onApply, onRecompose, canEditBg])

  // Aplicar nuevo fondo a esta imagen
  const handleBgApply = async () => {
    if (!onRecompose) return
    setBgApplying(true)
    const cfg = {
      bgFile:  bgFile ?? null,
      preset:  bgFile ? null : bgPreset,
      scale:   bgScale,
      posX:    bgPosX,
      posY:    bgPosY,
      shadow:  bgShadow,
      shadowIntensity: bgShadowInt,
    }
    await onRecompose(img.id, cfg)
    setBgApplying(false)
  }

  const previewFilter = `brightness(${brightness}) contrast(${contrast})`
  const previewTransform = rotation ? `rotate(${rotation}deg)` : undefined
  const bgClass      = bgMode === 'checker' ? 'checker' : bgMode === 'white' ? 'bg-white' : 'bg-slate-900'
  const resultB64    = img.cutoutB64

  const TABS = [
    { id: 'adjust', label: 'Ajustes' },
    { id: 'mask',   label: 'Recorte', icon: <Scissors size={12} /> },
    ...(canEditBg ? [{ id: 'bg', label: 'Fondo', icon: <Layers size={12} /> }] : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={() => handleAttemptClose()}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl overflow-hidden shadow-2xl flex flex-col relative"
        style={{ height: tab === 'mask' ? 'min(92vh, 780px)' : 'auto', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >

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
          <button onClick={() => handleAttemptClose()}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400
              hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ── */}
        {resultB64 && (
          <div className="flex border-b border-slate-100 flex-shrink-0">
            {TABS.map(t => (
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

        {/* ── Tab: Recorte (Máscara) ── */}
        {tab === 'mask' && resultB64 ? (
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MaskEditor
              cutoutB64={resultB64}
              originalUrl={img.previewUrl}
              restoreOffset={img.offset}
              onSave={(b64) => { setMaskDirty(false); handleMaskSave(b64) }}
              onCancel={() => {
                if (maskDirty) { setConfirmExit(true) } else { setTab('adjust') }
              }}
              onDirty={() => setMaskDirty(true)}
            />
          </div>

        /* ── Tab: Fondo ── */
        ) : tab === 'bg' && resultB64 ? (
          <div className="overflow-y-auto flex-1 p-4 space-y-5">

            {/* Vista previa del resultado actual */}
            {img.composedB64 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Fondo actual</p>
                <div className="rounded-lg overflow-hidden bg-slate-100 aspect-video flex items-center justify-center">
                  {img.status === 'processing'
                    ? <Spinner size="md" color="text-blue-700" />
                    : <img src={`data:image/jpeg;base64,${img.composedB64}`}
                        className="w-full h-full object-contain" />
                  }
                </div>
              </div>
            )}

            {/* Presets */}
            <div>
              <SectionLabel>Fondo</SectionLabel>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {BG_PRESETS.map(p => (
                  <button key={p.id}
                    onClick={() => { setBgPreset(p.id); setBgFile(null); setBgFileUrl(null) }}
                    className={`relative h-12 rounded-lg transition-all border-2
                      ${bgPreset === p.id && !bgFile
                        ? 'border-blue-600 ring-2 ring-blue-100'
                        : 'border-transparent hover:border-slate-300'}`}
                    style={p.style}>
                    <span className={`absolute bottom-1 left-0 right-0 text-center text-[10px] font-semibold
                      ${['dark','city','sunset','forest'].includes(p.id) ? 'text-white/80' : 'text-slate-600'}`}>
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Imagen personalizada */}
              <label className={`block cursor-pointer rounded-lg border border-dashed overflow-hidden transition-all
                ${bgFileUrl ? 'border-transparent' : 'border-slate-200 hover:border-blue-400 bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files[0]
                    if (f) {
                      setBgFile(f)
                      setBgFileUrl(URL.createObjectURL(f))
                      setBgPreset(null)
                    }
                  }} />
                {bgFileUrl
                  ? <div className="relative group h-16">
                      <img src={bgFileUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded transition-opacity">Cambiar</span>
                      </div>
                      <button onClick={e => { e.preventDefault(); setBgFile(null); setBgFileUrl(null); setBgPreset('gray') }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </div>
                  : <div className="flex items-center gap-2 px-3 py-2.5">
                      <ImagePlus size={14} className="text-slate-400" strokeWidth={1.5} />
                      <span className="text-xs text-slate-500">Subir imagen de fondo personalizada</span>
                    </div>
                }
              </label>
            </div>

            {/* Posición */}
            <div className="space-y-3">
              <SectionLabel>Posición y tamaño</SectionLabel>
              <Slider label="Tamaño del auto"     value={bgScale} min={10} max={120} unit="%" onChange={setBgScale} />
              <Slider label="Posición horizontal" value={bgPosX}  min={0}  max={100} unit="%" onChange={setBgPosX} />
              <Slider label="Posición vertical"   value={bgPosY}  min={0}  max={100} unit="%" onChange={setBgPosY} />
              <Toggle label="Sombra bajo el auto" value={bgShadow} onChange={setBgShadow} />
              {bgShadow && (
                <Slider label="Intensidad de la sombra" value={bgShadowInt} min={0} max={100} unit="%" onChange={setBgShadowInt} />
              )}
            </div>

            {/* Aplicar */}
            <Btn variant="primary" size="full" onClick={handleBgApply} disabled={bgApplying}>
              {bgApplying
                ? <><Spinner size="sm" /> Aplicando fondo…</>
                : 'Aplicar fondo a esta imagen'}
            </Btn>
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
                        <Slider label="Brillo" value={Math.round((brightness-1)*100)}
                          min={-100} max={100} unit=""
                          onChange={v => setBrightness(+(1+v/100).toFixed(2))} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
                        {brightness > 1 ? '+' : ''}{Math.round((brightness-1)*100)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Contrast size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1">
                        <Slider label="Contraste" value={Math.round((contrast-1)*100)}
                          min={-100} max={100} unit=""
                          onChange={v => setContrast(+(1+v/100).toFixed(2))} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
                        {contrast > 1 ? '+' : ''}{Math.round((contrast-1)*100)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button onClick={handleRotate}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600
                          hover:text-blue-700 bg-slate-50 hover:bg-blue-50 px-3 py-2 rounded-lg
                          transition-colors border border-slate-200">
                        <RotateCw size={14} /> Rotar 90°
                      </button>
                      {rotation !== 0 && (
                        <button onClick={() => setRotation(0)}
                          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                          <RefreshCw size={11} /> {rotation}° · enderezar
                        </button>
                      )}
                    </div>
                    {/* Rotación fina personalizada (cualquier ángulo) */}
                    <div className="flex items-center gap-3">
                      <RotateCw size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1">
                        <Slider label="Rotación" value={rotation} min={-180} max={180} unit="°"
                          onChange={v => setRotation(normDeg(v))} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-400 w-10 text-right">{rotation}°</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── Diálogo salir sin guardar ── */}
        {confirmExit && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-xl">
            <div className="bg-white rounded-xl shadow-2xl p-5 mx-4 w-full max-w-xs space-y-3">
              <div className="flex gap-2.5">
                <LogOut size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-800">¿Salir sin guardar?</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Tenés cambios en el recorte que se perderán si salís ahora.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmExit(false)}
                  className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200
                    text-slate-700 hover:bg-slate-50 transition-colors">
                  Seguir editando
                </button>
                <button onClick={() => { setConfirmExit(false); setMaskDirty(false); setTab('adjust'); onClose() }}
                  className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-500
                    text-white hover:bg-red-600 transition-colors">
                  Salir sin guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
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
