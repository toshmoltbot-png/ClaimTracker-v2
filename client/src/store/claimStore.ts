import { create } from 'zustand'
import { loadClaimWithRetry, loadLocalClaim, mergeData, persistCloud, persistLocal } from '@/lib/persistence'
import { sanitizeClaimData } from '@/lib/sanitizer'
import { createDefaultClaimData, type ClaimData, type SaveStatus } from '@/types/claim'
import { useUIStore } from '@/store/uiStore'

interface ClaimState {
  data: ClaimData
  hydrated: boolean
  dirty: boolean
  cloudLoadSucceeded: boolean
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
  cloudLoadSucceeded: false,
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
      // Sanitizer runs on every Firestore load — normalizes dispositions, validates Cat3 rules
      const sanitized = cloud ? sanitizeClaimData(cloud) : createDefaultClaimData()
      set({
        data: sanitized,
        hydrated: true,
        dirty: false,
        cloudLoadSucceeded: true,
        loadStatus: 'loaded',
      })
      useUIStore.getState().setSaveStatus(cloud ? 'saved' : 'offline')
    } catch {
      // Fall back to local cache when cloud fails — DO NOT allow cloud saves
      // to prevent overwriting real data with empty defaults
      const local = loadLocalClaim()
      const sanitized = sanitizeClaimData(local)
      set({ data: sanitized, hydrated: true, cloudLoadSucceeded: false, loadStatus: 'error' })
      useUIStore.getState().setSaveStatus('error')
      useUIStore.getState().setOffline(true)
      useUIStore.getState().pushToast('Cloud load failed — working from local cache.', 'warning')
    }
  },
}))

async function runAutosave(data: ClaimData) {
  const ui = useUIStore.getState()
  ui.setSaveStatus('saving')
  persistLocal(data)
  const status: SaveStatus = await persistCloud(data)
  ui.setSaveStatus(status)
  if (status === 'error') {
    ui.setOffline(true)
    ui.pushToast('Cloud save failed — changes saved locally. Will retry.', 'warning')
  } else if (status === 'saved') {
    ui.setOffline(false)
  }
}

export function setupClaimAutosave() {
  if (autosaveStarted) return
  autosaveStarted = true

  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      useUIStore.getState().setOffline(false)
      useUIStore.getState().pushToast('Back online — syncing changes.', 'info')
      // Trigger a save of current data
      const state = useClaimStore.getState()
      if (state.hydrated) void runAutosave(state.data)
    })
    window.addEventListener('offline', () => {
      useUIStore.getState().setOffline(true)
      useUIStore.getState().pushToast('You are offline — changes saved locally.', 'warning')
    })
  }

  useClaimStore.subscribe((state, previous) => {
    if (!state.hydrated || !state.dirty || state.data === previous.data) return
    // CRITICAL: Never save to cloud if the initial load failed — prevents overwriting
    // real data with empty defaults when the user lands on a new domain/device
    if (!state.cloudLoadSucceeded) {
      // Still persist locally as a safety net, but never push empty defaults to cloud
      persistLocal(state.data)
      return
    }
    if (debounceTimer) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      void runAutosave(useClaimStore.getState().data)
    }, 500)
  })
}
