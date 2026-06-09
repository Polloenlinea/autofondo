#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AutoFondo — Script de deploy (correr en el servidor)
# Uso: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo ""
echo "🚀  AutoFondo — Deploy"
echo "─────────────────────────────────────────────────────────────────────────"

# 1. Instalar dependencias del backend
echo "📦  Instalando dependencias del backend..."
cd backend
npm install --omit=dev
cd ..

# 2. Instalar dependencias del frontend y compilar
echo "⚙️   Compilando frontend..."
cd frontend
npm install
npm run build
cd ..

# 3. Crear directorio de logs si no existe
mkdir -p logs

# 4. Recargar o iniciar con PM2
if pm2 list | grep -q "autofondo"; then
  echo "♻️   Recargando proceso PM2 existente..."
  pm2 reload ecosystem.config.js --env production
else
  echo "▶️   Iniciando proceso PM2 nuevo..."
  pm2 start ecosystem.config.js --env production
fi

# 5. Guardar configuración de PM2 para que persista tras reboot
pm2 save

echo ""
echo "✅  Deploy completado!"
echo "   App corriendo en → http://localhost:3001"
echo ""
