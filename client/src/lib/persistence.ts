import { loadClaim, saveClaim } from '@/lib/firebase'
import { sanitizeClaimData } from '@/lib/sanitizer'
import { createDefaultClaimData, type ClaimData, type FileItem, type SaveStatus } from '@/types/claim'

const LOCAL_STORAGE_KEY = 'claimtracker_v2_claim_cache'

export function mergeData(raw: Partial<ClaimData> | null | undefined): ClaimData {
  return sanitizeClaimData(raw)
}

export async function loadClaimWithRetry(maxAttempts = 3): Promise<ClaimData | null> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await loadClaim()
      return result ? mergeData(result) : null
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
  }
  throw lastError
}

export function stripFileItemForStorage(item: FileItem | null | undefined) {
  if (!item || typeof item !== 'object') return item
  const cleaned = { ...item }
  if (typeof cleaned.url === 'string' && (cleaned.url.startsWith('data:') || cleaned.url.startsWith('blob:'))) {
    cleaned.url = null
  }
  if (typeof cleaned.data === 'string') cleaned.data = null
  if (typeof cleaned.imageBase64 === 'string') cleaned.imageBase64 = null
  if (typeof cleaned.base64 === 'string') cleaned.base64 = null
  if (typeof cleaned.dataUrl === 'string' && cleaned.dataUrl.length > 500) cleaned.dataUrl = null
  return cleaned
}

export function listLocalIdsFromFileItem(_item: FileItem | null | undefined): string[] {
  return []
}

export function stripLargeLocalData(source: ClaimData): ClaimData {
  return {
    ...source,
    photoLibrary: source.photoLibrary.map((photo) => stripFileItemForStorage(photo) as FileItem),
    policyDocs: source.policyDocs.map((doc) => stripFileItemForStorage(doc) as FileItem),
    aiPhotos: source.aiPhotos.map((photo) => ({
      ...stripFileItemForStorage(photo),
      file: stripFileItemForStorage(photo.file || null) || null,
      stackPhotos: photo.stackPhotos?.map((stackPhoto) => ({
        ...stripFileItemForStorage(stackPhoto),
        file: stripFileItemForStorage(stackPhoto.file || null) || null,
      })),
    })),
    rooms: source.rooms.map((room) => ({
      ...room,
      photos: (room.photos || []).map((photo) => stripFileItemForStorage(photo) as FileItem),
    })),
    contents: source.contents.map((content) => ({
      ...content,
      photos: (content.photos || []).map((photo) => stripFileItemForStorage(photo) as FileItem),
      receipt: stripFileItemForStorage(content.receipt || null) || null,
    })),
    contractors: source.contractors.map((contractor) => ({
      ...contractor,
      estimateFile: stripFileItemForStorage(contractor.estimateFile || null) || null,
      invoiceFile: stripFileItemForStorage(contractor.invoiceFile || null) || null,
    })),
    contractorReports: source.contractorReports.map((report) => stripFileItemForStorage(report) as FileItem),
    communications: source.communications.map((comm) => ({
      ...comm,
      files: (comm.files || []).map((file) => stripFileItemForStorage(file) as FileItem),
    })),
    receipts: source.receipts.map((receipt) => ({
      ...stripFileItemForStorage(receipt),
      imageBase64: null,
    })),
    expenses: {
      laborEntries: source.expenses.laborEntries.map((entry) => ({ ...entry })),
      utilityEntries: source.expenses.utilityEntries.map((entry) => ({ ...entry })),
      disposalEntries: source.expenses.disposalEntries.map((entry) => ({
        ...entry,
        receipt: stripFileItemForStorage((entry as { receipt?: FileItem | null }).receipt || null) || null,
      })),
      livingEntries: source.expenses.livingEntries.map((entry) => ({ ...entry })),
      miscEntries: source.expenses.miscEntries.map((entry) => ({
        ...entry,
        receipt: stripFileItemForStorage((entry as { receipt?: FileItem | null }).receipt || null) || null,
      })),
    },
  }
}

export function persistLocal(data: ClaimData) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stripLargeLocalData(data)))
}

export function loadLocalClaim(): ClaimData {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) return createDefaultClaimData()
  try {
    return mergeData(JSON.parse(raw) as ClaimData)
  } catch {
    return createDefaultClaimData()
  }
}

export function getCloudErrorType(error: unknown): string {
  const candidate = error as { code?: string; name?: string; message?: string }
  const rawCode = String(candidate?.code || '').trim()
  if (rawCode) return rawCode.includes('/') ? rawCode.split('/').at(-1) || rawCode : rawCode
  const rawName = String(candidate?.name || '').trim()
  if (rawName) return rawName
  const message = String(candidate?.message || '').trim()
  if (!message) return 'unknown'
  const match = message.match(/permission[-\s]?denied|unauthenticated|unavailable|network|timeout|quota|not[-\s]?found/i)
  return match ? match[0].replaceAll(/\s+/g, '-') : 'unknown'
}

export function isNetworkError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string }
  const code = String(candidate?.code || '').toLowerCase()
  const message = String(candidate?.message || '').toLowerCase()
  return (
    code.includes('network') ||
    code.includes('unavailable') ||
    code.includes('timeout') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('offline') ||
    message.includes('timeout')
  )
}

export function isQuotaError(error: unknown): boolean {
  const candidate = error as { name?: string; message?: string }
  const name = String(candidate?.name || '')
  const message = String(candidate?.message || '')
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    message.toLowerCase().includes('quota')
  )
}

export async function persistCloud(data: ClaimData, retryCount = 0): Promise<SaveStatus> {
  try {
    const payload = {
      ...stripLargeLocalData(data),
      lastSavedAt: new Date().toISOString(),
    }
    await saveClaim(payload)
    persistLocal(payload)
    return 'saved'
  } catch (error) {
    persistLocal(data)
    if (isNetworkError(error) && retryCount < 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
      return persistCloud(data, retryCount + 1)
    }
    return 'error'
  }
}
