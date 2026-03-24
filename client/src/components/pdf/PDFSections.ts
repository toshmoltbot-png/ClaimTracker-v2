import autoTable from 'jspdf-autotable'
import type { jsPDF } from 'jspdf'
import { buildTimelineEvents, formatCurrency, getExpenseEntriesByCategory, getExpensesTotal, getItemTotalValue, getPaymentsTotal, getRoomDimensions, normalizeDisposition, updateDashboardSummary } from '@/lib/claimWorkflow'
import { fmtUSDate, toDatePdf } from '@/lib/dates'
import { getTextWidth } from '@/lib/utils'
import type { AIPhoto, ClaimData, ContentItem, ExpenseEntry, FileItem, Payment, Room } from '@/types/claim'

export const NAVY: [number, number, number] = [15, 40, 80]
export const LIGHT_BLUE: [number, number, number] = [235, 242, 255]
const LIGHT_GRAY: [number, number, number] = [245, 245, 245]
const GRAY: [number, number, number] = [120, 120, 120]
const YELLOW_BG: [number, number, number] = [255, 251, 235]
const YELLOW_BORDER: [number, number, number] = [217, 119, 6]

export interface PDFSectionContext {
  doc: jsPDF
  data: ClaimData
  PW: number
  PH: number
  ML: number
  MR: number
  CW: number
  y: number
  contents: ContentItem[]
  rooms: Room[]
  payments: Payment[]
  expenseEntries: ExpenseEntry[]
  sourceLinks: Array<{ itemName: string; room: string; url: string }>
}

export interface PDFRenderOptions {
  onStatus?: (status: string) => void
}

export function createPDFSectionContext(doc: jsPDF, data: ClaimData): PDFSectionContext {
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const ML = 14
  const MR = 14
  const contents = (data.contents || []).filter((item) => item.source !== 'receipt' && item.includedInClaim !== false)
  return {
    doc,
    data,
    PW,
    PH,
    ML,
    MR,
    CW: PW - ML - MR,
    y: 15,
    contents,
    rooms: data.rooms || [],
    payments: data.payments || [],
    expenseEntries: getExpenseEntriesByCategory(data.expenses),
    sourceLinks: [],
  }
}

function setMutedText(doc: jsPDF) {
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
}

function resetText(doc: jsPDF) {
  doc.setTextColor(0, 0, 0)
}

function ensureSpace(ctx: PDFSectionContext, needed: number) {
  if (ctx.y + needed <= ctx.PH - 18) return
  ctx.doc.addPage()
  ctx.y = 15
}

function sectionHeader(ctx: PDFSectionContext, title: string) {
  ensureSpace(ctx, 16)
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(11)
  ctx.doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  ctx.doc.text(title.toUpperCase(), ctx.ML, ctx.y + 6)
  ctx.doc.setDrawColor(229, 231, 235)
  ctx.doc.line(ctx.ML, ctx.y + 8, ctx.PW - ctx.MR, ctx.y + 8)
  resetText(ctx.doc)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(10)
  ctx.y += 14
}

function normalizeClaimDate(value: string | null | undefined) {
  return fmtUSDate(value || '') || value || 'N/A'
}

function parseMoneyLike(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '').replace(/[^0-9.\-]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.values(value).some((entry) => hasMeaningfulValue(entry))
  if (typeof value === 'boolean') return value
  return String(value ?? '').trim() !== ''
}

function formatCurrencyOrNA(value: unknown) {
  const amount = parseMoneyLike(value)
  return amount > 0 ? formatCurrency(amount) : 'N/A'
}

function getClaimFinancials(ctx: PDFSectionContext) {
  const contentsTotal = ctx.contents.reduce((sum, item) => sum + getItemTotalValue(item), 0)
  const expensesTotal = getExpensesTotal(ctx.data.expenses)
  const deductible = parseMoneyLike(ctx.data.dashboard?.deductible)
  const totalClaimed = contentsTotal + expensesTotal - deductible
  const totalPaid = getPaymentsTotal(ctx.payments)
  const outstanding = totalClaimed - totalPaid
  const depreciation = ctx.contents.reduce((sum, item) => {
    const replacement = getItemTotalValue(item)
    const approved = parseMoneyLike(item.approvedAmount)
    return approved > 0 && replacement > approved ? sum + (replacement - approved) : sum
  }, 0)
  return {
    contentsTotal,
    expensesTotal,
    deductible,
    totalClaimed,
    totalPaid,
    outstanding,
    depreciation,
  }
}

function getAdjusterPhone(data: ClaimData) {
  return String(data.dashboard?.adjusterPhone || data.claim?.adjusterPhone || '').trim()
}

function formatClaimLabel(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return 'N/A'
  return raw
    .replace(/_/g, ' ')
    .replace(/category\s*3/gi, 'Category 3')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getFileSrc(fileItem: FileItem | AIPhoto | string | null | undefined) {
  if (!fileItem) return ''
  if (typeof fileItem === 'string') return fileItem
  return String(fileItem.thumbUrl || fileItem.url || fileItem.data || fileItem.dataUrl || fileItem.imageBase64 || fileItem.file?.url || fileItem.file?.data || fileItem.file?.dataUrl || '')
}

async function ensureJpegDataUrl(dataUrl: string) {
  if (!dataUrl) return null
  return await new Promise<string | null>((resolve) => {
    const image = new Image()
    image.onload = () => {
      let width = image.naturalWidth || image.width || 1
      let height = image.naturalHeight || image.height || 1
      const maxDimension = 1000
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.max(1, Math.round(width * ratio))
        height = Math.max(1, Math.round(height * ratio))
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(null)
        return
      }
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.78))
    }
    image.onerror = () => resolve(null)
    image.src = dataUrl
  })
}

async function fetchAsDataUrl(src: string, fileItem?: FileItem | AIPhoto | null) {
  const inline = String(fileItem?.data || fileItem?.dataUrl || fileItem?.imageBase64 || fileItem?.file?.data || fileItem?.file?.dataUrl || '')
  if (inline.startsWith('data:')) return ensureJpegDataUrl(inline)
  if (!src) return null
  if (src.startsWith('data:')) return ensureJpegDataUrl(src)
  try {
    const response = await fetch(src)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read_failed'))
      reader.readAsDataURL(blob)
    })
    return ensureJpegDataUrl(dataUrl)
  } catch {
    return null
  }
}

function cleanSourceUrl(url: string | null | undefined) {
  if (!url) return ''
  const raw = String(url).trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const host = String(parsed.hostname || '').toLowerCase()
    const isAmazon = host === 'amazon.com' || host.endsWith('.amazon.com') || host.includes('amazon.')
    if (isAmazon) {
      const parts = String(parsed.pathname || '')
        .split('/')
        .filter(Boolean)
      const dpIndex = parts.findIndex((part) => part.toLowerCase() === 'dp')
      const asin = dpIndex >= 0 ? parts[dpIndex + 1] : ''
      if (asin && /^[A-Z0-9]{10}$/i.test(asin)) return `${parsed.protocol}//${host}/dp/${asin}`
    }
    return raw
  } catch {
    return raw
  }
}

function formatReportItemName(name: string | null | undefined) {
  const original = String(name || '').trim()
  if (!original) return 'Item'
  let next = original
  let suffix = ''
  const suffixMatch = next.match(/\([^)]+\)\s*$/)
  if (suffixMatch) {
    suffix = ` ${suffixMatch[0]}`
    next = next.slice(0, suffixMatch.index).trim()
  }
  if (next.length > 60) {
    next = next.replace(/\s+with\s+(?:Switch|USB|Remote|Timer|LED|Bluetooth|WiFi|App).*/i, '')
    next = next.replace(/,\s+\d+A\/\d+W.*/i, '')
    next = next.replace(/\s+for\s+(?:Garage|Workshop|Home|School|Kitchen|Bathroom|Office|Garden|Outdoor).*/i, '')
    next = next.replace(/\s*\([^)]*(?:Black|White|Red|Blue|Green|Yellow|Silver|Gray|Grey|Pink|Purple)[^)]*\)\s*$/i, '')
  }
  next = next.replace(/:\s*(?=\s|$)/g, '').replace(/[-–]{2,}/g, '-').replace(/\s{2,}/g, ' ').trim()
  next = next.replace(/\b(\w+)\s+\1\b/gi, '$1')
  return `${next}${suffix}`.trim() || original
}

function getFallbackRationale(item: ContentItem, data: ClaimData) {
  const disposition = normalizeDisposition(item.disposition) || 'discarded'
  const category3 = String(data.claimType || '').toLowerCase().includes('category3') || String(data.claimType || '').toLowerCase().includes('sewage')
  const aerosolization = category3 ? ' Category 3 aerosolization and contamination support replacement rather than cleaning.' : ''
  if (disposition === 'inspected') {
    return `Inspected and determined non-restorable based on the documented loss conditions.${aerosolization}`
  }
  return `Item is documented as non-restorable under the recorded loss conditions.${aerosolization}`
}

function getItemRationale(item: ContentItem, data: ClaimData) {
  return String(
    item.aiJustification
      || item.contaminationJustification
      || item.enrichment?.revised?.justification
      || getFallbackRationale(item, data),
  ).trim()
}

function resolveEvidencePhotoMatch(item: ContentItem, data: ClaimData) {
  const evidence = item.evidencePhotos || []
  return evidence
    .map((entry) => {
      let match = (data.aiPhotos || []).find((photo) => String(photo.id) === String(entry.photoId))
      if (!match) {
        const stack = (data.aiPhotos || []).find((photo) => photo.isStack && (photo.stackPhotos || []).some((stackPhoto) => String(stackPhoto.id) === String(entry.photoId)))
        if (stack) {
          match = (stack.stackPhotos || []).find((stackPhoto) => String(stackPhoto.id) === String(entry.photoId))
        }
      }
      if (!match && entry.photoName) {
        match = (data.aiPhotos || []).find((photo) => photo.name === entry.photoName)
      }
      return match
    })
    .filter((entry): entry is AIPhoto => Boolean(entry))
}

function getEvidencePhotosForItem(item: ContentItem, data: ClaimData, limit = 2) {
  const results: Array<{ src: string; label: string; fileItem: FileItem | AIPhoto | null }> = []
  resolveEvidencePhotoMatch(item, data).forEach((match) => {
    if (results.length >= limit) return
    const src = getFileSrc(match.file || match)
    if (!src) return
    results.push({ src, label: String(match.name || item.itemName || 'Photo'), fileItem: match.file || match })
  })
  ;(item.photos || []).forEach((photo) => {
    if (results.length >= limit) return
    const src = getFileSrc(photo)
    if (!src) return
    results.push({ src, label: String(photo.name || item.itemName || 'Photo'), fileItem: photo })
  })
  return results
}

async function addPhotoWithCaption(
  ctx: PDFSectionContext,
  photo: { src: string; label: string; fileItem: FileItem | AIPhoto | null },
  x: number,
  y: number,
  maxW: number,
  maxH: number,
) {
  ctx.doc.setDrawColor(220, 220, 220)
  ctx.doc.setFillColor(248, 248, 248)
  ctx.doc.rect(x, y, maxW, maxH, 'FD')
  const jpegUrl = await fetchAsDataUrl(photo.src, photo.fileItem)
  if (jpegUrl) {
    const img = new Image()
    await new Promise((resolve) => {
      img.onload = () => resolve(null)
      img.onerror = () => resolve(null)
      img.src = jpegUrl
    })
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1)
    const cellRatio = maxW / maxH
    let drawW = maxW
    let drawH = maxH
    let dx = 0
    let dy = 0
    if (ratio > cellRatio) {
      drawH = maxW / ratio
      dy = (maxH - drawH) / 2
    } else {
      drawW = maxH * ratio
      dx = (maxW - drawW) / 2
    }
    ctx.doc.addImage(jpegUrl, 'JPEG', x + dx, y + dy, drawW, drawH)
  }
  ctx.doc.setFontSize(7)
  setMutedText(ctx.doc)
  const lines = ctx.doc.splitTextToSize(photo.label || 'Photo', maxW)
  ctx.doc.text(lines.slice(0, 2), x, y + maxH + 3.5)
  resetText(ctx.doc)
}

function addSourceLink(ctx: PDFSectionContext, url: string, x: number, y: number) {
  const clean = cleanSourceUrl(url)
  if (!clean) return
  ctx.doc.setFontSize(8)
  ctx.doc.setTextColor(37, 99, 235)
  const label = 'Source'
  ctx.doc.text(label, x, y)
  const width = ctx.doc.getTextWidth(label)
  ctx.doc.link(x, y - 3.5, width, 4.5, { url: clean })
  resetText(ctx.doc)
}

function addDispositionPill(ctx: PDFSectionContext, disposition: string, x: number, y: number) {
  const label = disposition || 'open'
  const width = getTextWidth(label, ctx.doc) + 6
  const fill = label === 'discarded' ? [254, 242, 242] : label === 'inspected' ? [239, 246, 255] : [243, 244, 246]
  const text = label === 'discarded' ? [185, 28, 28] : label === 'inspected' ? [30, 64, 175] : [71, 85, 105]
  ctx.doc.setFillColor(fill[0], fill[1], fill[2])
  ctx.doc.roundedRect(x, y - 4, width, 6, 2, 2, 'F')
  ctx.doc.setFontSize(8)
  ctx.doc.setTextColor(text[0], text[1], text[2])
  ctx.doc.text(label, x + 3, y)
  resetText(ctx.doc)
}

function collectSourceLink(ctx: PDFSectionContext, item: ContentItem) {
  const url = cleanSourceUrl(item.replacementLink)
  if (!url) return
  if (ctx.sourceLinks.some((entry) => entry.url === url)) return
  ctx.sourceLinks.push({
    itemName: formatReportItemName(item.itemName || item.label || 'Item'),
    room: String(item.room || item.location || 'Unassigned'),
    url,
  })
}

async function loadWeatherSummary(address: string, dateOfLoss: string) {
  if (!address || !dateOfLoss) return null
  try {
    const geocodeQuery = encodeURIComponent(address)
    const geocodeResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${geocodeQuery}&count=1&language=en&format=json`)
    if (!geocodeResponse.ok) throw new Error('Unable to geocode address')
    const geocode = (await geocodeResponse.json()) as { results?: Array<{ latitude: number; longitude: number }> }
    const coordinates = geocode.results?.[0]
    if (!coordinates) return null
    const params = new URLSearchParams({
      latitude: String(coordinates.latitude),
      longitude: String(coordinates.longitude),
      start_date: dateOfLoss,
      end_date: dateOfLoss,
      daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean',
      timezone: 'America/New_York',
      temperature_unit: 'fahrenheit',
    })
    const weatherResponse = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`)
    if (!weatherResponse.ok) throw new Error('Unable to fetch weather')
    const payload = (await weatherResponse.json()) as {
      daily?: {
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        temperature_2m_mean?: number[]
      }
    }
    const mean = payload.daily?.temperature_2m_mean || []
    const mins = payload.daily?.temperature_2m_min || []
    const maxes = payload.daily?.temperature_2m_max || []
    if (!mean.length) return null
    return {
      avg: Math.round(mean.reduce((sum, value) => sum + value, 0) / mean.length),
      min: Math.round(Math.min(...mins)),
      max: Math.round(Math.max(...maxes)),
      date: dateOfLoss,
    }
  } catch {
    return null
  }
}

export async function renderCoverPage(ctx: PDFSectionContext) {
  const { doc, data, ML, MR, PW, CW } = ctx
  const dashboard = data.dashboard || data.claim
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2])
  doc.rect(0, 0, PW, 52, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(255, 255, 255)
  doc.text('Supplemental Contents & Expenses Report', ML, 22)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Prepared via ClaimTracker', ML, 30)
  doc.setFillColor(255, 248, 220)
  doc.setDrawColor(180, 140, 20)
  doc.roundedRect(ML, 66, CW, 28, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120, 80, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Supplemental report notice', ML + 4, 74)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('This report covers personal property, documented expenses, and support materials in addition to structural estimates.', ML + 4, 81)
  doc.text('It is intended to document claim support, not replace contractor or carrier scope documents.', ML + 4, 86)
  resetText(doc)
  autoTable(doc, {
    startY: 108,
    margin: { left: ML, right: MR },
    head: [['Field', 'Value', 'Field', 'Value']],
    body: [
      ['Insured', dashboard.insuredName || 'N/A', 'Claim #', dashboard.claimNumber || data.claim.claimNumber || 'N/A'],
      ['Address', dashboard.insuredAddress || data.claim.propertyAddress || 'N/A', 'Policy #', dashboard.policyNumber || data.claim.policyNumber || 'N/A'],
      ['Date of Loss', normalizeClaimDate(dashboard.dateOfLoss || data.claim.dateOfLoss), 'Date Reported', normalizeClaimDate(dashboard.dateReported)],
      ['Carrier', dashboard.insurerName || data.claim.insurer || 'N/A', 'Generated', fmtUSDate(new Date())],
    ],
    styles: { fontSize: 9.5, cellPadding: 3.5 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 28 }, 2: { fontStyle: 'bold', cellWidth: 28 } },
  })
  ctx.y = (((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || 135) + 10
  doc.setFontSize(10)
  doc.text('Prepared for claim review and supplemental documentation support.', ML, ctx.y)
  ctx.y += 12
}

export async function renderClaimOverview(ctx: PDFSectionContext) {
  sectionHeader(ctx, 'Claim Overview')
  const dashboard = ctx.data.dashboard || {}
  const claim = ctx.data.claim || {}
  const financials = getClaimFinancials(ctx)
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Field', 'Value', 'Field', 'Value']],
    body: [
      ['Claim #', dashboard.claimNumber || claim.claimNumber || 'N/A', 'Contents Value', formatCurrency(financials.contentsTotal)],
      ['Policy #', dashboard.policyNumber || claim.policyNumber || 'N/A', 'Out-of-Pocket Expenses', formatCurrency(financials.expensesTotal)],
      ['Insured Name', dashboard.insuredName || 'N/A', 'Deductible', financials.deductible > 0 ? `(${formatCurrency(financials.deductible)})` : 'N/A'],
      ['Address', dashboard.insuredAddress || claim.propertyAddress || 'N/A', 'Total Claimed', formatCurrency(financials.totalClaimed)],
      ['Date of Loss', normalizeClaimDate(dashboard.dateOfLoss || claim.dateOfLoss), 'Total Paid', formatCurrency(financials.totalPaid)],
      ['Date Reported', normalizeClaimDate(dashboard.dateReported), 'Depreciation Withheld', formatCurrency(financials.depreciation)],
      ['Claim Status', dashboard.claimStatus || 'Open', 'Outstanding Balance', formatCurrency(financials.outstanding)],
      ['Insurer', dashboard.insurerName || claim.insurer || 'N/A', 'Water Backup Limit', formatCurrencyOrNA(dashboard.waterBackupLimit || ctx.data.policyInsights?.waterBackupLimit)],
    ],
    styles: { fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      2: { fontStyle: 'bold', cellWidth: 34 },
      3: { halign: 'right' },
    },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 4

  const adjusterName = String(dashboard.adjusterName || '').trim()
  const adjusterPhone = getAdjusterPhone(ctx.data)
  const adjusterEmail = String(dashboard.adjusterEmail || '').trim()
  if (adjusterName || adjusterPhone || adjusterEmail) {
    ensureSpace(ctx, 14)
    ctx.doc.setFillColor(249, 250, 251)
    ctx.doc.roundedRect(ctx.ML, ctx.y, ctx.CW, 9, 2, 2, 'F')
    ctx.doc.setFontSize(8.5)
    ctx.doc.setFont('helvetica', 'bold')
    setMutedText(ctx.doc)
    ctx.doc.text('ADJUSTER:', ctx.ML + 3, ctx.y + 6)
    resetText(ctx.doc)
    ctx.doc.text([adjusterName, adjusterPhone, adjusterEmail].filter(Boolean).join('  |  '), ctx.ML + 23, ctx.y + 6)
    ctx.doc.setFont('helvetica', 'normal')
    ctx.y += 12
  } else {
    ctx.y += 4
  }

  const boxHeight = financials.deductible > 0 ? 34 : 30
  ensureSpace(ctx, boxHeight + 2)
  ctx.doc.setFillColor(LIGHT_BLUE[0], LIGHT_BLUE[1], LIGHT_BLUE[2])
  ctx.doc.setDrawColor(59, 130, 246)
  ctx.doc.roundedRect(ctx.ML, ctx.y, ctx.CW, boxHeight, 2, 2, 'FD')
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(9)
  ctx.doc.setTextColor(30, 64, 120)
  ctx.doc.text('WHAT THIS REPORT COVERS', ctx.ML + 4, ctx.y + 6)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(8)
  ctx.doc.setTextColor(55, 65, 81)
  let lineY = ctx.y + 12
  ctx.doc.text(`Personal Property: ${formatCurrency(financials.contentsTotal)}`, ctx.ML + 6, lineY)
  lineY += 4.5
  ctx.doc.text(`Out-of-Pocket Expenses: ${financials.expensesTotal > 0 ? formatCurrency(financials.expensesTotal) : 'See Expenses section'}`, ctx.ML + 6, lineY)
  lineY += 4.5
  if (financials.deductible > 0) {
    ctx.doc.text(`Less Deductible: (${formatCurrency(financials.deductible)})`, ctx.ML + 6, lineY)
    lineY += 4.5
  }
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setTextColor(30, 64, 120)
  ctx.doc.text(`Total Claimed: ${formatCurrency(financials.totalClaimed)}`, ctx.ML + 6, lineY)
  lineY += 5
  ctx.doc.setFontSize(7.5)
  ctx.doc.setTextColor(180, 60, 20)
  ctx.doc.text("This total is IN ADDITION TO contractor invoices and the adjuster's structural repair estimates.", ctx.ML + 4, lineY)
  resetText(ctx.doc)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.y += boxHeight + 6
}

export async function renderExecutiveSummary(ctx: PDFSectionContext) {
  sectionHeader(ctx, 'Executive Summary')
  const summary = updateDashboardSummary(ctx.data)
  const financials = getClaimFinancials(ctx)
  const body = [
    ['Rooms documented', String(summary.roomsCount), 'Items included', String(summary.itemCount)],
    ['Evidence photos', String(summary.photoCount), 'Pricing support added', `${Math.round(summary.enrichedPercent)}%`],
    ['Contents total', formatCurrency(financials.contentsTotal), 'Expenses total', formatCurrency(financials.expensesTotal)],
    ['Payments received', formatCurrency(getPaymentsTotal(ctx.payments)), 'Claim readiness', `${Math.round(summary.readinessPercent)}%`],
  ]
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body,
    styles: { fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
  const dashboard = ctx.data.dashboard || {}
  const claim = ctx.data.claim || {}
  const insuredName = dashboard.insuredName || 'The policyholder'
  const lossDate = normalizeClaimDate(dashboard.dateOfLoss || claim.dateOfLoss)
  const address = dashboard.insuredAddress || claim.propertyAddress || 'the insured property'
  const totalSqFt = ctx.rooms.reduce((sum, room) => sum + Number(room.sqft || 0), 0)
  const servProReport = (ctx.data.contractorReports || []).find((report) => String(report.companyName || report.name || '').toLowerCase().includes('servpro'))
  const firstReport = (ctx.data.contractorReports || []).find((report) => String(report.companyName || report.name || '').trim())
  const remediationCompany = servProReport?.companyName || servProReport?.name || firstReport?.companyName || firstReport?.name || 'a remediation contractor'
  const remediationStarts = (ctx.data.contractorReports || []).map((report) => String(report.serviceStartDate || report.dateOfService || '').trim()).filter(Boolean).sort()
  const remediationEnds = (ctx.data.contractorReports || []).map((report) => String(report.serviceEndDate || report.dateOfService || '').trim()).filter(Boolean).sort()
  const remediationWindow = remediationStarts.length
    ? `${remediationCompany} performed remediation from ${normalizeClaimDate(remediationStarts[0])} through ${normalizeClaimDate(remediationEnds[remediationEnds.length - 1] || remediationStarts[0])}. `
    : ''
  const iicrcNote = String(ctx.data.claimType || '').toLowerCase().includes('category3') || String(ctx.data.claimType || '').toLowerCase().includes('sewage')
    ? 'Items were evaluated for contamination consistent with IICRC S500 standards for Category 3 water.'
    : 'Evaluation considered the documented loss conditions and IICRC S500 remediation standards.'
  const summaryText = `${insuredName} experienced the reported loss on ${lossDate} at ${address}. The documented claim includes ${ctx.rooms.length} room${ctx.rooms.length === 1 ? '' : 's'} totaling approximately ${Math.round(totalSqFt)} square feet. ${remediationWindow}This supplemental report documents ${ctx.contents.length} personal property item${ctx.contents.length === 1 ? '' : 's'} valued at ${formatCurrency(financials.contentsTotal)}, ${formatCurrency(financials.expensesTotal)} in out-of-pocket expenses, a deductible of ${formatCurrency(financials.deductible)}, and a total supplemental claim of ${formatCurrency(financials.totalClaimed)}. ${iicrcNote}`
  ctx.doc.setFontSize(9.5)
  ctx.doc.text(ctx.doc.splitTextToSize(summaryText, ctx.CW), ctx.ML, ctx.y)
  ctx.y += ctx.doc.splitTextToSize(summaryText, ctx.CW).length * 4.5 + 4
}

export async function renderCauseOfLoss(ctx: PDFSectionContext) {
  sectionHeader(ctx, 'Cause Of Loss')
  ctx.doc.setFontSize(9)
  setMutedText(ctx.doc)
  ctx.doc.text(`Incident Type: ${formatClaimLabel(ctx.data.claim?.incidentType)}  ·  Claim Type: ${formatClaimLabel(ctx.data.claimType)}`, ctx.ML, ctx.y + 4)
  resetText(ctx.doc)
  ctx.y += 9
  const narrative = String(ctx.data.claim?.description || '').trim()
  if (!narrative) {
    setMutedText(ctx.doc)
    ctx.doc.text('No cause of loss narrative provided.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  const lines = ctx.doc.splitTextToSize(narrative, ctx.CW)
  ctx.doc.setFontSize(9)
  ctx.doc.text(lines, ctx.ML, ctx.y + 4)
  ctx.y += lines.length * 4 + 4
}

export async function renderClaimBasisStatement(ctx: PDFSectionContext) {
  sectionHeader(ctx, 'Statement Of Claim Basis And Evaluation Method')
  const category3 = String(ctx.data.claimType || '').toLowerCase().includes('category3') || String(ctx.data.claimType || '').toLowerCase().includes('sewage')
  const statements = [
    'The personal property listed in this report was inspected and determined non-restorable based on the documented loss conditions and contamination profile.',
    category3
      ? 'Category 3 loss conditions include contamination and aerosolization concerns that support replacement rather than cleaning for affected items.'
      : 'Evaluation considered documented damage conditions, item exposure, and the practical feasibility of restoring the affected contents.',
    'Replacement cost support reflects the final documented valuation for each item without baseline versus enriched labeling.',
  ]
  ctx.doc.setFontSize(10)
  statements.forEach((statement) => {
    ensureSpace(ctx, 10)
    const lines = ctx.doc.splitTextToSize(statement, ctx.CW)
    ctx.doc.text(lines, ctx.ML, ctx.y)
    ctx.y += lines.length * 4.5 + 2
  })
}

export async function renderTimeline(ctx: PDFSectionContext) {
  sectionHeader(ctx, 'Incident Timeline')
  const events = buildTimelineEvents(ctx.data)
  if (!events.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No timeline events have been recorded yet.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Date', 'Category', 'Event', 'Details']],
    body: events.map((event) => [
      normalizeClaimDate(event.date),
      String(event.category || 'Other'),
      String(event.title || event.event || 'Event'),
      String(event.description || '—'),
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 26 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
}

export async function renderRoomDocumentation(ctx: PDFSectionContext, onStatus?: (status: string) => void) {
  for (const room of ctx.rooms) {
    ctx.doc.addPage()
    ctx.y = 15
    sectionHeader(ctx, `Room Documentation - ${room.name || 'Room'}`)
    const dims = getRoomDimensions(room)
    autoTable(ctx.doc, {
      startY: ctx.y,
      margin: { left: ctx.ML, right: ctx.MR },
      head: [['Field', 'Value']],
      body: [
        ['Room', room.name || 'Room'],
        ['Dimensions', dims.label],
        ['Notes', String(room.notes || '—')],
        ['Photo Count', String((room.photos || []).length)],
      ],
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    })
    ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
    const photos = room.photos || []
    if (!photos.length) {
      setMutedText(ctx.doc)
      ctx.doc.text('No room photos attached.', ctx.ML, ctx.y + 4)
      resetText(ctx.doc)
      ctx.y += 10
      continue
    }
    const columnWidth = (ctx.CW - 6) / 2
    const photoHeight = 52
    for (let index = 0; index < photos.length; index += 2) {
      ensureSpace(ctx, photoHeight + 16)
      const pair = photos.slice(index, index + 2)
      for (let column = 0; column < pair.length; column += 1) {
        const photo = pair[column]
        const src = getFileSrc(photo)
        onStatus?.(`Rendering room documentation: ${room.name || 'Room'} photo ${index + column + 1}/${photos.length}`)
        await addPhotoWithCaption(ctx, { src, label: String(photo.name || room.name || 'Room photo'), fileItem: photo }, ctx.ML + column * (columnWidth + 6), ctx.y, columnWidth, photoHeight)
      }
      ctx.y += photoHeight + 12
    }
  }
}

function getRoomColor(name: string | null | undefined) {
  const key = String(name || '').toLowerCase()
  const palettes = [
    { match: ['kitchen'], fill: '#f59e0b' },
    { match: ['bath', 'bathroom', 'wash'], fill: '#38bdf8' },
    { match: ['bed'], fill: '#a78bfa' },
    { match: ['living', 'family'], fill: '#34d399' },
    { match: ['hall', 'entry', 'foyer'], fill: '#f472b6' },
    { match: ['laundry'], fill: '#fb7185' },
    { match: ['garage'], fill: '#94a3b8' },
    { match: ['basement'], fill: '#60a5fa' },
    { match: ['office', 'study'], fill: '#f97316' },
  ]
  return palettes.find((palette) => palette.match.some((match) => key.includes(match)))?.fill || '#334155'
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16)]
}

export async function renderFloorPlan(ctx: PDFSectionContext) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Floor Plan')
  if (!ctx.rooms.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No rooms available for floor plan rendering.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  const fpRooms = ctx.rooms.map((room, index) => {
    const dims = getRoomDimensions(room)
    const widthFt = dims.width || 10
    const lengthFt = dims.length || 10
    const x = Number(room.floorPlanX ?? (index % 3) * 14 + 8)
    const y = Number(room.floorPlanY ?? Math.floor(index / 3) * 14 + 8)
    return {
      room,
      widthFt,
      lengthFt,
      x,
      y,
      rotation: Number(room.floorPlanRotation || 0),
      color: getRoomColor(room.name),
      label: dims.label,
    }
  })
  const minX = Math.min(...fpRooms.map((entry) => entry.x - entry.widthFt / 2))
  const minY = Math.min(...fpRooms.map((entry) => entry.y - entry.lengthFt / 2))
  const maxX = Math.max(...fpRooms.map((entry) => entry.x + entry.widthFt / 2))
  const maxY = Math.max(...fpRooms.map((entry) => entry.y + entry.lengthFt / 2))
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const maxWidth = ctx.CW - 8
  const maxHeight = 120
  const scale = Math.min(maxWidth / spanX, maxHeight / spanY)
  const drawW = spanX * scale
  const drawH = spanY * scale
  const originX = ctx.ML + (ctx.CW - drawW) / 2
  const originY = ctx.y
  ctx.doc.setFillColor(15, 23, 42)
  ctx.doc.roundedRect(originX - 3, originY, drawW + 6, drawH + 6, 3, 3, 'F')
  fpRooms.forEach((entry) => {
    const width = entry.widthFt * scale
    const height = entry.lengthFt * scale
    const x = originX + (entry.x - minX) * scale - width / 2
    const y = originY + (entry.y - minY) * scale - height / 2
    const [r, g, b] = hexToRgb(entry.color)
    ctx.doc.setFillColor(r, g, b)
    ctx.doc.setDrawColor(255, 255, 255)
    ctx.doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD')
    ctx.doc.setTextColor(255, 255, 255)
    ctx.doc.setFontSize(Math.max(5, Math.min(8, Math.min(width, height) / 4)))
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.text(ctx.doc.splitTextToSize(entry.room.name || 'Room', width - 4), x + width / 2, y + height / 2 - 1, { align: 'center', baseline: 'middle' })
  })
  resetText(ctx.doc)
  ctx.y += drawH + 14
}

export async function renderContentsInventory(ctx: PDFSectionContext, onStatus?: (status: string) => void) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Contents Inventory')
  if (!ctx.contents.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No claimable contents items are currently included.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Item', 'Room', 'Qty', 'Unit Price', 'Total']],
    body: ctx.contents.map((item) => [
      formatReportItemName(item.itemName || item.label || 'Item'),
      String(item.room || item.location || 'Unassigned'),
      String(item.quantity || 1),
      formatCurrency(Number(item.unitPrice || item.replacementCost || 0)),
      formatCurrency(getItemTotalValue(item)),
    ]),
    styles: { fontSize: 8.2, cellPadding: 2.8 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'right', cellWidth: 24 }, 4: { halign: 'right', cellWidth: 24 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8

  for (const [index, item] of ctx.contents.entries()) {
    ensureSpace(ctx, 36)
    onStatus?.(`Rendering contents inventory item ${index + 1}/${ctx.contents.length}`)
    const room = String(item.room || item.location || 'Unassigned')
    const itemName = formatReportItemName(item.itemName || item.label || 'Item')
    const rationale = getItemRationale(item, ctx.data)
    const disposition = normalizeDisposition(item.disposition) || 'discarded'
    ctx.doc.setFillColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2])
    ctx.doc.roundedRect(ctx.ML, ctx.y, ctx.CW, 24, 2, 2, 'F')
    ctx.doc.setFontSize(10)
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.text(itemName, ctx.ML + 3, ctx.y + 6)
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setFontSize(8.5)
    setMutedText(ctx.doc)
    ctx.doc.text(`${room} • Qty ${item.quantity || 1} • ${formatCurrency(getItemTotalValue(item))}`, ctx.ML + 3, ctx.y + 11)
    resetText(ctx.doc)
    addDispositionPill(ctx, disposition, ctx.PW - ctx.MR - 26, ctx.y + 6)
    const rationaleLines = ctx.doc.splitTextToSize(rationale, ctx.CW - 8)
    ctx.doc.setFontSize(8.5)
    ctx.doc.text(rationaleLines.slice(0, 3), ctx.ML + 3, ctx.y + 16)
    collectSourceLink(ctx, item)
    if (item.replacementLink) {
      addSourceLink(ctx, item.replacementLink, ctx.ML + 3, ctx.y + 21.5)
    }
    ctx.y += Math.max(28, 18 + rationaleLines.slice(0, 3).length * 4)

    const photos = getEvidencePhotosForItem(item, ctx.data, 2)
    if (photos.length) {
      ensureSpace(ctx, 56)
      for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 1) {
        await addPhotoWithCaption(ctx, photos[photoIndex], ctx.ML + photoIndex * ((ctx.CW - 6) / 2 + 6), ctx.y, (ctx.CW - 6) / 2, 42)
      }
      ctx.y += 52
    }
  }
}

export async function renderPhotoEvidence(ctx: PDFSectionContext, onStatus?: (status: string) => void) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Photo Evidence')
  for (const room of ctx.rooms) {
    const roomPhotos = room.photos || []
    if (!roomPhotos.length) continue
    ensureSpace(ctx, 12)
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.setFontSize(10)
    ctx.doc.text(room.name || 'Room', ctx.ML, ctx.y + 5)
    ctx.y += 10
    const colWidth = (ctx.CW - 12) / 3
    for (let index = 0; index < roomPhotos.length; index += 3) {
      ensureSpace(ctx, 52)
      const row = roomPhotos.slice(index, index + 3)
      for (let column = 0; column < row.length; column += 1) {
        onStatus?.(`Rendering photo evidence: ${room.name || 'Room'} photo ${index + column + 1}/${roomPhotos.length}`)
        await addPhotoWithCaption(ctx, { src: getFileSrc(row[column]), label: String(row[column].name || room.name || 'Photo'), fileItem: row[column] }, ctx.ML + column * (colWidth + 6), ctx.y, colWidth, 38)
      }
      ctx.y += 48
    }
  }
  if (ctx.y === 29) {
    setMutedText(ctx.doc)
    ctx.doc.text('No room photo evidence has been attached.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
  }
}

export async function renderDamageAssessment(ctx: PDFSectionContext) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Damage Assessment')
  const counts = {
    discarded: 0,
    clean: 0,
    inspected: 0,
    pending: 0,
  }
  ctx.contents.forEach((item) => {
    const disposition = normalizeDisposition(item.disposition)
    if (disposition === 'discarded') {
      counts.discarded += 1
      return
    }
    if (disposition === 'inspected') {
      counts.inspected += 1
      return
    }
    if (disposition === 'clean') {
      counts.clean += 1
      return
    }
    counts.pending += 1
  })
  const gap = 6
  const tileWidth = (ctx.CW - gap * 3) / 4
  const tileHeight = 26
  const tiles = [
    { label: 'Discarded', value: counts.discarded, fill: [254, 242, 242] as [number, number, number], text: [185, 28, 28] as [number, number, number] },
    { label: 'Clean', value: counts.clean, fill: [240, 253, 244] as [number, number, number], text: [21, 128, 61] as [number, number, number] },
    { label: 'Inspected', value: counts.inspected, fill: [255, 251, 235] as [number, number, number], text: [180, 83, 9] as [number, number, number] },
    { label: 'Pending Review', value: counts.pending, fill: [243, 244, 246] as [number, number, number], text: [75, 85, 99] as [number, number, number] },
  ]
  tiles.forEach((tile, index) => {
    const x = ctx.ML + index * (tileWidth + gap)
    ctx.doc.setFillColor(tile.fill[0], tile.fill[1], tile.fill[2])
    ctx.doc.roundedRect(x, ctx.y, tileWidth, tileHeight, 2, 2, 'F')
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.setFontSize(16)
    ctx.doc.setTextColor(tile.text[0], tile.text[1], tile.text[2])
    ctx.doc.text(String(tile.value), x + tileWidth / 2, ctx.y + 11, { align: 'center' })
    ctx.doc.setFontSize(8.5)
    ctx.doc.text(tile.label, x + tileWidth / 2, ctx.y + 19, { align: 'center' })
  })
  resetText(ctx.doc)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.y += tileHeight + 8
}

export async function renderExpenses(ctx: PDFSectionContext, onStatus?: (status: string) => void) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Expenses')
  const weather = await loadWeatherSummary(ctx.data.dashboard.insuredAddress || ctx.data.claim.propertyAddress, ctx.data.dashboard.dateOfLoss || ctx.data.claim.dateOfLoss)
  if (weather) {
    ctx.doc.setFillColor(255, 251, 235)
    ctx.doc.setDrawColor(217, 119, 6)
    ctx.doc.roundedRect(ctx.ML, ctx.y, ctx.CW, 13, 2, 2, 'FD')
    ctx.doc.setFontSize(8.5)
    ctx.doc.text(`Weather support for ${fmtUSDate(weather.date)}: avg ${weather.avg}°F, low ${weather.min}°F, high ${weather.max}°F.`, ctx.ML + 3, ctx.y + 8)
    ctx.y += 18
  }
  if (!ctx.expenseEntries.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No expense entries have been recorded.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  onStatus?.('Rendering expenses tables')
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Date', 'Category', 'Description', 'Amount']],
    body: ctx.expenseEntries.map((entry) => [
      normalizeClaimDate(entry.dateStart || entry.date),
      String(entry.category || 'Other'),
      String(entry.description || entry.vendor || '—'),
      formatCurrency(Number(entry.amount || 0)),
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { cellWidth: 25 }, 3: { halign: 'right', cellWidth: 26 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
}

export async function renderPolicyCoverage(ctx: PDFSectionContext) {
  sectionHeader(ctx, 'Policy Coverage')
  const policyInsights = ctx.data.policyInsights || {}
  if (!hasMeaningfulValue(policyInsights)) {
    setMutedText(ctx.doc)
    ctx.doc.text('No policy document uploaded.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Coverage', 'Limit']],
    body: [
      ['Coverage A (Dwelling)', formatCurrencyOrNA(policyInsights.limits?.A)],
      ['Coverage B (Other Structures)', formatCurrencyOrNA(policyInsights.limits?.B)],
      ['Coverage C (Personal Property)', formatCurrencyOrNA(policyInsights.limits?.C)],
      ['Coverage D (Loss of Use)', formatCurrencyOrNA(policyInsights.limits?.D)],
    ],
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 1: { halign: 'right', cellWidth: 34 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 4
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Policy Details', 'Value']],
    body: [
      ['Loss Settlement Type', String(policyInsights.lossSettlementType || 'N/A')],
      ['Water Backup Limit', formatCurrencyOrNA(policyInsights.waterBackupLimit)],
      ['Mold Limit', formatCurrencyOrNA(policyInsights.moldLimit)],
      ['Deductible', formatCurrencyOrNA(policyInsights.sectionIDeductible)],
      ['Loss of Use Coverage', policyInsights.hasLossOfUse ? 'Yes' : 'No'],
      ['Water Backup Endorsement', policyInsights.hasWaterBackup ? 'Yes' : 'No'],
      ['Matching Coverage', policyInsights.hasMatching ? 'Yes' : 'No'],
      ['Ordinance / Law', policyInsights.hasOrdinanceLaw ? 'Yes' : 'No'],
    ],
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 1: { halign: 'right', cellWidth: 38 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
}

export async function renderContractorReports(ctx: PDFSectionContext) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Contractor Reports')
  const reports = ctx.data.contractorReports || []
  if (!reports.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No contractor reports uploaded.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  for (const report of reports) {
    ensureSpace(ctx, 24)
    ctx.doc.setFillColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2])
    ctx.doc.roundedRect(ctx.ML, ctx.y, ctx.CW, 22, 2, 2, 'F')
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.setFontSize(10)
    ctx.doc.text(report.companyName || report.name || 'Contractor report', ctx.ML + 3, ctx.y + 6)
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setFontSize(8.5)
    ctx.doc.text(`${report.trade || report.workType || 'Trade'} • ${normalizeClaimDate(report.dateOfService || report.serviceStartDate)}`, ctx.ML + 3, ctx.y + 11)
    const details = [report.scopeOfWork || report.workDescription, ...(Array.isArray(report.findings) ? report.findings : String(report.findings || '').split(/\n|;/)), ...(Array.isArray(report.recommendations) ? report.recommendations : String(report.recommendations || '').split(/\n|;/))]
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .slice(0, 4)
    ctx.doc.text(ctx.doc.splitTextToSize(details.join(' | ') || 'No findings provided.', ctx.CW - 6).slice(0, 3), ctx.ML + 3, ctx.y + 16)
    ctx.y += 28
  }
}

export async function renderReceipts(ctx: PDFSectionContext) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Receipts')
  const receipts = ctx.data.receipts || []
  if (!receipts.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No receipts uploaded.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Store', 'Date', 'Line Items', 'Receipt Total']],
    body: receipts.map((receipt) => [
      String(receipt.store || receipt.name || 'Receipt'),
      normalizeClaimDate(receipt.purchaseDate || receipt.date),
      String((receipt.lineItems || receipt.items || []).length || 0),
      formatCurrency(Number(receipt.receiptTotal || 0)),
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 3: { halign: 'right', cellWidth: 30 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
}

export async function renderCommunicationsLog(ctx: PDFSectionContext) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Communications Log')
  const communications = [...(ctx.data.communications || [])].sort((left, right) => {
    const leftDate = toDatePdf(left.date)?.getTime() || 0
    const rightDate = toDatePdf(right.date)?.getTime() || 0
    return leftDate - rightDate
  })
  if (!communications.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No communications recorded.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Date', 'Party', 'Type', 'Summary']],
    body: communications.map((entry) => [
      normalizeClaimDate(entry.date),
      String(entry.party || entry.person || entry.contactPerson || '—'),
      String(entry.type || 'Communication'),
      String(entry.summary || entry.followUpTask || '—'),
    ]),
    styles: { fontSize: 8.3, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 28 }, 2: { cellWidth: 24 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
}

export async function renderPayments(ctx: PDFSectionContext) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Payments Received')
  if (!ctx.payments.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No payments logged.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Date', 'Payer', 'Type', 'Description', 'Amount']],
    body: ctx.payments.map((payment) => [
      normalizeClaimDate(payment.date),
      String(payment.payer || payment.from || 'Insurance'),
      String(payment.type || payment.source || 'Payment'),
      String(payment.description || payment.notes || '—'),
      formatCurrency(Number(payment.amount || 0)),
    ]),
    styles: { fontSize: 8.4, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 28 }, 2: { cellWidth: 20 }, 4: { halign: 'right', cellWidth: 24 } },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 8
}

export async function renderSourceLinks(ctx: PDFSectionContext) {
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Source Links Index')
  if (!ctx.sourceLinks.length) {
    setMutedText(ctx.doc)
    ctx.doc.text('No replacement links were attached to inventory items.', ctx.ML, ctx.y + 4)
    resetText(ctx.doc)
    ctx.y += 10
    return
  }
  for (const entry of ctx.sourceLinks) {
    ensureSpace(ctx, 10)
    ctx.doc.setFont('helvetica', 'bold')
    ctx.doc.setFontSize(9)
    ctx.doc.text(`${entry.itemName} (${entry.room})`, ctx.ML, ctx.y + 4)
    ctx.doc.setFont('helvetica', 'normal')
    ctx.doc.setFontSize(8)
    ctx.doc.setTextColor(37, 99, 235)
    const lines = ctx.doc.splitTextToSize(entry.url, ctx.CW)
    ctx.doc.text(lines, ctx.ML, ctx.y + 9)
    const width = Math.min(ctx.CW, ctx.doc.getTextWidth(lines[0] || entry.url))
    ctx.doc.link(ctx.ML, ctx.y + 5, width, 4.5, { url: entry.url })
    resetText(ctx.doc)
    ctx.y += 12
  }
}

export async function renderClaimSummary(ctx: PDFSectionContext) {
  const financials = getClaimFinancials(ctx)
  ctx.doc.addPage()
  ctx.y = 15
  sectionHeader(ctx, 'Claim Summary')
  const body = [
    ['Personal Property', formatCurrency(financials.contentsTotal)],
    ['Out-of-Pocket Expenses', formatCurrency(financials.expensesTotal)],
    ['Less Deductible', `(${formatCurrency(financials.deductible)})`],
    ['Total Claimed', formatCurrency(financials.totalClaimed)],
    ['Total Paid to Date', formatCurrency(financials.totalPaid)],
    ['Outstanding Balance', formatCurrency(financials.outstanding)],
  ]
  autoTable(ctx.doc, {
    startY: ctx.y,
    margin: { left: ctx.ML, right: ctx.MR },
    head: [['Category', 'Amount']],
    body,
    styles: { fontSize: 9.5, cellPadding: 3 },
    headStyles: { fillColor: LIGHT_BLUE, textColor: NAVY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.row.index === 3) {
        hook.cell.styles.fontStyle = 'bold'
        hook.cell.styles.fillColor = [255, 255, 240]
      }
    },
  })
  ctx.y = (((ctx.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) || ctx.y) + 6

  const noticeLines = [
    'The amounts above represent documented personal property losses and out-of-pocket expenses only.',
    'They are supplemental to contractor invoices, structural estimates, remediation bills, and other Coverage A repair costs.',
  ]
  const noticeHeight = 18
  ensureSpace(ctx, noticeHeight + 4)
  ctx.doc.setFillColor(YELLOW_BG[0], YELLOW_BG[1], YELLOW_BG[2])
  ctx.doc.setDrawColor(YELLOW_BORDER[0], YELLOW_BORDER[1], YELLOW_BORDER[2])
  ctx.doc.roundedRect(ctx.ML, ctx.y, ctx.CW, noticeHeight, 2, 2, 'FD')
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setFontSize(8.5)
  ctx.doc.setTextColor(120, 80, 0)
  ctx.doc.text('IMPORTANT:', ctx.ML + 4, ctx.y + 6)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setTextColor(90, 70, 0)
  ctx.doc.text(noticeLines, ctx.ML + 4, ctx.y + 10)
  resetText(ctx.doc)
  ctx.y += noticeHeight + 8

  ensureSpace(ctx, 16)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(9)
  ctx.doc.text('Prepared by:', ctx.ML, ctx.y + 6)
  ctx.doc.line(ctx.ML + 24, ctx.y + 6.5, ctx.ML + 90, ctx.y + 6.5)
  ctx.doc.text('Date:', ctx.ML + 98, ctx.y + 6)
  ctx.doc.line(ctx.ML + 108, ctx.y + 6.5, ctx.ML + 140, ctx.y + 6.5)
  ctx.y += 12
  ctx.doc.text(`Policyholder: ${ctx.data.dashboard?.insuredName || 'N/A'}`, ctx.ML, ctx.y + 6)
  ctx.y += 10
}

export function addPageFooters(ctx: PDFSectionContext) {
  const count = ctx.doc.getNumberOfPages()
  const dashboard = ctx.data.dashboard || {}
  const claimNumber = dashboard.claimNumber || ctx.data.claim.claimNumber || 'N/A'
  const policyNumber = dashboard.policyNumber || ctx.data.claim.policyNumber || 'N/A'
  const insuredName = dashboard.insuredName || 'N/A'
  const generated = fmtUSDate(new Date())
  for (let page = 1; page <= count; page += 1) {
    ctx.doc.setPage(page)
    ctx.doc.setFontSize(7.5)
    ctx.doc.setTextColor(160, 160, 160)
    ctx.doc.text(`Claim #${claimNumber}  |  Policy #${policyNumber}  |  ${insuredName}  |  Generated ${generated}  |  Page ${page} of ${count}`, ctx.PW / 2, ctx.PH - 6, { align: 'center' })
  }
  resetText(ctx.doc)
}

export async function renderAllPDFSections(ctx: PDFSectionContext, options: PDFRenderOptions = {}) {
  await renderCoverPage(ctx)
  await renderClaimOverview(ctx)
  await renderExecutiveSummary(ctx)
  await renderCauseOfLoss(ctx)
  await renderClaimBasisStatement(ctx)
  await renderTimeline(ctx)
  await renderRoomDocumentation(ctx, options.onStatus)
  await renderFloorPlan(ctx)
  await renderContentsInventory(ctx, options.onStatus)
  await renderPhotoEvidence(ctx, options.onStatus)
  await renderDamageAssessment(ctx)
  await renderExpenses(ctx, options.onStatus)
  await renderPolicyCoverage(ctx)
  await renderContractorReports(ctx)
  await renderReceipts(ctx)
  await renderCommunicationsLog(ctx)
  await renderPayments(ctx)
  await renderSourceLinks(ctx)
  await renderClaimSummary(ctx)
}
