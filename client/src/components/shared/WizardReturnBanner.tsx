import { useUIStore } from '@/store/uiStore'

export function WizardReturnBanner() {
  const wizardReturnStep = useUIStore((s) => s.wizardReturnStep)
  const setWizardReturnStep = useUIStore((s) => s.setWizardReturnStep)
  const openWizard = useUIStore((s) => s.openWizard)

  if (wizardReturnStep == null) return null

  return (
    <div className="fixed left-1/2 top-[70px] z-[10000] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3 text-sm text-white shadow-lg shadow-blue-500/30 animate-in slide-in-from-top">
      <span>Review your items, then return to finish the wizard</span>
      <button
        className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/30 transition-colors"
        onClick={() => {
          setWizardReturnStep(null)
          openWizard(wizardReturnStep)
        }}
      >
        Back to Wizard
      </button>
      <button
        className="text-white/70 hover:text-white text-lg px-1"
        onClick={() => setWizardReturnStep(null)}
      >
        ✕
      </button>
    </div>
  )
}
