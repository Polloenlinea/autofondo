import { useState } from 'react'
import { History } from 'lucide-react'
import StepBar        from './components/StepBar'
import StepUpload     from './steps/StepUpload'
import StepReview     from './steps/StepReview'
import StepBackground from './steps/StepBackground'
import StepExport     from './steps/StepExport'
import SessionsPanel  from './components/SessionsPanel'
import { useImages }  from './hooks/useImages'
import { useSessions } from './hooks/useSessions'

export default function App() {
  const [step,         setStep]         = useState(0)
  const [outputSize,   setOutputSize]   = useState('original')
  const [showSessions, setShowSessions] = useState(false)

  const {
    images, rejected, addFiles, toggleType, effectiveType,
    processAll, reprocess, applyAdjustments,
    removeImage, clearAll, setComposed, stats,
  } = useImages()

  const { sessions, saveSession, deleteSession, loadSession } = useSessions()

  const reset = () => { clearAll(); setStep(0); setOutputSize('original') }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-4" style={{ height: '52px' }}>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 bg-blue-700 rounded-md flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-sm tracking-tight hidden sm:block">AutoFondo</span>
          </div>

          <div className="w-px h-5 bg-slate-200 flex-shrink-0 hidden sm:block" />

          <div className="flex-1 min-w-0">
            <StepBar current={step} />
          </div>

          {step > 0 && (
            <button onClick={reset}
              className="flex-shrink-0 text-xs font-medium text-slate-400 hover:text-slate-600
                transition-colors ml-2">
              Reiniciar
            </button>
          )}

          <button onClick={() => setShowSessions(true)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <History size={15} />
          </button>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        {step === 0 && (
          <StepUpload
            images={images} rejected={rejected} addFiles={addFiles}
            toggleType={toggleType} effectiveType={effectiveType}
            removeImage={removeImage} stats={stats}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepReview
            images={images} effectiveType={effectiveType}
            toggleType={toggleType} processAll={processAll}
            reprocess={reprocess} applyAdjustments={applyAdjustments}
            removeImage={removeImage}
            stats={stats}
            onNext={(size) => { if (size) setOutputSize(size); setStep(2) }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepBackground
            images={images} effectiveType={effectiveType}
            setComposed={setComposed} stats={stats}
            onNext={() => setStep(3)} onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepExport
            images={images} effectiveType={effectiveType}
            outputSize={outputSize}
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
    </div>
  )
}
