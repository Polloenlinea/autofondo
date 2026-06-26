const sharp  = require('sharp')
const crypto = require('crypto')

// Fondo generado por IA con Bria (lifestyle_shot_by_text). Equivalente a
// photoroomScene pero más realista y más barato ($0.08). Devuelve un JPEG 1920×1080.
//
// Estrategia de encuadre (igual que con Photoroom): pre-armamos el auto en un lienzo
// 1920×1080 con la misma geometría que el fondo común y le pedimos a Bria que
// CONSERVE la posición del sujeto (placement_type='original') → escena alrededor,
// auto en su lugar. Así el fondo IA queda consistente con el común.

const cache    = new Map()
const CACHE_MAX = 80
const keyOf = (buf, tag) => crypto.createHash('sha1').update(buf).update(tag).digest('hex')

const ENDPOINT = 'https://engine.prod.bria-api.com/v1/product/lifestyle_shot_by_text'

async function briaScene(cutoutBuffer, prompt, { seed = null } = {}) {
  const key = process.env.BRIA_API_TOKEN
  if (!key) { console.warn('[bria-scene] sin BRIA_API_TOKEN'); return null }
  const clean = (prompt || '').trim()
  if (!clean) return null

  const ck = keyOf(cutoutBuffer, `${clean}|s${seed ?? 'x'}`)
  if (cache.has(ck)) {
    const hit = cache.get(ck); cache.delete(ck); cache.set(ck, hit)
    console.log('[bria-scene] (caché)')
    return hit
  }

  try {
    // ── Pre-armado 1920×1080 (misma cuenta que composition.compose) ──
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
        .composite([{ input: carResized, left: x, top: y }]).png().toBuffer()
      console.log(`[bria-scene] pre-armado auto ${nw}x${nh} en (${x},${y}) sobre ${CW}x${CH}`)
    } catch (e) { console.warn('[bria-scene] pre-armado falló:', e.message) }

    const body = {
      file: carBuf.toString('base64'),
      scene_description: clean,
      placement_type: 'original',     // conservar la posición del sujeto (nuestro encuadre)
      shot_size: [CW, CH],            // salida 1920×1080
      sync: true,
      num_results: 1,
      optimize_description: true,
      fast: false,
    }
    if (seed != null && seed !== '') body.seed = Number(seed) || undefined

    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'api_token': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error(`[bria-scene] HTTP ${resp.status} ${txt.slice(0, 200)}`)
      return null
    }
    const j = await resp.json()
    // formato: { result: [ [url, seed, filename] ] }
    let url = null
    const R = j.result || j.urls
    if (Array.isArray(R)) {
      const first = R[0]
      url = typeof first === 'string' ? first : Array.isArray(first) ? first[0] : (first?.urls?.[0] || first?.url)
    }
    if (!url) { console.error('[bria-scene] sin URL en respuesta:', JSON.stringify(j).slice(0, 200)); return null }

    const raw = Buffer.from(await (await fetch(url)).arrayBuffer())
    // Bria devuelve 16:9 pero a veces a menor resolución (ej 1365×768). Normalizamos a
    // 1920×1080 para que TODOS los fondos (común e IA) queden del mismo tamaño.
    const jpeg = await sharp(raw).resize(CW, CH, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer()

    cache.set(ck, jpeg)
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    console.log(`[bria-scene] escena generada OK — "${clean.slice(0, 40)}"`)
    require('./usage').increment('scene')
    return jpeg
  } catch (e) {
    console.error('[bria-scene] error:', e.message)
    return null
  }
}

module.exports = { briaScene }
