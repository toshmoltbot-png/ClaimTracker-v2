export interface AnalyzePhotoRequest {
  photoUrl?: string
  roomName?: string
  analysisMode?: string
  claimType?: string
  [key: string]: unknown
}

export interface AnalyzePhotoResponse {
  detectedItems?: Array<Record<string, unknown>>
  summary?: string
  followUpTasks?: Array<Record<string, unknown>>
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
  [key: string]: unknown
}

export interface AnalyzeReceiptResponse {
  store?: string
  purchaseDate?: string
  lineItems?: Array<Record<string, unknown>>
  total?: number
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
