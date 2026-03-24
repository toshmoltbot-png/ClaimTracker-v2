import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, getExpensesTotal, getItemTotalValue } from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { ClaimData, ClaimTabId } from '@/types/claim'
import { generateClaimPDF } from '@/components/pdf/PDFGenerator'

const PREMIUM_STORAGE_KEY = 'claimtracker:premium-unlocked'
const PREMIUM_ENABLED = false

interface PPMItem {
  id: string
  text: string
  tab: ClaimTabId
}

interface PPMCard {
  id: 'completeness' | 'overlooked' | 'evidence' | 'strategy'
  label: string
  description: string
  items: PPMItem[]
}

function isPremiumUnlocked() {
  return typeof window !== 'undefined' && window.localStorage.getItem(PREMIUM_STORAGE_KEY) === 'true'
}

function setPremiumUnlocked(value: boolean) {
  window.localStorage.setItem(PREMIUM_STORAGE_KEY, value ? 'true' : 'false')
}

function getPPMSummary(data: ClaimData) {
  const rooms = data.rooms || []
  const contents = (data.contents || []).filter((item) => item.source !== 'receipt' && item.includedInClaim !== false)
  const expensesTotal = getExpensesTotal(data.expenses)
  const missingRoomItems = rooms.filter((room) => !contents.some((item) => item.roomId === room.id || item.room === room.name || item.location === room.name))
  const unenriched = contents.filter((item) => !item.aiJustification && !item.enrichment?.revised?.justification)
  const unenrichedValue = unenriched.reduce((sum, item) => sum + getItemTotalValue(item), 0)
  const noPhotoItems = contents.filter((item) => !(item.photos || []).length && !(item.evidencePhotos || []).length)

  const completeness: PPMCard = {
    id: 'completeness',
    label: 'Completeness',
    description: 'Missing claim details, empty rooms, or inventory gaps that weaken the report.',
    items: [
      ...(!data.dashboard.dateOfLoss && !data.claim.dateOfLoss ? [{ id: 'dol', text: 'Date of loss is missing.', tab: 'claim-info' as const }] : []),
      ...(!(data.dashboard.claimNumber || data.claim.claimNumber) ? [{ id: 'claim-number', text: 'Claim number is missing.', tab: 'claim-info' as const }] : []),
      ...(!rooms.length ? [{ id: 'rooms', text: 'No affected rooms have been added.', tab: 'rooms' as const }] : []),
      ...missingRoomItems.map((room) => ({ id: `room-${room.id}`, text: `${room.name || 'Room'} has no listed contents.`, tab: 'contents' as const })),
      ...(unenriched.length ? [{ id: 'unenriched', text: `${unenriched.length} item${unenriched.length === 1 ? '' : 's'} still need AI rationale or pricing support.`, tab: 'contents' as const }] : []),
    ],
  }

  const overlooked: PPMCard = {
    id: 'overlooked',
    label: 'Overlooked',
    description: 'Recoverable categories that are commonly left out of the claim package.',
    items: [
      ...(expensesTotal <= 0 ? [{ id: 'expenses', text: 'No supplemental expenses are logged yet.', tab: 'expenses' as const }] : []),
      ...(!(data.contractorReports || []).length ? [{ id: 'contractor-reports', text: 'No contractor findings or reports uploaded.', tab: 'contractors' as const }] : []),
      ...(!(data.receipts || []).length ? [{ id: 'receipts', text: 'No receipts uploaded for out-of-pocket support.', tab: 'receipts' as const }] : []),
      ...(!(data.policyDocs || []).length ? [{ id: 'policy-docs', text: 'No policy documents uploaded for coverage checks.', tab: 'claim-info' as const }] : []),
    ],
  }

  const evidence: PPMCard = {
    id: 'evidence',
    label: 'Evidence Gaps',
    description: 'Photos and files that should be attached before sending the report.',
    items: [
      ...rooms.filter((room) => !(room.photos || []).length).map((room) => ({ id: `photo-${room.id}`, text: `${room.name || 'Room'} has no room photos attached.`, tab: 'rooms' as const })),
      ...(noPhotoItems.length ? [{ id: 'item-photos', text: `${noPhotoItems.length} inventory item${noPhotoItems.length === 1 ? '' : 's'} have no supporting photos.`, tab: 'contents' as const }] : []),
      ...(!(data.aiPhotos || []).length && !(data.photoLibrary || []).length ? [{ id: 'library', text: 'No AI Builder or photo library evidence has been uploaded.', tab: 'photo-library' as const }] : []),
    ],
  }

  const strategy: PPMCard = {
    id: 'strategy',
    label: 'Strategy',
    description: 'Claim positioning issues that affect presentation, negotiation, and completeness.',
    items: [
      ...(!(data.communications || []).length ? [{ id: 'comms', text: 'No adjuster communications are logged yet.', tab: 'communications' as const }] : []),
      ...(!(data.payments || []).length ? [{ id: 'payments', text: 'No payments have been logged, so the report cannot show received funds.', tab: 'payments' as const }] : []),
      ...(!(data.floorPlan && (data.floorPlan.rooms || []).length) && !rooms.some((room) => room.floorPlanX != null || room.floorPlanY != null) ? [{ id: 'floor-plan', text: 'Floor plan layout has not been positioned yet.', tab: 'floor-plan' as const }] : []),
      ...(!data.dashboard.adjusterName && !data.dashboard.adjusterEmail ? [{ id: 'adjuster', text: 'Adjuster contact details are missing from the claim file.', tab: 'claim-info' as const }] : []),
    ],
  }

  const cards = [completeness, overlooked, evidence, strategy]
  return {
    cards,
    total: cards.reduce((sum, card) => sum + card.items.length, 0),
    unenrichedValue,
  }
}

function calcPPMDollarEstimate(summary: ReturnType<typeof getPPMSummary>) {
  return summary.unenrichedValue + summary.cards.find((card) => card.id === 'overlooked')!.items.length * 500
}

function CardBody({ card, locked, onNavigate }: { card: PPMCard; locked: boolean; onNavigate: (tab: ClaimTabId) => void }) {
  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{card.label}</h3>
          <p className="mt-2 text-sm text-slate-400">{card.description}</p>
        </div>
        <span className={card.items.length ? 'rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200' : 'rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200'}>
          {card.items.length ? `${card.items.length} issue${card.items.length === 1 ? '' : 's'}` : 'Clear'}
        </span>
      </div>
      <div className={locked ? 'mt-4 space-y-3 blur-[3px]' : 'mt-4 space-y-3'}>
        {card.items.length ? (
          card.items.map((item) => (
            <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-3 py-3" key={item.id}>
              <p className="text-sm text-slate-200">{item.text}</p>
              {!locked ? (
                <button className="mt-3 text-xs font-semibold text-sky-300 hover:text-sky-200" onClick={() => onNavigate(item.tab)} type="button">
                  Open tab
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-200">
            Nothing to address here.
          </div>
        )}
      </div>
    </div>
  )
}

export function PrePrintModal() {
  const isOpen = useUIStore((state) => state.modals.prePrint === true)
  const closeModal = useUIStore((state) => state.closeModal)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const pushToast = useUIStore((state) => state.pushToast)
  const data = useClaimStore((state) => state.data)
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [unlocked, setUnlocked] = useState(isPremiumUnlocked())

  const summary = useMemo(() => getPPMSummary(data), [data])
  const dollarEstimate = useMemo(() => calcPPMDollarEstimate(summary), [summary])
  const locked = !unlocked && summary.total > 0

  const goToTab = (tab: ClaimTabId) => {
    closeModal('prePrint')
    setActiveTab(tab)
    navigate(`/#${tab}`)
  }

  const handleUnlock = () => {
    if (PREMIUM_ENABLED) {
      pushToast('Premium checkout is not enabled in this beta build.', 'info')
      return
    }
    setPremiumUnlocked(true)
    setUnlocked(true)
    pushToast('Guidance unlocked. Free during beta.', 'success')
  }

  const handleGenerate = async () => {
    setGenerating(true)
    closeModal('prePrint')
    try {
      await generateClaimPDF(data)
      pushToast('PDF report downloaded.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'PDF generation failed.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Modal
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button className="button-secondary" disabled={generating} onClick={() => closeModal('prePrint')} type="button">
            Close
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            {locked ? (
              <button className="button-secondary" disabled={generating} onClick={handleUnlock} type="button">
                Unlock guidance
              </button>
            ) : null}
            <button className="button-primary" disabled={generating} onClick={() => void handleGenerate()} type="button">
              {summary.total ? 'Generate anyway' : 'Generate report'}
            </button>
          </div>
        </div>
      }
      onClose={() => closeModal('prePrint')}
      open={isOpen}
      title="Pre-print review"
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,118,110,0.28))] px-5 py-5">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-200">Before You Print</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            We found <span className="text-emerald-300">{formatCurrency(dollarEstimate)}+</span> potentially missing from your claim
          </h3>
          <p className="mt-3 text-sm text-slate-300">
            {summary.total
              ? `${summary.total} issue${summary.total === 1 ? '' : 's'} detected across completeness, overlooked categories, evidence, and strategy.`
              : 'No major issues detected. The report is ready to generate.'}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Premium guidance is currently free during beta.
          </p>
        </div>

        {locked ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Detailed fix guidance is locked until you unlock the beta view. You can still generate the PDF now.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {summary.cards.map((card) => (
            <CardBody card={card} key={card.id} locked={locked} onNavigate={goToTab} />
          ))}
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
          <p className="text-sm font-semibold text-white">{summary.total ? 'Fix issues first' : 'Ready to generate'}</p>
          <p className="mt-2 text-sm text-slate-400">
            {summary.total
              ? 'If you have time, fix the highlighted gaps before printing. If not, generate anyway and continue updating the claim afterward.'
              : 'The current claim data supports a full report generation flow.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}
