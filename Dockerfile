# ── Stage 1: Build del frontend ──────────────────────────────────────────────
FROM node:20-bullseye AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Imagen de producción ─────────────────────────────────────────────
FROM node:20-bullseye AS production

# onnxruntime y sharp chocan al liberar memoria (free(): invalid size)
# Usar jemalloc como asignador de memoria soluciona esto definitivamente.
RUN apt-get update && apt-get install -y libjemalloc2 && rm -rf /var/lib/apt/lists/*
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
WORKDIR /app

# Instalar dependencias de producción del backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copiar código fuente del backend
COPY backend/ ./backend/

# Copiar frontend compilado
# server.js usa: path.join(__dirname, '..', 'frontend', 'dist')
# __dirname = /app/backend → '../frontend/dist' = /app/frontend/dist ✅
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Arrancar desde /app/backend para que @imgly encuentre sus recursos en
# node_modules/@imgly/... relativo a process.cwd()
WORKDIR /app/backend
CMD ["node", "server.js"]
