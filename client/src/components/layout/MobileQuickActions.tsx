import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { useClaimStore } from '@/store/claimStore'

export function MobileQuickActions() {
  const setWizardOpen = useUIStore((state) => state.setWizardOpen)
  const openModal = useUIStore((state) => state.openModal)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const saveStatus = useUIStore((state) => state.saveStatus)
  const hydrated = useClaimStore((state) => state.hydrated)
  const navigate = useNavigate()

  if (!hydrated) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div className="mx-4 mb-4 flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--border)] bg-slate-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
        <button
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-slate-300 active:bg-slate-800"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          type="button"
        >
          <span className="text-base">↑</span>
          <span className="text-[10px]">Top</span>
        </button>

        <button
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-slate-300 active:bg-slate-800"
          onClick={() => {
            setActiveTab('contents')
            navigate('/#contents')
          }}
          type="button"
        >
          <span className="text-base">📋</span>
          <span className="text-[10px]">Items</span>
        </button>

        <button
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-sky-300 active:bg-slate-800"
          onClick={() => setWizardOpen(true)}
          type="button"
        >
          <span className="text-base">✨</span>
          <span className="text-[10px]">Wizard</span>
        </button>

        <button
          className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-slate-300 active:bg-slate-800"
          onClick={() => openModal('prePrint')}
          type="button"
        >
          <span className="text-base">📄</span>
          <span className="text-[10px]">PDF</span>
        </button>

        {saveStatus === 'saving' ? (
          <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            <span className="text-[10px] text-sky-300">Saving</span>
          </div>
        ) : saveStatus === 'error' ? (
          <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
            <span className="text-base text-rose-400">!</span>
            <span className="text-[10px] text-rose-300">Error</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
