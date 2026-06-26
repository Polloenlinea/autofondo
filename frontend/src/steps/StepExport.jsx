import { useState } from 'react'
import { Download, Archive, RotateCcw, Lock, Save, Pencil, ZoomIn, X } from 'lucide-react'
import JSZip from 'jszip'
import { Btn, Card, SectionLabel, Spinner } from '../components/ui'
import WatermarkPanel from '../components/WatermarkPanel'
import { applyWatermarkToB64, averageBrightnessB64 } from '../utils/watermark'

const DEFAULT_WM = {
  logoFile: null, logoUrl: null, logoImg: null,            // logo principal (oscuro, para fondos claros)
  logoFileLight: null, logoUrlLight: null, logoImgLight: null, // versión clara (para fondos oscuros)
  autoContrast: false,                                     // elegir logo según brillo del fondo
  position: 'bottom-right', sizePercent: 15, opacity: 0.75,
  enabled: false,
}

// Destinos de publicación (próximamente) — se muestran desactivados para que se
// conozca la opción. Logos isotipo de cada producto del ecosistema.
const PUBLISH = [
  { id: 'multipost', label: 'Multipost', iso: '/brands/iso-multipost.png' },
  { id: 'autoferta', label: 'Autoferta', iso: '/brands/iso-autoferta.png' },
]

export default function StepExport({ images, effectiveType, outputSize, removeImage, onEdit, onZoom, onBack, onReset, onSaveDraft }) {
  const [wm,          setWm]          = useState(DEFAULT_WM)
  const [downloading, setDownloading] = useState(false)
  const [dlProgress,  setDlProgress]  = useState(0)

  // TODAS las fotos del lote: exteriores (con/sin fondo) + interiores (originales).
  // Para una publicación se descargan todas, con marca de agua en todas.
  const exportImages = images.filter(img => img.composedB64 || img.cutoutB64 || img.previewUrl)
  const withBg     = images.filter(i => i.composedB64).length
  const interior   = images.filter(i => effectiveType(i) === 'interior').length

  // Origen para MOSTRAR (URL lista para <img src>)
  const displaySrc = (img) =>
    img.composedB64 ? `data:image/jpeg;base64,${img.composedB64}`
    : img.cutoutB64  ? `data:image/png;base64,${img.cutoutB64}`
    : img.previewUrl
  const isCheckerCard = (img) => !!img.cutoutB64 && !img.composedB64

  // File → base64 (para interiores / fotos sin procesar, que se leen del original)
  const fileToB64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })

  // Origen REAL (base64 + mime) para descargar/marca de agua — async por los interiores
  const getSource = async (img) => {
    if (img.composedB64) return { b64: img.composedB64, mime: 'jpeg', ext: 'jpg' }
    if (img.cutoutB64)   return { b64: img.cutoutB64,   mime: 'png',  ext: 'png' }
    const b64   = await fileToB64(img.file)
    const isPng = (img.file?.type || '').includes('png')
    return { b64, mime: isPng ? 'png' : 'jpeg', ext: isPng ? 'png' : 'jpg' }
  }

  const imgName = (img, ext) => img.file.name.replace(/\.[^.]+$/, '') + `_af.${ext}`

  const withWatermark = async (b64, mime) => {
    if (!wm.enabled) return b64
    // Elegir logo: si está el modo auto y hay ambas versiones, elegir según el
    // brillo del fondo (logo oscuro sobre fondos claros, claro sobre oscuros).
    let logo = wm.logoImg || wm.logoImgLight
    if (wm.autoContrast && wm.logoImg && wm.logoImgLight) {
      const brightness = await averageBrightnessB64(b64, mime)
      logo = brightness < 130 ? wm.logoImgLight : wm.logoImg
    }
    if (!logo) return b64
    return applyWatermarkToB64(b64, mime, logo, {
      position:    wm.position,
      sizePercent: wm.sizePercent,
      opacity:     wm.opacity,
    })
  }

  const downloadOne = async (img) => {
    const { b64, mime, ext } = await getSource(img)
    const final = await withWatermark(b64, mime)
    const a = document.createElement('a')
    a.href = `data:image/${mime};base64,${final}`
    a.download = imgName(img, ext)
    a.click()
  }

  const downloadAll = async () => {
    if (!exportImages.length) return
    setDownloading(true)
    setDlProgress(0)
    const zip  = new JSZip()
    let done   = 0
    for (const img of exportImages) {
      const { b64, mime, ext } = await getSource(img)
      const final = await withWatermark(b64, mime)
      zip.file(imgName(img, ext), final, { base64: true })
      done++
      setDlProgress(Math.round(done / exportImages.length * 100))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `autofondo-${Date.now()}.zip`
    a.click()
    setDownloading(false)
  }

  return (
    <div className="space-y-4 pb-36">

      {/* ── Resumen ── */}
      <Card className="p-4">
        <SectionLabel>Resumen</SectionLabel>
        <div className="divide-y divide-slate-100">
          {[
            { label: 'Con fondo aplicado',          value: withBg,               show: withBg > 0   },
            { label: 'Interiores (originales)',     value: interior,             show: interior > 0 },
            { label: 'Total a descargar',           value: exportImages.length,  show: true         },
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
        {exportImages.map(img => {
          const src = displaySrc(img)
          return (
            <div key={img.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden group">
              <div className={`aspect-[4/3] overflow-hidden relative ${isCheckerCard(img) ? 'checker' : 'bg-slate-100'}
                ${onZoom ? 'cursor-zoom-in' : ''}`}
                onClick={onZoom ? () => onZoom(img.id) : undefined}>
                <img src={src}
                  className="w-full h-full object-contain" />

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
                {/* Hover overlay */}
                {onZoom && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors
                    flex items-end justify-between p-1.5 pointer-events-none">
                    <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    {onEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); onEdit(img.id) }}
                        className="pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity
                          flex items-center gap-1 px-2 py-1 bg-blue-700 text-white rounded-md
                          text-[10px] font-semibold hover:bg-blue-800 shadow-md">
                        <Pencil size={9} /> Editar
                      </button>
                    )}
                  </div>
                )}
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
                    text-slate-700 bg-slate-50 hover:bg-slate-100 py-2.5 sm:py-1.5 rounded-lg transition-colors
                    border border-slate-200 min-h-[40px] sm:min-h-0">
                  <Download size={11} /> Descargar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Acciones fijas ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto space-y-2">

          {/* Acciones principales — MISMO peso: Descargar (activo) + Publicar
              (próximamente, desactivados). Apiladas, todas del mismo tamaño. */}
          <button onClick={downloadAll}
            disabled={downloading || !exportImages.length}
            className="w-full relative flex items-center justify-center gap-2 py-3 rounded-xl min-h-[50px]
              bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {downloading
              ? <><Spinner size="sm" /> Generando ZIP… {dlProgress}%</>
              : <><Archive size={16} /> Descargar todo ({exportImages.length}){wm.enabled ? ' + logo' : ''}</>}
          </button>

          {PUBLISH.map(p => (
            <button key={p.id} disabled
              title={`Publicar en ${p.label} — próximamente`}
              className="w-full relative flex items-center justify-center gap-2 py-3 rounded-xl min-h-[50px]
                border border-slate-200 bg-slate-50 text-slate-500 text-sm font-semibold cursor-not-allowed">
              <img src={p.iso} alt="" className="w-5 h-5 object-contain opacity-60 flex-shrink-0" />
              <span>Publicar en {p.label}</span>
              <span className="absolute top-1.5 right-2.5 flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                <Lock size={8} /> Pronto
              </span>
            </button>
          ))}

          {/* Guardar borrador (modal global) */}
          <Btn variant="secondary" size="full" onClick={onSaveDraft}>
            <Save size={14} /> Guardar borrador
          </Btn>

          {/* Fila navegación */}
          <div className="flex items-center gap-2">
            <Btn variant="secondary" className="flex-1" onClick={onBack}>
              ← Volver a Fondos
            </Btn>
            <Btn variant="ghost" className="flex-1" onClick={onReset}>
              <RotateCcw size={13} /> Nuevo lote
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
