import { create } from 'zustand'
import { loadClaimWithRetry, mergeData, persistCloud, persistLocal } from '@/lib/persistence'
import { createDefaultClaimData, type ClaimData, type SaveStatus } from '@/types/claim'
import { useUIStore } from '@/store/uiStore'

interface ClaimState {
  data: ClaimData
  hydrated: boolean
  dirty: boolean
  loadStatus: 'idle' | 'loading' | 'loaded' | 'error'
  updateData: (updater: (current: ClaimData) => ClaimData) => void
  replaceData: (data: ClaimData) => void
  resetData: () => void
  hydrate: () => Promise<void>
}

let autosaveStarted = false
let debounceTimer: number | undefined

export const useClaimStore = create<ClaimState>((set) => ({
  data: createDefaultClaimData(),
  hydrated: false,
  dirty: false,
  loadStatus: 'idle',
  updateData: (updater) =>
    set((state) => ({
      data: updater(state.data),
      dirty: true,
    })),
  replaceData: (data) => set({ data: mergeData(data), dirty: false, hydrated: true, loadStatus: 'loaded' }),
  resetData: () => set({ data: createDefaultClaimData(), dirty: true }),
  hydrate: async () => {
    set({ loadStatus: 'loading' })
    try {
      const cloud = await loadClaimWithRetry()
      set({
        data: cloud ?? createDefaultClaimData(),
        hydrated: true,
        dirty: false,
        loadStatus: 'loaded',
      })
      useUIStore.getState().setSaveStatus(cloud ? 'saved' : 'offline')
    } catch {
      set({ hydrated: true, loadStatus: 'error' })
      useUIStore.getState().setSaveStatus('error')
    }
  },
}))

async function runAutosave(data: ClaimData) {
  useUIStore.getState().setSaveStatus('saving')
  persistLocal(data)
  const status: SaveStatus = await persistCloud(data)
  useUIStore.getState().setSaveStatus(status)
}

export function setupClaimAutosave() {
  if (autosaveStarted) return
  autosaveStarted = true
  useClaimStore.subscribe((state, previous) => {
    if (!state.hydrated || !state.dirty || state.data === previous.data) return
    if (debounceTimer) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      void runAutosave(useClaimStore.getState().data)
    }, 500)
  })
}
