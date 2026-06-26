# AutoFondo — Documento de Handoff (continuación con otro agente)

> Última actualización: jun 2026. Este doc resume TODO el estado del proyecto para que
> cualquier agente/dev lo continúe sin el contexto de la conversación previa.

## 1. Qué es
**AutoFondo**: herramienta web para **automotoras** (Uruguay/LATAM). Quita el fondo de
fotos de autos y les pone un **fondo nuevo** (común o generado por IA) con **sombra
realista**. Parte del ecosistema **AutoHub**, *powered by Artificialmente*.

El ROL FUNDAMENTAL es la **UX/usabilidad** (intuitiva, amigable, responsive) y que el
resultado sea **realista** (auto bien apoyado, fondos creíbles, sin halos ni cortes).

## 2. Stack y cómo correr
- **Frontend:** React + Vite → `frontend/`, **puerto 5176** (fijo en `vite.config.js`).
  - `npm run dev` desde `frontend/`.
  - Rutas (react-router): `/` landing, `/app` herramienta, `/register`, `/p/:code` acceso directo.
- **Backend:** Node + Express → `backend/`, **puerto 8001**. MongoDB para sesiones/borradores.
  - `node server.js` desde `backend/`. Carga `backend/.env` con `process.loadEnvFile()` (Node 24).
  - Proxy Vite: `/api/v1` → `localhost:8001`.
- **Quitar fondo:** BiRefNet ONNX (CPU, local) o @imgly. **GRATIS** (no usa APIs pagas).
- **Modelos ONNX:** en `backend/ml/` (~1.2GB, gitignoreados; el loader `birefnet.js` sí está).

### ⚠️ Problema operativo de ESTA PC (no es bug de la app)
El proyecto vive en **OneDrive**, que **evicta los módulos nativos** (sharp/onnx) →
el backend **se cae solo cada tanto** (sobre todo por inactividad). Síntomas: el frontend
muestra **"Failed to fetch"**.
- Para resiliencia se corre en loop: `until false; do node server.js; sleep 2; done`.
- **CUIDADO:** no acumular **múltiples loops/instancias** — pelean por el puerto 8001 y
  causan "Failed to fetch" intermitente. **Verificar siempre que haya UN SOLO `node server.js`.**
- En **producción (Cloud Run, ya previsto)** esto desaparece (sin OneDrive, proceso estable).

## 3. Credenciales (`backend/.env`, gitignoreado — NO commitear)
```
PHOTOROOM_API_KEY=sk_pr_...   # LIVE. Plan Basic $20 = 1000 img/mes. Renueva el 22 de cada mes.
BRIA_API_TOKEN=...            # Trial.
SPYNE_API_KEY=...             # Trial. (Spyne quedó DESCARTADO, ver abajo.)
AI_ENGINE=photoroom           # 'photoroom' (actual) | 'bria'. Cambia el motor de IA sin tocar código.
```
- El usuario **carga/paga las APIs él mismo**. El agente **no** debe entrar credenciales,
  crear cuentas ni pagar.

## 4. Motor de IA — estado actual y decisión
**ACTUAL = Photoroom** (la sombra de Photoroom es la mejor; Bria se evaluó y se dejó como alternativa).

| | Photoroom (actual) | Bria (alternativa) | Spyne (descartado) |
|---|---|---|---|
| Fondo IA | `/v2/edit` `background.prompt` + **modelo Studio** + relight → realista | `lifestyle_shot_by_text` (muy realista) | catálogo de fondos por ID |
| Sombra | `/v2/edit` `shadow.mode=ai.soft` (la mejor) | `product/shadow` (flota, no ideal) | incluida |
| Encuadre | pre-armado 1920×1080 + `referenceBox=originalImage` → respeta posición | `placement_type=original` | propio |
| Consistencia entre fotos | seed + guidance image (mejor) | floja | por catálogo |
| Costo | ~$0.10/img | ~$0.08/img | ~$0.50/img |
| Contra | — | sombra flotada, inconsistente | **imagen por URL pública**, async/lento, pesado |

- **Spyne descartado:** requiere subir la imagen por **URL pública** (no base64), es **async**
  (poll/webhook) y **lento** en trial. Mucha fricción para esta app. (Código de prueba no quedó.)
- **Bria integrado** (`briaScene.js`, `briaShadow.js`) y switchable con `AI_ENGINE=bria`.

## 5. Servicios backend clave (`backend/services/`)
- **composition.js** — `compose()` (compone auto sobre fondo común; sombra interna gratis
  como fallback), `generatePresetBg()` (gris/colores/degradés), `applyRadialBlur()` (dormido,
  se sacó de la UI por pedido del usuario).
- **photoroomScene.js** — fondo IA Photoroom. Pre-arma lienzo 1920×1080 con el auto (misma
  geometría que `compose`) + `referenceBox=originalImage` + **modelo Studio** (header
  `pr-ai-background-model-version: background-studio-beta-2025-03-17`) + `lighting.mode=ai.auto`.
- **photoroomShadow.js** — sombra IA Photoroom. Trim + **FEATHER del borde** (clave, ver §6).
- **briaScene.js / briaShadow.js** — equivalentes con Bria.
- **bgRemoval.js** — quitar fondo + **DEFRINGE** (decontaminación de color, ver §6).
- **usage.js** — contador local de gasto IA. Persiste en `backend/.photoroom-usage.json`.
- **api/v1/routes.js** — endpoints. `/compose` elige motor por `AI_ENGINE` y distingue
  `ai_shadow` (sombra paga) de sombra gratis. `GET /usage`, `POST /usage/reset`.

## 6. Fixes importantes — NO ROMPER
1. **DEFRINGE (bgRemoval.js):** los bordes del recorte traían el color del fondo viejo →
   halo gris al componer. Se arregla con **decontaminación de color** (reemplaza el color del
   borde por el de la carrocería, mantiene el alpha). `DEFRINGE_ITERS = 4`. **NO es erosión.**
2. **FEATHER de sombra (photoroomShadow.js):** Photoroom devuelve la sombra dentro de un
   marco; el borde se veía como **rectángulo y cortaba la sombra**. Se desvanece (feather) el
   alpha en una banda del borde (5%), **protegiendo los píxeles del auto** (`alpha >= 200` no
   se toca). Resultado: sombra apoyada sin corte, sin endurecerla.
3. **Encuadre IA = común:** pre-armar el auto en 1920×1080 con la geometría de `compose` y
   pedir `referenceBox=originalImage` (Photoroom respeta posición/tamaño). Bria: `placement_type=original`.
4. **Flujo de costos (clave):** la **sombra va APAGADA por defecto**. El backend distingue
   `ai_shadow=true` (sombra paga por IA) de `shadow` con sombra **interna gratis**. El
   **auto-preview al entrar al paso de fondo NO gasta** (`ai_shadow:false`); solo se paga al
   **aplicar la elección final**. **Nunca doble cobro** (fondo IA ya trae su sombra incluida).
   Hay un **aviso ámbar** en la UI al activar la sombra.
5. **Gris por defecto** un poco más oscuro: `#c6ccd3` (RGB 198,204,211).
6. **Modelo Studio + relight** en `photoroomScene` → más realismo que el v3 default.
7. **Contador IA** (`UsageBadge.jsx`) en el header. Cuenta solo generaciones reales (no caché).

## 7. Frontend clave (`frontend/src/`)
- **steps/StepBackground.jsx** — elección de fondo (común/IA), sombra (off por defecto + aviso
  de costo), aplicar. Auto-preview gratis; apply final con `aiShadow` cuando hay sombra.
- **components/UsageBadge.jsx** — contador en header (lee `/usage` cada 12s).
- **services/api.js** — `composeImage()` manda `ai_shadow`, `bg_prompt`, `seed`, `guidance`, etc.
- **constants/** — escenas IA (Showroom, Estudio, Garaje, Ruta, Ciudad, Montaña) + prompt libre.

## 8. Git / rollback
- **Mojón viejo:** tag `mojon-photoroom-estable` (commit `8b81b6e`) — estado Photoroom estable
  ANTES de Bria/Spyne/feather/Studio. `git reset --hard mojon-photoroom-estable` para volver.
- **Este handoff** se commitea como nuevo checkpoint (ver tag `photoroom-studio-handoff` si existe).
- `git tag` para ver los puntos de retorno.

## 9. Costos / cuentas
- **Photoroom Basic:** $20 = 1000 img/mes, renueva el **22**. Para más en el mismo ciclo solo
  deja saltar al siguiente escalón (mín **$40 = 2000 img**); no vende "otras 1000 por $20".
  Próximo ciclo se puede **bajar de nuevo a $20**.
- Cada **foto final con IA = 1 imagen**. **Fondos comunes + quitar fondo = GRATIS** (local).
- El "Upgrade to Pro $7.99" del dashboard de Photoroom es la **app de consumo**, NO la API. Ignorar.

## 10. Pendientes / Roadmap
1. **★ Fondos PERSONALIZADOS por cliente (idea fuerte del usuario):** cada cliente (código de
   acceso) con su set de **2-3 fondos propios** (prompt a medida y/o **foto de referencia** de
   su salón/frente). Mostrarlos como botones tipo Showroom/Garaje, propios de él. Panel admin
   para que el equipo los cargue en el onboarding.
   - Técnica Photoroom: `background.imageFile` (foto exacta del local + AI shadow/relight para
     que el auto "calce") **o** `background.guidance.imageFile` (foto de referencia → genera
     variantes adaptadas). Requiere: guardar presets por cliente (backend/DB) + UI + admin.
2. **Auditoría UX + responsive** completa (deferida hace tiempo).
3. **Censura de matrícula** (tapar con logo) — pendiente; requiere Google Vision (la org del
   usuario bloquea JSON keys; en Cloud Run usa credenciales automáticas).
4. **Validar consistencia** entre fotos del mismo auto (seed + guidance) con lotes reales.
5. Afinar: intensidad/ancho del feather de sombra, oscuridad del gris, prompts de escenas.

## 11. Consejos para el próximo agente
- **Probar SIN IA es gratis** (compose, defringe, feather, presets) → scripts node en `backend/`.
  Pero **sharp a veces no carga en scripts sueltos** (OneDrive evicta el `.node`) → en ese caso
  testear contra el **backend en vivo** vía `fetch('http://localhost:8001/...')`.
- **Probar IA cuesta créditos del usuario** → **pedir confirmación antes de gastar** y testear
  **una vez bien** (no iterar a ciegas; reproducir local lo que se pueda).
- El usuario es **rioplatense (Uruguay)**, valora **honestidad**, buena **UX** y **no gastar de
  más**. Si algo no se puede o se complica, **decirlo derecho** y ofrecer el camino simple.
- Antes de tocar algo grande: confirmar que hay **un solo backend** corriendo y, si se cambia
  algo riesgoso, dejar un **mojón** (commit/tag) para poder volver.
