const sharp  = require('sharp')
const crypto = require('crypto')

// Sombra de piso con Bria (/v1/product/shadow). Equivalente a photoroomShadow:
// recibe el recorte del auto (PNG transparente) y devuelve el mismo auto con una
// sombra realista debajo, sobre fondo TRANSPARENTE, para montarlo sobre cualquier
// fondo. $0.08. Devuelve PNG (auto + sombra) o null si falla.

const cache    = new Map()
const CACHE_MAX = 60
const keyOf = (buf, tag) => crypto.createHash('sha1').update(buf).update(tag).digest('hex')

const ENDPOINT = 'https://engine.prod.bria-api.com/v1/product/shadow'

async function briaShadow(cutoutBuffer, { type = 'regular' } = {}) {
  const key = process.env.BRIA_API_TOKEN
  if (!key) { console.warn('[bria-shadow] sin BRIA_API_TOKEN'); return null }

  const ck = keyOf(cutoutBuffer, `shadow|${type}`)
  if (cache.has(ck)) {
    const hit = cache.get(ck); cache.delete(ck); cache.set(ck, hit)
    console.log('[bria-shadow] (caché)')
    return hit
  }

  try {
    const body = {
      file: cutoutBuffer.toString('base64'),
      type,                       // 'regular' = sombra de piso
      shadow_offset: [0, 40],     // SIN corrimiento horizontal → derecha abajo del auto
                                  // (apoyada en las ruedas, no diagonal tipo producto)
      sync: true,
    }
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'api_token': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error(`[bria-shadow] HTTP ${resp.status} ${txt.slice(0, 200)}`)
      return null
    }
    const j = await resp.json()
    const url = j.result_url || (Array.isArray(j.result) ? (Array.isArray(j.result[0]) ? j.result[0][0] : j.result[0]) : j.result) || j.url
    if (typeof url !== 'string') { console.error('[bria-shadow] sin URL:', JSON.stringify(j).slice(0, 200)); return null }

    const raw = Buffer.from(await (await fetch(url)).arrayBuffer())
    const png = await sharp(raw).png().toBuffer()   // normalizar a PNG transparente

    cache.set(ck, png)
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
    console.log('[bria-shadow] sombra OK')
    require('./usage').increment('shadow')
    return png
  } catch (e) {
    console.error('[bria-shadow] error:', e.message)
    return null
  }
}

module.exports = { briaShadow }
