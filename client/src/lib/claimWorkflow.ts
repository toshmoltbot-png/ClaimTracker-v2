import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { apiClient } from '@/lib/api'
import { fmtUSDate } from '@/lib/dates'
import type { ClaimData, ClaimType, ContentItem, DashboardData, Expenses, PolicyDoc, QuantityUnit, Room } from '@/types/claim'
import type { EnrichItemResponse } from '@/types/api'

export const CLAIM_TYPE_OPTIONS: Array<{ value: ClaimType; label: string }> = [
  { value: 'category3_sewage', label: 'Sewage Backup' },
  { value: 'water', label: 'Water Damage' },
  { value: 'fire', label: 'Fire' },
  { value: 'storm', label: 'Storm' },
  { value: 'other', label: 'Other' },
]

export const ROOM_NAME_PRESETS = [
  'Kitchen',
  'Bathroom',
  'Primary Bedroom',
  'Bedroom',
  'Living Room',
  'Dining Room',
  'Laundry Room',
  'Garage',
  'Basement',
  'Hallway',
  'Office',
  'Closet',
  'Attic',
  'Family Room',
] as const

export const CONTENT_CATEGORIES = [
  'Electronics',
  'Furniture',
  'Toys/Games',
  'Tools',
  'Bags/Luggage',
  'Appliances',
  'Kitchen',
  'Decor',
  'Clothing',
  'Kids Items',
  'Sports/Outdoors',
  'Office',
  'Storage',
  'Books/Media',
  'Other',
] as const

export const QUANTITY_UNITS: QuantityUnit[] = ['each', 'pair', 'set', 'box']
export const DISPOSITION_OPTIONS = ['discarded', 'inspected'] as const
export const POLICY_DOC_TYPES = ['declarations', 'fullpolicy', 'endorsements', 'correspondence', 'other'] as const

export interface DashboardSummary {
  roomsCount: number
  photoCount: number
  itemCount: number
  enrichedCount: number
  enrichedPercent: number
  aiAnalyzedCount: number
  aiCompletionPercent: number
  expensesTotal: number
  readinessPercent: number
}

export interface NextStepSuggestion {
  title: string
  description: string
  actionLabel: string
  targetTab: 'dashboard' | 'claim-info' | 'rooms' | 'photo-library' | 'ai-builder' | 'contents'
}

export interface ReadinessCheck {
  key: string
  label: string
  description: string
  complete: boolean
}

export function formatCurrency(value: number | null | undefined) {
  const safe = Number(value || 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe)
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

export function normalizeDisposition(value: string | null | undefined) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'discard') return 'discarded'
  if (raw === 'inspect') return 'inspected'
  if (raw === 'discarded' || raw === 'inspected') return raw
  return raw
}

function parseNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function countItemPhotos(item: ContentItem) {
  return (item.photos || []).length + (item.evidencePhotos || []).length + (item.sourcePhotoName ? 1 : 0)
}

function totalExpenseEntries(entries: Array<{ amount?: number }> = []) {
  return (entries || []).reduce((sum, entry) => sum + parseNumber(entry.amount), 0)
}

export function getExpensesTotal(expenses: Expenses) {
  return totalExpenseEntries(expenses.laborEntries)
    + totalExpenseEntries(expenses.utilityEntries)
    + totalExpenseEntries(expenses.disposalEntries)
    + totalExpenseEntries(expenses.livingEntries)
    + totalExpenseEntries(expenses.miscEntries)
}

export function getItemTotalValue(item: ContentItem) {
  const quantity = Math.max(1, parseNumber(item.quantity) || 1)
  const unitPrice = parseNumber(item.unitPrice)
  const replacementCost = parseNumber(item.replacementCost)
  const total = parseNumber(item.total)
  if (total > 0) return total
  if (unitPrice > 0) return quantity * unitPrice
  if (replacementCost > 0) return replacementCost
  return 0
}

export function updateContentLineTotal(item: ContentItem): ContentItem {
  const quantity = Math.max(1, parseNumber(item.quantity) || 1)
  const unitPrice = parseNumber(item.unitPrice)
  return { ...item, quantity, unitPrice, total: Number((quantity * unitPrice).toFixed(2)) }
}

export function calcRoomSqft(length: number | string | null | undefined, width: number | string | null | undefined) {
  const sqft = parseNumber(length) * parseNumber(width)
  return sqft > 0 ? Number(sqft.toFixed(2)) : 0
}

export function updateRoomDimensions(room: Room): Room {
  const length = parseNumber(room.length)
  const width = parseNumber(room.width)
  const sqft = calcRoomSqft(length, width)
  return {
    ...room,
    length: length || '',
    width: width || '',
    sqft: sqft || '',
    dimensions: length && width ? `${length} x ${width}` : '',
  }
}

export function populateDashboardFields(data: ClaimData): ClaimData {
  const claim = data.claim || ({} as ClaimData['claim'])
  const dashboard: DashboardData = {
    ...data.dashboard,
    claimNumber: String(data.dashboard.claimNumber || claim.claimNumber || ''),
    policyNumber: String(data.dashboard.policyNumber || claim.policyNumber || ''),
    insuredAddress: String(data.dashboard.insuredAddress || claim.propertyAddress || ''),
    insurerName: String(data.dashboard.insurerName || claim.insurer || ''),
    dateOfLoss: String(data.dashboard.dateOfLoss || claim.dateOfLoss || ''),
  }

  return {
    ...data,
    dashboard,
    claim: {
      ...claim,
      claimNumber: dashboard.claimNumber,
      policyNumber: dashboard.policyNumber,
      propertyAddress: dashboard.insuredAddress,
      insurer: dashboard.insurerName,
      dateOfLoss: dashboard.dateOfLoss,
      incidentType: data.claimType,
    },
  }
}

export function updateDashboardSummary(data: ClaimData): DashboardSummary {
  const contents = (data.contents || []).filter((item) => item.source !== 'receipt' && item.includedInClaim !== false)
  const enrichedCount = contents.filter((item) => Boolean(item.enrichment?.revised || item.enriched)).length
  const aiAnalyzedCount = (data.aiPhotos || []).filter((photo) => String(photo.status || '').toLowerCase() === 'complete').length
  const evidencePhotoCount =
    (data.aiPhotos || []).length
    + (data.photoLibrary || []).length
    + (data.rooms || []).reduce((sum, room) => sum + (room.photos || []).length, 0)
    + contents.reduce((sum, item) => sum + countItemPhotos(item), 0)

  const readinessChecks = buildReadinessChecks(data)
  return {
    roomsCount: (data.rooms || []).length,
    photoCount: evidencePhotoCount,
    itemCount: contents.length,
    enrichedCount,
    enrichedPercent: contents.length ? (enrichedCount / contents.length) * 100 : 0,
    aiAnalyzedCount,
    aiCompletionPercent: (data.aiPhotos || []).length ? (aiAnalyzedCount / data.aiPhotos.length) * 100 : 0,
    expensesTotal: getExpensesTotal(data.expenses),
    readinessPercent: readinessChecks.length ? (readinessChecks.filter((check) => check.complete).length / readinessChecks.length) * 100 : 0,
  }
}

export function buildReadinessChecks(data: ClaimData): ReadinessCheck[] {
  const summary = updateDashboardSummary({ ...data, contents: data.contents || [] })
  const hasPolicy = (data.policyDocs || []).length > 0 || Boolean(data.dashboard.policyNumber || data.claim.policyNumber)
  const hasPhotos = summary.photoCount > 0
  const hasItems = summary.itemCount > 0
  const hasRooms = summary.roomsCount > 0
  const hasExpenses = summary.expensesTotal > 0
  const enrichedReady = summary.itemCount > 0 && summary.enrichedCount > 0

  return [
    { key: 'policy', label: 'Policy details captured', description: 'Claim number, policy number, and carrier basics are filled in.', complete: hasPolicy },
    { key: 'rooms', label: 'Affected rooms listed', description: 'Rooms are present with dimensions and room context.', complete: hasRooms },
    { key: 'photos', label: 'Evidence photos uploaded', description: 'Room, AI, or item-level photos are attached.', complete: hasPhotos },
    { key: 'contents', label: 'Inventory started', description: 'At least one claimable content item exists.', complete: hasItems },
    { key: 'enrichment', label: 'Pricing support added', description: 'One or more inventory items have AI enrichment or justification.', complete: enrichedReady },
    { key: 'expenses', label: 'Expenses tracked', description: 'ALE or incidental claim expenses have been entered.', complete: hasExpenses },
  ]
}

export function getNextStepSuggestion(data: ClaimData): NextStepSuggestion {
  const summary = updateDashboardSummary(data)
  const hasPolicy = (data.policyDocs || []).length > 0 || Boolean(data.dashboard.policyNumber || data.claim.policyNumber)

  if (!hasPolicy) {
    return {
      title: 'Add claim details and policy documents',
      description: 'Start with the carrier details and upload any declarations or policy pages you already have.',
      actionLabel: 'Open Claim Info',
      targetTab: 'claim-info',
    }
  }
  if (!summary.roomsCount) {
    return {
      title: 'Map the affected rooms',
      description: 'Rooms organize the entire claim and power the rest of the inventory flow.',
      actionLabel: 'Add Room',
      targetTab: 'rooms',
    }
  }
  if (!summary.photoCount) {
    return {
      title: 'Add photo evidence',
      description: 'Upload room or item photos so AI analysis and documentation have support.',
      actionLabel: 'Go to AI Builder',
      targetTab: 'ai-builder',
    }
  }
  if (!summary.itemCount) {
    return {
      title: 'Start the contents inventory',
      description: 'Create the first few line items manually or use AI Builder output to seed the list.',
      actionLabel: 'Open Contents',
      targetTab: 'contents',
    }
  }
  if (!summary.enrichedCount) {
    return {
      title: 'Run pricing enrichment',
      description: 'Enrichment adds replacement pricing support and rationale for your inventory.',
      actionLabel: 'Review Contents',
      targetTab: 'contents',
    }
  }
  return {
    title: 'Review the report package',
    description: 'The claim has the main ingredients in place. Review for gaps and generate the report when ready.',
    actionLabel: 'Generate Report',
    targetTab: 'dashboard',
  }
}

export function classifyPolicyDoc(input: string) {
  const t = String(input || '').trim()
  const tSingleSpace = t.replace(/\s+/g, ' ').toLowerCase()
  const hasDeclarationsPattern =
    /declarations\s+page|dec\s+page|policy\s+declarations|declaration/.test(tSingleSpace)
    || (/premium/.test(tSingleSpace) && /deductible/.test(tSingleSpace) && /coverage/.test(tSingleSpace))
  const isFullPolicy =
    t.length >= 12000
    || (/section i/.test(tSingleSpace) && /duties after loss/.test(tSingleSpace))
    || /loss settlement|insuring agreement|conditions applicable/.test(tSingleSpace)
  const isEndorsements = !isFullPolicy && (/endorsement/.test(tSingleSpace) || /rider/.test(tSingleSpace))
  const isCorrespondence = /letter|email|notice|correspondence/.test(tSingleSpace)

  if (isFullPolicy) return 'fullpolicy'
  if (isEndorsements) return 'endorsements'
  if (isCorrespondence) return 'correspondence'
  if (hasDeclarationsPattern) return 'declarations'
  return 'other'
}

export function getPolicyDocTypeLabel(docType: string | null | undefined) {
  if (docType === 'fullpolicy') return 'Full Policy'
  if (docType === 'endorsements') return 'Endorsements'
  if (docType === 'correspondence') return 'Correspondence'
  if (docType === 'declarations') return 'Declarations Page'
  return 'Other'
}

export function computePolicyDocInsights(policyDocs: PolicyDoc[]) {
  return {
    hasDeclarationsPage: policyDocs.some((doc) => (doc.docType || doc.documentType) === 'declarations'),
    hasFullPolicy: policyDocs.some((doc) => (doc.docType || doc.documentType) === 'fullpolicy'),
    hasEndorsements: policyDocs.some((doc) => (doc.docType || doc.documentType) === 'endorsements'),
  }
}

export interface EnrichmentPayload {
  baseline: Record<string, unknown>
  userInput: Record<string, unknown>
  revised?: Record<string, unknown>
  flagged?: boolean
  enrichmentAttemptId?: string
  comps?: Array<Record<string, unknown>>
  ebayMedian?: number | null
  ebayLow?: number | null
  ebayHigh?: number | null
}

export function applyEnrichmentToItem(item: ContentItem, payload: EnrichmentPayload): ContentItem {
  const next = { ...item }
  const priorHistory = Array.isArray(next.enrichment?.history) ? next.enrichment.history : []

  if (next.enrichment?.revised) {
    priorHistory.push({
      revised: next.enrichment.revised,
      flagged: next.enrichment.flagged || false,
      enrichmentAttemptId: next.enrichment.enrichmentAttemptId || null,
      savedAt: new Date().toISOString(),
    })
  }

  next.enrichment = {
    ...(next.enrichment || {}),
    baseline: payload.baseline,
    userInput: payload.userInput,
    revised: payload.revised,
    flagged: payload.flagged,
    enrichmentAttemptId: payload.enrichmentAttemptId,
    comps: payload.comps || [],
    ebayMedian: payload.ebayMedian ?? null,
    ebayLow: payload.ebayLow ?? null,
    ebayHigh: payload.ebayHigh ?? null,
    history: priorHistory,
  }

  if (payload.revised?.contaminationJustification) {
    next.contaminationJustification = String(payload.revised.contaminationJustification)
  }

  const revisedValue = Number(payload.revised?.value)
  const revisedConfidence = Number(payload.revised?.confidence)
  if (Number.isFinite(revisedValue) && revisedValue > 0) {
    next.replacementCost = revisedValue
    next.unitPrice = next.quantity && next.quantity > 1 ? revisedValue / next.quantity : revisedValue
  }
  if (Number.isFinite(revisedConfidence)) {
    next.confidence = revisedConfidence
  }
  const newName = String(payload.revised?.identification || payload.revised?.label || payload.revised?.name || '').trim()
  if (newName && newName.toLowerCase() !== String(next.itemName || '').trim().toLowerCase()) {
    next.originalItemName = next.originalItemName || next.itemName
    next.itemName = newName
  }
  next.enriched = Boolean(payload.revised)
  return updateContentLineTotal(next)
}

export function applyJustificationToItem(item: ContentItem, payload: Pick<EnrichmentPayload, 'revised'>): ContentItem {
  const next = { ...item }
  next.enrichment = {
    ...(next.enrichment || {}),
    revised: {
      ...(next.enrichment?.revised || {}),
      ...(payload.revised || {}),
    },
  }
  if (payload.revised?.contaminationJustification) {
    next.contaminationJustification = String(payload.revised.contaminationJustification)
  }
  return next
}

export function undoEnrichment(item: ContentItem): ContentItem {
  if (!item.enrichment?.revised) return item
  const history = Array.isArray(item.enrichment.history) ? [...item.enrichment.history] : []
  history.push({
    revised: item.enrichment.revised,
    flagged: item.enrichment.flagged || false,
    enrichmentAttemptId: item.enrichment.enrichmentAttemptId || null,
    undoneAt: new Date().toISOString(),
  })

  const baseline = (item.enrichment.baseline || {}) as Record<string, unknown>
  const baselineValue = Number(baseline.value)
  const baselineConfidence = Number(baseline.confidence)
  const next: ContentItem = {
    ...item,
    itemName: item.originalItemName || item.itemName,
    replacementCost: Number.isFinite(baselineValue) && baselineValue > 0 ? baselineValue : item.replacementCost,
    confidence: Number.isFinite(baselineConfidence) ? baselineConfidence : item.confidence,
    enriched: false,
    enrichment: {
      ...(item.enrichment || {}),
      history,
      revised: undefined,
      flagged: undefined,
      comps: [],
      ebayMedian: null,
      ebayLow: null,
      ebayHigh: null,
    },
  }
  delete next.originalItemName
  return updateContentLineTotal(next)
}

export function buildEbayCompsMarkup(enrichment: ContentItem['enrichment']) {
  const comps = Array.isArray(enrichment?.comps) ? enrichment.comps : []
  if (!comps.length) return []
  return comps.map((comp, index) => ({
    id: String(comp.id || comp.url || index),
    title: String(comp.title || comp.name || `Comp ${index + 1}`),
    price: formatCurrency(Number(comp.price || comp.value || 0)),
    url: String(comp.url || 'https://www.ebay.com'),
  }))
}

export function buildEnrichmentAuditMarkup(item: ContentItem) {
  const enrichment = item.enrichment
  const revised = (enrichment?.revised || null) as Record<string, unknown> | null
  if (!revised) return []
  const baseline = (enrichment?.baseline || {}) as Record<string, unknown>
  const baselineValue = Number(baseline.value)
  const revisedValue = Number(revised.value)
  const history = Array.isArray(enrichment?.history) ? enrichment.history : []

  return [
    { label: 'Current identification', value: String(revised.identification || revised.label || revised.name || item.itemName || '—') },
    { label: 'Baseline value', value: Number.isFinite(baselineValue) ? formatCurrency(baselineValue) : '—' },
    { label: 'Revised value', value: Number.isFinite(revisedValue) ? formatCurrency(revisedValue) : '—' },
    { label: 'Pricing basis', value: String(revised.pricingBasis || revised.source || 'AI estimate') },
    { label: 'Updated', value: String(revised.timestamp || revised.savedAt || '—') },
    { label: 'Audit history', value: history.length ? `${history.length} prior revision${history.length === 1 ? '' : 's'}` : 'No prior revisions' },
  ]
}

export function deduplicateItemsBySourcePhotos(items: ContentItem[]) {
  const seen = new Map<string, ContentItem>()
  for (const item of items) {
    const key = [
      String(item.itemName || '').trim().toLowerCase(),
      String(item.roomId || item.room || '').trim().toLowerCase(),
      String(item.sourcePhotoName || '').trim().toLowerCase(),
    ]
      .filter(Boolean)
      .join('|')

    if (!key) {
      seen.set(`item:${item.id}`, item)
      continue
    }
    if (!seen.has(key)) {
      seen.set(key, item)
    }
  }
  return Array.from(seen.values())
}

export function deduplicateDraftItemsBySourcePhotos(items: ContentItem[]) {
  return deduplicateItemsBySourcePhotos(items)
}

export async function submitEnrichItem(item: ContentItem, options?: { justifyMode?: boolean }) {
  const justifyMode = options?.justifyMode === true
  const baseline = {
    value: Number(item.replacementCost || item.unitPrice || 0),
    confidence: Number(item.confidence || 0),
    timestamp: new Date().toISOString(),
  }
  const response = await apiClient.enrichItem({
    itemId: item.id,
    itemName: String(item.itemName || ''),
    category: item.category,
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    enrichmentAttemptId: crypto.randomUUID(),
    baseline,
    userInput: ((item.enrichment?.userInput as Record<string, unknown> | undefined) || {}),
    imageUrls: (item.photos || []).map((photo) => String(photo.url || '')).filter(Boolean),
    images: [],
    justifyMode,
    fixedPrice: justifyMode ? Number(item.replacementCost || item.unitPrice || 0) : undefined,
    replacementLink: justifyMode ? String(item.replacementLink || '').trim() : undefined,
  })
  return { response, baseline }
}

export function applyEnrichmentResponse(item: ContentItem, response: EnrichItemResponse, baseline: Record<string, unknown>) {
  const revised = (response.revised || {}) as Record<string, unknown>
  return applyEnrichmentToItem(item, {
    baseline,
    userInput: ((item.enrichment?.userInput as Record<string, unknown> | undefined) || {}),
    revised,
    flagged: Boolean(response.flagged),
    enrichmentAttemptId: response.enrichmentAttemptId || crypto.randomUUID(),
    comps: response.comps || [],
    ebayMedian: response.ebayMedian ?? null,
    ebayLow: response.ebayLow ?? null,
    ebayHigh: response.ebayHigh ?? null,
  })
}

export function applyJustificationResponse(item: ContentItem, response: EnrichItemResponse) {
  return applyJustificationToItem(item, { revised: (response.revised || {}) as Record<string, unknown> })
}

export function generateContentsChecklistPDF(data: ClaimData, mode: 'download' | 'print' = 'download') {
  const items = (data.contents || []).filter((item) => item.source !== 'receipt' && item.includedInClaim !== false)
  if (!items.length) {
    throw new Error('No contents items match these filters.')
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const claimNumber = data.dashboard.claimNumber || data.claim.claimNumber || 'N/A'
  const generated = new Date()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Contents Checklist', 14, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Claim #${claimNumber}`, 14, 22)
  doc.text(`Generated ${fmtUSDate(generated)}`, 14, 27)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 32,
    head: [['Item', 'Room', 'Category', 'Qty', 'Value']],
    body: items.map((item) => [
      String(item.itemName || 'Unnamed item'),
      String(item.room || 'Unassigned'),
      String(item.category || 'Other'),
      String(item.quantity || 1),
      formatCurrency(getItemTotalValue(item)),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 41, 59], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: { 4: { halign: 'right' } },
  })

  const fileName = `contents-checklist-${String(claimNumber).replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'claim'}.pdf`
  if (mode === 'print') {
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const win = window.open(url)
    if (!win) {
      URL.revokeObjectURL(url)
      throw new Error('Popup blocked. Please allow popups to print.')
    }
    setTimeout(() => {
      win.focus()
      win.print()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }, 300)
    return
  }
  doc.save(fileName)
}
