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

interface UIState {
  activeTab: ClaimTabId
  saveStatus: SaveStatus
  modals: Record<string, boolean>
  toasts: ToastMessage[]
  wizard: WizardState
  setActiveTab: (tab: ClaimTabId) => void
  setSaveStatus: (status: SaveStatus) => void
  openModal: (id: string) => void
  closeModal: (id: string) => void
  pushToast: (title: string, type?: ToastType) => void
  dismissToast: (id: string) => void
  setWizardOpen: (open: boolean) => void
  setWizardStep: (step: number) => void
  openWizard: (step?: number, forced?: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'dashboard',
  saveStatus: 'offline',
  modals: {},
  toasts: [],
  wizard: { open: false, step: 1, forced: false },
  setActiveTab: (activeTab) => set({ activeTab }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  openModal: (id) => set((state) => ({ modals: { ...state.modals, [id]: true } })),
  closeModal: (id) => set((state) => ({ modals: { ...state.modals, [id]: false } })),
  pushToast: (title, type = 'info') =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), title, type }],
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  setWizardOpen: (open) => set((state) => ({ wizard: { ...state.wizard, open } })),
  setWizardStep: (step) => set((state) => ({ wizard: { ...state.wizard, step } })),
  openWizard: (step, forced = false) =>
    set((state) => ({
      wizard: {
        ...state.wizard,
        open: true,
        step: step ?? state.wizard.step,
        forced,
      },
    })),
}))
