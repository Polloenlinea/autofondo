/**
 * clientId.js
 * Identificador anónimo y persistente por dispositivo/navegador.
 * Se genera una sola vez y se guarda en localStorage.
 * Se envía en cada request a la API como header X-Client-ID.
 */

const STORAGE_KEY = 'af_cid'

export function getClientId() {
  let cid = localStorage.getItem(STORAGE_KEY)
  if (!cid) {
    cid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(STORAGE_KEY, cid)
  }
  return cid
}
