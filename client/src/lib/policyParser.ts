/**
 * Policy document text extraction and field parsing.
 * Ported from ClaimTracker v1 (index.html lines 13433–13820).
 */

// ─── Text extraction ────────────────────────────────────────────────

export async function extractPolicyText(file: File): Promise<string> {
  const type = (file.type || '').toLowerCase()

  // Plain text
  if (type.includes('text') || file.name.toLowerCase().endsWith('.txt')) {
    return file.text()
  }

  // PDF via pdf.js
  if (type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
    const buf = await file.arrayBuffer()
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const pagesText: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const lines: string[] = []
        let currentY: number | null = null
        let currentLine: string[] = []
        for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
          const y = item.transform ? item.transform[5] : 0
          if (currentY !== null && Math.abs(y - currentY) > 5) {
            if (currentLine.length) lines.push(currentLine.join(' '))
            currentLine = []
          }
          currentY = y
          if (item.str) currentLine.push(item.str)
        }
        if (currentLine.length) lines.push(currentLine.join(' '))
        if (lines.length) pagesText.push(lines.join('\n'))
      }
      const extracted = pagesText.join('\n\n').trim()
      if (extracted.length > 30) return extracted
    } catch (err) {
      console.warn('pdf.js extraction failed, falling back to raw decode', err)
    }
    // Fallback: raw bytes
    const raw = new TextDecoder('latin1').decode(buf)
    return raw.replace(/\s+/g, ' ')
  }

  // Images — no OCR in browser, return empty
  if (type.startsWith('image/')) {
    return ''
  }

  return file.text()
}

// ─── Field parsing ──────────────────────────────────────────────────

export interface ParsedPolicyFields {
  dashboard: Record<string, string>
  insights: {
    hasLossOfUse: boolean
    hasBusinessCoverage: boolean
    hasMatching: boolean
    hasOrdinanceLaw: boolean
    hasWaterBackup: boolean
    hasMedicalPayments: boolean
    limits: { A: string; B: string; C: string; D: string }
    sectionIDeductible: string
    waterBackupLimit: string
    moldLimit: string
    namedStormDeductible: string
    scheduledJewelryLimit: string
    identityFraudLimit: string
    refrigeratedPropertyLimit: string
    lossSettlementType: string
    lossSettlementRCV: boolean
    lossSettlementACV: boolean
    scheduledItemsMentioned: boolean
    rawPolicyText: string
  }
}

export function parsePolicyFields(text: string): ParsedPolicyFields {
  const t = String(text || '').trim()
  const tSingleSpace = t.replace(/\s+/g, ' ')

  const pickMulti = (patterns: RegExp[]): string => {
    for (const re of patterns) {
      const m = tSingleSpace.match(re)
      if (m && m[1] && m[1].trim()) return m[1].trim()
    }
    return ''
  }

  const money = (str: string): string => {
    const m = String(str || '').match(/\$?([0-9][0-9,]*(?:\.\d{1,2})?)/)
    return m ? m[1].replace(/,/g, '') : ''
  }
  const has = (re: RegExp) => re.test(tSingleSpace)

  // Policy Number
  const policyNumber = pickMulti([
    /([A-Z0-9]{2,}[-][A-Z0-9-]{2,})\s+POLICY\s+NUMBER/,
    /([0-9]{4,}[-][0-9A-Z-]+)\s+POLICY\s+NUMBER/,
    /policy\s*(?:number|#|no\.?|num(?:ber)?)\s*[:-]?\s*([A-Z0-9-]{4,})/i,
    /policy\s*[:-]\s*([A-Z0-9-]{4,})/i,
    /\bHO[-\s]?[0-9]\b[:-]?\s*([A-Z0-9-]{4,})/i,
    /\b(HO[-\s]?[0-9][-\s][A-Z0-9-]{6,})/i,
    /policy\s+id\s*[:-]?\s*([A-Z0-9-]{4,})/i,
    /\bpol(?:icy)?\s*#?\s*([A-Z0-9-]{4,})/i,
  ])

  // Claim Number
  const claimNumber = pickMulti([
    /claim\s*(?:number|#|no\.?|num(?:ber)?)\s*[:-]?\s*([A-Z0-9-]{4,})/i,
    /claim\s*[:-]\s*([A-Z0-9-]{4,})/i,
    /claim\s+reference\s*[:-]?\s*([A-Z0-9-]{4,})/i,
    /file\s+number\s*[:-]?\s*([A-Z0-9-]{4,})/i,
    /loss\s+number\s*[:-]?\s*([A-Z0-9-]{4,})/i,
    /claim\s+id\s*[:-]?\s*([A-Z0-9-]{4,})/i,
  ])

  // Insured Name
  const insuredName = pickMulti([
    /NAMED\s+INSURED\s*(?:&|\band\b)?\s*(?:MAILING\s+)?ADDRESS\s+(?:PRODUCER\s+)?([A-Z][A-Z ,.'-]{3,50}?)(?=\s+(?:PO|P\.?O|[0-9]|\bBOX\b|\bAPT\b|\bSTE\b|\bUNIT\b))/i,
    /named\s+insured\s*[:-]?\s*([A-Z][A-Za-z ,.'-]{3,50})/i,
    /insured\s+name\s*[:-]?\s*([A-Z][A-Za-z ,.'-]{3,50})/i,
    /insured\s*[:-]\s*([A-Z][A-Za-z ,.'-]{3,50})/i,
    /policyholder\s*[:-]?\s*([A-Z][A-Za-z ,.'-]{3,50})/i,
    /name\s+of\s+insured\s*[:-]?\s*([A-Z][A-Za-z ,.'-]{3,50})/i,
    /\binsured\b[^\n]{0,30}\n\s*([A-Z][A-Za-z ,.'-]{3,50})/i,
  ])

  // Insured Address
  const addrCapture = '([0-9][^\\n]{8,120}?)(?=\\s*(?:Insurance|Carrier|Insurer|Policy\\s+Period|Effective|Claim|Deductible|Coverage|Phone|Agent|Date|We\\s+will|$))'
  const insuredAddress = pickMulti([
    new RegExp('(?:LOCATED|SITUATED)\\s+AT\\s*[:-]?\\s*' + addrCapture, 'i'),
    new RegExp('(?:insured\\s+property|property\\s+address)\\s*[:-]?\\s*' + addrCapture, 'i'),
    new RegExp('(?:mailing\\s+address|residence\\s+premises)\\s*[:-]?\\s*' + addrCapture, 'i'),
    new RegExp('(?:location|risk\\s+location|premises\\s+address)\\s*[:-]?\\s*' + addrCapture, 'i'),
    new RegExp('(?:property\\s+location|address\\s+of\\s+property)\\s*[:-]?\\s*' + addrCapture, 'i'),
    new RegExp('location\\s*[:-]\\s*' + addrCapture, 'i'),
    new RegExp('address\\s*[:-]\\s*' + addrCapture, 'i'),
  ])

  // Insurer Name
  const insurerCapture = "([A-Za-z0-9 &.,'-]{3,80}?)(?=\\s*(?:Policy\\s+Period|Effective|Agent|Date|Phone|Claim|Deductible|Coverage|Two\\s+Center|$))"
  const insurerName = pickMulti([
    new RegExp('(?:insurance\\s+company|carrier|insurer)\\s*[:-]?\\s*' + insurerCapture, 'i'),
    /DECLARATIONS\s+([A-Z][A-Z &.,'-]{5,80}?)(?=\s+(?:Two|One|[0-9]|P\.?O|PO\s+BOX))/i,
    /HOMEOWNERS?\s+POLICY\s+DECLARATIONS\s+([A-Z][A-Z &.,'-]{5,80}?)(?=\s+(?:Two|One|[0-9]|P\.?O|PO\s+BOX))/i,
    new RegExp('company\\s+name\\s*[:-]?\\s*' + insurerCapture, 'i'),
    new RegExp('underwriter\\s*[:-]?\\s*' + insurerCapture, 'i'),
    new RegExp('issued\\s+by\\s*[:-]?\\s*' + insurerCapture, 'i'),
    new RegExp('carrier\\s*[:-]\\s*' + insurerCapture, 'i'),
  ])

  // Date of Loss
  const dateOfLoss = pickMulti([
    /date\s+of\s+loss\s*[:-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /loss\s+date\s*[:-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /date\s+of\s+occurrence\s*[:-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ])

  // Deductible
  const deductibleRaw = pickMulti([
    /(?:all\s+other\s+perils\s+)?deductible\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /deductible\s*[-–]\s*section\s+I\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /deductible\s+amount\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /aop\s+deductible\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /all\s+peril(?:s)?\s+deductible\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /deductible\s*[:-]\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ])
  const deductible = money(deductibleRaw)
  const sectionIDeductibleRaw = pickMulti([
    /section\s+i\s+deductible\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /deductible\s*[-–]\s*section\s+I\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ])
  const sectionIDeductible = money(sectionIDeductibleRaw) || deductible

  // Coverage limits
  const coverageA = money(pickMulti([
    /coverage\s*a[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /dwelling[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))
  const coverageB = money(pickMulti([
    /coverage\s*b[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /other\s+structures?[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))
  const coverageC = money(pickMulti([
    /coverage\s*c[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /personal\s+property[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /contents?[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))
  const coverageD = money(pickMulti([
    /coverage\s*d[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /loss\s+of\s+use[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /additional\s+living\s+expense[^$0-9]{0,20}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))

  // Water backup limit
  const waterBackupRaw = pickMulti([
    /(?:water\s+back[\s-]?up|sewer\s+back[\s-]?up|water\s+or\s+sewer\s+back[\s-]?up)[^$]{0,60}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /water\s+damage[^$]{0,60}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ])
  const waterBackupParsed = money(waterBackupRaw)
  const waterBackupLimit = waterBackupParsed && Number(waterBackupParsed.replace(/,/g, '')) >= 1000 ? waterBackupParsed : ''

  // Mold limit
  const moldLimit = money(pickMulti([
    /(?:mold|fungi|mildew|microbial)[^$]{0,80}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))

  // Named storm deductible
  const namedStormDeductible = money(pickMulti([
    /named\s+storm\s+deductible\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /hurricane\s+deductible\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /wind\s*\/\s*hail\s+deductible\s*[:-]?\s*\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))

  // Scheduled jewelry
  const scheduledJewelryLimit = money(pickMulti([
    /scheduled\s+personal\s+property[^$]{0,80}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /jewelry[^$]{0,80}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))
  const scheduledItemsMentioned = has(/scheduled\s+personal\s+property|jewelry|furs|watches|silverware|collectible/i)

  // Identity fraud
  const identityFraudLimit = money(pickMulti([
    /identity\s+(?:fraud|theft)[^$]{0,80}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))

  // Refrigerated property
  const refrigeratedPropertyLimit = money(pickMulti([
    /refrigerated\s+property[^$]{0,80}\$?([0-9,]+(?:\.\d{1,2})?)/i,
    /food\s+spoilage[^$]{0,80}\$?([0-9,]+(?:\.\d{1,2})?)/i,
  ]))

  // Loss settlement type
  const lossSettlementRCV = has(/replacement\s+cost\s+value|rcv\b|replacement\s+cost\s+coverage|replacement\s+cost\s+loss\s+settlement|HO[\s-]?04[\s-]?90/i)
  const lossSettlementACV = has(/actual\s+cash\s+value|acv\b/i)
  const lossSettlementType = lossSettlementRCV && lossSettlementACV
    ? 'RCV/ACV'
    : lossSettlementRCV ? 'RCV' : lossSettlementACV ? 'ACV' : ''

  // Build dashboard — filter out empty strings
  const dashboardRaw: Record<string, string> = {
    policyNumber,
    claimNumber,
    insuredName,
    insuredAddress,
    insurerName,
    deductible: sectionIDeductible || deductible,
    waterBackupLimit,
    dateOfLoss,
  }
  const dashboard: Record<string, string> = {}
  for (const [key, val] of Object.entries(dashboardRaw)) {
    if (val && val.trim()) dashboard[key] = val
  }

  return {
    dashboard,
    insights: {
      hasLossOfUse: has(/loss\s+of\s+use|additional\s+living\s+expense|ale\b/i),
      hasBusinessCoverage: has(/business\s+(?:property|income)|home\s+office|office\s+equipment/i),
      hasMatching: has(/matching|uniform\s+appearance|continuous\s+flooring/i),
      hasOrdinanceLaw: has(/ordinance\s+or\s+law|code\s+upgrade|building\s+code/i),
      hasWaterBackup: has(/water\s+back[\s-]?up|sewer\s+back[\s-]?up|drain\s+back[\s-]?up|sump\s+discharge|sump\s+overflow|HO[\s-]?04[\s-]?95/i),
      hasMedicalPayments: has(/medical\s+payments|med\s*pay|injury\s+expenses/i),
      limits: { A: coverageA, B: coverageB, C: coverageC, D: coverageD },
      sectionIDeductible,
      waterBackupLimit,
      moldLimit,
      namedStormDeductible,
      scheduledJewelryLimit,
      identityFraudLimit,
      refrigeratedPropertyLimit,
      lossSettlementType,
      lossSettlementRCV,
      lossSettlementACV,
      scheduledItemsMentioned,
      rawPolicyText: tSingleSpace.slice(0, 20000),
    },
  }
}
