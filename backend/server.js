// Cargar variables de entorno desde .env (PHOTOROOM_API_KEY, etc.) — nativo de Node 20.6+
try { process.loadEnvFile() } catch { /* sin .env: se usan defaults */ }

// Limitar la memoria nativa de sharp (libvips) para que NO se acumule a lo largo
// de un lote grande y termine matando el proceso. Sin caché y de a una operación.
const sharp = require('sharp')
sharp.cache(false)
sharp.concurrency(1)

const express    = require('express')
const cors       = require('cors')
const path       = require('path')
const mongoose   = require('mongoose')
const v1         = require('./api/v1/routes')
const { warmup } = require('./services/bgRemoval')

const app    = express()
const PORT   = process.env.PORT || 8001
const isProd = process.env.NODE_ENV === 'production'

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autofondo'

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    const safeUri = MONGO_URI.replace(/\/\/[^@]+@/, '//<credenciales>@')
    console.log(`✅ MongoDB conectado → ${safeUri}`)
  })
  .catch(err => {
    console.error('❌ MongoDB no disponible:', err.message)
    console.error('   Verificá que mongod está corriendo o revisá MONGODB_URI en .env')
    // No matamos el proceso: las rutas Mongo devolverán 503 individualmente
  })

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: isProd ? (process.env.ALLOWED_ORIGIN || true) : '*'
}))
// NOTA: NO usar express.json() global — las rutas que reciben JSON grande
// (sessions, bg-history, wm-history) usan su propio parser con limit:'80mb'.
// Las rutas de imagen usan multer. Ninguna ruta necesita el parser global.

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

  // Warmup deshabilitado en Cloud Run: el proceso ONNX crashea al inicializar
  // en el entorno de contenedor. El modelo se inicializa en el primer uso.
  // (La primera imagen tardará ~30s, las siguientes son inmediatas)
  // warmup().catch(() => {})
})
