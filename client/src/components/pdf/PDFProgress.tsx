import { ProgressBar } from '@/components/shared/ProgressBar'
import { create } from 'zustand'

interface PDFProgressStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete' | 'error'
}

interface PDFProgressState {
  open: boolean
  progress: number
  title: string
  status: string
  steps: PDFProgressStep[]
}

interface PDFProgressActions {
  start: (steps: string[], title?: string) => void
  advance: (stepId: string, status: string, progress?: number) => void
  complete: (status?: string) => void
  fail: (status: string) => void
  reset: () => void
}

const initialState: PDFProgressState = {
  open: false,
  progress: 0,
  title: 'Generating Report',
  status: 'Preparing report data…',
  steps: [],
}

export const usePDFProgressStore = create<PDFProgressState & PDFProgressActions>((set) => ({
  ...initialState,
  start: (steps, title = 'Generating Report') =>
    set({
      open: true,
      progress: 3,
      title,
      status: 'Preparing report data…',
      steps: steps.map((label, index) => ({
        id: `step-${index}`,
        label,
        status: index === 0 ? 'active' : 'pending',
      })),
    }),
  advance: (stepId, status, progress) =>
    set((state) => {
      const currentIndex = state.steps.findIndex((step) => step.id === stepId)
      const nextSteps: PDFProgressStep[] = state.steps.map((step, index) => {
        if (step.id === stepId) return { ...step, status: 'complete' }
        if (index === currentIndex + 1 && step.status === 'pending') return { ...step, status: 'active' }
        return step
      })
      return {
        ...state,
        status,
        progress: progress ?? state.progress,
        steps: nextSteps,
      }
    }),
  complete: (status = 'Report downloaded.') =>
    set((state) => ({
      ...state,
      open: true,
      progress: 100,
      status,
      steps: state.steps.map((step) => ({ ...step, status: 'complete' })),
    })),
  fail: (status) =>
    set((state) => ({
      ...state,
      open: true,
      status,
      steps: state.steps.map((step) => (step.status === 'active' ? { ...step, status: 'error' } : step)),
    })),
  reset: () => set(initialState),
}))

export function PDFProgress() {
  const open = usePDFProgressStore((state) => state.open)
  const title = usePDFProgressStore((state) => state.title)
  const status = usePDFProgressStore((state) => state.status)
  const progress = usePDFProgressStore((state) => state.progress)
  const steps = usePDFProgressStore((state) => state.steps)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 px-4 py-6">
      <div className="panel-elevated w-full max-w-xl px-6 py-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-3xl">PDF</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Report Builder</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-300">{status}</p>
          </div>
        </div>
        <div className="mt-6">
          <ProgressBar label="Overall progress" value={progress} />
        </div>
        <div className="mt-5 space-y-2">
          {steps.map((step) => (
            <div
              className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3"
              key={step.id}
            >
              <span className="text-sm text-slate-200">{step.label}</span>
              <span
                className={
                  step.status === 'complete'
                    ? 'text-sm font-semibold text-emerald-300'
                    : step.status === 'active'
                      ? 'text-sm font-semibold text-sky-300'
                      : step.status === 'error'
                        ? 'text-sm font-semibold text-rose-300'
                        : 'text-sm font-semibold text-slate-500'
                }
              >
                {step.status === 'complete' ? 'Done' : step.status === 'active' ? 'Working' : step.status === 'error' ? 'Error' : 'Queued'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
