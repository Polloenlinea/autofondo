import { Upload, Image, Download, Check } from 'lucide-react'

const STEPS = [
  { label: 'Fotos',     Icon: Upload   },
  { label: 'Fondo',     Icon: Image    },
  { label: 'Resultado', Icon: Download },
]

export default function StepBar({ current }) {
  return (
    <div className="flex items-center w-full">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm`}
              style={{
                background: i < current ? '#fff' : i === current ? '#fff' : 'rgba(255,255,255,.12)',
                color:      i < current ? '#111' : i === current ? '#111' : 'rgba(255,255,255,.35)',
                boxShadow:  i === current ? '0 0 0 3px rgba(255,255,255,.15)' : 'none',
              }}>
              {i < current
                ? <Check size={14} strokeWidth={2.5} />
                : <s.Icon size={14} strokeWidth={2} />
              }
            </div>
            <span className="text-[10px] font-semibold leading-none"
              style={{
                color: i === current ? '#fff' : i < current ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.25)',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.03em',
              }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-px mx-2 mb-4 transition-colors"
              style={{ background: i < current ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.12)' }} />
          )}
        </div>
      ))}
    </div>
  )
}
