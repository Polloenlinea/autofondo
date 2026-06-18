const mongoose = require('mongoose')

const accessCodeSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true, uppercase: true, trim: true },
  label:     { type: String, default: '' },
  active:    { type: Boolean, default: true },
  uses:      { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('AccessCode', accessCodeSchema)
