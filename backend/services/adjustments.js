const sharp = require('sharp')

/**
 * Aplica ajustes de imagen (brillo, contraste, rotación) a un buffer PNG/JPG
 * Devuelve buffer PNG con los ajustes aplicados
 */
async function applyAdjustments(buffer, { brightness = 1, contrast = 1, rotation = 0 } = {}) {
  let img = sharp(buffer)

  // Rotación
  if (rotation !== 0) img = img.rotate(rotation)

  // Brillo: modulate recibe factor multiplicador (1 = sin cambio)
  if (brightness !== 1) img = img.modulate({ brightness })

  // Contraste: linear(a, b) => px * a + b
  // Fórmula estándar: a = contrast, b = 128 * (1 - contrast)
  if (contrast !== 1) {
    img = img.linear(contrast, Math.round(128 * (1 - contrast)))
  }

  return img.png().toBuffer()
}

/**
 * Redimensiona manteniendo aspect ratio, por lado mayor
 */
async function resizeOutput(buffer, maxPx, format = 'jpeg') {
  const meta = await sharp(buffer).metadata()
  const larger = Math.max(meta.width, meta.height)
  if (larger <= maxPx) {
    // Ya es suficientemente pequeña, solo convertir formato
    return format === 'jpeg'
      ? sharp(buffer).jpeg({ quality: 90 }).toBuffer()
      : sharp(buffer).png().toBuffer()
  }
  const ratio = maxPx / larger
  const w = Math.round(meta.width  * ratio)
  const h = Math.round(meta.height * ratio)
  const img = sharp(buffer).resize(w, h, { fit: 'inside' })
  return format === 'jpeg'
    ? img.jpeg({ quality: 90 }).toBuffer()
    : img.png().toBuffer()
}

module.exports = { applyAdjustments, resizeOutput }
