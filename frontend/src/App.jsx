import { useState, useCallback, useEffect } from 'react'
import { History, Save, LogOut } from 'lucide-react'
import StepBar        from './components/StepBar'
import ConfirmDialog  from './components/ConfirmDialog'
import StepUpload     from './steps/StepUpload'
import StepBackground from './steps/StepBackground'
import StepExport     from './steps/StepExport'
import SessionsPanel  from './components/SessionsPanel'
import SaveDraftModal from './components/SaveDraftModal'
import UsageBadge     from './components/UsageBadge'
import EditModal      from './components/EditModal'
import ZoomModal      from './components/ZoomModal'
import { useImages }  from './hooks/useImages'
import { useSessions } from './hooks/useSessions'

// Versión visible — subir el número cada vez que cambia algo notable para poder
// confirmar qué versión se está probando.
const APP_VERSION = 'v0.14.0 · defringe + contador IA'

export default function App() {
  const logout = () => { sessionStorage.removeItem('af_code'); window.location.href = '/login' }

  const [step,         setStep]         = useState(0)
  const [outputSize,   setOutputSize]   = useState('original')
  const [showSessions, setShowSessions] = useState(false)
  const [plateOptions, setPlateOptions] = useState({ hidePlate: false, plateLogoFile: null, engine: 'birefnet-lite' })

  // Modal global de edición
  const [editingImgId, setEditingImgId] = useState(null)
  const [editContext,  setEditContext]  = useState('review')

  // Modal de zoom
  const [zoomImgId, setZoomImgId] = useState(null)

  // Confirmación para acciones destructivas (no perder el trabajo por un click)
  const [confirmAction, setConfirmAction] = useState(null)
  // Guardar borrador desde cualquier etapa
  const [showSaveModal, setShowSaveModal] = useState(false)

  const {
    images, rejected, addFiles, toggleType, effectiveType,
    processAll, reprocess, applyAdjustments, applyBlobSelection,
    removeImage, clearAll, loadImages, setComposed, clearComposed, resetProcessing, recomposeOne, stats,
  } = useImages()

  const { sessions, saveSession, deleteSession, loadSession } = useSessions()

  // ¿Hay trabajo que se perdería? (recortes procesados o fondos aplicados)
  const hasCutouts  = images.some(i => i.cutoutB64)
  const hasComposed = images.some(i => i.composedB64)
  const hasWork     = hasCutouts || hasComposed

  // Aviso al recargar / cerrar el navegador si hay trabajo sin guardar
  useEffect(() => {
    const handler = (e) => {
      if (!hasWork) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasWork])

  // Ejecuta `action` directo, o pide confirmación si `when` es true
  const guard = (action, { title, message, confirmLabel, when }) => {
    if (when) {
      setConfirmAction({ title, message, confirmLabel, onConfirm: () => { setConfirmAction(null); action() } })
    } else {
      action()
    }
  }

  const doReset = () => {
    clearAll()
    setStep(0)
    setOutputSize('original')
    setPlateOptions({ hidePlate: false, plateLogoFile: null, engine: 'birefnet-lite' })
    setEditingImgId(null)
    setZoomImgId(null)
  }

  const requestReset = () => guard(doReset, {
    title: 'Empezar de nuevo',
    message: 'Se va a borrar todo el trabajo de este lote (recortes y fondos). Si querés conservarlo, guardá el lote primero desde el paso final. ¿Empezar de nuevo igual?',
    confirmLabel: 'Empezar de nuevo',
    when: hasWork,
  })

  // Retomar un borrador: carga las imágenes guardadas y va al paso de Exportar
  // (resultados preservados, sin re-componer). Confirma si hay trabajo actual.
  const requestContinue = (sessionImages) => {
    const doContinue = () => {
      loadImages(sessionImages)
      setOutputSize('original')
      setEditingImgId(null)
      setZoomImgId(null)
      setShowSessions(false)
      setStep(2)
    }
    guard(doContinue, {
      title: 'Retomar borrador',
      message: 'Se va a reemplazar el lote actual por el borrador guardado. ¿Continuar?',
      confirmLabel: 'Retomar borrador',
      when: hasWork,
    })
  }

  const openEdit = (id, context = 'review') => {
    setEditingImgId(id)
    setEditContext(context)
  }

  const closeEdit = useCallback((dir) => {
    if (dir === 'prev' || dir === 'next') {
      const idx  = images.findIndex(i => i.id === editingImgId)
      const next = dir === 'next' ? images[idx + 1] : images[idx - 1]
      if (next) { setEditingImgId(next.id); return }
    }
    setEditingImgId(null)
  }, [images, editingImgId])

  const editingImg = editingImgId ? images.find(i => i.id === editingImgId) ?? null : null
  const zoomImg    = zoomImgId    ? images.find(i => i.id === zoomImgId)    ?? null : null

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="relative sticky top-0 z-40" style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {/* Branding del ecosistema — desktop */}
        <div className="hidden lg:flex items-center gap-2 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none select-none">
          <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,.3)' }}>una herramienta de</span>
          <img src="/brands/logo-autohub.svg" alt="AutoHub" className="h-5 w-auto opacity-30" style={{ filter: 'invert(1)' }} />
          <span style={{ color: 'rgba(255,255,255,.15)' }} className="mx-0.5">·</span>
          <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,.3)' }}>powered by</span>
          <img src="/brands/logo-artificialmente-h.svg" alt="Artificialmente" className="h-4 w-auto opacity-30" style={{ filter: 'invert(1)' }} />
        </div>
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3" style={{ minHeight: '60px' }}>
          {/* Volver a la landing */}
          <a href="/" title="Volver a la landing"
            className="flex items-center gap-1 flex-shrink-0 text-xs font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,.35)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.7)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.35)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
            </svg>
            <span className="hidden sm:inline">Inicio</span>
          </a>

          {/* Logo AutoFondo — blanco sobre oscuro */}
          <div className="flex items-center flex-shrink-0">
            <img src="/brands/logo-autofondo-dark.svg" alt="AutoFondo"
              className="h-6 sm:h-7 w-auto flex-shrink-0"
              style={{ filter: 'invert(1)' }} />
          </div>

          <div className="w-px h-5 flex-shrink-0 hidden sm:block" style={{ background: 'rgba(255,255,255,.12)' }} />

          {/* StepBar */}
          <div className="flex-1 min-w-0 py-1">
            <StepBar current={step} />
          </div>

          {/* Acciones derecha */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasWork && (
              <button onClick={() => setShowSaveModal(true)}
                title="Guardar borrador para retomar después"
                className="flex items-center gap-1 text-xs font-semibold transition-colors px-2 py-2 rounded-lg min-h-[44px]"
                style={{ color: 'rgba(255,255,255,.5)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.5)'}>
                <Save size={15} /> <span className="hidden sm:inline">Guardar</span>
              </button>
            )}
            {step > 0 && (
              <button onClick={requestReset}
                className="text-xs font-semibold transition-colors px-2 py-2 rounded-lg min-h-[44px]"
                style={{ color: 'rgba(255,255,255,.35)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.35)'}>
                Reiniciar
              </button>
            )}
            <button onClick={() => setShowSessions(true)}
              title="Historial de borradores"
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,.4)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.4)'}>
              <History size={18} />
            </button>
            <button onClick={logout}
              title="Salir"
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,.4)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,100,100,.9)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.4)'}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        {step === 0 && (
          <StepUpload
            images={images} rejected={rejected} addFiles={addFiles}
            toggleType={toggleType} effectiveType={effectiveType}
            removeImage={removeImage} stats={stats}
            plateOptions={plateOptions} onPlateOptions={setPlateOptions}
            onZoom={(id) => setZoomImgId(id)}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepBackground
            images={images} effectiveType={effectiveType}
            processAll={processAll} reprocess={reprocess}
            applyAdjustments={applyAdjustments} applyBlobSelection={applyBlobSelection}
            setComposed={setComposed} stats={stats} removeImage={removeImage}
            plateOptions={plateOptions}
            onEdit={(id) => openEdit(id, 'background')}
            onZoom={(id) => setZoomImgId(id)}
            onNext={() => setStep(2)}
            onBack={() => guard(() => { clearComposed(); resetProcessing(); setStep(0) }, {
              title: 'Volver a cargar fotos',
              message: 'Al volver se van a perder los recortes procesados y los fondos aplicados. ¿Volver igual?',
              confirmLabel: 'Volver y borrar',
              when: hasCutouts || hasComposed,
            })}
          />
        )}
        {step === 2 && (
          <StepExport
            images={images} effectiveType={effectiveType}
            outputSize={outputSize} removeImage={removeImage}
            onEdit={(id) => openEdit(id, 'export')}
            onZoom={(id) => setZoomImgId(id)}
            onBack={() => setStep(1)} onReset={requestReset}
            onSaveDraft={() => setShowSaveModal(true)}
          />
        )}
      </main>

      {/* ── Sessions panel ── */}
      <SessionsPanel
        open={showSessions}
        onClose={() => setShowSessions(false)}
        sessions={sessions}
        onDelete={deleteSession}
        onLoadSession={loadSession}
        onContinue={requestContinue}
      />

      {/* ── Modal de edición global ── */}
      {editingImg && (
        <EditModal
          img={editingImg}
          images={images}
          effectiveType={effectiveType}
          context={editContext}
          onClose={closeEdit}
          onApply={applyAdjustments}
          onReprocess={reprocess}
          onToggleType={toggleType}
          onRecompose={recomposeOne}
        />
      )}

      {/* ── Modal de zoom ── */}
      {zoomImg && (
        <ZoomModal
          img={zoomImg}
          images={images}
          onNavigate={(id) => setZoomImgId(id)}
          onClose={() => setZoomImgId(null)}
        />
      )}

      {/* ── Guardar borrador (global, desde cualquier etapa) ── */}
      {showSaveModal && (
        <SaveDraftModal
          images={images}
          saveSession={saveSession}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* ── Confirmación de acciones destructivas ── */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ── Branding ecosistema (discreto en tablet; en desktop va en el header) ── */}
      <div className="fixed bottom-1.5 left-2 z-50 hidden md:flex lg:hidden items-center gap-1.5
        bg-white/70 backdrop-blur-sm px-2 py-1 rounded-md pointer-events-none select-none opacity-80">
        <span className="text-[9px] text-slate-400">una herramienta de</span>
        <img src="/brands/logo-autohub.svg" alt="AutoHub" className="h-3.5 w-auto" />
        <span className="text-slate-300">·</span>
        <span className="text-[9px] text-slate-400">powered by</span>
        <img src="/brands/logo-artificialmente-h.svg" alt="Artificialmente" className="h-3 w-auto" />
      </div>

      {/* ── Versión (esquina inferior) ── */}
      <div className="fixed bottom-1.5 right-2 z-50 text-[10px] font-medium text-slate-400/80
        bg-white/70 backdrop-blur-sm px-2 py-0.5 rounded-md pointer-events-none select-none">
        {APP_VERSION}
      </div>
    </div>
  )
}
