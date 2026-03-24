import { useUIStore } from '@/store/uiStore'

const labelMap = {
  saved: 'Saved',
  saving: 'Saving...',
  offline: 'Offline',
  error: 'Save failed - retry',
} as const

const toneMap = {
  saved: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  saving: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
  offline: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  error: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
} as const

export function SaveStatus() {
  const status = useUIStore((state) => state.saveStatus)

  return (
    <div className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${toneMap[status]}`}>
      {labelMap[status]}
    </div>
  )
}
