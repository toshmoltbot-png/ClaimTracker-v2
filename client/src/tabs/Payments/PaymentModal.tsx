import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { createPaymentDraft, normalizePaymentDraft, PAYMENT_COVERAGE_TYPE_OPTIONS, PAYMENT_TYPE_OPTIONS } from '@/lib/claimWorkflow'
import type { Payment } from '@/types/claim'

interface PaymentModalProps {
  open: boolean
  payment: Payment | null
  onClose: () => void
  onSave: (payment: Payment) => void
}

export function PaymentModal({ open, payment, onClose, onSave }: PaymentModalProps) {
  const [draft, setDraft] = useState<Payment>(createPaymentDraft())

  useEffect(() => {
    setDraft(payment || createPaymentDraft())
  }, [payment, open])

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => onSave(normalizePaymentDraft(draft))} type="button">
            Save Payment
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={payment ? 'Edit Payment' : 'Add Payment'}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Date</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} type="date" value={draft.date || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Payer</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, payer: event.target.value, from: event.target.value }))} value={draft.payer || draft.from || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Amount</span>
          <MoneyInput min="0" onChange={(event) => setDraft((current) => ({ ...current, amount: Number((event.target as HTMLInputElement).value || 0) }))} step="0.01" value={draft.amount || 0} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Type</span>
          <select className="field" onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} value={draft.type || 'advance'}>
            {PAYMENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">What it covers</span>
          <select className="field" onChange={(event) => setDraft((current) => ({ ...current, coverageType: event.target.value }))} value={draft.coverageType || ''}>
            <option value="">Select...</option>
            {PAYMENT_COVERAGE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Check # / Confirmation</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, checkNumber: event.target.value }))} value={draft.checkNumber || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Depreciation holdback</span>
          <MoneyInput min="0" step="0.01" onChange={(event) => setDraft((current) => ({ ...current, depreciation: Number((event.target as HTMLInputElement).value || 0) }))} value={draft.depreciation || ''} />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-200">Notes</span>
          <textarea className="field min-h-20" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value, description: event.target.value }))} value={draft.notes || draft.description || ''} />
        </label>
      </div>
    </Modal>
  )
}
