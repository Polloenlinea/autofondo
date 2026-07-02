import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || '/api/v1'

export default function LoginPage() {
  const navigate = useNavigate()
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#080B14' }}>

      <a href="/" className="mb-12">
        <img src="/brands/logo-autofondo.svg" alt="AutoFondo" className="h-8 w-auto" />
      </a>

      <div className="w-full max-w-sm">
        <h1 className="font-heading font-extrabold text-2xl mb-2 text-center"
          style={{ color: '#F1F5F9' }}>
          Ingresá tu código
        </h1>
        <p className="text-sm text-center mb-8" style={{ color: '#475569' }}>
          Si no tenés un código,{' '}
          <a href="https://wa.link/8btz8r" target="_blank" rel="noopener noreferrer"
            style={{ color: '#0090FF' }} className="hover:underline">
            contactanos por WhatsApp
          </a>.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            placeholder="Tu código de acceso"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoFocus
            className="w-full px-4 py-3 rounded-lg text-sm text-center tracking-widest font-mono outline-none transition-colors uppercase"
            style={{ background: '#0F1623', border: '1px solid #1E293B', color: '#F1F5F9', letterSpacing: '0.2em' }}
            onFocus={e => e.currentTarget.style.borderColor = '#0090FF'}
            onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
          />

          {error && (
            <p className="text-xs text-center pt-1" style={{ color: '#F87171' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 rounded-full font-semibold text-white text-sm transition-all"
            style={{
              background: (loading || !code.trim()) ? '#1E293B' : '#0090FF',
              cursor: (loading || !code.trim()) ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!loading && code.trim()) e.currentTarget.style.background = '#007AE6' }}
            onMouseLeave={e => { if (!loading && code.trim()) e.currentTarget.style.background = '#0090FF' }}
          >
            {loading ? 'Verificando…' : 'Entrar →'}
          </button>
        </form>
      </div>
    </div>
  )
}
