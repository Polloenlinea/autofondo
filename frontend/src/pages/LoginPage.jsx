import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || '/api/v1'

export default function LoginPage() {
  const navigate = useNavigate()
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${API}/access/${trimmed}`)
      const data = await res.json()
      if (data.ok) {
        sessionStorage.setItem('af_code', trimmed)
        navigate('/app')
      } else {
        setError('Código incorrecto. Verificá que lo copiaste bien.')
      }
    } catch {
      setError('No se pudo conectar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F4F1' }}>

      {/* ── Panel izquierdo — oscuro con logo ── */}
      <div className="hidden lg:flex flex-col justify-between flex-shrink-0 p-10 relative overflow-hidden"
        style={{ background: '#111111', width: '42%' }}>

        {/* Isotipo — grande, centrado-derecha, parcialmente fuera como AutoAgenda */}
        <div className="absolute pointer-events-none select-none"
          style={{ right: '-100px', bottom: '-100px', opacity: 0.15, width: '680px' }}>
          <img src="/brands/iso-autofondo.svg" alt="" style={{ width: '100%', filter: 'invert(1)' }} />
        </div>

        {/* Logo blanco */}
        <a href="/">
          <img src="/brands/logo-autofondo-dark.svg" alt="AutoFondo"
            className="h-7 w-auto" style={{ filter: 'invert(1)' }} />
        </a>

        {/* Tagline + badges */}
        <div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '26px', fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: '12px', letterSpacing: '-0.5px' }}>
            De una foto común,<br />
            <span style={{ color: '#795989' }}>a una foto que destaca.</span>
          </p>
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,.42)', lineHeight: 1.7, marginBottom: '28px' }}>
            Transformá las imágenes de tus vehículos en fotos profesionales,<br />con el fondo que elijas y listas para publicar. Sin editar, sin complicarte.
          </p>

          {/* Badges de stats — chips compactos, ancho fijo e igual */}
          <div className="flex gap-2">
            {[
              { top: '100%',       bottom: 'ONLINE.'     },
              { top: 'INCREÍBLES', bottom: 'RESULTADOS'  },
              { top: '20 FOTOS',  bottom: 'POR LOTE'    },
            ].map(b => (
              <div key={b.bottom} className="flex flex-col items-center justify-center rounded-lg"
                style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', padding: '12px 8px', width: '100px', height: '58px' }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: b.top.length > 4 ? '12px' : '22px', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: '4px', textAlign: 'center' }}>{b.top}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '8px', color: 'rgba(255,255,255,.35)', letterSpacing: '0.06em', textAlign: 'center' }}>{b.bottom}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer ecosistema */}
        <p className="text-xs" style={{ color: 'rgba(255,255,255,.2)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
          ECOSISTEMA AUTOHUB
        </p>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Logo mobile (solo se ve en mobile) */}
        <a href="/" className="mb-10 lg:hidden">
          <img src="/brands/logo-autofondo-dark.svg" alt="AutoFondo" className="h-6 w-auto" />
        </a>

        <div className="w-full max-w-[360px]">

          {/* Logo desktop chico arriba del form */}
          <a href="/" className="hidden lg:block mb-8">
            <img src="/brands/logo-autofondo-dark.svg" alt="AutoFondo" className="h-6 w-auto" />
          </a>

          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 700, color: '#111111', marginBottom: '6px', letterSpacing: '-0.3px' }}>
            Ingresar al sistema
          </h1>
          <p style={{ fontSize: '13px', color: '#737069', marginBottom: '28px' }}>
            Ingresá tu código de acceso para continuar.
          </p>

          <form onSubmit={submit}>

            {/* Label */}
            <label style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', fontWeight: 500, color: '#737069', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '6px' }}>
              Código de acceso
            </label>

            {/* Input */}
            <input
              type="text"
              placeholder="Ej: AUTO24"
              value={code}
              onChange={e => setCode(e.target.value)}
              autoFocus
              style={{
                width: '100%', border: '1px solid #E2E0DB', borderRadius: '6px',
                padding: '9px 12px', fontSize: '13.5px',
                fontFamily: "'JetBrains Mono', monospace",
                background: '#fff', color: '#111111', outline: 'none',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                marginBottom: '12px', boxSizing: 'border-box',
                transition: 'border-color .12s, box-shadow .12s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#111111'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(17,17,17,.08)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E0DB'; e.currentTarget.style.boxShadow = 'none' }}
            />

            {error && (
              <p style={{ fontSize: '12px', color: '#B94040', marginBottom: '10px' }}>{error}</p>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                width: '100%', padding: '9px 16px',
                borderRadius: '6px', border: 'none',
                background: (loading || !code.trim()) ? '#C5C2BB' : '#111111',
                color: '#fff', fontSize: '13px', fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                cursor: (loading || !code.trim()) ? 'not-allowed' : 'pointer',
                transition: 'background .12s',
              }}
              onMouseEnter={e => { if (!loading && code.trim()) e.currentTarget.style.background = '#2a2a2a' }}
              onMouseLeave={e => { if (!loading && code.trim()) e.currentTarget.style.background = '#111111' }}
            >
              {loading ? 'Verificando…' : 'Ingresar →'}
            </button>

          </form>

          <p style={{ marginTop: '20px', fontSize: '12px', color: '#A5A19A', textAlign: 'center' }}>
            ¿No tenés un código?{' '}
            <a href="https://wa.link/8btz8r" target="_blank" rel="noopener noreferrer"
              style={{ color: '#795989', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
              Contactanos por WhatsApp
            </a>
          </p>
        </div>

        {/* Footer ecosistema mobile */}
        <p className="lg:hidden mt-12 text-xs" style={{ color: '#C5C2BB', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
          ECOSISTEMA AUTOHUB
        </p>
      </div>
    </div>
  )
}
