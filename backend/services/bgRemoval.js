const { removeBackground } = require('@imgly/background-removal-node')

// Modelo configurable via variable de entorno.
// Opciones: 'small' (más rápido, menor calidad), 'medium' (balance), 'large' (más lento, mejor calidad)
// En producción con Cloud Run o servidor potente: usar 'medium' o 'large'
const MODEL = (process.env.IMGLY_MODEL || 'small')

let _ready = false

async function warmup() {
  if (_ready) return
  console.log(`⏳ Cargando modelo de IA [${MODEL}] en memoria (puede tardar ~10-30 s)...`)
  try {
    const minPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    await removeBackground(new Blob([minPng], { type: 'image/png' }), { model: MODEL })
    _ready = true
    console.log(`✅ Modelo IA [${MODEL}] listo`)
  } catch (e) {
    console.warn('⚠️  Warmup del modelo falló — se inicializará en el primer uso:', e.message)
  }
}

async function removeBg(buffer) {
  const sharp  = require('sharp')
  const blob   = new Blob([buffer], { type: 'image/png' })
  const result = await removeBackground(blob, {
    model:  MODEL,
    output: { format: 'image/png', quality: 0.92 },
  })
  const raw = Buffer.from(await result.arrayBuffer())
  try {
    return await sharp(raw).trim({ threshold: 10 }).png().toBuffer()
  } catch {
    return raw
  }
}

module.exports = { removeBg, warmup }
