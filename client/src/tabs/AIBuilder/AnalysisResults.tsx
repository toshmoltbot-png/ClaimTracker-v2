import { formatCurrency } from '@/lib/claimWorkflow'
import type { AIDetectedItem } from '@/types/claim'

interface AnalysisResultsProps {
  sceneSummary?: string
  items: AIDetectedItem[]
  onAddToContents: () => void
}

export function AnalysisResults({ sceneSummary, items, onAddToContents }: AnalysisResultsProps) {
  if (!sceneSummary && !items.length) return null

  return (
    <section className="rounded-3xl border border-[color:var(--border)] bg-slate-950/30 px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Analysis Results</p>
          {sceneSummary ? <p className="mt-2 text-sm leading-7 text-slate-300">{sceneSummary}</p> : null}
        </div>
        <button className="button-secondary" onClick={onAddToContents} type="button">
          Add to Contents
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/50 px-4 py-4" key={`${item.label || item.name || 'item'}-${index}`}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-base font-semibold text-white">{item.label || item.name || 'Unnamed item'}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {item.roomAssignment || 'Unassigned room'} · Qty {item.quantity || 1} · {item.category || 'Other'}
                </p>
              </div>
              <p className="text-sm font-medium text-slate-200">{formatCurrency(Number(item.replacementPrice || item.estimatedValue || 0))}</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
                Contamination: {item.contaminationAssessment || 'Needs review'}
              </div>
              <div className="rounded-2xl bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
                Disposition: {String(item.likelyDisposition || 'pending')}
              </div>
              <div className="rounded-2xl bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
                Confidence: {Math.round(Number(item.confidence || 0) * 100)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
