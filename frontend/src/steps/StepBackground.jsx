import { useState, useCallback, useRef, useEffect } from 'react'
import { ImagePlus, X, RefreshCw, Check, ChevronDown, ChevronUp, AlertCircle, Pencil, Sparkles } from 'lucide-react'
import { Btn, Slider, Toggle, Card, SectionLabel, Spinner } from '../components/ui'
import { composeImage } from '../services/api'
import { useBgHistory } from '../hooks/useBgHistory'
import { BG_PRESETS, AI_SCENES } from '../constants/bgPresets'

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

// Compone con reintento: si el backend se reinicia (OneDrive evict / hiccup), la
// petición falla ("Failed to fetch" / JSON cortado). Reintentamos con espera para
// darle tiempo a volver, en vez de cortar el lote con error.
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
  images, effectiveType, setComposed, stats, removeImage,
  onEdit, onZoom,
  onNext, onBack,
}) {
  const [preset,       setPreset]       = useState('azul')
  const [customFile,   setCustomFile]   = useState(null)
  const [customUrl,    setCustomUrl]    = useState(null)
  // Fondo con IA: id de escena activa (o 'custom') + texto libre
  const [aiSceneId,    setAiSceneId]    = useState(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [scale,   setScale]   = useState(80)
  const [posX,    setPosX]    = useState(50)
  const [posY,    setPosY]    = useState(60)
  const [shadow,     setShadow]     = useState(false)   // OFF por defecto (no gasta IA)
  const [shadowIntensity,     setShadowIntensity]     = useState(100)
  // Mejoras IA (viajan en la misma llamada a Photoroom, sin costo extra)
  const [upscale, setUpscale] = useState(false)
  const [relight, setRelight] = useState(false)
  const [applying,      setApplying]      = useState(false)
  const [stopping,      setStopping]      = useState(false)
  const [progress,      setProgress]      = useState(0)
  const [composeError,  setComposeError]  = useState(null)
  const [showAiPanel,   setShowAiPanel]   = useState(false)
  const [showPosition,  setShowPosition]  = useState(false)
  const [showMejoras,   setShowMejoras]   = useState(false)
  // Selección de fotos para aplicar fondos distintos por grupo (vacío = todas)
  const [selected, setSelected] = useState(() => new Set())
  const stopRef    = useRef(false)
  const applyToken = useRef(0)
  const abortRef   = useRef(null)

  const toggleSelected = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const clearSelected = () => setSelected(new Set())

  const { recent: recentBgs, addBg, deleteBg } = useBgHistory()

  const exteriorDone  = images.filter(i => effectiveType(i) === 'exterior' && i.status === 'done')
  const composedCount = images.filter(i => i.composedB64).length

  // Fondo IA: prompt activo (escena preset o texto libre). Se aplica MANUALMENTE
  // (botón Aplicar), nunca en auto, porque cada generación consume cupo de Photoroom.
  const aiPrompt = aiSceneId === 'custom'
    ? customPrompt.trim()
    : (AI_SCENES.find(s => s.id === aiSceneId)?.prompt || '')
  const useAi = !!(aiSceneId && aiPrompt)

  const hasBg = useAi || preset || customFile

  const dScale      = useDebounce(scale,      700)
  const dPosX       = useDebounce(posX,       700)
  const dPosY       = useDebounce(posY,       700)
  const dShadow     = useDebounce(shadow,     700)
  const dShadowInt  = useDebounce(shadowIntensity, 700)
  const dUpscale    = useDebounce(upscale, 700)
  const dRelight    = useDebounce(relight, 700)

  const exteriorIds = exteriorDone.map(i => i.id).join(',')

  useEffect(() => {
    // Auto-apply SOLO el fondo inicial (gris) cuando todavía no hay nada compuesto.
    // Una vez que hay resultados, los cambios se aplican con el botón (para no pisar
    // los fondos por-grupo). Tampoco corre con IA ni con selección activa.
    if (!hasBg || !exteriorDone.length || useAi || selected.size > 0 || dShadow) return

    const snap = {
      imgs: [...exteriorDone],
      bgFile: customFile, preset: customFile ? null : preset,
      scale: dScale, posX: dPosX, posY: dPosY, shadow: dShadow,
      shadowIntensity: dShadowInt,
      upscale: dUpscale, relight: dRelight,
    }

    const myToken = ++applyToken.current

    setApplying(true)
    setComposeError(null)
    setProgress(0)
    let done = 0

    ;(async () => {
      for (const img of snap.imgs) {
        if (applyToken.current !== myToken) break
        if (!img.cutoutB64) { done++; continue }
        try {
          const res = await composeWithRetry({
            cutoutB64: img.cutoutB64,
            bgFile: snap.bgFile, preset: snap.preset,
            scale: snap.scale, posX: snap.posX, posY: snap.posY,
            shadow: false,     // nunca preview de sombra — la sombra gratis queda mal; solo se aplica con IA al hacer clic en Aplicar
            aiShadow: false,
            shadowIntensity: snap.shadowIntensity,
            upscale: snap.upscale, relight: snap.relight,
          }, null)
          if (applyToken.current !== myToken) break
          if (res.ok) {
            setComposed(img.id, res.image, {
              bgFile: snap.bgFile, preset: snap.preset,
              scale: snap.scale, posX: snap.posX, posY: snap.posY, shadow: false,
              shadowIntensity: snap.shadowIntensity,
              upscale: snap.upscale, relight: snap.relight,
            })
          } else {
            if (applyToken.current === myToken)
              setComposeError(res.error || 'Error al aplicar el fondo')
          }
        } catch (err) {
          if (applyToken.current === myToken)
            setComposeError('Error de conexión: ' + (err?.message || 'desconocido'))
        }
        done++
        if (applyToken.current === myToken)
          setProgress(Math.round(done / snap.imgs.length * 100))
      }
      if (applyToken.current === myToken) setApplying(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dScale, dPosX, dPosY, dShadow, dShadowInt, dUpscale, dRelight, preset, customFile, exteriorIds])

  const applyAll = useCallback(async () => {
    ++applyToken.current
    const token = applyToken.current
    const controller = new AbortController()
    abortRef.current = controller
    setApplying(true); setStopping(false); stopRef.current = false; setProgress(0); setComposeError(null)
    // Destino: si hay selección, solo esas; si no, todas las exteriores
    const sel = exteriorDone.filter(i => selected.has(i.id))
    const targets = sel.length ? sel : exteriorDone
    const bgCfgBase = {
      bgFile: customFile, preset: customFile ? null : preset,
      scale, posX, posY, shadow, shadowIntensity,
      upscale, relight,
    }
    // Consistencia IA: mismo seed para todo el grupo + la 1ª escena como referencia
    const seed = useAi ? Math.floor(Math.random() * 1e6) : null
    let guidanceB64 = null
    let done = 0
    for (const img of targets) {
      if (stopRef.current || token !== applyToken.current) break
      if (!img.cutoutB64) { done++; continue }
      const cfg = useAi
        ? { bgPrompt: aiPrompt, upscale, relight, seed, guidanceB64 }
        : { ...bgCfgBase, shadow, aiShadow: shadow }   // al aplicar: sombra IA paga (la buena)
      try {
        const res = await composeWithRetry({ cutoutB64: img.cutoutB64, ...cfg }, controller.signal)
        if (res.ok) {
          const { guidanceB64: _g, ...saveCfg } = cfg   // guidance es interno, no se guarda
          setComposed(img.id, res.image, saveCfg)
          if (useAi && !guidanceB64) guidanceB64 = res.image   // 1ª escena → referencia
        } else {
          setComposeError(res.error || 'Error del servidor')
        }
      } catch (err) {
        setComposeError('Error de conexión: ' + (err?.message || 'desconocido'))
      }
      done++
      setProgress(Math.round(done / targets.length * 100))
    }
    setStopping(false)
    setApplying(false)
    clearSelected()
  }, [exteriorDone, selected, customFile, preset, useAi, aiPrompt, scale, posX, posY, shadow, shadowIntensity, upscale, relight, setComposed])

  const selectPreset = (id) => { setPreset(id); setCustomFile(null); setCustomUrl(null); setAiSceneId(null) }
  const selectAiScene = (id) => { setAiSceneId(id); setPreset(null); setCustomFile(null); setCustomUrl(null); setShadow(false) }

  // Thumb: imagen arriba (click = zoom) + acciones siempre visibles abajo, sin superposiciones
  const ComposedThumb = ({ img }) => {
    const isInterior = effectiveType(img) !== 'exterior' || img.status === 'skipped'
    const src = img.composedB64
      ? `data:image/jpeg;base64,${img.composedB64}`
      : img.cutoutB64
        ? `data:image/png;base64,${img.cutoutB64}`
        : img.previewUrl

    const bgClass = img.composedB64 ? 'bg-slate-100' : img.cutoutB64 ? 'checker' : 'bg-slate-100'
    const canEdit = onEdit && !isInterior && (img.composedB64 || img.cutoutB64)
    const selectable = !isInterior && (img.cutoutB64 || img.composedB64)
    const isSelected = selected.has(img.id)

    return (
      <div className={`rounded-xl overflow-hidden bg-white border-2 transition-colors
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
        <div className={`relative aspect-[4/3] ${bgClass} ${onZoom ? 'cursor-zoom-in' : ''}`}
          onClick={onZoom ? () => onZoom(img.id) : undefined}>
          <img src={src} className="w-full h-full object-contain" />

          {/* Eliminar — siempre visible */}
          {removeImage && (
            <button
              onClick={e => { e.stopPropagation(); removeImage(img.id) }}
              title="Eliminar imagen"
              className="absolute top-2 left-2 w-7 h-7 bg-black/55 text-white rounded-lg
                flex items-center justify-center transition-colors hover:bg-red-500 active:bg-red-600 z-10">
              <X size={13} strokeWidth={2.5} />
            </button>
          )}

          {/* Casilla de selección — para aplicar fondos por grupo */}
          {selectable && (
            <button
              onClick={e => { e.stopPropagation(); toggleSelected(img.id) }}
              title={isSelected ? 'Quitar de la selección' : 'Seleccionar para aplicar un fondo'}
              className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center z-10
                border-2 transition-colors shadow-sm
                ${isSelected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white/85 border-white/90 text-transparent hover:border-blue-400'}`}>
              <Check size={14} strokeWidth={3} />
            </button>
          )}

          {applying && !isInterior && !img.composedB64 && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Spinner size="sm" color="text-blue-700" />
            </div>
          )}

          {isInterior && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-[10px] font-semibold bg-black/60 px-2 py-1 rounded-md">Interior</span>
            </div>
          )}

          {img.composedB64 && !isInterior && (
            <div className="absolute bottom-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full
              flex items-center justify-center shadow-sm" title="Fondo aplicado">
              <Check size={10} className="text-white" />
            </div>
          )}
        </div>

        {/* Footer — acciones siempre visibles, nada escondido detrás de un hover */}
        <div className="px-2 py-2 space-y-1.5">
          {canEdit && (
            <button
              onClick={() => onEdit(img.id)}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg
                text-[11px] font-semibold transition-colors min-h-[36px]
                bg-blue-700 text-white hover:bg-blue-800 active:bg-blue-900">
              <Pencil size={11} /> Editar
            </button>
          )}
          <p className="text-[11px] text-slate-400 truncate px-1">{img.file.name}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-40">

      {/* ── Error banner ── */}
      {composeError && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Error al aplicar el fondo</p>
            <p className="text-[11px] text-red-500 break-words">{composeError}</p>
          </div>
          <button onClick={() => setComposeError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── 1. FOTOS — siempre visibles primero ── */}
      {exteriorDone.length > 0 ? (
        <div>
          {/* Barra de selección por grupo */}
          {selected.size > 0 && !applying && (
            <div className="flex items-center gap-2 mb-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <Check size={14} className="text-blue-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-blue-800">
                {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-blue-500 hidden sm:inline">— elegí fondo y tocá Aplicar</span>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => setSelected(new Set(exteriorDone.map(i => i.id)))}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900">Todas</button>
                <button onClick={clearSelected}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600">Quitar</button>
              </div>
            </div>
          )}

          {/* Estado del lote + progreso */}
          {(applying || composedCount > 0) && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-700">
                  {applying
                    ? `Aplicando… ${selected.size > 0 ? `(${selected.size} sel.)` : ''}`
                    : `${composedCount} de ${exteriorDone.length} listas`}
                </p>
                {applying && (
                  <div className="flex items-center gap-1.5">
                    <Spinner size="xs" color="text-blue-700" />
                    <span className="text-xs text-blue-700 font-semibold tabular-nums">{progress}%</span>
                  </div>
                )}
              </div>
              {applying && (
                <button
                  onClick={() => {
                    abortRef.current?.abort()
                    stopRef.current = true
                    applyToken.current++
                    setStopping(true)
                  }}
                  disabled={stopping}
                  className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                  {stopping ? 'Deteniendo…' : 'Detener'}
                </button>
              )}
            </div>
          )}
          {applying && (
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-2.5">
              <div className="h-full bg-blue-700 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Grid de fotos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {images.map(img => <ComposedThumb key={img.id} img={img} />)}
          </div>

          {exteriorDone.length > 1 && !applying && (
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Tocá el <b>✓</b> en las fotos para aplicar fondos distintos por grupo
            </p>
          )}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">No hay imágenes exteriores procesadas.</p>
          <Btn variant="secondary" className="mt-3" onClick={onBack}>← Volver</Btn>
        </Card>
      )}

      {/* ── 2. FONDO — selector de preset + imagen personalizada ── */}
      <Card className="p-4">
        <SectionLabel>Elegir fondo</SectionLabel>
        {/* Scroll horizontal de presets — mucho más compacto en mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2"  style={{ WebkitOverflowScrolling: 'touch' }}>
          {BG_PRESETS.map(p => {
            const active = preset === p.id && !customFile && !aiSceneId
            return (
              <button key={p.id} onClick={() => selectPreset(p.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <div className={`w-12 h-10 rounded-xl border-2 transition-all
                  ${active ? 'border-blue-600 ring-2 ring-blue-100 scale-105' : 'border-slate-200 hover:border-slate-300'}`}
                  style={p.style} />
                <span className={`text-[10px] font-semibold leading-none
                  ${active ? 'text-blue-700' : 'text-slate-500'}`}>
                  {p.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Fondo personalizado */}
        <label className={`block cursor-pointer rounded-xl border border-dashed overflow-hidden transition-all mt-3
          ${customUrl ? 'border-transparent' : 'border-slate-200 hover:border-blue-400 bg-slate-50'}`}>
          <input type="file" accept="image/*" className="hidden"
            onChange={e => {
              const f = e.target.files[0]
              if (f) { setCustomFile(f); setCustomUrl(URL.createObjectURL(f)); setPreset(null); setAiSceneId(null); addBg(f) }
            }} />
          {customUrl
            ? <div className="relative group h-14">
                <img src={customUrl} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded">Cambiar</span>
                </div>
                <button onClick={e => { e.preventDefault(); setCustomFile(null); setCustomUrl(null); setPreset('azul') }}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={10} />
                </button>
              </div>
            : <div className="flex items-center gap-2 px-3 py-2.5">
                <ImagePlus size={14} className="text-slate-400" strokeWidth={1.5} />
                <span className="text-xs text-slate-500">Subir imagen de fondo propia</span>
              </div>
          }
        </label>

        {/* Recientes */}
        {recentBgs.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-2.5" style={{ scrollbarWidth: 'none' }}>
            {recentBgs.map(bg => (
              <div key={bg._id} className="relative flex-shrink-0 group">
                <button onClick={() => {
                  const [header, b64] = bg.dataUrl.split(',')
                  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
                  const bytes = atob(b64); const arr = new Uint8Array(bytes.length)
                  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
                  setCustomFile(new File([arr], bg.name, { type: mime }))
                  setCustomUrl(bg.dataUrl); setPreset(null); setAiSceneId(null)
                }}
                  className={`w-16 h-10 rounded-lg border-2 overflow-hidden block transition-all
                    ${customFile?.name === bg.name && customUrl === bg.dataUrl ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                  <img src={bg.dataUrl} className="w-full h-full object-cover" alt="" />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteBg(bg._id) }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 3. FONDO CON IA — colapsable, cerrado por defecto ── */}
      <Card className="overflow-hidden">
        <button onClick={() => setShowAiPanel(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors min-h-[52px]">
          <div className="flex items-center gap-2.5">
            <Sparkles size={15} className="text-violet-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-700">Fondo con IA</span>
            {aiSceneId && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">● Activo</span>}
          </div>
          {showAiPanel ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
        </button>

        <div className={`grid transition-all duration-300 ease-in-out ${showAiPanel ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
        <div className="border-t border-slate-100 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {AI_SCENES.map(s => (
                <button key={s.id} onClick={() => selectAiScene(s.id)}
                  className={`h-14 rounded-xl text-xs font-semibold transition-all border-2 flex flex-col items-center justify-center gap-1
                    ${aiSceneId === s.id
                      ? 'border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
                  <span className="text-base leading-none">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
            <input type="text" value={aiSceneId === 'custom' ? customPrompt : ''}
              onChange={e => { setCustomPrompt(e.target.value); selectAiScene('custom') }}
              onFocus={() => { if (customPrompt || aiSceneId !== 'custom') selectAiScene('custom') }}
              placeholder="o describí tu escena… (ej: garage de lujo, piso negro)"
              className={`w-full text-sm rounded-xl border px-3 py-2.5 outline-none transition-colors
                ${aiSceneId === 'custom' ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200 focus:border-violet-300'}`} />
            {useAi && (
              <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5">
                <Sparkles size={13} className="text-violet-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-violet-700 leading-snug">
                  La IA genera la escena completa con luz y sombra incluidas. Tocá <b>Aplicar</b> para generar.
                </p>
              </div>
            )}
          </div>
          </div>
        </div>
      </Card>

      {/* ── 4. POSICIÓN Y SOMBRA — colapsable, cerrado por defecto ── */}
      <Card className="overflow-hidden">
          <button onClick={() => setShowPosition(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors min-h-[52px]">
            <span className="text-sm font-semibold text-slate-700">Posición y sombra</span>
            <div className="flex items-center gap-2">
              {shadow && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">Sombra IA</span>}
              {showPosition ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </button>
          <div className={`grid transition-all duration-300 ease-in-out ${showPosition ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
            <div className="border-t border-slate-100 p-4 space-y-4">
              {useAi ? (
                <p className="text-xs text-slate-400 leading-snug">
                  Con <b>Fondo IA</b> activo, la IA posiciona el auto automáticamente dentro de la escena.
                  Los sliders de posición aplican solo con fondos comunes.
                </p>
              ) : (
                <>
                  <Slider label="Tamaño del auto"     value={scale} min={10} max={120} unit="%" onChange={setScale} />
                  <Slider label="Posición horizontal" value={posX}  min={0}  max={100} unit="%" onChange={setPosX} />
                  <Slider label="Posición vertical"   value={posY}  min={0}  max={100} unit="%" onChange={setPosY} />
                </>
              )}
              <Toggle label="Sombra realista (IA)" value={shadow} onChange={setShadow} disabled={useAi} />
              {shadow && (
                <>
                  {!useAi && <Slider label="Intensidad de la sombra" value={shadowIntensity} min={0} max={100} unit="%" onChange={setShadowIntensity} />}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 leading-snug">
                      Si usás <b>Fondo IA</b>, la escena ya incluye su propia sombra.
                    </p>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
      </Card>

      {/* ── 5. MEJORAS IA — colapsable ── */}
      <Card className="overflow-hidden">
        <button onClick={() => setShowMejoras(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors min-h-[52px]">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-violet-500" />
            <span className="text-sm font-semibold text-slate-700">Mejoras IA</span>
          </div>
          {showMejoras ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        <div className={`grid transition-all duration-300 ease-in-out ${showMejoras ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="border-t border-slate-100 p-4 space-y-2.5">
              <Toggle label="Mejorar resolución (fotos de baja calidad)" value={upscale} onChange={setUpscale} />
              <Toggle label="Mejorar iluminación (relighting)" value={relight} onChange={setRelight} />
              <p className="text-[11px] text-slate-400 leading-snug">
                Solo con <b>Fondo IA</b> o <b>Sombra IA</b> activos.{upscale && ' Upscale actúa solo en fotos de baja resolución.'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Barra fija inferior ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 pt-3 pb-4 pb-safe">
        <div className="max-w-2xl mx-auto space-y-2">

          {/* Fila 1: Aplicar — acción principal */}
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onBack} className="flex-shrink-0 px-3">
              ← Atrás
            </Btn>
            <Btn variant="primary" size="full"
              onClick={applyAll}
              disabled={!hasBg || exteriorDone.length === 0 || applying}>
              {applying
                ? <><Spinner size="sm" color="text-white" /> Aplicando… {progress}%</>
                : <><RefreshCw size={14} /> {
                    selected.size > 0
                      ? `Aplicar a ${selected.size} foto${selected.size !== 1 ? 's' : ''}`
                      : useAi ? 'Generar con IA'
                      : (shadow && !preset && !customFile) ? 'Aplicar sombra'
                      : 'Aplicar'
                  }</>}
            </Btn>
          </div>

          {/* Fila 2: Siguiente — cuando hay resultados */}
          <Btn variant={composedCount > 0 ? 'primary' : 'secondary'} size="full"
            disabled={exteriorDone.length === 0}
            onClick={onNext}>
            {composedCount > 0
              ? `Siguiente → descargar ${composedCount} foto${composedCount !== 1 ? 's' : ''}`
              : 'Siguiente →'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
