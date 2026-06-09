const express  = require('express')
const router   = express.Router()
const upload   = require('../../middleware/upload')
const { detectImageType }            = require('../../services/detection')
const { removeBg }                   = require('../../services/bgRemoval')
const { compose, generatePresetBg }  = require('../../services/composition')
const { applyAdjustments, resizeOutput } = require('../../services/adjustments')
const Session   = require('../../models/Session')
const BgHistory = require('../../models/BgHistory')
const WmHistory = require('../../models/WmHistory')

// Helper: obtener clientId del header (o 'anonymous' si no viene)
const cid = (req) => req.headers['x-client-id'] || 'anonymous'

// Parser JSON con límite grande para sesiones (imágenes en base64)
const jsonLarge = express.json({ limit: '80mb' })

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }))

// ── Detectar tipo de imagen (exterior / interior) ─────────────────────────────
router.post('/detect', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo' })
    const result = await detectImageType(req.file.buffer)
    res.json({ ok: true, ...result })
  } catch (e) {
    console.error('[detect]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Eliminar fondo ────────────────────────────────────────────────────────────
router.post('/remove-bg', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo' })
    console.log(`[remove-bg] ${req.file.originalname} ${Math.round(req.file.size/1024)}KB`)
    const resultBuf = await removeBg(req.file.buffer)
    res.json({ ok: true, image: resultBuf.toString('base64') })
  } catch (e) {
    console.error('[remove-bg]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Componer auto + fondo ────────────────────────────────────────────────────
router.post('/compose', upload.fields([
  { name: 'car',        maxCount: 1 },
  { name: 'background', maxCount: 1 },
]), async (req, res) => {
  try {
    const carFile = req.files?.car?.[0]
    const bgFile  = req.files?.background?.[0]

    let bgBuffer
    if (bgFile) {
      bgBuffer = bgFile.buffer
    } else if (req.body.preset) {
      bgBuffer = await generatePresetBg(req.body.preset)
    } else {
      return res.status(400).json({ ok: false, error: 'Falta el fondo (archivo o preset)' })
    }

    if (!carFile) return res.status(400).json({ ok: false, error: 'Falta el auto (car)' })

    const result = await compose({
      carBuffer: carFile.buffer,
      bgBuffer,
      scale:  parseFloat(req.body.scale  ?? 80),
      posX:   parseFloat(req.body.pos_x  ?? 50),
      posY:   parseFloat(req.body.pos_y  ?? 60),
      shadow: req.body.shadow === 'true',
    })

    res.json({ ok: true, image: result.toString('base64') })
  } catch (e) {
    console.error('[compose]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Ajustar imagen (brillo, contraste, rotación) ─────────────────────────────
router.post('/adjust', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo' })
    const result = await applyAdjustments(req.file.buffer, {
      brightness: parseFloat(req.body.brightness ?? 1),
      contrast:   parseFloat(req.body.contrast   ?? 1),
      rotation:   parseInt(req.body.rotation     ?? 0),
    })
    res.json({ ok: true, image: result.toString('base64') })
  } catch (e) {
    console.error('[adjust]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Redimensionar output ──────────────────────────────────────────────────────
router.post('/resize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo' })
    const maxPx  = parseInt(req.body.maxPx ?? 0)   // 0 = sin límite
    const format = req.body.format ?? 'png'
    const result = maxPx > 0
      ? await resizeOutput(req.file.buffer, maxPx, format)
      : req.file.buffer
    res.json({ ok: true, image: result.toString('base64') })
  } catch (e) {
    console.error('[resize]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Fondos preset (thumbnails) ───────────────────────────────────────────────
router.get('/presets', async (_req, res) => {
  res.json({
    ok: true,
    presets: [
      { id: 'white',  label: 'Blanco',   color: '#ffffff' },
      { id: 'gray',   label: 'Gris',     color: '#ecf0f3' },
      { id: 'dark',   label: 'Oscuro',   color: '#0f172a' },
      { id: 'forest', label: 'Bosque',   color: '#2d5016' },
      { id: 'sky',    label: 'Cielo',    color: '#1e90ff' },
      { id: 'city',   label: 'Ciudad',   color: '#2c2c3e' },
      { id: 'sunset', label: 'Atardecer',color: '#ff6b35' },
      { id: 'sand',   label: 'Arena',    color: '#c8a96e' },
    ]
  })
})

// ── Helper: verificar conexión Mongo antes de operar ─────────────────────────
function requireMongo(res) {
  const mongoose = require('mongoose')
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ ok: false, error: 'Base de datos no disponible' })
    return false
  }
  return true
}

// ════════════════════════════════════════════════════════════════════════════
//  SESIONES
// ════════════════════════════════════════════════════════════════════════════

// GET /sessions — listar sesiones del cliente (sin imágenes, solo metadata)
router.get('/sessions', async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const sessions = await Session.find(
      { clientId: cid(req) },
      { images: 0 }         // excluir imágenes en el listado
    ).sort({ date: -1 }).limit(50).lean()
    res.json({ ok: true, sessions })
  } catch (e) {
    console.error('[sessions:get]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// GET /sessions/:id — obtener sesión completa (con imágenes)
router.get('/sessions/:id', async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const session = await Session.findOne({ _id: req.params.id, clientId: cid(req) }).lean()
    if (!session) return res.status(404).json({ ok: false, error: 'Sesión no encontrada' })
    res.json({ ok: true, session })
  } catch (e) {
    console.error('[sessions:getOne]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /sessions — guardar nueva sesión
router.post('/sessions', jsonLarge, async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const { name, images } = req.body
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ ok: false, error: 'Falta el campo images' })
    }

    const processedImages = images.filter(i => i.composedB64 || i.cutoutB64)
    if (!processedImages.length) {
      return res.status(400).json({ ok: false, error: 'No hay imágenes procesadas para guardar' })
    }

    const clientId = cid(req)

    // Máximo 20 sesiones por cliente: eliminar las más antiguas
    const count = await Session.countDocuments({ clientId })
    if (count >= 20) {
      const oldest = await Session.find({ clientId })
        .sort({ date: 1 })
        .limit(count - 19)
        .select('_id')
        .lean()
      await Session.deleteMany({ _id: { $in: oldest.map(s => s._id) } })
    }

    const session = await Session.create({
      clientId,
      name:      name?.trim() || `Sesión ${new Date().toLocaleDateString('es-AR')}`,
      count:     processedImages.length,
      thumbnail: processedImages[0]?.composedB64 || processedImages[0]?.cutoutB64 || null,
      images:    processedImages.map(img => ({
        fileName:    img.fileName    || 'imagen.jpg',
        composedB64: img.composedB64 || null,
        cutoutB64:   img.cutoutB64   || null,
        isComposed:  !!img.composedB64,
      })),
    })

    res.json({ ok: true, id: session._id })
  } catch (e) {
    console.error('[sessions:post]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// DELETE /sessions/:id — eliminar sesión
router.delete('/sessions/:id', async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const result = await Session.deleteOne({ _id: req.params.id, clientId: cid(req) })
    if (result.deletedCount === 0) {
      return res.status(404).json({ ok: false, error: 'Sesión no encontrada' })
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('[sessions:delete]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  HISTORIAL DE FONDOS
// ════════════════════════════════════════════════════════════════════════════

// GET /bg-history — últimos 3 fondos del cliente
router.get('/bg-history', async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const items = await BgHistory.find({ clientId: cid(req) })
      .sort({ date: -1 }).limit(3).lean()
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[bg-history:get]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /bg-history — guardar fondo (máx. 3)
router.post('/bg-history', jsonLarge, async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const { name, dataUrl } = req.body
    if (!dataUrl) return res.status(400).json({ ok: false, error: 'Falta dataUrl' })

    const clientId = cid(req)

    // Mantener máximo 3: eliminar los más viejos si hace falta
    const count = await BgHistory.countDocuments({ clientId })
    if (count >= 3) {
      const oldest = await BgHistory.find({ clientId })
        .sort({ date: 1 }).limit(count - 2).select('_id').lean()
      await BgHistory.deleteMany({ _id: { $in: oldest.map(i => i._id) } })
    }

    const item = await BgHistory.create({ clientId, name: name || 'fondo.jpg', dataUrl })
    res.json({ ok: true, id: item._id })
  } catch (e) {
    console.error('[bg-history:post]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  HISTORIAL DE MARCAS DE AGUA (LOGOS)
// ════════════════════════════════════════════════════════════════════════════

// GET /wm-history — últimos 3 logos del cliente
router.get('/wm-history', async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const items = await WmHistory.find({ clientId: cid(req) })
      .sort({ date: -1 }).limit(3).lean()
    res.json({ ok: true, items })
  } catch (e) {
    console.error('[wm-history:get]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// POST /wm-history — guardar logo (máx. 3)
router.post('/wm-history', jsonLarge, async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const { name, dataUrl } = req.body
    if (!dataUrl) return res.status(400).json({ ok: false, error: 'Falta dataUrl' })

    const clientId = cid(req)

    const count = await WmHistory.countDocuments({ clientId })
    if (count >= 3) {
      const oldest = await WmHistory.find({ clientId })
        .sort({ date: 1 }).limit(count - 2).select('_id').lean()
      await WmHistory.deleteMany({ _id: { $in: oldest.map(i => i._id) } })
    }

    const item = await WmHistory.create({ clientId, name: name || 'logo.png', dataUrl })
    res.json({ ok: true, id: item._id })
  } catch (e) {
    console.error('[wm-history:post]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = router
