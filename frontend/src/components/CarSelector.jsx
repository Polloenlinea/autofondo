import { useState } from 'react'
import { Car, Check } from 'lucide-react'
import { Btn } from './ui'
import { keepOnlyBlob } from '../utils/blobDetect'

const BLOB_COLORS = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899']

/**
 * Modal para elegir cuál auto conservar cuando hay varios en la imagen.
 * @param {string}   cutoutB64    PNG recortado con múltiples autos
 * @param {Array}    blobs        resultado de detectBlobs()
 * @param {Function} onSelect     callback(newCutoutB64) — se llama con el cutout filtrado
 * @param {Function} onCancel
 */
export default function CarSelector({ cutoutB64, blobs, onSelect, onCancel }) {
  const [selected, setSelected] = useState(null)
  const [applying, setApplying]  = useState(false)

  const handleConfirm = async () => {
    if (selected === null) return
    setApplying(true)
    const blob = blobs[selected]
    const newB64 = await keepOnlyBlob(cutoutB64, blob)
    onSelect(newB64)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Car size={18} className="text-blue-700" />
            <div>
              <p className="text-sm font-bold text-slate-800">
                Se detectaron {blobs.length} autos en la imagen
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Seleccioná el auto que querés conservar. El resto quedará transparente.
              </p>
            </div>
          </div>
        </div>

        {/* Vista previa con overlays */}
        <div className="p-4">
          <div className="relative rounded-xl overflow-hidden bg-[#111827]"
            style={{
              backgroundImage: 'linear-gradient(45deg,#374151 25%,transparent 25%),linear-gradient(-45deg,#374151 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#374151 75%),linear-gradient(-45deg,transparent 75%,#374151 75%)',
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
            }}>
            <img
              src={`data:image/png;base64,${cutoutB64}`}
              className="w-full h-auto block"
              style={{ maxHeight: 320, objectFit: 'contain' }}
            />

            {/* Overlays de cada blob */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${blobs[0]?.origW || 100} ${blobs[0]?.origH || 100}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: 'none' }}
            >
              {blobs.map((blob, i) => {
                const color = BLOB_COLORS[i % BLOB_COLORS.length]
                const isSelected = selected === i
                const w = blob.x2 - blob.x1
                const h = blob.y2 - blob.y1
                const pad = Math.min(w, h) * 0.04
                return (
                  <g key={i} style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={() => setSelected(i)}>
                    <rect
                      x={blob.x1 - pad} y={blob.y1 - pad}
                      width={w + pad * 2} height={h + pad * 2}
                      rx={8}
                      fill={isSelected ? color + '30' : 'transparent'}
                      stroke={color}
                      strokeWidth={isSelected ? 6 : 3}
                      strokeDasharray={isSelected ? 'none' : '12,6'}
                    />
                    {/* Etiqueta numerada */}
                    <circle cx={blob.x1 + 18} cy={blob.y1 + 18} r={18} fill={color} />
                    <text x={blob.x1 + 18} y={blob.y1 + 23}
                      textAnchor="middle" fill="white"
                      fontSize={18} fontWeight="bold" fontFamily="sans-serif">
                      {i + 1}
                    </text>
                    {isSelected && (
                      <circle cx={blob.x2 - 18} cy={blob.y1 + 18} r={14} fill={color} />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Chips de selección */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {blobs.map((_, i) => {
              const color = BLOB_COLORS[i % BLOB_COLORS.length]
              const isSelected = selected === i
              return (
                <button key={i}
                  onClick={() => setSelected(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all
                    ${isSelected ? 'text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:scale-102'}`}
                  style={{
                    borderColor: color,
                    background: isSelected ? color : undefined,
                  }}>
                  {isSelected && <Check size={11} />}
                  Auto {i + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2">
          <Btn variant="secondary" onClick={onCancel} disabled={applying}>
            Cancelar — conservar todos
          </Btn>
          <Btn variant="primary" size="full"
            onClick={handleConfirm}
            disabled={selected === null || applying}>
            {applying
              ? 'Aplicando…'
              : selected !== null
                ? `Conservar Auto ${selected + 1}`
                : 'Seleccioná un auto'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
