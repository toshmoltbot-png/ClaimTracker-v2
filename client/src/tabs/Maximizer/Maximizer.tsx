import { buildClaimSummary } from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { ChatInterface } from '@/tabs/Maximizer/ChatInterface'

export function Maximizer() {
  const data = useClaimStore((state) => state.data)
  const summary = buildClaimSummary(data)

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Maximizer</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Claim-aware strategy chat</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Ask about overlooked categories, negotiation angles, evidence gaps, or next steps. Each message includes the current claim summary and the active conversation history.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Claim</p>
            <p className="mt-2 text-sm text-slate-200">{String(summary.claimNumber || 'Unassigned')}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rooms</p>
            <p className="mt-2 text-sm text-slate-200">{summary.roomCount}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Inventory</p>
            <p className="mt-2 text-sm text-slate-200">{summary.contentCount} items</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Receipts</p>
            <p className="mt-2 text-sm text-slate-200">{summary.receiptCount}</p>
          </div>
        </div>
      </section>
      <ChatInterface />
    </div>
  )
}
