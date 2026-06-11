const { ImageAnnotatorClient } = require('@google-cloud/vision')
const sharp = require('sharp')

let _client = null
function getClient() {
  if (!_client) _client = new ImageAnnotatorClient()
  return _client
}

// ── Homografía pura JS ────────────────────────────────────────────────────────

function gaussElim(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col]
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n] / M[i][i]
    for (let k = i - 1; k >= 0; k--) M[k][n] -= M[k][i] * x[i]
  }
  return x
}

// Calcula H 3x3 que mapea src[4pts] → dst[4pts]
function computeH(src, dst) {
  const A = [], b = []
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i], [dx, dy] = dst[i]
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx)
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy)
  }
  const h = gaussElim(A, b)
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]]
}

function applyH(H, x, y) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2]
  return [
    (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
  ]
}

function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, k]] = m
  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g)
  return [
    [(e * k - f * h) / det, (c * h - b * k) / det, (b * f - c * e) / det],
    [(f * g - d * k) / det, (a * k - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ]
}

// ── Detección de matrícula con Vision API ─────────────────────────────────────

// Patrones: Uruguay ABC 1234 / Argentina AA 001 AA / Brasil AAA0A00 / genérico
const PLATE_RE = /^[A-Z]{1,4}[\s-]?\d{3,4}[\s-]?[A-Z]{0,2}$|^\d{3,4}[\s-]?[A-Z]{2,4}$/i

async function detectPlatePoly(imageBuffer) {
  try {
    const client = getClient()
    const [result] = await client.textDetection({
      image: { content: imageBuffer.toString('base64') },
    })
    const annotations = result.textAnnotations || []

    // La anotación 0 es el bloque total; desde la 1 son palabras/tokens individuales
    for (const ann of annotations.slice(1)) {
      const text = (ann.description || '').trim()
      if (PLATE_RE.test(text)) {
        const verts = ann.boundingPoly?.vertices
        if (verts?.length === 4) {
          const poly = verts.map(v => [v.x || 0, v.y || 0])
          console.log(`[plateCensor] matrícula detectada: "${text}" → ${JSON.stringify(poly)}`)
          return poly
        }
      }
    }

    // Fallback: buscar combinaciones de 2 tokens adyacentes (ej: "ABC" + "1234" separados)
    const words = annotations.slice(1).map(a => ({
      text: (a.description || '').trim(),
      verts: a.boundingPoly?.vertices,
    }))
    for (let i = 0; i < words.length - 1; i++) {
      const combined = words[i].text + words[i + 1].text
      if (PLATE_RE.test(combined) && words[i].verts?.length === 4 && words[i + 1].verts?.length === 4) {
        // Unir los dos bounding boxes
        const allV = [...words[i].verts, ...words[i + 1].verts]
        const xs = allV.map(v => v.x || 0), ys = allV.map(v => v.y || 0)
        const poly = [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
          [Math.min(...xs), Math.max(...ys)],
        ]
        console.log(`[plateCensor] matrícula (2 tokens): "${combined}" → ${JSON.stringify(poly)}`)
        return poly
      }
    }

    console.log('[plateCensor] no se detectó matrícula')
    return null
  } catch (err) {
    console.warn('[plateCensor] Vision API error:', err.message)
    return null
  }
}

// ── Warpear logo sobre el polígono de la matrícula ────────────────────────────

async function warpLogo(logoBuffer, dstPoly, imgW, imgH) {
  const { data: src, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const lw = info.width, lh = info.height

  // Corners del logo: TL, TR, BR, BL (mismo orden que Vision API devuelve)
  const srcCorners = [[0, 0], [lw, 0], [lw, lh], [0, lh]]
  const H     = computeH(srcCorners, dstPoly)
  const H_inv = inv3(H)

  const xs = dstPoly.map(p => p[0]), ys = dstPoly.map(p => p[1])
  const x0 = Math.max(0, Math.floor(Math.min(...xs)))
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const x1 = Math.min(imgW - 1, Math.ceil(Math.max(...xs)))
  const y1 = Math.min(imgH - 1, Math.ceil(Math.max(...ys)))

  const out = Buffer.alloc(imgW * imgH * 4, 0)

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const [lx, ly] = applyH(H_inv, x, y)
      const sx = Math.round(lx), sy = Math.round(ly)
      if (sx < 0 || sy < 0 || sx >= lw || sy >= lh) continue
      const si = (sy * lw + sx) * 4
      const di = (y * imgW + x) * 4
      out[di]     = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }

  return sharp(out, { raw: { width: imgW, height: imgH, channels: 4 } })
    .png()
    .toBuffer()
}

// ── Expandir el polígono un poco para cubrir el marco de la chapa ─────────────
function expandPoly(poly, px = 6) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / 4
  const cy = poly.reduce((s, p) => s + p[1], 0) / 4
  return poly.map(([x, y]) => {
    const dx = x - cx, dy = y - cy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    return [Math.round(x + (dx / len) * px), Math.round(y + (dy / len) * px)]
  })
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Aplica censura sobre un polígono ya conocido — sin re-detectar.
 * Útil para aplicar las mismas coordenadas al cutout tras detectar en el original.
 */
async function applyPlateCensor(imageBuffer, poly, logoBuffer = null) {
  const { width, height } = await sharp(imageBuffer).metadata()
  const expanded = expandPoly(poly, 8)

  const svgMask = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${expanded.map(([x, y]) => `${x},${y}`).join(' ')}" fill="black"/>
  </svg>`

  let result = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svgMask), blend: 'over' }])
    .png()
    .toBuffer()

  if (logoBuffer) {
    try {
      const warped = await warpLogo(logoBuffer, expanded, width, height)
      result = await sharp(result)
        .composite([{ input: warped, blend: 'over' }])
        .png()
        .toBuffer()
    } catch (err) {
      console.warn('[plateCensor] error al warpear logo:', err.message)
    }
  }

  return result
}

/**
 * Detecta la matrícula en imageBuffer y devuelve el polígono + buffer censurado.
 * @param {Buffer} imageBuffer  imagen original (JPEG/PNG) — usar el original para mejor OCR
 * @param {Buffer|null} logoBuffer  logo del dealer — si null → chapa negra
 * @returns {{ buffer: Buffer, found: boolean, poly: Array|null }}
 */
async function censorPlate(imageBuffer, logoBuffer = null) {
  const poly = await detectPlatePoly(imageBuffer)
  if (!poly) return { buffer: imageBuffer, found: false, poly: null }

  const buffer = await applyPlateCensor(imageBuffer, poly, logoBuffer)
  return { buffer, found: true, poly }
}

module.exports = { censorPlate, applyPlateCensor }
