const sharp = require('sharp')

/**
 * Genera un degradado vertical como buffer JPEG
 * @param {number} w ancho
 * @param {number} h alto
 * @param {Array<{pos:number,r:number,g:number,b:number}>} stops color stops (pos 0-1)
 */
function makeGradient(w, h, stops) {
  const buf = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1)
    let c1 = stops[0], c2 = stops[stops.length - 1], lt = 1
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].pos && t <= stops[i+1].pos) {
        const span = stops[i+1].pos - stops[i].pos
        lt = span > 0 ? (t - stops[i].pos) / span : 0
        c1 = stops[i]; c2 = stops[i+1]; break
      }
    }
    const r = Math.round(c1.r + (c2.r - c1.r) * lt)
    const g = Math.round(c1.g + (c2.g - c1.g) * lt)
    const b = Math.round(c1.b + (c2.b - c1.b) * lt)
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3
      buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer()
}

/**
 * Genera un fondo preset como buffer JPEG
 * @param {'white'|'gray'|'dark'|'forest'|'sky'|'city'|'sunset'|'sand'} preset
 * @param {number} w ancho
 * @param {number} h alto
 */
async function generatePresetBg(preset, w = 1920, h = 1080) {
  const solids = {
    white:  [{ pos:0, r:255,g:255,b:255 }, { pos:1, r:255,g:255,b:255 }],
    gray:   [{ pos:0, r:236,g:240,b:243 }, { pos:1, r:236,g:240,b:243 }],
    dark:   [{ pos:0, r:15, g:23, b:42  }, { pos:1, r:15, g:23, b:42  }],
  }
  const gradients = {
    forest: [{ pos:0, r:56,g:142,b:60  }, { pos:0.5, r:27,g:94,b:32   }, { pos:1, r:10,g:46,b:12   }],
    sky:    [{ pos:0, r:56,g:189,b:248 }, { pos:0.6, r:14,g:165,b:233 }, { pos:1, r:7,g:89,b:133   }],
    city:   [{ pos:0, r:15,g:23,b:42   }, { pos:0.5, r:23,g:37,b:84   }, { pos:1, r:10,g:15,b:30   }],
    sunset: [{ pos:0, r:88,g:28,b:135  }, { pos:0.4, r:190,g:24,b:93  }, { pos:0.7, r:234,g:88,b:12 }, { pos:1, r:249,g:168,b:37 }],
    sand:   [{ pos:0, r:125,g:145,b:170}, { pos:0.4, r:168,g:140,b:110}, { pos:1, r:194,g:160,b:110 }],
  }
  const stops = solids[preset] ?? gradients[preset] ?? solids.white
  return makeGradient(w, h, stops)
}

/** Umbral de relación ancho/alto a partir del cual un auto se considera "horizontal" (foto de perfil) */
const HORIZONTAL_RATIO = 1.4

/**
 * Determina si un recorte de auto es lo suficientemente horizontal como para
 * que un reflejo tenga sentido visual (fotos de 3/4 o frontales quedan raras).
 */
async function isHorizontal(carBuffer) {
  try {
    // Medir el recorte real del auto (sin los bordes transparentes), no el
    // lienzo completo — una foto sacada en vertical puede tener un auto
    // perfectamente "de perfil" dentro de un canvas más alto que ancho.
    const { info } = await sharp(carBuffer).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true })
    return (info.width / info.height) >= HORIZONTAL_RATIO
  } catch {
    const meta = await sharp(carBuffer).metadata()
    return (meta.width / meta.height) >= HORIZONTAL_RATIO
  }
}

/**
 * Genera el buffer PNG de un reflejo (auto espejado verticalmente, con
 * degradado de opacidad) listo para componer con blend "multiply".
 */
async function buildReflection(carResizedBuffer, nw, nh, contentBottom, maxHeight) {
  const reflectH = Math.max(1, Math.min(Math.round(nh * 0.45), maxHeight, contentBottom + 1))
  if (reflectH < 4) return null

  // Espejar verticalmente y arrancar desde el borde inferior REAL del auto
  // (no desde el borde del canvas, que puede tener relleno transparente debajo)
  // flipTop nunca puede ser negativo — clampear a 0
  const flipTop = Math.max(0, nh - 1 - contentBottom)
  const safeH   = Math.min(reflectH, nh - flipTop)
  if (safeH < 4) return null

  const flipped = await sharp(carResizedBuffer).flip()
    .extract({ left: 0, top: flipTop, width: nw, height: safeH })
    .toBuffer()

  // Degradado: más visible pegado al auto, se desvanece hacia abajo
  const reflRGBA = Buffer.from(await sharp(flipped).ensureAlpha().raw().toBuffer())
  for (let yy = 0; yy < safeH; yy++) {
    const t = yy / Math.max(1, safeH - 1)
    const fade = Math.max(0, 1 - t) ** 1.6
    const opacity = fade * 0.32 // tope de opacidad del reflejo
    for (let xx = 0; xx < nw; xx++) {
      const idx = (yy * nw + xx) * 4
      reflRGBA[idx + 3] = Math.round(reflRGBA[idx + 3] * opacity)
    }
  }

  return sharp(reflRGBA, { raw: { width: nw, height: safeH, channels: 4 } }).png().toBuffer()
}

/**
 * Compone un auto (RGBA) sobre un fondo
 */
async function compose({ carBuffer, bgBuffer, scale, posX, posY, shadow, reflection }) {
  const bgMeta  = await sharp(bgBuffer).metadata()
  const carMeta = await sharp(carBuffer).metadata()

  // Calcular tamaño deseado basado en el ancho del fondo
  let nw = Math.max(1, Math.round(bgMeta.width * scale / 100))
  let nh = Math.max(1, Math.round(carMeta.height * nw / carMeta.width))

  // Si el auto excede la altura del fondo, reducir para que entre
  if (nh > bgMeta.height) {
    nh = bgMeta.height
    nw = Math.max(1, Math.round(carMeta.width * nh / carMeta.height))
  }
  // Nunca exceder el ancho del fondo tampoco
  if (nw > bgMeta.width) {
    nw = bgMeta.width
    nh = Math.max(1, Math.round(carMeta.height * nw / carMeta.width))
  }

  // Posición: clampear para que el auto no se salga del fondo
  const x = Math.max(0, Math.min(
    Math.round((bgMeta.width  - nw) * posX / 100),
    bgMeta.width  - nw
  ))
  const y = Math.max(0, Math.min(
    Math.round((bgMeta.height - nh) * posY / 100),
    bgMeta.height - nh
  ))

  const carResized = await sharp(carBuffer).resize(nw, nh).png().toBuffer()
  const composites = []

  // El cutout suele traer relleno transparente arriba/abajo dentro del canvas —
  // hay que encontrar el borde inferior REAL del auto (no asumir que es nh-1),
  // tanto para la sombra de contacto como para el reflejo.
  let contentBottom = -1
  let alphaBuf = null
  if (shadow || reflection) {
    alphaBuf = await sharp(carBuffer).resize(nw, nh).extractChannel(3).raw().toBuffer()
    outer:
    for (let yy = nh - 1; yy >= 0; yy--) {
      const rowStart = yy * nw
      for (let xx = 0; xx < nw; xx++) {
        if (alphaBuf[rowStart + xx] > 15) { contentBottom = yy; break outer }
      }
    }
  }

  if (shadow && contentBottom >= 0) {
    try {
      // Sombra de CONTACTO: tomamos solo la franja donde el auto realmente "toca el piso",
      // la aplastamos verticalmente y la difuminamos — no la silueta completa desplazada
      // (que queda tapada detrás del auto y resulta invisible).
      {
        const footH   = Math.max(4, Math.min(contentBottom + 1, Math.round(nh * 0.20)))
        const footTop = contentBottom - footH + 1
        const footBuf = Buffer.alloc(nw * footH)
        for (let yy = 0; yy < footH; yy++) {
          alphaBuf.copy(footBuf, yy * nw, (footTop + yy) * nw, (footTop + yy + 1) * nw)
        }

        const shadowH  = Math.max(8, Math.round(nh * 0.12))
        const blurAmt  = Math.max(3, Math.round(nw * 0.025))
        // sharp puede devolver 1 o 3 canales tras resize+blur según la versión/plataforma.
        // Usar grayscale() es más fiable que toColourspace('b-w') para forzar 1 canal.
        const squashed = await sharp(footBuf, { raw: { width: nw, height: footH, channels: 1 } })
          .resize(nw, shadowH, { fit: 'fill' })
          .blur(blurAmt)
          .grayscale()
          .raw().toBuffer()

        // Detectar stride real (1 o 3 canales) por el tamaño del buffer
        const expectedPx = nw * shadowH
        const stride = squashed.length >= expectedPx * 3 ? 3 : 1

        // RGBA negro con alpha = degradado de opacidad — blend "over" (no "multiply": ese modo
        // produce bandeado visible en degradados suaves sobre fondos lisos en sharp/libvips)
        const shadowRGBA = Buffer.alloc(nw * shadowH * 4)
        for (let i = 0; i < expectedPx; i++) {
          shadowRGBA[i * 4 + 3] = Math.min(255, Math.round(squashed[i * stride] * 0.45))
        }
        const shadowPng = await sharp(shadowRGBA, { raw: { width: nw, height: shadowH, channels: 4 } })
          .png().toBuffer()

        // Apoyada en el borde inferior REAL del auto, con leve superposición
        const shadowTop = Math.min(
          Math.max(0, y + contentBottom - Math.round(shadowH * 0.5)),
          bgMeta.height - shadowH
        )
        composites.push({
          input: shadowPng,
          left:  x,
          top:   shadowTop,
          blend: 'over',
        })
      }
    } catch { /* shadow opcional */ }
  }

  if (reflection && contentBottom >= 0) {
    try {
      const maxHeight = bgMeta.height - (y + contentBottom + 1)
      const reflPng = await buildReflection(carResized, nw, nh, contentBottom, maxHeight)
      if (reflPng) {
        composites.push({
          input: reflPng,
          left: x,
          top:  y + contentBottom + 1,
          blend: 'multiply',
        })
      }
    } catch { /* reflejo opcional */ }
  }

  composites.push({ input: carResized, left: x, top: y })

  return sharp(bgBuffer)
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer()
}

module.exports = { generatePresetBg, compose, isHorizontal }
