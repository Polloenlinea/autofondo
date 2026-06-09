import { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser, Paintbrush, RotateCcw, Check, ZoomIn, ZoomOut, Hand, Scissors } from 'lucide-react'
import { Btn } from './ui'

/**
 * Editor de máscara canvas-based.
 * Zoom + pan sin scrollbars: el canvas usa transform CSS y se arrastra con la mano.
 * Herramientas: Borrar | Restaurar | Mano (pan) | Lazo (lasso)
 */
export default function MaskEditor({ cutoutB64, onSave, onCancel }) {
  const canvasRef    = useRef(null)
  const origRef      = useRef(null)
  const containerRef = useRef(null)
  const cursorRef    = useRef(null)

  // Estado de dibujo
  const isPointerDown = useRef(false)
  const lastPos       = useRef(null)

  // Estado de pan
  const isPanning     = useRef(false)
  const panOrigin     = useRef(null)   // { clientX, clientY, panX, panY }

  const [tool,      setTool]      = useState('erase')   // 'erase' | 'restore' | 'pan' | 'lasso'
  const [brushSize, setBrushSize] = useState(24)
  const [zoom,      setZoom]      = useState(1)
  const [pan,       setPan]       = useState({ x: 0, y: 0 })
  const [ready,     setReady]     = useState(false)
  const [canvasW,   setCanvasW]   = useState(0)
  const [canvasH,   setCanvasH]   = useState(0)

  // Lasso state
  const [lassoPoints,  setLassoPoints]  = useState([])   // {x,y} in canvas coords
  const [lassoClosed,  setLassoClosed]  = useState(false) // waiting for borrar/restaurar action

  // ── Cargar imagen ─────────────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const main = canvasRef.current
      main.width  = img.width
      main.height = img.height
      main.getContext('2d').drawImage(img, 0, 0)

      const off = document.createElement('canvas')
      off.width  = img.width
      off.height = img.height
      off.getContext('2d').drawImage(img, 0, 0)
      origRef.current = off

      setCanvasW(img.width)
      setCanvasH(img.height)
      setReady(true)

      // Centrar el canvas en el contenedor
      requestAnimationFrame(() => {
        const cont = containerRef.current
        if (!cont) return
        const cw = cont.clientWidth
        const ch = cont.clientHeight
        const iw = img.width  * 1   // zoom inicial = 1
        const ih = img.height * 1
        const fitZoom = Math.min(cw / iw, ch / ih, 1)
        setZoom(+fitZoom.toFixed(2))
        setPan({
          x: (cw - img.width  * fitZoom) / 2,
          y: (ch - img.height * fitZoom) / 2,
        })
      })
    }
    img.src = `data:image/png;base64,${cutoutB64}`
  }, [cutoutB64])

  // ── Cursor personalizado ──────────────────────────────────────────────────
  const updateCursor = useCallback((clientX, clientY) => {
    if (!cursorRef.current || tool === 'pan' || tool === 'lasso') return
    const el = cursorRef.current
    const diameter = brushSize * zoom
    el.style.left    = `${clientX - diameter / 2}px`
    el.style.top     = `${clientY - diameter / 2}px`
    el.style.width   = `${diameter}px`
    el.style.height  = `${diameter}px`
    el.style.opacity = '1'
  }, [brushSize, zoom, tool])

  const hideCursor = () => { if (cursorRef.current) cursorRef.current.style.opacity = '0' }

  // ── Convertir coordenadas pantalla → canvas ───────────────────────────────
  const screenToCanvas = useCallback((clientX, clientY) => {
    const cont = containerRef.current
    if (!cont) return { x: 0, y: 0 }
    const rect = cont.getBoundingClientRect()
    // pos relativa al contenedor
    const rx = clientX - rect.left
    const ry = clientY - rect.top
    // deshacer pan y zoom
    return {
      x: (rx - pan.x) / zoom,
      y: (ry - pan.y) / zoom,
    }
  }, [pan, zoom])

  // ── Pintar en canvas ──────────────────────────────────────────────────────
  const paintAt = useCallback((cx, cy) => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const r      = brushSize / 2
    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fill()
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(origRef.current, 0, 0)
      ctx.restore()
    }
    ctx.globalCompositeOperation = 'source-over'
  }, [tool, brushSize])

  const paintLine = useCallback((from, to) => {
    const dist  = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(dist / (brushSize * 0.2)))
    for (let i = 0; i <= steps; i++) {
      paintAt(
        from.x + (to.x - from.x) * (i / steps),
        from.y + (to.y - from.y) * (i / steps),
      )
    }
  }, [paintAt, brushSize])

  // ── Aplicar lazo ─────────────────────────────────────────────────────────
  const applyLasso = useCallback((action) => {
    if (lassoPoints.length < 3) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y)
    lassoPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    if (action === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fill()
    } else {
      ctx.clip()
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(origRef.current, 0, 0)
    }
    ctx.restore()
    setLassoPoints([])
    setLassoClosed(false)
  }, [lassoPoints])

  // ── Eventos de puntero (unificados mouse + touch) ─────────────────────────
  const getClientXY = (e) => {
    const src = e.touches ? e.touches[0] : e
    return { clientX: src.clientX, clientY: src.clientY }
  }

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    const { clientX, clientY } = getClientXY(e)

    if (tool === 'pan' || e.button === 1) {
      // Iniciar pan
      isPanning.current = true
      panOrigin.current = { clientX, clientY, panX: pan.x, panY: pan.y }
      return
    }

    if (tool === 'lasso') {
      const pos = screenToCanvas(clientX, clientY)
      const cont = containerRef.current
      if (!cont) return
      // Check if clicking near first point to close polygon
      if (lassoPoints.length >= 3) {
        const firstSX = lassoPoints[0].x * zoom + pan.x
        const firstSY = lassoPoints[0].y * zoom + pan.y
        const rect = cont.getBoundingClientRect()
        const dx = clientX - rect.left - firstSX
        const dy = clientY - rect.top  - firstSY
        if (Math.hypot(dx, dy) < 15) {
          setLassoClosed(true)
          return
        }
      }
      setLassoPoints(prev => [...prev, pos])
      return
    }

    // Iniciar dibujo
    isPointerDown.current = true
    const pos = screenToCanvas(clientX, clientY)
    lastPos.current = pos
    paintAt(pos.x, pos.y)
  }, [tool, pan, zoom, screenToCanvas, paintAt, lassoPoints])

  const onPointerMove = useCallback((e) => {
    e.preventDefault()
    const { clientX, clientY } = getClientXY(e)
    updateCursor(clientX, clientY)

    if (isPanning.current && panOrigin.current) {
      const dx = clientX - panOrigin.current.clientX
      const dy = clientY - panOrigin.current.clientY
      setPan({ x: panOrigin.current.panX + dx, y: panOrigin.current.panY + dy })
      return
    }

    if (!isPointerDown.current) return
    const pos = screenToCanvas(clientX, clientY)
    paintLine(lastPos.current, pos)
    lastPos.current = pos
  }, [updateCursor, screenToCanvas, paintLine])

  const onPointerUp = useCallback(() => {
    isPointerDown.current = false
    isPanning.current     = false
    panOrigin.current     = null
    lastPos.current       = null
  }, [])

  // Scroll para zoom
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta  = e.deltaY > 0 ? -0.15 : 0.15
    const newZoom = Math.max(0.3, Math.min(8, zoom + delta))

    // Zoom centrado en el cursor
    const cont = containerRef.current
    if (!cont) return
    const rect = cont.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const scale = newZoom / zoom
    setPan(p => ({
      x: mx - (mx - p.x) * scale,
      y: my - (my - p.y) * scale,
    }))
    setZoom(+(newZoom.toFixed(2)))
  }, [zoom])

  // Attach wheel con passive:false
  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    cont.addEventListener('wheel', onWheel, { passive: false })
    return () => cont.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const fitToScreen = useCallback(() => {
    const cont = containerRef.current
    if (!cont || !canvasW) return
    const cw = cont.clientWidth
    const ch = cont.clientHeight
    const fz = Math.min(cw / canvasW, ch / canvasH, 1)
    setZoom(+fz.toFixed(2))
    setPan({ x: (cw - canvasW * fz) / 2, y: (ch - canvasH * fz) / 2 })
  }, [canvasW, canvasH])

  const handleReset = () => {
    if (!origRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    ctx.drawImage(origRef.current, 0, 0)
  }

  const handleSave = () => onSave(canvasRef.current.toDataURL('image/png').split(',')[1])

  const containerCursor = tool === 'pan'
    ? (isPanning.current ? 'grabbing' : 'grab')
    : tool === 'lasso'
      ? 'crosshair'
      : 'none'

  const showLassoActions = lassoClosed || lassoPoints.length >= 3

  return (
    <div className="flex flex-col h-full" style={{ userSelect: 'none' }}>

      {/* ── Cursor para pincel (solo visible cuando no es pan ni lasso) ── */}
      {tool !== 'pan' && tool !== 'lasso' && (
        <div ref={cursorRef}
          className="fixed pointer-events-none rounded-full z-[9999] opacity-0"
          style={{
            border: `2px solid ${tool === 'erase' ? '#ef4444' : '#2563eb'}`,
            boxShadow: '0 0 0 1.5px rgba(255,255,255,0.7)',
          }}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex-wrap flex-shrink-0">

        {/* Herramientas */}
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0">
          {[
            { id: 'erase',   label: 'Borrar',     Icon: Eraser,    active: 'bg-red-50 text-red-700'    },
            { id: 'restore', label: 'Restaurar',  Icon: Paintbrush,active: 'bg-blue-50 text-blue-700'  },
            { id: 'pan',     label: 'Mover',       Icon: Hand,      active: 'bg-slate-100 text-slate-700'},
            { id: 'lasso',   label: 'Lazo',        Icon: Scissors,  active: 'bg-yellow-50 text-yellow-700'},
          ].map(({ id, label, Icon, active }, i) => (
            <button key={id} onClick={() => { setTool(id); hideCursor() }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors
                ${i > 0 ? 'border-l border-slate-200' : ''}
                ${tool === id ? active : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Confirmar lazo (cuando hay puntos suficientes) */}
        {tool === 'lasso' && lassoPoints.length >= 3 && !lassoClosed && (
          <button
            onClick={() => setLassoClosed(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-500 transition-colors">
            <Check size={12} /> Confirmar
          </button>
        )}

        {/* Pincel (solo para erase/restore) */}
        {(tool === 'erase' || tool === 'restore') && (
          <div className="flex items-center gap-2 flex-1 min-w-24 max-w-40">
            <span className="text-[11px] text-slate-400 flex-shrink-0">Pincel</span>
            <input type="range" min={4} max={120} value={brushSize}
              onChange={e => setBrushSize(+e.target.value)}
              className="flex-1 h-1 accent-blue-700 cursor-pointer" />
            <span className="text-[11px] tabular-nums text-slate-500 w-7 text-right">{brushSize}</span>
          </div>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.25).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500
              hover:bg-slate-100 border border-slate-200 transition-colors">
            <ZoomOut size={13} />
          </button>
          <button onClick={fitToScreen}
            className="px-2 h-7 text-[11px] font-semibold tabular-nums text-slate-600
              hover:bg-slate-100 rounded-md border border-slate-200 transition-colors min-w-10 text-center">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(z => Math.min(8, +(z + 0.25).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500
              hover:bg-slate-100 border border-slate-200 transition-colors">
            <ZoomIn size={13} />
          </button>
          <button onClick={handleReset}
            className="flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium
              text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200
              transition-colors ml-1">
            <RotateCcw size={11} /> Reset
          </button>
        </div>
      </div>

      {/* ── Lasso action bar ── */}
      {tool === 'lasso' && showLassoActions && (
        <div className="flex gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-100 flex-shrink-0">
          <button onClick={() => applyLasso('erase')}
            className="flex-1 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">
            Borrar zona
          </button>
          <button onClick={() => applyLasso('restore')}
            className="flex-1 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Restaurar zona
          </button>
          <button onClick={() => { setLassoPoints([]); setLassoClosed(false) }}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      )}

      {/* ── Hint ── */}
      <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 flex-shrink-0">
        <p className="text-[11px] text-amber-700">
          {tool === 'erase'   && 'Pintá sobre el área que querés eliminar del recorte'}
          {tool === 'restore' && 'Pintá para recuperar zonas que la IA borró de más'}
          {tool === 'pan'     && 'Arrastrá para mover · Scroll para hacer zoom'}
          {tool === 'lasso'   && (
            lassoPoints.length === 0
              ? 'Hacé clic para agregar el primer punto del polígono'
              : lassoPoints.length < 3
                ? `${lassoPoints.length} punto${lassoPoints.length > 1 ? 's' : ''} · Agregá al menos 3 para cerrar`
                : 'Hacé clic para agregar puntos · Cerrá el polígono o confirmá'
          )}
          {tool !== 'pan' && tool !== 'lasso' && (
            <span className="text-amber-400 ml-2">· Scroll = zoom · Herramienta Mover para desplazarse</span>
          )}
        </p>
      </div>

      {/* ── Canvas área ── */}
      <div
        ref={containerRef}
        className="bg-[#111827]"
        style={{
          flex: '1 1 0', minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          cursor: containerCursor,
          touchAction: 'none',
        }}
        onMouseLeave={hideCursor}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            Cargando…
          </div>
        )}

        {/* Tablero de ajedrez + canvas posicionado con transform */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          willChange: 'transform',
          display: ready ? 'block' : 'none',
          backgroundImage: 'linear-gradient(45deg,#374151 25%,transparent 25%),linear-gradient(-45deg,#374151 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#374151 75%),linear-gradient(-45deg,transparent 75%,#374151 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
          lineHeight: 0,
          width:  canvasW * zoom,
          height: canvasH * zoom,
        }}>
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width:  canvasW * zoom,
              height: canvasH * zoom,
              pointerEvents: 'none',   // los eventos van al contenedor
            }}
          />
        </div>

        {/* SVG lasso overlay */}
        {tool === 'lasso' && lassoPoints.length > 0 && (
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:10, overflow:'hidden' }}>
            <polygon
              points={lassoPoints.map(p=>`${p.x*zoom+pan.x},${p.y*zoom+pan.y}`).join(' ')}
              fill="rgba(250,204,21,0.12)"
              stroke="#facc15"
              strokeWidth="1.5"
              strokeDasharray="5,3"
            />
            {lassoPoints.map((p,i)=>(
              <circle key={i} cx={p.x*zoom+pan.x} cy={p.y*zoom+pan.y}
                r={i===0 ? 6 : 3}
                fill={i===0 ? '#facc15' : 'white'}
                stroke="#facc15" strokeWidth="1.5" />
            ))}
          </svg>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex gap-2 px-4 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
        <Btn variant="secondary" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="primary" size="full" onClick={handleSave} disabled={!ready}>
          <Check size={14} /> Aplicar cambios
        </Btn>
      </div>
    </div>
  )
}
