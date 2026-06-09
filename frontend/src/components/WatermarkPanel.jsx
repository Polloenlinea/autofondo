import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
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
  const { logoFile, logoUrl, logoImg, position, sizePercent, opacity, enabled } = config
  const { recent: recentWms, addWm } = useWmHistory()

  const handleLogoUpload = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      onChange({ ...config, logoFile: f, logoUrl: url, logoImg: img, enabled: true })
      addWm(f, url)
    }
    img.src = url
  }

  const removeLogo = () => {
    onChange({ ...config, logoFile: null, logoUrl: null, logoImg: null, enabled: false })
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <SectionLabel className="mb-0">Marca de agua / Logo</SectionLabel>
        {logoUrl && (
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
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Subir logo */}
        <div>
          {logoUrl
            ? <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                <img src={logoUrl} className="h-8 max-w-20 object-contain" alt="Logo" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{logoFile?.name}</p>
                  <p className="text-[11px] text-slate-400">Logo cargado</p>
                </div>
                <button onClick={removeLogo}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md
                    text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <X size={12} />
                </button>
              </div>
            : <label className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-dashed
                border-slate-300 hover:border-blue-400 bg-slate-50 cursor-pointer transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <ImagePlus size={16} className="text-slate-400" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-slate-600">Subir logo o marca de agua</p>
                  <p className="text-xs text-slate-400">PNG con fondo transparente recomendado</p>
                </div>
              </label>
          }
        </div>

        {/* Logos recientes */}
        {recentWms.length > 0 && !logoUrl && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Logos recientes</p>
            <div className="flex gap-2 flex-wrap">
              {recentWms.map(wm => (
                <button key={wm.id}
                  onClick={() => {
                    const img = new Image()
                    img.onload = () => onChange({ ...config, logoFile: null, logoUrl: wm.dataUrl, logoImg: img, enabled: true })
                    img.src = wm.dataUrl
                  }}
                  className="w-16 h-10 rounded-lg border-2 border-slate-200 hover:border-blue-400 overflow-hidden bg-slate-50 transition-colors p-1">
                  <img src={wm.dataUrl} className="w-full h-full object-contain" alt={wm.name} />
                </button>
              ))}
            </div>
          </div>
        )}

        {logoUrl && enabled && (
          <>
            {/* Posición */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                Posición
              </p>
              <div className="grid grid-cols-3 gap-1.5 w-fit">
                {[
                  { id: 'top-left',    label: '↖', col: 1 },
                  { id: null,          label: '',   col: 2 },
                  { id: 'top-right',   label: '↗', col: 3 },
                  { id: null,          label: '',   col: 1 },
                  { id: 'center',      label: '✕', col: 2 },
                  { id: null,          label: '',   col: 3 },
                  { id: 'bottom-left', label: '↙', col: 1 },
                  { id: null,          label: '',   col: 2 },
                  { id: 'bottom-right',label: '↘', col: 3 },
                ].map((cell, i) => (
                  cell.id
                    ? <button key={cell.id} onClick={() => onChange({ ...config, position: cell.id })}
                        className={`w-10 h-10 rounded-lg text-base font-bold transition-all border
                          ${position === cell.id
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                        {cell.label}
                      </button>
                    : <div key={i} className="w-10 h-10 rounded-lg border border-dashed border-slate-100 bg-slate-50" />
                ))}
              </div>
            </div>

            {/* Tamaño */}
            <Slider
              label="Tamaño del logo"
              value={sizePercent} min={5} max={40} unit="%"
              onChange={v => onChange({ ...config, sizePercent: v })}
            />

            {/* Opacidad */}
            <Slider
              label="Opacidad"
              value={Math.round(opacity * 100)} min={10} max={100} unit="%"
              onChange={v => onChange({ ...config, opacity: v / 100 })}
            />

            {/* Preview de posición */}
            {logoUrl && (
              <div className="relative bg-slate-200 rounded-lg overflow-hidden aspect-video">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-slate-400 text-xs">Vista previa de posición</span>
                </div>
                <img src={logoUrl}
                  style={{
                    position: 'absolute',
                    opacity,
                    width:  `${sizePercent}%`,
                    height: 'auto',
                    ...(position === 'top-left'     && { top: '4%',   left: '3%'  }),
                    ...(position === 'top-right'    && { top: '4%',   right: '3%' }),
                    ...(position === 'bottom-left'  && { bottom: '4%',left: '3%'  }),
                    ...(position === 'bottom-right' && { bottom: '4%',right: '3%' }),
                    ...(position === 'center'       && { top: '50%',  left: '50%', transform: 'translate(-50%,-50%)' }),
                  }}
                  alt="Logo preview"
                />
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
