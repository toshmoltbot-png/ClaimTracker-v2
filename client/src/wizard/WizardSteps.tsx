import { useUIStore } from '@/store/uiStore'

const steps = [
  'Claim type',
  'Claim info',
  'Rooms',
  'Photos',
  'Pre-screen',
  'Floor plan',
  'Receipts',
  'Expenses',
  'AI review',
  'Done',
]

export function WizardSteps() {
  const wizard = useUIStore((state) => state.wizard)
  const setWizardStep = useUIStore((state) => state.setWizardStep)

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const active = wizard.step === stepNumber
        return (
          <button
            className={
              active
                ? 'flex w-full items-center justify-between rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-left text-white'
                : 'flex w-full items-center justify-between rounded-xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3 text-left text-slate-300'
            }
            key={step}
            onClick={() => setWizardStep(stepNumber)}
            type="button"
          >
            <span>{step}</span>
            <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Step {stepNumber}</span>
          </button>
        )
      })}
    </div>
  )
}
