import { Modal } from '@/components/shared/Modal'
import { WizardSteps } from '@/wizard/WizardSteps'
import { useUIStore } from '@/store/uiStore'

export function OnboardingWizard() {
  const wizard = useUIStore((state) => state.wizard)
  const setWizardOpen = useUIStore((state) => state.setWizardOpen)

  return (
    <Modal
      onClose={() => setWizardOpen(false)}
      open={wizard.open}
      title={`Onboarding Wizard · Step ${wizard.step}`}
    >
      <WizardSteps />
    </Modal>
  )
}
