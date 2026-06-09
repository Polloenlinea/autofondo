const mongoose = require('mongoose')

const wmHistorySchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true },
  name:     { type: String, default: 'logo.png' },
  date:     { type: Date,   default: Date.now },
  dataUrl:  { type: String, required: true },  // data:image/...;base64,...
})

wmHistorySchema.index({ clientId: 1, date: -1 })

module.exports = mongoose.model('WmHistory', wmHistorySchema)
