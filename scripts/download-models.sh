#!/usr/bin/env bash
# Descarga los modelos BiRefNet (.onnx) necesarios para el recorte de alta calidad.
# Se ejecuta en el servidor durante el deploy (no se versionan en git por su tamaño).
#
# Uso:  bash scripts/download-models.sh            # baja solo el lite (recomendado)
#       bash scripts/download-models.sh --full     # baja lite + full
set -e

ML_DIR="$(cd "$(dirname "$0")/../backend/ml" && pwd)"
BASE="https://github.com/danielgatis/rembg/releases/download/v0.0.0"

download() {
  local name="$1" url="$2"
  if [ -f "$ML_DIR/$name" ]; then
    echo "✓ $name ya existe — omitido"
  else
    echo "↓ Descargando $name ..."
    curl -fSL "$url" -o "$ML_DIR/$name"
    echo "✓ $name listo ($(du -h "$ML_DIR/$name" | cut -f1))"
  fi
}

mkdir -p "$ML_DIR"

# Lite (214 MB) — recomendado para producción (rápido, calidad muy buena)
download "birefnet-lite.onnx" "$BASE/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx"

# Full (972 MB) — solo si se pasa --full (calidad máxima, más lento/RAM)
if [ "$1" = "--full" ]; then
  download "birefnet-full.onnx" "$BASE/BiRefNet-general-epoch_244.onnx"
fi

echo "Modelos en: $ML_DIR"
