import type { PhotoLibraryEntry } from '@/lib/claimWorkflow'

interface PhotoGridProps {
  photos: PhotoLibraryEntry[]
  onPreview: (photo: PhotoLibraryEntry) => void
  onDelete?: (photo: PhotoLibraryEntry) => void
}

export function PhotoGrid({ photos, onPreview, onDelete }: PhotoGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {photos.map((entry) => (
        <div
          className="group relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-slate-950/40 text-left transition hover:border-sky-400/40 hover:bg-slate-950/60"
          key={entry.id}
        >
          <button
            className="w-full text-left"
            onClick={() => onPreview(entry)}
            type="button"
          >
          <div className="relative">
            <img alt={entry.name} className="aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.02]" src={entry.previewUrl} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
              <p className="mt-1 text-xs text-slate-300">{entry.roomName || 'Unassigned'}</p>
            </div>
          </div>
          <div className="space-y-2 px-4 py-4 text-xs text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span>{entry.sourceType.toUpperCase()}</span>
              <span>{entry.analysisMode || 'No AI mode'}</span>
            </div>
            <p className="line-clamp-2">
              {entry.aiResultId ? `Linked AI result · ${entry.aiItemCount} detected item${entry.aiItemCount === 1 ? '' : 's'}` : 'No linked AI result'}
            </p>
          </div>
          </button>
          {onDelete && (
            <button
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-rose-400 opacity-0 transition hover:bg-rose-500/30 hover:text-rose-300 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onDelete(entry) }}
              title="Delete photo"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
