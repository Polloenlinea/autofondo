const express = require('express')
const cors    = require('cors')
const path    = require('path')
const v1      = require('./api/v1/routes')

const app  = express()
const PORT = process.env.PORT || 8001
const isProd = process.env.NODE_ENV === 'production'

// ── Middleware ────────────────────────────────────────────────────────────────
// En producción el frontend está en el mismo origen, no necesita CORS amplio
app.use(cors({
  origin: isProd
    ? (process.env.ALLOWED_ORIGIN || true)
    : '*'
}))
app.use(express.json({ limit: '1mb' }))

// ── Rutas API versionadas ─────────────────────────────────────────────────────
app.use('/api/v1', v1)

// ── En producción: servir el frontend compilado ───────────────────────────────
if (isProd) {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist')
  app.use(express.static(distPath))
  // SPA fallback: todas las rutas no-API devuelven index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ── Error handler global ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message)
  res.status(err.status || 500).json({ ok: false, error: err.message })
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const mode = isProd ? 'PRODUCTION' : 'development'
  console.log(`\n✅ AutoFondo [${mode}] → http://localhost:${PORT}/api/v1\n`)
})
