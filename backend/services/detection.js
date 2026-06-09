const sharp = require('sharp')

/**
 * Detecta si una imagen es interior o exterior de auto.
 * MUY conservador: solo marca interior cuando hay evidencia clara.
 * En caso de duda → siempre exterior.
 */
async function detectImageType(buffer) {
  try {
    const SIZE = 120
    const { data } = await sharp(buffer)
      .resize(SIZE, SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const pixels = []
    for (let i = 0; i < data.length; i += 3) {
      pixels.push({ r: data[i], g: data[i+1], b: data[i+2] })
    }

    // ── 1. Contraste borde vs centro ──────────────────────────────────────
    // Exterior: auto destacado del fondo → diferencia alta
    // Interior: toda la imagen es habitáculo → diferencia baja
    const BORDER = Math.floor(SIZE * 0.12)
    const borderPx = [], centerPx = []
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const p = pixels[y * SIZE + x]
        const lum = 0.299*p.r + 0.587*p.g + 0.114*p.b
        if (x < BORDER || x >= SIZE-BORDER || y < BORDER || y >= SIZE-BORDER)
          borderPx.push(lum)
        else
          centerPx.push(lum)
      }
    }
    const meanBorder = borderPx.reduce((a,b)=>a+b,0)/borderPx.length
    const meanCenter = centerPx.reduce((a,b)=>a+b,0)/centerPx.length
    const bgFgContrast = Math.abs(meanCenter - meanBorder)

    // ── 2. Saturación global ──────────────────────────────────────────────
    // Exteriores suelen tener más color (cielo azul, carrocería de color)
    // Interiores son grises/beige/negros
    const avgSat = pixels.reduce((s, p) => {
      const max = Math.max(p.r, p.g, p.b)
      const min = Math.min(p.r, p.g, p.b)
      return s + (max === 0 ? 0 : (max - min) / max)
    }, 0) / pixels.length

    // ── 3. Proporción de tonos neutros oscuros ─────────────────────────────
    // Habitáculos tienen mucho negro/gris/cuero oscuro
    const darkNeutral = pixels.filter(p => {
      const lum = 0.299*p.r + 0.587*p.g + 0.114*p.b
      const max = Math.max(p.r, p.g, p.b)
      const min = Math.min(p.r, p.g, p.b)
      const sat = max === 0 ? 0 : (max - min) / max
      return sat < 0.12 && lum < 160
    }).length / pixels.length

    // ── 4. Varianza del borde (textura compleja = interior) ───────────────
    const borderVariance = (() => {
      const mean = borderPx.reduce((a,b)=>a+b,0)/borderPx.length
      return borderPx.reduce((a,b)=>a+(b-mean)**2,0)/borderPx.length
    })()

    // ── Scoring — necesita MÚLTIPLES señales fuertes para decir interior ──
    let interiorPoints = 0

    // Contraste borde/centro muy bajo → sin separación auto/fondo
    if (bgFgContrast < 15) interiorPoints += 3
    else if (bgFgContrast < 25) interiorPoints += 1

    // Saturación global muy baja → sin colores vivos
    if (avgSat < 0.07) interiorPoints += 2
    else if (avgSat < 0.12) interiorPoints += 1

    // Muchos tonos oscuros neutros
    if (darkNeutral > 0.50) interiorPoints += 2
    else if (darkNeutral > 0.35) interiorPoints += 1

    // Borde muy texturizado (tablero, techo de habitáculo)
    if (borderVariance > 2000) interiorPoints += 1

    // Umbral alto: necesita ≥ 5 puntos para clasificar como interior
    // Así una foto de auto de noche en exterior no se confunde
    const isInterior = interiorPoints >= 5

    const confidence = isInterior
      ? Math.min(0.92, 0.55 + interiorPoints * 0.06)
      : Math.max(0.65, 0.95 - interiorPoints * 0.08)

    console.log(`[detect] bgFgContrast=${bgFgContrast.toFixed(1)} avgSat=${avgSat.toFixed(3)} darkNeutral=${darkNeutral.toFixed(2)} borderVar=${borderVariance.toFixed(0)} → score=${interiorPoints} → ${isInterior ? 'INTERIOR' : 'exterior'}`)

    return {
      type: isInterior ? 'interior' : 'exterior',
      confidence: +confidence.toFixed(2),
      _debug: { interiorPoints, bgFgContrast: +bgFgContrast.toFixed(1), avgSat: +avgSat.toFixed(3), darkNeutral: +darkNeutral.toFixed(2), borderVariance: +borderVariance.toFixed(0) }
    }
  } catch (e) {
    console.error('[detection]', e.message)
    return { type: 'exterior', confidence: 0.5 }
  }
}

module.exports = { detectImageType }
