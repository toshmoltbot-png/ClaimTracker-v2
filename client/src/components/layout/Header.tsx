import { Link } from 'react-router-dom'
import { SaveStatus } from '@/components/shared/SaveStatus'
import { useAuthStore } from '@/store/authStore'
import { useClaimStore } from '@/store/claimStore'

export function Header() {
  const { signOutUser, user } = useAuthStore()
  const dashboard = useClaimStore((state) => state.data.dashboard)

  return (
    <header className="panel-elevated flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">ClaimTracker v2</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold text-white">Claim Workspace</h1>
          <span className="text-sm text-slate-400">
            {dashboard.insuredName || 'Unassigned insured'}
            {dashboard.claimNumber ? ` · Claim #${dashboard.claimNumber}` : ''}
            {dashboard.dateOfLoss ? ` · DOL ${dashboard.dateOfLoss}` : ''}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SaveStatus />
        <Link className="button-secondary" to="/maximizer">
          Maximizer
        </Link>
        <button className="button-secondary" onClick={() => void signOutUser()} type="button">
          {user?.email || 'Logout'}
        </button>
      </div>
    </header>
  )
}
