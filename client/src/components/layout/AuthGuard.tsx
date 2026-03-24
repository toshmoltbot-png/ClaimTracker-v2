import { useEffect, useState, type FormEvent, type PropsWithChildren } from 'react'
import { subscribeToAuth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export function AuthGuard({ children }: PropsWithChildren) {
  const { user, loading, initialized, setUser, signIn, signUp } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'create'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToAuth((firebaseUser) => {
      setUser(
        firebaseUser
          ? {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
            }
          : null,
      )
    })
    return unsubscribe
  }, [setUser])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Authentication failed')
    }
  }

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="panel max-w-md px-6 py-10 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">ClaimTracker v2</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Connecting to secure cloud storage</h1>
        </div>
      </div>
    )
  }

  if (user) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="panel grid w-full max-w-5xl gap-8 overflow-hidden md:grid-cols-[1.1fr_0.9fr]">
        <section className="border-b border-[color:var(--border)] p-8 md:border-b-0 md:border-r">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">ClaimTracker v2</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Foundation rebuild of the v1 claim workspace</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            Firebase remains the source of truth. This shell already mirrors the v1 document shape, save semantics,
            and tab structure so the feature phases can focus on behavior.
          </p>
        </section>
        <section className="p-8">
          <div className="mb-6 flex gap-2 rounded-2xl border border-[color:var(--border)] bg-slate-950/50 p-1">
            <button
              className={mode === 'login' ? 'button-primary flex-1' : 'button-secondary flex-1 border-transparent'}
              onClick={() => setMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={mode === 'create' ? 'button-primary flex-1' : 'button-secondary flex-1 border-transparent'}
              onClick={() => setMode('create')}
              type="button"
            >
              Create Account
            </button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              className="field"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="field"
              type="password"
              placeholder="Password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {(localError || useAuthStore.getState().error) && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {localError || useAuthStore.getState().error}
              </p>
            )}
            <button className="button-primary w-full" type="submit">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
