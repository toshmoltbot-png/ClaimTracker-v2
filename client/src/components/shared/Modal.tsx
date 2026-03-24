import { useEffect, type PropsWithChildren, type ReactNode } from 'react'

interface ModalProps extends PropsWithChildren {
  open: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
}

export function Modal({ open, title, onClose, footer, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 px-0 py-0 sm:items-center sm:px-4 sm:py-8"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="panel-elevated w-full max-h-[90dvh] animate-[fade-in_160ms_ease-out] overflow-hidden rounded-t-3xl sm:max-w-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-[color:var(--border)] px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </header>
        <div className="max-h-[60dvh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="border-t border-[color:var(--border)] px-5 py-4 sm:px-6">{footer}</footer> : null}
      </div>
    </div>
  )
}
