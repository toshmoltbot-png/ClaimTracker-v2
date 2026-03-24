import { useState } from 'react'
import { formatPercent, type ReadinessCheck } from '@/lib/claimWorkflow'

interface ReadinessPanelProps {
  checks: ReadinessCheck[]
  readinessPercent: number
}

export function ReadinessPanel({ checks, readinessPercent }: ReadinessPanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <section className="panel px-6 py-6">
      <button className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setOpen((value) => !value)} type="button">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Readiness</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Claim package completeness</h3>
          <p className="mt-2 text-sm text-slate-400">{formatPercent(readinessPercent)} complete</p>
        </div>
        <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-slate-300">
          {open ? 'Collapse' : 'Expand'}
        </span>
      </button>
      {open ? (
        <div className="mt-5 space-y-3">
          {checks.map((check) => (
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-4" key={check.key}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{check.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{check.description}</p>
                </div>
                <span
                  className={
                    check.complete
                      ? 'rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300'
                      : 'rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-300'
                  }
                >
                  {check.complete ? 'Ready' : 'Needed'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
