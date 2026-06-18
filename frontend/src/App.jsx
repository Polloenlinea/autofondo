import { useState, useCallback } from 'react'
import { History } from 'lucide-react'
import StepBar        from './components/StepBar'
import StepUpload     from './steps/StepUpload'
import StepReview     from './steps/StepReview'
import StepBackground from './steps/StepBackground'
import StepExport     from './steps/StepExport'
import SessionsPanel  from './components/SessionsPanel'
import EditModal      from './components/EditModal'
import ZoomModal      from './components/ZoomModal'
import { useImages }  from './hooks/useImages'
import { useSessions } from './hooks/useSessions'

export default function App() {
  const [step,         setStep]         = useState(0)
  const [outputSize,   setOutputSize]   = useState('original')
  const [showSessions, setShowSessions] = useState(false)
  const [plateOptions, setPlateOptions] = useState({ hidePlate: false, plateLogoFile: null })

  // Modal global de edición
  const [editingImgId, setEditingImgId] = useState(null)
  const [editContext,  setEditContext]  = useState('review')

  // Modal de zoom
  const [zoomImgId, setZoomImgId] = useState(null)

  const {
    images, rejected, addFiles, toggleType, effectiveType,
    processAll, reprocess, applyAdjustments, applyBlobSelection,
    removeImage, clearAll, setComposed, clearComposed, resetProcessing, recomposeOne, stats,
  } = useImages()

  const { sessions, saveSession, deleteSession, loadSession } = useSessions()

  const reset = () => {
    clearAll()
    setStep(0)
    setOutputSize('original')
    setPlateOptions({ hidePlate: false, plateLogoFile: null })
    setEditingImgId(null)
    setZoomImgId(null)
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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3" style={{ minHeight: '60px' }}>
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/iso-autofondo.svg" alt="AutoFondo" className="w-8 h-8 rounded-xl flex-shrink-0" />
            <span className="font-bold text-slate-800 text-sm tracking-tight hidden sm:block">AutoFondo</span>
          </div>

          <div className="w-px h-5 bg-slate-200 flex-shrink-0 hidden sm:block" />

          {/* StepBar ocupa el espacio disponible */}
          <div className="flex-1 min-w-0 py-1">
            <StepBar current={step} />
          </div>

          {/* Acciones derecha */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {step > 0 && (
              <button onClick={reset}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600
                  transition-colors px-2 py-2 rounded-lg hover:bg-slate-100 min-h-[44px]">
                Reiniciar
              </button>
            )}
            <button onClick={() => setShowSessions(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400
                hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <History size={18} />
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
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepReview
            images={images} effectiveType={effectiveType}
            toggleType={toggleType} processAll={processAll}
            reprocess={reprocess} applyAdjustments={applyAdjustments}
            applyBlobSelection={applyBlobSelection}
            removeImage={removeImage}
            stats={stats}
            plateOptions={plateOptions}
            onEdit={(id) => openEdit(id, 'review')}
            onZoom={(id) => setZoomImgId(id)}
            onNext={(size) => { if (size) setOutputSize(size); setStep(2) }}
            onBack={() => { resetProcessing(); setStep(0) }}
          />
        )}
        {step === 2 && (
          <StepBackground
            images={images} effectiveType={effectiveType}
            setComposed={setComposed} stats={stats}
            onEdit={(id) => openEdit(id, 'background')}
            onZoom={(id) => setZoomImgId(id)}
            onNext={() => setStep(3)}
            onBack={() => { clearComposed(); setStep(1) }}
          />
        )}
        {step === 3 && (
          <StepExport
            images={images} effectiveType={effectiveType}
            outputSize={outputSize}
            onEdit={(id) => openEdit(id, 'export')}
            onZoom={(id) => setZoomImgId(id)}
            onBack={() => setStep(2)} onReset={reset}
            saveSession={saveSession}
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
        <ZoomModal img={zoomImg} onClose={() => setZoomImgId(null)} />
      )}
    </div>
  )
}
