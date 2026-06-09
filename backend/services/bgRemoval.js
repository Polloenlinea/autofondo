const { removeBackground } = require('@imgly/background-removal-node')

// El modelo ONNX (126 MB) viene bundleado dentro de node_modules al hacer npm install.
// No se descarga de internet en runtime — se lee del disco local.
// La primera llamada a removeBackground() tarda ~10-30 s porque:
//   1. Lee los archivos del modelo desde node_modules
//   2. Inicializa la sesión ONNX Runtime en RAM (~500-800 MB)
// warmup() fuerza esta inicialización al arrancar el servidor para que
// el primer usuario no experimente la demora.

let _ready = false

/**
 * Pre-calienta el modelo IA al iniciar el servidor.
 * Procesa una imagen 1×1 para forzar la carga del modelo en memoria.
 * Se llama desde server.js en background (no bloquea el arranque).
 */
async function warmup() {
  if (_ready) return
  console.log('⏳ Cargando modelo de IA en memoria (puede tardar ~10-30 s)...')
  try {
    // PNG transparente de 1×1 píxel — mínimo suficiente para inicializar ONNX
    const minPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    await removeBackground(new Blob([minPng], { type: 'image/png' }), { model: 'small' })
    _ready = true
    console.log('✅ Modelo IA listo — primera imagen será inmediata')
  } catch (e) {
    console.warn('⚠️  Warmup del modelo falló — se inicializará en el primer uso:', e.message)
    // No seteamos _ready = true para que se reintente si es posible,
    // pero la app sigue funcionando (removeBg() inicializa por su cuenta)
  }
}

async function removeBg(buffer) {
  const sharp  = require('sharp')
  const blob   = new Blob([buffer], { type: 'image/png' })
  const result = await removeBackground(blob, {
    model:  'small',
    output: { format: 'image/png', quality: 0.92 },
  })
  const raw = Buffer.from(await result.arrayBuffer())

  // Recortar bordes transparentes para normalizar el "zoom visual" de todos los autos
  try {
    return await sharp(raw).trim({ threshold: 10 }).png().toBuffer()
  } catch {
    return raw  // fallback si trim falla (imagen completamente opaca)
  }
}

module.exports = { removeBg, warmup }
