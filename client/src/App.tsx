import { lazy, Suspense, useEffect, useMemo, useRef, type ComponentType } from 'react'
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
import { OnboardingWizard } from '@/wizard/OnboardingWizard'
import { WizardReturnBanner } from '@/components/shared/WizardReturnBanner'
import { getStoredOnboardingStep, shouldShowOnboarding } from '@/lib/claimWorkflow'

// Lazy-loaded tab components for code splitting
const Dashboard = lazy(() => import('@/tabs/Dashboard/Dashboard').then((m) => ({ default: m.Dashboard })))
const ClaimInfo = lazy(() => import('@/tabs/ClaimInfo/ClaimInfo').then((m) => ({ default: m.ClaimInfo })))
const Rooms = lazy(() => import('@/tabs/Rooms/Rooms').then((m) => ({ default: m.Rooms })))
const FloorPlan = lazy(() => import('@/tabs/FloorPlan/FloorPlan').then((m) => ({ default: m.FloorPlan })))
const PhotoLibrary = lazy(() => import('@/tabs/PhotoLibrary/PhotoLibrary').then((m) => ({ default: m.PhotoLibrary })))
const Contents = lazy(() => import('@/tabs/Contents/Contents').then((m) => ({ default: m.Contents })))
const Receipts = lazy(() => import('@/tabs/Receipts/Receipts').then((m) => ({ default: m.Receipts })))
const Expenses = lazy(() => import('@/tabs/Expenses/Expenses').then((m) => ({ default: m.Expenses })))
const Communications = lazy(() => import('@/tabs/Communications/Communications').then((m) => ({ default: m.Communications })))
const Timeline = lazy(() => import('@/tabs/Timeline/Timeline').then((m) => ({ default: m.Timeline })))
const Contractors = lazy(() => import('@/tabs/Contractors/Contractors').then((m) => ({ default: m.Contractors })))
const Payments = lazy(() => import('@/tabs/Payments/Payments').then((m) => ({ default: m.Payments })))
const Maximizer = lazy(() => import('@/tabs/Maximizer/Maximizer').then((m) => ({ default: m.Maximizer })))

const tabComponents: Record<Exclude<ClaimTabId, 'maximizer'>, ComponentType> = {
  dashboard: Dashboard,
  'claim-info': ClaimInfo,
  rooms: Rooms,
  'floor-plan': FloorPlan,
  'photo-library': PhotoLibrary,
  contents: Contents,
  receipts: Receipts,
  expenses: Expenses,
  communications: Communications,
  timeline: Timeline,
  contractors: Contractors,
  payments: Payments,
}

function TabSuspenseFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
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

  const TabComponent = tabComponents[currentTab]

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
          <main className="flex-1 py-6 pb-24 md:pb-6">
            <Suspense fallback={<TabSuspenseFallback />}>
              <TabComponent />
            </Suspense>
          </main>
          <MobileQuickActions />
        </div>
        <OnboardingWizard />
        <WizardReturnBanner />
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
              <Suspense fallback={<TabSuspenseFallback />}>
                <Maximizer />
              </Suspense>
              <ToastViewport />
            </div>
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
