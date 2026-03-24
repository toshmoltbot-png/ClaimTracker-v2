import { create } from 'zustand'
import { createAccount, login, logout } from '@/lib/firebase'

interface AuthUser {
  uid: string
  email: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  initialized: boolean
  error: string | null
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOutUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  error: null,
  setUser: (user) => set({ user, initialized: true, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  signIn: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const credential = await login(email, password)
      set({
        user: { uid: credential.user.uid, email: credential.user.email },
        initialized: true,
        loading: false,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to sign in', loading: false })
      throw error
    }
  },
  signUp: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const credential = await createAccount(email, password)
      set({
        user: { uid: credential.user.uid, email: credential.user.email },
        initialized: true,
        loading: false,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to create account', loading: false })
      throw error
    }
  },
  signOutUser: async () => {
    set({ loading: true, error: null })
    try {
      await logout()
      set({ user: null, loading: false, initialized: true })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to sign out', loading: false })
      throw error
    }
  },
}))
