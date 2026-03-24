import type {
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

async function postJson<TResponse>(path: string, body: object): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<TResponse>
}

export const apiClient = {
  analyzePhoto: (body: AnalyzePhotoRequest) => postJson<AnalyzePhotoResponse>('/api/analyze-photo', body),
  enrichItem: (body: EnrichItemRequest) => postJson<EnrichItemResponse>('/api/enrich-item', body),
  analyzeReceipt: (body: AnalyzeReceiptRequest) => postJson<AnalyzeReceiptResponse>('/api/analyze-receipt', body),
  maximizerChat: (body: MaximizerChatRequest) => postJson<MaximizerChatResponse>('/api/maximizer/chat', body),
  preScreenPhotos: (body: PreScreenPhotosRequest) => postJson<PreScreenPhotosResponse>('/api/pre-screen-photos', body),
  maximizerMetrics: (body: MaximizerMetricsRequest) => postJson<Record<string, unknown>>('/api/maximizer/metrics', body),
}
