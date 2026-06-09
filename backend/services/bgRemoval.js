const { removeBackground } = require('@imgly/background-removal-node')

let _ready = false

/** Pre-calienta el modelo al iniciar el servidor */
async function warmup() {
  if (_ready) return
  console.log('⏳ Cargando modelo de IA...')
  try {
    // Imagen 1x1 para forzar la carga del modelo
    const { createCanvas } = require('canvas').default ?? {}
    // Usamos un buffer mínimo de 1px PNG transparente
    const minPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    await removeBackground(new Blob([minPng], { type: 'image/png' }), { model: 'small' })
    _ready = true
    console.log('✅ Modelo listo')
  } catch (e) {
    console.warn('⚠️  Warmup falló (el modelo se cargará en el primer uso):', e.message)
  }
}

async function removeBg(buffer) {
  const sharp  = require('sharp')
  const blob   = new Blob([buffer], { type: 'image/png' })
  const result = await removeBackground(blob, {
    model: 'small',
    output: { format: 'image/png', quality: 0.92 },
  })
  const raw = Buffer.from(await result.arrayBuffer())

  // Recortar los píxeles transparentes del borde para que el auto
  // llene el lienzo y todas las imágenes queden con el mismo "zoom visual"
  try {
    const trimmed = await sharp(raw)
      .trim({ threshold: 10 })   // elimina bordes con alpha ≤ 10
      .png()
      .toBuffer()
    return trimmed
  } catch {
    return raw  // si trim falla (imagen completamente opaca), devolver original
  }
}

module.exports = { removeBg, warmup }
