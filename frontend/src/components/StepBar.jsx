import { Upload, Scissors, Image, Download, Check } from 'lucide-react'

const STEPS = [
  { label: 'Fotos',    Icon: Upload   },
  { label: 'Revisar',  Icon: Scissors },
  { label: 'Fondo',    Icon: Image    },
  { label: 'Exportar', Icon: Download },
]

export default function StepBar({ current }) {
  return (
    <div className="flex items-center w-full">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
              ${i < current
                ? 'bg-blue-700 text-white'
                : i === current
                  ? 'bg-blue-700 text-white ring-[3px] ring-blue-100'
                  : 'bg-slate-100 text-slate-400'
              }`}>
              {i < current
                ? <Check size={13} strokeWidth={2.5} />
                : <s.Icon size={13} strokeWidth={2} />
              }
            </div>
            <span className={`text-[10px] font-semibold leading-none
              ${i === current ? 'text-blue-700' : i < current ? 'text-slate-400' : 'text-slate-300'}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-2 mb-3.5 transition-colors
              ${i < current ? 'bg-blue-700' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
