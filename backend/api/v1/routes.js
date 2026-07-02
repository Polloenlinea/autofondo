const express  = require('express')
const router   = express.Router()
const upload   = require('../../middleware/upload')
const { detectImageType }            = require('../../services/detection')
const { removeBg }                   = require('../../services/bgRemoval')
const { censorPlate, applyPlateCensor } = require('../../services/plateCensor')
const { compose, generatePresetBg, isLevel, applyRadialBlur } = require('../../services/composition')
const { photoroomShadow } = require('../../services/photoroomShadow')
const { photoroomScene }  = require('../../services/photoroomScene')
const { briaShadow } = require('../../services/briaShadow')
const { briaScene }  = require('../../services/briaScene')
const usage = require('../../services/usage')

// Motor de IA para fondos y sombra: 'bria' (más real + barato) | 'photoroom'.
// Cambiar por env AI_ENGINE para volver atrás sin tocar código.
const AI_ENGINE = (process.env.AI_ENGINE || 'bria').toLowerCase()
const { applyAdjustments, resizeOutput } = require('../../services/adjustments')
const Session    = require('../../models/Session')
const BgHistory  = require('../../models/BgHistory')
const WmHistory  = require('../../models/WmHistory')
const Lead       = require('../../models/Lead')
const AccessCode = require('../../models/AccessCode')

// Helper: obtener clientId del header (o 'anonymous' si no viene)
const cid = (req) => req.headers['x-client-id'] || 'anonymous'

// Parser JSON con límite grande para sesiones (imágenes en base64)
const jsonLarge = express.json({ limit: '80mb' })

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }))

// ── Contador local de uso de Photoroom (estimación de gasto) ────────────────────
router.get('/usage', (_req, res) => res.json({ ok: true, ...usage.get() }))
router.post('/usage/reset', (_req, res) => { usage.reset(); res.json({ ok: true, ...usage.get() }) })

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
// Campos multer: 'file' (requerido) + 'plateLogo' (opcional, PNG del dealer)
router.post('/remove-bg', upload.fields([
  { name: 'file',      maxCount: 1 },
  { name: 'plateLogo', maxCount: 1 },
]), async (req, res) => {
  try {
    const fileArr = req.files?.file
    if (!fileArr?.length) return res.status(400).json({ ok: false, error: 'No se recibió archivo' })

    const carFile = fileArr[0]
    console.log(`[remove-bg] ${carFile.originalname} ${Math.round(carFile.size / 1024)}KB`)

    // 1. Quitar fondo — motor seleccionable (@imgly rápido / BiRefNet calidad)
    const allowedModels  = ['small', 'medium', 'large']
    const allowedEngines = ['imgly', 'birefnet-lite', 'birefnet-full']
    const modelOverride = allowedModels.includes(req.body.model) ? req.body.model : null
    const engine = allowedEngines.includes(req.body.engine) ? req.body.engine : 'imgly'
    console.log(`[remove-bg] motor: ${engine}${modelOverride ? ` (modelo ${modelOverride})` : ''}`)
    let { buffer: resultBuf, offset } = await removeBg(carFile.buffer, { model: modelOverride, engine })

    // 2. Censurar matrícula (si se pidió)
    const hidePlate = req.body.hidePlate === 'true'
    if (hidePlate) {
      const logoFile = req.files?.plateLogo?.[0] ?? null
      const logoBuf  = logoFile ? logoFile.buffer : null

      // Detectar UNA sola vez en la imagen ORIGINAL (más contexto = mejor OCR)
      let { found, poly } = await censorPlate(carFile.buffer, logoBuf)
      console.log(`[remove-bg] censura matrícula: ${found ? `encontrada → poly ${JSON.stringify(poly)}` : 'no detectada'}`)

      if (found && poly) {
        // Ajustar el polígono si el auto fue movido durante el centrado
        if (offset && (offset.dx !== 0 || offset.dy !== 0)) {
          poly = poly.map(([x, y]) => [x + offset.dx, y + offset.dy])
        }
        // Aplicar el polígono ya conocido al cutout — sin re-detectar
        resultBuf = await applyPlateCensor(resultBuf, poly, logoBuf)
      }
    }

    // ¿Apoya nivelado? (sombra/reflejo solo en fotos rectas; en 3/4 se omiten y se avisa)
    const level = await isLevel(resultBuf)

    // offset {dx,dy}: cuánto se recentró el auto respecto de la foto original.
    // Lo necesita el editor de máscara para alinear la herramienta "Restaurar".
    res.json({ ok: true, image: resultBuf.toString('base64'), level, offset: offset || { dx: 0, dy: 0 } })
  } catch (e) {
    console.error('[remove-bg]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Componer auto + fondo ────────────────────────────────────────────────────
router.post('/compose', upload.fields([
  { name: 'car',        maxCount: 1 },
  { name: 'background', maxCount: 1 },
  { name: 'guidance',   maxCount: 1 },   // imagen de referencia para consistencia IA
]), async (req, res) => {
  try {
    const carFile = req.files?.car?.[0]
    const bgFile  = req.files?.background?.[0]

    if (!carFile) return res.status(400).json({ ok: false, error: 'Falta el auto (car)' })

    // Mejoras IA opcionales (viajan en la misma llamada a Photoroom, sin costo extra)
    const upscale = req.body.upscale === 'true'
    const relight = req.body.relight === 'true'

    // ── Fondo generado por IA (Photoroom AI Backgrounds) ──────────────────────
    // Si viene un prompt de escena, Photoroom arma toda la composición (auto +
    // escena + luz + sombra + reflejo). Devolvemos eso directo.
    const bgPrompt = (req.body.bg_prompt || '').trim()
    if (bgPrompt) {
      const seed          = req.body.seed || null
      const guidanceFile  = req.files?.guidance?.[0]
      const scene = AI_ENGINE === 'bria'
        ? await briaScene(carFile.buffer, bgPrompt, { seed })
        : await photoroomScene(carFile.buffer, bgPrompt, { upscale, relight, seed, guidanceBuffer: guidanceFile?.buffer || null })
      if (!scene) {
        return res.status(502).json({ ok: false, error: `No se pudo generar el fondo IA (revisá el cupo/plan de ${AI_ENGINE})` })
      }
      return res.json({ ok: true, image: scene.toString('base64') })
    }

    let bgBuffer
    if (bgFile) {
      bgBuffer = bgFile.buffer
    } else if (req.body.preset) {
      bgBuffer = await generatePresetBg(req.body.preset)
    } else {
      return res.status(400).json({ ok: false, error: 'Falta el fondo (archivo o preset)' })
    }

    let carBuffer  = carFile.buffer
    let shadow     = req.body.shadow === 'true'
    let reflection = req.body.reflection === 'true'
    // ai_shadow = usar la sombra PAGA por IA (Bria/Photoroom). Si es false pero se
    // pidió shadow, la sombra la dibuja compose() GRATIS (interna). Esto evita
    // gastar créditos en el preview inicial: solo se paga cuando el usuario aplica
    // su fondo final con sombra IA.
    const aiShadow = req.body.ai_shadow === 'true'

    if (aiShadow && (shadow || upscale || relight)) {
      const mode = ['ai.soft', 'ai.hard', 'ai.floating'].includes(req.body.shadow_mode)
        ? req.body.shadow_mode : 'ai.soft'
      const edited = AI_ENGINE === 'bria'
        ? await briaShadow(carFile.buffer, { type: 'regular' })
        : await photoroomShadow(carFile.buffer, { mode, withShadow: shadow, upscale, relight })
      if (edited) {
        carBuffer = edited        // auto editado (con sombra horneada)
        if (shadow) {
          shadow     = false      // sombra IA ya horneada → no aplicar la interna
          reflection = false
        }
      }
    }
    // Si shadow sigue true acá (no se horneó por IA), compose() la dibuja GRATIS.

    const result = await compose({
      carBuffer,
      bgBuffer,
      scale:     parseFloat(req.body.scale  ?? 80),
      posX:      parseFloat(req.body.pos_x  ?? 50),
      posY:      parseFloat(req.body.pos_y  ?? 60),
      shadow,
      reflection,
      shadowIntensity:     parseFloat(req.body.shadow_intensity     ?? 100),
      reflectionIntensity: parseFloat(req.body.reflection_intensity ?? 100),
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
        // Estado de trabajo para retomar el borrador
        detectedType: img.detectedType || 'exterior',
        typeOverride: img.typeOverride ?? null,
        level:        img.level !== false,
        offset:       img.offset      ?? null,
        adjustments:  img.adjustments ?? null,
        bgSettings:   img.bgSettings  ?? null,
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

// DELETE /bg-history/:id
router.delete('/bg-history/:id', async (req, res) => {
  if (!requireMongo(res)) return
  try {
    await BgHistory.deleteOne({ _id: req.params.id, clientId: cid(req) })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// DELETE /wm-history/:id
router.delete('/wm-history/:id', async (req, res) => {
  if (!requireMongo(res)) return
  try {
    await WmHistory.deleteOne({ _id: req.params.id, clientId: cid(req) })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Leads (registro desde landing) ───────────────────────────────────────────
const jsonSmall = express.json({ limit: '1mb' })

router.post('/leads', jsonSmall, async (req, res) => {
  if (!requireMongo(res)) return
  try {
    const { nombre, empresa, email, tel } = req.body
    if (!nombre || !empresa || !email)
      return res.status(400).json({ ok: false, error: 'Faltan campos requeridos' })
    const lead = await Lead.create({ nombre, empresa, email, tel: tel || '' })
    res.json({ ok: true, leadId: lead._id.toString() })
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ ok: false, error: 'Este email ya está registrado' })
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Códigos de acceso directo ─────────────────────────────────────────────────
router.get('/access/:code', async (req, res) => {
  const code = req.params.code.toUpperCase()
  // Código fijo — cambiarlo acá o en .env con ACCESS_CODE=XXXX
  const codigoFijo = (process.env.ACCESS_CODE || 'AUTO24').toUpperCase()
  if (code === codigoFijo) return res.json({ ok: true, label: 'acceso' })
  // Si hay MongoDB, también buscar en la base de datos
  try {
    const ac = await AccessCode.findOne({ code, active: true })
    if (!ac) return res.status(404).json({ ok: false, error: 'Código inválido o inactivo' })
    await AccessCode.updateOne({ _id: ac._id }, { $inc: { uses: 1 } })
    res.json({ ok: true, label: ac.label })
  } catch {
    res.status(404).json({ ok: false, error: 'Código inválido' })
  }
})

// Generar código (admin — requiere header x-admin-key)
router.post('/access', jsonSmall, async (req, res) => {
  if (!requireMongo(res)) return
  const adminKey = process.env.ADMIN_KEY || 'af-admin-2025'
  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(403).json({ ok: false, error: 'No autorizado' })
  try {
    const { label } = req.body
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const ac   = await AccessCode.create({ code, label: label || '' })
    res.json({ ok: true, code: ac.code, label: ac.label })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = router
