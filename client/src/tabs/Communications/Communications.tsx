import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { normalizeCommunicationDraft, toggleFollowUpTask } from '@/lib/claimWorkflow'
import { fmtUSDate } from '@/lib/dates'
import { upsertById } from '@/lib/utils'
import { useClaimStore } from '@/store/claimStore'
import type { Communication } from '@/types/claim'
import { CommunicationModal } from '@/tabs/Communications/CommunicationModal'
import { EmailDraftModal } from '@/tabs/Communications/EmailDraftModal'

function CommunicationCard({
  communication,
  onEdit,
  onDraft,
  onDelete,
}: {
  communication: Communication
  onEdit: () => void
  onDraft: () => void
  onDelete: () => void
}) {
  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-slate-950/35 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-sky-300">{communication.type}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{communication.person || communication.contactPerson || 'Unknown contact'}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {fmtUSDate(communication.date)} · {communication.party}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="button-secondary" onClick={onDraft} type="button">
            Draft Email
          </button>
          <button className="button-secondary" onClick={onEdit} type="button">
            Edit
          </button>
          <button className="button-secondary text-rose-400 hover:text-rose-300" onClick={onDelete} type="button">
            Delete
          </button>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-300">{communication.summary || 'No summary entered.'}</p>
      {communication.followUpRequired ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
          Follow-up: {[communication.followUpTask, communication.followUpDate ? fmtUSDate(communication.followUpDate) : ''].filter(Boolean).join(' · ')}
        </div>
      ) : null}
    </article>
  )
}

export function Communications() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const [editingCommunication, setEditingCommunication] = useState<Communication | null>(null)
  const [emailCommunication, setEmailCommunication] = useState<Communication | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const communications = useMemo(
    () => [...data.communications].sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime()),
    [data.communications],
  )
  const followUpTasks = useMemo(
    () => (data.followUpTasks || []).filter((task) => String((task as { status?: string }).status || 'open') === 'open'),
    [data.followUpTasks],
  )

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Communication Log</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Claim conversations, promises, and follow-up</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Track each call, email, letter, or in-person conversation, then turn the entry into an editable draft email when you need written follow-up.
            </p>
          </div>
          <button
            className="button-primary"
            onClick={() => {
              setEditingCommunication(null)
              setModalOpen(true)
            }}
            type="button"
          >
            Add Entry
          </button>
        </div>
      </section>

      {followUpTasks.length ? (
        <section className="panel px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-300">AI Follow-Ups</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Open task prompts</h3>
            </div>
            <p className="text-sm text-slate-400">{followUpTasks.length} open</p>
          </div>
          <div className="mt-4 space-y-3">
            {followUpTasks.map((task) => (
              <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-slate-950/35 px-4 py-3" key={String((task as { id?: string }).id || '')}>
                <div>
                  <p className="text-sm font-medium text-white">{String((task as { prompt?: string }).prompt || 'Follow-up')}</p>
                  <p className="text-xs text-slate-400">Room: {String((task as { roomId?: string }).roomId || 'Unknown')}</p>
                </div>
                <button
                  className="button-secondary"
                  onClick={() => updateData((current) => toggleFollowUpTask(current, String((task as { id?: string }).id || '')))}
                  type="button"
                >
                  Mark Done
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        {communications.length ? communications.map((communication) => (
          <CommunicationCard
            communication={communication}
            key={communication.id}
            onDelete={() => updateData((current) => ({
              ...current,
              communications: current.communications.filter((c) => String(c.id) !== String(communication.id)),
            }))}
            onDraft={() => setEmailCommunication(communication)}
            onEdit={() => {
              setEditingCommunication(communication)
              setModalOpen(true)
            }}
          />
        )) : <EmptyState body="Add the first claim communication to build the log and start drafting follow-up emails." title="No Communications Yet" />}
      </section>

      <CommunicationModal
        communication={editingCommunication}
        onClose={() => {
          setModalOpen(false)
          setEditingCommunication(null)
        }}
        onSave={(communication) => {
          updateData((current) => ({
            ...current,
            communications: upsertById(current.communications, normalizeCommunicationDraft(communication)),
          }))
          setModalOpen(false)
          setEditingCommunication(null)
        }}
        open={modalOpen}
      />

      <EmailDraftModal
        communication={emailCommunication}
        data={data}
        onClose={() => setEmailCommunication(null)}
        open={Boolean(emailCommunication)}
      />
    </div>
  )
}
