import { useMemo, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import {
  applyEnrichmentResponse,
  applyJustificationResponse,
  deduplicateDraftItemsBySourcePhotos,
  formatCurrency,
  generateContentsChecklistPDF,
  getItemTotalValue,
  normalizeDisposition,
  submitEnrichItem,
  undoEnrichment,
  updateContentLineTotal,
} from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { ContentItem as ContentItemType } from '@/types/claim'
import { BulkActions } from '@/tabs/Contents/BulkActions'
import { ContentItem } from '@/tabs/Contents/ContentItem'
import { ContentModal } from '@/tabs/Contents/ContentModal'
import { ContentsSummary } from '@/tabs/Contents/ContentsSummary'
import { EnrichModal } from '@/tabs/Contents/EnrichModal'

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

function isCardboardItem(item: ContentItemType) {
  const text = `${item.itemName || ''} ${item.category || ''}`.toLowerCase()
  return /cardboard|box|boxes|carton/.test(text)
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

  const allItems = useMemo(() => (data.contents || []).filter((item) => item.source !== 'receipt'), [data.contents])
  const includedItems = useMemo(() => allItems.filter((item) => item.includedInClaim !== false), [allItems])
  const excludedCount = allItems.length - includedItems.length
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allItems
      .filter((item) => {
        if (!needle) return true
        return [item.itemName, item.room, item.location, item.category, item.aiJustification].some((value) => String(value || '').toLowerCase().includes(needle))
      })
      .sort((a, b) => compareItems(a, b, sort))
  }, [allItems, search, sort])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id))
  const enrichTarget = useMemo(() => allItems.find((item) => item.id === enrichTargetId) || null, [allItems, enrichTargetId])
  const totalValue = useMemo(() => includedItems.reduce((sum, item) => sum + getItemTotalValue(item), 0), [includedItems])
  const enrichedCount = useMemo(() => includedItems.filter((item) => item.enrichment?.revised || item.enriched).length, [includedItems])

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

  return (
    <div className="space-y-6">
      <section className="panel-elevated flex flex-col gap-4 px-6 py-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Contents</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Claim inventory and pricing support</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            {allItems.length} item{allItems.length === 1 ? '' : 's'} tracked · {formatCurrency(totalValue)} included in claim
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="button-secondary" onClick={() => void handleBatchEnrich(false)} type="button">
            Enrich Unenriched
          </button>
          <button className="button-secondary" onClick={() => void handleBatchEnrich(true)} type="button">
            Justify All Prices
          </button>
          <button
            className="button-secondary"
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
            className="button-secondary"
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

      <ContentsSummary enrichedCount={enrichedCount} excludedCount={excludedCount} totalItems={includedItems.length} totalValue={totalValue} />

      <BulkActions
        allVisibleSelected={allVisibleSelected}
        onDeselectAll={() => setSelectedIds([])}
        onMarkCardboardDiscard={() => {
          patchItems((item) => (isCardboardItem(item) ? { ...item, disposition: 'discarded' } : item))
          pushToast('Cardboard items marked discarded where matched.', 'success')
        }}
        onSelectAll={() => setSelectedIds(visibleIds)}
        onSetCategory={(category) => {
          patchItems((item) => ({ ...item, category }))
          pushToast(`Updated category to ${category}.`, 'success')
        }}
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
            <input className="field" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, room, category, or rationale" value={search} />
            <select className="field max-w-56" onChange={(event) => setSort(event.target.value)} value={sort}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-400">{filteredItems.length} visible row{filteredItems.length === 1 ? '' : 's'}</p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                <th className="px-4 pb-3">Select</th>
                <th className="px-4 pb-3">Name</th>
                <th className="px-4 pb-3">Room</th>
                <th className="px-4 pb-3">Category</th>
                <th className="px-4 pb-3">Qty</th>
                <th className="px-4 pb-3">Unit Price</th>
                <th className="px-4 pb-3">Total</th>
                <th className="px-4 pb-3">Disposition</th>
                <th className="px-4 pb-3">Status</th>
                <th className="px-4 pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length ? (
                filteredItems.map((item) => (
                  <ContentItem
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
                    selected={selectedSet.has(item.id)}
                  />
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-400" colSpan={10}>
                    No contents items match the current search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              index >= 0 ? [...current.contents.slice(0, index), normalized, ...current.contents.slice(index + 1)] : [...current.contents, normalized]
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
          Delete <span className="font-semibold text-white">{deleteTarget?.itemName || 'this item'}</span>? This removes it from the inventory table.
        </p>
      </Modal>
    </div>
  )
}
