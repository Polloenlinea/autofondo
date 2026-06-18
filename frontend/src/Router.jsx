import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Landing      from './pages/Landing'
import RegisterPage from './pages/RegisterPage'
import App          from './App'

const API = import.meta.env.VITE_API_URL || '/api/v1'

// Ruta /p/:code — acceso directo sin registro
function DirectAccess() {
  const { code } = useParams()

  useEffect(() => {
    async function validate() {
      try {
        const res  = await fetch(`${API}/access/${code}`)
        const data = await res.json()
        if (data.ok) {
          sessionStorage.setItem('af_code', code)
          window.location.replace('/app')
        } else {
          window.location.replace('/?invalid_code=1')
        }
      } catch {
        window.location.replace('/?invalid_code=1')
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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/p/:code"  element={<DirectAccess />} />
        <Route path="/app"      element={<App />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
