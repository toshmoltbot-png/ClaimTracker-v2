import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { MoneyInput } from '@/components/shared/MoneyInput'
import {
  COMMUNICATION_PARTY_OPTIONS,
  COMMUNICATION_TYPE_OPTIONS,
  createCommunicationDraft,
  normalizeCommunicationDraft,
} from '@/lib/claimWorkflow'
import type { Communication } from '@/types/claim'

interface CommunicationModalProps {
  open: boolean
  communication: Communication | null
  onClose: () => void
  onSave: (communication: Communication) => void
}

export function CommunicationModal({ open, communication, onClose, onSave }: CommunicationModalProps) {
  const [draft, setDraft] = useState<Communication>(createCommunicationDraft())

  useEffect(() => {
    setDraft(communication || createCommunicationDraft())
  }, [communication, open])

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => onSave(normalizeCommunicationDraft(draft))} type="button">
            Save Communication
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={communication ? 'Edit Communication' : 'Add Communication'}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Date</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} type="date" value={draft.date || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Type</span>
          <select className="field" onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} value={draft.type || 'phone'}>
            {COMMUNICATION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Party</span>
          <select className="field" onChange={(event) => setDraft((current) => ({ ...current, party: event.target.value }))} value={draft.party || 'adjuster'}>
            {COMMUNICATION_PARTY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">With whom</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, person: event.target.value, contactPerson: event.target.value }))} value={draft.person || draft.contactPerson || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Contact phone/email</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, commContact: event.target.value }))} placeholder="(555) 123-4567 or email" value={draft.commContact || ''} />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-200">Summary</span>
          <textarea className="field min-h-28" onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} value={draft.summary || ''} />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-3">
          <input checked={Boolean(draft.promiseMade)} onChange={(event) => setDraft((current) => ({ ...current, promiseMade: event.target.checked }))} type="checkbox" />
          <span className="text-sm text-slate-200">Promise was made</span>
        </label>
        {draft.promiseMade ? (
          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-3">
            <input checked={Boolean(draft.promiseFulfilled)} onChange={(event) => setDraft((current) => ({ ...current, promiseFulfilled: event.target.checked }))} type="checkbox" />
            <span className="text-sm text-slate-200">Promise fulfilled</span>
          </label>
        ) : null}
        {draft.promiseMade ? (
          <>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Promised amount</span>
              <MoneyInput min="0" step="0.01" onChange={(event) => setDraft((current) => ({ ...current, promisedAmount: Number((event.target as HTMLInputElement).value) || 0 }))} value={draft.promisedAmount || ''} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Promised by date</span>
              <input className="field" type="date" onChange={(event) => setDraft((current) => ({ ...current, promisedByDate: event.target.value }))} value={draft.promisedByDate || ''} />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-200">Commitments / promises</span>
              <textarea className="field min-h-20" onChange={(event) => setDraft((current) => ({ ...current, commitments: event.target.value }))} placeholder="What was promised..." value={draft.commitments || ''} />
            </label>
          </>
        ) : null}
        <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-3 md:col-span-2">
          <input
            checked={Boolean(draft.followUpRequired)}
            onChange={(event) => setDraft((current) => ({ ...current, followUpRequired: event.target.checked }))}
            type="checkbox"
          />
          <span className="text-sm text-slate-200">Follow-up required</span>
        </label>
        {draft.followUpRequired ? (
          <>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Follow-up date</span>
              <input className="field" onChange={(event) => setDraft((current) => ({ ...current, followUpDate: event.target.value }))} type="date" value={draft.followUpDate || ''} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Task</span>
              <input className="field" onChange={(event) => setDraft((current) => ({ ...current, followUpTask: event.target.value }))} value={draft.followUpTask || ''} />
            </label>
          </>
        ) : null}
      </div>
    </Modal>
  )
}
