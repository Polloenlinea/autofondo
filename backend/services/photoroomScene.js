const sharp  = require('sharp')
const crypto = require('crypto')

// Caché en memoria por (recorte + prompt): generar una escena consume cupo de
// Photoroom, así que si se vuelve a pedir la MISMA escena para el MISMO recorte,
// reutilizamos el resultado en vez de re-generar (ahorra créditos y es instantáneo).
const cache    = new Map()
const CACHE_MAX = 80
const keyOf = (buf, tag) =>
  crypto.createHash('sha1').update(buf).update(tag).digest('hex')

/**
 * Fondo generado por IA (Photoroom AI Backgrounds).
 *
 * Recibe el recorte del auto (PNG transparente) + un texto de escena y devuelve
 * el auto integrado en esa escena generada (con iluminación, sombra y —si el piso
 * es brillante— reflejo incluidos). Devuelve un JPEG listo para mostrar.
 *
 * Para mantener CONSISTENCIA entre las fotos del mismo auto: se pasa el mismo
 * `seed` a todas, y la 1ª escena generada como `guidanceBuffer` (imagen de
 * referencia) para las demás → mismo showroom/piso/elementos, cada una en su ángulo.
 *
 * @param {Buffer} cutoutBuffer  recorte del auto (PNG transparente)
 * @param {string} prompt        descripción de la escena
 * @param {{upscale?:boolean, relight?:boolean, seed?:string|number|null, guidanceBuffer?:Buffer|null}} opts
 * @returns {Promise<Buffer|null>} JPEG de la escena o null si falla
 */
async function photoroomScene(cutoutBuffer, prompt, { upscale = false, relight = false, seed = null, guidanceBuffer = null } = {}) {
  const key = process.env.PHOTOROOM_API_KEY
  if (!key) {
    console.warn('[photoroom-scene] sin PHOTOROOM_API_KEY')
    return null
  }
  const clean = (prompt || '').trim()
  if (!clean) return null

  const gTag = guidanceBuffer ? crypto.createHash('sha1').update(guidanceBuffer).digest('hex').slice(0, 12) : 'x'
  const ck = keyOf(cutoutBuffer, `${clean}|u${upscale ? 1 : 0}|r${relight ? 1 : 0}|s${seed ?? 'x'}|g${gTag}`)
  if (cache.has(ck)) {
    const hit = cache.get(ck)
    cache.delete(ck); cache.set(ck, hit)
    console.log('[photoroom-scene] (caché)')
    return hit
  }

  try {
    // ── PRE-ARMADO idéntico al fondo común ──────────────────────────────────────
    // Colocamos el auto en un lienzo 1920×1080 con la MISMA cuenta que composition
    // .compose() (escala el recorte completo al `SCALE`% del ancho, posición 50/60).
    // Luego (abajo) mandamos referenceBox=originalImage para que Photoroom RESPETE
    // esta posición/tamaño y solo PINTE el fondo alrededor. Así el resultado IA
    // queda idéntico en lienzo, tamaño y posición a un fondo común.
    const CW = 1920, CH = 1080, SCALE = 80, POSX = 50, POSY = 60
    let carBuf = cutoutBuffer
    try {
      const fm = await sharp(cutoutBuffer).metadata()
      let nw = Math.max(1, Math.round(CW * SCALE / 100))
      let nh = Math.max(1, Math.round(fm.height * nw / fm.width))
      if (nh > CH) { nh = CH; nw = Math.max(1, Math.round(fm.width * nh / fm.height)) }
      if (nw > CW) { nw = CW; nh = Math.max(1, Math.round(fm.height * nw / fm.width)) }
      const x = Math.max(0, Math.min(Math.round((CW - nw) * POSX / 100), CW - nw))
      const y = Math.max(0, Math.min(Math.round((CH - nh) * POSY / 100), CH - nh))
      const carResized = await sharp(cutoutBuffer).resize(nw, nh).png().toBuffer()
      carBuf = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: carResized, left: x, top: y }])
        .png().toBuffer()
      console.log(`[photoroom-scene] pre-armado: marco ${fm.width}x${fm.height} → auto ${nw}x${nh} en (${x},${y}) sobre ${CW}x${CH}`)
    } catch (e) {
      console.warn('[photoroom-scene] pre-armado falló, mando el recorte tal cual:', e.message)
    }

    const send = (useUpscale) => {
      const form = new FormData()
      form.append('imageFile', new Blob([carBuf], { type: 'image/png' }), 'car.png')
      form.append('background.prompt', clean)
      form.append('shadow.mode', 'ai.soft')   // sombra apoyada dentro de la escena
      if (useUpscale && upscale) form.append('upscale.mode', 'ai.fast')
      // Relight SIEMPRE en escenas: integra la luz del auto con el fondo generado →
      // más realista (que el auto "pertenezca" a la escena). Es parte de la misma
      // llamada, sin costo extra.
      form.append('lighting.mode', 'ai.auto')
      // Consistencia entre fotos del mismo auto
      if (seed != null && seed !== '') form.append('background.seed', String(seed))
      if (guidanceBuffer) {
        form.append('background.guidance.imageFile', new Blob([guidanceBuffer], { type: 'image/png' }), 'guide.png')
        form.append('background.guidance.scale', '0.7')
      }
      // CLAVE (doc Photoroom): referenceBox=originalImage hace que Photoroom mantenga
      // el sujeto EXACTAMENTE donde lo pusimos en el lienzo 1920×1080, sin recentrar
      // ni recortar. outputSize=originalImage conserva ese lienzo. padding/margin 0
      // para que no reacomode nada. Resultado: mismo encuadre que el fondo común.
      form.append('referenceBox', 'originalImage')
      form.append('outputSize', 'originalImage')
      form.append('padding', '0')
      form.append('margin', '0')
      return fetch('https://image-api.photoroom.com/v2/edit', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          Accept: 'image/png',
          // Modelo de fondo IA más nuevo (más realista que el v3 default).
          'pr-ai-background-model-version': 'background-studio-beta-2025-03-17',
        },
        body: form,
        signal: AbortSignal.timeout(90000),
      })
    }

    let resp = await send(true)
    // Upscale solo acepta imágenes chicas → si falla por tamaño, reintento sin upscale.
    if (!resp.ok && upscale) {
      console.warn('[photoroom-scene] upscale no aplicable → reintento sin upscale')
      resp = await send(false)
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error(`[photoroom-scene] HTTP ${resp.status} ${txt.slice(0, 200)}`)
      return null
    }

    const raw = Buffer.from(await resp.arrayBuffer())
    const rawMeta = await sharp(raw).metadata().catch(() => ({}))
    console.log(`[photoroom-scene] salida de Photoroom: ${rawMeta.width}x${rawMeta.height}`)
    // Normalizamos a JPEG (consistente con el resto de las composiciones)
    const jpeg = await sharp(raw).jpeg({ quality: 92 }).toBuffer()

    cache.set(ck, jpeg)
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    console.log(`[photoroom-scene] escena generada OK — "${clean.slice(0, 40)}"`)
    require('./usage').increment('scene')   // contador local de uso (gasto real)
    return jpeg
  } catch (e) {
    console.error('[photoroom-scene] error:', e.message)
    return null
  }
}

module.exports = { photoroomScene }
