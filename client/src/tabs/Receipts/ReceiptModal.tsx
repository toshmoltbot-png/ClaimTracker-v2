import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { getReceiptItems, normalizeReceiptItem } from '@/lib/claimWorkflow'
import type { Receipt } from '@/types/claim'

interface ReceiptModalProps {
  open: boolean
  receipt: Receipt | null
  onClose: () => void
  onSave: (receipt: Receipt) => void
}

function createDraft(receipt: Receipt | null): Receipt {
  return {
    ...(receipt || { id: crypto.randomUUID(), items: [], lineItems: [] }),
    items: receipt ? getReceiptItems(receipt) : [],
    lineItems: receipt ? getReceiptItems(receipt) : [],
  }
}

export function ReceiptModal({ open, receipt, onClose, onSave }: ReceiptModalProps) {
  const [draft, setDraft] = useState<Receipt>(createDraft(receipt))

  useEffect(() => {
    setDraft(createDraft(receipt))
  }, [receipt])

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => onSave({ ...draft, items: draft.items || [], lineItems: draft.items || [] })} type="button">
            Save Receipt
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title="Edit Receipt"
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-slate-300">Store</span>
            <input className="field" onChange={(event) => setDraft((current) => ({ ...current, store: event.target.value }))} value={draft.store || ''} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-slate-300">Date</span>
            <input className="field" onChange={(event) => setDraft((current) => ({ ...current, purchaseDate: event.target.value, date: event.target.value }))} value={draft.purchaseDate || draft.date || ''} />
          </label>
        </div>
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Total</span>
          <input
            className="field"
            min="0"
            onChange={(event) => setDraft((current) => ({ ...current, receiptTotal: Number(event.target.value) || 0 }))}
            step="0.01"
            type="number"
            value={draft.receiptTotal || 0}
          />
        </label>
        <div className="space-y-3">
          {(draft.items || []).map((item, index) => (
            <div className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/40 p-4 sm:grid-cols-5" key={`${item.name || item.description || 'item'}-${index}`}>
              <input
                className="field sm:col-span-2"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: (current.items || []).map((entry, entryIndex) => (entryIndex === index ? normalizeReceiptItem({ ...entry, name: event.target.value }) : entry)),
                  }))
                }
                placeholder="Item"
                value={item.name || item.description || ''}
              />
              <input
                className="field"
                min="1"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: (current.items || []).map((entry, entryIndex) => (entryIndex === index ? normalizeReceiptItem({ ...entry, quantity: Number(event.target.value) || 1 }) : entry)),
                  }))
                }
                type="number"
                value={item.quantity || 1}
              />
              <input
                className="field"
                min="0"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    items: (current.items || []).map((entry, entryIndex) => (entryIndex === index ? normalizeReceiptItem({ ...entry, unitPrice: Number(event.target.value) || 0 }) : entry)),
                  }))
                }
                step="0.01"
                type="number"
                value={item.unitPrice || 0}
              />
              <div className="flex gap-2">
                <input
                  className="field"
                  min="0"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      items: (current.items || []).map((entry, entryIndex) => (entryIndex === index ? normalizeReceiptItem({ ...entry, totalPrice: Number(event.target.value) || 0 }) : entry)),
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={item.totalPrice || 0}
                />
                <button
                  className="button-secondary"
                  onClick={() => setDraft((current) => ({ ...current, items: (current.items || []).filter((_, entryIndex) => entryIndex !== index) }))}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            className="button-secondary"
            onClick={() => setDraft((current) => ({ ...current, items: [...(current.items || []), normalizeReceiptItem({})] }))}
            type="button"
          >
            Add Line Item
          </button>
        </div>
      </div>
    </Modal>
  )
}
