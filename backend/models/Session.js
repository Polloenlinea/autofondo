const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
  fileName:    { type: String, default: 'imagen.jpg' },
  composedB64: { type: String, default: null },  // base64 JPEG con fondo
  cutoutB64:   { type: String, default: null },  // base64 PNG sin fondo
  isComposed:  { type: Boolean, default: false },
  // ── Estado de trabajo (para retomar un borrador) ──
  detectedType: { type: String, default: 'exterior' },   // exterior | interior
  typeOverride: { type: String, default: null },
  level:        { type: Boolean, default: true },
  offset:       { type: mongoose.Schema.Types.Mixed, default: null },  // {dx,dy}
  adjustments:  { type: mongoose.Schema.Types.Mixed, default: null },  // {brightness,contrast,rotation}
  bgSettings:   { type: mongoose.Schema.Types.Mixed, default: null },  // preset/scale/pos/sombra… (sin bgFile)
}, { _id: false })

const sessionSchema = new mongoose.Schema({
  clientId:  { type: String, required: true, index: true },
  name:      { type: String, default: 'Sesión sin nombre' },
  date:      { type: Date,   default: Date.now },
  count:     { type: Number, default: 0 },
  thumbnail: { type: String, default: null },   // base64 del primer auto
  images:    [imageSchema],
})

// Índice compuesto para queries por cliente + fecha
sessionSchema.index({ clientId: 1, date: -1 })

module.exports = mongoose.model('Session', sessionSchema)
