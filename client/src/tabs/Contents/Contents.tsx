import { useMemo, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import {
  applyEnrichmentResponse,
  applyJustificationResponse,
  deduplicateDraftItemsBySourcePhotos,
  findDuplicateGroups,
  formatCurrency,
  generateContentsChecklistPDF,
  getItemTotalValue,
  normalizeDisposition,
  submitEnrichItem,
  undoEnrichment,
  updateContentLineTotal,
} from '@/lib/claimWorkflow'
import type { DuplicateGroup } from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { AIPhoto, ContentItem as ContentItemType } from '@/types/claim'
import { BulkActions } from '@/tabs/Contents/BulkActions'
import { ContentModal } from '@/tabs/Contents/ContentModal'
import { ContentsSummary } from '@/tabs/Contents/ContentsSummary'
import { DuplicateMergeModal } from '@/tabs/Contents/DuplicateMergeModal'
import { EnrichModal } from '@/tabs/Contents/EnrichModal'

function getItemPhotoUrl(item: ContentItemType, aiPhotos: AIPhoto[]): string | null {
  const ep = (item.evidencePhotos || [])[0]
  if (!ep?.photoId) return null
  const targetId = String(ep.photoId)
  // Search top-level photos first
  let photo = aiPhotos.find((p) => String(p.id) === targetId)
  // If not found, search inside stacks (stacked child photos aren't top-level)
  if (!photo) {
    for (const p of aiPhotos) {
      if (p.isStack && Array.isArray(p.stackPhotos)) {
        const child = p.stackPhotos.find((c) => String(c.id) === targetId)
        if (child) { photo = child; break }
      }
    }
  }
  return photo?.thumbUrl || photo?.url || photo?.dataUrl || null
}

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'value-desc', label: 'Value High-Low' },
  { value: 'value-asc', label: 'Value Low-High' },
  { value: 'room-asc', label: 'Room A-Z' },
]

function compareItems(a: ContentItemType, b: ContentItemType, sort: string) {
  const nameA = String(a.itemName || '').toLowerCase()
  const nameB = String(b.itemName || '').toLowerCase()
  const roomA = String(a.room || a.location || '').toLowerCase()
  const roomB = String(b.room || b.location || '').toLowerCase()
  const totalA = getItemTotalValue(a)
  const totalB = getItemTotalValue(b)

  switch (sort) {
    case 'name-desc':
      return nameB.localeCompare(nameA)
    case 'value-desc':
      return totalB - totalA
    case 'value-asc':
      return totalA - totalB
    case 'room-asc':
      return roomA.localeCompare(roomB) || nameA.localeCompare(nameB)
    default:
      return nameA.localeCompare(nameB)
  }
}

function getInitials(item: ContentItemType) {
  const text = String(item.category || item.itemName || 'Item').trim()
  const parts = text.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'I'
  const first = parts[0]?.[0] || 'I'
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]
  return `${first}${second || ''}`.toUpperCase()
}

function StatusPill({ tone, children }: { tone: 'slate' | 'sky' | 'amber' | 'rose'; children: string }) {
  const classes =
    tone === 'sky'
      ? 'bg-sky-400/15 text-sky-200'
      : tone === 'amber'
        ? 'bg-amber-400/15 text-amber-200'
        : tone === 'rose'
          ? 'bg-rose-400/15 text-rose-200'
          : 'bg-slate-900/80 text-slate-200'

  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}>{children}</span>
}

function ContentCard({
  item,
  selected,
  photoUrl,
  onSelect,
  onEdit,
  onDelete,
  onEnrich,
}: {
  item: ContentItemType
  selected: boolean
  photoUrl: string | null
  onSelect: (checked: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onEnrich: () => void
}) {
  const disposition = normalizeDisposition(item.disposition) || 'open'
  const isEnriched = Boolean(item.enrichment?.revised || item.enriched)
  const showDisposition = disposition === 'discarded' || disposition === 'inspected'
  const roomLabel = item.room || item.location || 'Unassigned'
  const categoryLabel = item.category || 'Other'

  return (
    <div className="relative rounded-2xl border border-[color:var(--border)] bg-slate-950/40 p-4">
      <div className="absolute right-3 top-3">
        <input
          aria-label="Select item"
          checked={selected}
          className="h-4 w-4"
          onChange={(e) => onSelect(e.target.checked)}
          type="checkbox"
        />
      </div>

      <div className="flex gap-3">
        <div className="h-16 w-16 flex-none overflow-hidden rounded-xl bg-slate-900/80">
          {photoUrl ? (
            <img alt="" className="h-full w-full object-cover" loading="lazy" src={photoUrl} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-300">
              {getInitials(item)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{item.itemName || 'Unnamed item'}</p>
              <p className="mt-1 truncate text-xs text-slate-400">
                {roomLabel} · {categoryLabel}
              </p>
            </div>
            <p className="text-base font-semibold text-white">{formatCurrency(getItemTotalValue(item))}</p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {showDisposition ? <StatusPill tone={disposition === 'discarded' ? 'rose' : 'slate'}>{disposition}</StatusPill> : null}
            {isEnriched ? <StatusPill tone="sky">Enriched</StatusPill> : null}
            {item.contaminated ? <StatusPill tone="amber">Contaminated</StatusPill> : null}
          </div>

          {item.replacementLink ? (
            <a
              className="mt-2 inline-block text-xs text-sky-300 hover:text-sky-200"
              href={item.replacementLink}
              rel="noreferrer"
              target="_blank"
            >
              Replacement link
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="button-secondary flex-1 py-2 text-xs" onClick={onEdit} type="button">
          Edit
        </button>
        <button className="button-secondary flex-1 py-2 text-xs" onClick={onEnrich} type="button">
          {isEnriched ? 'Re-Enrich' : 'Enrich'}
        </button>
        <button aria-label="Delete" className="button-secondary px-3 py-2 text-xs" onClick={onDelete} type="button">
          ✕
        </button>
      </div>
    </div>
  )
}

export function Contents() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name-asc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingItem, setEditingItem] = useState<ContentItemType | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ContentItemType | null>(null)
  const [enrichTargetId, setEnrichTargetId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([])
  const [dupModalOpen, setDupModalOpen] = useState(false)
  const PAGE_SIZE = 100

  const aiPhotos = useMemo(() => (data.aiPhotos || []) as AIPhoto[], [data.aiPhotos])
  const allItems = useMemo(() => (data.contents || []).filter((item) => item.source !== 'receipt'), [data.contents])
  const includedItems = useMemo(() => allItems.filter((item) => item.includedInClaim !== false), [allItems])
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allItems
      .filter((item) => {
        if (!needle) return true
        return [item.itemName, item.room, item.location, item.category, item.aiJustification].some((value) =>
          String(value || '').toLowerCase().includes(needle),
        )
      })
      .sort((a, b) => compareItems(a, b, sort))
  }, [allItems, search, sort])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id))
  const enrichTarget = useMemo(() => allItems.find((item) => item.id === enrichTargetId) || null, [allItems, enrichTargetId])
  const totalValue = useMemo(() => includedItems.reduce((sum, item) => sum + getItemTotalValue(item), 0), [includedItems])
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const paginatedItems = useMemo(() => {
    if (filteredItems.length <= PAGE_SIZE) return filteredItems
    const start = page * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [filteredItems, page])

  function patchItems(transform: (item: ContentItemType) => ContentItemType) {
    updateData((current) => ({
      ...current,
      contents: deduplicateDraftItemsBySourcePhotos(current.contents.map((item) => (selectedSet.has(item.id) ? transform(item) : item))),
    }))
  }

  function patchOne(itemId: string, transform: (item: ContentItemType) => ContentItemType) {
    updateData((current) => ({
      ...current,
      contents: current.contents.map((item) => (item.id === itemId ? transform(item) : item)),
    }))
  }

  async function runEnrichment(item: ContentItemType, justifyMode = false) {
    const { response, baseline } = await submitEnrichItem(item, justifyMode ? { justifyMode: true } : undefined)
    patchOne(item.id, (current) => (justifyMode ? applyJustificationResponse(current, response) : applyEnrichmentResponse(current, response, baseline)))
  }

  async function handleBatchEnrich(justifyMode = false) {
    const targets = includedItems.filter((item) => (justifyMode ? true : !(item.enrichment?.revised || item.enriched)))
    if (!targets.length) {
      pushToast(justifyMode ? 'No items available for price justification.' : 'No unenriched items found.', 'info')
      return
    }
    let completed = 0
    for (const item of targets) {
      try {
        await runEnrichment(item, justifyMode)
        completed += 1
      } catch (error) {
        pushToast(error instanceof Error ? error.message : 'Enrichment failed.', 'error')
      }
    }
    pushToast(
      justifyMode ? `Justification updated for ${completed} item${completed === 1 ? '' : 's'}.` : `Enriched ${completed} item${completed === 1 ? '' : 's'}.`,
      'success',
    )
  }

  function handleFindDuplicates() {
    const groups = findDuplicateGroups(allItems)
    if (!groups.length) {
      pushToast('No likely duplicates found.', 'info')
      return
    }
    setDupGroups(groups)
    setDupModalOpen(true)
  }

  function handleMergeItems(keepId: string, removeIds: string[]) {
    updateData((current) => {
      const keepItem = current.contents.find((i) => i.id === keepId)
      if (!keepItem) return current
      const removeItems = current.contents.filter((i) => removeIds.includes(i.id))
      const combinedPhotos = [
        ...(keepItem.evidencePhotos || []),
        ...removeItems.flatMap((i) => i.evidencePhotos || []),
      ]
      const seen = new Set<string>()
      const uniquePhotos = combinedPhotos.filter((p) => {
        const key = String(p.photoId || p.photoName || '')
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      return {
        ...current,
        contents: current.contents
          .filter((i) => !removeIds.includes(i.id))
          .map((i) => (i.id === keepId ? { ...i, evidencePhotos: uniquePhotos } : i)),
      }
    })
    // Remove the merged group from the modal
    setDupGroups((prev) => prev.filter((g) => !g.items.some((i) => removeIds.includes(i.id))))
    pushToast(`Merged ${removeIds.length} duplicate${removeIds.length === 1 ? '' : 's'}.`, 'success')
  }

  function handleDismissGroup(groupIndex: number) {
    setDupGroups((prev) => prev.filter((_, i) => i !== groupIndex))
    if (dupGroups.length <= 1) setDupModalOpen(false)
  }

  function handleDeleteSelected() {
    if (!selectedIds.length) return
    updateData((current) => ({
      ...current,
      contents: current.contents.filter((item) => !selectedSet.has(item.id)),
    }))
    setSelectedIds([])
    pushToast('Selected items deleted.', 'info')
  }

  return (
    <div className={`space-y-6 ${selectedIds.length ? 'pb-28' : ''}`}>
      <section className="panel-elevated flex flex-col gap-4 px-6 py-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Your Items</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            {allItems.length} item{allItems.length === 1 ? '' : 's'} · {formatCurrency(totalValue)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {allItems.length > 1 && (
            <button className="button-secondary" onClick={handleFindDuplicates} type="button">
              Find Duplicates
            </button>
          )}
          <details className="relative">
            <summary className="button-secondary list-none">More Actions</summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[color:var(--border)] bg-slate-950 p-2 shadow-xl">
              <button className="button-secondary w-full justify-start px-3 py-2 text-xs" onClick={() => void handleBatchEnrich(false)} type="button">
                Enrich Unenriched
              </button>
              <button className="button-secondary mt-2 w-full justify-start px-3 py-2 text-xs" onClick={() => void handleBatchEnrich(true)} type="button">
                Justify All Prices
              </button>
              <button
                className="button-secondary mt-2 w-full justify-start px-3 py-2 text-xs"
                onClick={() => {
                  try {
                    generateContentsChecklistPDF(data, 'download')
                    pushToast('Contents checklist PDF downloaded.', 'success')
                  } catch (error) {
                    pushToast(error instanceof Error ? error.message : 'PDF generation failed.', 'error')
                  }
                }}
                type="button"
              >
                Download Checklist
              </button>
              <button
                className="button-secondary mt-2 w-full justify-start px-3 py-2 text-xs"
                onClick={() => {
                  try {
                    generateContentsChecklistPDF(data, 'print')
                  } catch (error) {
                    pushToast(error instanceof Error ? error.message : 'Print preparation failed.', 'error')
                  }
                }}
                type="button"
              >
                Print Checklist
              </button>
            </div>
          </details>

          <button
            className="button-primary"
            onClick={() => {
              setEditingItem(null)
              setIsModalOpen(true)
            }}
            type="button"
          >
            Add Item
          </button>
        </div>
      </section>

      <ContentsSummary totalItems={includedItems.length} totalValue={totalValue} />

      <BulkActions
        allVisibleSelected={allVisibleSelected}
        onDeleteSelected={handleDeleteSelected}
        onDeselectAll={() => setSelectedIds([])}
        onSelectAll={() => setSelectedIds(visibleIds)}
        onSetContaminated={(value) => {
          patchItems((item) => ({ ...item, contaminated: value }))
          pushToast(value ? 'Selected items marked contaminated.' : 'Contamination cleared for selected items.', 'success')
        }}
        onSetDisposition={(value) => {
          patchItems((item) => ({ ...item, disposition: value }))
          pushToast(`Selected items set to ${value}.`, 'success')
        }}
        selectedCount={selectedIds.length}
      />

      <section className="panel px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row">
            <input
              className="field"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
              placeholder="Search name, room, category, or rationale"
              value={search}
            />
            <select className="field max-w-56" onChange={(event) => setSort(event.target.value)} value={sort}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-400">{filteredItems.length} visible item{filteredItems.length === 1 ? '' : 's'}</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedItems.length ? (
            paginatedItems.map((item) => (
              <ContentCard
                item={item}
                key={item.id}
                onDelete={() => setDeleteTarget(item)}
                onEdit={() => {
                  setEditingItem(item)
                  setIsModalOpen(true)
                }}
                onEnrich={() => setEnrichTargetId(item.id)}
                onSelect={(checked) =>
                  setSelectedIds((current) => (checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id)))
                }
                photoUrl={getItemPhotoUrl(item, aiPhotos)}
                selected={selectedSet.has(item.id)}
              />
            ))
          ) : (
            <div className="col-span-full py-10 text-center text-sm text-slate-400">No contents items match the current search.</div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              className="button-secondary px-3 py-1.5 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              ← Previous
            </button>
            <span className="text-sm text-slate-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              className="button-secondary px-3 py-1.5 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Next →
            </button>
          </div>
        ) : null}
      </section>

      <ContentModal
        item={editingItem}
        onClose={() => setIsModalOpen(false)}
        onSave={(item) => {
          updateData((current) => {
            const normalized = {
              ...updateContentLineTotal(item),
              replacementCost: Number(item.unitPrice || item.replacementCost || 0),
              disposition: normalizeDisposition(item.disposition),
            }
            const index = current.contents.findIndex((entry) => entry.id === normalized.id)
            const contents =
              index >= 0
                ? [...current.contents.slice(0, index), normalized, ...current.contents.slice(index + 1)]
                : [...current.contents, normalized]
            return { ...current, contents }
          })
          setIsModalOpen(false)
          pushToast(editingItem ? 'Contents item updated.' : 'Contents item added.', 'success')
        }}
        open={isModalOpen}
        rooms={data.rooms}
      />

      <EnrichModal
        item={enrichTarget}
        onApply={() => {
          pushToast('Enrichment applied to item.', 'success')
          setEnrichTargetId(null)
        }}
        onClose={() => setEnrichTargetId(null)}
        onReject={() => {
          setEnrichTargetId(null)
          pushToast('Enrichment review closed without changes.', 'info')
        }}
        onRunEnrich={async () => {
          if (!enrichTarget) return
          try {
            await runEnrichment(enrichTarget, false)
            pushToast('Revised estimate loaded.', 'success')
          } catch (error) {
            pushToast(error instanceof Error ? error.message : 'Enrichment failed.', 'error')
          }
        }}
        onRunJustify={async () => {
          if (!enrichTarget) return
          try {
            await runEnrichment(enrichTarget, true)
            pushToast('Price justification loaded.', 'success')
          } catch (error) {
            pushToast(error instanceof Error ? error.message : 'Justification failed.', 'error')
          }
        }}
        onUndo={() => {
          if (!enrichTarget) return
          patchOne(enrichTarget.id, (item) => undoEnrichment(item))
          pushToast('Enrichment reverted.', 'info')
        }}
        open={Boolean(enrichTarget)}
      />

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <button className="button-secondary" onClick={() => setDeleteTarget(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              onClick={() => {
                if (!deleteTarget) return
                updateData((current) => ({
                  ...current,
                  contents: current.contents.filter((item) => item.id !== deleteTarget.id),
                }))
                setDeleteTarget(null)
                pushToast('Contents item deleted.', 'info')
              }}
              type="button"
            >
              Delete
            </button>
          </div>
        }
        onClose={() => setDeleteTarget(null)}
        open={Boolean(deleteTarget)}
        title="Delete item"
      >
        <p className="text-sm leading-7 text-slate-300">
          Delete <span className="font-semibold text-white">{deleteTarget?.itemName || 'this item'}</span>? This removes it from the inventory.
        </p>
      </Modal>

      <DuplicateMergeModal
        open={dupModalOpen}
        groups={dupGroups}
        aiPhotos={data.aiPhotos || []}
        onMerge={handleMergeItems}
        onDismissGroup={handleDismissGroup}
        onClose={() => { setDupModalOpen(false); setDupGroups([]) }}
      />
    </div>
  )
}
