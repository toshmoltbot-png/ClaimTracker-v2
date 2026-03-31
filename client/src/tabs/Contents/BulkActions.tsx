interface BulkActionsProps {
  selectedCount: number
  allVisibleSelected: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onSetContaminated: (value: boolean) => void
  onSetDisposition: (value: string) => void
  onDeleteSelected: () => void
}

export function BulkActions({
  selectedCount,
  allVisibleSelected,
  onSelectAll,
  onDeselectAll,
  onSetContaminated,
  onSetDisposition,
  onDeleteSelected,
}: BulkActionsProps) {
  if (!selectedCount) return null

  return (
    <section className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {selectedCount} selected
          </p>
          <button
            className="button-secondary px-3 py-1.5 text-xs"
            onClick={allVisibleSelected ? onDeselectAll : onSelectAll}
            type="button"
          >
            {allVisibleSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="button-secondary px-3 py-1.5 text-xs" onClick={() => onSetDisposition('discarded')} type="button">
            Set Discarded
          </button>
          <button className="button-secondary px-3 py-1.5 text-xs" onClick={() => onSetDisposition('inspected')} type="button">
            Set Inspected
          </button>
          <button className="button-secondary px-3 py-1.5 text-xs" onClick={() => onSetContaminated(true)} type="button">
            Mark Contaminated
          </button>
          <button className="button-secondary px-3 py-1.5 text-xs" onClick={() => onSetContaminated(false)} type="button">
            Clear Contamination
          </button>
          <button className="button-secondary px-3 py-1.5 text-xs" onClick={onDeleteSelected} type="button">
            Delete Selected
          </button>
        </div>
      </div>
    </section>
  )
}
