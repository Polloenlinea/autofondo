/**
 * PM2 Ecosystem — AutoFondo
 * Uso: pm2 start ecosystem.config.js --env production
 */
module.exports = {
  apps: [
    {
      name:         'autofondo',
      script:       'backend/server.js',
      cwd:          __dirname,

      // Variables de entorno producción
      env_production: {
        NODE_ENV:        'production',
        PORT:            3001,         // Puerto interno (Nginx hace proxy a este)
        ALLOWED_ORIGIN:  'https://autofondo.artificialmente.com',
        // ⚠️  Reemplazá esto con tu URI real (local o Atlas)
        MONGODB_URI:     'mongodb://127.0.0.1:27017/autofondo',
        // Modelo IA: 'small' (rápido), 'medium' (balance), 'large' (lento/mejor calidad)
        IMGLY_MODEL:     'medium',
      },

      // Variables de entorno desarrollo local
      env_development: {
        NODE_ENV:    'development',
        PORT:        8001,
        MONGODB_URI: 'mongodb://127.0.0.1:27017/autofondo',
        IMGLY_MODEL: 'small',
      },

      // Configuración del proceso
      instances:     1,
      exec_mode:     'fork',
      watch:         false,
      max_memory_restart: '1G',

      // Logs
      out_file:   './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
}
