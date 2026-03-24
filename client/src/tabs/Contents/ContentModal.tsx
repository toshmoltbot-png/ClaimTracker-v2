import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { CONTENT_CATEGORIES, DISPOSITION_OPTIONS, QUANTITY_UNITS, updateContentLineTotal } from '@/lib/claimWorkflow'
import type { ContentItem, Room } from '@/types/claim'

interface ContentModalProps {
  open: boolean
  item: ContentItem | null
  rooms: Room[]
  onClose: () => void
  onSave: (item: ContentItem) => void
}

function createDraft(item: ContentItem | null): ContentItem {
  return updateContentLineTotal(
    item || {
      id: crypto.randomUUID(),
      itemName: '',
      room: '',
      roomId: null,
      category: 'Other',
      quantity: 1,
      quantityUnit: 'each',
      unitPrice: 0,
      total: 0,
      replacementCost: 0,
      replacementLink: '',
      aiJustification: '',
      disposition: '',
      contaminated: false,
      includedInClaim: true,
      photos: [],
    },
  )
}

export function ContentModal({ open, item, rooms, onClose, onSave }: ContentModalProps) {
  const [draft, setDraft] = useState<ContentItem>(createDraft(item))

  useEffect(() => {
    setDraft(createDraft(item))
  }, [item, open])

  const roomValue = useMemo(() => String(draft.roomId || ''), [draft.roomId])

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => onSave(updateContentLineTotal(draft))} type="button">
            Save Item
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={item ? 'Edit Item' : 'Add Item'}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-200">Item name</span>
            <input className="field" onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))} value={draft.itemName || ''} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Room</span>
            <select
              className="field"
              onChange={(event) => {
                const selected = rooms.find((room) => room.id === event.target.value) || null
                setDraft((current) => ({
                  ...current,
                  roomId: selected?.id || null,
                  room: selected?.name || '',
                  location: selected?.name || '',
                }))
              }}
              value={roomValue}
            >
              <option value="">Unassigned</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name || 'Untitled room'}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Category</span>
            <select className="field" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} value={draft.category || 'Other'}>
              {CONTENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Quantity</span>
            <input
              className="field"
              min="1"
              onChange={(event) =>
                setDraft((current) => updateContentLineTotal({ ...current, quantity: Number(event.target.value || 1) }))
              }
              step="1"
              type="number"
              value={draft.quantity || 1}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Unit</span>
            <select className="field" onChange={(event) => setDraft((current) => ({ ...current, quantityUnit: event.target.value }))} value={draft.quantityUnit || 'each'}>
              {QUANTITY_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Unit price</span>
            <input
              className="field"
              min="0"
              onChange={(event) =>
                setDraft((current) => updateContentLineTotal({ ...current, unitPrice: Number(event.target.value || 0), replacementCost: Number(event.target.value || 0) }))
              }
              step="0.01"
              type="number"
              value={draft.unitPrice || 0}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Total</span>
            <input className="field" readOnly value={Number(draft.total || 0).toFixed(2)} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-200">Replacement link</span>
            <input className="field" onChange={(event) => setDraft((current) => ({ ...current, replacementLink: event.target.value }))} placeholder="https://…" value={draft.replacementLink || ''} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-200">AI rationale</span>
            <textarea className="field min-h-28" onChange={(event) => setDraft((current) => ({ ...current, aiJustification: event.target.value }))} value={draft.aiJustification || ''} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Disposition</span>
            <select className="field" onChange={(event) => setDraft((current) => ({ ...current, disposition: event.target.value }))} value={draft.disposition || ''}>
              <option value="">Not set</option>
              {DISPOSITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-3">
            <input checked={Boolean(draft.contaminated)} onChange={(event) => setDraft((current) => ({ ...current, contaminated: event.target.checked }))} type="checkbox" />
            <span className="text-sm text-slate-200">Contaminated</span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-3">
            <input
              checked={draft.includedInClaim !== false}
              onChange={(event) => setDraft((current) => ({ ...current, includedInClaim: event.target.checked }))}
              type="checkbox"
            />
            <span className="text-sm text-slate-200">Include in claim</span>
          </label>
        </div>
      </div>
    </Modal>
  )
}
