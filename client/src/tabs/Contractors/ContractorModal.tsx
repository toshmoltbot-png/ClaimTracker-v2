import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { createContractorDraft, normalizeContractorDraft } from '@/lib/claimWorkflow'
import type { Contractor } from '@/types/claim'

interface ContractorModalProps {
  open: boolean
  contractor: Contractor | null
  onClose: () => void
  onSave: (contractor: Contractor) => void
}

export function ContractorModal({ open, contractor, onClose, onSave }: ContractorModalProps) {
  const [draft, setDraft] = useState<Contractor>(createContractorDraft())

  useEffect(() => {
    setDraft(contractor || createContractorDraft())
  }, [contractor, open])

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => onSave(normalizeContractorDraft(draft))} type="button">
            Save Contractor
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={contractor ? 'Edit Contractor' : 'Add Contractor'}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-200">Company name</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, company: event.target.value }))} value={draft.name || draft.company || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Contact</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value, contactName: event.target.value }))} value={draft.contact || draft.contactName || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Trade</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, trade: event.target.value }))} value={draft.trade || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Phone</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} value={draft.phone || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Email</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} type="email" value={draft.email || ''} />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-200">Notes</span>
          <textarea className="field min-h-28" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} value={draft.notes || ''} />
        </label>
      </div>
    </Modal>
  )
}
