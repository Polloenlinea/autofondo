import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api/v1'

/**
 * Contador local de generaciones IA de Photoroom (estimación de gasto propio).
 * Lee /usage del backend al montar y cada 12 s. Cuenta sombra IA + fondo IA.
 * Los fondos comunes y el quitar-fondo NO suman (no gastan Photoroom).
 */
export default function UsageBadge() {
  const [u, setU] = useState(null)

  const fetchUsage = async () => {
    try {
      const r = await fetch(`${API}/usage`)
      const d = await r.json()
      if (d.ok) setU(d)
    } catch { /* backend dormido: lo reintenta el intervalo */ }
  }

  useEffect(() => {
    fetchUsage()
    const id = setInterval(fetchUsage, 12000)
    return () => clearInterval(id)
  }, [])

  if (!u) return null

  return (
    <div
      title={`Generaciones IA:\n• Sombra IA: ${u.shadow}\n• Fondo IA: ${u.scene}\n• Total: ${u.total}\n\nFondos comunes y quitar-fondo no generan IA.\nDesde: ${new Date(u.since).toLocaleString('es-AR')}`}
      className="fixed bottom-1.5 left-2 z-50 flex items-center gap-1 select-none cursor-default pointer-events-auto"
      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.3)', background: 'rgba(17,17,17,.7)', backdropFilter: 'blur(4px)', padding: '2px 7px', borderRadius: '4px' }}
    >
      <Sparkles size={10} className="flex-shrink-0" />
      <span className="tabular-nums">{u.total} IA</span>
    </div>
  )
}
