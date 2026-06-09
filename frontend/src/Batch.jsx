import { useState, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import { Slider, Toggle, Spinner, b64ToBlob } from './ui'

const uid = () => Math.random().toString(36).slice(2, 9)

const STATUS_LABELS = {
  pending:    { text: 'En cola',    color: 'text-slate-400'   },
  processing: { text: 'Procesando', color: 'text-blue-600'    },
  done:       { text: 'Listo',      color: 'text-emerald-600' },
  error:      { text: 'Error',      color: 'text-red-500'     },
}

export default function Batch() {
  const [items,   setItems]   = useState([])
  const [bgFile,  setBgFile]  = useState(null)
  const [bgUrl,   setBgUrl]   = useState(null)
  const [scale,   setScale]   = useState(80)
  const [posX,    setPosX]    = useState(50)
  const [posY,    setPosY]    = useState(60)
  const [shadow,  setShadow]  = useState(true)
  const [running, setRunning] = useState(false)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [zoom,    setZoom]    = useState(null)
  const stopRef = useRef(false)

  // ── Agregar imágenes ────────────────────────────────────────────────────
  const addFiles = useCallback((files) => {
    const news = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        id: uid(), file: f,
        previewUrl: URL.createObjectURL(f),
        cutoutB64: null, composedB64: null,
        status: 'pending', error: null,
      }))
    setItems(prev => [...prev, ...news])
  }, [])

  // ── Procesar una imagen ──────────────────────────────────────────────────
  const processOne = async (item, bgF, sc, px, py, sh) => {
    const form1 = new FormData()
    form1.append('file',          item.file)
    form1.append('alpha_matting', 'true')
    form1.append('fg_threshold',  '240')
    form1.append('bg_threshold',  '10')
    form1.append('erode_size',    '10')

    const r1   = await fetch('/remove-bg', { method: 'POST', body: form1 })
    const d1   = await r1.json()
    if (!d1.ok) throw new Error(d1.error || 'Error al recortar')
    const cutB64 = d1.image

    let compB64 = null
    if (bgF) {
      const form2 = new FormData()
      form2.append('car',        b64ToBlob(cutB64, 'image/png'), 'car.png')
      form2.append('background', bgF)
      form2.append('scale',      sc)
      form2.append('pos_x',      px)
      form2.append('pos_y',      py)
      form2.append('shadow',     sh)

      const r2 = await fetch('/compose', { method: 'POST', body: form2 })
      const d2 = await r2.json()
      if (!d2.ok) throw new Error(d2.error || 'Error al componer')
      compB64 = d2.image
    }
    return { cutB64, compB64 }
  }

  // ── Procesar cola ────────────────────────────────────────────────────────
  const processAll = useCallback(async () => {
    const pending = items.filter(i => i.status === 'pending' || i.status === 'error')
    if (!pending.length) return
    setRunning(true)
    stopRef.current = false

    for (const item of pending) {
      if (stopRef.current) break
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i))
      try {
        const { cutB64, compB64 } = await processOne(item, bgFile, scale, posX, posY, shadow)
        setItems(prev => prev.map(i => i.id === item.id
          ? { ...i, status: 'done', cutoutB64: cutB64, composedB64: compB64 }
          : i))
      } catch (e) {
        setItems(prev => prev.map(i => i.id === item.id
          ? { ...i, status: 'error', error: e.message }
          : i))
      }
    }
    setRunning(false)
  }, [items, bgFile, scale, posX, posY, shadow])

  // ── Re-componer todas con nuevo fondo ─────────────────────────────────────
  const recomposeAll = useCallback(async () => {
    if (!bgFile) return
    const done = items.filter(i => i.status === 'done' && i.cutoutB64)
    if (!done.length) return
    setRunning(true)
    stopRef.current = false

    for (const item of done) {
      if (stopRef.current) break
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i))
      try {
        const form = new FormData()
        form.append('car',        b64ToBlob(item.cutoutB64, 'image/png'), 'car.png')
        form.append('background', bgFile)
        form.append('scale',      scale)
        form.append('pos_x',      posX)
        form.append('pos_y',      posY)
        form.append('shadow',     shadow)
        const res  = await fetch('/compose', { method: 'POST', body: form })
        const data = await res.json()
        setItems(prev => prev.map(i => i.id === item.id
          ? { ...i, status: 'done', composedB64: data.ok ? data.image : i.composedB64 }
          : i))
      } catch {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done' } : i))
      }
    }
    setRunning(false)
  }, [items, bgFile, scale, posX, posY, shadow])

  // ── Descargar ZIP ─────────────────────────────────────────────────────────
  const downloadZip = async () => {
    const ready = items.filter(i => i.status === 'done')
    if (!ready.length) return
    const zip = new JSZip()
    ready.forEach(item => {
      const b64  = item.composedB64 || item.cutoutB64
      const ext  = item.composedB64 ? 'jpg' : 'png'
      const name = item.file.name.replace(/\.[^.]+$/, '') + `_af.${ext}`
      zip.file(name, b64, { base64: true })
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `autofondo-${Date.now()}.zip`
    a.click()
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total     = items.length
  const doneCount = items.filter(i => i.status === 'done').length
  const pendCount = items.filter(i => i.status === 'pending' || i.status === 'error').length
  const progress  = total ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="space-y-4 pb-28">  {/* pb-28 para el sticky bar */}

      {/* ── Drop zone (siempre visible) ── */}
      <DropZoneMulti onFiles={addFiles} count={total} />

      {total > 0 && <>

        {/* ── Panel de configuración (acordeón) ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setCfgOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4
              text-sm font-semibold text-slate-700 active:bg-slate-50 select-none"
          >
            <span>⚙️ Configuración del fondo</span>
            <span className={`text-slate-400 transition-transform duration-200 ${cfgOpen ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>

          {cfgOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">

              {/* Upload fondo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Fondo para todas las imágenes
                </label>
                <label className={`block cursor-pointer rounded-xl border-2 border-dashed overflow-hidden transition-all
                  ${bgUrl ? 'border-transparent' : 'border-slate-300 bg-slate-50 active:border-blue-400'}`}>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files[0]
                      if (f) { setBgFile(f); setBgUrl(URL.createObjectURL(f)) }
                    }} />
                  {bgUrl
                    ? (
                      <div className="relative">
                        <img src={bgUrl} className="w-full max-h-32 object-contain bg-slate-100" />
                        <div className="absolute inset-0 flex items-center justify-center
                          bg-black/0 active:bg-black/10 transition-colors">
                          <span className="bg-black/50 text-white text-xs font-semibold px-3 py-1 rounded-lg
                            opacity-0 hover:opacity-100 transition-opacity">Cambiar</span>
                        </div>
                      </div>
                    )
                    : (
                      <div className="flex flex-col items-center py-7 text-center gap-1">
                        <span className="text-3xl">🖼️</span>
                        <p className="text-sm font-semibold text-slate-600 mt-1">Tocá para subir el fondo</p>
                        <p className="text-xs text-slate-400">Si no subís fondo, se descarga el recorte transparente</p>
                      </div>
                    )
                  }
                </label>
              </div>

              <Slider label="Tamaño del auto"     value={scale} min={10} max={120} unit="%" onChange={setScale} />
              <Slider label="Posición horizontal" value={posX}  min={0}  max={100} unit="%" onChange={setPosX} />
              <Slider label="Posición vertical"   value={posY}  min={0}  max={100} unit="%" onChange={setPosY} />
              <Toggle label="Agregar sombra"      value={shadow} onChange={setShadow} />

              {/* Re-componer con nuevo fondo */}
              {bgUrl && doneCount > 0 && (
                <button onClick={recomposeAll} disabled={running}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600
                    disabled:bg-slate-300 disabled:cursor-not-allowed active:bg-blue-800
                    text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  {running ? <><Spinner /> Procesando…</> : '🔄 Re-aplicar fondo a todas'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Barra de progreso ── */}
        {running && (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">{doneCount}/{total}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-bold text-blue-600 whitespace-nowrap">{progress}%</span>
          </div>
        )}

        {/* ── Grid de imágenes ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map(item => (
            <GridItem
              key={item.id}
              item={item}
              onRemove={() => !running && setItems(prev => prev.filter(i => i.id !== item.id))}
              onZoom={() => setZoom(item)}
            />
          ))}
        </div>

      </>}

      {/* ── Barra de acción sticky ── */}
      {total > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm
          border-t border-slate-200 px-4 py-3 pb-safe">
          <div className="max-w-2xl mx-auto flex gap-3">

            {/* Detener / Procesar */}
            {running
              ? (
                <button onClick={() => { stopRef.current = true }}
                  className="flex-1 flex items-center justify-center gap-2 border border-slate-200
                    text-slate-600 font-semibold py-3 rounded-xl text-sm active:bg-slate-50 transition-colors">
                  ✕ Detener
                </button>
              )
              : (
                <button onClick={processAll} disabled={pendCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600
                    disabled:bg-slate-300 disabled:cursor-not-allowed active:bg-blue-800
                    text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-sm">
                  ✂️ Procesar {pendCount > 0 ? pendCount : 'todas'}
                </button>
              )
            }

            {/* Limpiar */}
            {!running && (
              <button onClick={() => { setItems([]); setZoom(null) }}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-500
                  font-semibold text-sm active:bg-slate-50 transition-colors">
                🗑️
              </button>
            )}

            {/* Descargar ZIP */}
            {doneCount > 0 && (
              <button onClick={downloadZip}
                className="flex items-center justify-center gap-1.5 bg-emerald-600
                  active:bg-emerald-800 text-white font-semibold px-4 py-3
                  rounded-xl text-sm transition-colors shadow-sm whitespace-nowrap">
                ⬇️ ZIP ({doneCount})
              </button>
            )}

          </div>
        </div>
      )}

      {/* ── Modal zoom ── */}
      {zoom && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setZoom(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <span className="font-semibold text-sm text-slate-700 truncate pr-4">{zoom.file.name}</span>
              <button onClick={() => setZoom(null)}
                className="text-slate-400 active:text-slate-700 text-xl leading-none w-8 h-8
                  flex items-center justify-center rounded-lg active:bg-slate-100">
                ✕
              </button>
            </div>

            {/* Imágenes */}
            <div className="p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Original</p>
                <img src={zoom.previewUrl} className="w-full rounded-xl object-contain bg-slate-100" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {zoom.composedB64 ? 'Compuesto' : zoom.cutoutB64 ? 'Recortado' : 'Pendiente'}
                </p>
                {(zoom.composedB64 || zoom.cutoutB64)
                  ? (
                    <div className={`rounded-xl overflow-hidden ${zoom.composedB64 ? '' : 'checker'}`}>
                      <img
                        src={`data:image/${zoom.composedB64 ? 'jpeg' : 'png'};base64,${zoom.composedB64 || zoom.cutoutB64}`}
                        className="w-full object-contain"
                      />
                    </div>
                  )
                  : (
                    <div className="w-full aspect-square bg-slate-100 rounded-xl flex items-center
                      justify-center text-slate-400 text-sm text-center px-3">
                      {zoom.status === 'error' ? '❌ ' + zoom.error : '⌛ Pendiente'}
                    </div>
                  )
                }
              </div>
            </div>

            {/* Descargar */}
            {(zoom.composedB64 || zoom.cutoutB64) && (
              <div className="px-4 pb-5">
                <a
                  href={`data:image/${zoom.composedB64 ? 'jpeg' : 'png'};base64,${zoom.composedB64 || zoom.cutoutB64}`}
                  download={zoom.file.name.replace(/\.[^.]+$/, '') + '_af.' + (zoom.composedB64 ? 'jpg' : 'png')}
                  className="block w-full text-center bg-emerald-600 active:bg-emerald-800
                    text-white font-semibold py-3.5 rounded-xl text-sm transition-colors"
                >
                  ⬇️ Descargar esta imagen
                </a>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Drop zone múltiple ─────────────────────────────────────────────────────────
function DropZoneMulti({ onFiles, count }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files) }}
      onClick={() => ref.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all
        flex flex-col items-center justify-center py-10 text-center
        ${drag
          ? 'border-blue-500 bg-blue-50 scale-[1.01]'
          : 'border-slate-300 bg-white active:border-blue-400 active:bg-blue-50/50'}`}
    >
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={e => onFiles(e.target.files)} />
      <span className="text-4xl mb-3">{drag ? '📂' : '🚗'}</span>
      <p className="text-lg font-extrabold text-slate-800 mb-1">
        {count > 0 ? `Agregar más fotos (${count} cargadas)` : 'Subí todas las fotos'}
      </p>
      <p className="text-slate-500 text-sm mb-5">Podés elegir múltiples a la vez</p>
      <span className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm pointer-events-none shadow-sm">
        Seleccionar fotos
      </span>
    </div>
  )
}

// ── Item de la grilla ──────────────────────────────────────────────────────────
function GridItem({ item, onRemove, onZoom }) {
  const s = STATUS_LABELS[item.status]
  const resultB64  = item.composedB64 || item.cutoutB64
  const resultMime = item.composedB64 ? 'jpeg' : 'png'

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm
      active:shadow-md transition-shadow">

      {/* Imagen */}
      <div
        className={`aspect-square overflow-hidden relative cursor-pointer
          ${!resultB64 ? 'bg-slate-100' : resultB64 === item.cutoutB64 && !item.composedB64 ? 'checker' : ''}`}
        onClick={onZoom}
      >
        {resultB64
          ? <img src={`data:image/${resultMime};base64,${resultB64}`}
              className="w-full h-full object-contain" />
          : <img src={item.previewUrl}
              className="w-full h-full object-cover opacity-40" />
        }

        {/* Overlay de estado */}
        {item.status === 'processing' && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Spinner size="md" color="text-blue-600" />
          </div>
        )}
        {item.status === 'error' && (
          <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-2 gap-1">
            <span className="text-xl">❌</span>
            <span className="text-xs text-red-500 text-center leading-tight">{item.error}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-2 flex items-center justify-between gap-1">
        <span className={`text-xs font-semibold truncate ${s.color}`}>{s.text}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {resultB64 && (
            <a href={`data:image/${resultMime};base64,${resultB64}`}
              download={item.file.name.replace(/\.[^.]+$/, '') + '_af.' + resultMime}
              className="w-7 h-7 flex items-center justify-center text-slate-400
                active:text-emerald-600 transition-colors text-xs rounded-lg active:bg-slate-100"
              onClick={e => e.stopPropagation()}
              title="Descargar">
              ⬇️
            </a>
          )}
          <button onClick={e => { e.stopPropagation(); onRemove() }}
            className="w-7 h-7 flex items-center justify-center text-slate-400
              active:text-red-500 transition-colors text-xs rounded-lg active:bg-slate-100"
            title="Quitar">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
