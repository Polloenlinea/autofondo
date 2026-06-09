# AutoFondo — Eliminación de fondo para fotos de autos

Herramienta web profesional para remover y reemplazar el fondo de fotografías de vehículos. Desarrollada para concesionarias, casas de autos usados, representantes de marcas y el rubro automotor en general.

**Demo:** [autofondo.artificialmente.com](https://autofondo.artificialmente.com)  
**Parte de:** [Artificialmente — Suite de herramientas para el rubro automotor](https://artificialmente.com)

---

## Características

- 🤖 **IA de eliminación de fondo** — Recorte preciso del auto sin fondo manual
- 🖼️ **Fondos predefinidos** — Blanco, gris, oscuro + gradientes (Bosque, Cielo, Ciudad, Atardecer, Playa)
- 🎨 **Fondos personalizados** — Subí tu propia imagen de fondo; los últimos 3 quedan guardados
- ✏️ **Editor de máscara** — Pincel borrar/restaurar + herramienta **lazo poligonal** para seleccionar zonas
- 💧 **Marca de agua** — Posición, tamaño y opacidad configurables; logos recientes pre-cargados
- 📦 **Exportación por lote** — ZIP con todas las imágenes en un clic
- 💾 **Historial de sesiones** — Guardá y revisitá lotes anteriores (IndexedDB, local)
- 📱 **Responsive** — Funciona en desktop y mobile (mismo WiFi)
- 🔢 **Procesamiento por lotes** — Múltiples autos en un solo flujo de 4 pasos

---

## Flujo de uso

```
1. Subir fotos  →  2. Revisar recortes  →  3. Aplicar fondo  →  4. Exportar
```

---

## Desarrollo local

```bash
# Instalar dependencias
cd backend  && npm install
cd frontend && npm install

# Iniciar (dos terminales)
cd backend  && node server.js      # http://localhost:8001
cd frontend && npm run dev         # http://localhost:5174
```

O bien usar los scripts incluidos:
- `instalar.bat` — Instala dependencias (Windows)
- `iniciar.bat`  — Inicia ambos servidores (Windows)

---

## Deploy en producción

Ver **[DEPLOY.md](./DEPLOY.md)** para la guía completa de despliegue en servidor con Nginx + PM2 + SSL.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| IA (eliminación de fondo) | @imgly/background-removal-node |
| Procesamiento de imágenes | Sharp |
| Persistencia local | IndexedDB (sesiones, historial) |
| ZIP en cliente | JSZip |

---

## Parte de Artificialmente

Este producto es una de las herramientas de la suite **Artificialmente** para el sector automotor. Otras herramientas disponibles en [artificialmente.com/herramientas](https://artificialmente.com/herramientas).
