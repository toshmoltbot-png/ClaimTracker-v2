import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Modal } from '@/components/shared/Modal'
import { buildTimelineEvents, TIMELINE_CATEGORY_OPTIONS } from '@/lib/claimWorkflow'
import { fmtUSDate } from '@/lib/dates'
import { upsertById } from '@/lib/utils'
import { useClaimStore } from '@/store/claimStore'
import type { TimelineEvent } from '@/types/claim'

const CATEGORY_STYLES: Record<string, string> = {
  Incident: 'bg-rose-400/15 text-rose-200 border-rose-400/20',
  Insurance: 'bg-sky-400/15 text-sky-200 border-sky-400/20',
  Remediation: 'bg-amber-400/15 text-amber-100 border-amber-400/20',
  Repair: 'bg-emerald-400/15 text-emerald-100 border-emerald-400/20',
  Legal: 'bg-fuchsia-400/15 text-fuchsia-100 border-fuchsia-400/20',
  Other: 'bg-slate-400/15 text-slate-200 border-slate-400/20',
}

function EventModal({
  open,
  event,
  onClose,
  onSave,
}: {
  open: boolean
  event: TimelineEvent | null
  onClose: () => void
  onSave: (event: TimelineEvent) => void
}) {
  const [draft, setDraft] = useState<TimelineEvent>(event || { id: crypto.randomUUID(), date: '', title: '', description: '', category: 'Other' })

  useEffect(() => {
    setDraft(event || { id: crypto.randomUUID(), date: '', title: '', description: '', category: 'Other' })
  }, [event, open])

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => onSave(draft)} type="button">
            Save Event
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={event ? 'Edit Timeline Event' : 'Add Timeline Event'}
    >
      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Date</span>
          <input className="field" onChange={(entry) => setDraft((current) => ({ ...current, date: entry.target.value }))} type="date" value={draft.date || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Category</span>
          <select className="field" onChange={(entry) => setDraft((current) => ({ ...current, category: entry.target.value }))} value={draft.category || 'Other'}>
            {TIMELINE_CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Event</span>
          <input className="field" onChange={(entry) => setDraft((current) => ({ ...current, title: entry.target.value, event: entry.target.value }))} value={draft.title || draft.event || ''} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Description</span>
          <textarea className="field min-h-28" onChange={(entry) => setDraft((current) => ({ ...current, description: entry.target.value }))} value={draft.description || ''} />
        </label>
      </div>
    </Modal>
  )
}

export function Timeline() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const events = useMemo(() => buildTimelineEvents(data), [data])

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Incident Timeline</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Visual chronology of the claim</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Auto-populated from date of loss, communications, contractors, expenses, and payments, with manual events layered on top.
            </p>
          </div>
          <button
            className="button-primary"
            onClick={() => {
              setEditingEvent(null)
              setModalOpen(true)
            }}
            type="button"
          >
            Add Event
          </button>
        </div>
      </section>

      {events.length ? (
        <section className="panel px-6 py-6">
          <div className="relative pl-8">
            <div className="absolute bottom-0 left-3 top-0 w-px bg-white/10" />
            <div className="space-y-6">
              {events.map((event) => (
                <article className="relative" key={event.id}>
                  <div className="absolute -left-[31px] top-2 h-4 w-4 rounded-full border border-sky-300/60 bg-slate-950" />
                  <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/35 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-400">{fmtUSDate(event.date)}</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{event.title || event.event || 'Event'}</h3>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${CATEGORY_STYLES[event.category || 'Other'] || CATEGORY_STYLES.Other}`}>
                        {event.category || 'Other'}
                      </span>
                    </div>
                    {event.description ? <p className="mt-3 text-sm leading-7 text-slate-300">{event.description}</p> : null}
                    {(data.timeline || []).some((item) => String(item.id) === String(event.id)) ? (
                      <div className="mt-4">
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setEditingEvent(event)
                            setModalOpen(true)
                          }}
                          type="button"
                        >
                          Edit Manual Event
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : <EmptyState body="Timeline events will appear automatically as you enter claim data, or you can add one manually now." title="No Timeline Events Yet" />}

      <EventModal
        event={editingEvent}
        onClose={() => {
          setModalOpen(false)
          setEditingEvent(null)
        }}
        onSave={(event) => {
          updateData((current) => ({
            ...current,
            timeline: upsertById(current.timeline || [], {
              ...event,
              title: event.title || event.event || 'Event',
              event: event.title || event.event || 'Event',
            }),
          }))
          setModalOpen(false)
          setEditingEvent(null)
        }}
        open={modalOpen}
      />
    </div>
  )
}
