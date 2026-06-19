import { useState, useCallback, useRef, useEffect } from 'react'
import { ImagePlus, X, RefreshCw, Check, ChevronDown, ChevronUp, AlertCircle, Pencil } from 'lucide-react'
import { Btn, Slider, Toggle, Card, SectionLabel, Spinner } from '../components/ui'
import { composeImage } from '../services/api'
import { useBgHistory } from '../hooks/useBgHistory'
import { BG_PRESETS } from '../constants/bgPresets'

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

export default function StepBackground({
  images, effectiveType, setComposed, stats,
  onEdit, onZoom,
  onNext, onBack,
}) {
  const [preset,       setPreset]       = useState('white')
  const [customFile,   setCustomFile]   = useState(null)
  const [customUrl,    setCustomUrl]    = useState(null)
  const [scale,   setScale]   = useState(80)
  const [posX,    setPosX]    = useState(50)
  const [posY,    setPosY]    = useState(60)
  const [shadow,     setShadow]     = useState(true)
  const [reflection, setReflection] = useState(false)
  const [applying,      setApplying]      = useState(false)
  const [progress,      setProgress]      = useState(0)
  const [composeError,  setComposeError]  = useState(null)
  const [showSettings, setShowSettings] = useState(true)
  const stopRef    = useRef(false)
  const applyToken = useRef(0)

  const { recent: recentBgs, addBg, deleteBg } = useBgHistory()

  const exteriorDone  = images.filter(i => effectiveType(i) === 'exterior' && i.status === 'done')
  const composedCount = images.filter(i => i.composedB64).length
  const hasBg = preset || customFile
  // El reflejo solo tiene sentido visual en fotos de perfil (auto horizontal)
  const anyHorizontal = exteriorDone.some(i => i.horizontal)

  const dScale      = useDebounce(scale,      700)
  const dPosX       = useDebounce(posX,       700)
  const dPosY       = useDebounce(posY,       700)
  const dShadow     = useDebounce(shadow,     700)
  const dReflection = useDebounce(reflection, 700)

  const exteriorIds = exteriorDone.map(i => i.id).join(',')

  useEffect(() => {
    if (!hasBg || !exteriorDone.length) return

    const snap = {
      imgs: [...exteriorDone],
      bgFile: customFile, preset: customFile ? null : preset,
      scale: dScale, posX: dPosX, posY: dPosY, shadow: dShadow, reflection: dReflection,
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
        const imgReflection = snap.reflection && img.horizontal
        try {
          const res = await composeImage({
            cutoutB64: img.cutoutB64,
            bgFile: snap.bgFile, preset: snap.preset,
            scale: snap.scale, posX: snap.posX, posY: snap.posY, shadow: snap.shadow,
            reflection: imgReflection,
          })
          if (applyToken.current !== myToken) break
          if (res.ok) {
            setComposed(img.id, res.image, {
              bgFile: snap.bgFile, preset: snap.preset,
              scale: snap.scale, posX: snap.posX, posY: snap.posY, shadow: snap.shadow,
              reflection: imgReflection,
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
  }, [dScale, dPosX, dPosY, dShadow, dReflection, preset, customFile, exteriorIds])

  const applyAll = useCallback(async () => {
    ++applyToken.current
    const token = applyToken.current
    setApplying(true); stopRef.current = false; setProgress(0); setComposeError(null)
    const bgCfgBase = {
      bgFile: customFile, preset: customFile ? null : preset,
      scale, posX, posY, shadow,
    }
    let done = 0
    for (const img of exteriorDone) {
      if (stopRef.current || token !== applyToken.current) break
      if (!img.cutoutB64) { done++; continue }
      const cfg = { ...bgCfgBase, reflection: reflection && img.horizontal }
      try {
        const res = await composeImage({ cutoutB64: img.cutoutB64, ...cfg })
        if (res.ok) {
          setComposed(img.id, res.image, cfg)
        } else {
          setComposeError(res.error || 'Error del servidor')
        }
      } catch (err) {
        setComposeError('Error de conexión: ' + (err?.message || 'desconocido'))
      }
      done++
      setProgress(Math.round(done / exteriorDone.length * 100))
    }
    setApplying(false)
  }, [exteriorDone, customFile, preset, scale, posX, posY, shadow, reflection, setComposed])

  const selectPreset = (id) => { setPreset(id); setCustomFile(null); setCustomUrl(null) }

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

    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className={`relative aspect-[4/3] ${bgClass} ${onZoom ? 'cursor-zoom-in' : ''}`}
          onClick={onZoom ? () => onZoom(img.id) : undefined}>
          <img src={src} className="w-full h-full object-contain" />

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
            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full
              flex items-center justify-center shadow-sm">
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
                      addBg(f)
                    }
                  }} />
                {customUrl
                  ? <div className="relative group h-16">
                      <img src={customUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded transition-opacity">Cambiar</span>
                      </div>
                      <button onClick={e => { e.preventDefault(); setCustomFile(null); setCustomUrl(null); setPreset('white') }}
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

            {/* Aplicar */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={applyAll}
                disabled={!hasBg || exteriorDone.length === 0 || applying}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm font-semibold
                  rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {applying
                  ? <><Spinner size="sm" color="text-white" /> Aplicando…</>
                  : <><RefreshCw size={13} /> Aplicar fondo</>}
              </button>
              {applying && (
                <span className="text-xs text-blue-700 font-semibold tabular-nums">{progress}%</span>
              )}
            </div>

            {/* Posición */}
            <div className="space-y-3">
              <SectionLabel>Posición y tamaño</SectionLabel>
              <Slider label="Tamaño del auto"     value={scale} min={10} max={120} unit="%" onChange={setScale} />
              <Slider label="Posición horizontal" value={posX}  min={0}  max={100} unit="%" onChange={setPosX} />
              <Slider label="Posición vertical"   value={posY}  min={0}  max={100} unit="%" onChange={setPosY} />
              <Toggle label="Sombra bajo el auto" value={shadow} onChange={setShadow} />
              {anyHorizontal && (
                <Toggle label="Reflejo (autos de perfil)" value={reflection} onChange={setReflection} />
              )}
            </div>
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
              ? `Exportar (${composedCount} con fondo)`
              : exteriorDone.length > 0
                ? `Exportar sin fondo (${exteriorDone.length})`
                : 'Exportar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
