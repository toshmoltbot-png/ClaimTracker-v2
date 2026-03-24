import { CONTENT_CATEGORIES } from '@/lib/claimWorkflow'

interface BulkActionsProps {
  selectedCount: number
  allVisibleSelected: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onSetCategory: (category: string) => void
  onSetContaminated: (value: boolean) => void
  onSetDisposition: (value: string) => void
  onMarkCardboardDiscard: () => void
}

export function BulkActions({
  selectedCount,
  allVisibleSelected,
  onSelectAll,
  onDeselectAll,
  onSetCategory,
  onSetContaminated,
  onSetDisposition,
  onMarkCardboardDiscard,
}: BulkActionsProps) {
  return (
    <section className="panel px-5 py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Bulk Actions</p>
          <p className="mt-2 text-sm text-slate-400">{selectedCount} item{selectedCount === 1 ? '' : 's'} selected</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" onClick={allVisibleSelected ? onDeselectAll : onSelectAll} type="button">
            {allVisibleSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button className="button-secondary" disabled={!selectedCount} onClick={() => onSetContaminated(true)} type="button">
            Mark Contaminated
          </button>
          <button className="button-secondary" disabled={!selectedCount} onClick={() => onSetContaminated(false)} type="button">
            Clear Contamination
          </button>
          <button className="button-secondary" disabled={!selectedCount} onClick={() => onSetDisposition('discarded')} type="button">
            Set Discarded
          </button>
          <button className="button-secondary" disabled={!selectedCount} onClick={() => onSetDisposition('inspected')} type="button">
            Set Inspected
          </button>
          <button className="button-secondary" disabled={!selectedCount} onClick={onMarkCardboardDiscard} type="button">
            Cardboard to Discard
          </button>
          <label className="min-w-48">
            <span className="sr-only">Bulk category</span>
            <select className="field py-2.5" defaultValue="" onChange={(event) => event.target.value && onSetCategory(event.target.value)}>
              <option value="">Set category…</option>
              {CONTENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  )
}
