import { create } from 'zustand'
import type { ClaimTabId, SaveStatus, ToastType } from '@/types/claim'

interface ToastMessage {
  id: string
  title: string
  type: ToastType
}

interface WizardState {
  open: boolean
  step: number
  forced: boolean
}

const PREMIUM_STORAGE_KEY = 'claimtracker:premium-unlocked'
export const PREMIUM_ENABLED = false

interface UIState {
  activeTab: ClaimTabId
  saveStatus: SaveStatus
  isOffline: boolean
  premiumUnlocked: boolean
  modals: Record<string, boolean>
  toasts: ToastMessage[]
  wizard: WizardState
  wizardReturnStep: number | null
  setActiveTab: (tab: ClaimTabId) => void
  setSaveStatus: (status: SaveStatus) => void
  setOffline: (offline: boolean) => void
  openModal: (id: string) => void
  closeModal: (id: string) => void
  pushToast: (title: string, type?: ToastType) => void
  dismissToast: (id: string) => void
  setWizardOpen: (open: boolean) => void
  setWizardStep: (step: number) => void
  openWizard: (step?: number, forced?: boolean) => void
  setWizardReturnStep: (step: number | null) => void
  isPremiumUnlocked: () => boolean
  setPremiumUnlocked: (value: boolean) => void
}

function readPremiumFromStorage(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PREMIUM_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: 'dashboard',
  saveStatus: 'offline',
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  premiumUnlocked: readPremiumFromStorage(),
  modals: {},
  toasts: [],
  wizard: { open: false, step: 1, forced: false },
  wizardReturnStep: null,
  setActiveTab: (activeTab) => set({ activeTab }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setOffline: (isOffline) => set({ isOffline }),
  openModal: (id) => set((state) => ({ modals: { ...state.modals, [id]: true } })),
  closeModal: (id) => set((state) => ({ modals: { ...state.modals, [id]: false } })),
  pushToast: (title, type = 'info') =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), title, type }],
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  setWizardOpen: (open) => set((state) => ({ wizard: { ...state.wizard, open } })),
  setWizardStep: (step) => set((state) => ({ wizard: { ...state.wizard, step } })),
  setWizardReturnStep: (step) => set({ wizardReturnStep: step }),
  openWizard: (step, forced = false) =>
    set((state) => ({
      wizard: {
        ...state.wizard,
        open: true,
        step: step ?? state.wizard.step,
        forced,
      },
    })),
  isPremiumUnlocked: () => get().premiumUnlocked,
  setPremiumUnlocked: (value) => {
    try {
      window.localStorage.setItem(PREMIUM_STORAGE_KEY, value ? 'true' : 'false')
    } catch { /* quota exceeded */ }
    set({ premiumUnlocked: value })
  },
}))
