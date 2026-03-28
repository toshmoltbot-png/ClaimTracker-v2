import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import {
  calcExpenseDays,
  createExpenseEntryDraft,
  EXPENSE_CATEGORY_OPTIONS,
  formatCurrency,
  updateExpenseLineTotal,
} from '@/lib/claimWorkflow'
import type { ExpenseEntry } from '@/types/claim'

interface ExpenseModalProps {
  open: boolean
  expense: ExpenseEntry | null
  onClose: () => void
  onSave: (expense: ExpenseEntry) => void
}

function createDraft(expense: ExpenseEntry | null) {
  return updateExpenseLineTotal(expense || createExpenseEntryDraft())
}

export function ExpenseModal({ open, expense, onClose, onSave }: ExpenseModalProps) {
  const [draft, setDraft] = useState<ExpenseEntry>(createDraft(expense))

  useEffect(() => {
    setDraft(createDraft(expense))
  }, [expense, open])

  const category = String(draft.category || 'Lodging')
  const isUtility = category === 'Utilities'
  const isLabor = category === 'Emergency Mitigation - Cleanup'
  const isDisposal = category === 'Disposal'
  const usesDateRange = isUtility || ['Lodging', 'Food', 'Transportation', 'Storage', 'Laundry', 'Pet Care'].includes(category)
  const totalDays = calcExpenseDays(draft.dateStart, draft.dateEnd)
  const normalized = useMemo(() => updateExpenseLineTotal(draft), [draft])

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => onSave(normalized)} type="button">
            Save Expense
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={expense ? 'Edit Expense' : 'Add Expense'}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Category</span>
            <select
              className="field"
              onChange={(event) => {
                const next = createExpenseEntryDraft(event.target.value)
                setDraft((current) => updateExpenseLineTotal({ ...next, id: current.id }))
              }}
              value={category}
            >
              {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">{isLabor ? 'Who did the work?' : 'Vendor'}</span>
            <input className="field" onChange={(event) => setDraft((current) => ({ ...current, vendor: event.target.value }))} placeholder={isLabor ? 'e.g. Rich Archer, family member' : ''} value={draft.vendor || ''} />
          </label>

          {!usesDateRange ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Date</span>
              <input className="field" onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} type="date" value={draft.date || ''} />
            </label>
          ) : null}

          {usesDateRange ? (
            <>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Start date</span>
                <input
                  className="field"
                  onChange={(event) => setDraft((current) => updateExpenseLineTotal({ ...current, dateStart: event.target.value }))}
                  type="date"
                  value={draft.dateStart || ''}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">End date</span>
                <input
                  className="field"
                  onChange={(event) => setDraft((current) => updateExpenseLineTotal({ ...current, dateEnd: event.target.value }))}
                  type="date"
                  value={draft.dateEnd || ''}
                />
              </label>
            </>
          ) : null}

          {isUtility ? (
            <>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Utility</span>
                <select className="field" onChange={(event) => setDraft((current) => ({ ...current, utilityType: event.target.value }))} value={draft.utilityType || 'Heat'}>
                  {['Heat', 'Electric', 'Water', 'Gas', 'HVAC'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Daily increase</span>
                <input
                  className="field"
                  min="0"
                  onChange={(event) => setDraft((current) => updateExpenseLineTotal({ ...current, dailyCostIncrease: Number(event.target.value || 0) }))}
                  step="0.01"
                  type="number"
                  value={draft.dailyCostIncrease || 0}
                />
              </label>
            </>
          ) : null}

          {isLabor ? (
            <>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Hours</span>
                <input
                  className="field"
                  min="0"
                  onChange={(event) => setDraft((current) => updateExpenseLineTotal({ ...current, hours: Number(event.target.value || 0) }))}
                  step="0.25"
                  type="number"
                  value={draft.hours || 0}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Hourly rate</span>
                <input
                  className="field"
                  min="0"
                  onChange={(event) => setDraft((current) => updateExpenseLineTotal({ ...current, hourlyRate: Number(event.target.value || 0) }))}
                  step="0.01"
                  type="number"
                  value={draft.hourlyRate || 0}
                />
              </label>
            </>
          ) : null}

          {!isUtility && !isLabor ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">{isDisposal ? 'Amount' : 'Daily cost / fallback amount'}</span>
              <input
                className="field"
                min="0"
                onChange={(event) =>
                  setDraft((current) =>
                    updateExpenseLineTotal({
                      ...current,
                      amount: Number(event.target.value || 0),
                      dailyCost: Number(event.target.value || 0),
                    }))
                }
                step="0.01"
                type="number"
                value={draft.amount || draft.dailyCost || 0}
              />
            </label>
          ) : null}

          {usesDateRange ? (
            <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
              Day count: <span className="font-semibold">{totalDays}</span>
            </div>
          ) : null}

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-200">Description</span>
            <textarea className="field min-h-24" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description || ''} />
          </label>

          {isLabor ? (
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-200">Justification</span>
              <textarea
                className="field min-h-20"
                onChange={(event) => setDraft((current) => ({ ...current, justification: event.target.value }))}
                placeholder="Why this labor was necessary (e.g. mitigation of further contamination per IICRC S500)"
                value={draft.justification || ''}
              />
            </label>
          ) : null}
        </div>

        {!isLabor && !isUtility && !isDisposal ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Line Items</h3>
                <p className="text-xs text-slate-400">Use line items for hotel nights, meals, rides, storage, and similar ALE details.</p>
              </div>
              <button
                className="button-secondary"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    lineItems: [...(current.lineItems || []), { id: crypto.randomUUID(), description: '', amount: 0 }],
                  }))
                }
                type="button"
              >
                Add Line
              </button>
            </div>
            {(draft.lineItems || []).map((line, index) => (
              <div className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/40 p-4 sm:grid-cols-[1fr_140px_auto]" key={line.id || index}>
                <input
                  className="field"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      lineItems: (current.lineItems || []).map((entry, entryIndex) => (
                        entryIndex === index ? { ...entry, description: event.target.value } : entry
                      )),
                    }))
                  }
                  placeholder="Description"
                  value={line.description || ''}
                />
                <input
                  className="field"
                  min="0"
                  onChange={(event) =>
                    setDraft((current) =>
                      updateExpenseLineTotal({
                        ...current,
                        lineItems: (current.lineItems || []).map((entry, entryIndex) => (
                          entryIndex === index ? { ...entry, amount: Number(event.target.value || 0) } : entry
                        )),
                      }))
                  }
                  step="0.01"
                  type="number"
                  value={line.amount || 0}
                />
                <button
                  className="button-secondary"
                  onClick={() =>
                    setDraft((current) =>
                      updateExpenseLineTotal({
                        ...current,
                        lineItems: (current.lineItems || []).filter((_, entryIndex) => entryIndex !== index),
                      }))
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Total</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(Number(normalized.amount || 0))}</p>
            </div>
            {usesDateRange ? <p className="text-sm text-emerald-100">{totalDays} covered day{totalDays === 1 ? '' : 's'}</p> : null}
          </div>
        </div>
      </div>
    </Modal>
  )
}
