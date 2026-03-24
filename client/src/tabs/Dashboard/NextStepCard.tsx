import type { NextStepSuggestion } from '@/lib/claimWorkflow'

interface NextStepCardProps {
  suggestion: NextStepSuggestion
  onAction: () => void
}

export function NextStepCard({ suggestion, onAction }: NextStepCardProps) {
  return (
    <section className="panel-elevated flex flex-col gap-4 px-6 py-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Next Step</p>
        <h3 className="mt-3 text-xl font-semibold text-white">{suggestion.title}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-300">{suggestion.description}</p>
      </div>
      <button className="button-primary w-full sm:w-auto" onClick={onAction} type="button">
        {suggestion.actionLabel}
      </button>
    </section>
  )
}
