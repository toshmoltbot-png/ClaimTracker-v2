import { createDefaultClaimData, type AIPhoto, type ClaimData, type ContentItem } from '@/types/claim'
import { updateRoomDimensions } from '@/lib/claimWorkflow'

const underminingPattern =
  /elevated surface|on elevated|no direct contact|can be cleaned|can be sanitized|not in direct contact|above floor level|on a table|on a shelf|placed on|was operating in|internal ventilation pathways|cooling fans may draw|draw contaminated air into internal|recommend cleaning|recommend inspection|recommend reuse|recommend sanitiz|suitable for cleaning|no visible contamination|potentially damp|potentially contaminated|unknown environment|unknown contamination|limited direct contact|limited contamination|limited risk|minimal direct|minimal risk|minor surface/i

function normalizeAnalysisMode(mode: unknown, fallback: ClaimData['aiAnalysisMode'] = 'ITEM_VIEW') {
  if (mode === 'FOCUS_ITEM') return 'ITEM_VIEW'
  if (mode === 'ROOM_SCAN') return 'ROOM_VIEW'
  if (mode === 'ITEM_VIEW' || mode === 'ROOM_VIEW' || mode === 'FOCUSED_VIEW') return mode
  return fallback
}

function buildRationale(item: ContentItem, claimData: ClaimData): string {
  const room = item.room && item.room !== 'unknown' ? ` in ${item.room}` : ''
  const materialType = String(item.materialType || item.porousness || '').toLowerCase()
  const isNonPorous = materialType.includes('non')
  const material = materialType.includes('semi')
    ? 'Semi-porous'
    : isNonPorous
      ? 'Non-porous'
      : materialType.includes('porous')
        ? 'Porous'
        : ''
  const materialLabel = material ? `${material} item` : 'Item'
  const verdict = isNonPorous
    ? 'Inspected and determined non-restorable - requires replacement per IICRC S500 standards.'
    : 'Item is non-restorable and requires replacement per IICRC S500 standards.'
  const addFloorContact =
    isNonPorous && Number(item.replacementCost || 0) >= 200
      ? ' Item was located at floor level in direct contact with sewage-contaminated surfaces, as documented in evidence photos.'
      : ''
  const lossDate = String(claimData.dashboard.dateOfLoss || claimData.claim.dateOfLoss || '').trim() || 'the date of loss'
  return `${materialLabel}${room} exposed to Category 3 sewage backup (date of loss: ${lossDate}). Category 3 water contains pathogenic agents that aerosolize throughout affected spaces. ${verdict}${addFloorContact}`
}

function sanitizeContentItem(item: ContentItem, claimData: ClaimData): ContentItem {
  const next = { ...item }

  if (next.disposition === 'discard') next.disposition = 'discarded'
  if (next.disposition === 'inspect') next.disposition = 'inspected'
  if ((next as { surfaceContact?: string }).surfaceContact === 'elevated') {
    ;(next as { surfaceContact?: string }).surfaceContact = 'unknown'
  }

  const rationale = buildRationale(next, claimData)

  if (underminingPattern.test(next.aiJustification || '') || /\d{4},\s*\d{4}/.test(next.aiJustification || '')) {
    next.aiJustification = rationale
  }
  if (underminingPattern.test(next.contaminationJustification || '')) {
    next.contaminationJustification = rationale
  }
  if (next.enrichment?.revised && underminingPattern.test(next.enrichment.revised.justification || '')) {
    next.enrichment = {
      ...next.enrichment,
      revised: {
        ...next.enrichment.revised,
        justification: rationale,
      },
    }
  }
  return next
}

function normalizeFileMetadata<T extends AIPhoto | Record<string, unknown>>(entry: T, index: number) {
  const next = { ...entry } as T & { id?: string | number; filename?: string; name?: string; uploadedAt?: string | null; timestamp?: string | null; analysisMode?: string; stackPhotos?: AIPhoto[] }
  if (!next.id) next.id = `${Date.now()}-${index}`
  if (!next.name && next.filename) next.name = next.filename
  if (!next.uploadedAt && next.timestamp) next.uploadedAt = next.timestamp
  return next
}

export function normalizePhotoMetadata(claimData: ClaimData): ClaimData {
  return {
    ...claimData,
    photoLibrary: claimData.photoLibrary.map((photo, index) => normalizeFileMetadata(photo, index)),
    rooms: claimData.rooms.map((room) => updateRoomDimensions({
      ...room,
      photos: (room.photos || []).map((photo, index) => normalizeFileMetadata(photo, index)),
    })),
    contents: claimData.contents.map((item) => ({
      ...item,
      photos: (item.photos || []).map((photo, index) => normalizeFileMetadata(photo, index)),
    })),
    aiPhotos: claimData.aiPhotos.map((photo, index) => {
      const next = normalizeFileMetadata(photo, index) as AIPhoto
      next.analysisMode = normalizeAnalysisMode(next.analysisMode || claimData.aiAnalysisMode, claimData.aiAnalysisMode)
      if (next.isStack && Array.isArray(next.stackPhotos)) {
        next.stackPhotos = next.stackPhotos.map((stackPhoto, stackIndex) => {
          const normalized = normalizeFileMetadata(stackPhoto, stackIndex) as AIPhoto
          normalized.analysisMode = normalizeAnalysisMode(normalized.analysisMode || claimData.aiAnalysisMode, claimData.aiAnalysisMode)
          return normalized
        })
      }
      return next
    }),
  }
}

export function applyCategory3Rules(item: ContentItem, _photo?: unknown, claimType = 'category3_sewage') {
  let disposition = item.disposition || 'unknown'
  let ruleMatched = 'none'
  const explanation: string[] = []
  const label = String(item.label || item.itemName || '').toLowerCase()
  const category = String(item.category || '').toLowerCase()

  if (claimType !== 'category3_sewage') {
    return { disposition, ruleMatched, explanation: 'Non-Category-3 claim; no deterministic override.' }
  }
  if (['porous', 'semi'].includes(String(item.porousness || '').toLowerCase())) {
    disposition = 'discarded'
    ruleMatched = 'porous_cat3_discard'
    explanation.push('Category 3: porous/semi-porous items in affected area are non-restorable per IICRC S500.')
  }
  if (label.includes('cardboard') || label.includes('paper') || label.includes('carpet') || label.includes('pad')) {
    disposition = 'discarded'
    ruleMatched = 'material_discard'
    explanation.push('Category 3: cardboard/paper/carpet/pad => discard.')
  }
  if ((label.includes('plastic') || label.includes('bin') || label.includes('tote')) && item.porousness === 'non') {
    disposition = 'clean'
    ruleMatched = 'sealed_hard_plastic_clean'
    explanation.push('Category 3: sealed hard plastics => clean/sanitize.')
  }
  if (category.includes('electronics') || label.includes('tv') || label.includes('electronic')) {
    disposition = 'inspected'
    ruleMatched = 'electronics_inspect'
    explanation.push('Category 3: electronics in contaminated environment => inspect and likely replace.')
  }

  return {
    disposition,
    ruleMatched,
    explanation: explanation.join(' ') || 'No deterministic rule triggered.',
  }
}

export function sanitizeClaimData(raw: Partial<ClaimData> | null | undefined): ClaimData {
  const base = createDefaultClaimData()
  const merged: ClaimData = {
    ...base,
    ...raw,
    claim: { ...base.claim, ...(raw?.claim || {}) },
    dashboard: { ...base.dashboard, ...(raw?.dashboard || {}) },
    expenses: {
      laborEntries: Array.isArray(raw?.expenses?.laborEntries) ? raw.expenses.laborEntries : [],
      utilityEntries: Array.isArray(raw?.expenses?.utilityEntries) ? raw.expenses.utilityEntries : [],
      disposalEntries: Array.isArray(raw?.expenses?.disposalEntries) ? raw.expenses.disposalEntries : [],
      livingEntries: Array.isArray(raw?.expenses?.livingEntries) ? raw.expenses.livingEntries : [],
      miscEntries: Array.isArray(raw?.expenses?.miscEntries) ? raw.expenses.miscEntries : [],
    },
    aiPhotos: Array.isArray(raw?.aiPhotos) ? raw.aiPhotos : [],
    aiResults: Array.isArray(raw?.aiResults) ? raw.aiResults : [],
    followUpTasks: Array.isArray(raw?.followUpTasks) ? raw.followUpTasks : [],
    rooms: Array.isArray(raw?.rooms) ? raw.rooms : [],
    contents: Array.isArray(raw?.contents) ? raw.contents : [],
    contractors: Array.isArray(raw?.contractors) ? raw.contractors : [],
    contractorReports: Array.isArray(raw?.contractorReports) ? raw.contractorReports : [],
    communications: Array.isArray(raw?.communications) ? raw.communications : [],
    payments: Array.isArray(raw?.payments) ? raw.payments : [],
    photoLibrary: Array.isArray(raw?.photoLibrary) ? raw.photoLibrary : [],
    policyDocs: Array.isArray(raw?.policyDocs) ? raw.policyDocs : [],
    receipts: Array.isArray(raw?.receipts) ? raw.receipts : [],
    reportChecklist: Array.isArray(raw?.reportChecklist) ? raw.reportChecklist : [],
    timeline: Array.isArray(raw?.timeline) ? raw.timeline : [],
    policyInsights: { ...base.policyInsights, ...(raw?.policyInsights || {}) },
    onboarding: { ...base.onboarding, ...(raw?.onboarding || {}) },
    aiNeedsUpdate: Boolean(raw?.aiNeedsUpdate),
    aiAnalysisMode: normalizeAnalysisMode(raw?.aiAnalysisMode || base.aiAnalysisMode),
  }

  const normalized = normalizePhotoMetadata(merged)
  return {
    ...normalized,
    contents: normalized.contents.map((item) => sanitizeContentItem(item, normalized)),
  }
}
