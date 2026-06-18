import { useState, useEffect, useRef } from 'react'

// ── Nav ────────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-af-border/40"
      style={{ background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5">
          <img src="/iso-autofondo.svg" alt="AutoFondo" className="w-7 h-7" />
          <span className="font-heading font-bold text-af-text text-sm tracking-tight">AutoFondo</span>
        </a>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {['Cómo funciona', 'Para quién', 'Precios'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-').replace('é', 'e').replace('é', 'e')}`}
              className="text-sm text-af-muted hover:text-af-text transition-colors">
              {l}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <a href="/app"
            className="hidden md:block text-sm font-medium transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#F1F5F9'}
            onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
          >
            Acceder a la herramienta →
          </a>
          <a href="/app"
            className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-colors"
            style={{ background: '#0090FF' }}
            onMouseEnter={e => e.currentTarget.style.background = '#007AE6'}
            onMouseLeave={e => e.currentTarget.style.background = '#0090FF'}
          >
            Probar demo
          </a>
        </div>
      </div>
    </nav>
  )
}

// ── Mockup animado 3 estados ───────────────────────────────────────────────────
const FONDOS_EJEMPLOS = [
  '/auto_Final.png',
  '/auto_Final1.png',
  '/auto_Final2.png',
]

const PROCESO_STEPS = [
  {
    n: '01', label: 'Original',
    desc: 'Foto tomada en cualquier lugar',
    src: ['/Auto_Con_Fondo.png'], fit: 'cover', badge: false,
  },
  {
    n: '02', label: 'Sin fondo',
    desc: 'IA · menos de 5 segundos',
    src: ['/Auto_Sin_Fondo.png'], fit: 'contain', badge: true,
  },
  {
    n: '03', label: 'Fondo personalizado',
    desc: 'Tu fondo, tu logo, tu marca',
    src: FONDOS_EJEMPLOS, fit: 'cover', badge: false,
  },
]

function ProcesoMockup() {
  const [active,   setActive]   = useState(0)
  const [tick,     setTick]     = useState(0)
  const [fondoIdx, setFondoIdx] = useState(0)
  const [started,  setStarted]  = useState(false)
  const rootRef = useRef(null)

  // Arranca el timer solo cuando el componente es visible en pantalla
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Pequeña demora para que el usuario vea el paso 1 antes de avanzar
          const t = setTimeout(() => setStarted(true), 1000)
          observer.disconnect()
          return () => clearTimeout(t)
        }
      },
      { threshold: 0.5 }   // al menos 50% visible
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Lógica de avance: pasos 0 y 1 avanzan solos; paso 2 cicla todos los fondos y vuelve al 0
  useEffect(() => {
    if (!started) return

    if (active === 0 || active === 1) {
      const t = setTimeout(() => {
        setActive(a => a + 1)
        setTick(k => k + 1)
        setFondoIdx(0)
      }, 3200)
      return () => clearTimeout(t)
    }

    // Paso 3: mostrar cada fondo 2.2s, el último (placa) 4.5s, luego volver al paso 1
    if (active === 2) {
      const isLast = fondoIdx === FONDOS_EJEMPLOS.length - 1
      if (!isLast) {
        const t = setTimeout(() => {
          setFondoIdx(i => i + 1)
        }, 2200)
        return () => clearTimeout(t)
      } else {
        const t = setTimeout(() => {
          setActive(0)
          setFondoIdx(0)
          setTick(k => k + 1)
        }, 4500)
        return () => clearTimeout(t)
      }
    }
  }, [started, active, fondoIdx])

  const handleClick = (i) => {
    setActive(i)
    setTick(k => k + 1)
    setFondoIdx(0)
    setStarted(true)
  }

  // Barra de progreso del paso activo:
  // pasos 0 y 1 duran 3.2s; paso 2 dura 2.2s × cant fondos
  const progressDuration = active === 2
    ? `${2.2 * FONDOS_EJEMPLOS.length}s`
    : '3.2s'

  return (
    <div ref={rootRef} className="w-full max-w-[380px] flex-shrink-0 mx-auto lg:mx-0">

      {/* ── Título sobre la imagen ── */}
      <div style={{
        background: '#0D1117',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0090FF',
          fontFamily: 'monospace', fontSize: '12px', fontWeight: 800,
          color: '#fff',
        }}>
          {active + 1}
        </span>
        <span style={{
          fontSize: '15px', fontWeight: 800, letterSpacing: '0.06em',
          color: '#F1F5F9', textTransform: 'uppercase',
        }}>
          {PROCESO_STEPS[active].label}
        </span>
      </div>

      {/* ── Imagen con crossfade ── */}
      <div className="relative overflow-hidden"
        style={{ aspectRatio: '4/3', background: '#07090f' }}>

        {/* Pasos 0 y 1 */}
        {PROCESO_STEPS.slice(0, 2).map((step, i) => (
          <img key={i} src={step.src[0]} alt={step.label}
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: step.fit,
              opacity: active === i ? 1 : 0,
              transition: 'opacity 0.65s ease-in-out',
            }} />
        ))}

        {/* Paso 2 — galería ciclando */}
        <div className="absolute inset-0"
          style={{ opacity: active === 2 ? 1 : 0, transition: 'opacity 0.65s ease-in-out' }}>
          {FONDOS_EJEMPLOS.map((src, i) => (
            <img key={i} src={src} alt={`Ejemplo ${i + 1}`}
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: 'cover',
                opacity: fondoIdx === i ? 1 : 0,
                transition: 'opacity 0.5s ease-in-out',
              }} />
          ))}
          {/* Miniaturas clicables — sin border-radius, sin card */}
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            display: 'flex', gap: 4,
          }}>
            {FONDOS_EJEMPLOS.map((src, i) => (
              <button key={i}
                onClick={e => { e.stopPropagation(); setFondoIdx(i) }}
                style={{
                  width: 32, height: 24, overflow: 'hidden',
                  outline: 'none', cursor: 'pointer', padding: 0,
                  border: 'none',
                  opacity: fondoIdx === i ? 1 : 0.45,
                  transition: 'opacity 0.2s',
                  boxShadow: fondoIdx === i ? '0 0 0 2px #0090FF' : 'none',
                }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Gradiente piso */}
        <div className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(7,9,15,0.7), transparent)' }} />
      </div>

      {/* ── Indicadores de paso — sin borde, esquinas rectas ── */}
      <div style={{ display: 'flex', marginTop: 2, gap: 1 }}>
        {PROCESO_STEPS.map((step, i) => {
          const isActive = active === i
          const accent = i === 2 ? '#06D6A0' : '#0090FF'
          return (
            <button key={i} onClick={() => handleClick(i)}
              style={{
                flex: 1, textAlign: 'left', cursor: 'pointer', outline: 'none',
                background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: 'none', borderRadius: 0,
                padding: '10px 10px 12px',
                borderTop: `2px solid ${isActive ? accent : 'rgba(255,255,255,0.08)'}`,
                transition: 'background 0.3s, border-color 0.3s',
              }}>
              {/* Número del paso */}
              <p style={{
                fontSize: '20px', fontWeight: 900, lineHeight: 1, marginBottom: 6,
                color: isActive ? accent : 'rgba(255,255,255,0.15)',
                transition: 'color 0.3s',
              }}>
                {i + 1}/3
              </p>
              {/* Label */}
              <p style={{
                fontSize: 12, fontWeight: 800, lineHeight: 1.2,
                color: isActive ? '#F1F5F9' : 'rgba(255,255,255,0.2)',
                transition: 'color 0.3s', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {step.label}
              </p>
              {/* Desc */}
              <p style={{
                fontSize: 10, marginTop: 3, lineHeight: 1.3,
                color: isActive ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.1)',
                transition: 'color 0.3s',
              }}>
                {step.desc}
              </p>
              {/* Barra de progreso */}
              <div style={{ height: 2, marginTop: 8, background: 'rgba(255,255,255,0.06)' }}>
                <div key={`${i}-${tick}`} style={{
                  height: '100%', background: accent,
                  width: isActive ? '100%' : '0%',
                  transition: isActive && started ? `width ${progressDuration} linear` : 'none',
                }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: '#080B14' }}>

      {/* Foto de fondo — lote de automotora con blur y oscurecimiento fuerte */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `url('/Fndo.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        filter: 'blur(2px) brightness(0.38) saturate(0.6)',
        transform: 'scale(1.06)',
      }} />

      {/* Overlay con gradiente — más denso a la izquierda donde está el texto */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(105deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.60) 50%, rgba(0,0,0,0.42) 100%)',
      }} />

      {/* Acento azul sutil */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 75% 55%, rgba(0,144,255,0.07) 0%, transparent 70%)',
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-20 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-14">

          {/* Texto principal — "contents" en mobile para poder intercalar el mockup */}
          <div className="contents lg:flex lg:flex-col lg:max-w-2xl">

            {/* Badge + título — va primero siempre */}
            <div className="order-1">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-8 flex items-center gap-2"
                style={{ color: '#0090FF' }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#06D6A0' }} />
                Herramienta de IA · Automotoras
              </p>

              <h1 className="font-heading leading-[1.05] mb-6">
                <span className="block text-2xl md:text-3xl lg:text-4xl font-light"
                  style={{ color: '#94A3B8' }}>
                  Sólo cargá las imágenes.
                </span>
                <span className="block text-5xl md:text-6xl lg:text-7xl font-extrabold mt-2"
                  style={{ color: '#F1F5F9' }}>
                  AutoFondo hace el resto.
                </span>
              </h1>
            </div>

            {/* Párrafo + botones — en mobile va DESPUÉS del mockup */}
            <div className="order-3 lg:order-2">
              <p className="text-base md:text-lg mb-10 max-w-xl leading-relaxed"
                style={{ color: '#94A3B8' }}>
                En segundos tenés todo el set de fotos listo para publicar.
                La IA elimina fondos, aplica el tuyo y pone tu logo — en toda la flota, de una sola vez.
                Sin Photoshop, sin diseñadores, sin esperas.
              </p>

              <div className="flex items-center gap-4 flex-wrap">
                <a href="/app"
                  className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-all"
                  style={{ background: '#0090FF' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#007AE6'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0090FF'}
                >
                  Probar demo
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"
                    viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
                <a href="https://wa.link/8btz8r"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm border transition-colors"
                  style={{ borderColor: '#1E293B', color: '#94A3B8' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.color = '#F1F5F9' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E293B'; e.currentTarget.style.color = '#94A3B8' }}
                >
                  Consultar por WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Mockup proceso 3 estados — en mobile va entre el título y el párrafo */}
          <div className="order-2 lg:order-3">
            <ProcesoMockup />
          </div>
        </div>

        {/* Stats — fila debajo en desktop */}
        <div className="hidden lg:flex items-center gap-12 mt-16 pt-10"
          style={{ borderTop: '1px solid #1E293B' }}>
          {[
            { num: '<5 seg', label: 'por foto' },
            { num: '×10',   label: 'más rápido que manual' },
            { num: '100%',  label: 'automático' },
          ].map(({ num, label }) => (
            <div key={label}>
              <p className="font-heading font-extrabold text-3xl" style={{ color: '#F1F5F9' }}>{num}</p>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: '#475569' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Tres Estados del Proceso ───────────────────────────────────────────────────
function TresEstados() {
  return (
    <section id="como-funciona" style={{ background: '#080B14' }}>
      <div className="max-w-7xl mx-auto px-6 py-28">

        {/* Header editorial — mismo estilo que Artificialmente */}
        <div className="mb-16 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-5"
            style={{ color: 'rgba(255,255,255,0.28)' }}>
            Cómo funciona
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.06] max-w-xl"
              style={{ color: '#F1F5F9' }}>
              De la foto cruda<br />a imagen publicable.
            </h2>
            <p className="text-sm leading-relaxed max-w-xs"
              style={{ color: 'rgba(255,255,255,0.32)' }}>
              Menos de 5 segundos por imagen.<br />Toda la flota a la vez.
            </p>
          </div>
        </div>

        {/* Las 3 imágenes reales — grid limpio, sin cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">

          <div>
            <p className="font-mono text-[11px] mb-5" style={{ color: 'rgba(0,144,255,0.6)' }}>
              01 — Original
            </p>
            <img src="/Auto_Con_Fondo.png" alt="Foto original con fondo"
              className="w-full"
              style={{ aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
            <p className="text-[13px] mt-4 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              Foto tomada en cualquier lugar. El fondo no importa.
            </p>
          </div>

          <div>
            <p className="font-mono text-[11px] mb-5" style={{ color: 'rgba(0,144,255,0.6)' }}>
              02 — Fondo eliminado
            </p>
            <img src="/Auto_Sin_Fondo.png" alt="Auto sin fondo"
              className="w-full"
              style={{ aspectRatio: '4/3', objectFit: 'contain', display: 'block',
                background: 'rgba(255,255,255,0.03)' }} />
            <p className="text-[13px] mt-4 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              IA elimina el fondo con precisión. PNG transparente en segundos.
            </p>
          </div>

          <div>
            <p className="font-mono text-[11px] mb-5" style={{ color: 'rgba(0,144,255,0.6)' }}>
              03 — Publicable
            </p>
            <img src="/auto_Final.png" alt="Auto con fondo profesional"
              className="w-full"
              style={{ aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
            <p className="text-[13px] mt-4 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              Con tu fondo y tu logo. Listo para publicar donde lo necesitás.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}

// ── Funcionalidades ────────────────────────────────────────────────────────────
function Funciones() {
  const features = [
    { n: '01', title: 'Procesamiento por lote',           desc: 'Subí 1 foto o 200 — la IA procesa todo en paralelo. Sin esperas adicionales según la cantidad.' },
    { n: '02', title: 'Menos de 5 segundos por foto',     desc: 'Velocidad real. Cada imagen recortada con precisión antes de que puedas pestañear.' },
    { n: '03', title: 'Sombra automática bajo el auto',   desc: 'La IA genera una sombra natural en la base del vehículo para que el resultado se vea realista sobre cualquier fondo.' },
    { n: '04', title: 'Tapado automático de matrícula',   desc: 'Detecta y tapa la chapa del vehículo antes de publicar. Con negro o con tu logo, sin edición manual.' },
    { n: '05', title: 'Marca de agua al lote entero',     desc: 'Aplicá el logo de tu automotora a todas las fotos con un clic. Consistente en toda la flota.' },
    { n: '06', title: 'Edición por lote',                 desc: 'Ajustá brillo, contraste y recorte para todas las fotos a la vez. Un cambio, toda la flota actualizada.' },
    { n: '07', title: 'Edición individual',               desc: 'Cuando una foto lo necesita, ajustá cada detalle en el modo individual con control total.' },
    { n: '08', title: 'Publicación directa',              desc: null, isPublish: true },
  ]

  return (
    <section style={{ background: '#E8E4DC', position: 'relative', zIndex: 2 }}>
      <div className="max-w-7xl mx-auto px-6 py-28">

        {/* Header editorial */}
        <div className="mb-10 pb-7" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-5"
            style={{ color: 'rgba(28,26,23,0.35)' }}>
            Funcionalidades
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.06] max-w-xl"
              style={{ color: '#1C1A17' }}>
              Todo lo que necesitás<br />en un solo lugar.
            </h2>
            <p className="text-sm leading-relaxed max-w-xs"
              style={{ color: 'rgba(28,26,23,0.42)' }}>
              Diseñado para automotoras que necesitan velocidad y consistencia, no herramientas complicadas.
            </p>
          </div>
        </div>

        {/* Lista editorial — mismo patrón que ServicesSection de Artificialmente */}
        <div>
          {features.map((f, i) => (
            <div key={f.n} className="-mx-3 px-3"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-start gap-4 sm:gap-8 min-h-[80px] py-4 sm:py-5">
                <span className="font-mono text-[11px] w-6 flex-shrink-0 pt-0.5"
                  style={{ color: 'rgba(0,144,255,0.5)' }}>
                  {f.n}
                </span>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <h3 className="font-heading text-base font-semibold"
                    style={{ color: 'rgba(28,26,23,0.75)' }}>
                    {f.title}
                  </h3>
                  {f.isPublish ? (
                    <div className="text-sm leading-relaxed sm:max-w-sm sm:text-right"
                      style={{ color: 'rgba(28,26,23,0.38)' }}>
                      <p>Descargá las fotos procesadas y publicá donde quieras.</p>
                      <p className="mt-1.5">
                        <span style={{ color: 'rgba(28,26,23,0.5)', fontWeight: 600 }}>** </span>
                        Para publicar directamente en plataformas de venta de autos, integramos con{' '}
                        <a href="#multipost" style={{ color: '#0090FF', fontWeight: 600, textDecoration: 'underline' }}>
                          Multipost
                        </a>
                        {' '}— nuestra plataforma de publicación múltiple.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed sm:max-w-sm sm:text-right"
                      style={{ color: 'rgba(28,26,23,0.38)' }}>
                      {f.desc}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA text link — sin botones llamativos */}
        <div className="mt-12 flex items-center gap-6">
          <a href="/app"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: '#0090FF' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Probar gratis →
          </a>
          <span className="text-[12px]" style={{ color: 'rgba(28,26,23,0.32)' }}>
            Sin registro · Sin tarjeta de crédito
          </span>
        </div>
      </div>
    </section>
  )
}

// ── Para quién ─────────────────────────────────────────────────────────────────
function ParaQuien() {
  const items = [
    {
      n: '01',
      title: 'Velocidad real',
      desc: 'Lo que antes tomaba 10 minutos por foto, AutoFondo lo hace en menos de 5 segundos. Tu equipo dedica el tiempo a vender, no a editar.',
    },
    {
      n: '02',
      title: 'Consistencia en toda la flota',
      desc: 'Todas las fotos con el mismo fondo profesional. Sin variaciones, sin resultados disparejos. La imagen de tu automotora habla sola.',
    },
    {
      n: '03',
      title: 'Sin herramientas externas',
      desc: 'No necesitás Photoshop, ni contratar a un diseñador, ni aprender nada nuevo. Subís la foto y listo.',
    },
    {
      n: '04',
      title: 'Escala sin esfuerzo',
      desc: 'Procesá 1 foto o 200 en el mismo tiempo. La IA trabaja igual de rápido para toda tu flota disponible.',
    },
  ]

  return (
    <section id="para-quien" style={{ background: '#080B14' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="mb-16">
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-4"
            style={{ color: '#0090FF' }}>
            Para automotoras
          </p>
          <h2 className="font-heading font-extrabold text-4xl md:text-5xl leading-tight"
            style={{ color: '#F1F5F9' }}>
            Para quien vende<br />autos, no tiempo.
          </h2>
        </div>

        {/* Lista */}
        <div>
          {items.map((item, i) => (
            <div key={item.n}
              className="flex flex-col md:flex-row md:items-start gap-4 md:gap-16 py-8"
              style={{ borderTop: i === 0 ? '1px solid #1E293B' : undefined,
                       borderBottom: '1px solid #1E293B' }}>

              {/* Izq */}
              <div className="md:w-1/2 flex items-start gap-4">
                <span className="font-heading font-bold text-xs tracking-widest pt-1"
                  style={{ color: '#334155', minWidth: '2rem' }}>{item.n}</span>
                <h3 className="font-heading font-bold text-xl md:text-2xl"
                  style={{ color: '#F1F5F9' }}>{item.title}</h3>
              </div>

              {/* Der */}
              <div className="md:w-1/2 md:pl-4">
                <p className="text-sm md:text-base leading-relaxed"
                  style={{ color: '#94A3B8' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Precios ────────────────────────────────────────────────────────────────────
function Precios() {
  const WA_URL = 'https://wa.link/8btz8r'
  return (
    <section id="precios" style={{ background: '#E8E4DC' }}>
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-4"
            style={{ color: '#6B7280' }}>
            Precios
          </p>
          <h2 className="font-heading font-extrabold text-4xl md:text-5xl leading-tight mb-6"
            style={{ color: '#0F172A' }}>
            Sin planes<br />complicados.
          </h2>
          <p className="text-base md:text-lg leading-relaxed mb-10"
            style={{ color: '#4B5563' }}>
            Adaptamos el acceso a cada automotora según su volumen y necesidades.
            Hablá con nosotros y te contamos cómo funciona en menos de 5 minutos.
          </p>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-colors"
            style={{ background: '#0090FF' }}
            onMouseEnter={e => e.currentTarget.style.background = '#007AE6'}
            onMouseLeave={e => e.currentTarget.style.background = '#0090FF'}
          >
            Consultar por WhatsApp
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"
              viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#050810', borderTop: '1px solid #1E293B' }}>
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <img src="/iso-autofondo.svg" alt="AutoFondo" className="w-5 h-5" />
            <span className="font-heading font-bold text-sm" style={{ color: '#F1F5F9' }}>AutoFondo</span>
          </div>
          <p className="text-xs" style={{ color: '#475569' }}>
            Una herramienta de{' '}
            <a href="https://artificialmente.uy" target="_blank" rel="noopener noreferrer"
              className="hover:underline" style={{ color: '#94A3B8' }}>
              Artificialmente
            </a>
          </p>
        </div>

        <p className="text-xs" style={{ color: '#334155' }}>
          © {new Date().getFullYear()} Artificialmente · Montevideo, Uruguay
        </p>
      </div>
    </footer>
  )
}

// ── Landing (composición) ──────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div>
      <Nav />
      <Hero />
      <Funciones />
      <ParaQuien />
      <Precios />
      <Footer />
    </div>
  )
}
