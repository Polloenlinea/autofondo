import { useState } from 'react'
import { ImagePlus, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Btn, Slider, Card, SectionLabel } from './ui'
import { useWmHistory } from '../hooks/useWmHistory'

const POSITIONS = [
  { id: 'top-left',     label: '↖' },
  { id: 'top-right',    label: '↗' },
  { id: 'center',       label: '·' },
  { id: 'bottom-left',  label: '↙' },
  { id: 'bottom-right', label: '↘' },
]

/**
 * Panel de configuración de marca de agua.
 * Llama a onChange({ file, logoImg, position, sizePercent, opacity, enabled })
 * cuando algo cambia.
 */
export default function WatermarkPanel({ config, onChange }) {
  const { logoFile, logoUrl, logoImg, logoUrlLight, autoContrast, position, sizePercent, opacity, enabled } = config
  const { recent: recentWms, addWm, deleteWm } = useWmHistory()

  // Logo "claro" (para fondos oscuros) — opcional, habilita el cambio automático
  const handleLightLogoUpload = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      const img = new Image()
      img.onload = () => onChange({ ...config, logoFileLight: f, logoUrlLight: dataUrl, logoImgLight: img })
      img.src = dataUrl
    }
    reader.readAsDataURL(f)
  }
  const removeLightLogo = () =>
    onChange({ ...config, logoFileLight: null, logoUrlLight: null, logoImgLight: null, autoContrast: false })
  // Colapsar la config cuando ya hay logo cargado (para no tapar el contenido)
  const [configOpen, setConfigOpen] = useState(false)

  const handleLogoUpload = (e) => {
    const f = e.target.files[0]
    if (!f) return

    // Leer como data URL para poder persistir en MongoDB
    // (los blob: URLs son temporales y se invalidan al recargar la página)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      const img = new Image()
      img.onload = () => {
        onChange({ ...config, logoFile: f, logoUrl: dataUrl, logoImg: img, enabled: true })
        addWm(f, dataUrl)
        setConfigOpen(true) // abrir config al cargar un logo nuevo
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(f)
  }

  const removeLogo = () => {
    onChange({ ...config, logoFile: null, logoUrl: null, logoImg: null, enabled: false })
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <SectionLabel className="mb-0">Marca de agua / Logo</SectionLabel>
        <div className="flex items-center gap-2">
          {logoUrl && (
            <>
              {/* Toggle activa/desactiva */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={enabled}
                  onChange={e => onChange({ ...config, enabled: e.target.checked })} />
                <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-blue-700
                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white
                  after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                <span className="ml-2 text-xs font-medium text-slate-600">
                  {enabled ? 'Activa' : 'Desactivada'}
                </span>
              </label>
              {/* Colapsar/expandir config */}
              <button onClick={() => setConfigOpen(v => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                {configOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Subir logo o estado del logo cargado */}
        {logoUrl ? (
          <div className="flex items-center gap-3 bg-green-50 rounded-lg px-3 py-2.5 border border-green-200">
            <img src={logoUrl} className="h-8 max-w-[5rem] object-contain flex-shrink-0" alt="Logo" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Check size={11} className="text-green-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-green-700">Logo activo — se aplica al descargar</p>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{logoFile?.name || 'logo'}</p>
            </div>
            <button onClick={removeLogo}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 cursor-pointer transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <ImagePlus size={16} className="text-slate-400" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium text-slate-600">Subir logo o marca de agua</p>
                <p className="text-xs text-slate-400">PNG con fondo transparente recomendado</p>
              </div>
            </label>

            {/* Logos recientes */}
            {recentWms.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Logos recientes</p>
                <div className="flex gap-2 flex-wrap">
                  {recentWms.map(wm => (
                    <div key={wm._id} className="relative group">
                      <button
                        onClick={() => {
                          const img = new Image()
                          img.onload = () => {
                            onChange({ ...config, logoFile: null, logoUrl: wm.dataUrl, logoImg: img, enabled: true })
                            setConfigOpen(true)
                          }
                          img.src = wm.dataUrl
                        }}
                        className="w-16 h-10 rounded-lg border-2 border-slate-200 hover:border-blue-400 overflow-hidden bg-slate-50 transition-colors p-1 block">
                        <img src={wm.dataUrl} className="w-full h-full object-contain" alt={wm.name} />
                      </button>
                      <button
                        onClick={() => deleteWm(wm._id)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Config del logo (colapsable) */}
        {logoUrl && configOpen && (
          <div className="space-y-3 pt-1 border-t border-slate-100">

            {/* Versión clara (para fondos oscuros) + cambio automático */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Versión clara (fondos oscuros)</p>
              {logoUrlLight ? (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-slate-800">
                  <img src={logoUrlLight} className="h-7 max-w-[5rem] object-contain flex-shrink-0" alt="Logo claro" />
                  <span className="text-[11px] text-slate-300 flex-1">Logo claro cargado</span>
                  <button onClick={removeLightLogo} className="text-slate-400 hover:text-red-400 flex-shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLightLogoUpload} />
                  <ImagePlus size={14} className="text-slate-400" strokeWidth={1.5} />
                  <span className="text-xs text-slate-500">Subir logo claro (blanco) para fondos oscuros</span>
                </label>
              )}
              {logoUrl && logoUrlLight && (
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-600">Cambiar logo automáticamente según el fondo</span>
                  <input type="checkbox" className="w-4 h-4 accent-blue-700"
                    checked={!!autoContrast}
                    onChange={e => onChange({ ...config, autoContrast: e.target.checked })} />
                </label>
              )}
            </div>

            {/* Posición */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Posición</p>
              <div className="grid grid-cols-3 gap-1.5 w-fit">
                {[
                  { id: 'top-left',     label: '↖' }, { id: null, label: '' }, { id: 'top-right',    label: '↗' },
                  { id: null, label: '' },             { id: 'center', label: '✕' }, { id: null, label: '' },
                  { id: 'bottom-left',  label: '↙' }, { id: null, label: '' }, { id: 'bottom-right', label: '↘' },
                ].map((cell, i) => (
                  cell.id
                    ? <button key={cell.id} onClick={() => onChange({ ...config, position: cell.id })}
                        className={`w-10 h-10 rounded-lg text-base font-bold transition-all border
                          ${position === cell.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                        {cell.label}
                      </button>
                    : <div key={i} className="w-10 h-10 rounded-lg border border-dashed border-slate-100 bg-slate-50" />
                ))}
              </div>

              {/* Modo mosaico: cubre toda la foto (anti-robo, ideal demos) */}
              <button onClick={() => onChange({ ...config, position: 'tile' })}
                className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all border
                  ${position === 'tile' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                <span className="text-sm">▦</span> Mosaico — cubre toda la foto (anti-robo)
              </button>
            </div>

            <Slider label="Tamaño del logo" value={sizePercent} min={5} max={40} unit="%"
              onChange={v => onChange({ ...config, sizePercent: v })} />

            <Slider label="Opacidad" value={Math.round(opacity * 100)} min={10} max={100} unit="%"
              onChange={v => onChange({ ...config, opacity: v / 100 })} />

            {/* Preview */}
            <div className="relative bg-slate-200 rounded-lg overflow-hidden aspect-video">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-slate-400 text-xs">Vista previa</span>
              </div>
              {position === 'tile' ? (
                <div className="absolute pointer-events-none"
                  style={{
                    inset: '-30%', opacity, transform: 'rotate(-30deg)',
                    backgroundImage: `url(${logoUrl})`, backgroundRepeat: 'repeat',
                    backgroundSize: `${Math.max(8, sizePercent * 1.6)}%`,
                  }}
                />
              ) : (
                <img src={logoUrl} alt="Logo preview"
                  style={{
                    position: 'absolute', opacity, width: `${sizePercent}%`, height: 'auto',
                    ...(position === 'top-left'     && { top: '4%',    left:  '3%'  }),
                    ...(position === 'top-right'    && { top: '4%',    right: '3%'  }),
                    ...(position === 'bottom-left'  && { bottom: '4%', left:  '3%'  }),
                    ...(position === 'bottom-right' && { bottom: '4%', right: '3%'  }),
                    ...(position === 'center'       && { top: '50%',   left:  '50%', transform: 'translate(-50%,-50%)' }),
                  }}
                />
              )}
            </div>

            {/* Botón "Listo" para colapsar */}
            <button onClick={() => setConfigOpen(false)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors">
              <Check size={12} /> Listo — logo configurado
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
