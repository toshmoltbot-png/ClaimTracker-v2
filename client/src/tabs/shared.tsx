import { EmptyState } from '@/components/shared/EmptyState'

interface PlaceholderTabProps {
  title: string
  summary: string
}

export function PlaceholderTab({ title, summary }: PlaceholderTabProps) {
  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Phase 1 Scaffold</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{summary}</p>
      </section>
      <EmptyState title={`${title} is scaffolded`} body="The feature-specific implementation work for this area begins in later phases. This placeholder keeps routing, layout, and compile coverage intact." />
    </div>
  )
}
