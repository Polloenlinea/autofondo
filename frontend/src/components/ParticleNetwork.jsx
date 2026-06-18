import { useRef, useEffect } from 'react'

export default function ParticleNetwork() {
  const canvasRef = useRef(null)
  const mouse     = useRef({ x: -999, y: -999 })
  const pts       = useRef([])
  const raf       = useRef(null)

  useEffect(() => {
    const c   = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')

    function resize() {
      c.width  = window.innerWidth
      c.height = window.innerHeight
    }

    function init() {
      resize()
      pts.current = []
      const isMobile = window.innerWidth < 768
      const total    = isMobile ? 38 : 130

      for (let i = 0; i < total; i++) {
        pts.current.push({
          x:     Math.random() * c.width,
          y:     Math.random() * c.height,
          vx:    (Math.random() - 0.5) * 0.6,
          vy:    (Math.random() - 0.5) * 0.6,
          r:     Math.random() * 1.5 + 1,
          pulse: Math.random() * Math.PI * 2,
          color: Math.random() > 0.7
            ? [210, 225, 240]
            : Math.random() > 0.5
              ? [120, 155, 190]
              : [160, 195, 220],
        })
      }
    }

    function loop() {
      ctx.clearRect(0, 0, c.width, c.height)
      const p = pts.current
      const m = mouse.current

      for (let i = 0; i < p.length; i++) {
        const dists = []
        for (let j = 0; j < p.length; j++) {
          if (j === i) continue
          const dx = p[i].x - p[j].x
          const dy = p[i].y - p[j].y
          dists.push({ j, d2: dx * dx + dy * dy })
        }
        dists.sort((a, b) => a.d2 - b.d2)

        const isMob      = c.width < 768
        const neighbours = dists.slice(0, isMob ? 2 : 3)
        const max        = isMob ? 32000 : 55000

        for (const nb of neighbours) {
          const j  = nb.j
          const d2 = nb.d2
          if (d2 > max) continue
          const ratio = 1 - d2 / max

          const third = dists.find(d => d.j !== j && d.d2 < max)
          if (third && i < j && i < third.j) {
            const k = third.j
            ctx.beginPath()
            ctx.moveTo(p[i].x, p[i].y)
            ctx.lineTo(p[j].x, p[j].y)
            ctx.lineTo(p[k].x, p[k].y)
            ctx.closePath()
            ctx.fillStyle = `rgba(${p[i].color},${ratio * 0.018})`
            ctx.fill()
          }

          if (i < j) {
            const grad = ctx.createLinearGradient(p[i].x, p[i].y, p[j].x, p[j].y)
            grad.addColorStop(0, `rgba(${p[i].color},${ratio * 0.22})`)
            grad.addColorStop(1, `rgba(${p[j].color},${ratio * 0.22})`)
            ctx.beginPath()
            ctx.moveTo(p[i].x, p[i].y)
            ctx.lineTo(p[j].x, p[j].y)
            ctx.strokeStyle = grad
            ctx.lineWidth   = ratio * 0.8
            ctx.stroke()
          }
        }
      }

      for (const pt of p) {
        const dx = pt.x - m.x
        const dy = pt.y - m.y
        const d  = Math.sqrt(dx * dx + dy * dy)
        if (d < 180 && d > 0) {
          const f = (180 - d) / 180 * 0.6
          pt.vx += (dx / d) * f
          pt.vy += (dy / d) * f
        }

        pt.vx *= 0.97; pt.vy *= 0.97
        const spd = Math.sqrt(pt.vx * pt.vx + pt.vy * pt.vy)
        if (spd < 0.2) {
          pt.vx += (Math.random() - 0.5) * 0.3
          pt.vy += (Math.random() - 0.5) * 0.3
        }

        pt.x += pt.vx; pt.y += pt.vy
        if (pt.x < 0)        { pt.x = 0;        pt.vx =  Math.abs(pt.vx) }
        if (pt.x > c.width)  { pt.x = c.width;  pt.vx = -Math.abs(pt.vx) }
        if (pt.y < 0)        { pt.y = 0;        pt.vy =  Math.abs(pt.vy) }
        if (pt.y > c.height) { pt.y = c.height; pt.vy = -Math.abs(pt.vy) }

        pt.pulse += 0.02
        const r = pt.r * (1 + Math.sin(pt.pulse) * 0.15)

        const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r * 4)
        grd.addColorStop(0, `rgba(${pt.color},0.12)`)
        grd.addColorStop(1, `rgba(${pt.color},0)`)
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r * 4, 0, Math.PI * 2)
        ctx.fillStyle = grd; ctx.fill()

        ctx.shadowBlur  = 6
        ctx.shadowColor = `rgba(${pt.color},0.7)`
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${pt.color},0.85)`; ctx.fill()
        ctx.shadowBlur = 0
      }

      raf.current = requestAnimationFrame(loop)
    }

    const onMove  = e => { mouse.current = { x: e.clientX, y: e.clientY } }
    const onTouch = e => { const t = e.touches[0]; if (t) mouse.current = { x: t.clientX, y: t.clientY } }
    const onLeave = () => { mouse.current = { x: -999, y: -999 } }

    init(); loop()
    window.addEventListener('resize',     init)
    window.addEventListener('mousemove',  onMove)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('touchmove',  onTouch, { passive: true })
    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener('resize',     init)
      window.removeEventListener('mousemove',  onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('touchmove',  onTouch)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  )
}
