export const BG_PRESETS = [
  { id: 'gray',    label: 'Gris',     style: { background: '#d6dbe0' } },
  { id: 'foco',    label: 'Foco',     style: { background: 'radial-gradient(circle at center, #eef2f6, #96a2b0)' } },
  { id: 'azul',    label: 'Azul',     style: { background: 'radial-gradient(circle at center, #e0eeff, #17365d)' } },
  { id: 'violeta', label: 'Violeta',  style: { background: 'radial-gradient(circle at center, #ede9fe, #4c1d95)' } },
  { id: 'verde',   label: 'Verde',    style: { background: 'radial-gradient(circle at center, #dcf8e9, #064e3b)' } },
  { id: 'aurora',  label: 'Aurora',   style: { background: 'radial-gradient(circle at center, #0c4a6e, #e0f2f8)' } },
  { id: 'white',   label: 'Blanco',   style: { background: '#fff', border: '1px solid #e2e8f0' } },
  { id: 'dark',    label: 'Oscuro',   style: { background: '#0f172a' } },
  { id: 'forest', label: 'Bosque',    style: { background: 'linear-gradient(to bottom, #388e3c, #1b5e20)' } },
  { id: 'sky',    label: 'Cielo',     style: { background: 'linear-gradient(to bottom, #38bdf8, #075985)' } },
  { id: 'city',   label: 'Ciudad',    style: { background: 'linear-gradient(to bottom, #172554, #0a0f1e)' } },
  { id: 'sunset', label: 'Atardecer', style: { background: 'linear-gradient(to bottom, #581c87, #be185d, #ea580c)' } },
  { id: 'sand',   label: 'Playa',     style: { background: 'linear-gradient(to bottom, #7d91aa, #c2a06e)' } },
]

// Escenas generadas por IA (Photoroom AI Backgrounds). Cada una manda un prompt
// armado para que el auto quede integrado con luz, sombra y —si el piso es
// brillante— reflejo. Cada foto generada consume 1 imagen del cupo de Photoroom.
export const AI_SCENES = [
  { id: 'showroom',  label: 'Showroom',  emoji: '🏢',
    prompt: 'modern car dealership showroom, polished glossy reflective floor, soft even studio lighting, clean minimal walls, professional' },
  { id: 'estudio',   label: 'Estudio',   emoji: '📸',
    prompt: 'professional photo studio, seamless light grey backdrop, soft even diffused lighting, subtle contact shadow on floor' },
  { id: 'garaje',    label: 'Garaje',    emoji: '🔧',
    prompt: 'stylish modern garage interior, smooth concrete floor, warm ambient lighting, clean industrial' },
  { id: 'ruta',      label: 'Ruta',      emoji: '🛣️',
    prompt: 'scenic open countryside road at golden hour, asphalt road surface, soft warm natural sunlight, gentle background blur' },
  { id: 'ciudad',    label: 'Ciudad',    emoji: '🌆',
    prompt: 'modern city street at dusk, urban buildings background, wet asphalt with subtle reflections, cinematic lighting' },
  { id: 'montana',   label: 'Montaña',   emoji: '⛰️',
    prompt: 'scenic mountain landscape with gravel ground, bright clear natural daylight, panoramic background' },
]
