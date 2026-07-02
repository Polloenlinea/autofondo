# Guía de deploy — AutoFondo

## Requisitos del servidor
- Node.js 20.6 o superior
- MongoDB (local o Atlas)
- Al menos 1 GB de RAM libre (para el modelo de recorte de autos)

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/Polloenlinea/autofondo.git
cd autofondo
```

---

## 2. Instalar dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## 3. Descargar el modelo de IA de recorte

El modelo pesa ~214 MB y no está en el repositorio. Hay que bajarlo una sola vez:

```bash
bash scripts/download-models.sh
```

Esto descarga el archivo a `backend/ml/birefnet-lite.onnx`.

---

## 4. Crear el archivo de variables de entorno

Crear el archivo `backend/.env` con el siguiente contenido (completar con los valores reales):

```
PORT=8001
NODE_ENV=production

# Clave de Photoroom (fondos IA y sombra IA)
PHOTOROOM_API_KEY=tu_clave_aqui

# Motor de IA activo
AI_ENGINE=photoroom

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/autofondo

# Código de acceso a la herramienta
ACCESS_CODE=AUTO24

# Dominio permitido (el dominio final del sitio)
ALLOWED_ORIGIN=https://autofondo.tudominio.com
```

> Este archivo NUNCA se sube a git. Contiene las claves de API. Hay que crearlo a mano en el servidor.

---

## 5. Compilar el frontend

```bash
cd frontend && npm run build
```

Genera la carpeta `frontend/dist/` que el backend sirve en producción.

---

## 6. Arrancar el backend

Recomendado con PM2 para que no se caiga:

```bash
npm install -g pm2
pm2 start backend/server.js --name autofondo
pm2 save
pm2 startup
```

---

## 7. Nginx (si aplica)

```nginx
location / {
    proxy_pass http://localhost:8001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    client_max_body_size 50M;
}
```

---

## Código de acceso

La herramienta está cerrada. Solo entra quien tiene el código.

- El código se define en `ACCESS_CODE` del `.env`
- Para cambiarlo: editar ese valor y reiniciar el backend
- Los usuarios entran escribiendo el código en el sitio, o con un link directo: `https://tudominio.com/p/AUTO24`

---

## Notas

- El recorte de autos funciona sin internet (modelo local, gratis).
- Los fondos con IA y la sombra con IA consumen créditos de Photoroom.
- MongoDB se usa para sesiones e historial. Si no está disponible, el recorte y los fondos comunes igual funcionan.
- Se necesita al menos 1 GB de RAM libre para el modelo de recorte.
