import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'

const toneClass = {
  success: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-400/40 bg-rose-500/15 text-rose-100',
  info: 'border-sky-400/40 bg-sky-500/15 text-sky-100',
  warning: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
} as const

export function ToastViewport() {
  const toasts = useUIStore((state) => state.toasts)
  const dismissToast = useUIStore((state) => state.dismissToast)

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id)
      }, 3200),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismissToast, toasts])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toneClass[toast.type]}`} key={toast.id}>
          {toast.title}
        </div>
      ))}
    </div>
  )
}
