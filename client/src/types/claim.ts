export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error'
export type ClaimType = 'category3_sewage' | 'water' | 'fire' | 'storm' | string
export type AnalysisMode = 'ITEM_VIEW' | 'ROOM_VIEW' | 'FOCUSED_VIEW'
export type QuantityUnit = 'each' | 'pair' | 'set' | 'box' | string
export type ToastType = 'success' | 'error' | 'info' | 'warning'
export type PhotoAnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'failed'

export interface DynamicFields {
  [key: string]: unknown
}

export interface FileItem extends DynamicFields {
  id?: string | number
  name?: string
  filename?: string
  fileName?: string
  type?: string
  mimeType?: string
  size?: number
  url?: string | null
  thumbUrl?: string | null
  path?: string
  uploadedAt?: string | null
  timestamp?: string | null
  createdAt?: string | null
  date?: string | null
  data?: string | null
  dataUrl?: string | null
  base64?: string | null
  imageBase64?: string | null
  roomId?: string | number | null
  file?: FileItem | null
  localId?: string | null
}

export interface ClaimCore extends DynamicFields {
  incidentType: string
  dateOfLoss: string
  description: string
  propertyAddress: string
  insurer: string
  policyNumber: string
  claimNumber: string
}

export interface DashboardData extends DynamicFields {
  claimNumber: string
  policyNumber: string
  insuredName: string
  insuredAddress: string
  insurerName: string
  adjusterName: string
  adjusterEmail: string
  dateOfLoss: string
  dateReported: string
  deductible: string
  coverageType: string
  waterBackupLimit: string
  claimStatus: string
}

export interface Room extends DynamicFields {
  id: string
  name?: string
  dimensions?: string
  length?: number | string
  width?: number | string
  sqft?: number | string
  notes?: string
  photos?: FileItem[]
}

export interface EvidencePhoto extends DynamicFields {
  photoId?: string | number
  photoName?: string
}

export interface ContentItem extends DynamicFields {
  id: string
  itemName?: string
  label?: string
  room?: string
  roomId?: string | null
  location?: string
  category?: string
  quantity?: number
  quantityUnit?: QuantityUnit
  unitPrice?: number
  total?: number
  replacementCost?: number
  originalPrice?: number
  approvedAmount?: number
  replacementLink?: string
  disposition?: string
  disposed?: boolean
  contaminated?: boolean
  includedInClaim?: boolean
  status?: string
  confidence?: number
  enriched?: boolean
  source?: string
  aiBatchId?: string | number
  sourcePhotoName?: string
  originalItemName?: string
  porousness?: string
  materialType?: string
  photos?: FileItem[]
  receipt?: FileItem | null
  aiJustification?: string
  contaminationJustification?: string
  mergeAudit?: Record<string, unknown>
  _dupFlag?: Record<string, unknown>
  enrichment?: {
    revised?: {
      justification?: string
      contaminationJustification?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  evidencePhotos?: EvidencePhoto[]
}

export interface AIPhoto extends FileItem {
  id?: string | number
  analysisMode?: AnalysisMode
  status?: PhotoAnalysisStatus
  isStack?: boolean
  roomName?: string
  stackPhotos?: AIPhoto[]
  stackPhotoIds?: Array<string | number>
  stackPhotoNames?: string[]
  lastBatchId?: string
  aiResultId?: string | number | null
  notes?: string
  errorLabel?: string | null
  failedRequestId?: string | null
  partial?: boolean
  collapsed?: boolean
  source?: string
  lastAnalyzedAt?: string | null
  lastAnalyzedMode?: AnalysisMode | null
  attemptRequestIds?: string[]
  annotationMarkers?: Array<Record<string, unknown>>
}

export interface AIDetectedItem extends DynamicFields {
  label?: string
  name?: string
  category?: string
  quantity?: number
  quantityUnit?: QuantityUnit
  replacementPrice?: number | string
  estimatedValue?: number | string
  confidence?: number
  roomAssignment?: string
  contaminationAssessment?: string
  contaminationRationale?: string
  likelyDisposition?: string
  porousness?: string
  estimatedAgeYears?: number | null
  originalPrice?: number | null
}

export interface AIResultRecord extends DynamicFields {
  id?: string | number
  photoId?: string | number
  sceneSummary?: string
  riskFlags?: string[]
  followUpRequests?: string[]
  confidenceOverall?: number
  modelUsed?: string
  createdAt?: string
  detectedItems?: AIDetectedItem[]
}

export interface ReceiptLineItem extends DynamicFields {
  name?: string
  description?: string
  quantity?: number
  unitPrice?: number
  totalPrice?: number
  category?: string
}

export interface Receipt extends FileItem {
  id?: string | number
  store?: string
  purchaseDate?: string | null
  date?: string | null
  receiptTotal?: number
  lineItems?: ReceiptLineItem[]
  items?: ReceiptLineItem[]
  addedToInventory?: boolean
  inventoryItemIds?: string[]
}

export interface ExpenseEntry extends DynamicFields {
  id?: string
  date?: string
  dateStart?: string
  dateEnd?: string
  description?: string
  amount?: number
  category?: string
  vendor?: string
  lineItems?: Array<{ id?: string; description?: string; amount?: number }>
  totalDays?: number
  dailyCost?: number
  dailyCostIncrease?: number
  utilityType?: string
  supportingEvidence?: string
  isEstimated?: boolean
  estimationMethod?: string | null
  estimationDetail?: string | null
  hours?: number
  hourlyRate?: number
  receipt?: FileItem | null
}

export interface Expenses extends DynamicFields {
  laborEntries: ExpenseEntry[]
  utilityEntries: ExpenseEntry[]
  disposalEntries: ExpenseEntry[]
  livingEntries: ExpenseEntry[]
  miscEntries: ExpenseEntry[]
  bufferEnabled?: boolean
}

export interface Communication extends DynamicFields {
  id?: string
  date?: string
  type?: string
  party?: string
  person?: string
  contactPerson?: string
  contact?: string
  summary?: string
  followUp?: string
  followUpRequired?: boolean
  followUpDate?: string
  followUpTask?: string
  files?: FileItem[]
}

export interface Contractor extends DynamicFields {
  id?: string
  name?: string
  company?: string
  contact?: string
  contactName?: string
  phone?: string
  email?: string
  trade?: string
  notes?: string
  estimateFile?: FileItem | null
  invoiceFile?: FileItem | null
}

export interface ContractorReport extends FileItem {
  companyName?: string
  contactName?: string
  trade?: string
  workType?: string
  findings?: string | string[]
  structuredFindings?: string[]
  recommendations?: string | string[]
  scopeOfWork?: string
  workDescription?: string
  dateOfService?: string
  serviceStartDate?: string
  serviceEndDate?: string
  amount?: number
  totalAmount?: number
  affectedRooms?: string[]
  keyLineItems?: string[]
}

export interface Payment extends DynamicFields {
  id?: string
  date?: string
  from?: string
  source?: string
  description?: string
  amount?: number
  payer?: string
  type?: string
  notes?: string
}

export interface TimelineEvent extends DynamicFields {
  id?: string
  date?: string
  title?: string
  description?: string
  event?: string
  category?: string
}

export interface FloorPlan extends DynamicFields {
  id?: string
  rooms?: Array<Record<string, unknown>>
}

export interface PolicyDoc extends FileItem {
  id?: string | number
  documentType?: string
  docType?: string
}

export interface PolicyInsights extends DynamicFields {
  hasLossOfUse: boolean
  hasBusinessCoverage: boolean
  hasMatching: boolean
  hasOrdinanceLaw: boolean
  hasWaterBackup: boolean
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
  hasMedicalPayments: boolean
  hasDeclarationsPage: boolean
  hasFullPolicy: boolean
  hasEndorsements: boolean
  rawPolicyText: string
}

export interface OnboardingState extends DynamicFields {
  wizardPolicyUploaded: boolean
  wizardPolicyFilename: string
}

export interface ClaimData extends DynamicFields {
  version: number
  claimType: ClaimType
  claim: ClaimCore
  aiPhotos: AIPhoto[]
  aiResults: AIResultRecord[]
  followUpTasks: Array<Record<string, unknown>>
  dashboard: DashboardData
  rooms: Room[]
  contents: ContentItem[]
  contractors: Contractor[]
  contractorReports: ContractorReport[]
  adjusterEstimate: Record<string, unknown> | null
  communications: Communication[]
  payments: Payment[]
  photoLibrary: FileItem[]
  policyDocs: PolicyDoc[]
  receipts: Receipt[]
  expenses: Expenses
  aiNeedsUpdate: boolean
  aiAnalysisMode: AnalysisMode
  reportChecklist: Array<Record<string, unknown>>
  policyInsights: PolicyInsights
  onboarding: OnboardingState
  timeline?: TimelineEvent[]
  floorPlan?: FloorPlan | null
  settings?: Record<string, unknown>
  lastSavedAt: string | null
}

export const CLAIM_TABS = [
  'dashboard',
  'claim-info',
  'rooms',
  'floor-plan',
  'photo-library',
  'ai-builder',
  'contents',
  'receipts',
  'expenses',
  'communications',
  'timeline',
  'contractors',
  'payments',
  'maximizer',
] as const

export type ClaimTabId = (typeof CLAIM_TABS)[number]

export function createDefaultClaimData(): ClaimData {
  return {
    version: 2,
    claimType: 'category3_sewage',
    claim: {
      incidentType: '',
      dateOfLoss: '',
      description: '',
      propertyAddress: '',
      insurer: '',
      policyNumber: '',
      claimNumber: '',
    },
    aiPhotos: [],
    aiResults: [],
    followUpTasks: [],
    dashboard: {
      claimNumber: '',
      policyNumber: '',
      insuredName: '',
      insuredAddress: '',
      insurerName: '',
      adjusterName: '',
      adjusterEmail: '',
      dateOfLoss: '',
      dateReported: '',
      deductible: '',
      coverageType: '',
      waterBackupLimit: '',
      claimStatus: '',
    },
    rooms: [],
    contents: [],
    contractors: [],
    contractorReports: [],
    adjusterEstimate: null,
    communications: [],
    payments: [],
    photoLibrary: [],
    policyDocs: [],
    receipts: [],
    expenses: {
      laborEntries: [],
      utilityEntries: [],
      disposalEntries: [],
      livingEntries: [],
      miscEntries: [],
    },
    aiNeedsUpdate: false,
    aiAnalysisMode: 'ITEM_VIEW',
    reportChecklist: [],
    policyInsights: {
      hasLossOfUse: false,
      hasBusinessCoverage: false,
      hasMatching: false,
      hasOrdinanceLaw: false,
      hasWaterBackup: false,
      limits: { A: '', B: '', C: '', D: '' },
      sectionIDeductible: '',
      waterBackupLimit: '',
      moldLimit: '',
      namedStormDeductible: '',
      scheduledJewelryLimit: '',
      identityFraudLimit: '',
      refrigeratedPropertyLimit: '',
      lossSettlementType: '',
      lossSettlementRCV: false,
      lossSettlementACV: false,
      scheduledItemsMentioned: false,
      hasMedicalPayments: false,
      hasDeclarationsPage: false,
      hasFullPolicy: false,
      hasEndorsements: false,
      rawPolicyText: '',
    },
    onboarding: {
      wizardPolicyUploaded: false,
      wizardPolicyFilename: '',
    },
    timeline: [],
    floorPlan: null,
    settings: {},
    lastSavedAt: null,
  }
}
