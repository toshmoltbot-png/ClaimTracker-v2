import { ChatInterface } from '@/tabs/Maximizer/ChatInterface'

export function Maximizer() {
  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Standalone Route</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Maximizer</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          The chat shell and API client are ready. Claim-aware prompting and metrics wiring will be added in Phase 3.
        </p>
      </section>
      <ChatInterface />
    </div>
  )
}
