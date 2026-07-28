import { useState, useCallback, useRef, useEffect } from 'react'
import { ImagePlus, X, Check, AlertCircle, Pencil, Sparkles, Loader2, ZoomIn, ArrowLeft, Play, ChevronRight } from 'lucide-react'
import { Slider, Toggle, Spinner } from '../components/ui'
import { composeImage } from '../services/api'
import { useBgHistory } from '../hooks/useBgHistory'
import { BG_PRESETS, AI_SCENES } from '../constants/bgPresets'

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDv(value), delay); return () => clearTimeout(t) }, [value, delay])
  return dv
}

async function composeWithRetry(args, signal, attempts = 3) {
  let lastErr = null
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await composeImage({ ...args, signal })
      if (res.ok) return res
      lastErr = new Error(res.error || 'Error del servidor')
    } catch (e) {
      if (e.name === 'AbortError') return { ok: false, error: 'Cancelado' }
      lastErr = e
    }
    if (i < attempts) await new Promise(r => setTimeout(r, i * 2500))
  }
  return { ok: false, error: lastErr?.message || 'Error' }
}

export default function StepBackground({
  images, effectiveType,
  processAll, reprocess, applyAdjustments, applyBlobSelection,
  setComposed, stats, removeImage,
  plateOptions,
  onEdit, onZoom, onNext, onBack,
}) {
  const processRanRef  = useRef(false)
  const processStopRef = useRef(false)
  useEffect(() => {
    if (!processRanRef.current && processAll) {
      processRanRef.current = true; processStopRef.current = false
      processAll(processStopRef, plateOptions)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [preset,       setPreset]       = useState('azul')
  const [customFile,   setCustomFile]   = useState(null)
  const [customUrl,    setCustomUrl]    = useState(null)
  const [aiSceneId,    setAiSceneId]    = useState(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [showPrompt,   setShowPrompt]   = useState(false)
  const [scale,        setScale]        = useState(80)
  const [posX,         setPosX]         = useState(50)
  const [posY,         setPosY]         = useState(60)
  const [shadow,       setShadow]       = useState(false)
  const [shadowIntensity, setShadowIntensity] = useState(100)
  const [upscale,      setUpscale]      = useState(false)
  const [relight,      setRelight]      = useState(false)
  const [applying,     setApplying]     = useState(false)
  const [stopping,     setStopping]     = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [composeError, setComposeError] = useState(null)
  const [readyToView,  setReadyToView]  = useState(false)   // true después de aplicar exitosamente
  const [selected,     setSelected]     = useState(() => new Set())
  const stopRef    = useRef(false)
  const applyToken = useRef(0)
  const abortRef   = useRef(null)
  const customImgRef = useRef()

  const toggleSelected = id => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll      = () => setSelected(new Set(exteriorDone.map(i => i.id)))
  const clearSelected  = () => setSelected(new Set())

  const { recent: recentBgs, addBg, deleteBg } = useBgHistory()

  const allExterior     = images.filter(i => effectiveType(i) === 'exterior')
  const exteriorDone    = allExterior.filter(i => i.status === 'done')
  const processingCount = allExterior.filter(i => ['processing','idle','pending'].includes(i.status)).length
  const composedCount   = images.filter(i => i.composedB64).length

  const aiPrompt = aiSceneId === 'custom' ? customPrompt.trim() : (AI_SCENES.find(s => s.id === aiSceneId)?.prompt || '')
  const useAi    = !!(aiSceneId && aiPrompt)
  const hasBg    = useAi || preset || customFile

  const dScale      = useDebounce(scale,     700)
  const dPosX       = useDebounce(posX,      700)
  const dPosY       = useDebounce(posY,      700)
  const dShadow     = useDebounce(shadow,    700)
  const dShadowInt  = useDebounce(shadowIntensity, 700)
  const dUpscale    = useDebounce(upscale,   700)
  const dRelight    = useDebounce(relight,   700)
  const exteriorIds = exteriorDone.map(i => i.id).join(',')

  // Cuando el usuario cambia fondo, vuelve al estado "aplicar"
  const markDirty = () => setReadyToView(false)

  const selectPreset  = id => { setPreset(id); setCustomFile(null); setCustomUrl(null); setAiSceneId(null); markDirty() }
  const selectAiScene = id => { setAiSceneId(id); setPreset(null); setCustomFile(null); setCustomUrl(null); setShadow(false); markDirty() }

  // Auto-apply para fondos comunes (sin IA, sin sombra, sin selección)
  useEffect(() => {
    if (!hasBg || !exteriorDone.length || useAi || selected.size > 0 || dShadow) return
    const snap = { imgs: [...exteriorDone], bgFile: customFile, preset: customFile ? null : preset, scale: dScale, posX: dPosX, posY: dPosY, shadowIntensity: dShadowInt, upscale: dUpscale, relight: dRelight }
    const myToken = ++applyToken.current
    setApplying(true); setComposeError(null); setProgress(0); setReadyToView(false)
    let done = 0
    ;(async () => {
      for (const img of snap.imgs) {
        if (applyToken.current !== myToken) break
        if (!img.cutoutB64) { done++; continue }
        try {
          const res = await composeWithRetry({ cutoutB64: img.cutoutB64, bgFile: snap.bgFile, preset: snap.preset, scale: snap.scale, posX: snap.posX, posY: snap.posY, shadow: false, aiShadow: false, shadowIntensity: snap.shadowIntensity, upscale: snap.upscale, relight: snap.relight }, null)
          if (applyToken.current !== myToken) break
          if (res.ok) setComposed(img.id, res.image, { bgFile: snap.bgFile, preset: snap.preset, scale: snap.scale, posX: snap.posX, posY: snap.posY, shadow: false, shadowIntensity: snap.shadowIntensity, upscale: snap.upscale, relight: snap.relight })
          else if (applyToken.current === myToken) setComposeError(res.error || 'Error')
        } catch (err) { if (applyToken.current === myToken) setComposeError('Error: ' + (err?.message || '')) }
        done++
        if (applyToken.current === myToken) setProgress(Math.round(done / snap.imgs.length * 100))
      }
      if (applyToken.current === myToken) { setApplying(false); setReadyToView(true) }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dScale, dPosX, dPosY, dShadow, dShadowInt, dUpscale, dRelight, preset, customFile, exteriorIds])

  const applyAll = useCallback(async () => {
    ++applyToken.current
    const token = applyToken.current
    const controller = new AbortController()
    abortRef.current = controller
    setApplying(true); setStopping(false); stopRef.current = false; setProgress(0); setComposeError(null); setReadyToView(false)
    const sel = exteriorDone.filter(i => selected.has(i.id))
    const targets = sel.length ? sel : exteriorDone
    const seed = useAi ? Math.floor(Math.random() * 1e6) : null
    let guidanceB64 = null; let done = 0
    for (const img of targets) {
      if (stopRef.current || token !== applyToken.current) break
      if (!img.cutoutB64) { done++; continue }
      const cfg = useAi
        ? { bgPrompt: aiPrompt, upscale, relight, seed, guidanceB64 }
        : { bgFile: customFile, preset: customFile ? null : preset, scale, posX, posY, shadow, aiShadow: shadow, shadowIntensity, upscale, relight }
      try {
        const res = await composeWithRetry({ cutoutB64: img.cutoutB64, ...cfg }, controller.signal)
        if (res.ok) {
          const { guidanceB64: _g, ...saveCfg } = cfg
          setComposed(img.id, res.image, saveCfg)
          if (useAi && !guidanceB64) guidanceB64 = res.image
        } else { setComposeError(res.error || 'Error') }
      } catch (err) { setComposeError('Error: ' + (err?.message || '')) }
      done++; setProgress(Math.round(done / targets.length * 100))
    }
    setStopping(false); setApplying(false); clearSelected(); setReadyToView(true)
  }, [exteriorDone, selected, customFile, preset, useAi, aiPrompt, scale, posX, posY, shadow, shadowIntensity, upscale, relight, setComposed])

  // Etiqueta del CTA principal
  const ctaLabel = () => {
    if (readyToView && composedCount > 0) return `Ver resultados → ${composedCount} foto${composedCount !== 1 ? 's' : ''} lista${composedCount !== 1 ? 's' : ''}`
    if (useAi) return selected.size === 1 ? 'Generar en esta foto' : selected.size > 1 ? `Generar en estas ${selected.size} fotos` : 'Generar con IA'
    if (selected.size === 1) return 'Aplicar a esta foto'
    if (selected.size > 1)  return `Aplicar a estas ${selected.size} fotos`
    return 'Aplicar a todas las fotos'
  }

  const ctaIsView = readyToView && composedCount > 0 && !applying

  // ── Miniatura individual ────────────────────────────────────────────────────
  const Thumb = ({ img }) => {
    const isInterior   = effectiveType(img) !== 'exterior' || img.status === 'skipped'
    const isProcessing = ['processing','idle','pending'].includes(img.status) && !img.cutoutB64
    const isSelected   = selected.has(img.id)
    const src = img.composedB64
      ? `data:image/jpeg;base64,${img.composedB64}`
      : img.cutoutB64 ? `data:image/png;base64,${img.cutoutB64}` : img.previewUrl
    const selectable = !isInterior && !isProcessing && (img.cutoutB64 || img.composedB64)

    return (
      <div className={`relative rounded-xl overflow-hidden border-2 bg-white transition-all
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
        <div
          className={`aspect-[4/3] relative ${img.composedB64 ? 'bg-slate-100' : img.cutoutB64 ? 'checker' : 'bg-slate-50'}`}
          onClick={() => !isProcessing && onZoom?.(img.id)}
          style={{ cursor: isProcessing ? 'default' : 'zoom-in' }}>
          {isProcessing ? (
            <>
              <img src={src} className="w-full h-full object-contain opacity-30" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <Loader2 size={16} className="text-blue-500 animate-spin" />
                <span className="text-[9px] font-semibold text-blue-600">Recortando…</span>
              </div>
            </>
          ) : (
            <img src={src} className="w-full h-full object-contain" />
          )}
          {applying && !isInterior && !isProcessing && !img.composedB64 && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Spinner size="sm" color="text-blue-600" />
            </div>
          )}
          {isInterior && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-[9px] font-semibold bg-black/60 px-1.5 py-0.5 rounded">Interior</span>
            </div>
          )}
          {img.composedB64 && !isInterior && (
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow">
              <Check size={8} className="text-white" />
            </div>
          )}
          {selectable && (
            <button onClick={e => { e.stopPropagation(); toggleSelected(img.id) }}
              className={`absolute top-1 left-1 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-all
                ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/80 border-white/70 text-transparent hover:border-blue-400'}`}>
              <Check size={10} strokeWidth={3} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 px-1.5 py-1">
          <p className="text-[9px] text-slate-400 truncate flex-1">{img.file?.name}</p>
          {!isInterior && !isProcessing && (
            <button
              onClick={() => onEdit?.(img.id)}
              title="Retocar imagen"
              className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0">
              <Pencil size={9} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-32">

      {/* Error */}
      {composeError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700 flex-1">{composeError}</p>
          <button onClick={() => setComposeError(null)}><X size={12} className="text-red-400" /></button>
        </div>
      )}

      {/* ══════════════════════════════════════
          BLOQUE 1 — FOTOS / APLICAR FONDO A
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#F9F8F6', borderBottom: '1px solid #E2E0DB' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', fontWeight: 500, color: '#737069', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Aplicar fondo a</span>
          {exteriorDone.length > 1 && (
            <button onClick={selected.size >= exteriorDone.length ? clearSelected : selectAll}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800">
              {selected.size >= exteriorDone.length ? 'Quitar ✕' : 'Todas ✓'}
            </button>
          )}
        </div>

        {/* Banner: recortando */}
        {processingCount > 0 && (
          <div className="mx-3 mb-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <Loader2 size={12} className="text-blue-500 animate-spin flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-700">Eliminando fondos… {stats.done}/{stats.total}</span>
            <div className="ml-auto h-1.5 w-14 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${stats.total ? Math.round(stats.done / stats.total * 100) : 0}%` }} />
            </div>
          </div>
        )}

        {/* Banner: aplicando fondo */}
        {applying && (
          <div className="mx-3 mb-2 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Spinner size="xs" color="text-blue-600" />
            <span className="text-xs font-semibold text-slate-700">Aplicando fondo… {progress}%</span>
            <div className="ml-auto h-1.5 w-14 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <button onClick={() => { abortRef.current?.abort(); stopRef.current = true; applyToken.current++; setStopping(true) }}
              disabled={stopping}
              className="text-[10px] text-red-500 font-semibold disabled:opacity-40 ml-1">
              {stopping ? '…' : 'Detener'}
            </button>
          </div>
        )}

        {/* Grid 4 col */}
        <div className="px-3 pb-3">
          {images.length > 0
            ? <div className="grid grid-cols-4 gap-2">{images.map(img => <Thumb key={img.id} img={img} />)}</div>
            : <p className="text-xs text-slate-400 text-center py-6">No hay imágenes cargadas.</p>
          }
          {selected.size > 0 && (
            <p className="text-[10px] text-blue-600 font-semibold mt-1.5 text-center">
              {selected.size} seleccionada{selected.size !== 1 ? 's' : ''} — fondo solo para estas
            </p>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          BLOQUE 2 — FONDOS PERSONALIZADOS
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5" style={{ background: '#F9F8F6', borderBottom: '1px solid #E2E0DB' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', fontWeight: 500, color: '#737069', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Fondos personalizados</span>
        </div>

        {/* Colores */}
        <div className="px-4 pt-3 pb-1">
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>Colores</p>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {BG_PRESETS.map(p => {
              const active = preset === p.id && !customFile && !aiSceneId
              return (
                <button key={p.id} onClick={() => selectPreset(p.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-1">
                  <div className={`w-14 h-10 rounded-xl border-2 transition-all
                    ${active ? 'border-blue-600 ring-2 ring-blue-100 scale-105' : 'border-slate-200 hover:border-slate-300'}`}
                    style={p.style} />
                  <span className={`text-[9px] font-semibold ${active ? 'text-blue-700' : 'text-slate-400'}`}>{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Mis imágenes */}
        <div className="px-4 pb-4">
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>Mis imágenes</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {/* Agregar */}
            <label className="flex-shrink-0 cursor-pointer flex flex-col items-center gap-1">
              <input ref={customImgRef} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files[0]
                  if (f) { setCustomFile(f); setCustomUrl(URL.createObjectURL(f)); setPreset(null); setAiSceneId(null); addBg(f); markDirty() }
                }} />
              <div className={`w-14 h-10 rounded-xl border-2 border-dashed flex items-center justify-center transition-all
                ${customUrl ? 'border-blue-400' : 'border-slate-200 hover:border-blue-400'}`}>
                <ImagePlus size={14} className="text-slate-400" />
              </div>
              <span className="text-[9px] text-slate-400">Agregar</span>
            </label>

            {/* Imagen activa */}
            {customUrl && (
              <div className="relative flex-shrink-0 flex flex-col items-center gap-1 group">
                <div className="w-14 h-10 rounded-xl border-2 border-blue-600 ring-2 ring-blue-100 overflow-hidden">
                  <img src={customUrl} className="w-full h-full object-cover" alt="" />
                </div>
                <span className="text-[9px] text-blue-600 font-semibold">Activa</span>
                <button onClick={() => { setCustomFile(null); setCustomUrl(null); setPreset('azul'); markDirty() }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                  <X size={8} />
                </button>
              </div>
            )}

            {/* Recientes */}
            {recentBgs.map(bg => (
              <div key={bg._id} className="relative flex-shrink-0 flex flex-col items-center gap-1 group">
                <button onClick={() => {
                  const [header, b64] = bg.dataUrl.split(',')
                  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
                  const bytes = atob(b64); const arr = new Uint8Array(bytes.length)
                  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
                  setCustomFile(new File([arr], bg.name, { type: mime }))
                  setCustomUrl(bg.dataUrl); setPreset(null); setAiSceneId(null); markDirty()
                }}
                  className={`w-14 h-10 rounded-xl border-2 overflow-hidden block transition-all
                    ${customUrl === bg.dataUrl ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                  <img src={bg.dataUrl} className="w-full h-full object-cover" alt="" />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteBg(bg._id) }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          BLOQUE 3 — IA
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5" style={{ background: '#F9F8F6', borderBottom: '1px solid #E2E0DB' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', fontWeight: 500, color: '#737069', textTransform: 'uppercase', letterSpacing: '0.16em' }}>IA</span>
        </div>

        {/* Sombra debajo del auto */}
        <div className="px-4 pt-3 pb-3">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: 600, color: '#111111' }}>Sombra debajo del auto</p>
              <p className="text-[11px] text-slate-400">Efecto realista de apoyo</p>
            </div>
            <div className="relative flex-shrink-0 ml-3">
              <input type="checkbox" className="sr-only peer"
                checked={shadow} onChange={e => { setShadow(e.target.checked); markDirty() }} />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-blue-600
                after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white
                after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </div>
          </label>
          {shadow && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">La sombra consume créditos al aplicar. Tocá <b>Aplicar</b> cuando estés listo.</p>
            </div>
          )}
        </div>

        {/* Fondos generados — escenas IA */}
        <div className="border-t border-slate-100 px-4 py-3">
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#111111', marginBottom: '10px' }}>Fondos generados</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {AI_SCENES.map(s => (
              <button key={s.id} onClick={() => selectAiScene(s.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 w-16`}>
                <div className={`w-16 h-11 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all
                  ${aiSceneId === s.id ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-slate-50 hover:border-violet-300'}`}>
                  <span className="text-lg leading-none">{s.emoji}</span>
                </div>
                <span className={`text-[9px] font-semibold ${aiSceneId === s.id ? 'text-violet-700' : 'text-slate-500'}`}>{s.label}</span>
              </button>
            ))}
            {/* Prompt propio */}
            <button onClick={() => { setShowPrompt(v => !v); if (!showPrompt) selectAiScene('custom') }}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 w-16`}>
              <div className={`w-16 h-11 rounded-xl border-2 flex items-center justify-center transition-all
                ${aiSceneId === 'custom' ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 border-dashed bg-slate-50 hover:border-violet-300'}`}>
                <Sparkles size={16} className={aiSceneId === 'custom' ? 'text-violet-600' : 'text-slate-400'} />
              </div>
              <span className={`text-[9px] font-semibold ${aiSceneId === 'custom' ? 'text-violet-700' : 'text-slate-500'}`}>Tu prompt</span>
            </button>
          </div>
          {showPrompt && (
            <textarea autoFocus value={customPrompt}
              onChange={e => { setCustomPrompt(e.target.value); selectAiScene('custom') }}
              placeholder="ej: garage de lujo, piso negro brillante"
              rows={2}
              className="mt-2 w-full text-sm rounded-xl border border-violet-300 ring-2 ring-violet-100 px-3 py-2 outline-none resize-none" />
          )}
          {useAi && (
            <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">Cada foto con IA <b>consume créditos</b>. Tocá <b>Generar</b> cuando estés listo.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Barra inferior — 2 elementos: ← + CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 pt-3 pb-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">

          {/* Volver */}
          <button onClick={onBack}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={18} />
          </button>

          {/* CTA principal */}
          <button
            onClick={ctaIsView ? onNext : applyAll}
            disabled={(!hasBg && !ctaIsView) || exteriorDone.length === 0 || applying}
            className={`flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all
              ${applying || ((!hasBg || exteriorDone.length === 0) && !ctaIsView)
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : ctaIsView
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : useAi
                    ? 'bg-violet-600 hover:bg-violet-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
            {applying
              ? <><Spinner size="sm" color="text-white" /> Aplicando… {progress}%</>
              : ctaIsView
                ? <><ChevronRight size={16} /> {ctaLabel()}</>
                : <><Play size={14} /> {ctaLabel()}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
