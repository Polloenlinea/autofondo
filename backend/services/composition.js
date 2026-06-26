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
 * Genera un degradado RADIAL (circular) como buffer JPEG.
 * @param {number} w ancho
 * @param {number} h alto
 * @param {{r,g,b}} inner color en el centro
 * @param {{r,g,b}} outer color en los bordes
 */
function makeRadialGradient(w, h, inner, outer) {
  const buf = Buffer.alloc(w * h * 3)
  const cx = w / 2, cy = h / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy
      // suavizar la curva del degradado para que se vea natural (estudio)
      const t = Math.min(1, Math.sqrt(dx * dx + dy * dy) / maxR) ** 1.3
      const r = Math.round(inner.r + (outer.r - inner.r) * t)
      const g = Math.round(inner.g + (outer.g - inner.g) * t)
      const b = Math.round(inner.b + (outer.b - inner.b) * t)
      const idx = (y * w + x) * 3
      buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer()
}

/**
 * Genera un fondo preset como buffer JPEG
 * @param {string} preset
 * @param {number} w ancho
 * @param {number} h alto
 */
async function generatePresetBg(preset, w = 1920, h = 1080) {
  // Fondos con degradé RADIAL (circular): center/edge en formato {r,g,b}
  const radials = {
    // Foco neutro: claro al centro, oscuro hacia afuera (spotlight de estudio)
    foco:    { inner: { r:238, g:242, b:246 }, outer: { r:150, g:162, b:176 } },
    // Azul: claro al centro, azul profundo hacia afuera
    azul:    { inner: { r:224, g:238, b:255 }, outer: { r:23,  g:54,  b:93  } },
    // Violeta: claro al centro, violeta profundo hacia afuera
    violeta: { inner: { r:237, g:233, b:254 }, outer: { r:76,  g:29,  b:149 } },
    // Verde: claro al centro, verde profundo hacia afuera
    verde:   { inner: { r:220, g:248, b:233 }, outer: { r:6,   g:78,  b:59  } },
    // Aurora: oscuro al centro, claro hacia afuera (dirección inversa)
    aurora:  { inner: { r:12,  g:74,  b:110 }, outer: { r:224, g:242, b:248 } },
  }
  if (radials[preset]) {
    const { inner, outer } = radials[preset]
    return makeRadialGradient(w, h, inner, outer)
  }

  const solids = {
    white:  [{ pos:0, r:255,g:255,b:255 }, { pos:1, r:255,g:255,b:255 }],
    // Gris plano, un poco más oscuro que el original (#ecf0f3)
    gray:   [{ pos:0, r:214,g:219,b:224 }, { pos:1, r:214,g:219,b:224 }],
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

/** Tolerancia: diferencia máx. de altura de contacto izq vs der (fracción del alto) para considerar "nivelado" */
const LEVEL_TOLERANCE = 0.045

/**
 * Decide si el auto apoya NIVELADO en el piso (foto recta: perfil, frente o
 * espalda) comparando la altura de contacto del tercio izquierdo vs el derecho.
 * En una foto recta las ruedas/base están a la misma altura (línea de contacto
 * horizontal); en una 3/4 la base queda inclinada (un lado más abajo).
 * Solo en autos nivelados tiene sentido aplicar sombra de piso y reflejo.
 *
 * @param {Int32Array} bottomY  fila de contacto por columna (-1 si vacía)
 * @param {number} carLeft, carRight  rango horizontal real del auto
 * @param {number} h  alto de referencia (para la tolerancia)
 */
function isContactLevel(bottomY, carLeft, carRight, h) {
  const w = carRight - carLeft + 1
  if (w < 12) return true
  const third = Math.max(1, Math.round(w / 3))
  // Mediana de la franja más baja (ruedas) en cada tercio → robusto al ruido
  const lowestIn = (a, b) => {
    const vals = []
    for (let xx = a; xx <= b; xx++) if (bottomY[xx] >= 0) vals.push(bottomY[xx])
    if (!vals.length) return -1
    vals.sort((p, q) => q - p)            // de mayor (más bajo) a menor
    const take = Math.max(1, Math.round(vals.length * 0.15))
    let s = 0; for (let i = 0; i < take; i++) s += vals[i]
    return s / take                        // promedio del 15% más bajo = línea de contacto
  }
  const left  = lowestIn(carLeft, carLeft + third - 1)
  const right = lowestIn(carRight - third + 1, carRight)
  if (left < 0 || right < 0) return true
  return Math.abs(left - right) <= h * LEVEL_TOLERANCE
}

/**
 * Versión standalone: dado un recorte, dice si apoya nivelado (para avisar en la UI).
 */
async function isLevel(carBuffer) {
  try {
    const targetW = 480
    const meta = await sharp(carBuffer).metadata()
    const scale = targetW / meta.width
    const targetH = Math.max(1, Math.round(meta.height * scale))
    const alpha = await sharp(carBuffer).resize(targetW, targetH).extractChannel(3).raw().toBuffer()
    const stride = alpha.length >= targetW * targetH * 3 ? 3 : 1
    const bottomY = new Int32Array(targetW).fill(-1)
    let carLeft = -1, carRight = -1
    for (let xx = 0; xx < targetW; xx++) {
      for (let yy = targetH - 1; yy >= 0; yy--) {
        if (alpha[(yy * targetW + xx) * stride] > 200) { bottomY[xx] = yy; if (carLeft < 0) carLeft = xx; carRight = xx; break }
      }
    }
    if (carLeft < 0) return true
    return isContactLevel(bottomY, carLeft, carRight, targetH)
  } catch {
    return true
  }
}

/**
 * Encuentra el componente conectado MÁS GRANDE de la máscara de alpha — es decir,
 * el auto real, ignorando carteles/postes/antenas u otros restos sueltos que el
 * recorte de IA no haya limpiado del todo (aparecen como blobs separados del auto,
 * y si no se filtran corrompen por completo el cálculo de sombra/reflejo).
 *
 * Trabaja en una versión reducida de la máscara (rápido) y devuelve una función
 * `inMainBlob(x, y)` para consultar a resolución completa.
 */
async function findMainBlob(carBuffer, nw, nh) {
  const targetW = Math.min(nw, 480)
  const scale   = targetW / nw
  const targetH = Math.max(1, Math.round(nh * scale))

  const small = await sharp(carBuffer).resize(nw, nh)
    .resize(targetW, targetH, { fit: 'fill' })
    .extractChannel(3).raw().toBuffer()
  const stride = small.length >= targetW * targetH * 3 ? 3 : 1

  const n = targetW * targetH
  const mask   = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = small[i * stride] > 200 ? 1 : 0

  const labels = new Int32Array(n).fill(-1)
  const stack  = new Int32Array(n)
  let bestLabel = -1, bestSize = 0, label = 0

  for (let i = 0; i < n; i++) {
    if (mask[i] !== 1 || labels[i] !== -1) continue
    let sp = 0, size = 0
    stack[sp++] = i
    labels[i] = label
    while (sp > 0) {
      const idx = stack[--sp]
      size++
      const xx = idx % targetW
      if (xx > 0            && mask[idx - 1]        === 1 && labels[idx - 1]        === -1) { labels[idx - 1]        = label; stack[sp++] = idx - 1 }
      if (xx < targetW - 1  && mask[idx + 1]        === 1 && labels[idx + 1]        === -1) { labels[idx + 1]        = label; stack[sp++] = idx + 1 }
      if (idx >= targetW    && mask[idx - targetW]  === 1 && labels[idx - targetW]  === -1) { labels[idx - targetW]  = label; stack[sp++] = idx - targetW }
      if (idx < n - targetW && mask[idx + targetW]  === 1 && labels[idx + targetW]  === -1) { labels[idx + targetW]  = label; stack[sp++] = idx + targetW }
    }
    if (size > bestSize) { bestSize = size; bestLabel = label }
    label++
  }

  if (bestLabel === -1) return null

  return {
    inMainBlob(x, y) {
      const tx = Math.min(targetW - 1, Math.round(x * scale))
      const ty = Math.min(targetH - 1, Math.round(y * scale))
      return labels[ty * targetW + tx] === bestLabel
    },
  }
}

/**
 * Compone un auto (RGBA) sobre un fondo
 */
async function compose({ carBuffer, bgBuffer, scale, posX, posY, shadow, reflection, shadowIntensity = 100, reflectionIntensity = 100 }) {
  // Multiplicadores 0-1 sobre los topes de opacidad de sombra/reflejo. Permiten
  // atenuar la sombra/reflejo cuando quedan demasiado marcados según el fondo.
  const shadowK = Math.max(0, Math.min(1, shadowIntensity / 100))
  const reflK   = Math.max(0, Math.min(1, reflectionIntensity / 100))
  const bgMeta  = await sharp(bgBuffer).metadata()

  const carMeta = await sharp(carBuffer).metadata()

  // Calcular tamaño deseado basado en el ancho del fondo (escala el recorte completo
  // → el auto conserva su tamaño/proporción natural, como en la foto original).
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

  // Aislar el auto real (ignorar carteles/postes/antenas sueltos del recorte) y
  // preparar la máscara/píxeles limpios para sombra y reflejo.
  let cleanAlpha = null   // alpha (1 byte/px) solo del auto principal
  let carPixels  = null   // RGBA del auto a tamaño nw×nh
  let yMax = -1           // línea de contacto con el piso (fila más baja del auto)
  let carLeft = -1, carRight = -1
  let level = true        // ¿el auto apoya nivelado? (reflejo solo si sí)
  let bottomY = null      // fila de contacto por columna
  let colMass = null      // masa de carrocería por columna (para densidad de la huella)
  if (shadow || reflection) {
    const blob = await findMainBlob(carBuffer, nw, nh)
    carPixels = await sharp(carResized).ensureAlpha().raw().toBuffer()
    cleanAlpha = new Uint8Array(nw * nh)
    bottomY = new Int32Array(nw).fill(-1)
    colMass = new Float32Array(nw)
    for (let yy = 0; yy < nh; yy++) {
      for (let xx = 0; xx < nw; xx++) {
        const a = carPixels[(yy * nw + xx) * 4 + 3]
        if (a > 200 && (!blob || blob.inMainBlob(xx, yy))) {
          cleanAlpha[yy * nw + xx] = a
          if (yy > yMax) yMax = yy
          if (carLeft < 0 || xx < carLeft) carLeft = xx
          if (xx > carRight) carRight = xx
          bottomY[xx] = yy // última fila opaca de la columna = su contacto
          colMass[xx] += 1
        }
      }
    }
    // El reflejo solo en autos nivelados (recto). La sombra ahora se aplica a
    // (casi) todos siguiendo la inclinación real de las ruedas.
    level = isContactLevel(bottomY, carLeft, carRight, nh)
  }

  if (shadow && yMax >= 0 && carLeft >= 0) {
    try {
      // Sombra de HUELLA proyectada: una huella suave bajo el auto, INCLINADA
      // según la línea REAL de las dos ruedas (rueda trasera vs delantera), no un
      // charco horizontal. Más densa donde hay más masa de carrocería.
      const wc = carRight - carLeft + 1
      // contacto de cada rueda = punto más bajo de cada tercio del auto
      const third = Math.max(1, Math.round(wc * 0.33))
      let rl = -1, rlx = carLeft
      for (let xx = carLeft; xx < carLeft + third; xx++) if (bottomY[xx] > rl) { rl = bottomY[xx]; rlx = xx }
      let fr = -1, frx = carRight
      for (let xx = carRight - third + 1; xx <= carRight; xx++) if (bottomY[xx] > fr) { fr = bottomY[xx]; frx = xx }
      const mg = (frx !== rlx) ? (fr - rl) / (frx - rlx) : 0
      const drop = Math.round(nh * 0.012)
      const groundY = xx => rl + mg * (xx - rlx) + drop

      let maxMass = 0; for (let xx = carLeft; xx <= carRight; xx++) if (colMass[xx] > maxMass) maxMass = colMass[xx]
      const sig = nh * 0.045                 // grosor de la huella
      const blurAmt = Math.max(2, Math.round(nw * 0.008))
      // canvas de sombra: alto del auto + margen para la huella inclinada
      const SH = Math.min(bgMeta.height - y, nh + Math.round(nh * 0.4))
      const band = new Float32Array(nw * SH)
      for (let xx = carLeft; xx <= carRight; xx++) {
        if (colMass[xx] <= 0) continue
        const dens = Math.pow(colMass[xx] / maxMass, 0.7)
        const cy = groundY(xx)
        const y1 = Math.max(0, Math.floor(cy - sig * 3)), y2 = Math.min(SH - 1, Math.ceil(cy + sig * 3.5))
        for (let yy = y1; yy <= y2; yy++) {
          const d = (yy - cy) / sig
          band[yy * nw + xx] += dens * Math.exp(-0.5 * d * d)
        }
      }
      let mx = 0; for (let i = 0; i < band.length; i++) if (band[i] > mx) mx = band[i]
      if (mx > 0) {
        const gray = Buffer.alloc(nw * SH)
        for (let i = 0; i < nw * SH; i++) gray[i] = Math.min(255, Math.round((band[i] / mx) * 255))
        const blurred = await sharp(gray, { raw: { width: nw, height: SH, channels: 1 } })
          .blur(blurAmt).toColourspace('b-w').raw().toBuffer()
        const shadowRGBA = Buffer.alloc(nw * SH * 4)
        for (let i = 0; i < nw * SH; i++) shadowRGBA[i * 4 + 3] = Math.round(blurred[i] * 0.6 * shadowK)
        const shadowPng = await sharp(shadowRGBA, { raw: { width: nw, height: SH, channels: 4 } }).png().toBuffer()
        composites.push({ input: shadowPng, left: x, top: Math.min(y, bgMeta.height - SH), blend: 'over' })
      }
    } catch { /* shadow opcional */ }
  }

  if (reflection && level && yMax >= 0) {
    try {
      // Reflejo de PISO: espejado RÍGIDO del auto entero, ALINEADO rueda-con-rueda
      // en la línea de contacto. Construimos un buffer limpio (solo auto principal),
      // lo espejamos verticalmente respecto de yMax, y aplicamos degradado lineal
      // (opaco pegado a las ruedas → transparente hacia abajo) + blur gaussiano.
      const reflLen   = Math.round(nh * 0.5) // hasta dónde llega el reflejo hacia abajo
      const available = bgMeta.height - (y + yMax) - 1
      const fh = Math.max(0, Math.min(reflLen, available))

      if (fh > 6) {
        const reflRGBA = Buffer.alloc(nw * fh * 4)
        for (let row = 0; row < fh; row++) {
          const srcY = yMax - 1 - row // espejar hacia arriba desde la línea de contacto
          if (srcY < 0) continue
          // Degradado lineal: más opaco cerca de las ruedas, se desvanece hacia abajo
          const opacity = Math.max(0, 1 - row / fh) * 0.40 * reflK
          for (let xx = 0; xx < nw; xx++) {
            if (cleanAlpha[srcY * nw + xx] === 0) continue // solo refleja el auto, no el ruido
            const srcIdx = (srcY * nw + xx) * 4
            const dstIdx = (row  * nw + xx) * 4
            reflRGBA[dstIdx]     = carPixels[srcIdx]
            reflRGBA[dstIdx + 1] = carPixels[srcIdx + 1]
            reflRGBA[dstIdx + 2] = carPixels[srcIdx + 2]
            reflRGBA[dstIdx + 3] = Math.round(carPixels[srcIdx + 3] * opacity)
          }
        }

        const blurAmt = Math.max(2, Math.round(nw * 0.006))
        const reflPng = await sharp(reflRGBA, { raw: { width: nw, height: fh, channels: 4 } })
          .blur(blurAmt)
          .png().toBuffer()

        composites.push({ input: reflPng, left: x, top: y + yMax, blend: 'over' })
      }
    } catch { /* reflejo opcional */ }
  }

  composites.push({ input: carResized, left: x, top: y })

  return sharp(bgBuffer)
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer()
}

module.exports = { generatePresetBg, compose, isLevel }
