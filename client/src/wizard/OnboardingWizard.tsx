import { WizardSteps } from '@/wizard/WizardSteps'
import { useUIStore } from '@/store/uiStore'

export function OnboardingWizard() {
  const wizard = useUIStore((state) => state.wizard)
  const setWizardOpen = useUIStore((state) => state.setWizardOpen)

  if (!wizard.open) return null

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950 px-4 py-6"
      onClick={() => setWizardOpen(false)}
      role="dialog"
    >
      <div
        className="panel-elevated mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-[28px]"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <WizardSteps />
      </div>
    </div>
  )
}
