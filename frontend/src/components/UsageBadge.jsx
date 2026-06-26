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
      title={`Generaciones IA de Photoroom (estiman tu gasto):\n• Sombra IA: ${u.shadow}\n• Fondo IA: ${u.scene}\n• Total: ${u.total}\n\nFondos comunes y quitar-fondo NO gastan.\nDesde: ${new Date(u.since).toLocaleString('es-AR')}`}
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-violet-50 text-violet-700 select-none cursor-default"
    >
      <Sparkles size={14} className="flex-shrink-0" />
      <span className="text-xs font-semibold tabular-nums">{u.total}</span>
      <span className="hidden sm:inline text-[10px] text-violet-400 font-medium">IA</span>
    </div>
  )
}
