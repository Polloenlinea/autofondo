import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Landing      from './pages/Landing'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import App          from './App'

const API = import.meta.env.VITE_API_URL || '/api/v1'

// Guard: si no hay código en sesión, manda al login
function ProtectedApp() {
  const code = sessionStorage.getItem('af_code')
  const lead = sessionStorage.getItem('af_lead')
  if (!code && !lead) return <Navigate to="/login" replace />
  return <App />
}

// Ruta /p/:code — acceso directo via link con código
function DirectAccess() {
  const { code } = useParams()

  useEffect(() => {
    async function validate() {
      try {
        const res  = await fetch(`${API}/access/${code}`)
        const data = await res.json()
        if (data.ok) {
          sessionStorage.setItem('af_code', code.toUpperCase())
          window.location.replace('/app')
        } else {
          window.location.replace('/login?invalid=1')
        }
      } catch {
        window.location.replace('/login?invalid=1')
      }
    }
    validate()
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B14' }}>
      <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Validando acceso…</p>
    </div>
  )
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/p/:code"  element={<DirectAccess />} />
        <Route path="/app"      element={<ProtectedApp />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
