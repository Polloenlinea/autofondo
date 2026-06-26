import { getClientId } from '../utils/clientId'

const BASE = '/api/v1'

// ── Helper base: agrega X-Client-ID a todos los requests ─────────────────────
function apiFetch(url, options = {}) {
  const headers = {
    'X-Client-ID': getClientId(),
    ...(options.headers || {}),
  }
  return fetch(url, { ...options, headers })
}

function b64ToBlob(b64, mime = 'image/png') {
  const bytes = atob(b64)
  const arr   = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export { b64ToBlob }

// ── Imagen ────────────────────────────────────────────────────────────────────

export async function detectType(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(`${BASE}/detect`, { method: 'POST', body: form })
  return res.json()
}

// options: { hidePlate, plateLogoFile, model, engine: 'imgly'|'birefnet-lite'|'birefnet-full' }
export async function removeBg(file, options = {}) {
  const form = new FormData()
  form.append('file', file)
  if (options.hidePlate) {
    form.append('hidePlate', 'true')
    if (options.plateLogoFile) form.append('plateLogo', options.plateLogoFile)
  }
  if (options.model)  form.append('model', options.model)
  if (options.engine) form.append('engine', options.engine)
  const res = await apiFetch(`${BASE}/remove-bg`, { method: 'POST', body: form })
  return res.json()
}

export async function adjustImage(cutoutB64, { brightness, contrast, rotation }) {
  const form = new FormData()
  form.append('file',       b64ToBlob(cutoutB64, 'image/png'), 'img.png')
  form.append('brightness', brightness)
  form.append('contrast',   contrast)
  form.append('rotation',   rotation)
  const res = await apiFetch(`${BASE}/adjust`, { method: 'POST', body: form })
  return res.json()
}

export async function composeImage({ cutoutB64, bgFile, preset, bgPrompt, seed, guidanceB64, scale, posX, posY, shadow, aiShadow, reflection, shadowIntensity, reflectionIntensity, upscale, relight }) {
  const form = new FormData()
  form.append('car', b64ToBlob(cutoutB64, 'image/png'), 'car.png')
  if (upscale) form.append('upscale', 'true')
  if (relight) form.append('relight', 'true')
  // Fondo generado por IA: Photoroom arma toda la escena (auto + luz + sombra + reflejo)
  if (bgPrompt) {
    form.append('bg_prompt', bgPrompt)
    // Consistencia entre fotos del mismo auto: mismo seed + 1ª escena como referencia
    if (seed != null && seed !== '') form.append('seed', String(seed))
    if (guidanceB64) form.append('guidance', b64ToBlob(guidanceB64, 'image/jpeg'), 'guide.jpg')
    const res = await apiFetch(`${BASE}/compose`, { method: 'POST', body: form })
    return res.json()
  }
  if (bgFile)  form.append('background', bgFile)
  if (preset)  form.append('preset', preset)
  form.append('scale',  scale)
  form.append('pos_x',  posX)
  form.append('pos_y',  posY)
  form.append('shadow', shadow)
  form.append('ai_shadow', !!aiShadow)   // sombra PAGA por IA (solo al aplicar final)
  form.append('reflection', !!reflection)
  form.append('shadow_intensity',     shadowIntensity     ?? 100)
  form.append('reflection_intensity', reflectionIntensity ?? 100)
  const res = await apiFetch(`${BASE}/compose`, { method: 'POST', body: form })
  return res.json()
}

// ── Sesiones ──────────────────────────────────────────────────────────────────

export async function getSessions() {
  const res = await apiFetch(`${BASE}/sessions`)
  return res.json()
}

export async function getSession(id) {
  const res = await apiFetch(`${BASE}/sessions/${id}`)
  return res.json()
}

export async function saveSession(name, images) {
  const res = await apiFetch(`${BASE}/sessions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, images }),
  })
  return res.json()
}

export async function deleteSession(id) {
  const res = await apiFetch(`${BASE}/sessions/${id}`, { method: 'DELETE' })
  return res.json()
}

// ── Historial de fondos ───────────────────────────────────────────────────────

export async function getBgHistory() {
  const res = await apiFetch(`${BASE}/bg-history`)
  return res.json()
}

export async function addBgHistory(name, dataUrl) {
  const res = await apiFetch(`${BASE}/bg-history`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, dataUrl }),
  })
  return res.json()
}

// ── Historial de logos (marca de agua) ───────────────────────────────────────

export async function getWmHistory() {
  const res = await apiFetch(`${BASE}/wm-history`)
  return res.json()
}

export async function addWmHistory(name, dataUrl) {
  const res = await apiFetch(`${BASE}/wm-history`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, dataUrl }),
  })
  return res.json()
}

export async function deleteBgHistory(id) {
  const res = await apiFetch(`${BASE}/bg-history/${id}`, { method: 'DELETE' })
  return res.json()
}

export async function deleteWmHistory(id) {
  const res = await apiFetch(`${BASE}/wm-history/${id}`, { method: 'DELETE' })
  return res.json()
}
