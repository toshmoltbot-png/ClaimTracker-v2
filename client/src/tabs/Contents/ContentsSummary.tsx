import { formatCurrency } from '@/lib/claimWorkflow'

interface ContentsSummaryProps {
  totalItems: number
  excludedCount: number
  totalValue: number
  enrichedCount: number
}

export function ContentsSummary({ totalItems, excludedCount, totalValue, enrichedCount }: ContentsSummaryProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="panel px-5 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Items</p>
        <p className="mt-3 text-2xl font-semibold text-white">{totalItems}</p>
        <p className="mt-2 text-sm text-slate-400">{excludedCount ? `${excludedCount} excluded from claim` : 'All active contents items included'}</p>
      </div>
      <div className="panel px-5 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Total Value</p>
        <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totalValue)}</p>
        <p className="mt-2 text-sm text-slate-400">Replacement cost total for included items</p>
      </div>
      <div className="panel px-5 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Enriched</p>
        <p className="mt-3 text-2xl font-semibold text-white">{enrichedCount}</p>
        <p className="mt-2 text-sm text-slate-400">Items with revised pricing support or justification</p>
      </div>
    </section>
  )
}
