import { useState, useCallback, useRef } from 'react'
import { Slider, Toggle, Spinner, b64ToBlob } from './ui'

// ── Estados posibles ──────────────────────────────────────────────────────────
// idle → processing → done → (composing → composed)

export default function Individual() {
  const [file,        setFile]        = useState(null)
  const [origUrl,     setOrigUrl]     = useState(null)
  const [cutoutB64,   setCutoutB64]   = useState(null)
  const [composedB64, setComposedB64] = useState(null)
  const [status,      setStatus]      = useState('idle')
  const [error,       setError]       = useState(null)

  // Vista previa del recorte
  const [bgMode,  setBgMode]  = useState('checker')

  // Composición
  const [compOpen,  setCompOpen]  = useState(false)
  const [bgFile,    setBgFile]    = useState(null)
  const [bgUrl,     setBgUrl]     = useState(null)
  const [scale,     setScale]     = useState(80)
  const [posX,      setPosX]      = useState(50)
  const [posY,      setPosY]      = useState(60)
  const [shadow,    setShadow]    = useState(true)

  // ── Procesar imagen ───────────────────────────────────────────────────────
  const processFile = useCallback(async (f) => {
    setFile(f)
    setOrigUrl(URL.createObjectURL(f))
    setCutoutB64(null)
    setComposedB64(null)
    setError(null)
    setStatus('processing')
    setCompOpen(false)
    setBgMode('checker')

    try {
      const form = new FormData()
      form.append('file',          f)
      form.append('alpha_matting', 'true')
      form.append('fg_threshold',  '240')
      form.append('bg_threshold',  '10')
      form.append('erode_size',    '10')

      const res  = await fetch('/remove-bg', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error del servidor')

      setCutoutB64(data.image)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }, [])

  // ── Componer ──────────────────────────────────────────────────────────────
  const compose = useCallback(async () => {
    if (!cutoutB64 || !bgFile) return
    setStatus('composing')
    setComposedB64(null)

    try {
      const form = new FormData()
      form.append('car',        b64ToBlob(cutoutB64, 'image/png'), 'car.png')
      form.append('background', bgFile)
      form.append('scale',      scale)
      form.append('pos_x',      posX)
      form.append('pos_y',      posY)
      form.append('shadow',     shadow)

      const res  = await fetch('/compose', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error del servidor')

      setComposedB64(data.image)
      setStatus('composed')
    } catch (e) {
      setError(e.message)
      setStatus('done')
    }
  }, [cutoutB64, bgFile, scale, posX, posY, shadow])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setFile(null); setOrigUrl(null); setCutoutB64(null); setComposedB64(null)
    setStatus('idle'); setError(null)
    setBgFile(null); setBgUrl(null); setCompOpen(false)
    setBgMode('checker')
  }

  // ── IDLE: zona de carga ───────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className="space-y-5">
        <div className="text-center pt-2 pb-1">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1 leading-tight">
            Sacale el fondo<br />a tu auto
          </h1>
          <p className="text-slate-500 text-sm">La IA elimina el fondo en segundos</p>
        </div>
        <DropZone onFile={processFile} single />
      </div>
    )
  }

  // ── PROCESSING ────────────────────────────────────────────────────────────
  if (status === 'processing') {
    return (
      <div className="space-y-4">
        <ImgCard src={origUrl} label="Original" />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm
          flex flex-col items-center justify-center py-16 gap-4">
          <Spinner size="lg" />
          <div className="text-center">
            <p className="font-semibold text-slate-700">Eliminando el fondo…</p>
            <p className="text-slate-400 text-sm mt-0.5">La IA está trabajando</p>
          </div>
        </div>
      </div>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="text-2xl mb-2">❌</p>
          <p className="font-semibold text-red-700">Ocurrió un error</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
        </div>
        <BtnSecondary onClick={reset}>← Intentar de nuevo</BtnSecondary>
      </div>
    )
  }

  // ── DONE / COMPOSING / COMPOSED ───────────────────────────────────────────
  const isComposing = status === 'composing'
  const bgClass = bgMode === 'checker' ? 'checker' : bgMode === 'white' ? 'bg-white' : 'bg-slate-900'

  return (
    <div className="space-y-4 pb-safe">

      {/* — Resultado del recorte — */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resultado</p>

        {/* Toggle de fondo */}
        <div className="flex gap-2">
          {[['checker','Cuadros'], ['white','Blanco'], ['black','Negro']].map(([m, label]) => (
            <button key={m} onClick={() => setBgMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border
                ${bgMode === m
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'text-slate-600 border-slate-200 bg-slate-50 active:bg-slate-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Imagen resultado */}
        <div className={`rounded-xl overflow-hidden ${bgClass}`}>
          <img
            src={`data:image/png;base64,${cutoutB64}`}
            className="w-full object-contain max-h-72"
            alt="Recorte sin fondo"
          />
        </div>

        {/* Descargar PNG */}
        <a
          href={`data:image/png;base64,${cutoutB64}`}
          download={(file?.name ?? 'auto').replace(/\.[^.]+$/, '') + '_sin_fondo.png'}
          className="flex items-center justify-center gap-2 w-full bg-blue-600
            active:bg-blue-800 text-white font-semibold py-3.5 rounded-xl text-sm
            transition-colors shadow-sm"
        >
          ⬇️ Descargar PNG sin fondo
        </a>
      </div>

      {/* — Agregar fondo personalizado (acordeón) — */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setCompOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4
            text-sm font-semibold text-slate-700 active:bg-slate-50 select-none"
        >
          <span>🖼️ Agregar fondo personalizado</span>
          <span className={`text-slate-400 transition-transform duration-200 ${compOpen ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>

        {compOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">

            {/* Upload fondo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Imagen de fondo
              </label>
              <label className={`block cursor-pointer rounded-xl border-2 border-dashed overflow-hidden transition-all
                ${bgUrl ? 'border-transparent' : 'border-slate-300 bg-slate-50 active:border-blue-400'}`}>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files[0]
                    if (f) { setBgFile(f); setBgUrl(URL.createObjectURL(f)); setComposedB64(null) }
                  }} />
                {bgUrl
                  ? (
                    <div className="relative group">
                      <img src={bgUrl} className="w-full max-h-36 object-contain bg-slate-100" />
                      <div className="absolute inset-0 bg-black/0 active:bg-black/10 transition-colors
                        flex items-center justify-center">
                        <span className="bg-black/50 text-white text-xs font-semibold px-3 py-1
                          rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          Cambiar
                        </span>
                      </div>
                    </div>
                  )
                  : (
                    <div className="flex flex-col items-center py-8 text-center gap-1">
                      <span className="text-3xl">🖼️</span>
                      <p className="text-sm font-semibold text-slate-600 mt-1">Tocá para subir el fondo</p>
                      <p className="text-xs text-slate-400">JPG, PNG o WEBP</p>
                    </div>
                  )
                }
              </label>
            </div>

            {/* Sliders */}
            <Slider label="Tamaño del auto"      value={scale} min={10} max={120} unit="%" onChange={setScale} />
            <Slider label="Posición horizontal"  value={posX}  min={0}  max={100} unit="%" onChange={setPosX} />
            <Slider label="Posición vertical"    value={posY}  min={0}  max={100} unit="%" onChange={setPosY} />
            <Toggle label="Agregar sombra"       value={shadow} onChange={setShadow} />

            {/* Botón componer */}
            <button
              onClick={compose}
              disabled={!bgFile || isComposing}
              className="flex items-center justify-center gap-2 w-full bg-blue-600
                disabled:bg-slate-300 disabled:cursor-not-allowed active:bg-blue-800
                text-white font-semibold py-3.5 rounded-xl text-sm transition-colors shadow-sm"
            >
              {isComposing ? <><Spinner /> Componiendo…</> : '🖼️ Componer imagen'}
            </button>

            {/* Resultado compuesto */}
            {composedB64 && (
              <div className="space-y-3">
                <img
                  src={`data:image/jpeg;base64,${composedB64}`}
                  className="w-full rounded-xl shadow-sm"
                  alt="Imagen compuesta"
                />
                <a
                  href={`data:image/jpeg;base64,${composedB64}`}
                  download={(file?.name ?? 'auto').replace(/\.[^.]+$/, '') + '_compuesto.jpg'}
                  className="flex items-center justify-center gap-2 w-full bg-emerald-600
                    active:bg-emerald-800 text-white font-semibold py-3.5 rounded-xl text-sm
                    transition-colors shadow-sm"
                >
                  ⬇️ Descargar imagen final
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* — Nueva foto — */}
      <BtnSecondary onClick={reset}>← Nueva foto</BtnSecondary>

    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DropZone({ onFile }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f?.type.startsWith('image/')) onFile(f)
      }}
      onClick={() => ref.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all
        flex flex-col items-center justify-center py-16 text-center
        ${drag
          ? 'border-blue-500 bg-blue-50 scale-[1.01]'
          : 'border-slate-300 bg-white active:border-blue-400 active:bg-blue-50/50'}`}
    >
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files[0]; if (f) onFile(f) }} />
      <span className="text-5xl mb-4">{drag ? '📂' : '🚗'}</span>
      <p className="text-lg font-extrabold text-slate-800 mb-1">
        {drag ? 'Soltá la foto' : 'Subí una foto de tu auto'}
      </p>
      <p className="text-slate-500 text-sm mb-6">JPG, PNG o WEBP</p>
      <span className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl text-sm pointer-events-none shadow-sm">
        Elegir foto
      </span>
    </div>
  )
}

function ImgCard({ src, label }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {label && <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-4 pt-3">{label}</p>}
      <img src={src} className="w-full object-contain max-h-64 mt-2" alt={label} />
    </div>
  )
}

function BtnSecondary({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="w-full py-3.5 rounded-xl border border-slate-200 bg-white
        text-sm font-semibold text-slate-500 active:bg-slate-50 transition-colors">
      {children}
    </button>
  )
}
