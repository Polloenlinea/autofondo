import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || '/api/v1'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ nombre: '', empresa: '', email: '', tel: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.empresa || !form.email) {
      setError('Completá nombre, automotora y email.')
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al registrar')
      sessionStorage.setItem('af_lead', data.leadId)
      navigate('/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#080B14' }}>

      {/* Logo */}
      <a href="/" className="flex items-center gap-2.5 mb-12">
        <div className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: '#0090FF' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        </div>
        <span className="font-heading font-bold text-af-text text-sm tracking-tight">AutoFondo</span>
      </a>

      {/* Formulario */}
      <div className="w-full max-w-md">
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3"
          style={{ color: '#0090FF' }}>
          Acceso
        </p>
        <h1 className="font-heading font-extrabold text-3xl mb-2"
          style={{ color: '#F1F5F9' }}>
          Empezá gratis.
        </h1>
        <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
          Registrá tu automotora y probá la herramienta sin costo.
        </p>

        <form onSubmit={submit} className="space-y-3">
          {[
            { name: 'nombre',  placeholder: 'Tu nombre',               type: 'text' },
            { name: 'empresa', placeholder: 'Nombre de la automotora', type: 'text' },
            { name: 'email',   placeholder: 'Email',                   type: 'email' },
            { name: 'tel',     placeholder: 'Teléfono (opcional)',      type: 'tel' },
          ].map(f => (
            <input
              key={f.name}
              name={f.name}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.name]}
              onChange={handle}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-colors"
              style={{ background: '#0F1623', border: '1px solid #1E293B', color: '#F1F5F9' }}
              onFocus={e => e.currentTarget.style.borderColor = '#0090FF'}
              onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
            />
          ))}

          {error && (
            <p className="text-xs pt-1" style={{ color: '#F87171' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full font-semibold text-white text-sm mt-2 transition-all"
            style={{ background: loading ? '#1E293B' : '#0090FF', cursor: loading ? 'not-allowed' : 'pointer' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#007AE6' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0090FF' }}
          >
            {loading ? 'Registrando...' : 'Quiero acceso →'}
          </button>
        </form>

        <p className="text-xs text-center mt-6" style={{ color: '#475569' }}>
          ¿Ya tenés acceso?{' '}
          <button onClick={() => navigate('/app')}
            className="hover:underline transition-colors"
            style={{ color: '#94A3B8' }}>
            Entrar a la herramienta
          </button>
        </p>
      </div>
    </div>
  )
}
