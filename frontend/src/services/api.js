const BASE = '/api/v1'

function b64ToBlob(b64, mime = 'image/png') {
  const bytes = atob(b64)
  const arr   = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export { b64ToBlob }

export async function detectType(file) {
  const form = new FormData()
  form.append('file', file)
  const res  = await fetch(`${BASE}/detect`, { method: 'POST', body: form })
  return res.json()
}

export async function removeBg(file) {
  const form = new FormData()
  form.append('file', file)
  const res  = await fetch(`${BASE}/remove-bg`, { method: 'POST', body: form })
  return res.json()
}

export async function adjustImage(cutoutB64, { brightness, contrast, rotation }) {
  const form = new FormData()
  form.append('file',       b64ToBlob(cutoutB64, 'image/png'), 'img.png')
  form.append('brightness', brightness)
  form.append('contrast',   contrast)
  form.append('rotation',   rotation)
  const res = await fetch(`${BASE}/adjust`, { method: 'POST', body: form })
  return res.json()
}

export async function composeImage({ cutoutB64, bgFile, preset, scale, posX, posY, shadow }) {
  const form = new FormData()
  form.append('car', b64ToBlob(cutoutB64, 'image/png'), 'car.png')
  if (bgFile)  form.append('background', bgFile)
  if (preset)  form.append('preset', preset)
  form.append('scale',  scale)
  form.append('pos_x',  posX)
  form.append('pos_y',  posY)
  form.append('shadow', shadow)
  const res = await fetch(`${BASE}/compose`, { method: 'POST', body: form })
  return res.json()
}
