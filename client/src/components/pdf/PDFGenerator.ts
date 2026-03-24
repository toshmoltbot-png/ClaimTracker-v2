import { jsPDF } from 'jspdf'
import type { ClaimData } from '@/types/claim'
import { usePDFProgressStore } from '@/components/pdf/PDFProgress'
import { addPageFooters, createPDFSectionContext, renderAllPDFSections } from '@/components/pdf/PDFSections'

const SECTION_LABELS = [
  'Cover and summary',
  'Timeline and claim basis',
  'Room documentation',
  'Floor plan',
  'Contents inventory',
  'Photo evidence',
  'Expenses and weather',
  'Contractor reports',
  'Receipts',
  'Communications',
  'Payments',
  'Source links',
]

function safeClaimFileName(data: ClaimData) {
  const claimNumber = data.dashboard.claimNumber || data.claim.claimNumber || 'claim'
  const safeClaim = String(claimNumber).replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase()
  return `claim-tracker-report-${safeClaim || 'claim'}.pdf`
}

export async function generateClaimPDF(data: ClaimData) {
  const progress = usePDFProgressStore.getState()
  progress.start(SECTION_LABELS)

  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const ctx = createPDFSectionContext(doc, data)
    const stepBreaks = [
      { id: 'step-0', match: /Executive Summary|Statement/, progress: 12 },
      { id: 'step-1', match: /Timeline/, progress: 20 },
      { id: 'step-2', match: /room documentation/i, progress: 34 },
      { id: 'step-3', match: /Floor plan/i, progress: 42 },
      { id: 'step-4', match: /contents inventory/i, progress: 58 },
      { id: 'step-5', match: /photo evidence/i, progress: 67 },
      { id: 'step-6', match: /expenses/i, progress: 74 },
      { id: 'step-7', match: /contractor/i, progress: 80 },
      { id: 'step-8', match: /receipt/i, progress: 86 },
      { id: 'step-9', match: /communications/i, progress: 91 },
      { id: 'step-10', match: /payments/i, progress: 95 },
      { id: 'step-11', match: /source links/i, progress: 98 },
    ]
    const seenSteps = new Set<string>()
    await renderAllPDFSections(ctx, {
      onStatus: (status) => {
        const nextStep = stepBreaks.find((step) => step.match.test(status))
        if (nextStep && !seenSteps.has(nextStep.id)) {
          seenSteps.add(nextStep.id)
          usePDFProgressStore.getState().advance(nextStep.id, status, nextStep.progress)
        } else {
          usePDFProgressStore.setState((state) => ({ ...state, status }))
        }
      },
    })
    addPageFooters(ctx)
    const fileName = safeClaimFileName(data)
    usePDFProgressStore.getState().complete('Finalizing and downloading report…')
    // jsPDF 4.x: use blob + anchor tag for reliable filename
    const pdfBlob = doc.output('blob')
    const blobUrl = URL.createObjectURL(pdfBlob)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(blobUrl)
    window.setTimeout(() => {
      usePDFProgressStore.getState().complete('Report downloaded.')
      window.setTimeout(() => usePDFProgressStore.getState().reset(), 1200)
    }, 250)
    return doc
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PDF error'
    usePDFProgressStore.getState().fail(`PDF generation failed: ${message}`)
    window.setTimeout(() => usePDFProgressStore.getState().reset(), 1800)
    throw error
  }
}

export const buildClaimPdf = generateClaimPDF
