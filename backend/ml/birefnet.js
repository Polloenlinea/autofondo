const ort = require('onnxruntime-node')
const sharp = require('sharp')
const path = require('path')

const INPUT_SIZE = 1024 // BiRefNet trabaja a 1024×1024

// Normalización ImageNet (la que espera BiRefNet)
const MEAN = [0.485, 0.456, 0.406]
const STD  = [0.229, 0.224, 0.225]

const MODEL_PATHS = {
  lite: path.join(__dirname, 'birefnet-lite.onnx'),
  full: path.join(__dirname, 'birefnet-full.onnx'),
}

const _sessions = {}
async function getSession(variant = 'lite') {
  const key = MODEL_PATHS[variant] ? variant : 'lite'
  if (_sessions[key]) return _sessions[key]
  _sessions[key] = await ort.InferenceSession.create(MODEL_PATHS[key], {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  })
  return _sessions[key]
}

/**
 * Quita el fondo de una imagen usando BiRefNet.
 * @param {Buffer} inputBuffer imagen original (cualquier formato)
 * @param {'lite'|'full'} variant cuál modelo usar
 * @returns {Buffer} PNG RGBA recortado, al tamaño original
 */
async function removeBgBiRefNet(inputBuffer, variant = 'lite') {
  const session = await getSession(variant)

  const meta = await sharp(inputBuffer).metadata()
  const origW = meta.width, origH = meta.height

  // ── Preprocesado: resize a 1024×1024 + normalización ImageNet, layout CHW ──
  const { data: rgb } = await sharp(inputBuffer)
    .removeAlpha()
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const chw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  const plane = INPUT_SIZE * INPUT_SIZE
  for (let i = 0; i < plane; i++) {
    chw[i]             = (rgb[i * 3]     / 255 - MEAN[0]) / STD[0] // R
    chw[plane + i]     = (rgb[i * 3 + 1] / 255 - MEAN[1]) / STD[1] // G
    chw[2 * plane + i] = (rgb[i * 3 + 2] / 255 - MEAN[2]) / STD[2] // B
  }

  const inputName = session.inputNames[0]
  const tensor = new ort.Tensor('float32', chw, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const out = await session.run({ [inputName]: tensor })

  // BiRefNet puede devolver varias salidas; la máscara final es la última
  const outName = session.outputNames[session.outputNames.length - 1]
  const maskData = out[outName].data

  // ── Postprocesado: sigmoid → máscara 0-255, resize al tamaño original ──
  const maskU8 = new Uint8Array(plane)
  for (let i = 0; i < plane; i++) {
    const s = 1 / (1 + Math.exp(-maskData[i])) // sigmoid
    maskU8[i] = Math.round(s * 255)
  }

  const { data: maskFull, info: maskInfo } = await sharp(Buffer.from(maskU8), { raw: { width: INPUT_SIZE, height: INPUT_SIZE, channels: 1 } })
    .resize(origW, origH, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const mStride = maskInfo.channels // sharp puede promover gris a 3 canales en el resize

  // Armar RGBA manualmente: RGB original + máscara como alpha (control total,
  // evita ambigüedades de joinChannel con buffers raw).
  const rgbFull = await sharp(inputBuffer).removeAlpha().raw().toBuffer()
  const px = origW * origH
  const rgba = Buffer.alloc(px * 4)
  for (let i = 0; i < px; i++) {
    rgba[i * 4]     = rgbFull[i * 3]
    rgba[i * 4 + 1] = rgbFull[i * 3 + 1]
    rgba[i * 4 + 2] = rgbFull[i * 3 + 2]
    rgba[i * 4 + 3] = maskFull[i * mStride]
  }

  const cutout = await sharp(rgba, { raw: { width: origW, height: origH, channels: 4 } })
    .png()
    .toBuffer()

  return cutout
}

module.exports = { removeBgBiRefNet }
