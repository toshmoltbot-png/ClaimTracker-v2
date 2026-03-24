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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-8"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="panel-elevated w-full max-w-2xl animate-[fade-in_160ms_ease-out] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-[color:var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer ? <footer className="border-t border-[color:var(--border)] px-6 py-4">{footer}</footer> : null}
      </div>
    </div>
  )
}
