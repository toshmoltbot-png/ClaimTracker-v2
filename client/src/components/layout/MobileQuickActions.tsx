import { useUIStore } from '@/store/uiStore'

export function MobileQuickActions() {
  const setWizardOpen = useUIStore((state) => state.setWizardOpen)

  return (
    <div className="fixed inset-x-4 bottom-4 z-30 md:hidden">
      <div className="panel-elevated flex items-center justify-between px-4 py-3">
        <button className="button-secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} type="button">
          Top
        </button>
        <button className="button-primary" onClick={() => setWizardOpen(true)} type="button">
          Wizard
        </button>
      </div>
    </div>
  )
}
