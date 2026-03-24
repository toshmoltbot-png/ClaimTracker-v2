interface ProgressBarProps {
  value: number
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label || 'Progress'}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-900">
        <div className="h-2 rounded-full bg-sky-400 transition-[width]" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}
