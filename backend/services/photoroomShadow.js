const sharp  = require('sharp')
const crypto = require('crypto')

// Caché en memoria: la sombra se hornea sobre el auto transparente, así que
// cambiar fondo/posición/escala NO necesita re-llamar a Photoroom — reutilizamos
// el resultado del mismo recorte. Ahorra llamadas a la API (costo) y es instantáneo.
const cache    = new Map()
const CACHE_MAX = 60
const keyOf = (buf, tag) =>
  crypto.createHash('sha1').update(buf).update(tag).digest('hex')

/**
 * Sombra por IA (Photoroom Image Editing API).
 *
 * Recibe un recorte del auto (PNG RGBA sobre transparente) y devuelve el mismo
 * auto con una SOMBRA realista debajo, generada por IA (infiere la geometría 3D
 * del auto y proyecta la sombra siguiendo el ángulo/perspectiva), sobre fondo
 * TRANSPARENTE — así después la montamos sobre cualquiera de nuestros fondos.
 *
 * Reemplaza a la sombra hecha a mano (que fallaba en frente/espalda/3-4). Si no
 * hay API key o la llamada falla, devuelve null y el caller cae a la sombra vieja.
 *
 * También puede aplicar, en la MISMA llamada (sin costo extra), mejoras de IA:
 * upscale (más resolución) y relight (mejor iluminación).
 *
 * @param {Buffer} cutoutBuffer  recorte del auto (PNG transparente)
 * @param {{mode?: 'ai.soft'|'ai.hard'|'ai.floating', withShadow?: boolean, upscale?: boolean, relight?: boolean}} opts
 * @returns {Promise<Buffer|null>} PNG (auto editado sobre transparente) o null
 */
async function photoroomShadow(cutoutBuffer, { mode = 'ai.soft', withShadow = true, upscale = false, relight = false } = {}) {
  const key = process.env.PHOTOROOM_API_KEY
  if (!key) {
    console.warn('[photoroom] sin PHOTOROOM_API_KEY — se usa la sombra interna')
    return null
  }
  // Si no se pidió nada que requiera Photoroom, no llamamos.
  if (!withShadow && !upscale && !relight) return null

  // Caché por recorte + combinación de ediciones (sombra/upscale/relight)
  const tag = `${withShadow ? mode : 'none'}|u${upscale ? 1 : 0}|r${relight ? 1 : 0}`
  const ck = keyOf(cutoutBuffer, tag)
  if (cache.has(ck)) {
    const hit = cache.get(ck)
    cache.delete(ck); cache.set(ck, hit) // LRU: mover al final
    console.log(`[photoroom] edición ${tag} (caché)`)
    return hit
  }

  try {
    const send = (useUpscale) => {
      const form = new FormData()
      // El recorte ya viene transparente; lo mandamos como PNG.
      form.append('imageFile', new Blob([cutoutBuffer], { type: 'image/png' }), 'car.png')
      if (withShadow)           form.append('shadow.mode', mode)
      if (useUpscale && upscale) form.append('upscale.mode', 'ai.fast')
      if (relight)              form.append('lighting.mode', 'ai.auto')
      // Sin background.color → Photoroom devuelve el auto sobre TRANSPARENTE.
      // Margen para que la sombra (que cae por debajo/al costado) NO quede recortada
      // contra el borde del lienzo. Después recortamos el sobrante transparente.
      form.append('padding', '0.12')
      return fetch('https://image-api.photoroom.com/v2/edit', {
        method: 'POST',
        headers: { 'x-api-key': key, Accept: 'image/png' },
        body: form,
        signal: AbortSignal.timeout(60000),
      })
    }

    let resp = await send(true)
    // El upscale SOLO acepta imágenes chicas; si la foto ya es grande, Photoroom
    // devuelve 400. En ese caso reintentamos SIN upscale (la foto grande no lo
    // necesita) para no perder la sombra/relight de la misma llamada.
    if (!resp.ok && upscale) {
      console.warn('[photoroom] upscale no aplicable (imagen grande) → reintento sin upscale')
      resp = await send(false)
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error(`[photoroom] HTTP ${resp.status} ${txt.slice(0, 200)}`)
      return null
    }

    const raw = Buffer.from(await resp.arrayBuffer())
    // Validar que sea un PNG real
    const meta = await sharp(raw).metadata().catch(() => null)
    if (!meta || !meta.width) {
      console.error('[photoroom] respuesta no es una imagen válida')
      return null
    }
    // Recortamos SOLO el aire 100% transparente del borde, dejando INTACTO el
    // degradado suave de la sombra (su halo tenue es parte de lo que la hace
    // realista — NO se toca). El "rectángulo interno" no se arregla acá sino en
    // compose, que dimensiona por el auto opaco y deja que el halo se desborde
    // parejo por todo el lienzo.
    const buf = await sharp(raw)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
      .png().toBuffer()
      .catch(() => raw)
    console.log(`[photoroom] edición ${tag} OK — ${meta.width}x${meta.height}`)
    require('./usage').increment('shadow')   // contador local de uso (gasto real)

    // Guardar en caché (con tope LRU)
    cache.set(ck, buf)
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    return buf
  } catch (e) {
    console.error('[photoroom] error:', e.message)
    return null
  }
}

module.exports = { photoroomShadow }
