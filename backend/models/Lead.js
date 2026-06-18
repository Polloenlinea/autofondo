const mongoose = require('mongoose')

const leadSchema = new mongoose.Schema({
  nombre:  { type: String, required: true, trim: true },
  empresa: { type: String, required: true, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  tel:     { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
  source:  { type: String, default: 'landing' },
})

module.exports = mongoose.model('Lead', leadSchema)
