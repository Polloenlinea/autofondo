const express  = require('express')
const router   = express.Router()
const upload   = require('../../middleware/upload')
const { detectImageType }            = require('../../services/detection')
const { removeBg }                   = require('../../services/bgRemoval')
const { compose, generatePresetBg }  = require('../../services/composition')
const { applyAdjustments, resizeOutput } = require('../../services/adjustments')

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
      { id: 'white', label: 'Blanco',    color: '#ffffff' },
      { id: 'gray',  label: 'Gris',      color: '#ecf0f3' },
      { id: 'dark',  label: 'Oscuro',    color: '#0f172a' },
    ]
  })
})

module.exports = router
