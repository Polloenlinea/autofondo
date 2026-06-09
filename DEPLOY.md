# AutoFondo — Guía de Despliegue en Producción

**Subdominio objetivo:** `autofondo.artificialmente.com`  
**Stack:** Node.js + Express (backend) + React/Vite (frontend estático servido por el mismo proceso)  
**Gestor de procesos:** PM2  
**Proxy inverso:** Nginx  
**SSL:** Let's Encrypt (Certbot)

---

## Requisitos del servidor

| Componente | Versión mínima | Notas |
|---|---|---|
| Node.js | **v20 LTS** | Requerido por el modelo de IA (@imgly) |
| npm | v10+ | Viene con Node 20 |
| PM2 | v5+ | `npm install -g pm2` |
| MongoDB | **v6+** | Local o Atlas — ver Paso 3 |
| Nginx | cualquier | En el servidor ya debería estar instalado |
| Certbot | cualquier | Para SSL automático |
| RAM | **2 GB mínimo** | El modelo de IA usa ~800 MB al cargar |
| Disco | **3 GB mínimo** | `node_modules` (~1.5 GB) + caché IA (~200 MB) |

---

## Paso 1 — Preparar el servidor

```bash
# Verificar Node.js (debe ser v20+)
node --version

# Si es anterior, instalar Node 20 con nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Instalar PM2 globalmente (si no está)
npm install -g pm2

# Verificar Nginx
nginx -v
```

---

## Paso 2 — Clonar el repositorio

```bash
# En el servidor, ir al directorio de apps
cd /var/www   # o el directorio que usen en Artificialmente

# Clonar
git clone https://github.com/Polloenlinea/autofondo.git
cd autofondo
```

---

## Paso 3 — Instalar y configurar MongoDB

AutoFondo usa MongoDB para persistir sesiones, historial de fondos y logos por usuario.

### Opción A — MongoDB local en el mismo servidor (más simple)

```bash
# Ubuntu/Debian — instalar MongoDB Community 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Iniciar y habilitar el servicio
sudo systemctl start mongod
sudo systemctl enable mongod

# Verificar que está corriendo
sudo systemctl status mongod
```

La URI a usar es `mongodb://127.0.0.1:27017/autofondo` (ya es el valor por defecto en `ecosystem.config.js`).

### Opción B — MongoDB Atlas (recomendado para producción robusta)

1. Crear cuenta gratuita en [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Crear un cluster (el tier M0 gratuito es suficiente para empezar)
3. Crear usuario de base de datos con contraseña
4. En "Network Access" → agregar la IP del servidor (o `0.0.0.0/0` para acceso desde cualquier IP)
5. Copiar la Connection String: `mongodb+srv://usuario:contraseña@cluster.mongodb.net/autofondo?retryWrites=true&w=majority`
6. Editar `ecosystem.config.js` y reemplazar el valor de `MONGODB_URI` en `env_production`

### Verificar la conexión

```bash
# Al iniciar la app, los logs deben mostrar:
#   ✅ MongoDB conectado → mongodb://127.0.0.1:27017/autofondo
pm2 logs autofondo | grep MongoDB
```

---

## Paso 4 — Build y deploy

```bash
# Dar permisos al script (solo la primera vez)
chmod +x deploy.sh

# Ejecutar el script de deploy
bash deploy.sh
```

Este script hace automáticamente:
1. `npm install` en el backend (sin devDependencies)
2. `npm run build` en el frontend (genera `frontend/dist/`)
3. Inicia/recarga el proceso con PM2 en modo producción
4. Guarda la configuración de PM2 para que persista tras reboot

---

## Paso 4 — Configurar Nginx

Crear el archivo de configuración del subdominio:

```bash
sudo nano /etc/nginx/sites-available/autofondo.artificialmente.com
```

Pegar este contenido:

```nginx
server {
    listen 80;
    server_name autofondo.artificialmente.com;

    # Aumentar timeout para el modelo de IA (puede tardar hasta 5 min en la primera imagen)
    proxy_read_timeout    300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout    300s;

    # Aumentar tamaño máximo de body (imágenes de autos pueden ser grandes)
    client_max_body_size  30M;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/autofondo.artificialmente.com \
           /etc/nginx/sites-enabled/

# Verificar configuración de Nginx
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

---

## Paso 5 — SSL con Let's Encrypt

```bash
# Instalar Certbot si no está
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado (reemplazar el email)
sudo certbot --nginx -d autofondo.artificialmente.com \
  --non-interactive --agree-tos \
  -m webmaster@artificialmente.com

# Certbot modifica nginx automáticamente para usar HTTPS.
# Verificar que quedó bien:
sudo nginx -t && sudo systemctl reload nginx
```

---

## Paso 6 — PM2 startup (persistir tras reboot)

```bash
# Configurar PM2 para que arranque al reiniciar el servidor
pm2 startup

# Copiar y ejecutar el comando que PM2 imprime (algo como):
# sudo env PATH=... pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Guardar la configuración actual
pm2 save
```

---

## Comandos útiles post-deploy

```bash
# Ver estado del proceso
pm2 status

# Ver logs en tiempo real
pm2 logs autofondo

# Ver solo errores
pm2 logs autofondo --err

# Reiniciar el proceso
pm2 restart autofondo

# Actualizar la app (después de un git pull)
git pull
bash deploy.sh
```

---

## Actualizar la app (deploys futuros)

```bash
cd /var/www/autofondo   # o donde esté instalado

# Traer los últimos cambios
git pull

# Re-deployar
bash deploy.sh
```

---

## Estructura del proyecto en producción

```
autofondo/
├── backend/              ← API Node.js (Express)
│   ├── server.js         ← Punto de entrada, sirve también el frontend
│   ├── api/v1/routes.js  ← Rutas: /detect, /remove-bg, /compose, /adjust
│   ├── services/
│   │   ├── bgRemoval.js  ← @imgly background removal (modelo de IA)
│   │   ├── composition.js← Composición con fondo (sharp)
│   │   ├── adjustments.js← Brillo, contraste, rotación
│   │   └── detection.js  ← Detección exterior/interior
│   └── .env.example      ← Variables de entorno de referencia
├── frontend/
│   └── dist/             ← Build compilado (generado por deploy.sh)
├── ecosystem.config.js   ← Configuración PM2
├── deploy.sh             ← Script de deploy automatizado
└── DEPLOY.md             ← Este archivo
```

---

## Arquitectura de producción

```
Internet
    │
    ▼
[Nginx :443 HTTPS]  ←── SSL termination (Let's Encrypt)
    │
    │  proxy_pass http://127.0.0.1:3001
    ▼
[Node.js/Express :3001]  ←── PM2 (NODE_ENV=production)
    │
    ├─ GET /api/v1/*   → Rutas de API
    └─ GET /*          → frontend/dist/index.html (SPA)
```

---

## Variables de entorno (producción)

El archivo `ecosystem.config.js` ya tiene las variables correctas para producción.  
Si necesitás cambiarlas, editá ese archivo y ejecutá `pm2 reload ecosystem.config.js --env production`.

| Variable | Valor producción | Descripción |
|---|---|---|
| `NODE_ENV` | `production` | Habilita modo producción |
| `PORT` | `3001` | Puerto interno (Nginx hace proxy aquí) |
| `ALLOWED_ORIGIN` | `https://autofondo.artificialmente.com` | CORS permitido |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/autofondo` | URI de MongoDB |

---

## ⚠️ Modelo de IA — Cómo funciona en producción

AutoFondo usa `@imgly/background-removal-node` para quitar fondos. El modelo ONNX (~126 MB de archivos) **viene bundleado dentro de `node_modules`** — se instala con `npm install` y **no requiere descarga adicional en runtime ni acceso a internet**.

### Lo que ocurre al arrancar el servidor:

```
[pm2 start]  →  Node.js inicia
               warmup() se llama en background (no bloquea el servidor)

⏳ Cargando modelo de IA en memoria (puede tardar ~10-30 s)...
   (lee ~126 MB de node_modules hacia RAM y crea la sesión ONNX)
✅ Modelo IA listo — primera imagen será inmediata
```

Si el servidor está listo (responde `/api/v1/health`) pero el warmup todavía está corriendo, **la primera imagen procesada puede tardar ~10-30 segundos**. Esto es completamente normal y solo ocurre una vez por arranque.

**No reiniciar el proceso** durante el warmup — `pm2 logs autofondo` muestra el progreso.

### El modelo no se pierde entre deploys

Los archivos del modelo están en `backend/node_modules/@imgly/background-removal-node/dist/`.  
`npm install --omit=dev` (que ejecuta `deploy.sh`) los reinstala automáticamente si hace falta.  
No hay directorio de caché externo que mantener.

### RAM requerida

| Momento | RAM del proceso |
|---|---|
| Servidor idle (sin modelo) | ~100 MB |
| Durante warmup (cargando modelo) | ~800 MB pico |
| Steady state (modelo en RAM) | ~500 MB |
| Durante procesamiento de imagen | ~800 MB pico |

Por eso el requisito mínimo es **2 GB de RAM** en el servidor.

---

## Troubleshooting

**El proceso no inicia:**
```bash
pm2 logs autofondo --err --lines 50
```

**Error de permisos en node_modules de sharp:**
```bash
cd backend && npm rebuild sharp
```

**Nginx 502 Bad Gateway:**
```bash
# Verificar que el proceso PM2 esté corriendo
pm2 status
# Ver en qué puerto corre
curl http://localhost:3001/api/v1/health
```

**La app abre pero las imágenes no se procesan (timeout o demora en la primera):**
```bash
# Ver logs en tiempo real
pm2 logs autofondo
# Normal: si ves "⏳ Cargando modelo de IA..." esperar ~30 seg a que aparezca "✅ Modelo IA listo"
# Si el warmup falló, la primera imagen del usuario lo inicializa (puede tardar ~30 seg)
```

**Disco lleno — el modelo ocupa ~176 MB en node_modules:**
El modelo está bundleado en `backend/node_modules/@imgly/background-removal-node/`.  
No se puede borrar sin romper la app. Si hay problemas de espacio, verificar que no haya versiones viejas de node_modules:
```bash
du -sh /var/www/autofondo/backend/node_modules/
# Si hace falta limpiar y reinstalar limpio:
rm -rf /var/www/autofondo/backend/node_modules/
cd /var/www/autofondo && bash deploy.sh
```

**MongoDB no conecta:**
```bash
# Verificar que mongod está corriendo
sudo systemctl status mongod

# Revisar logs de MongoDB
sudo journalctl -u mongod --since "5 min ago"

# Probar conexión manual
mongosh mongodb://127.0.0.1:27017/autofondo --eval "db.runCommand({ ping: 1 })"
```

**Sesiones/historial no se guardan (error 503 en /api/v1/sessions):**  
El servidor puede arrancar aunque MongoDB no esté disponible (no corta el proceso). Las rutas de persistencia devuelven 503 hasta que MongoDB esté accesible.

```bash
# Iniciar MongoDB
sudo systemctl start mongod
# No hace falta reiniciar PM2 — mongoose reintentará conectar automáticamente
```
