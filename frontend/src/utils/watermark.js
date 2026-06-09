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

      const mime   = imageMime === 'png' ? 'image/png' : 'image/jpeg'
      const quality = imageMime === 'png' ? undefined : 0.92
      resolve(canvas.toDataURL(mime, quality).split(',')[1])
    }
    img.onerror = reject
    img.src = `data:image/${imageMime};base64,${imageB64}`
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
