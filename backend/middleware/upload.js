const multer = require('multer')

const storage = multer.memoryStorage()

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}`), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
})

module.exports = upload
