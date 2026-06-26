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

// opts: { model?: 'small'|'medium'|'large', engine?: 'imgly'|'birefnet-lite'|'birefnet-full' }
// Compat: si se pasa un string, se interpreta como modelOverride de @imgly.
async function removeBg(buffer, opts = null) {
  const sharp  = require('sharp')
  const { model: modelOverride = null, engine = 'imgly' } =
    typeof opts === 'string' ? { model: opts } : (opts || {})

  // Dimensiones originales para reconstruir el canvas
  const { width: origW, height: origH } = await sharp(buffer).metadata()

  let rawResult
  let isBiRefNet = false
  if (engine === 'birefnet-lite' || engine === 'birefnet-full') {
    // ── Motor BiRefNet (mejor calidad de borde) ──
    const { removeBgBiRefNet } = require('../ml/birefnet')
    rawResult = await removeBgBiRefNet(buffer, engine === 'birefnet-full' ? 'full' : 'lite')
    isBiRefNet = true
  } else {
    // ── Motor @imgly (rápido) ──
    const blob   = new Blob([buffer], { type: 'image/png' })
    const result = await removeBackground(blob, {
      model:  modelOverride || MODEL,
      output: { format: 'image/png', quality: 1.0 },
    })
    rawResult = Buffer.from(await result.arrayBuffer())
  }

  // Corregir píxeles semi-transparentes en la carrocería: SOLO para @imgly, que
  // deja alpha ~150-240 en paneles metálicos. BiRefNet ya da una máscara limpia,
  // así que NO la endurecemos (preserva el anti-aliasing fino de sus bordes).
  const { data: px, info: pxInfo } = await sharp(rawResult)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (!isBiRefNet) {
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] > 128) px[i] = 255   // umbral agresivo: mayoría de la carrocería → opaco
    }
  }

  // ── Defringe por DECONTAMINACIÓN DE COLOR (anti-reborde) ─────────────────────
  // Los píxeles del borde anti-aliased conservan el color del FONDO ORIGINAL (p.ej.
  // claro, de un estudio). Al componer sobre otro fondo se ven como un halo alrededor
  // del auto. En vez de borrar el borde (erosión → encoge el auto y come detalles),
  // REEMPLAZAMOS el color contaminado por el del vecino más opaco (color de la
  // carrocería), repetido DEFRINGE_ITERS veces. El ALPHA NO se toca → el auto NO se
  // encoge, el suavizado se conserva, y el halo desaparece. Subí DEFRINGE_ITERS si
  // alguna foto (fondo muy claro/borroso) dejara algo de halo. Probar es gratis.
  const DEFRINGE_ITERS = 4
  const W = pxInfo.width, H = pxInfo.height
  for (let it = 0; it < DEFRINGE_ITERS; it++) {
    const snap = Buffer.from(px)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4
        if (snap[p + 3] >= 250) continue   // núcleo opaco: no tocar
        let bestA = snap[p + 3], br = snap[p], bg = snap[p + 1], bb = snap[p + 2], found = false
        if (x > 0     && snap[p - 4 + 3] > bestA) { bestA = snap[p - 4 + 3]; br = snap[p - 4]; bg = snap[p - 3]; bb = snap[p - 2]; found = true }
        if (x < W - 1 && snap[p + 4 + 3] > bestA) { bestA = snap[p + 4 + 3]; br = snap[p + 4]; bg = snap[p + 5]; bb = snap[p + 6]; found = true }
        if (y > 0     && snap[p - W * 4 + 3] > bestA) { bestA = snap[p - W * 4 + 3]; br = snap[p - W * 4]; bg = snap[p - W * 4 + 1]; bb = snap[p - W * 4 + 2]; found = true }
        if (y < H - 1 && snap[p + W * 4 + 3] > bestA) { bestA = snap[p + W * 4 + 3]; br = snap[p + W * 4]; bg = snap[p + W * 4 + 1]; bb = snap[p + W * 4 + 2]; found = true }
        if (found) { px[p] = br; px[p + 1] = bg; px[p + 2] = bb }  // copia color, mantiene alpha
      }
    }
  }

  const raw = await sharp(px, { raw: { width: pxInfo.width, height: pxInfo.height, channels: 4 } })
    .png().toBuffer()

  try {
    // Recortar para obtener el bounding box real del auto
    const { data: trimmedData, info: trimInfo } = await sharp(raw).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true })
    const carW = trimInfo.width
    const carH = trimInfo.height

    const originalLeft = -(trimInfo.trimOffsetLeft || 0)
    const originalTop  = -(trimInfo.trimOffsetTop || 0)

    // Centrar el auto en el canvas original → preserva la composición si el auto
    // estaba centrado, y centra los que estaban descentrados
    const left = Math.max(0, Math.round((origW - carW) / 2))
    const top  = Math.max(0, Math.round((origH - carH) / 2))

    const dx = left - originalLeft
    const dy = top - originalTop

    const resultBuffer = await sharp({
      create: { width: origW, height: origH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: trimmedData, left, top }])
      .png()
      .toBuffer()

    return { buffer: resultBuffer, offset: { dx, dy } }
  } catch {
    return { buffer: raw, offset: { dx: 0, dy: 0 } }
  }
}

module.exports = { removeBg, warmup, MODEL }
