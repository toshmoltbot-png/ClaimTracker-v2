import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { apiClient } from '@/lib/api'
import { uploadFile } from '@/lib/firebase'

import { extractPolicyText } from '@/lib/policyParser'

export async function uploadAndAnalyzeContractorReport(file: File) {
  const mimeType = file.type || 'application/octet-stream'
  const isPdfOrText = mimeType.startsWith('text/') || mimeType.includes('pdf') || /\.(txt|md|csv|json|pdf)$/i.test(file.name)
  const text = isPdfOrText ? await extractPolicyText(file) : ''
  const uploaded = await uploadFile(file, 'contractor-reports')
  
  let analysis: Record<string, any> = {}
  try {
    analysis = await apiClient.analyzeContractorReport({
      text,
      fileName: file.name,
      mimeType,
      documentUrl: uploaded.url || undefined,
    })
  } catch (err) {
    console.warn('Contractor report AI analysis failed, falling back to basic metadata:', err)
    analysis = {
      structuredFindings: text ? text.split(/\n+/).map((e) => e.trim()).filter(Boolean).slice(0, 5) : [`Uploaded ${file.name}`],
      recommendations: ['Review the report against the contractor scope and estimate.'],
    }
  }

  const report: ContractorReport = {
    id: crypto.randomUUID(),
    ...uploaded,
    companyName: String(analysis.companyName || ''),
    contactName: String(analysis.contactName || ''),
    trade: String(analysis.trade || analysis.damageCategory || ''),
    structuredFindings: Array.isArray(analysis.structuredFindings) ? analysis.structuredFindings : analysis.findings || [],
    recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
    workDescription: String(analysis.workDescription || ''),
    serviceStartDate: String(analysis.serviceStartDate || ''),
    serviceEndDate: String(analysis.serviceEndDate || ''),
    totalAmount: Number(analysis.totalAmount || 0),
    amount: Number(analysis.totalAmount || 0),
    affectedRooms: Array.isArray(analysis.affectedRooms) ? analysis.affectedRooms : [],
    keyLineItems: Array.isArray(analysis.keyLineItems) ? analysis.keyLineItems : [],
  }
  return report
}
import { fmtUSDate } from '@/lib/dates'
import { applyCategory3Rules } from '@/lib/sanitizer'
import { dataUrlToBase64, upsertById } from '@/lib/utils'
import type {
  AIDetectedItem,
  AIPhoto,
  AIResultRecord,
  AnalysisMode,
  ClaimData,
  ClaimType,
  Communication,
  ContentItem,
  Contractor,
  ContractorReport,
  DashboardData,
  ExpenseEntry,
  Expenses,
  FileItem,
  FloorPlan,
  Payment,
  PolicyDoc,
  QuantityUnit,
  Receipt,
  ReceiptLineItem,
  Room,
  TimelineEvent,
} from '@/types/claim'
import type { EnrichItemResponse } from '@/types/api'

export const ONBOARDING_COMPLETE_KEY = 'claimtracker_onboarding_complete'
export const ONBOARDING_STEP_KEY = 'claimtracker_wizard_step'
export const ONBOARDING_TIP_PREFIX = 'claimtracker_onboarding_tip_'

export const CLAIM_TYPE_OPTIONS: Array<{ value: ClaimType; label: string }> = [
  { value: 'category3_sewage', label: 'Sewage Backup' },
  { value: 'water', label: 'Water Damage' },
  { value: 'fire', label: 'Fire' },
  { value: 'storm', label: 'Storm' },
  { value: 'wind_hail', label: 'Wind / Hail' },
  { value: 'theft', label: 'Theft' },
  { value: 'vandalism', label: 'Vandalism' },
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
export const RECEIPT_CATEGORIES = ['cleanup_supplies', 'protective_equipment', 'tools', 'replacement', 'other'] as const
export const EXPENSE_CATEGORY_OPTIONS = [
  'Lodging',
  'Food',
  'Transportation',
  'Utilities',
  'Storage',
  'Laundry',
  'Pet Care',
  'Emergency Mitigation - Cleanup',
  'Disposal',
  'Other',
] as const
export const COMMUNICATION_TYPE_OPTIONS = ['phone', 'email', 'in-person', 'letter'] as const
export const COMMUNICATION_PARTY_OPTIONS = ['adjuster', 'contractor', 'attorney', 'agent', 'insurer', 'landlord', 'other'] as const
export const PAYMENT_TYPE_OPTIONS = ['advance', 'partial', 'final', 'supplement'] as const
export const TIMELINE_CATEGORY_OPTIONS = ['Incident', 'Insurance', 'Remediation', 'Repair', 'Legal', 'Other'] as const
const ANALYZE_RETRYABLE_STATUS = new Set([429, 502, 503, 504])

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

export interface FloorPlanRoomLayout {
  id: string
  roomId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
  color: string
  label: string
  dimensionsLabel: string
  sqft: number
  visible: boolean
  rotation: number
  zIndex: number
}

export interface PhotoLibraryEntry {
  id: string
  sourceType: 'library' | 'room' | 'ai'
  photo: FileItem | AIPhoto
  roomId: string | null
  roomName: string
  name: string
  previewUrl: string
  uploadedAt: string
  analysisMode: AnalysisMode | ''
  aiResultId: string | null
  aiItemCount: number
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

export function normalizeAnalysisMode(mode: unknown, fallback: AnalysisMode = 'ITEM_VIEW'): AnalysisMode {
  if (mode === 'FOCUS_ITEM') return 'ITEM_VIEW'
  if (mode === 'ROOM_SCAN') return 'ROOM_VIEW'
  if (mode === 'ITEM_VIEW' || mode === 'ROOM_VIEW' || mode === 'FOCUSED_VIEW') return mode
  return fallback
}

export function analysisModeLabel(mode: unknown) {
  const normalized = normalizeAnalysisMode(mode)
  if (normalized === 'ROOM_VIEW') return 'Room View'
  if (normalized === 'FOCUSED_VIEW') return 'Focused View'
  return 'Item View'
}

export function mapAnalysisModeToBackend(mode: unknown) {
  const normalized = normalizeAnalysisMode(mode)
  if (normalized === 'ROOM_VIEW') return 'ROOM_SCAN'
  if (normalized === 'FOCUSED_VIEW') return 'ROOM_SCAN'
  return 'FOCUS_ITEM'
}

export function mapAnalysisModeToPrescreenType(mode: unknown) {
  const normalized = normalizeAnalysisMode(mode)
  if (normalized === 'ROOM_VIEW') return 'room_scan'
  if (normalized === 'FOCUSED_VIEW') return 'focused_view'
  return 'focus_item'
}

export function mapPrescreenTypeToAnalysisMode(type: unknown): AnalysisMode {
  const raw = String(type || '').toLowerCase()
  if (raw === 'room_scan' || raw === 'room_view') return 'ROOM_VIEW'
  if (raw === 'focused_view' || raw === 'focus_area') return 'FOCUSED_VIEW'
  return 'ITEM_VIEW'
}

function parseNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export function parseMoneyValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '').replace(/[^0-9.\-]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStringList(values: unknown) {
  return Array.isArray(values) ? values.map((value) => String(value)).filter(Boolean) : []
}

function getDetectedItemLabel(item: AIDetectedItem) {
  return String(item.label || item.name || 'Unnamed item').trim() || 'Unnamed item'
}

function countItemPhotos(item: ContentItem) {
  return (item.photos || []).length + (item.evidencePhotos || []).length + (item.sourcePhotoName ? 1 : 0)
}

function totalExpenseEntries(entries: Array<{ amount?: number }> = []) {
  return (entries || []).reduce((sum, entry) => sum + parseNumber(entry.amount), 0)
}

export function calcExpenseDays(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 0
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  return diff > 0 ? diff : 0
}

export function updateExpenseLineTotal(entry: ExpenseEntry) {
  const category = String(entry.category || '').toLowerCase()
  const nextLineItems = Array.isArray(entry.lineItems)
    ? entry.lineItems.map((line, index) => ({
        id: line.id || `line-${index + 1}`,
        description: String(line.description || ''),
        amount: Number(parseMoneyValue(line.amount).toFixed(2)),
      }))
    : []
  const lineItemsTotal = nextLineItems.reduce((sum, line) => sum + parseMoneyValue(line.amount), 0)
  const totalDays = calcExpenseDays(entry.dateStart, entry.dateEnd) || entry.totalDays || 0
  let amount = parseMoneyValue(entry.amount)

  if (category === 'utilities') {
    amount = parseMoneyValue(entry.dailyCostIncrease) * totalDays
  } else if (category === 'lodging' || category === 'food' || category === 'transportation' || category === 'storage' || category === 'laundry' || category === 'pet care') {
    amount = lineItemsTotal > 0 ? lineItemsTotal : parseMoneyValue(entry.dailyCost) * totalDays || amount
  } else if (category === 'cleanup labor' || category === 'emergency mitigation - cleanup') {
    amount = parseMoneyValue(entry.hours) * parseMoneyValue(entry.hourlyRate)
  } else if (lineItemsTotal > 0) {
    amount = lineItemsTotal
  }

  return {
    ...entry,
    totalDays: totalDays || undefined,
    lineItems: nextLineItems,
    amount: Number(amount.toFixed(2)),
  }
}

function getExpenseBucket(category: string | null | undefined) {
  const normalized = String(category || 'Other').trim().toLowerCase()
  if (normalized === 'utilities') return 'utilityEntries'
  if (normalized === 'cleanup labor' || normalized === 'emergency mitigation - cleanup') return 'laborEntries'
  if (normalized === 'disposal') return 'disposalEntries'
  if (['lodging', 'food', 'transportation', 'storage', 'laundry', 'pet care'].includes(normalized)) return 'livingEntries'
  return 'miscEntries'
}

export function createExpenseEntryDraft(category = 'Lodging'): ExpenseEntry {
  const normalized = category || 'Lodging'
  const isDatedRange = normalized === 'Utilities' || ['Lodging', 'Food', 'Transportation', 'Storage', 'Laundry', 'Pet Care'].includes(normalized)
  return updateExpenseLineTotal({
    id: crypto.randomUUID(),
    category: normalized,
    vendor: '',
    description: '',
    date: '',
    dateStart: isDatedRange ? '' : undefined,
    dateEnd: isDatedRange ? '' : undefined,
    dailyCost: 0,
    dailyCostIncrease: 0,
    totalDays: 0,
    amount: 0,
    utilityType: normalized === 'Utilities' ? 'Heat' : '',
    lineItems: [{ id: crypto.randomUUID(), description: '', amount: 0 }],
  })
}

export function getExpenseEntriesByCategory(expenses: Expenses) {
  const groups = [
    ...((expenses.laborEntries || []).map((entry) => ({ ...entry, category: entry.category || 'Emergency Mitigation - Cleanup' }))),
    ...((expenses.utilityEntries || []).map((entry) => ({ ...entry, category: entry.category || 'Utilities' }))),
    ...((expenses.disposalEntries || []).map((entry) => ({ ...entry, category: entry.category || 'Disposal' }))),
    ...((expenses.livingEntries || []).map((entry) => ({ ...entry, category: entry.category || 'Lodging' }))),
    ...((expenses.miscEntries || []).map((entry) => ({ ...entry, category: entry.category || 'Other' }))),
  ].map((entry) => updateExpenseLineTotal(entry))

  return groups.sort((left, right) => {
    const leftDate = new Date(left.dateStart || left.date || 0).getTime()
    const rightDate = new Date(right.dateStart || right.date || 0).getTime()
    return rightDate - leftDate
  })
}

export function getExpenseCategoryBreakdown(expenses: Expenses) {
  return getExpenseEntriesByCategory(expenses).reduce<Record<string, number>>((totals, entry) => {
    const key = String(entry.category || 'Other')
    totals[key] = Number(((totals[key] || 0) + parseMoneyValue(entry.amount)).toFixed(2))
    return totals
  }, {})
}

export function updateExpenseBuffer(expenses: Expenses, enabled: boolean) {
  return {
    ...expenses,
    bufferEnabled: enabled,
  }
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

export function upsertExpenseEntry(expenses: Expenses, entry: ExpenseEntry): Expenses {
  const nextEntry = updateExpenseLineTotal(entry)
  const bucket = getExpenseBucket(nextEntry.category)
  return {
    ...expenses,
    [bucket]: upsertById(expenses[bucket] || [], nextEntry),
  }
}

export function removeExpenseEntry(expenses: Expenses, entry: ExpenseEntry): Expenses {
  const bucket = getExpenseBucket(entry.category)
  return {
    ...expenses,
    [bucket]: (expenses[bucket] || []).filter((item) => String(item.id) !== String(entry.id)),
  }
}

export function calcRoomSqft(length: number | string | null | undefined, width: number | string | null | undefined) {
  const sqft = parseNumber(length) * parseNumber(width)
  return sqft > 0 ? Number(sqft.toFixed(2)) : 0
}

function formatFeetInches(decimalFeet: number): string {
  if (!decimalFeet) return ''
  const ft = Math.floor(decimalFeet)
  const inches = Math.round((decimalFeet - ft) * 12)
  if (inches === 0) return `${ft} ft`
  if (inches === 12) return `${ft + 1} ft`
  return `${ft} ft ${inches} in`
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
    dimensions: length && width ? `${formatFeetInches(length)} x ${formatFeetInches(width)}` : '',
  }
}

export function ensureFloorPlanSettings(floorPlan: FloorPlan | null | undefined): FloorPlan {
  return {
    ...(floorPlan || {}),
    snapEnabled: floorPlan?.snapEnabled ?? true,
    showConnections: floorPlan?.showConnections ?? true,
    showLabels: floorPlan?.showLabels ?? true,
    showDimensions: floorPlan?.showDimensions ?? true,
    scale: Number(floorPlan?.scale || 0) || undefined,
  }
}

export function getRoomDimensions(room: Room) {
  const length = parseNumber(room.length)
  const width = parseNumber(room.width)
  if (length > 0 && width > 0) {
    return {
      length,
      width,
      warning: false,
      label: `${length.toFixed(1)} x ${width.toFixed(1)} ft`,
    }
  }
  const sqft = parseNumber(room.sqft)
  if (sqft > 0) {
    const side = Math.sqrt(sqft)
    return {
      length: side,
      width: side,
      warning: false,
      label: `${sqft.toFixed(1)} sq ft`,
    }
  }
  return {
    length: 10,
    width: 10,
    warning: true,
    label: 'No dimensions',
  }
}

export function getRoomColor(name: string | null | undefined) {
  const key = String(name || '').toLowerCase()
  const palettes = [
    { match: ['kitchen'], fill: '#f59e0b' },
    { match: ['bath', 'bathroom', 'wash'], fill: '#38bdf8' },
    { match: ['bed', 'bedroom'], fill: '#a78bfa' },
    { match: ['living', 'family'], fill: '#34d399' },
    { match: ['hall', 'entry', 'foyer'], fill: '#f472b6' },
    { match: ['laundry'], fill: '#fb7185' },
    { match: ['garage'], fill: '#94a3b8' },
    { match: ['basement'], fill: '#60a5fa' },
    { match: ['office', 'study'], fill: '#f97316' },
  ]
  return palettes.find((palette) => palette.match.some((entry) => key.includes(entry)))?.fill || '#334155'
}

export function computeFloorPlanScale(containerWidth: number, containerHeight: number, rooms: Room[]) {
  const padding = 32
  const usableWidth = Math.max(200, containerWidth - padding)
  const usableHeight = Math.max(240, containerHeight - padding)

  // Find the largest single-room dimensions (width and height independently)
  let maxWidth = 10
  let maxHeight = 10
  for (const room of rooms || []) {
    const dims = getRoomDimensions(room)
    // Account for rotation: the room may be rotated 90°, swapping width/height
    const rotation = Number(room.floorPlanRotation) || 0
    const isRotated = rotation === 90 || rotation === 270
    const w = isRotated ? dims.length : dims.width
    const h = isRotated ? dims.width : dims.length
    maxWidth = Math.max(maxWidth, w)
    maxHeight = Math.max(maxHeight, h)
  }

  // Scale must fit the largest room in BOTH axes (with 80% margin for other rooms)
  const scaleByWidth = Math.floor((usableWidth * 0.8) / maxWidth)
  const scaleByHeight = Math.floor((usableHeight * 0.8) / maxHeight)
  const scale = Math.min(scaleByWidth, scaleByHeight, 24)
  return Math.max(6, scale || 12)
}

export function snapFloorPlanPoint(x: number, y: number, scale: number, enabled: boolean) {
  if (!enabled) return { x, y }
  const grid = Math.max(8, scale)
  return {
    x: Math.round(x / grid) * grid,
    y: Math.round(y / grid) * grid,
  }
}

export function buildFloorPlanRooms(containerWidth: number, containerHeight: number, rooms: Room[], _floorPlan?: FloorPlan | null): FloorPlanRoomLayout[] {
  // Always compute scale from room dimensions to prevent overflow
  const scale = computeFloorPlanScale(containerWidth, containerHeight, rooms)
  const padding = 18
  const gap = 18
  let currentX = padding
  let currentY = padding
  let columnWidth = 0

  return rooms.map((room) => {
    const dims = getRoomDimensions(room)
    const width = Math.max(32, Math.round(dims.width * scale))
    const height = Math.max(32, Math.round(dims.length * scale))
    const hasStoredPosition = Number.isFinite(room.floorPlanX) && Number.isFinite(room.floorPlanY)
    if (!hasStoredPosition) {
      if (currentY + height > containerHeight - padding) {
        currentY = padding
        currentX += columnWidth + gap
        columnWidth = 0
      }
      columnWidth = Math.max(columnWidth, width)
    }
    const centerX = hasStoredPosition ? parseNumber(room.floorPlanX) * scale : currentX + width / 2
    const centerY = hasStoredPosition ? parseNumber(room.floorPlanY) * scale : currentY + height / 2
    if (!hasStoredPosition) {
      currentY += height + gap
    }
    const rotation = parseNumber(room.floorPlanRotation) || 0
    const isRotated = rotation === 90 || rotation === 270
    const renderWidth = isRotated ? height : width
    const renderHeight = isRotated ? width : height
    return {
      id: `room-${room.id}`,
      roomId: room.id,
      name: String(room.name || 'Room'),
      x: centerX - renderWidth / 2,
      y: centerY - renderHeight / 2,
      width: renderWidth,
      height: renderHeight,
      centerX,
      centerY,
      color: getRoomColor(room.name),
      label: String(room.name || 'Room'),
      dimensionsLabel: dims.label,
      sqft: parseNumber(room.sqft) || Number((dims.length * dims.width).toFixed(1)),
      visible: room.floorPlanVisible !== false,
      rotation,
      zIndex: parseNumber(room.floorPlanZIndex) || 0,
    }
  })
}

export function computeFloorPlanUnionSqft(rooms: Array<Pick<FloorPlanRoomLayout, 'x' | 'y' | 'width' | 'height' | 'visible'>>, scale: number) {
  const visible = rooms.filter((room) => room.visible !== false && room.width > 0 && room.height > 0)
  if (!visible.length || !scale) return 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  visible.forEach((room) => {
    minX = Math.min(minX, room.x)
    minY = Math.min(minY, room.y)
    maxX = Math.max(maxX, room.x + room.width)
    maxY = Math.max(maxY, room.y + room.height)
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(maxX - minX))
  canvas.height = Math.max(1, Math.ceil(maxY - minY))
  const context = canvas.getContext('2d')
  if (!context) return 0
  context.fillStyle = '#fff'
  visible.forEach((room) => {
    context.fillRect(room.x - minX, room.y - minY, room.width, room.height)
  })
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let filled = 0
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 0) filled += 1
  }
  return Number((filled / (scale * scale)).toFixed(1))
}

export function toggleFloorPlanSnap(data: ClaimData, enabled: boolean) {
  return {
    ...data,
    floorPlan: {
      ...ensureFloorPlanSettings(data.floorPlan),
      snapEnabled: enabled,
    },
  }
}

export function updateFloorPlanVisibility(data: ClaimData, roomId: string, visible: boolean) {
  return {
    ...data,
    rooms: data.rooms.map((room) => (
      String(room.id) === String(roomId) ? { ...room, floorPlanVisible: visible } : room
    )),
  }
}

function hasExistingClaimData(data: ClaimData) {
  const dashboard = data.dashboard || ({} as ClaimData['dashboard'])
  const claim = data.claim || ({} as ClaimData['claim'])
  const dashboardFilled = Object.values(dashboard).some((value) => String(value || '').trim())
  const claimFilled = Object.values(claim).some((value) => String(value || '').trim())
  if (dashboardFilled || claimFilled) return true
  const arrays: Array<keyof ClaimData> = [
    'rooms',
    'contents',
    'contractors',
    'contractorReports',
    'communications',
    'payments',
    'photoLibrary',
    'policyDocs',
    'receipts',
    'aiPhotos',
    'aiResults',
    'followUpTasks',
    'reportChecklist',
  ]
  if (arrays.some((key) => Array.isArray(data[key]) && (data[key] as unknown[]).length > 0)) return true
  return getExpensesTotal(data.expenses) > 0
}

export function getStoredOnboardingStep() {
  if (typeof window === 'undefined') return 1
  return Math.max(1, Number(localStorage.getItem(ONBOARDING_STEP_KEY) || 1))
}

export function setStoredOnboardingStep(step: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ONBOARDING_STEP_KEY, String(Math.max(1, step)))
}

export function markOnboardingComplete() {
  if (typeof window === 'undefined') return
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
  localStorage.removeItem(ONBOARDING_STEP_KEY)
}

export function shouldShowOnboarding(data: ClaimData, force = false) {
  if (force) return true
  if (typeof window === 'undefined') return false
  if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true') return false
  if (localStorage.getItem(ONBOARDING_STEP_KEY)) return true
  return !hasExistingClaimData(data)
}

export function toggleFollowUpTask(data: ClaimData, taskId: string) {
  return {
    ...data,
    followUpTasks: (data.followUpTasks || []).map((task) => (
      String((task as { id?: string }).id || '') === String(taskId)
        ? {
            ...task,
            status: String((task as { status?: string }).status || 'open') === 'open' ? 'done' : 'open',
          }
        : task
    )),
  }
}

export function createCommunicationDraft(): Communication {
  return {
    id: crypto.randomUUID(),
    date: '',
    type: 'phone',
    party: 'adjuster',
    person: '',
    commContact: '',
    summary: '',
    followUpRequired: false,
    followUpDate: '',
    followUpTask: '',
    followUp: '',
    promiseMade: false,
    promiseFulfilled: false,
    promisedAmount: 0,
    promisedByDate: '',
    commitments: '',
    files: [],
  }
}

export function normalizeCommunicationDraft(entry: Communication): Communication {
  const person = String(entry.person || entry.contactPerson || '').trim()
  const followUpTask = String(entry.followUpTask || '').trim()
  const followUpDate = String(entry.followUpDate || '').trim()
  const followUpRequired = Boolean(entry.followUpRequired || followUpTask || followUpDate)
  return {
    ...entry,
    person,
    contactPerson: person,
    followUpTask,
    followUpDate,
    followUpRequired,
    followUp: followUpRequired ? [followUpDate, followUpTask].filter(Boolean).join(' • ') : 'No',
  }
}

export function buildCommunicationEmailDraft(data: ClaimData, communication: Communication | null | undefined) {
  const claimNumber = data.dashboard.claimNumber || data.claim.claimNumber || '[Claim Number]'
  const dateOfLoss = fmtUSDate(data.dashboard.dateOfLoss || data.claim.dateOfLoss) || '[Date of Loss]'
  const insuredName = data.dashboard.insuredName || 'Policyholder'
  const adjusterName = communication?.person || 'Adjuster'
  const adjusterEmail = data.dashboard.adjusterEmail || ''
  const subject = `Claim Follow-Up — Claim #${claimNumber}`
  const body = [
    `Dear ${adjusterName},`,
    '',
    `I am following up regarding Claim #${claimNumber} for the loss that occurred on ${dateOfLoss}.`,
    communication?.summary ? `Summary of our recent ${communication.type || 'communication'}: ${communication.summary}` : '',
    communication?.followUpRequired && (communication.followUpTask || communication.followUpDate)
      ? `Requested follow-up: ${[communication.followUpTask, communication.followUpDate ? `by ${fmtUSDate(communication.followUpDate)}` : ''].filter(Boolean).join(' ')}.`
      : '',
    '',
    'Please confirm receipt and advise on the next step when you have a moment.',
    '',
    `Respectfully,`,
    insuredName,
  ].filter(Boolean).join('\n')

  return {
    to: adjusterEmail,
    subject,
    body,
  }
}

export function createContractorDraft(): Contractor {
  return {
    id: crypto.randomUUID(),
    name: '',
    company: '',
    contact: '',
    contactName: '',
    phone: '',
    email: '',
    trade: '',
    notes: '',
    estimateFile: null,
    invoiceFile: null,
  }
}

export function normalizeContractorDraft(contractor: Contractor): Contractor {
  const company = String(contractor.company || contractor.name || '').trim()
  const contact = String(contractor.contact || contractor.contactName || '').trim()
  return {
    ...contractor,
    company,
    name: company,
    contact,
    contactName: contact,
    trade: String(contractor.trade || '').trim(),
    notes: String(contractor.notes || '').trim(),
  }
}

export const PAYMENT_COVERAGE_TYPE_OPTIONS = ['Dwelling', 'Contents', 'Mitigation', 'ALE', 'Multiple'] as const

export function createPaymentDraft(): Payment {
  return {
    id: crypto.randomUUID(),
    date: '',
    payer: '',
    from: '',
    amount: 0,
    type: 'advance',
    notes: '',
    coverageType: '',
    checkNumber: '',
    depreciation: 0,
  }
}

export function normalizePaymentDraft(payment: Payment): Payment {
  const payer = String(payment.payer || payment.from || payment.source || '').trim()
  return {
    ...payment,
    payer,
    from: payer,
    source: payer,
    type: String(payment.type || 'advance'),
    amount: Number(parseMoneyValue(payment.amount).toFixed(2)),
    notes: String(payment.notes || payment.description || '').trim(),
    description: String(payment.description || payment.notes || '').trim(),
  }
}

export function getPaymentsTotal(payments: Payment[]) {
  return payments.reduce((sum, payment) => sum + parseMoneyValue(payment.amount), 0)
}

function pushTimelineEvent(events: TimelineEvent[], event: TimelineEvent | null) {
  if (!event?.date) return
  const date = new Date(event.date)
  if (Number.isNaN(date.getTime())) return
  events.push(event)
}

export function buildTimelineEvents(data: ClaimData) {
  const events: TimelineEvent[] = []

  pushTimelineEvent(events, data.dashboard.dateOfLoss ? {
    id: 'date-of-loss',
    date: data.dashboard.dateOfLoss,
    title: 'Date of Loss',
    description: data.claim.description || data.claimType,
    category: 'Incident',
  } : null)

  pushTimelineEvent(events, data.dashboard.dateReported ? {
    id: 'date-reported',
    date: data.dashboard.dateReported,
    title: 'Claim Reported',
    description: data.dashboard.insurerName || data.claim.insurer || '',
    category: 'Insurance',
  } : null)

  ;(data.communications || []).forEach((entry) => {
    pushTimelineEvent(events, entry.date ? {
      id: String(entry.id || crypto.randomUUID()),
      date: entry.date,
      title: `${String(entry.party || 'Communication').replace(/\b\w/g, (match) => match.toUpperCase())} Communication`,
      description: entry.summary || entry.person || '',
      category: 'Insurance',
    } : null)
  })

  ;(data.contractors || []).forEach((entry) => {
    pushTimelineEvent(events, (entry as { startDate?: string }).startDate ? {
      id: `${entry.id || crypto.randomUUID()}-start`,
      date: String((entry as { startDate?: string }).startDate || ''),
      title: `${entry.name || entry.company || 'Contractor'} Started`,
      description: entry.trade || '',
      category: 'Remediation',
    } : null)
  })

  ;(data.contractorReports || []).forEach((entry) => {
    pushTimelineEvent(events, entry.serviceStartDate ? {
      id: `${entry.id || crypto.randomUUID()}-report`,
      date: entry.serviceStartDate,
      title: `${entry.companyName || entry.name || 'Contractor'} Visit`,
      description: entry.workDescription || entry.scopeOfWork || '',
      category: 'Repair',
    } : null)
  })

  getExpenseEntriesByCategory(data.expenses).forEach((entry) => {
    const date = entry.dateStart || entry.date
    pushTimelineEvent(events, date ? {
      id: `expense-${entry.id || crypto.randomUUID()}`,
      date,
      title: `${entry.category || 'Expense'} Logged`,
      description: entry.description || entry.vendor || '',
      category: 'Insurance',
    } : null)
  })

  ;(data.payments || []).forEach((entry) => {
    pushTimelineEvent(events, entry.date ? {
      id: `payment-${entry.id || crypto.randomUUID()}`,
      date: entry.date,
      title: 'Payment Received',
      description: `${entry.from || entry.payer || 'Insurance'}${entry.amount ? ` • ${formatCurrency(entry.amount)}` : ''}`,
      category: 'Insurance',
    } : null)
  })

  ;(data.timeline || []).forEach((entry) => {
    pushTimelineEvent(events, {
      ...entry,
      title: entry.title || entry.event || 'Event',
      category: entry.category || 'Other',
    })
  })

  return events.sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime())
}

export function getContractorFindings(report: ContractorReport) {
  const findings = Array.isArray(report.structuredFindings)
    ? report.structuredFindings
    : Array.isArray(report.findings)
      ? report.findings
      : String(report.findings || '')
        .split(/\n|;/)
        .map((entry) => entry.trim())
        .filter(Boolean)
  const recommendations = Array.isArray(report.recommendations)
    ? report.recommendations
    : String(report.recommendations || '')
      .split(/\n|;/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  return { findings, recommendations }
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
  // Inline the counts to avoid mutual recursion with updateDashboardSummary
  const contents = (data.contents || []).filter((item) => item.source !== 'receipt' && item.includedInClaim !== false)
  const enrichedCount = contents.filter((item) => Boolean(item.enrichment?.revised || item.enriched)).length
  const photoCount =
    (data.aiPhotos || []).length
    + (data.photoLibrary || []).length
    + (data.rooms || []).reduce((sum, room) => sum + (room.photos || []).length, 0)
    + contents.reduce((sum, item) => sum + countItemPhotos(item), 0)

  const hasPolicy = (data.policyDocs || []).length > 0 || Boolean(data.dashboard.policyNumber || data.claim.policyNumber)
  const hasPhotos = photoCount > 0
  const hasItems = contents.length > 0
  const hasRooms = (data.rooms || []).length > 0
  const hasExpenses = getExpensesTotal(data.expenses) > 0
  const enrichedReady = contents.length > 0 && enrichedCount > 0

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

export function buildClaimSummary(data: ClaimData) {
  const contents = (data.contents || []).filter((item) => item.includedInClaim !== false)
  const aiPhotos = data.aiPhotos || []
  const receipts = data.receipts || []
  const estimatedInventoryValue = contents.reduce((sum, item) => sum + getItemTotalValue(item), 0)

  return {
    claimType: data.claimType,
    claimNumber: data.dashboard.claimNumber || data.claim.claimNumber || '',
    policyNumber: data.dashboard.policyNumber || data.claim.policyNumber || '',
    propertyAddress: data.dashboard.insuredAddress || data.claim.propertyAddress || '',
    insurer: data.dashboard.insurerName || data.claim.insurer || '',
    dateOfLoss: data.dashboard.dateOfLoss || data.claim.dateOfLoss || '',
    rooms: (data.rooms || []).map((room) => room.name).filter(Boolean),
    roomCount: data.rooms.length,
    aiPhotoCount: aiPhotos.length,
    analyzedPhotoCount: aiPhotos.filter((photo) => photo.status === 'complete').length,
    contentCount: contents.length,
    receiptCount: receipts.length,
    estimatedInventoryValue,
    expenseTotal: getExpensesTotal(data.expenses),
    followUpCount: (data.followUpTasks || []).filter((task) => String((task as { status?: string }).status || 'open') === 'open').length,
  }
}

export function analyzePhotoRequestBody(data: ClaimData, photo: AIPhoto, options?: { analysisMode?: AnalysisMode; fastMode?: boolean }) {
  const analysisMode = normalizeAnalysisMode(options?.analysisMode || photo.analysisMode || data.aiAnalysisMode)
  const base64 = String(photo.imageBase64 || photo.base64 || '')
    || (typeof photo.dataUrl === 'string' ? dataUrlToBase64(photo.dataUrl) : '')
    || (typeof photo.url === 'string' && photo.url.startsWith('data:') ? dataUrlToBase64(photo.url) : '')

  const payload: Record<string, unknown> = {
    imageBase64: base64,
    mimeType: photo.mimeType || photo.type || 'image/jpeg',
    roomName: photo.roomName || '',
    photoName: photo.name || photo.filename || 'Photo',
    analysisMode: mapAnalysisModeToBackend(analysisMode),
    claimType: data.claimType || 'category3_sewage',
    claimSummary: buildClaimSummary(data),
    claimContext: {
      dashboard: data.dashboard,
      claim: data.claim,
      rooms: data.rooms.map((room) => ({ id: room.id, name: room.name, notes: room.notes })),
      policyInsights: data.policyInsights,
    },
  }

  if (options?.fastMode) payload.fastMode = true
  return applyAnnotationMarkersToPayload(payload, photo)
}

export function applyAnnotationMarkersToPayload(payload: Record<string, unknown>, photo: AIPhoto) {
  const annotations = Array.isArray(photo.annotationMarkers) ? photo.annotationMarkers : []
  if (annotations.length > 0) {
    return { ...payload, annotations }
  }
  return payload
}

export async function analyzePhotoVisionWithRetry(
  data: ClaimData,
  photo: AIPhoto,
  options?: { analysisMode?: AnalysisMode; fastMode?: boolean; signal?: AbortSignal; maxRetries?: number },
) {
  const maxRetries = options?.maxRetries ?? 3
  let attempt = 0
  let lastError: unknown

  while (attempt <= maxRetries) {
    try {
      const response = await apiClient.analyzePhoto(analyzePhotoRequestBody(data, photo, options))
      return response
    } catch (error) {
      if (options?.signal?.aborted) throw error
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const statusMatch = message.match(/\b(\d{3})\b/)
      const status = statusMatch ? Number(statusMatch[1]) : null
      if (!status || !ANALYZE_RETRYABLE_STATUS.has(status) || attempt >= maxRetries) {
        throw error
      }
      await new Promise((resolve) => window.setTimeout(resolve, 750 * (attempt + 1)))
      attempt += 1
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Photo analysis failed.')
}

export function parseStrictAIResult(payload: Record<string, unknown>): AIResultRecord {
  const detectedItems = Array.isArray(payload.detectedItems)
    ? payload.detectedItems.map((item) => ({
        ...((item as AIDetectedItem) || {}),
        label: getDetectedItemLabel((item as AIDetectedItem) || {}),
        quantity: Math.max(1, parseNumber((item as AIDetectedItem)?.quantity) || 1),
        quantityUnit: String((item as AIDetectedItem)?.quantityUnit || 'each'),
        replacementPrice: parseMoneyValue((item as AIDetectedItem)?.replacementPrice ?? (item as AIDetectedItem)?.estimatedValue),
        confidence: Number((item as AIDetectedItem)?.confidence || 0),
      }))
    : []

  return {
    sceneSummary: String(payload.sceneSummary || payload.summary || ''),
    riskFlags: normalizeStringList(payload.riskFlags),
    followUpRequests: normalizeStringList(payload.followUpRequests),
    confidenceOverall: Number(payload.confidenceOverall || 0),
    modelUsed: String(payload.modelUsed || ''),
    detectedItems,
  }
}

export function buildEvidencePhotosFromAIPhoto(photo: AIPhoto) {
  const sources = photo.isStack && Array.isArray(photo.stackPhotos) && photo.stackPhotos.length ? photo.stackPhotos : [photo]
  return sources.map((entry) => ({
    photoId: entry.id,
    photoName: String(entry.name || entry.filename || 'Photo'),
  }))
}

export function mergeEvidencePhotos(existing: Array<{ photoId?: string | number; photoName?: string }> = [], additions: Array<{ photoId?: string | number; photoName?: string }> = []) {
  const seen = new Map<string, { photoId?: string | number; photoName?: string }>()
  for (const item of [...existing, ...additions]) {
    const key = String(item.photoId || item.photoName || '')
    if (!key || seen.has(key)) continue
    seen.set(key, item)
  }
  return Array.from(seen.values())
}

export function mergeSourcePhotoNames(...names: Array<string | null | undefined>) {
  const seen = new Set<string>()
  for (const entry of names) {
    for (const value of String(entry || '').split(',')) {
      const trimmed = value.trim()
      if (trimmed) seen.add(trimmed)
    }
  }
  return Array.from(seen).join(', ')
}

function ensureEnhancedContentShape(item: ContentItem): ContentItem {
  return {
    quantity: 1,
    quantityUnit: 'each',
    evidencePhotos: [],
    includedInClaim: true,
    contaminated: false,
    confidence: 0,
    ...item,
  }
}

export function createFollowUps(data: ClaimData, photo: AIPhoto, parsed: AIResultRecord, createdItemIds: string[]) {
  const existingKeys = new Set(
    (data.followUpTasks || []).map((task) => `${String((task as { photoId?: string | number }).photoId || '')}::${String((task as { prompt?: string }).prompt || '')}`),
  )

  const prompts = [
    ...((parsed.followUpRequests || []).map((prompt) => ({ prompt, itemId: null })) || []),
    ...((parsed.detectedItems || [])
      .filter((item) => {
        const text = `${item.category || ''} ${item.label || ''}`.toLowerCase()
        return /electronics|tv|computer|laptop|phone|tablet|router|appliance/.test(text)
      })
      .map((item, index) => ({ prompt: `Was ${getDetectedItemLabel(item)} powered on while wet?`, itemId: createdItemIds[index] || null }))),
  ]

  const nextTasks = [...data.followUpTasks]
  prompts.forEach(({ prompt, itemId }) => {
    const key = `${String(photo.id || '')}::${prompt}`
    if (existingKeys.has(key)) return
    existingKeys.add(key)
    nextTasks.push({
      id: crypto.randomUUID(),
      claimId: data.dashboard.claimNumber || data.claim.claimNumber || 'default',
      roomId: photo.roomId || 'unknown',
      photoId: photo.id || null,
      itemId,
      prompt,
      status: 'open',
    })
  })

  return nextTasks
}

export function upsertDraftContentFromAI(data: ClaimData, photo: AIPhoto, parsed: AIResultRecord) {
  const evidencePhotos = buildEvidencePhotosFromAIPhoto(photo)
  const createdItemIds: string[] = []
  let contents = [...data.contents]

  for (const detected of parsed.detectedItems || []) {
    const name = getDetectedItemLabel(detected)
    const roomName = String(photo.roomName || detected.roomAssignment || 'Unknown')
    const existingIndex = contents.findIndex(
      (item) => String(item.itemName || '').trim().toLowerCase() === name.toLowerCase()
        && String(item.room || item.location || '').trim().toLowerCase() === roomName.toLowerCase(),
    )

    const ruled = applyCategory3Rules(
      {
        id: crypto.randomUUID(),
        itemName: name,
        category: detected.category,
        porousness: detected.porousness,
        disposition: normalizeDisposition(detected.likelyDisposition),
      },
      photo,
      data.claimType,
    )

    if (existingIndex >= 0) {
      const existing = ensureEnhancedContentShape(contents[existingIndex])
      contents[existingIndex] = {
        ...existing,
        category: existing.category || String(detected.category || 'Other'),
        room: existing.room || roomName,
        location: existing.location || roomName,
        roomId: existing.roomId || String(photo.roomId || ''),
        quantity: Math.max(existing.quantity || 1, Number(detected.quantity || 1)),
        quantityUnit: existing.quantityUnit || String(detected.quantityUnit || 'each'),
        replacementCost: Math.max(parseMoneyValue(existing.replacementCost), parseMoneyValue(detected.replacementPrice)),
        unitPrice: Math.max(parseMoneyValue(existing.unitPrice), parseMoneyValue(detected.replacementPrice)),
        contaminated: data.claimType === 'category3_sewage' ? true : Boolean(existing.contaminated),
        disposition: normalizeDisposition(existing.disposition || ruled.disposition),
        sourcePhotoName: mergeSourcePhotoNames(existing.sourcePhotoName, evidencePhotos.map((entry) => entry.photoName).join(', ')),
        evidencePhotos: mergeEvidencePhotos(existing.evidencePhotos, evidencePhotos),
        confidence: Math.max(Number(existing.confidence || 0), Number(detected.confidence || 0)),
        aiJustification: String(existing.aiJustification || detected.contaminationRationale || ''),
        source: existing.source || 'ai-draft',
        status: 'draft',
        aiBatchId: photo.lastBatchId || existing.aiBatchId,
      }
      createdItemIds.push(String(contents[existingIndex].id))
      continue
    }

    const itemId = crypto.randomUUID()
    const nextItem = ensureEnhancedContentShape({
      id: itemId,
      itemName: name,
      label: name,
      category: String(detected.category || 'Other'),
      room: roomName,
      location: roomName,
      roomId: photo.roomId ? String(photo.roomId) : null,
      quantity: Math.max(1, Number(detected.quantity || 1)),
      quantityUnit: String(detected.quantityUnit || 'each'),
      replacementCost: parseMoneyValue(detected.replacementPrice),
      unitPrice: parseMoneyValue(detected.replacementPrice),
      confidence: Number(detected.confidence || 0),
      contaminated: data.claimType === 'category3_sewage',
      disposition: normalizeDisposition(detected.likelyDisposition || ruled.disposition),
      aiJustification: String(detected.contaminationRationale || ''),
      sourcePhotoName: evidencePhotos.map((entry) => entry.photoName).join(', '),
      evidencePhotos,
      source: 'ai-draft',
      status: 'draft',
      includedInClaim: true,
      porousness: detected.porousness,
      originalPrice: parseMoneyValue(detected.originalPrice),
      aiBatchId: photo.lastBatchId || undefined,
    })
    contents.push(nextItem)
    createdItemIds.push(itemId)
  }

  contents = deduplicateDraftItemsBySourcePhotos(contents)
  const followUpTasks = createFollowUps({ ...data, contents }, photo, parsed, createdItemIds)
  return { contents, createdItemIds, followUpTasks }
}

export function autoImportPhotosToAIBuilder(data: ClaimData) {
  if ((data.aiPhotos || []).length > 0) return data.aiPhotos
  return (data.photoLibrary || []).map((photo) => ({
    ...photo,
    id: photo.id || crypto.randomUUID(),
    status: 'pending' as const,
    roomName: String((photo as { roomName?: string }).roomName || ''),
    analysisMode: data.aiAnalysisMode || 'ITEM_VIEW',
    source: 'auto-import',
  }))
}

function matchPhotoToAI(data: ClaimData, photo: FileItem | AIPhoto, roomName: string) {
  const directId = String((photo as { id?: string | number }).id || '')
  const directPath = String(photo.path || '')
  const directName = String(photo.name || photo.filename || '')
  const aiPhoto = (data.aiPhotos || []).find((entry) => {
    const sameId = directId && String(entry.id || '') === directId
    const samePath = directPath && String(entry.path || '') === directPath
    const sameUrl = photo.url && entry.url && String(entry.url) === String(photo.url)
    const sameName = directName && String(entry.name || entry.filename || '') === directName && String(entry.roomName || '') === roomName
    return sameId || samePath || sameUrl || sameName
  })
  if (!aiPhoto) return { aiResultId: null, aiItemCount: 0, analysisMode: '' as const }
  const aiResult = (data.aiResults || []).find((result) => String(result.photoId || '') === String(aiPhoto.id || ''))
  return {
    aiResultId: aiResult ? String(aiResult.id || '') : null,
    aiItemCount: (aiResult?.detectedItems || []).length,
    analysisMode: normalizeAnalysisMode(aiPhoto.analysisMode || '', 'ITEM_VIEW'),
  }
}

export function buildPhotoLibraryEntries(data: ClaimData): PhotoLibraryEntry[] {
  const roomMap = new Map(data.rooms.map((room) => [String(room.id), room]))
  const entries: PhotoLibraryEntry[] = []

  ;(data.photoLibrary || []).forEach((photo, index) => {
    const room = photo.roomId ? roomMap.get(String(photo.roomId)) : undefined
    const roomName = String((photo as { roomName?: string }).roomName || room?.name || 'Unassigned')
    const ai = matchPhotoToAI(data, photo, roomName)
    entries.push({
      id: `library-${String(photo.id || index)}`,
      sourceType: 'library',
      photo,
      roomId: room ? String(room.id) : (photo.roomId ? String(photo.roomId) : null),
      roomName,
      name: String(photo.name || photo.filename || 'Photo'),
      previewUrl: String(photo.thumbUrl || photo.url || photo.dataUrl || photo.data || ''),
      uploadedAt: String(photo.uploadedAt || photo.timestamp || photo.createdAt || ''),
      analysisMode: ai.analysisMode,
      aiResultId: ai.aiResultId,
      aiItemCount: ai.aiItemCount,
    })
  })

  ;(data.rooms || []).forEach((room) => {
    ;(room.photos || []).forEach((photo, index) => {
      const ai = matchPhotoToAI(data, photo, String(room.name || 'Unassigned'))
      entries.push({
        id: `room-${room.id}-${String(photo.id || index)}`,
        sourceType: 'room',
        photo,
        roomId: String(room.id),
        roomName: String(room.name || 'Unassigned'),
        name: String(photo.name || photo.filename || `${room.name || 'Room'} photo`),
        previewUrl: String(photo.thumbUrl || photo.url || photo.dataUrl || photo.data || ''),
        uploadedAt: String(photo.uploadedAt || photo.timestamp || photo.createdAt || ''),
        analysisMode: ai.analysisMode,
        aiResultId: ai.aiResultId,
        aiItemCount: ai.aiItemCount,
      })
    })
  })

  ;(data.aiPhotos || []).forEach((photo, index) => {
    const ai = matchPhotoToAI(data, photo, String(photo.roomName || 'Unassigned'))
    entries.push({
      id: `ai-${String(photo.id || index)}`,
      sourceType: 'ai',
      photo,
      roomId: photo.roomId ? String(photo.roomId) : null,
      roomName: String(photo.roomName || 'Unassigned'),
      name: String(photo.name || photo.filename || 'AI Photo'),
      previewUrl: String(photo.thumbUrl || photo.url || photo.dataUrl || photo.data || ''),
      uploadedAt: String(photo.uploadedAt || photo.timestamp || photo.createdAt || ''),
      analysisMode: photo.analysisMode || ai.analysisMode,
      aiResultId: ai.aiResultId,
      aiItemCount: ai.aiItemCount,
    })
  })

  return entries
    .filter((entry) => entry.previewUrl)
    .sort((left, right) => new Date(right.uploadedAt || 0).getTime() - new Date(left.uploadedAt || 0).getTime())
}

export function normalizeReceiptItem(raw: Record<string, unknown> | ReceiptLineItem): ReceiptLineItem {
  const category = String(raw.category || 'other').toLowerCase()
  return {
    name: String(raw.name || raw.description || '').trim(),
    description: String(raw.description || raw.name || '').trim(),
    quantity: Math.max(1, Number(raw.quantity || 1)),
    unitPrice: parseMoneyValue(raw.unitPrice),
    totalPrice: parseMoneyValue(raw.totalPrice ?? raw.unitPrice),
    category: (RECEIPT_CATEGORIES as readonly string[]).includes(category) ? category : 'other',
  }
}

export function getReceiptItems(receipt: Receipt): ReceiptLineItem[] {
  const source = Array.isArray(receipt.items) && receipt.items.length ? receipt.items : receipt.lineItems || []
  return source.map((item) => normalizeReceiptItem(item))
}

export function normalizeReceiptPayload(payload: Record<string, unknown>, file?: { name?: string; type?: string }): Receipt {
  const lineItems = Array.isArray(payload.items)
    ? payload.items.map((item) => normalizeReceiptItem(item as ReceiptLineItem))
    : Array.isArray(payload.lineItems)
      ? payload.lineItems.map((item) => normalizeReceiptItem(item as ReceiptLineItem))
      : []
  const receiptTotal = parseMoneyValue(payload.receiptTotal ?? payload.total)
    || lineItems.reduce((sum, item) => sum + parseMoneyValue(item.totalPrice || item.unitPrice), 0)

  return {
    id: crypto.randomUUID(),
    fileName: file?.name || 'Receipt',
    file: null,
    mimeType: file?.type || 'image/jpeg',
    uploadedAt: new Date().toISOString(),
    store: String(payload.store || '').trim(),
    purchaseDate: String(payload.purchaseDate || payload.date || '').trim(),
    date: String(payload.date || payload.purchaseDate || '').trim(),
    receiptTotal,
    items: lineItems,
    lineItems,
    addedToInventory: false,
    inventoryItemIds: [],
  }
}

export function addReceiptToInventory(data: ClaimData, receiptId: string | number) {
  const receipt = (data.receipts || []).find((entry) => String(entry.id) === String(receiptId))
  if (!receipt) return data
  const items = getReceiptItems(receipt)
  if (!items.length) return data

  const existingIds = new Set((receipt.inventoryItemIds || []).map(String))
  const newContents = [...data.contents]
  const createdIds: string[] = []
  items.forEach((item) => {
    const itemId = crypto.randomUUID()
    if (existingIds.has(itemId)) return
    newContents.push({
      id: itemId,
      itemName: item.name || item.description || 'Unknown Item',
      category: item.category || 'Other',
      quantity: Math.max(1, Number(item.quantity || 1)),
      quantityUnit: 'each',
      replacementCost: parseMoneyValue(item.totalPrice || item.unitPrice),
      originalPrice: parseMoneyValue(item.totalPrice || item.unitPrice),
      unitPrice: parseMoneyValue(item.unitPrice || item.totalPrice),
      includedInClaim: true,
      source: 'receipt',
      status: 'draft',
      confidence: 0.85,
      receiptId: receipt.id,
      receiptStore: receipt.store,
      receiptDate: receipt.purchaseDate || receipt.date,
    })
    createdIds.push(itemId)
  })

  return syncClaimReceipts({
    ...data,
    contents: newContents,
    receipts: data.receipts.map((entry) => (
      String(entry.id) === String(receiptId)
        ? { ...entry, addedToInventory: true, inventoryItemIds: createdIds }
        : entry
    )),
  })
}

export function addReceiptItemsToInventory(data: ClaimData, receiptId: string | number) {
  return addReceiptToInventory(data, receiptId)
}

export function syncClaimReceipts(data: ClaimData) {
  const receiptMap = new Map<string, string[]>()
  for (const item of data.contents) {
    if (item.source !== 'receipt') continue
    const receiptId = String((item as { receiptId?: string | number }).receiptId || '')
    if (!receiptId) continue
    receiptMap.set(receiptId, [...(receiptMap.get(receiptId) || []), String(item.id)])
  }

  return {
    ...data,
    receipts: data.receipts.map((receipt) => {
      const inventoryItemIds = receiptMap.get(String(receipt.id)) || []
      return {
        ...receipt,
        addedToInventory: inventoryItemIds.length > 0,
        inventoryItemIds,
      }
    }),
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
    head: [['Item', 'Room', 'Category', 'Qty', 'Replacement Cost']],
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

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 32
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Claim #${claimNumber}  ·  Generated ${fmtUSDate(generated)}`, 14, Math.min(finalY + 8, 285))
  doc.setTextColor(0, 0, 0)

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
