import { useEffect } from 'react'
import { WizardSteps } from '@/wizard/WizardSteps'
import { useUIStore } from '@/store/uiStore'

export function OnboardingWizard() {
  const wizard = useUIStore((state) => state.wizard)
  const setWizardOpen = useUIStore((state) => state.setWizardOpen)

  useEffect(() => {
    if (wizard.open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [wizard.open])

  if (!wizard.open) return null

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950 p-4 sm:p-6"
      onClick={() => setWizardOpen(false)}
      role="dialog"
    >
      <div
        className="panel-elevated flex w-full max-w-6xl flex-col overflow-hidden rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <WizardSteps />
      </div>
    </div>
  )
}
