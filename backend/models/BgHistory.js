const mongoose = require('mongoose')

const bgHistorySchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true },
  name:     { type: String, default: 'fondo.jpg' },
  date:     { type: Date,   default: Date.now },
  dataUrl:  { type: String, required: true },  // data:image/...;base64,...
})

bgHistorySchema.index({ clientId: 1, date: -1 })

module.exports = mongoose.model('BgHistory', bgHistorySchema)
