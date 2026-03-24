import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ClaimData } from '@/types/claim'

export function buildClaimPdf(data: ClaimData) {
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('ClaimTracker v2 Report Scaffold', 14, 20)
  autoTable(doc, {
    startY: 30,
    head: [['Field', 'Value']],
    body: [
      ['Claim Number', data.dashboard.claimNumber || ''],
      ['Insured', data.dashboard.insuredName || ''],
      ['Date of Loss', data.dashboard.dateOfLoss || ''],
    ],
  })
  return doc
}
