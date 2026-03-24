import type jsPDF from 'jspdf'

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '--'
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  let value = bytes
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function upsertById<T extends { id?: string | number }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => String(entry.id) === String(item.id))
  if (index >= 0) {
    return [...list.slice(0, index), item, ...list.slice(index + 1)]
  }
  return [...list, item]
}

export function csvCell(value: unknown): string {
  const safe = String(value == null ? '' : value).replaceAll('"', '""')
  return `"${safe}"`
}

export function getTextWidth(text: string, doc?: jsPDF): number {
  if (doc) return doc.getTextWidth(text)
  if (typeof document === 'undefined') return text.length * 7
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return text.length * 7
  context.font = '14px Manrope'
  return context.measureText(text).width
}

export async function compressImageToDataUrl(
  file: File,
  maxBytes = 150 * 1024,
  maxDimension = 1400,
): Promise<string> {
  const imageBitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height))
  const width = Math.max(1, Math.round(imageBitmap.width * ratio))
  const height = Math.max(1, Math.round(imageBitmap.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas unavailable')
  }

  context.drawImage(imageBitmap, 0, 0, width, height)
  let quality = 0.92
  let dataUrl = canvas.toDataURL('image/jpeg', quality)

  while (estimateDataUrlBytes(dataUrl) > maxBytes && quality > 0.45) {
    quality -= 0.08
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }

  imageBitmap.close()
  return dataUrl
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.floor(base64.length * 0.75)
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? ''
}

export function getDataUrlMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:(.*?);base64,/)
  return match?.[1] || 'application/octet-stream'
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}
