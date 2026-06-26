# CLAUDE.md — AutoFondo

Herramienta web para **automotoras**: quita el fondo de fotos de autos y les pone fondos
nuevos (comunes o IA) con sombra realista. Ecosistema **AutoHub**, *powered by Artificialmente*.
Usuario: rioplatense (Uruguay) — responder en español, valorar honestidad, UX y no gastar de más.

## 📖 LEER PRIMERO: `HANDOFF.md`
Tiene TODO el contexto (arquitectura, motores de IA, fixes, costos, roadmap, gotchas).
Este archivo es solo el resumen + reglas críticas.

## Cómo correr
- Backend: `cd backend && node server.js` → puerto **8001** (lee `backend/.env`).
- Frontend: `cd frontend && npm run dev` → puerto **5176** (fijo).
- Quitar fondo = local/gratis. Fondos IA y sombra IA = Photoroom (paga).

## ⚠️ Operativo (esta PC con OneDrive)
- El backend se cae solo (OneDrive evicta módulos nativos). Correr en loop
  `until false; do node server.js; sleep 2; done`. **Mantener UN SOLO `node server.js`**
  (varios pelean por el puerto 8001 → "Failed to fetch").
- `sharp` a veces no carga en **scripts node sueltos** → testear contra el backend en vivo (`fetch`).

## Motor de IA
- `AI_ENGINE` en `backend/.env`: `photoroom` (actual) | `bria`. Spyne descartado.
- Photoroom: modelo **Studio** + relight + `referenceBox=originalImage`. La sombra de Photoroom es la mejor.

## 🚫 NO ROMPER (fixes ganados con esfuerzo — ver HANDOFF §6)
1. **Defringe** (bgRemoval): decontaminación de color del borde (no erosión) → sin halo gris.
2. **Feather de sombra** (photoroomShadow): desvanece el borde del marco, protege el auto
   (`alpha>=200`) → sombra apoyada sin corte/rectángulo.
3. **Encuadre IA = común**: pre-armado 1920×1080 + `referenceBox=originalImage`.
4. **Flujo de costos**: sombra OFF por defecto; `ai_shadow` separa sombra paga de la gratis;
   entrar al paso de fondo NO gasta; nunca doble cobro. Hay aviso de costo en la UI.

## 💸 Costos
- Cada foto final con IA = 1 imagen Photoroom. Fondos comunes + quitar fondo = gratis.
- **Probar IA gasta créditos del usuario → confirmar antes y testear una sola vez bien.**
- Reproducir local lo que se pueda (gratis) antes de gastar.

## Rollback
- Mojón: `git reset --hard mojon-photoroom-estable` (o el tag de handoff más nuevo).
- Antes de cambios grandes, dejar un commit/tag de respaldo.

## Próximo paso grande (roadmap)
Fondos **personalizados por cliente**: cada automotora con su set de 2-3 fondos (prompt o foto
de referencia de su salón/frente), vía `background.imageFile` o `background.guidance` de
Photoroom. Ver HANDOFF §10.
