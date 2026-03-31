import { formatCurrency } from '@/lib/claimWorkflow'

interface ContentsSummaryProps {
  totalItems: number
  totalValue: number
}

export function ContentsSummary({ totalItems, totalValue }: ContentsSummaryProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="panel px-5 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Items</p>
        <p className="mt-3 text-2xl font-semibold text-white">{totalItems}</p>
        <p className="mt-2 text-sm text-slate-400">Items currently in your claim inventory</p>
      </div>
      <div className="panel px-5 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Total Value</p>
        <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totalValue)}</p>
        <p className="mt-2 text-sm text-slate-400">Replacement cost total for included items</p>
      </div>
    </section>
  )
}
