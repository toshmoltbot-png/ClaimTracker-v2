import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { TabBar } from '@/components/layout/TabBar'
import { MobileQuickActions } from '@/components/layout/MobileQuickActions'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ToastViewport } from '@/components/shared/Toast'
import { PrePrintModal } from '@/components/pdf/PrePrintModal'
import { PDFProgress } from '@/components/pdf/PDFProgress'
import { useClaimStore, setupClaimAutosave } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import { CLAIM_TABS, type ClaimTabId } from '@/types/claim'
import { Dashboard } from '@/tabs/Dashboard/Dashboard'
import { ClaimInfo } from '@/tabs/ClaimInfo/ClaimInfo'
import { Rooms } from '@/tabs/Rooms/Rooms'
import { FloorPlan } from '@/tabs/FloorPlan/FloorPlan'
import { PhotoLibrary } from '@/tabs/PhotoLibrary/PhotoLibrary'
import { AIBuilder } from '@/tabs/AIBuilder/AIBuilder'
import { Contents } from '@/tabs/Contents/Contents'
import { Receipts } from '@/tabs/Receipts/Receipts'
import { Expenses } from '@/tabs/Expenses/Expenses'
import { Communications } from '@/tabs/Communications/Communications'
import { Timeline } from '@/tabs/Timeline/Timeline'
import { Contractors } from '@/tabs/Contractors/Contractors'
import { Payments } from '@/tabs/Payments/Payments'
import { Maximizer } from '@/tabs/Maximizer/Maximizer'
import { OnboardingWizard } from '@/wizard/OnboardingWizard'
import { getStoredOnboardingStep, shouldShowOnboarding } from '@/lib/claimWorkflow'

const tabComponents: Record<Exclude<ClaimTabId, 'maximizer'>, ReactElement> = {
  dashboard: <Dashboard />,
  'claim-info': <ClaimInfo />,
  rooms: <Rooms />,
  'floor-plan': <FloorPlan />,
  'photo-library': <PhotoLibrary />,
  'ai-builder': <AIBuilder />,
  contents: <Contents />,
  receipts: <Receipts />,
  expenses: <Expenses />,
  communications: <Communications />,
  timeline: <Timeline />,
  contractors: <Contractors />,
  payments: <Payments />,
}

function MainShell() {
  const hydrate = useClaimStore((state) => state.hydrate)
  const hydrated = useClaimStore((state) => state.hydrated)
  const data = useClaimStore((state) => state.data)
  const activeTab = useUIStore((state) => state.activeTab)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const openWizard = useUIStore((state) => state.openWizard)
  const location = useLocation()
  const navigate = useNavigate()
  const autoOpenedWizardRef = useRef(false)

  useEffect(() => {
    setupClaimAutosave()
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (CLAIM_TABS.includes(hash as ClaimTabId) && hash !== 'maximizer') {
      setActiveTab(hash as ClaimTabId)
    }
  }, [location.hash, setActiveTab])

  useEffect(() => {
    if (!hydrated) return
    if (autoOpenedWizardRef.current) return
    if (shouldShowOnboarding(data)) {
      autoOpenedWizardRef.current = true
      openWizard(getStoredOnboardingStep(), true)
    }
  }, [data, hydrated, openWizard])

  const currentTab = useMemo(() => {
    return CLAIM_TABS.includes(activeTab) && activeTab !== 'maximizer' ? activeTab : 'dashboard'
  }, [activeTab])

  const renderTab = tabComponents[currentTab]

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_28%),var(--bg-gradient)]">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6">
          <Header />
          <TabBar
            activeTab={currentTab}
            onTabChange={(tab) => {
              setActiveTab(tab)
              navigate(`/#${tab}`)
            }}
          />
          <main className="flex-1 py-6">{renderTab}</main>
          <MobileQuickActions />
        </div>
        <OnboardingWizard />
        <PrePrintModal />
        <PDFProgress />
        <ConfirmDialog />
        <ToastViewport />
      </div>
    </AuthGuard>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainShell />} />
      <Route
        path="/maximizer"
        element={
          <AuthGuard>
            <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6">
              <Maximizer />
              <ToastViewport />
            </div>
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
