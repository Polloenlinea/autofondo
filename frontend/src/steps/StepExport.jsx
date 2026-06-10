import { useState } from 'react'
import { Download, Archive, RotateCcw, Lock, Upload, Globe, Save, Check } from 'lucide-react'
import JSZip from 'jszip'
import { Btn, Card, SectionLabel, Spinner } from '../components/ui'
import WatermarkPanel from '../components/WatermarkPanel'
import { applyWatermarkToB64 } from '../utils/watermark'

const DEFAULT_WM = {
  logoFile: null, logoUrl: null, logoImg: null,
  position: 'bottom-right', sizePercent: 15, opacity: 0.75,
  enabled: false,
}

const SYSTEMS = [
  { id: 'usados', label: 'Sistema de Usados',             icon: Upload, color: 'text-blue-400' },
  { id: 'web',    label: 'Publicador Multiplataforma',    icon: Globe,  color: 'text-violet-400' },
]

export default function StepExport({ images, effectiveType, outputSize, onBack, onReset, saveSession }) {
  const [wm,          setWm]          = useState(DEFAULT_WM)
  const [downloading, setDownloading] = useState(false)
  const [dlProgress,  setDlProgress]  = useState(0)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [sessionName,   setSessionName]   = useState('')
  const [savedMsg,      setSavedMsg]      = useState(false)
  const [saveError,     setSaveError]     = useState(null)
  const [saving,        setSaving]        = useState(false)

  const processedImages = images.filter(img =>
    effectiveType(img) !== 'interior' && (img.composedB64 || img.cutoutB64)
  )
  const withBg     = images.filter(i => i.composedB64).length
  const cutoutOnly = images.filter(i => i.cutoutB64 && !i.composedB64).length
  const interior   = images.filter(i => effectiveType(i) === 'interior').length

  const imgSrc  = (img) => img.composedB64 || img.cutoutB64
  const imgMime = (img) => img.composedB64 ? 'jpeg' : 'png'
  const imgExt  = (img) => img.composedB64 ? 'jpg'  : 'png'
  const imgName = (img) => img.file.name.replace(/\.[^.]+$/, '') + `_af.${imgExt(img)}`

  const withWatermark = async (b64, mime) => {
    if (!wm.enabled || !wm.logoImg) return b64
    return applyWatermarkToB64(b64, mime, wm.logoImg, {
      position:    wm.position,
      sizePercent: wm.sizePercent,
      opacity:     wm.opacity,
    })
  }

  const downloadOne = async (img) => {
    const b64  = await withWatermark(imgSrc(img), imgMime(img))
    const mime = imgMime(img)
    const a    = document.createElement('a')
    a.href     = `data:image/${mime};base64,${b64}`
    a.download = imgName(img)
    a.click()
  }

  const downloadAll = async () => {
    if (!processedImages.length) return
    setDownloading(true)
    setDlProgress(0)
    const zip  = new JSZip()
    let done   = 0
    for (const img of processedImages) {
      const b64 = await withWatermark(imgSrc(img), imgMime(img))
      zip.file(imgName(img), b64, { base64: true })
      done++
      setDlProgress(Math.round(done / processedImages.length * 100))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `autofondo-${Date.now()}.zip`
    a.click()
    setDownloading(false)
  }

  const handleSaveSession = async () => {
    setSaveError(null)
    setSaving(true)
    try {
      if (saveSession) {
        await saveSession(sessionName, images)
      }
      setShowSaveModal(false)
      setSessionName('')
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 4000)
    } catch (err) {
      setSaveError(err.message || 'Error al guardar — revisá la conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-36">

      {/* ── Resumen ── */}
      <Card className="p-4">
        <SectionLabel>Resumen</SectionLabel>
        <div className="divide-y divide-slate-100">
          {[
            { label: 'Con fondo aplicado',        value: withBg,     show: withBg > 0     },
            { label: 'Solo recorte (sin fondo)',   value: cutoutOnly, show: cutoutOnly > 0 },
            { label: 'Interiores (sin procesar)',  value: interior,   show: interior > 0   },
          ].filter(r => r.show).map(row => (
            <div key={row.label} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-600">{row.label}</span>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Marca de agua ── */}
      <WatermarkPanel config={wm} onChange={setWm} />

      {/* ── Grid de resultados ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {processedImages.map(img => {
          const src  = imgSrc(img)
          const mime = imgMime(img)
          return (
            <div key={img.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className={`aspect-[4/3] overflow-hidden relative ${img.composedB64 ? 'bg-slate-100' : 'checker'}`}>
                <img src={`data:image/${mime};base64,${src}`}
                  className="w-full h-full object-contain" />
                {wm.enabled && wm.logoUrl && (
                  <img src={wm.logoUrl}
                    style={{
                      position: 'absolute',
                      opacity:  wm.opacity,
                      width:    `${wm.sizePercent}%`,
                      height:   'auto',
                      ...(wm.position === 'top-left'     && { top: '4%',   left:  '3%' }),
                      ...(wm.position === 'top-right'    && { top: '4%',   right: '3%' }),
                      ...(wm.position === 'bottom-left'  && { bottom: '4%',left:  '3%' }),
                      ...(wm.position === 'bottom-right' && { bottom: '4%',right: '3%' }),
                      ...(wm.position === 'center'       && { top: '50%',  left:  '50%', transform: 'translate(-50%,-50%)' }),
                    }}
                    alt=""
                  />
                )}
              </div>
              <div className="p-2 space-y-1.5">
                <p className="text-[11px] text-slate-400 truncate">{img.file.name}</p>

                <button onClick={() => downloadOne(img)}
                  className="flex items-center justify-center gap-1.5 w-full text-xs font-medium
                    text-slate-700 bg-slate-50 hover:bg-slate-100 py-1.5 rounded-lg transition-colors
                    border border-slate-200">
                  <Download size={11} /> Descargar
                </button>

                <div className="flex gap-1">
                  {SYSTEMS.map(sys => (
                    <button key={sys.id} disabled
                      title={`${sys.label} — próximamente`}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg
                        border border-slate-100 bg-slate-50 cursor-not-allowed">
                      <sys.icon size={10} className={`${sys.color} opacity-50`} />
                      <span className="text-[10px] text-slate-400 font-medium">
                        {sys.id === 'usados' ? 'Usados' : 'Web'}
                      </span>
                      <Lock size={8} className="text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Acciones fijas ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto space-y-2">

          {/* Toast guardado */}
          {savedMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-medium">
              <Check size={13} /> Lote guardado en el historial
            </div>
          )}

          {/* Descarga masiva — CTA principal */}
          <Btn variant="primary" size="full" onClick={downloadAll}
            disabled={downloading || !processedImages.length}>
            {downloading
              ? <><Spinner size="sm" /> Generando ZIP… {dlProgress}%</>
              : <><Archive size={14} /> Descargar todo ({processedImages.length}){wm.enabled ? ' + logo' : ''}</>}
          </Btn>

          {/* Fila secundaria: guardar lote + sistemas futuros */}
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => setShowSaveModal(true)}>
              <Save size={14} /> Guardar lote
            </Btn>
            {SYSTEMS.map(sys => (
              <button key={sys.id} disabled
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                  border border-slate-200 bg-slate-50 cursor-not-allowed">
                <sys.icon size={12} className={`${sys.color} opacity-50`} />
                <span className="text-xs font-medium text-slate-400 hidden sm:inline">{sys.label}</span>
                <Lock size={9} className="text-slate-300" />
              </button>
            ))}
          </div>

          {/* Fila navegación */}
          <div className="flex items-center gap-2">
            <Btn variant="secondary" onClick={onBack}>
              ← Volver a Fondos
            </Btn>
            <Btn variant="ghost" size="full" onClick={onReset}>
              <RotateCcw size={13} /> Nuevo lote
            </Btn>
          </div>
        </div>
      </div>

      {/* ── Modal guardar lote ── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => { if (!saving) setShowSaveModal(false) }}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-800 mb-3">Guardar lote</h3>
            <input
              type="text"
              placeholder={`Lote ${new Date().toLocaleDateString('es-AR')}`}
              value={sessionName}
              onChange={e => { setSessionName(e.target.value); setSaveError(null) }}
              onKeyDown={e => e.key === 'Enter' && !saving && handleSaveSession()}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              autoFocus
              disabled={saving}
            />
            {saveError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                ⚠️ {saveError}
              </div>
            )}
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setShowSaveModal(false)} disabled={saving}>Cancelar</Btn>
              <Btn variant="primary" size="full" onClick={handleSaveSession} disabled={saving}>
                {saving ? <><Spinner size="sm" /> Guardando…</> : 'Guardar'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
