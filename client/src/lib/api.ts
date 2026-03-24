import type {
  AnalyzeContractorReportRequest,
  AnalyzeContractorReportResponse,
  AnalyzePhotoRequest,
  AnalyzePhotoResponse,
  AnalyzeReceiptRequest,
  AnalyzeReceiptResponse,
  EnrichItemRequest,
  EnrichItemResponse,
  MaximizerChatRequest,
  MaximizerMetricsRequest,
  MaximizerChatResponse,
  PreScreenPhotosRequest,
  PreScreenPhotosResponse,
} from '@/types/api'

export class ApiError extends Error {
  status: number
  isNetworkError: boolean
  isAIDown: boolean
  retryable: boolean

  constructor(message: string, status: number, options?: { isNetworkError?: boolean; isAIDown?: boolean; retryable?: boolean }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.isNetworkError = options?.isNetworkError ?? false
    this.isAIDown = options?.isAIDown ?? false
    this.retryable = options?.retryable ?? false
  }
}

function classifyError(status: number, body: string): ApiError {
  if (status === 0 || status === undefined) {
    return new ApiError('Network error — check your connection and try again.', 0, { isNetworkError: true, retryable: true })
  }
  if (status === 429) {
    return new ApiError('Too many requests — please wait a moment and retry.', 429, { retryable: true })
  }
  if (status === 401 || status === 403) {
    return new ApiError('Authentication error — please sign in again.', status)
  }
  if (status === 413) {
    return new ApiError('File too large — try compressing the image first.', 413)
  }
  if (status === 500 && body.includes('OPENAI_API_KEY')) {
    return new ApiError('AI service is not configured. Contact support.', 500, { isAIDown: true })
  }
  if (status === 502 || status === 503 || status === 504) {
    return new ApiError('AI service is temporarily unavailable — try again shortly.', status, { isAIDown: true, retryable: true })
  }
  return new ApiError(body || `Request failed (${status})`, status, { retryable: status >= 500 })
}

async function postJson<TResponse>(path: string, body: object): Promise<TResponse> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Network error — check your connection and try again.', 0, { isNetworkError: true, retryable: true })
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw classifyError(response.status, errorText)
  }

  return response.json() as Promise<TResponse>
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}

export function isAIServiceDown(error: unknown): boolean {
  return error instanceof ApiError && error.isAIDown
}

export const apiClient = {
  analyzePhoto: (body: AnalyzePhotoRequest) => postJson<AnalyzePhotoResponse>('/api/analyze-photo', body),
  enrichItem: (body: EnrichItemRequest) => postJson<EnrichItemResponse>('/api/enrich-item', body),
  analyzeReceipt: (body: AnalyzeReceiptRequest) => postJson<AnalyzeReceiptResponse>('/api/analyze-receipt', body),
  analyzeContractorReport: (body: AnalyzeContractorReportRequest) =>
    postJson<AnalyzeContractorReportResponse>('/api/analyze-contractor-report', body),
  maximizerChat: (body: MaximizerChatRequest) => postJson<MaximizerChatResponse>('/api/maximizer/chat', body),
  preScreenPhotos: (body: PreScreenPhotosRequest) => postJson<PreScreenPhotosResponse>('/api/pre-screen-photos', body),
  maximizerMetrics: (body: MaximizerMetricsRequest) => postJson<Record<string, unknown>>('/api/maximizer/metrics', body),
}
