import type { ClaimTabId } from '@/types/claim'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import { getStoredOnboardingStep } from '@/lib/claimWorkflow'

const tabs: Array<{ id: Exclude<ClaimTabId, 'maximizer'>; label: string; badge?: (counts: Record<string, number>) => number }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'claim-info', label: 'Claim Info' },
  { id: 'rooms', label: 'Rooms', badge: (counts) => counts.rooms },
  { id: 'floor-plan', label: 'Floor Plan' },
  { id: 'photo-library', label: 'Photo Library', badge: (counts) => counts.photoLibrary },
  { id: 'contents', label: 'Contents', badge: (counts) => counts.contents },
  { id: 'receipts', label: 'Receipts', badge: (counts) => counts.receipts },
  { id: 'expenses', label: 'Expenses' },
  { id: 'communications', label: 'Communications', badge: (counts) => counts.communications },
  { id: 'timeline', label: 'Timeline' },
  { id: 'contractors', label: 'Contractors', badge: (counts) => counts.contractors },
  { id: 'payments', label: 'Payments', badge: (counts) => counts.payments },
]

interface TabBarProps {
  activeTab: Exclude<ClaimTabId, 'maximizer'>
  onTabChange: (tab: Exclude<ClaimTabId, 'maximizer'>) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const data = useClaimStore((state) => state.data)
  const openWizard = useUIStore((state) => state.openWizard)
  const counts = {
    rooms: data.rooms.length,
    photoLibrary: data.photoLibrary.length,
    aiPhotos: data.aiPhotos.length,
    contents: data.contents.length,
    receipts: data.receipts.length,
    communications: data.communications.length,
    contractors: data.contractors.length,
    payments: data.payments.length,
  }

  return (
    <nav className="sticky top-4 z-20 mt-4 pb-1">
      <div className="panel-elevated overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-1.5 px-3 py-3 sm:gap-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab
            const badgeCount = tab.badge?.(counts)
            return (
              <button
                className={
                  isActive
                    ? 'inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-400 px-3 py-2 text-sm font-semibold text-slate-950 sm:gap-2 sm:px-4'
                    : 'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-slate-300 hover:border-[color:var(--border)] hover:bg-slate-900/60 hover:text-white sm:gap-2 sm:px-4'
                }
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                type="button"
              >
                <span>{tab.label}</span>
                {badgeCount ? (
                  <span className="rounded-full bg-slate-950/20 px-2 py-0.5 text-[11px] font-bold">{badgeCount}</span>
                ) : null}
              </button>
            )
          })}
          <button className="button-secondary ml-auto shrink-0 whitespace-nowrap" onClick={() => openWizard(getStoredOnboardingStep())} type="button">
            ⟲ Wizard
          </button>
        </div>
      </div>
    </nav>
  )
}
