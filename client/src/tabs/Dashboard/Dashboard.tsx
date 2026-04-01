import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProgressBar } from '@/components/shared/ProgressBar'
import {
  buildReadinessChecks,
  CLAIM_TYPE_OPTIONS,
  formatCurrency,
  formatPercent,
  getNextStepSuggestion,
  updateDashboardSummary,
} from '@/lib/claimWorkflow'
import { fmtUSDate } from '@/lib/dates'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { ClaimTabId } from '@/types/claim'
import { NextStepCard } from '@/tabs/Dashboard/NextStepCard'
import { ReadinessPanel } from '@/tabs/Dashboard/ReadinessPanel'

interface MetricCardProps {
  label: string
  value: string
  hint: string
  progress: number
}

function MetricCard({ label, value, hint, progress }: MetricCardProps) {
  return (
    <div className="panel px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{hint}</p>
        </div>
        <span className="text-xs font-semibold text-slate-400">{formatPercent(progress)}</span>
      </div>
      <div className="mt-4">
        <ProgressBar value={progress} />
      </div>
    </div>
  )
}

function navigateToTab(setActiveTab: (tab: ClaimTabId) => void, navigate: ReturnType<typeof useNavigate>, tab: ClaimTabId) {
  setActiveTab(tab)
  navigate(`/#${tab}`)
}

export function Dashboard() {
  const data = useClaimStore((state) => state.data)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const openModal = useUIStore((state) => state.openModal)
  const navigate = useNavigate()

  const summary = useMemo(() => updateDashboardSummary(data), [data])
  const readinessChecks = useMemo(() => buildReadinessChecks(data), [data])
  const nextStep = useMemo(() => getNextStepSuggestion(data), [data])
  const claimTypeLabel = CLAIM_TYPE_OPTIONS.find((option) => option.value === data.claimType)?.label || data.claimType || 'Unspecified'

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="panel-elevated px-6 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Claim Summary</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {data.dashboard.insuredName || 'Insured name not entered'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
            {data.dashboard.insuredAddress || 'Property address not entered'}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Claim #</p>
              <p className="mt-2 text-sm font-semibold text-white">{data.dashboard.claimNumber || 'Pending'}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Date of Loss</p>
              <p className="mt-2 text-sm font-semibold text-white">{fmtUSDate(data.dashboard.dateOfLoss) || 'Pending'}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Claim Type</p>
              <p className="mt-2 text-sm font-semibold text-white">{claimTypeLabel}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="button-primary" onClick={() => navigateToTab(setActiveTab, navigate, 'contents')} type="button">
              Contents
            </button>
            <button className="button-secondary" onClick={() => openModal('prePrint')} type="button">
              Generate Report
            </button>
          </div>
        </div>
        <NextStepCard
          onAction={() => {
            if (nextStep.targetTab === 'dashboard') {
              openModal('prePrint')
              return
            }
            navigateToTab(setActiveTab, navigate, nextStep.targetTab)
          }}
          suggestion={nextStep}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          hint={`${summary.roomsCount} documented room${summary.roomsCount === 1 ? '' : 's'}`}
          label="Rooms"
          progress={Math.min(summary.roomsCount * 20, 100)}
          value={String(summary.roomsCount)}
        />
        <MetricCard
          hint={`${summary.photoCount} evidence photo${summary.photoCount === 1 ? '' : 's'}`}
          label="Photos"
          progress={Math.min(summary.photoCount * 10, 100)}
          value={String(summary.photoCount)}
        />
        <MetricCard
          hint={`${summary.enrichedCount} enriched · ${formatPercent(summary.enrichedPercent)}`}
          label="Items"
          progress={Math.max(summary.enrichedPercent, Math.min(summary.itemCount * 5, 100))}
          value={String(summary.itemCount)}
        />
        <MetricCard
          hint={summary.expensesTotal > 0 ? 'Tracked' : 'No expenses yet'}
          label="Expenses"
          progress={summary.expensesTotal > 0 ? 100 : 10}
          value={formatCurrency(summary.expensesTotal)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ReadinessPanel checks={readinessChecks} readinessPercent={summary.readinessPercent} />
        <section className="panel px-6 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Mobile Progress</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Key claim milestones</h3>
          <div className="mt-5 space-y-4">
            {[
              { label: 'Policy / claim details', complete: readinessChecks[0]?.complete },
              { label: 'Rooms documented', complete: readinessChecks[1]?.complete },
              { label: 'Photos uploaded', complete: readinessChecks[2]?.complete },
              { label: 'Inventory created', complete: readinessChecks[3]?.complete },
            ].map((step) => (
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-4" key={step.label}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-white">{step.label}</p>
                  <span className={step.complete ? 'text-emerald-300' : 'text-slate-500'}>{step.complete ? 'Done' : 'Open'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
