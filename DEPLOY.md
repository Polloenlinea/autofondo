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
| Nginx | cualquier | En el servidor ya debería estar instalado |
| Certbot | cualquier | Para SSL automático |
| RAM | **2 GB mínimo** | El modelo de IA usa ~800 MB al cargar |
| Disco | **3 GB mínimo** | `node_modules` del backend ocupa ~1.5 GB |

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

## Paso 3 — Build y deploy

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

| Variable | Valor producción |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `ALLOWED_ORIGIN` | `https://autofondo.artificialmente.com` |

---

## ⚠️ Advertencia importante — Primera imagen

La primera vez que se procesa una imagen después de iniciar el servidor, el modelo de IA de `@imgly/background-removal-node` descarga y carga sus archivos en memoria. Esto puede tardar **30-60 segundos** y ocupar hasta **1 GB de RAM adicional temporalmente**.

A partir de la segunda imagen, el modelo ya está en memoria y la eliminación de fondo tarda **5-15 segundos** por imagen.

**Esto es normal y esperado.** No reiniciar el proceso si parece que se "cuelga" en la primera imagen.

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

**La app abre pero las imágenes no se procesan:**
```bash
# Ver logs del proceso en tiempo real
pm2 logs autofondo
# Probablemente el modelo de IA está cargando (esperar 30-60 seg)
```

**Disco lleno:**
El modelo de IA crea una carpeta caché (`.imgly-cache/` o similar). Podés limpiarla si es necesario, se regenera automáticamente.
