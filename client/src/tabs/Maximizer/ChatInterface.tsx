export function ChatInterface() {
  return (
    <section className="panel grid gap-4 px-6 py-6">
      <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
        Maximizer conversation history will render here.
      </div>
      <textarea className="field min-h-32" placeholder="Ask for claim strategy, missing evidence, or negotiation prep..." />
      <div className="flex justify-end">
        <button className="button-primary" type="button">
          Send
        </button>
      </div>
    </section>
  )
}
