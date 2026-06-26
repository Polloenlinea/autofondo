/**
 * Aplica una marca de agua sobre un base64 de imagen usando Canvas.
 * Devuelve nuevo base64 (jpeg o png según la entrada).
 *
 * @param {string}     imageB64   - imagen base64 (jpeg o png)
 * @param {string}     imageMime  - 'jpeg' | 'png'
 * @param {HTMLImageElement} wmImg - elemento Image con el logo ya cargado
 * @param {{ position, sizePercent, opacity }} opts
 */
export function applyWatermarkToB64(imageB64, imageMime, wmImg, opts) {
  const { position = 'bottom-right', sizePercent = 15, opacity = 0.7 } = opts
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      // Tamaño de la marca de agua — % del ancho de la imagen
      const wmW = Math.round(img.width * sizePercent / 100)
      const wmH = Math.round(wmW * (wmImg.naturalHeight / wmImg.naturalWidth))
      const margin = Math.round(img.width * 0.025)

      if (position === 'tile') {
        // MOSAICO: logo repetido en diagonal cubriendo TODA la foto (anti-robo).
        // No se puede recortar y marca claramente la plataforma. Ideal para demos.
        ctx.globalAlpha = opacity
        ctx.save()
        // Rotar el lienzo ~30° alrededor del centro para el patrón en diagonal
        ctx.translate(img.width / 2, img.height / 2)
        ctx.rotate(-30 * Math.PI / 180)
        ctx.translate(-img.width / 2, -img.height / 2)
        const gapX = wmW * 1.8         // separación horizontal entre logos
        const gapY = wmH * 3.2         // separación vertical entre filas
        const diag = Math.sqrt(img.width ** 2 + img.height ** 2)
        let rowIdx = 0
        for (let yy = -diag; yy < img.height + diag; yy += gapY) {
          // desfasar filas alternas para que no quede una grilla rígida
          const offsetX = (rowIdx % 2) * (gapX / 2)
          for (let xx = -diag; xx < img.width + diag; xx += gapX) {
            ctx.drawImage(wmImg, xx + offsetX, yy, wmW, wmH)
          }
          rowIdx++
        }
        ctx.restore()
        ctx.globalAlpha = 1.0
      } else {
        const positions = {
          'top-left':      { x: margin,               y: margin },
          'top-right':     { x: img.width - wmW - margin,   y: margin },
          'bottom-left':   { x: margin,               y: img.height - wmH - margin },
          'bottom-right':  { x: img.width - wmW - margin,   y: img.height - wmH - margin },
          'center':        { x: (img.width - wmW) / 2,  y: (img.height - wmH) / 2 },
        }
        const { x, y } = positions[position] ?? positions['bottom-right']

        ctx.globalAlpha = opacity
        ctx.drawImage(wmImg, x, y, wmW, wmH)
        ctx.globalAlpha = 1.0
      }

      const mime   = imageMime === 'png' ? 'image/png' : 'image/jpeg'
      const quality = imageMime === 'png' ? undefined : 0.92
      resolve(canvas.toDataURL(mime, quality).split(',')[1])
    }
    img.onerror = reject
    img.src = `data:image/${imageMime};base64,${imageB64}`
  })
}

/**
 * Calcula el brillo promedio (0–255) de una imagen base64, mirando sobre todo
 * las ZONAS donde irá la marca de agua. Para el mosaico mira toda la imagen.
 * Se usa para elegir automáticamente el logo oscuro (sobre fondos claros) o el
 * claro (sobre fondos oscuros).
 */
export function averageBrightnessB64(imageB64, mime = 'jpeg') {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = 80
      const h = Math.max(1, Math.round(w * img.height / img.width))
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h).data
      let sum = 0, n = 0
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        n++
      }
      resolve(n ? sum / n : 255)
    }
    img.onerror = () => resolve(255)
    img.src = `data:image/${mime};base64,${imageB64}`
  })
}

/**
 * Carga un File como HTMLImageElement (espera onload)
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = reject
    img.src = url
  })
}
