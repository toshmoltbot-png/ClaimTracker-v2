import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { apiClient } from '@/lib/api'
import { buildClaimSummary, buildCommunicationEmailDraft } from '@/lib/claimWorkflow'
import type { ClaimData, Communication } from '@/types/claim'

interface EmailDraftModalProps {
  open: boolean
  data: ClaimData
  communication: Communication | null
  onClose: () => void
}

export function EmailDraftModal({ open, data, communication, onClose }: EmailDraftModalProps) {
  const fallback = buildCommunicationEmailDraft(data, communication)
  const [draft, setDraft] = useState(fallback)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDraft(buildCommunicationEmailDraft(data, communication))
  }, [communication, data, open])

  async function generateDraft() {
    setLoading(true)
    try {
      const response = await apiClient.maximizerChat({
        message: `Write a concise professional insurance claim follow-up email. Recipient: ${communication?.person || 'adjuster'}. Summary: ${communication?.summary || 'No summary provided.'} Follow-up: ${communication?.followUpTask || 'None specified.'}`,
        claimSummary: buildClaimSummary(data),
      })
      setDraft((current) => ({
        ...current,
        body: response.reply || current.body,
      }))
    } catch {
      setDraft(buildCommunicationEmailDraft(data, communication))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button className="button-secondary" onClick={() => void navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`)} type="button">
            Copy Draft
          </button>
          <button className="button-secondary" onClick={() => void generateDraft()} type="button">
            {loading ? 'Generating…' : 'Refresh Draft'}
          </button>
          <button className="button-primary" onClick={onClose} type="button">
            Close
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title="Email Draft"
    >
      <div className="space-y-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">To</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} value={draft.to} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Subject</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} value={draft.subject} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Body</span>
          <textarea className="field min-h-72" onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} value={draft.body} />
        </label>
      </div>
    </Modal>
  )
}
