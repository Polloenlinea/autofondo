const fs   = require('fs')
const path = require('path')

// Contador local de llamadas a Photoroom (las que SÍ gastan crédito). Se guarda en
// un archivo JSON para que sobreviva reinicios del backend. Es una ESTIMACIÓN propia
// para no depender del panel de Photoroom — cuenta cada generación real (no las que
// salen de caché). 'shadow' = sombra IA, 'scene' = fondo IA.
const FILE = path.join(__dirname, '..', '.photoroom-usage.json')

let data = { shadow: 0, scene: 0, total: 0, since: new Date().toISOString(), last: null }
try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  data = { ...data, ...saved }
} catch { /* primera vez: arranca en 0 */ }

function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)) } catch (e) { console.warn('[usage] no se pudo guardar:', e.message) }
}

// Registra una generación real de Photoroom. type: 'shadow' | 'scene'
function increment(type) {
  if (type === 'shadow') data.shadow++
  else if (type === 'scene') data.scene++
  data.total++
  data.last = new Date().toISOString()
  save()
  console.log(`[usage] +1 ${type} → total ${data.total} (sombra ${data.shadow}, escena ${data.scene})`)
}

function get() { return { ...data } }

// Reinicia el contador (para empezar a medir desde un punto)
function reset() {
  data = { shadow: 0, scene: 0, total: 0, since: new Date().toISOString(), last: null }
  save()
}

module.exports = { increment, get, reset }
