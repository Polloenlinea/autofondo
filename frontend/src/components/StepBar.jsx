import { Upload, Image, Download, Check } from 'lucide-react'

const STEPS = [
  { label: 'Fotos',    Icon: Upload   },
  { label: 'Fondo',    Icon: Image    },
  { label: 'Resultado', Icon: Download },
]

export default function StepBar({ current }) {
  return (
    <div className="flex items-center w-full">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {/* Círculo — 44px en mobile para zona tocable cómoda */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
              ${i < current
                ? 'bg-blue-700 text-white'
                : i === current
                  ? 'bg-blue-700 text-white ring-4 ring-blue-100'
                  : 'bg-slate-100 text-slate-400'
              }`}>
              {i < current
                ? <Check size={16} strokeWidth={2.5} />
                : <s.Icon size={15} strokeWidth={2} />
              }
            </div>
            <span className={`text-[11px] font-semibold leading-none tracking-tight
              ${i === current ? 'text-blue-700' : i < current ? 'text-slate-400' : 'text-slate-300'}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1.5 mb-4 transition-colors rounded-full
              ${i < current ? 'bg-blue-700' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
