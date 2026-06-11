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

// modelOverride permite usar 'large' para reprocesado de alta calidad individual
async function removeBg(buffer, modelOverride = null) {
  const sharp  = require('sharp')

  // Dimensiones originales para reconstruir el canvas
  const { width: origW, height: origH } = await sharp(buffer).metadata()

  const blob   = new Blob([buffer], { type: 'image/png' })
  const result = await removeBackground(blob, {
    model:  modelOverride || MODEL,
    output: { format: 'image/png', quality: 1.0 },
  })
  const rawResult = Buffer.from(await result.arrayBuffer())

  // Corregir píxeles semi-transparentes en la carrocería: el modelo a veces
  // deja alpha ~150-240 en paneles metálicos. Forzar a opaco si alpha > 180.
  const { data: px, info: pxInfo } = await sharp(rawResult)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] > 180) px[i] = 255
  }
  const raw = await sharp(px, { raw: { width: pxInfo.width, height: pxInfo.height, channels: 4 } })
    .png().toBuffer()

  try {
    // Recortar para obtener el bounding box real del auto
    const trimmed = await sharp(raw).trim({ threshold: 10 }).png().toBuffer()
    const { width: carW, height: carH } = await sharp(trimmed).metadata()

    // Centrar el auto en el canvas original → preserva la composición si el auto
    // estaba centrado, y centra los que estaban descentrados
    const left = Math.max(0, Math.round((origW - carW) / 2))
    const top  = Math.max(0, Math.round((origH - carH) / 2))

    return await sharp({
      create: { width: origW, height: origH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: trimmed, left, top }])
      .png()
      .toBuffer()
  } catch {
    return raw
  }
}

module.exports = { removeBg, warmup, MODEL }
