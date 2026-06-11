/**
 * Detecta regiones opacas desconectadas (blobs) en un PNG con fondo transparente.
 * Retorna un array de blobs con su bounding box y una máscara a escala reducida.
 * Usado para detectar múltiples autos en el mismo cutout.
 */

const DETECT_SIZE   = 400   // resolución para el análisis (más rápido)
const MIN_BLOB_FRAC = 0.03  // blob debe cubrir al menos 3% del área total
const ALPHA_THRESH  = 30    // alpha mínimo para considerar el pixel como "opaco"

/**
 * @param {string} base64  PNG en base64 (cutout con fondo transparente)
 * @returns {Promise<Array<{id, x1, y1, x2, y2, pixels, labelW, labelH, scale}>>}
 *   blobs ordenados por tamaño desc. Si solo hay 1 (o ninguno), retorna [].
 */
export function detectBlobs(base64) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const origW = img.width, origH = img.height
      const scale = Math.min(1, DETECT_SIZE / Math.max(origW, origH))
      const w = Math.round(origW * scale)
      const h = Math.round(origH * scale)

      const cv = document.createElement('canvas')
      cv.width = w; cv.height = h
      const ctx = cv.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)

      // Array de etiquetas: -1 = fondo/no visitado
      const labeled = new Int32Array(w * h).fill(-1)
      let nextLabel = 0

      // DFS iterativo para cada pixel opaco no etiquetado
      for (let start = 0; start < w * h; start++) {
        if (data[start * 4 + 3] < ALPHA_THRESH) continue
        if (labeled[start] >= 0) continue

        const label = nextLabel++
        const stack = [start]
        labeled[start] = label

        while (stack.length) {
          const idx = stack.pop()
          const px = idx % w, py = (idx / w) | 0
          // 4-conectividad
          if (px > 0)     check(idx - 1)
          if (px < w - 1) check(idx + 1)
          if (py > 0)     check(idx - w)
          if (py < h - 1) check(idx + w)
        }

        function check(ni) {
          if (labeled[ni] >= 0 || data[ni * 4 + 3] < ALPHA_THRESH) return
          labeled[ni] = label
          stack.push(ni)
        }
      }

      if (nextLabel === 0) { resolve([]); return }

      // Contar pixels y bounding box por label
      const counts = new Int32Array(nextLabel)
      const x1s = new Int32Array(nextLabel).fill(w)
      const y1s = new Int32Array(nextLabel).fill(h)
      const x2s = new Int32Array(nextLabel)
      const y2s = new Int32Array(nextLabel)

      for (let i = 0; i < w * h; i++) {
        const label = labeled[i]
        if (label < 0) continue
        counts[label]++
        const px = i % w, py = (i / w) | 0
        if (px < x1s[label]) x1s[label] = px
        if (px > x2s[label]) x2s[label] = px
        if (py < y1s[label]) y1s[label] = py
        if (py > y2s[label]) y2s[label] = py
      }

      const total = w * h
      const blobs = []
      for (let l = 0; l < nextLabel; l++) {
        if (counts[l] / total < MIN_BLOB_FRAC) continue
        blobs.push({
          id:     l,
          // Coordenadas en pixels originales
          x1: Math.round(x1s[l] / scale),
          y1: Math.round(y1s[l] / scale),
          x2: Math.round(x2s[l] / scale),
          y2: Math.round(y2s[l] / scale),
          pixelCount: counts[l],
          // Necesarios para aplicar la máscara después
          labeled,
          labelW: w,
          labelH: h,
          scale,
          origW,
          origH,
        })
      }

      // Ordenar por tamaño desc
      blobs.sort((a, b) => b.pixelCount - a.pixelCount)

      // Solo informamos si hay más de 1 blob significativo
      resolve(blobs.length > 1 ? blobs : [])
    }
    img.onerror = () => resolve([])
    img.src = `data:image/png;base64,${base64}`
  })
}

/**
 * Aplica una máscara sobre el cutout: conserva solo el blob indicado,
 * el resto queda transparente. Retorna el nuevo PNG en base64.
 *
 * @param {string} cutoutB64  PNG original con todos los blobs
 * @param {object} blob       objeto blob del array detectBlobs()
 * @returns {Promise<string>} nuevo cutoutB64
 */
export function keepOnlyBlob(cutoutB64, blob) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const { origW, origH, labeled, labelW, labelH, id: keepId } = blob

      const cv = document.createElement('canvas')
      cv.width = origW; cv.height = origH
      const ctx = cv.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, origW, origH)
      const { data } = imageData

      for (let y = 0; y < origH; y++) {
        for (let x = 0; x < origW; x++) {
          // Pixel en el mapa de labels (escala reducida)
          const lx = Math.min(labelW - 1, Math.round(x * labelW / origW))
          const ly = Math.min(labelH - 1, Math.round(y * labelH / origH))
          const label = labeled[ly * labelW + lx]
          if (label !== keepId) {
            data[(y * origW + x) * 4 + 3] = 0  // transparente
          }
        }
      }

      ctx.putImageData(imageData, 0, 0)
      const b64 = cv.toDataURL('image/png').split(',')[1]
      resolve(b64)
    }
    img.src = `data:image/png;base64,${cutoutB64}`
  })
}
