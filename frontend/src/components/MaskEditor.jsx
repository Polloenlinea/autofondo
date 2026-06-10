import { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser, Paintbrush, RotateCcw, Check, ZoomIn, ZoomOut, Hand, Scissors, Undo2 } from 'lucide-react'
import { Btn } from './ui'

const MAX_UNDO = 20

export default function MaskEditor({ cutoutB64, onSave, onCancel }) {
  const canvasRef    = useRef(null)
  const origRef      = useRef(null)
  const containerRef = useRef(null)
  const cursorRef    = useRef(null)

  // Undo stack: array de ImageData
  const undoStack    = useRef([])
  const [canUndo, setCanUndo] = useState(false)

  // Estado de dibujo
  const isPointerDown = useRef(false)
  const lastPos       = useRef(null)
  const activePtId    = useRef(null)   // pointerId capturado

  // Estado de pan
  const isPanning   = useRef(false)
  const panOrigin   = useRef(null)

  const [tool,      setTool]      = useState('erase')
  const [brushSize, setBrushSize] = useState(24)
  const [zoom,      setZoom]      = useState(1)
  const [pan,       setPan]       = useState({ x: 0, y: 0 })
  const [ready,     setReady]     = useState(false)
  const [canvasW,   setCanvasW]   = useState(0)
  const [canvasH,   setCanvasH]   = useState(0)

  // Lazo
  const [lassoPoints, setLassoPoints] = useState([])
  const [lassoClosed, setLassoClosed] = useState(false)
  // Para detectar si el puntero está cerca del primer punto del lazo
  const [lassoNearClose, setLassoNearClose] = useState(false)

  // ── Cargar imagen ──────────────────────────────────────────────────────────
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

      requestAnimationFrame(() => {
        const cont = containerRef.current
        if (!cont) return
        const cw = cont.clientWidth
        const ch = cont.clientHeight
        const fitZoom = Math.min(cw / img.width, ch / img.height, 1)
        setZoom(+fitZoom.toFixed(2))
        setPan({ x: (cw - img.width * fitZoom) / 2, y: (ch - img.height * fitZoom) / 2 })
      })
    }
    img.src = `data:image/png;base64,${cutoutB64}`
  }, [cutoutB64])

  // ── Undo stack ─────────────────────────────────────────────────────────────
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const snapshot = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), snapshot]
    setCanUndo(true)
  }, [])

  const undo = useCallback(() => {
    if (!undoStack.current.length) return
    const snapshot = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    canvasRef.current?.getContext('2d').putImageData(snapshot, 0, 0)
    setCanUndo(undoStack.current.length > 0)
  }, [])

  // Ctrl+Z / Cmd+Z
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  // ── Cursor personalizado ───────────────────────────────────────────────────
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

  // ── Coordenadas pantalla → canvas ──────────────────────────────────────────
  const screenToCanvas = useCallback((clientX, clientY) => {
    const cont = containerRef.current
    if (!cont) return { x: 0, y: 0 }
    const rect = cont.getBoundingClientRect()
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    }
  }, [pan, zoom])

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  const paintAt = useCallback((cx, cy) => {
    const ctx = canvasRef.current.getContext('2d')
    const r   = brushSize / 2
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

  // ── Lazo: aplicar ─────────────────────────────────────────────────────────
  const applyLasso = useCallback((action) => {
    if (lassoPoints.length < 3) return
    saveSnapshot()
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
    setLassoNearClose(false)
  }, [lassoPoints, saveSnapshot])

  const cancelLasso = useCallback(() => {
    setLassoPoints([])
    setLassoClosed(false)
    setLassoNearClose(false)
  }, [])

  // ── Detectar proximidad al primer punto del lazo ───────────────────────────
  const checkLassoClose = useCallback((clientX, clientY) => {
    if (lassoPoints.length < 3 || lassoClosed) { setLassoNearClose(false); return false }
    const cont = containerRef.current
    if (!cont) return false
    const rect = cont.getBoundingClientRect()
    const fp   = lassoPoints[0]
    const sx   = fp.x * zoom + pan.x + rect.left
    const sy   = fp.y * zoom + pan.y + rect.top
    const near = Math.hypot(clientX - sx, clientY - sy) < 20
    setLassoNearClose(near)
    return near
  }, [lassoPoints, lassoClosed, zoom, pan])

  // ── Eventos de puntero ─────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return
    e.preventDefault()

    // Pan con botón medio o herramienta pan
    if (tool === 'pan' || e.button === 1) {
      isPanning.current = true
      panOrigin.current = { clientX: e.clientX, clientY: e.clientY, panX: pan.x, panY: pan.y }
      return
    }

    // Lazo
    if (tool === 'lasso') {
      if (lassoClosed) return

      // Doble clic cierra el lazo
      if (e.detail === 2 && lassoPoints.length >= 3) {
        setLassoClosed(true)
        return
      }

      // Clic cerca del primer punto cierra el lazo
      if (checkLassoClose(e.clientX, e.clientY)) {
        setLassoClosed(true)
        return
      }

      const pos = screenToCanvas(e.clientX, e.clientY)
      setLassoPoints(prev => [...prev, pos])
      return
    }

    // Dibujo: capturar puntero para seguir recibiendo eventos fuera del elemento
    e.currentTarget.setPointerCapture(e.pointerId)
    activePtId.current = e.pointerId
    saveSnapshot()  // guardar estado antes de pintar (para undo)
    isPointerDown.current = true
    const pos = screenToCanvas(e.clientX, e.clientY)
    lastPos.current = pos
    paintAt(pos.x, pos.y)
  }, [tool, pan, lassoClosed, lassoPoints, checkLassoClose, screenToCanvas, paintAt, saveSnapshot])

  const onPointerMove = useCallback((e) => {
    e.preventDefault()
    updateCursor(e.clientX, e.clientY)

    if (isPanning.current && panOrigin.current) {
      const dx = e.clientX - panOrigin.current.clientX
      const dy = e.clientY - panOrigin.current.clientY
      setPan({ x: panOrigin.current.panX + dx, y: panOrigin.current.panY + dy })
      return
    }

    // Actualizar indicador de cierre de lazo
    if (tool === 'lasso') {
      checkLassoClose(e.clientX, e.clientY)
    }

    if (!isPointerDown.current) return
    const pos = screenToCanvas(e.clientX, e.clientY)
    paintLine(lastPos.current, pos)
    lastPos.current = pos
  }, [tool, updateCursor, screenToCanvas, paintLine, checkLassoClose])

  const onPointerUp = useCallback((e) => {
    isPointerDown.current = false
    isPanning.current     = false
    panOrigin.current     = null
    lastPos.current       = null
    activePtId.current    = null
  }, [])

  // ── Scroll = zoom ──────────────────────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta   = e.deltaY > 0 ? -0.15 : 0.15
    const newZoom = Math.max(0.3, Math.min(8, zoom + delta))
    const cont    = containerRef.current
    if (!cont) return
    const rect  = cont.getBoundingClientRect()
    const mx    = e.clientX - rect.left
    const my    = e.clientY - rect.top
    const scale = newZoom / zoom
    setPan(p => ({ x: mx - (mx - p.x) * scale, y: my - (my - p.y) * scale }))
    setZoom(+(newZoom.toFixed(2)))
  }, [zoom])

  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    cont.addEventListener('wheel', onWheel, { passive: false })
    return () => cont.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Fit to screen ──────────────────────────────────────────────────────────
  const fitToScreen = useCallback(() => {
    const cont = containerRef.current
    if (!cont || !canvasW) return
    const fz = Math.min(cont.clientWidth / canvasW, cont.clientHeight / canvasH, 1)
    setZoom(+fz.toFixed(2))
    setPan({ x: (cont.clientWidth - canvasW * fz) / 2, y: (cont.clientHeight - canvasH * fz) / 2 })
  }, [canvasW, canvasH])

  const handleReset = () => {
    if (!origRef.current || !canvasRef.current) return
    saveSnapshot()
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    ctx.drawImage(origRef.current, 0, 0)
  }

  const handleSave = () => onSave(canvasRef.current.toDataURL('image/png').split(',')[1])

  const containerCursor = tool === 'pan'
    ? (isPanning.current ? 'grabbing' : 'grab')
    : tool === 'lasso'
      ? (lassoNearClose ? 'cell' : 'crosshair')
      : 'none'

  return (
    <div className="flex flex-col h-full" style={{ userSelect: 'none' }}>

      {/* Cursor pincel */}
      {(tool === 'erase' || tool === 'restore') && (
        <div ref={cursorRef}
          className="fixed pointer-events-none rounded-full z-[9999] opacity-0"
          style={{
            border: `2px solid ${tool === 'erase' ? '#ef4444' : '#2563eb'}`,
            boxShadow: '0 0 0 1.5px rgba(255,255,255,0.7)',
          }}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 flex-wrap flex-shrink-0">

        {/* Herramientas */}
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0">
          {[
            { id: 'erase',   label: 'Borrar',    Icon: Eraser,     active: 'bg-red-50 text-red-700'     },
            { id: 'restore', label: 'Restaurar', Icon: Paintbrush, active: 'bg-blue-50 text-blue-700'   },
            { id: 'pan',     label: 'Mover',     Icon: Hand,       active: 'bg-slate-100 text-slate-700' },
            { id: 'lasso',   label: 'Lazo',      Icon: Scissors,   active: 'bg-yellow-50 text-yellow-700'},
          ].map(({ id, label, Icon, active }, i) => (
            <button key={id} onClick={() => { setTool(id); hideCursor() }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors
                ${i > 0 ? 'border-l border-slate-200' : ''}
                ${tool === id ? active : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Pincel */}
        {(tool === 'erase' || tool === 'restore') && (
          <div className="flex items-center gap-2 flex-1 min-w-24 max-w-40">
            <span className="text-[11px] text-slate-400 flex-shrink-0">Pincel</span>
            <input type="range" min={4} max={120} value={brushSize}
              onChange={e => setBrushSize(+e.target.value)}
              className="flex-1 h-1 accent-blue-700 cursor-pointer" />
            <span className="text-[11px] tabular-nums text-slate-500 w-7 text-right">{brushSize}</span>
          </div>
        )}

        {/* Lazo: cerrar polígono cuando hay ≥3 puntos y no está cerrado */}
        {tool === 'lasso' && lassoPoints.length >= 3 && !lassoClosed && (
          <button onClick={() => setLassoClosed(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-500 transition-colors">
            <Check size={12} /> Cerrar polígono
          </button>
        )}

        {/* Undo + Zoom (lado derecho) */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <button onClick={undo} disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors border border-slate-200
              disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <Undo2 size={13} />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.25).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 border border-slate-200">
            <ZoomOut size={13} />
          </button>
          <button onClick={fitToScreen}
            className="px-2 h-7 text-[11px] font-semibold tabular-nums text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200 min-w-10 text-center">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(z => Math.min(8, +(z + 0.25).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 border border-slate-200">
            <ZoomIn size={13} />
          </button>
          <button onClick={handleReset}
            className="flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 ml-1">
            <RotateCcw size={11} /> Reset
          </button>
        </div>
      </div>

      {/* ── Barra de acción del lazo (solo cuando está cerrado) ── */}
      {tool === 'lasso' && lassoClosed && (
        <div className="flex gap-2 px-3 py-2 bg-yellow-50 border-b border-yellow-200 flex-shrink-0">
          <span className="text-xs text-yellow-700 font-medium self-center mr-1">Zona seleccionada:</span>
          <button onClick={() => applyLasso('erase')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">
            <Eraser size={11} /> Borrar zona
          </button>
          <button onClick={() => applyLasso('restore')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Paintbrush size={11} /> Restaurar zona
          </button>
          <button onClick={cancelLasso}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      )}

      {/* ── Hint ── */}
      <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 flex-shrink-0">
        <p className="text-[11px] text-amber-700 leading-snug">
          {tool === 'erase'   && <>Pintá sobre lo que querés eliminar · <kbd className="bg-amber-100 px-1 rounded text-[10px]">Ctrl+Z</kbd> para deshacer</>}
          {tool === 'restore' && <>Pintá para recuperar zonas que la IA borró de más · <kbd className="bg-amber-100 px-1 rounded text-[10px]">Ctrl+Z</kbd> para deshacer</>}
          {tool === 'pan'     && 'Arrastrá para mover · Scroll para zoom'}
          {tool === 'lasso'   && !lassoClosed && (
            lassoPoints.length === 0
              ? 'Clic para agregar puntos del polígono · Doble clic para cerrar'
              : lassoPoints.length < 3
                ? `${lassoPoints.length} punto${lassoPoints.length > 1 ? 's' : ''} · Necesitás al menos 3`
                : lassoNearClose
                  ? '¡Clic para cerrar el polígono!'
                  : `${lassoPoints.length} puntos · Doble clic o clic en el primer punto (●) para cerrar`
          )}
          {tool === 'lasso' && lassoClosed && 'Elegí qué hacer con la zona seleccionada'}
        </p>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="bg-[#111827]"
        style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', position: 'relative', cursor: containerCursor, touchAction: 'none' }}
        onMouseLeave={hideCursor}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Cargando…</div>
        )}

        <div style={{
          position: 'absolute', left: 0, top: 0,
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
          <canvas ref={canvasRef} style={{ display: 'block', width: canvasW * zoom, height: canvasH * zoom, pointerEvents: 'none' }} />
        </div>

        {/* SVG overlay del lazo */}
        {tool === 'lasso' && lassoPoints.length > 0 && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
            {/* Líneas del polígono */}
            {lassoPoints.length > 1 && (
              <polyline
                points={lassoPoints.map(p => `${p.x * zoom + pan.x},${p.y * zoom + pan.y}`).join(' ')}
                fill="none"
                stroke="#facc15"
                strokeWidth="1.5"
                strokeDasharray={lassoClosed ? 'none' : '5,3'}
              />
            )}
            {/* Línea de cierre (cuando está cerrado) */}
            {lassoClosed && lassoPoints.length >= 3 && (
              <polygon
                points={lassoPoints.map(p => `${p.x * zoom + pan.x},${p.y * zoom + pan.y}`).join(' ')}
                fill="rgba(250,204,21,0.15)"
                stroke="#facc15"
                strokeWidth="1.5"
              />
            )}
            {/* Puntos */}
            {lassoPoints.map((p, i) => (
              <circle key={i}
                cx={p.x * zoom + pan.x}
                cy={p.y * zoom + pan.y}
                r={i === 0 ? (lassoNearClose ? 10 : 7) : 3}
                fill={i === 0 ? (lassoNearClose ? '#4ade80' : '#facc15') : 'white'}
                stroke={i === 0 ? (lassoNearClose ? '#16a34a' : '#ca8a04') : '#facc15'}
                strokeWidth="1.5"
              />
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
