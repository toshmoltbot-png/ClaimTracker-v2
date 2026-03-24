import { ProgressBar } from '@/components/shared/ProgressBar'

export function PDFProgress() {
  return (
    <div className="panel p-5">
      <ProgressBar label="Generating report" value={15} />
    </div>
  )
}
