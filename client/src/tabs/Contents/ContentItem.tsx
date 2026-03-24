import { formatCurrency, getItemTotalValue, normalizeDisposition } from '@/lib/claimWorkflow'
import type { ContentItem as ContentItemType } from '@/types/claim'

interface ContentItemProps {
  item: ContentItemType
  selected: boolean
  onSelect: (checked: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onEnrich: () => void
}

function getStatusLabel(item: ContentItemType) {
  if (item.enrichment?.revised || item.enriched) return 'Enriched'
  if (item.aiJustification) return 'Draft'
  return item.status || 'Manual'
}

export function ContentItem({ item, selected, onSelect, onEdit, onDelete, onEnrich }: ContentItemProps) {
  const quantity = Number(item.quantity || 1)
  const disposition = normalizeDisposition(item.disposition) || 'open'
  const status = getStatusLabel(item)

  return (
    <tr className="border-t border-[color:var(--border)] align-top">
      <td className="px-4 py-3">
        <input checked={selected} onChange={(event) => onSelect(event.target.checked)} type="checkbox" />
      </td>
      <td className="px-4 py-3">
        <div className="min-w-48">
          <p className="font-medium text-white">{item.itemName || 'Unnamed item'}</p>
          {item.replacementLink ? (
            <a className="mt-1 inline-block text-xs text-sky-300 hover:text-sky-200" href={item.replacementLink} rel="noreferrer" target="_blank">
              Replacement link
            </a>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">{item.room || item.location || 'Unassigned'}</td>
      <td className="px-4 py-3 text-sm text-slate-300">{item.category || 'Other'}</td>
      <td className="px-4 py-3 text-sm text-slate-300">{quantity}</td>
      <td className="px-4 py-3 text-sm text-slate-300">{formatCurrency(Number(item.unitPrice || item.replacementCost || 0))}</td>
      <td className="px-4 py-3 text-sm font-semibold text-white">{formatCurrency(getItemTotalValue(item))}</td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-semibold capitalize text-slate-200">{disposition}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs font-semibold text-sky-200">{status}</span>
          {item.contaminated ? <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200">Contaminated</span> : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          <button className="button-secondary px-3 py-2 text-xs" onClick={onEnrich} type="button">
            {item.enrichment?.revised || item.enriched ? 'Re-Enrich' : 'Enrich'}
          </button>
          <button className="button-secondary px-3 py-2 text-xs" onClick={onEdit} type="button">
            Edit
          </button>
          <button className="button-secondary px-3 py-2 text-xs" onClick={onDelete} type="button">
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}
