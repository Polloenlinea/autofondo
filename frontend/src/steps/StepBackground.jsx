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
async function composeWithRetry(args, attempts = 3) {
  let lastErr = null
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await composeImage(args)
      if (res.ok) return res
      lastErr = new Error(res.error || 'Error del servidor')
    } catch (e) {
      lastErr = e
    }
    if (i < attempts) await new Promise(r => setTimeout(r, i * 2500)) // 2,5s y 5s
  }
  return { ok: false, error: lastErr?.message || 'Error' }
}

export default function StepBackground({
  images, effectiveType, setComposed, stats, removeImage,
  onEdit, onZoom,
  onNext, onBack,
}) {
  const [preset,       setPreset]       = useState('gray')
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
  const [progress,      setProgress]      = useState(0)
  const [composeError,  setComposeError]  = useState(null)
  const [showSettings, setShowSettings] = useState(true)
  // Selección de fotos para aplicar fondos distintos por grupo (vacío = todas)
  const [selected, setSelected] = useState(() => new Set())
  const stopRef    = useRef(false)
  const applyToken = useRef(0)

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
    if (!hasBg || !exteriorDone.length || useAi || selected.size > 0 || composedCount > 0) return

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
        // Sombra: a todos (Photoroom la proyecta según el ángulo).
        const imgShadow = snap.shadow
        try {
          const res = await composeWithRetry({
            cutoutB64: img.cutoutB64,
            bgFile: snap.bgFile, preset: snap.preset,
            scale: snap.scale, posX: snap.posX, posY: snap.posY, shadow: imgShadow,
            aiShadow: false,   // preview inicial: sombra GRATIS (no gasta IA)
            shadowIntensity: snap.shadowIntensity,
            upscale: snap.upscale, relight: snap.relight,
          })
          if (applyToken.current !== myToken) break
          if (res.ok) {
            setComposed(img.id, res.image, {
              bgFile: snap.bgFile, preset: snap.preset,
              scale: snap.scale, posX: snap.posX, posY: snap.posY, shadow: imgShadow,
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
    setApplying(true); stopRef.current = false; setProgress(0); setComposeError(null)
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
        const res = await composeWithRetry({ cutoutB64: img.cutoutB64, ...cfg })
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
    setApplying(false)
    clearSelected()
  }, [exteriorDone, selected, customFile, preset, useAi, aiPrompt, scale, posX, posY, shadow, shadowIntensity, upscale, relight, setComposed])

  const selectPreset = (id) => { setPreset(id); setCustomFile(null); setCustomUrl(null); setAiSceneId(null) }
  const selectAiScene = (id) => { setAiSceneId(id); setPreset(null); setCustomFile(null); setCustomUrl(null) }

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
    <div className="space-y-4 pb-32">

      {/* ── Panel de configuración ── */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setShowSettings(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors">
          <span className="text-sm font-semibold text-slate-700">Configurar fondo y posición</span>
          {showSettings
            ? <ChevronUp size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showSettings && (
          <div className="border-t border-slate-100 p-4 space-y-5">

            {/* Presets */}
            <div>
              <SectionLabel>Fondo</SectionLabel>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {BG_PRESETS.map(p => (
                  <button key={p.id} onClick={() => selectPreset(p.id)}
                    className={`relative h-12 rounded-lg transition-all border-2
                      ${preset === p.id && !customFile
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
                ${customUrl ? 'border-transparent' : 'border-slate-200 hover:border-blue-400 bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files[0]
                    if (f) {
                      setCustomFile(f)
                      setCustomUrl(URL.createObjectURL(f))
                      setPreset(null)
                      setAiSceneId(null)
                      addBg(f)
                    }
                  }} />
                {customUrl
                  ? <div className="relative group h-16">
                      <img src={customUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded transition-opacity">Cambiar</span>
                      </div>
                      <button onClick={e => { e.preventDefault(); setCustomFile(null); setCustomUrl(null); setPreset('gray') }}
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

              {/* Recientes */}
              {recentBgs.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Usados recientemente</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recentBgs.map(bg => (
                      <div key={bg._id} className="relative flex-shrink-0 group">
                        <button
                          onClick={() => {
                            const [header, b64] = bg.dataUrl.split(',')
                            const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
                            const bytes = atob(b64)
                            const arr   = new Uint8Array(bytes.length)
                            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
                            const file  = new File([arr], bg.name, { type: mime })
                            setCustomFile(file)
                            setCustomUrl(bg.dataUrl)
                            setPreset(null)
                          }}
                          className={`w-20 h-12 rounded-lg border-2 overflow-hidden transition-all block
                            ${customFile?.name === bg.name && customUrl === bg.dataUrl
                              ? 'border-blue-600 ring-2 ring-blue-100'
                              : 'border-slate-200 hover:border-blue-300'}`}>
                          <img src={bg.dataUrl} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/40 px-1 py-0.5">
                            <p className="text-[9px] text-white truncate">{bg.name}</p>
                          </div>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteBg(bg._id) }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full
                            flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Fondo con IA (escenas generadas) ── */}
            <div className="pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-violet-500" />
                <SectionLabel className="mb-0">Fondo con IA</SectionLabel>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">Premium</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {AI_SCENES.map(s => (
                  <button key={s.id} onClick={() => selectAiScene(s.id)}
                    className={`h-12 rounded-lg text-xs font-semibold transition-all border-2 flex flex-col items-center justify-center gap-0.5
                      ${aiSceneId === s.id
                        ? 'border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
                    <span className="text-sm leading-none">{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Escena personalizada (texto libre) */}
              <div className="flex gap-2">
                <input type="text" value={aiSceneId === 'custom' ? customPrompt : ''}
                  onChange={e => { setCustomPrompt(e.target.value); selectAiScene('custom') }}
                  onFocus={() => { if (customPrompt || aiSceneId !== 'custom') selectAiScene('custom') }}
                  placeholder="o describí tu escena… (ej: garage de lujo, piso negro)"
                  className={`flex-1 text-xs rounded-lg border px-3 py-2 outline-none transition-colors
                    ${aiSceneId === 'custom' ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200 focus:border-violet-300'}`} />
              </div>

              {useAi && (
                <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 mt-2">
                  <Sparkles size={13} className="text-violet-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-violet-700 leading-snug">
                    La IA arma la escena completa (luz, sombra y reflejo incluidos). Tocá <b>Aplicar fondo</b> para
                    generar. <b>Cada foto consume 1 imagen</b> del cupo de Photoroom.
                  </p>
                </div>
              )}
            </div>

            {/* ── Mejoras IA (opcional) — aplican con cualquier fondo ── */}
            <div className="pt-1 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-violet-500" />
                <SectionLabel className="mb-0">Mejoras IA (opcional)</SectionLabel>
              </div>
              <Toggle label="Mejorar resolución (fotos de baja calidad)" value={upscale} onChange={setUpscale} />
              <Toggle label="Mejorar iluminación (relighting)" value={relight} onChange={setRelight} />
              {(upscale || relight) && (
                <p className="text-[11px] text-slate-400 leading-snug">
                  Se aplican en la misma generación (no cuestan una imagen aparte).
                  {upscale && ' El upscale actúa solo en fotos chicas/de baja resolución; las grandes ya no lo necesitan.'}
                </p>
              )}
            </div>

            {/* Aplicar */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={applyAll}
                disabled={!hasBg || exteriorDone.length === 0 || applying}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm font-semibold
                  rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {applying
                  ? <><Spinner size="sm" color="text-white" /> Aplicando…</>
                  : <><RefreshCw size={13} /> {selected.size > 0 ? `Aplicar a estas ${selected.size}` : 'Aplicar a todas'}</>}
              </button>
              {applying && (
                <span className="text-xs text-blue-700 font-semibold tabular-nums">{progress}%</span>
              )}
            </div>
            {exteriorDone.length > 1 && !applying && (
              <p className="text-[11px] text-slate-400 leading-snug">
                💡 Tocá el <b>✓</b> de las fotos para aplicar fondos <b>distintos por grupo</b> (ej: unas con showroom IA, otras con gris). Sin selección, se aplica a todas.
              </p>
            )}

            {/* Posición — solo para fondos normales; el fondo IA arma la escena solo */}
            {!useAi && (
            <div className="space-y-3">
              <SectionLabel>Posición y tamaño</SectionLabel>
              <Slider label="Tamaño del auto"     value={scale} min={10} max={120} unit="%" onChange={setScale} />
              <Slider label="Posición horizontal" value={posX}  min={0}  max={100} unit="%" onChange={setPosX} />
              <Slider label="Posición vertical"   value={posY}  min={0}  max={100} unit="%" onChange={setPosY} />
              <Toggle label="Sombra realista (IA)" value={shadow} onChange={setShadow} />
              {shadow && (
                <>
                  <Slider label="Intensidad de la sombra" value={shadowIntensity} min={0} max={100} unit="%" onChange={setShadowIntensity} />
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-snug">
                      La sombra realista tiene un <b>costo</b>. Si después aplicás un <b>fondo inteligente (IA)</b>,
                      ese ya trae su propia sombra → pagarías <b>dos veces</b>. Para fondo IA, dejá la sombra apagada acá.
                    </p>
                  </div>
                </>
              )}
            </div>
            )}

          </div>
        )}
      </Card>

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

      {/* ── Resultados ── */}
      {exteriorDone.length > 0 ? (
        <div>
          {/* Barra de selección — visible cuando hay fotos seleccionadas */}
          {selected.size > 0 && !applying && (
            <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <Check size={15} className="text-blue-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-blue-800">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
              <span className="text-xs text-blue-600/80 hidden sm:inline">— elegí un fondo arriba y "Aplicar a estas"</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setSelected(new Set(exteriorDone.map(i => i.id)))}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900">Todas</button>
                <button onClick={clearSelected}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700">Quitar</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-700">
                {applying
                  ? `Aplicando fondo… (${exteriorDone.length} imágenes)`
                  : composedCount > 0
                    ? `${composedCount} de ${exteriorDone.length} listas`
                    : `Hacé clic en "Aplicar fondo" para empezar`}
              </p>
              {applying && (
                <div className="flex items-center gap-1.5">
                  <Spinner size="xs" color="text-blue-700" />
                  <span className="text-xs text-blue-700 font-semibold tabular-nums">{progress}%</span>
                </div>
              )}
            </div>
            {applying && (
              <button onClick={() => { stopRef.current = true; applyToken.current++ }}
                className="text-xs text-red-500 hover:text-red-700 font-medium">
                Detener
              </button>
            )}
          </div>

          {applying && (
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-blue-700 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map(img => <ComposedThumb key={img.id} img={img} />)}
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">No hay imágenes exteriores procesadas.</p>
          <Btn variant="secondary" className="mt-3" onClick={onBack}>Volver</Btn>
        </Card>
      )}

      {/* ── Acciones fijas ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Btn variant="secondary" onClick={onBack}>Atrás</Btn>
          <Btn variant="secondary" onClick={applyAll}
            disabled={!hasBg || exteriorDone.length === 0 || applying}>
            <RefreshCw size={14} /> Aplicar
          </Btn>
          <Btn variant="primary" size="full"
            disabled={composedCount === 0 && exteriorDone.length === 0}
            onClick={onNext}>
            {composedCount > 0
              ? `Siguiente: publicar o descargar (${composedCount}) →`
              : exteriorDone.length > 0
                ? `Siguiente: descargar (${exteriorDone.length}) →`
                : 'Siguiente →'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
