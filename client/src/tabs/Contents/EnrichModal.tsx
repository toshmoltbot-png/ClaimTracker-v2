import { useMemo, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { buildEbayCompsMarkup, buildEnrichmentAuditMarkup, formatCurrency, getItemTotalValue } from '@/lib/claimWorkflow'
import type { ContentItem } from '@/types/claim'

interface EnrichModalProps {
  open: boolean
  item: ContentItem | null
  onClose: () => void
  onRunEnrich: () => Promise<void>
  onRunJustify: () => Promise<void>
  onApply: () => void
  onReject: () => void
  onUndo: () => void
}

export function EnrichModal({ open, item, onClose, onRunEnrich, onRunJustify, onApply, onReject, onUndo }: EnrichModalProps) {
  const [mode, setMode] = useState<'enrich' | 'justify'>('enrich')
  const [isRunning, setIsRunning] = useState(false)

  const comps = useMemo(() => buildEbayCompsMarkup(item?.enrichment), [item])
  const auditRows = useMemo(() => (item ? buildEnrichmentAuditMarkup(item) : []), [item])
  const revised = item?.enrichment?.revised || null

  async function handleRun(kind: 'enrich' | 'justify') {
    setMode(kind)
    setIsRunning(true)
    try {
      if (kind === 'justify') {
        await onRunJustify()
      } else {
        await onRunEnrich()
      }
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Modal
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button className="button-secondary" onClick={onReject} type="button">
            Reject
          </button>
          {revised ? (
            <button className="button-secondary" onClick={onUndo} type="button">
              Undo
            </button>
          ) : null}
          <button className="button-primary" disabled={!revised} onClick={onApply} type="button">
            Apply
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={item ? `Enrich ${item.itemName || 'Item'}` : 'Enrich Item'}
    >
      {item ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current</p>
              <p className="mt-3 text-lg font-semibold text-white">{item.itemName || 'Unnamed item'}</p>
              <p className="mt-2 text-sm text-slate-300">{formatCurrency(getItemTotalValue(item))}</p>
              <p className="mt-2 text-sm text-slate-400">{item.aiJustification || 'No rationale saved yet.'}</p>
            </div>
            <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200">{mode === 'justify' ? 'Justify My Price' : 'Enriched'}</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {String(revised?.identification || revised?.label || revised?.name || item.itemName || 'Awaiting enrichment')}
              </p>
              <p className="mt-2 text-sm text-slate-200">
                {revised?.value ? formatCurrency(Number(revised.value)) : 'Run enrichment to compare pricing'}
              </p>
              <p className="mt-2 text-sm text-slate-300">{String(revised?.justification || revised?.pricingBasis || 'No revised rationale yet.')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="button-primary" disabled={isRunning} onClick={() => void handleRun('enrich')} type="button">
              {isRunning && mode === 'enrich' ? 'Running…' : 'Get Revised Estimate'}
            </button>
            <button className="button-secondary" disabled={isRunning} onClick={() => void handleRun('justify')} type="button">
              {isRunning && mode === 'justify' ? 'Running…' : 'Justify My Price'}
            </button>
          </div>

          {comps.length ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-white">eBay comps</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {comps.map((comp) => (
                  <a
                    className="rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-4 transition hover:border-sky-400/40"
                    href={comp.url}
                    key={comp.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-sm font-semibold text-white">{comp.title}</p>
                    <p className="mt-2 text-sm text-slate-300">{comp.price}</p>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {auditRows.length ? (
            <section className="rounded-2xl border border-[color:var(--border)] bg-slate-950/20 px-4 py-4">
              <h3 className="text-sm font-semibold text-white">Audit trail</h3>
              <div className="mt-4 space-y-3">
                {auditRows.map((row) => (
                  <div className="flex items-start justify-between gap-4 border-t border-[color:var(--border)] pt-3 first:border-t-0 first:pt-0" key={row.label}>
                    <p className="text-sm text-slate-400">{row.label}</p>
                    <p className="max-w-sm text-right text-sm text-slate-200">{row.value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
