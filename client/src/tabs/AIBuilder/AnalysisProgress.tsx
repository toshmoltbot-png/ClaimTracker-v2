import { ProgressBar } from '@/components/shared/ProgressBar'
import type { PhotoAnalysisStatus } from '@/types/claim'

interface AnalysisProgressProps {
  value: number
  running: boolean
  currentLabel: string | null
  onStop: () => void
  photoStatuses: Array<{ id: string; label: string; status: PhotoAnalysisStatus }>
}

export function AnalysisProgress({ value, running, currentLabel, onStop, photoStatuses }: AnalysisProgressProps) {
  return (
    <section className="panel px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Progress</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Batch analysis</h3>
        </div>
        <button className="button-secondary" disabled={!running} onClick={onStop} type="button">
          Stop
        </button>
      </div>
      <div className="mt-4">
        <ProgressBar label={currentLabel ? `Current: ${currentLabel}` : 'Overall progress'} value={value} />
      </div>
      <div className="mt-5 space-y-3">
        {photoStatuses.map((photo) => (
          <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3" key={photo.id}>
            <span className="text-sm text-slate-200">{photo.label}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{photo.status}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
