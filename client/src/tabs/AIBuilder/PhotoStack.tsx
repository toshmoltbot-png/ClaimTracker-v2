import type { AIPhoto, AnalysisMode, PhotoAnalysisStatus } from '@/types/claim'

interface PhotoStackProps {
  title: string
  previewSrc: string
  roomName: string
  mode: AnalysisMode
  status: PhotoAnalysisStatus
  selected: boolean
  expanded: boolean
  resultCount: number
  stackPhotos: AIPhoto[]
  note?: string
  onToggleSelect: (checked: boolean) => void
  onToggleExpand: () => void
  onModeChange: (mode: AnalysisMode) => void
  onAnalyze?: () => void
  onRetry?: () => void
  onDelete: () => void
  onUnstack?: () => void
}

const STATUS_LABELS: Record<PhotoAnalysisStatus, string> = {
  pending: 'Pending',
  analyzing: 'Analyzing',
  complete: 'Complete',
  failed: 'Failed',
}

export function PhotoStack(props: PhotoStackProps) {
  const {
    title,
    previewSrc,
    roomName,
    mode,
    status,
    selected,
    expanded,
    resultCount,
    stackPhotos,
    note,
    onToggleSelect,
    onToggleExpand,
    onModeChange,
    onAnalyze,
    onRetry,
    onDelete,
    onUnstack,
  } = props

  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-slate-950/35 p-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex items-start gap-3">
          <input checked={selected} onChange={(event) => onToggleSelect(event.target.checked)} type="checkbox" />
          {previewSrc ? <img alt={title} className="h-28 w-28 rounded-2xl object-cover" src={previewSrc} /> : <div className="h-28 w-28 rounded-2xl bg-slate-900" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button className="text-left text-lg font-semibold text-white" onClick={onToggleExpand} type="button">
                {title}
              </button>
              <p className="mt-1 text-sm text-slate-400">
                {roomName} · {resultCount} draft item{resultCount === 1 ? '' : 's'} · {STATUS_LABELS[status]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="field max-w-44" onChange={(event) => onModeChange(event.target.value as AnalysisMode)} value={mode}>
                <option value="ITEM_VIEW">Item View</option>
                <option value="ROOM_VIEW">Room View</option>
                <option value="FOCUSED_VIEW">Focused View</option>
              </select>
              {(onAnalyze || onRetry) ? (
                <button className="button-secondary" onClick={status === 'failed' ? onRetry : onAnalyze} type="button">
                  {status === 'failed' ? 'Retry' : 'Analyze'}
                </button>
              ) : null}
              {onUnstack ? (
                <button className="button-secondary" onClick={onUnstack} type="button">
                  Unstack
                </button>
              ) : null}
              <button className="button-secondary" onClick={onDelete} type="button">
                Remove
              </button>
            </div>
          </div>
          {note ? <p className="mt-3 text-sm text-rose-300">{note}</p> : null}
          {expanded && stackPhotos.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {stackPhotos.map((photo) => (
                <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/50 p-3" key={String(photo.id || photo.name)}>
                  <p className="text-sm font-medium text-white">{photo.name || photo.filename || 'Photo'}</p>
                  <p className="mt-1 text-xs text-slate-500">{photo.roomName || 'Unassigned room'}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
