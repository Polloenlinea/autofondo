import { useState, useEffect, useRef } from 'react'

// ── Nav ────────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-af-border/40"
      style={{ background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center">
          <img src="/brands/logo-autofondo.svg" alt="AutoFondo" className="h-7 w-auto" />
        </a>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {['Cómo funciona', 'Para quién', 'Precios'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-').replace('é', 'e').replace('é', 'e')}`}
              className="text-sm text-af-muted hover:text-af-text transition-colors">
              {l}
            </a>
          ))}
          <a href="https://artificialmente.uy/herramientas/autohub"
            className="text-sm transition-colors flex items-center gap-1.5"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
            ← AutoHub
          </a>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <a href="/login"
            className="hidden md:block text-sm font-medium transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#F1F5F9'}
            onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
          >
            Tengo un código →
          </a>
          <a href="/login"
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

// ── Before / After reveal ─────────────────────────────────────────────────────
const AFTER_IMAGES = [
  '/con_Autohub.png',
  '/con_Autohub2.png',
  '/con_Autohub3.png',
]

function BeforeAfterReveal() {
  const [pos, setPos]           = useState(78)
  const [dragging, setDragging] = useState(false)
  const [userDragged, setUserDragged] = useState(false)
  // Cross-fade: slotA siempre visible, slotB entra encima y luego se convierte en A
  const slotARef  = useRef(0)
  const [slotA, setSlotA] = useState(0)
  const [slotB, setSlotB] = useState(null)
  const [bVisible, setBVisible] = useState(false)
  const containerRef = useRef(null)
  const posRef       = useRef(78)
  const dirRef       = useRef(-1)

  // Animación automática de la línea
  useEffect(() => {
    if (userDragged) return
    let raf
    const step = () => {
      posRef.current += dirRef.current * 0.22
      if (posRef.current <= 12) { posRef.current = 12; dirRef.current = 1 }
      if (posRef.current >= 88) { posRef.current = 88; dirRef.current = -1 }
      setPos(+posRef.current.toFixed(1))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [userDragged])

  // Ciclar imágenes del "después" con cross-fade real (A siempre visible, B entra encima)
  useEffect(() => {
    const t = setInterval(() => {
      const next = (slotARef.current + 1) % AFTER_IMAGES.length
      setSlotB(next)
      // dos frames para que React pinte el elemento antes de arrancar la transición
      requestAnimationFrame(() => requestAnimationFrame(() => setBVisible(true)))
      setTimeout(() => {
        slotARef.current = next
        setSlotA(next)
        setSlotB(null)
        setBVisible(false)
      }, 650)
    }, 3500)
    return () => clearInterval(t)
  }, [])

  const getPosFromEvent = (e) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return pos
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    return Math.min(96, Math.max(4, (clientX - rect.left) / rect.width * 100))
  }

  const onPointerDown = (e) => { e.preventDefault(); setDragging(true); setUserDragged(true); setPos(getPosFromEvent(e)) }
  const onPointerMove = (e) => { if (!dragging) return; const p = getPosFromEvent(e); posRef.current = p; setPos(p) }
  const onPointerUp   = () => setDragging(false)

  return (
    <div className="w-full select-none" style={{ userSelect: 'none' }}>

      {/* Labels */}
      <div className="flex justify-between mb-2 px-1">
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Antes</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          color: '#0090FF', textTransform: 'uppercase' }}>Después ✦</span>
      </div>

      {/* Contenedor */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{
          aspectRatio: '16/9',
          borderRadius: 12,
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        {/* ANTES */}
        <img src="/original.png" alt="Antes"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', pointerEvents: 'none' }} />

        {/* DESPUÉS — cross-fade: A siempre visible, B entra encima */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)`, pointerEvents: 'none' }}>
          {/* Slot A: siempre en pantalla, nunca desaparece */}
          <img src={AFTER_IMAGES[slotA]} alt="Después"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }} />
          {/* Slot B: entra encima con fade, luego se convierte en A */}
          {slotB !== null && (
            <img src={AFTER_IMAGES[slotB]} alt="Después"
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: 'cover',
                opacity: bVisible ? 1 : 0,
                transition: 'opacity 0.5s ease-in-out',
              }} />
          )}
        </div>

        {/* Línea */}
        <div className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
          style={{
            left: `${pos}%`,
            background: 'white',
            boxShadow: '0 0 12px rgba(0,144,255,0.7), 0 0 3px rgba(255,255,255,1)',
          }} />

        {/* Handle */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10"
          style={{
            left: `${pos}%`,
            width: 44, height: 44, borderRadius: '50%',
            background: 'white',
            boxShadow: '0 3px 16px rgba(0,0,0,0.5), 0 0 0 2px rgba(0,144,255,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
            <path d="M6 6H1M1 6L4 3M1 6L4 9" stroke="#0090FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 6H17M17 6L14 3M17 6L14 9" stroke="#0090FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Indicadores de imagen activa */}
        <div className="absolute bottom-3 pointer-events-none z-10"
          style={{ right: '12px', display: 'flex', gap: 5 }}>
          {AFTER_IMAGES.map((_, i) => (
            <div key={i} style={{
              width: i === slotA ? 18 : 5, height: 5, borderRadius: 3,
              background: i === slotA ? '#0090FF' : 'rgba(255,255,255,0.35)',
              transition: 'width 0.3s, background 0.3s',
            }} />
          ))}
        </div>

        {/* Hint */}
        {!userDragged && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase',
              background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 20,
            }}>
            arrastrá para comparar
          </div>
        )}
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

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-16 w-full">

        {/* Texto centrado arriba */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="font-heading leading-[1.08] mb-6">
            <span className="block text-2xl md:text-4xl font-semibold" style={{ color: '#F1F5F9' }}>
              Sólo cargá las imágenes.
            </span>
            <span className="block text-3xl md:text-5xl lg:text-6xl font-extrabold mt-2" style={{ color: '#94A3B8' }}>
              AutoFondo hace el resto.
            </span>
          </h1>
          <div className="flex items-center justify-center gap-4 flex-wrap mt-8">
            <a href="/login"
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

        {/* Reveal */}
        <div className="max-w-4xl mx-auto">
          <BeforeAfterReveal />
        </div>

        {/* CTA editorial */}
        <div className="mt-10 pt-8 text-center" style={{ borderTop: '1px solid #1E293B' }}>
          <p className="font-heading text-xl md:text-2xl leading-snug mb-5" style={{ color: '#F1F5F9' }}>
            <span className="font-normal" style={{ color: '#94A3B8' }}>El auto que mejor se ve</span>
            <br />
            <span className="font-extrabold" style={{ color: '#F1F5F9' }}>es el primero que se vende.</span>
          </p>
          <a href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm border transition-colors"
            style={{ borderColor: '#0090FF', color: '#0090FF' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#0090FF'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0090FF' }}
          >
            Probalo gratis hoy →
          </a>
        </div>
      </div>
    </section>
  )
}

// ── Imagen ciclante para el paso 3 ───────────────────────────────────────────
const PASO3_IMGS = ['/Paso3A.jpg', '/Paso3B.jpg', '/Paso3C.jpg']

function CyclingImg({ imgs, alt }) {
  const curRef  = useRef(0)
  const [cur, setCur]   = useState(0)
  const [next, setNext] = useState(null)
  const [nVis, setNVis] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      const n = (curRef.current + 1) % imgs.length
      setNext(n)
      requestAnimationFrame(() => requestAnimationFrame(() => setNVis(true)))
      setTimeout(() => { curRef.current = n; setCur(n); setNext(null); setNVis(false) }, 600)
    }, 3000)
    return () => clearInterval(t)
  }, [imgs.length])

  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
      <img src={imgs[cur]} alt={alt} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />
      {next !== null && (
        <img src={imgs[next]} alt={alt} className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', opacity: nVis ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }} />
      )}
    </div>
  )
}

// ── Cómo funciona — en 3 pasos ─────────────────────────────────────────────────
function TresEstados() {
  const pasos = [
    { n: '1', accion: 'Cargás las fotos',    img: '/paso1.jpg', fit: 'cover',
      desc: 'Subís el lote del auto de una sola vez. No importa dónde estén tomadas.' },
    { n: '2', accion: 'Elegís el fondo',      img: '/paso2.jpg', fit: 'cover',
      desc: 'Gris, el tuyo, o una escena por IA (showroom, estudio…). La IA recorta y arma todo.' },
    { n: '3', accion: 'Descargás o publicás', img: null, fit: 'cover',
      desc: 'Con tu logo, todo el lote listo para publicar donde lo necesites.' },
  ]
  return (
    <section id="como-funciona" style={{ background: '#080B14' }}>
      <div className="max-w-7xl mx-auto px-6 py-28">

        <div className="mb-16 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-5"
            style={{ color: 'rgba(255,255,255,0.28)' }}>
            Cómo funciona
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.06] max-w-xl"
              style={{ color: '#F1F5F9' }}>
              Así de simple.<br />En 3 pasos.
            </h2>
            <p className="text-sm leading-relaxed max-w-xs"
              style={{ color: 'rgba(255,255,255,0.32)' }}>
              Cargás el lote y la herramienta hace el resto.<br />Sin Photoshop, sin diseñadores.
            </p>
          </div>
        </div>

        {/* 3 pasos con número, imagen real y flecha entre ellos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {pasos.map((p, i) => (
            <div key={p.n} className="relative">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex items-center justify-center w-9 h-9 rounded-full font-heading font-bold text-base flex-shrink-0"
                  style={{ background: 'rgba(0,144,255,0.12)', color: '#0090FF', border: '1px solid rgba(0,144,255,0.3)' }}>
                  {p.n}
                </span>
                <span className="font-heading font-bold text-lg" style={{ color: '#F1F5F9' }}>{p.accion}</span>
              </div>
              {p.img === null
                ? <CyclingImg imgs={PASO3_IMGS} alt={p.accion} />
                : <img src={p.img} alt={p.accion} className="w-full rounded-lg"
                    style={{ aspectRatio: '4/3', objectFit: p.fit, display: 'block' }} />
              }
              <p className="text-[13px] mt-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {p.desc}
              </p>
              {i < 2 && (
                <div className="hidden md:flex absolute -right-5 items-center justify-center font-heading text-2xl"
                  style={{ top: '8px', color: 'rgba(0,144,255,0.4)' }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Funcionalidades ────────────────────────────────────────────────────────────
function Funciones() {
  const features = [
    { n: '01', title: 'Recorte con IA por lote',          desc: 'Cargás el lote completo y se procesa solo, una foto tras otra, con recorte de alta calidad y bordes limpios.' },
    { n: '02', title: 'Fondos generados por IA',          desc: 'Showroom, estudio, exteriores… la IA crea fondos profesionales realistas con un clic. Tu fondo, gris o el que elijas.' },
    { n: '03', title: 'Consistencia entre las fotos',     desc: 'Las fotos del mismo auto comparten el mismo escenario en todos los ángulos. Catálogo prolijo y parejo, no un collage.' },
    { n: '04', title: 'Sombra 3D realista',               desc: 'La IA proyecta la sombra siguiendo el ángulo del vehículo, apoyada en el piso. Se ve real sobre cualquier fondo.' },
    { n: '05', title: 'Mejorá fotos de baja calidad',     desc: 'Más resolución e iluminación pareja con IA. Fotos de celular que quedan a estándar de catálogo.' },
    { n: '06', title: 'Tapado automático de matrícula',   desc: 'Detecta y anula la chapa antes de publicar, sin edición manual.' },
    { n: '07', title: 'Marca de agua anti-robo',          desc: 'Tu logo en todo el lote con un clic, para que nadie reuse tus fotos.' },
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
          <a href="/login"
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
      desc: 'Cargás el lote completo y la herramienta lo procesa sola, sin que edites foto por foto. Vos te dedicás a vender.',
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
          <div className="flex items-center mb-2">
            <img src="/brands/logo-autofondo.svg" alt="AutoFondo" className="h-6 w-auto" />
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
      <TresEstados />
      <Funciones />
      <ParaQuien />
      <Precios />
      <Footer />
    </div>
  )
}
