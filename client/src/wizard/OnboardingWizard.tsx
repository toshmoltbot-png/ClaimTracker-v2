import { WizardSteps } from '@/wizard/WizardSteps'
import { useUIStore } from '@/store/uiStore'

export function OnboardingWizard() {
  const wizard = useUIStore((state) => state.wizard)
  const setWizardOpen = useUIStore((state) => state.setWizardOpen)

  if (!wizard.open) return null

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 px-4 py-6 backdrop-blur-sm"
      onClick={() => setWizardOpen(false)}
      role="dialog"
    >
      <div
        className="panel-elevated mx-auto w-full max-w-6xl overflow-hidden rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <WizardSteps />
      </div>
    </div>
  )
}
