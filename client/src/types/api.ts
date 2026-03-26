export interface AnalyzePhotoRequest {
  photoUrl?: string
  photoName?: string
  imageBase64?: string
  mimeType?: string
  roomName?: string
  analysisMode?: string
  claimType?: string
  claimSummary?: Record<string, unknown>
  claimContext?: Record<string, unknown>
  annotations?: Array<Record<string, unknown>>
  fastMode?: boolean
  [key: string]: unknown
}

export interface AnalyzePhotoResponse {
  detectedItems?: Array<Record<string, unknown>>
  summary?: string
  sceneSummary?: string
  riskFlags?: string[]
  followUpRequests?: string[]
  confidenceOverall?: number
  modelUsed?: string
  partial?: boolean
  [key: string]: unknown
}

export interface EnrichItemRequest {
  itemId?: string
  itemName: string
  category?: string
  unitPrice?: number
  quantity?: number
  enrichmentAttemptId?: string
  baseline?: Record<string, unknown>
  userInput?: Record<string, unknown>
  imageUrls?: string[]
  images?: string[]
  justifyMode?: boolean
  fixedPrice?: number
  replacementLink?: string
  rationaleMode?: 'replace' | 'justify'
  [key: string]: unknown
}

export interface EnrichItemResponse {
  revised?: Record<string, unknown>
  comps?: Array<Record<string, unknown>>
  auditTrail?: Array<Record<string, unknown>>
  flagged?: boolean
  enrichmentAttemptId?: string
  ebayMedian?: number | null
  ebayLow?: number | null
  ebayHigh?: number | null
  [key: string]: unknown
}

export interface AnalyzeReceiptRequest {
  imageUrl?: string
  receiptBase64?: string
  imageBase64?: string
  mimeType?: string
  text?: string
  [key: string]: unknown
}

export interface AnalyzeReceiptResponse {
  success?: boolean
  store?: string
  date?: string
  purchaseDate?: string
  items?: Array<Record<string, unknown>>
  lineItems?: Array<Record<string, unknown>>
  total?: number
  receiptTotal?: number
  [key: string]: unknown
}

export interface MaximizerChatRequest {
  message: string
  claimSummary?: Record<string, unknown>
  history?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface MaximizerChatResponse {
  reply: string
  followUps?: string[]
  metrics?: Record<string, unknown>
  [key: string]: unknown
}

export interface PreScreenPhotosRequest {
  photos: Array<Record<string, unknown>>
}

export interface PreScreenPhotosResponse {
  results?: Array<Record<string, unknown>>
  suggestedStacks?: string[][]
  [key: string]: unknown
}

export interface MaximizerMetricsRequest {
  event: string
  [key: string]: unknown
}

export interface AnalyzeContractorReportRequest {
  text?: string
  fileName?: string
  mimeType?: string
  documentUrl?: string
  [key: string]: unknown
}

export interface AnalyzeContractorReportResponse {
  structuredFindings?: string[]
  findings?: string[]
  recommendations?: string[]
  companyName?: string
  contactName?: string
  trade?: string
  damageCategory?: string
  workDescription?: string
  serviceStartDate?: string
  serviceEndDate?: string
  totalAmount?: number
  affectedRooms?: string[]
  keyLineItems?: string[]
  [key: string]: unknown
}
