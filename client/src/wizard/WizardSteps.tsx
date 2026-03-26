import { useEffect, useMemo, useRef, useState } from 'react'
import { PhotoUploader } from '@/components/shared/PhotoUploader'
import {
  CLAIM_TYPE_OPTIONS,
  ONBOARDING_TIP_PREFIX,
  autoImportPhotosToAIBuilder,
  buildPhotoLibraryEntries,
  createExpenseEntryDraft,
  ensureFloorPlanSettings,
  getStoredOnboardingStep,
  markOnboardingComplete,
  setStoredOnboardingStep,
  syncClaimReceipts,
  formatCurrency,
  getExpensesTotal,
  upsertExpenseEntry,
  updateRoomDimensions,
  uploadAndAnalyzeContractorReport,
  getExpenseEntriesByCategory,
  removeExpenseEntry,
} from '@/lib/claimWorkflow'
import { compressImageToDataUrl, dataUrlToBase64, readFileAsDataUrl } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { normalizeReceiptPayload, getReceiptItems } from '@/lib/claimWorkflow'
import { extractPolicyText, parsePolicyFields } from '@/lib/policyParser'
import { storeDataUrl, storeMediaFile, uploadFile } from '@/lib/firebase'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { AnalysisMode, ExpenseEntry, FileItem, Receipt, Room } from '@/types/claim'
import { FloorPlanCanvas } from '@/tabs/FloorPlan/FloorPlanCanvas'
import { ReceiptModal } from '@/tabs/Receipts/ReceiptModal'
import { ExpenseModal } from '@/tabs/Expenses/ExpenseModal'
import { WeatherCard } from '@/tabs/Expenses/WeatherCard'

const steps = [
  'Claim Type',
  'Claim Info',
  'Rooms',
  'Photos',
  'Photo Review',
  'Floor Plan',
  'Receipts',
  'Contractors',
  'Expenses',
  'AI Launch',
  'Review',
  'Done',
] as const

const stepTips: Partial<Record<number, string>> = {
  1: 'Start with the broad claim type. You can refine supporting detail later without breaking the workflow.',
  3: 'List every affected space, including hallways, closets, and transition areas. Those rooms matter in documentation and square footage.',
  4: 'Use wide room shots here. Save close-up damaged item photos for AI Builder if you need item extraction.',
  6: 'Drag rooms into approximate position. The point is layout clarity, not architectural perfection.',
  8: 'Quick-add entries are enough to seed ALE tracking. You can refine line items later in the Expenses tab.',
}

function buildRoomDraft(): Room {
  return updateRoomDimensions({
    id: crypto.randomUUID(),
    name: '',
    length: '',
    width: '',
    sqft: '',
    notes: '',
    photos: [],
    floorPlanVisible: true,
  })
}

function cycleMode(mode: AnalysisMode): AnalysisMode {
  if (mode === 'ITEM_VIEW') return 'ROOM_VIEW'
  if (mode === 'ROOM_VIEW') return 'FOCUSED_VIEW'
  return 'ITEM_VIEW'
}

async function buildReceiptDataUrl(file: File) {
  if (file.type.startsWith('image/')) return compressImageToDataUrl(file)
  return readFileAsDataUrl(file)
}

export function WizardSteps() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const wizard = useUIStore((state) => state.wizard)
  const setWizardOpen = useUIStore((state) => state.setWizardOpen)
  const setWizardStep = useUIStore((state) => state.setWizardStep)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const [roomDraft, setRoomDraft] = useState<Room>(buildRoomDraft())
  const [photoRoomId, setPhotoRoomId] = useState<string>('')
  const [uploadingCount, setUploadingCount] = useState(0)
  const [tipDismissed, setTipDismissed] = useState(false)
  const [preScreenModes, setPreScreenModes] = useState<Record<string, AnalysisMode>>({})
  const [policyUploadStatus, setPolicyUploadStatus] = useState<string>('')
  const [receiptParsing, setReceiptParsing] = useState<string>('')
  const [reportParsing, setReportParsing] = useState<string>('')
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)

  const handlePolicyUpload = async (file: File) => {
    setPolicyUploadStatus(`📄 ${file.name} — processing...`)
    try {
      const text = await extractPolicyText(file)
      const { dashboard } = parsePolicyFields(text)
      const filledCount = Object.keys(dashboard).length

      // Store file reference in policyDocs
      const docEntry = { id: `pol-${Date.now()}`, name: file.name, docType: 'declarations' }

      // Auto-fill dashboard + claim fields
      updateData((current) => {
        const db = { ...current.dashboard }
        const cl = { ...current.claim }
        if (dashboard.insuredName) { db.insuredName = dashboard.insuredName; cl.insuredName = dashboard.insuredName }
        if (dashboard.claimNumber) { db.claimNumber = dashboard.claimNumber; cl.claimNumber = dashboard.claimNumber }
        if (dashboard.policyNumber) { db.policyNumber = dashboard.policyNumber; cl.policyNumber = dashboard.policyNumber }
        if (dashboard.insuredAddress) { db.insuredAddress = dashboard.insuredAddress; cl.propertyAddress = dashboard.insuredAddress }
        if (dashboard.insurerName) { db.insurerName = dashboard.insurerName; cl.insurer = dashboard.insurerName }
        if (dashboard.deductible) { db.deductible = dashboard.deductible; cl.deductible = dashboard.deductible }
        if (dashboard.dateOfLoss) { db.dateOfLoss = dashboard.dateOfLoss; cl.dateOfLoss = dashboard.dateOfLoss }
        return {
          ...current,
          dashboard: db,
          claim: cl,
          policyDocs: [...(current.policyDocs || []), docEntry],
        }
      })

      setPolicyUploadStatus(
        filledCount > 0
          ? `✅ ${file.name} — ${filledCount} field${filledCount === 1 ? '' : 's'} filled!`
          : `⚠️ ${file.name} — couldn't extract fields. Fill them in manually below.`
      )
    } catch (err) {
      console.error('Policy upload failed', err)
      setPolicyUploadStatus(`⚠️ Could not process ${file.name}. Try another file.`)
    }
  }

  // Restore step from localStorage only on initial open
  const initializedRef = useRef(false)
  useEffect(() => {
    if (wizard.open && !initializedRef.current) {
      initializedRef.current = true
      const stored = getStoredOnboardingStep()
      if (wizard.step !== stored) setWizardStep(stored)
    }
  }, [setWizardStep, wizard.open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist step changes to localStorage
  useEffect(() => {
    if (wizard.open) setStoredOnboardingStep(wizard.step)
  }, [wizard.step, wizard.open])

  useEffect(() => {
    setPhotoRoomId((current) => current || data.rooms[0]?.id || '')
  }, [data.rooms])

  useEffect(() => {
    setTipDismissed(localStorage.getItem(`${ONBOARDING_TIP_PREFIX}${wizard.step}`) === 'dismissed')
  }, [wizard.step])

  const contentRef = { current: null as HTMLDivElement | null }
  const progress = Math.round((wizard.step / steps.length) * 100)
  const photoEntries = useMemo(() => buildPhotoLibraryEntries(data), [data])
  const wizardTip = !tipDismissed ? stepTips[wizard.step] : null
  const floorPlan = ensureFloorPlanSettings(data.floorPlan)
  const utilityRanges = useMemo(
    () => (data.expenses.utilityEntries || []).map((entry) => ({ start: entry.dateStart, end: entry.dateEnd, label: entry.description || entry.utilityType || 'Utility span' })),
    [data.expenses.utilityEntries],
  )

  function closeWizard() {
    updateData((current) => ({
      ...current,
      onboarding: {
        ...current.onboarding,
        wizardDismissedAt: new Date().toISOString(),
      },
    }))
    setWizardOpen(false)
  }

  function nextStep() {
    setWizardStep(Math.min(steps.length, wizard.step + 1))
  }

  function previousStep() {
    setWizardStep(Math.max(1, wizard.step - 1))
  }

  function addRoom() {
    if (!roomDraft.name?.trim()) {
      pushToast('Enter a room name before adding it.', 'warning')
      return
    }
    const isEditing = data.rooms.some((r) => r.id === roomDraft.id)
    if (isEditing) {
      updateData((current) => ({
        ...current,
        rooms: current.rooms.map((r) => r.id === roomDraft.id ? updateRoomDimensions({ ...roomDraft }) : r),
      }))
      pushToast('Room updated.', 'success')
    } else {
      updateData((current) => ({
        ...current,
        rooms: [...current.rooms, updateRoomDimensions({ ...roomDraft, id: crypto.randomUUID() })],
      }))
    }
    setRoomDraft(buildRoomDraft())
  }

  async function uploadRoomPhotos(files: Array<{ file: File; previewUrl: string }>) {
    if (!photoRoomId) {
      pushToast('Select a room first.', 'warning')
      return
    }
    const room = data.rooms.find((entry) => String(entry.id) === photoRoomId)
    if (!room) return
    setUploadingCount(files.length)
    const stored = await Promise.all(
      files.map(async ({ file }) => {
        try {
          const uploaded = await uploadFile(file, 'room-photos')
          return {
            ...uploaded,
            id: crypto.randomUUID(),
            filename: file.name,
            roomId: room.id,
          } satisfies FileItem
        } catch (err) {
          console.warn('Room photo upload failed:', err)
          pushToast(`Failed to upload ${file.name}`, 'warning')
          return null
        }
      }),
    ).then((results) => results.filter((r): r is FileItem => r !== null))
    setUploadingCount(0)
    updateData((current) => ({
      ...current,
      rooms: current.rooms.map((entry) => (
        String(entry.id) === String(room.id) ? { ...entry, photos: [...(entry.photos || []), ...stored] } : entry
      )),
    }))
    pushToast(`${stored.length} room photo${stored.length === 1 ? '' : 's'} uploaded.`, 'success')
  }

  function applyPreScreen() {
    const imported = photoEntries.map((entry) => ({
      ...(entry.photo as FileItem),
      id: (entry.photo as { id?: string | number }).id || crypto.randomUUID(),
      roomId: entry.roomId,
      roomName: entry.roomName,
      status: 'pending' as const,
      analysisMode: preScreenModes[entry.id] || (entry.roomId ? 'ROOM_VIEW' : 'ITEM_VIEW'),
      source: 'wizard-prescreen',
    }))

    updateData((current) => {
      const existingKeys = new Set(current.aiPhotos.map((photo) => `${photo.path || ''}|${photo.url || ''}|${photo.name || photo.filename || ''}`))
      const nextPhotos = imported.filter((photo) => !existingKeys.has(`${photo.path || ''}|${photo.url || ''}|${photo.name || photo.filename || ''}`))
      return {
        ...current,
        aiPhotos: [...current.aiPhotos, ...nextPhotos],
        aiNeedsUpdate: true,
      }
    })
    pushToast('Pre-screen recommendations sent to AI Builder.', 'success')
  }

  async function uploadReceipts(files: Array<{ file: File; previewUrl: string }>) {
    for (let i = 0; i < files.length; i++) {
      const { file, previewUrl } = files[i]
      setReceiptParsing(`Parsing receipt ${i + 1} of ${files.length}: ${file.name}…`)
      try {
        const isImage = file.type.startsWith('image/')
        const dataUrl = isImage ? previewUrl : await buildReceiptDataUrl(file)
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        const text = isPdf ? await extractPolicyText(file) : undefined

        const payload = await apiClient.analyzeReceipt({
          imageBase64: isPdf ? undefined : dataUrlToBase64(dataUrl),
          receiptBase64: isPdf ? undefined : dataUrlToBase64(dataUrl),
          mimeType: file.type || 'application/octet-stream',
          text,
        })
        const receipt = normalizeReceiptPayload(payload, { name: file.name, type: file.type })
        receipt.dataUrl = dataUrl
        receipt.url = dataUrl
        updateData((current) => syncClaimReceipts({ ...current, receipts: [receipt, ...current.receipts] }))
      } catch (err) {
        // If AI parsing fails, still save the receipt with raw data
        const dataUrl = file.type.startsWith('image/') ? previewUrl : await buildReceiptDataUrl(file)
        const receipt: Receipt = {
          id: crypto.randomUUID(),
          fileName: file.name,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          dataUrl,
          url: dataUrl,
          items: [],
          lineItems: [],
          receiptTotal: 0,
          store: '',
          purchaseDate: '',
          date: '',
          addedToInventory: false,
          inventoryItemIds: [],
        }
        updateData((current) => syncClaimReceipts({ ...current, receipts: [receipt, ...current.receipts] }))
        pushToast(`⚠️ Could not parse ${file.name} — saved without extraction.`, 'error')
      }
    }
    setReceiptParsing('')
    pushToast(`${files.length} receipt${files.length === 1 ? '' : 's'} processed.`, 'success')
  }

  function quickAddExpense(category: ExpenseEntry['category'], description: string, amount: number) {
    const draft = createExpenseEntryDraft(category)
    const next = {
      ...draft,
      id: crypto.randomUUID(),
      category,
      description,
      amount,
      dailyCost: amount,
      date: data.dashboard.dateOfLoss || data.claim.dateOfLoss || '',
      dateStart: data.dashboard.dateOfLoss || data.claim.dateOfLoss || '',
      dateEnd: data.dashboard.dateOfLoss || data.claim.dateOfLoss || '',
    }
    updateData((current) => ({
      ...current,
      expenses: upsertExpenseEntry(current.expenses, next),
    }))
    pushToast(`${category} expense added.`, 'success')
  }

  function launchAI() {
    updateData((current) => ({
      ...current,
      aiPhotos: current.aiPhotos.length ? current.aiPhotos : autoImportPhotosToAIBuilder(current),
      aiNeedsUpdate: true,
    }))
    setActiveTab('ai-builder')
    window.location.hash = '#ai-builder'
    pushToast('AI Builder is ready for analysis.', 'success')
  }

  function finish(target: 'maximizer' | 'contents') {
    markOnboardingComplete()
    setWizardOpen(false)
    if (target === 'maximizer') {
      window.location.assign('/maximizer')
      return
    }
    setActiveTab('contents')
    window.location.hash = '#contents'
  }

  function renderStep() {
    switch (wizard.step) {
      case 1:
        return (
          <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-white">Start the claim workspace</h3>
              <p className="text-sm leading-7 text-slate-300">Pick the loss type first. It informs contamination handling, AI context, and report language.</p>
            </div>
            <div className="space-y-3">
              {CLAIM_TYPE_OPTIONS.map((option) => (
                <button
                  className={`w-full rounded-2xl border px-4 py-3 text-left ${data.claimType === option.value ? 'border-sky-400/50 bg-sky-400/10 text-white' : 'border-[color:var(--border)] bg-slate-950/35 text-slate-300'}`}
                  key={option.value}
                  onClick={() => updateData((current) => ({ ...current, claimType: option.value, claim: { ...current.claim, incidentType: option.value } }))}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="lg:col-span-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Brief description of what happened</span>
                <textarea className="field min-h-20" placeholder="e.g. Septic backup flooded the entire first floor on Feb 1st..." onChange={(e) => updateData((c) => ({ ...c, claim: { ...c.claim, description: e.target.value } }))} value={data.claim.description || ''} />
              </label>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-5">
            {/* ── Policy upload zone ── */}
            <div
              className="relative rounded-2xl border-2 border-dashed border-sky-500/30 bg-sky-500/5 px-5 py-6 text-center transition-colors hover:border-sky-400/50 hover:bg-sky-400/10"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={async (e) => {
                e.preventDefault(); e.stopPropagation()
                const file = e.dataTransfer.files[0]
                if (file) await handlePolicyUpload(file)
              }}
            >
              <p className="text-sm font-medium text-slate-200">📄 Upload your policy declarations page</p>
              <p className="mt-1 text-xs text-slate-400">Drag & drop or click to browse · PDF, TXT, or image</p>
              <input
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) await handlePolicyUpload(file)
                  e.target.value = ''
                }}
                type="file"
              />
              {policyUploadStatus && (
                <p className={`mt-3 text-sm ${policyUploadStatus.startsWith('✅') ? 'text-emerald-400' : policyUploadStatus.startsWith('⚠') ? 'text-amber-400' : 'text-slate-400'}`}>
                  {policyUploadStatus}
                </p>
              )}
            </div>

            {/* ── Manual fields ── */}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Claim number</span>
                <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, claimNumber: event.target.value }, dashboard: { ...current.dashboard, claimNumber: event.target.value } }))} value={data.claim.claimNumber || data.dashboard.claimNumber || ''} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Policy number</span>
                <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, policyNumber: event.target.value }, dashboard: { ...current.dashboard, policyNumber: event.target.value } }))} value={data.claim.policyNumber || data.dashboard.policyNumber || ''} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Date of loss</span>
                <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, dateOfLoss: event.target.value }, dashboard: { ...current.dashboard, dateOfLoss: event.target.value } }))} type="date" value={data.claim.dateOfLoss || data.dashboard.dateOfLoss || ''} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Property address</span>
                <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, propertyAddress: event.target.value }, dashboard: { ...current.dashboard, insuredAddress: event.target.value } }))} value={data.claim.propertyAddress || data.dashboard.insuredAddress || ''} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Insured name</span>
                <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, insuredName: event.target.value }, dashboard: { ...current.dashboard, insuredName: event.target.value } }))} value={data.claim.insuredName || data.dashboard.insuredName || ''} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Deductible</span>
                <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, deductible: event.target.value }, dashboard: { ...current.dashboard, deductible: event.target.value } }))} placeholder="$1,000" value={data.claim.deductible || data.dashboard.deductible || ''} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Insurer</span>
                <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, insurer: event.target.value }, dashboard: { ...current.dashboard, insurerName: event.target.value } }))} value={data.claim.insurer || data.dashboard.insurerName || ''} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Adjuster name</span>
                <input className="field" onChange={(e) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, adjusterName: e.target.value } }))} value={data.dashboard.adjusterName || ''} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Adjuster phone</span>
                <input className="field" type="tel" onChange={(e) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, adjusterPhone: e.target.value } }))} value={data.dashboard.adjusterPhone || ''} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">Adjuster email</span>
                <input className="field" type="email" onChange={(e) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, adjusterEmail: e.target.value } }))} value={data.dashboard.adjusterEmail || ''} />
              </label>
            </div>
            <button className="text-xs text-slate-500 hover:text-slate-300" onClick={nextStep} type="button">Skip — I'll enter this later →</button>
          </div>
        )
      case 3:
        return (
          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <div className="space-y-4 rounded-3xl border border-[color:var(--border)] bg-slate-950/35 p-5">
              <h3 className="text-lg font-semibold text-white">Add a room</h3>
              <input className="field" onChange={(event) => setRoomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Kitchen, Hallway, Basement..." value={roomDraft.name || ''} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs text-slate-400">Length</span>
                  <div className="flex gap-2">
                    <input className="field flex-1" min="0" onChange={(event) => setRoomDraft((current) => updateRoomDimensions({ ...current, length: String(Number(event.target.value || 0) + Number((current as unknown as Record<string,string>).lengthInches || 0) / 12) }))} placeholder="ft" type="number" value={Math.floor(Number(roomDraft.length || 0)) || ''} />
                    <input className="field w-16" min="0" max="11" onChange={(event) => { const inches = Number(event.target.value || 0); setRoomDraft((current) => updateRoomDimensions({ ...current, length: String(Math.floor(Number(current.length || 0)) + inches / 12) })) }} placeholder="in" type="number" value={Math.round((Number(roomDraft.length || 0) % 1) * 12) || ''} />
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-400">Width</span>
                  <div className="flex gap-2">
                    <input className="field flex-1" min="0" onChange={(event) => setRoomDraft((current) => updateRoomDimensions({ ...current, width: String(Number(event.target.value || 0) + Number(Math.round((Number(current.width || 0) % 1) * 12)) / 12) }))} placeholder="ft" type="number" value={Math.floor(Number(roomDraft.width || 0)) || ''} />
                    <input className="field w-16" min="0" max="11" onChange={(event) => { const inches = Number(event.target.value || 0); setRoomDraft((current) => updateRoomDimensions({ ...current, width: String(Math.floor(Number(current.width || 0)) + inches / 12) })) }} placeholder="in" type="number" value={Math.round((Number(roomDraft.width || 0) % 1) * 12) || ''} />
                  </div>
                </div>
              </div>
              <textarea className="field min-h-24" onChange={(event) => setRoomDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" value={roomDraft.notes || ''} />
              <button className="button-primary w-full" onClick={addRoom} type="button">
                {data.rooms.some((r) => r.id === roomDraft.id) ? 'Update Room' : 'Add Room'}
              </button>
              {data.rooms.some((r) => r.id === roomDraft.id) && (
                <button className="mt-1 text-xs text-slate-400 hover:text-white transition-colors" onClick={() => setRoomDraft(buildRoomDraft())} type="button">
                  Cancel editing
                </button>
              )}
            </div>
            <div className="space-y-3">
              {data.rooms.length ? data.rooms.map((room) => (
                <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4" key={room.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{room.name || 'Room'}</p>
                      <p className="mt-1 text-sm text-slate-400">{room.dimensions || 'No dimensions yet'} · {(room.photos || []).length} photos</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="button-secondary" onClick={() => setRoomDraft({ ...room })} type="button">
                        Edit
                      </button>
                      <button className="button-secondary text-rose-400 hover:text-rose-300" onClick={() => updateData((current) => ({ ...current, rooms: current.rooms.filter((entry) => entry.id !== room.id) }))} type="button">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-10 text-center text-sm text-slate-400">No rooms added yet.</div>}
            </div>
          </div>
        )
      case 4: {
        const currentRoomIndex = data.rooms.findIndex((r) => r.id === photoRoomId)
        const currentRoom = data.rooms[currentRoomIndex] || data.rooms[0]
        const roomIndex = currentRoomIndex >= 0 ? currentRoomIndex : 0
        const hasNextRoom = roomIndex < data.rooms.length - 1
        return (
          <div className="space-y-5">
            {data.rooms.length > 0 ? (
              <>
                {/* ── Current room card: groups header + uploader + thumbnails ── */}
                <div className="rounded-2xl border border-sky-400/30 bg-sky-950/20 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button className="button-secondary text-sm" disabled={roomIndex === 0} onClick={() => setPhotoRoomId(data.rooms[roomIndex - 1]?.id || '')} type="button">←</button>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Adding photos to</p>
                        <h3 className="text-xl font-bold text-white">{currentRoom?.name || 'Room'}</h3>
                      </div>
                      <button className="button-secondary text-sm" onClick={() => hasNextRoom ? setPhotoRoomId(data.rooms[roomIndex + 1]?.id || '') : nextStep()} type="button">→</button>
                    </div>
                    <span className="rounded-full bg-sky-400/15 px-3 py-1 text-sm font-semibold text-sky-200">
                      {roomIndex + 1} of {data.rooms.length} · {(currentRoom?.photos || []).length} 📷
                      {uploadingCount > 0 && <span className="ml-1 text-amber-300">({uploadingCount} uploading…)</span>}
                    </span>
                  </div>
                  <PhotoUploader key={photoRoomId} label={`Upload photos for ${currentRoom?.name || 'this room'}`} onFilesSelected={(files) => void uploadRoomPhotos(files)} />
                  {(currentRoom?.photos || []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-300">
                        {(currentRoom.photos || []).length} photo{(currentRoom.photos || []).length === 1 ? '' : 's'} uploaded
                        {uploadingCount > 0 && <span className="ml-1 text-amber-300">· {uploadingCount} uploading…</span>}
                      </p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {(currentRoom.photos || []).map((photo) => (
                          <div className="group relative" key={String(photo.id || photo.url || photo.path)}>
                            <img
                              alt={photo.name || photo.filename || currentRoom.name || 'Room photo'}
                              className="aspect-square rounded-xl object-cover"
                              src={photo.url || photo.dataUrl || photo.data || ''}
                            />
                            <button
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition hover:bg-rose-600 group-hover:opacity-100"
                              onClick={() => {
                                const photoKey = String(photo.id || photo.url || photo.path)
                                updateData((current) => ({
                                  ...current,
                                  rooms: current.rooms.map((r) =>
                                    String(r.id) === String(currentRoom.id)
                                      ? { ...r, photos: (r.photos || []).filter((p) => String(p.id || p.url || p.path) !== photoKey) }
                                      : r
                                  ),
                                }))
                                pushToast('Photo removed.', 'info')
                              }}
                              title="Remove photo"
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Room selector grid ── */}
                <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                  {data.rooms.map((room, i) => (
                    <button
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${room.id === (currentRoom?.id || '') ? 'border-sky-400/50 bg-sky-400/10 text-white' : 'border-[color:var(--border)] bg-slate-950/40 text-slate-400'}`}
                      key={room.id}
                      onClick={() => setPhotoRoomId(room.id)}
                      type="button"
                    >
                      {room.name || `Room ${i + 1}`} · {(room.photos || []).length} 📷
                    </button>
                  ))}
                </div>

                {/* ── Next room / done indicator — secondary, below grid ── */}
                {hasNextRoom ? (
                  <button className="button-secondary w-full text-sm" onClick={() => setPhotoRoomId(data.rooms[roomIndex + 1]?.id || '')} type="button">
                    Continue to next room →
                  </button>
                ) : (
                  <p className="text-sm text-emerald-400">✅ All rooms covered. Click Next to continue.</p>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-8 text-center">
                <p className="text-sm text-slate-400">Add rooms in the previous step first, then come back to upload photos.</p>
              </div>
            )}
          </div>
        )
      }
      case 5: {
        const totalPhotos = data.rooms.reduce((sum, r) => sum + (r.photos || []).length, 0)
        const roomsWithoutPhotos = data.rooms.filter((r) => (r.photos || []).length === 0)

        // Detect duplicates two ways:
        // 1. Exact filename match (same file uploaded twice)
        // 2. Same file size for image files (catches "file copy.jpg" / "file.jpg" pairs)
        // Storage paths are timestamped so always unique — useless for dupe detection
        const byName = new Map<string, string[]>()
        const bySize = new Map<string, string[]>()
        const allPhotos: Array<{ roomId: string; roomName: string; photoKey: string; name: string; size: number }> = []
        for (const room of data.rooms) {
          for (const photo of room.photos || []) {
            const name = (photo.name || photo.filename || '').toLowerCase().trim()
            const size = photo.size || 0
            const photoKey = String(photo.id || photo.url || photo.path)
            allPhotos.push({ roomId: String(room.id), roomName: room.name || 'Untitled', photoKey, name, size })
            if (name) {
              if (!byName.has(name)) byName.set(name, [])
              byName.get(name)!.push(photoKey)
            }
            // Size-based: only for images >10KB (avoids false positives on tiny files)
            if (size > 10240) {
              const sizeKey = String(size)
              if (!bySize.has(sizeKey)) bySize.set(sizeKey, [])
              bySize.get(sizeKey)!.push(photoKey)
            }
          }
        }
        const duplicateKeys = new Set<string>()
        let duplicateCount = 0
        for (const [, keys] of byName) {
          if (keys.length > 1) {
            duplicateCount++
            for (const k of keys) duplicateKeys.add(k)
          }
        }
        for (const [, keys] of bySize) {
          if (keys.length > 1) {
            // Only flag if not already caught by name match
            const uncaught = keys.filter((k) => !duplicateKeys.has(k))
            if (uncaught.length > 0 && keys.length > 1) {
              duplicateCount++
              for (const k of keys) duplicateKeys.add(k)
            }
          }
        }

        function deletePhoto(roomId: string, photoKey: string) {
          updateData((current) => ({
            ...current,
            rooms: current.rooms.map((r) =>
              String(r.id) === roomId
                ? { ...r, photos: (r.photos || []).filter((p) => String(p.id || p.url || p.path) !== photoKey) }
                : r
            ),
          }))
          pushToast('Photo removed.', 'info')
        }

        function movePhoto(fromRoomId: string, photoKey: string, toRoomId: string) {
          updateData((current) => {
            const fromRoom = current.rooms.find((r) => String(r.id) === fromRoomId)
            const photo = (fromRoom?.photos || []).find((p) => String(p.id || p.url || p.path) === photoKey)
            if (!photo) return current
            return {
              ...current,
              rooms: current.rooms.map((r) => {
                if (String(r.id) === fromRoomId) return { ...r, photos: (r.photos || []).filter((p) => String(p.id || p.url || p.path) !== photoKey) }
                if (String(r.id) === toRoomId) return { ...r, photos: [...(r.photos || []), { ...photo, roomId: toRoomId }] }
                return r
              }),
            }
          })
          const toName = data.rooms.find((r) => String(r.id) === toRoomId)?.name || 'room'
          pushToast(`Photo moved to ${toName}.`, 'success')
        }

        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-white">Photo review</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                <span className="font-semibold text-white">{totalPhotos} photo{totalPhotos === 1 ? '' : 's'}</span> across{' '}
                <span className="font-semibold text-white">{data.rooms.length} room{data.rooms.length === 1 ? '' : 's'}</span>.
                {' '}Check each room below — delete wrong photos or move them to the correct room.
              </p>
            </div>

            {roomsWithoutPhotos.length > 0 && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-5 py-4">
                <p className="text-sm font-medium text-amber-300">⚠ {roomsWithoutPhotos.length} room{roomsWithoutPhotos.length === 1 ? '' : 's'} with no photos: {roomsWithoutPhotos.map((r) => r.name || 'Untitled').join(', ')}</p>
                <button className="mt-2 text-xs font-medium text-amber-300 hover:text-amber-100" onClick={() => { setPhotoRoomId(roomsWithoutPhotos[0]?.id || ''); previousStep() }} type="button">← Go back and add photos</button>
              </div>
            )}

            {duplicateCount > 0 && (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-400/5 px-5 py-4">
                <p className="text-sm font-medium text-rose-300">⚠ {duplicateCount} possible duplicate{duplicateCount === 1 ? '' : 's'} detected ({duplicateKeys.size} photos)</p>
                <p className="mt-1 text-xs text-slate-400">Photos with the same filename appear more than once. Look for the red "DUPE" badge below — delete the extra or move it if it's in the wrong room.</p>
              </div>
            )}

            {data.rooms.map((room) => (
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/35" key={room.id}>
                <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
                  <h4 className="font-semibold text-white">{room.name || 'Untitled'}</h4>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${(room.photos || []).length > 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-700/50 text-slate-500'}`}>
                    {(room.photos || []).length} photo{(room.photos || []).length === 1 ? '' : 's'}
                  </span>
                </div>
                {(room.photos || []).length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-6">
                    {(room.photos || []).map((photo) => {
                      const photoKey = String(photo.id || photo.url || photo.path)
                      return (
                        <div className={`group relative ${duplicateKeys.has(photoKey) ? 'rounded-xl ring-2 ring-rose-500' : ''}`} key={photoKey}>
                          {duplicateKeys.has(photoKey) && <span className="absolute left-1 top-1 z-10 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white">DUPE</span>}
                          <img
                            alt={photo.name || photo.filename || room.name || 'Photo'}
                            className="aspect-square w-full rounded-xl object-cover"
                            src={photo.url || photo.dataUrl || photo.data || ''}
                          />
                          {/* Delete button */}
                          <button
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition hover:bg-rose-600 group-hover:opacity-100"
                            onClick={() => deletePhoto(String(room.id), photoKey)}
                            title="Delete photo"
                            type="button"
                          >✕</button>
                          {/* Move dropdown */}
                          {data.rooms.length > 1 && (
                            <select
                              className="absolute bottom-1 left-1 right-1 rounded-lg bg-black/80 px-1 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                              onChange={(e) => { if (e.target.value) { movePhoto(String(room.id), photoKey, e.target.value); e.target.value = '' } }}
                              title="Move to another room"
                              value=""
                            >
                              <option value="">Move to…</option>
                              {data.rooms.filter((r) => String(r.id) !== String(room.id)).map((r) => (
                                <option key={r.id} value={String(r.id)}>{r.name || 'Untitled'}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-4 text-sm text-slate-500">No photos — <button className="text-sky-400 hover:text-sky-300" onClick={() => { setPhotoRoomId(String(room.id)); previousStep() }} type="button">go back to add some</button></div>
                )}
              </div>
            ))}
          </div>
        )
      }
      case 6:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Floor plan sketch</h3>
                <p className="mt-2 text-sm text-slate-300">Snap is {floorPlan.snapEnabled === false ? 'off' : 'on'}. You can keep refining this later from the Floor Plan tab.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input checked={floorPlan.snapEnabled !== false} onChange={(event) => updateData((current) => ({ ...current, floorPlan: { ...ensureFloorPlanSettings(current.floorPlan), snapEnabled: event.target.checked } }))} type="checkbox" />
                Snap to grid
              </label>
            </div>
            <FloorPlanCanvas />
          </div>
        )
      case 7:
        return (
          <div className="space-y-5">
            <PhotoUploader accept="image/*,application/pdf" label="Upload receipts (photos or PDFs)" onFilesSelected={(files) => void uploadReceipts(files)} />
            {receiptParsing && (
              <div className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-950/30 px-4 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                <p className="text-sm text-sky-300">{receiptParsing}</p>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.receipts.length ? data.receipts.map((receipt) => {
                const items = getReceiptItems(receipt)
                const total = Number(receipt.receiptTotal || 0)
                const parsed = Boolean(receipt.store || items.length)
                return (
                  <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4" key={String(receipt.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-white">{receipt.store || receipt.fileName || receipt.name || 'Receipt'}</p>
                      {parsed && <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Parsed</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{receipt.purchaseDate || receipt.date || 'No date'}</p>
                    {items.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">{items.length} item{items.length === 1 ? '' : 's'} · {formatCurrency(total)}</p>
                    )}
                    {receipt.dataUrl && (
                      <img alt={receipt.store || 'Receipt'} className="mt-3 max-h-32 rounded-xl border border-[color:var(--border)] object-contain" src={String(receipt.dataUrl)} />
                    )}
                    <div className="mt-3 flex gap-3">
                      <button
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                        onClick={() => setEditingReceipt(receipt)}
                        type="button"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                        onClick={() => {
                          updateData((current) => syncClaimReceipts({ ...current, receipts: current.receipts.filter((r) => String(r.id) !== String(receipt.id)) }))
                          pushToast('Receipt deleted.', 'success')
                        }}
                        type="button"
                      >
                        ✕ Delete
                      </button>
                    </div>
                  </div>
                )
              }) : <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-10 text-center text-sm text-slate-400">No receipts uploaded yet. AI will extract store, date, and line items automatically.</div>}
            </div>
            <ReceiptModal
              onClose={() => setEditingReceipt(null)}
              onSave={(receipt) => {
                updateData((current) => syncClaimReceipts({
                  ...current,
                  receipts: current.receipts.map((r) => String(r.id) === String(receipt.id) ? receipt : r),
                }))
                setEditingReceipt(null)
                pushToast('Receipt updated.', 'success')
              }}
              open={Boolean(editingReceipt)}
              receipt={editingReceipt}
            />
          </div>
        )
      case 8:
        return (
          <div className="space-y-5">
            <h3 className="text-xl font-semibold text-white">Contractor Reports</h3>
            <p className="text-sm text-slate-300">Upload any remediation or contractor reports (ServPro, Paul Davis, etc). AI will automatically extract the contractor name, findings, and costs.</p>
            <PhotoUploader accept="image/*,application/pdf" label="Upload contractor reports (PDF/image)" onFilesSelected={async (files) => {
              for (let i = 0; i < files.length; i++) {
                const { file } = files[i]
                setReportParsing(`Parsing report ${i + 1} of ${files.length}: ${file.name}…`)
                try {
                  const report = await uploadAndAnalyzeContractorReport(file)
                  updateData((c) => ({ ...c, contractorReports: [...(c.contractorReports || []), report] }))
                } catch (err) {
                  console.warn('Report parsing failed', err)
                  pushToast(`Could not parse ${file.name}`, 'error')
                }
              }
              setReportParsing('')
              pushToast(`Processed ${files.length} report(s).`, 'success')
            }} />
            {reportParsing && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                <p className="text-sm text-emerald-300">{reportParsing}</p>
              </div>
            )}
            <div className="space-y-2">
              {(data.contractorReports || []).length ? data.contractorReports.map((r) => {
                const parsed = Boolean(r.companyName || r.trade)
                return (
                  <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3" key={String(r.id || r.name)}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{r.companyName || r.name || 'Report'}</p>
                        {parsed && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Parsed</span>}
                      </div>
                      {(r.trade || r.totalAmount) && (
                        <p className="mt-1 text-xs text-slate-400">{[r.trade, r.totalAmount ? formatCurrency(r.totalAmount) : ''].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <button className="text-xs text-rose-400 hover:text-rose-300" onClick={() => updateData((c) => ({ ...c, contractorReports: c.contractorReports.filter((x) => String(x.id) !== String(r.id)) }))} type="button">✕ Delete</button>
                  </div>
                )
              }) : <p className="text-sm text-slate-500">No reports uploaded yet. You can add these later from the Contractors tab.</p>}
            </div>
            <button className="text-xs text-slate-500 hover:text-slate-300" onClick={nextStep} type="button">Skip — I'll add these later →</button>
          </div>
        )
      case 9:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white">Additional Living Expenses</h3>
            <p className="text-sm text-slate-300">Most homeowners miss $500–$2,000+ in reimbursable expenses. Quick-add common categories below.</p>
            <WeatherCard address={data.dashboard.insuredAddress || data.claim.propertyAddress || ''} dateOfLoss={data.dashboard.dateOfLoss || data.claim.dateOfLoss || ''} utilityDateRanges={utilityRanges} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <button className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-4 text-left text-sky-50" onClick={() => quickAddExpense('Cleanup Labor', 'Initial cleanup labor', 150)} type="button"><span className="block font-medium">Cleanup labor</span><span className="mt-1 block text-xs opacity-70">Your hours at $25-40/hr</span></button>
              <button className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-4 text-left text-amber-50" onClick={() => quickAddExpense('Utilities', 'Utility increase estimate', 35)} type="button"><span className="block font-medium">Utility increase</span><span className="mt-1 block text-xs opacity-70">Heating, electric spikes</span></button>
              <button className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-4 text-left text-rose-50" onClick={() => quickAddExpense('Disposal', 'Disposal / haul-off', 125)} type="button"><span className="block font-medium">Disposal</span><span className="mt-1 block text-xs opacity-70">Dumpster, dump runs</span></button>
              <button className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-4 text-left text-emerald-50" onClick={() => quickAddExpense('Lodging', 'Temporary living expense', 180)} type="button"><span className="block font-medium">Living expense</span><span className="mt-1 block text-xs opacity-70">Hotel, meals, laundry</span></button>
              <button className="rounded-2xl border border-purple-400/25 bg-purple-400/10 px-4 py-4 text-left text-purple-50" onClick={() => quickAddExpense('Other', 'Miscellaneous expense', 50)} type="button"><span className="block font-medium">Other / Misc</span><span className="mt-1 block text-xs opacity-70">Storage, pet care, etc</span></button>
            </div>
            {(() => {
              const total = getExpensesTotal(data.expenses)
              const expenseList = getExpenseEntriesByCategory(data.expenses)
              return (
                <>
                  {total > 0 ? <p className="text-sm font-medium text-emerald-400">Running total: {formatCurrency(total)}</p> : null}
                  {expenseList.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-300">Added Expenses</h4>
                      {expenseList.map((expense) => (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3" key={String(expense.id)}>
                          <div>
                            <p className="text-sm font-medium text-white">{expense.description || expense.category || 'Expense'}</p>
                            <p className="text-xs text-slate-400">{expense.category} · {formatCurrency(Number(expense.amount || expense.totalAmount || 0))}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                              onClick={() => { setEditingExpense(expense); setExpenseModalOpen(true) }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                              onClick={() => updateData((current) => ({ ...current, expenses: removeExpenseEntry(current.expenses, expense) }))}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
            <button className="text-xs text-slate-500 hover:text-slate-300" onClick={nextStep} type="button">Skip — I'll add expenses later →</button>
            <ExpenseModal
              expense={editingExpense}
              onClose={() => { setExpenseModalOpen(false); setEditingExpense(null) }}
              onSave={(expense) => {
                updateData((current) => ({
                  ...current,
                  expenses: upsertExpenseEntry(current.expenses, expense),
                }))
                setExpenseModalOpen(false)
                setEditingExpense(null)
                pushToast('Expense updated.', 'success')
              }}
              open={expenseModalOpen}
            />
          </div>
        )
      case 10:
        return (
          <div className="grid gap-5 lg:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-3xl border border-[color:var(--border)] bg-slate-950/35 p-5">
              <h3 className="text-lg font-semibold text-white">Launch AI analysis</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Send your photo library to AI Builder, then run pre-screen or full analysis from the dedicated tab.
              </p>
              <button className="button-primary mt-5 w-full" onClick={launchAI} type="button">
                Open AI Builder
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Photos ready</p>
                <p className="mt-3 text-2xl font-semibold text-white">{photoEntries.length}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">AI queue</p>
                <p className="mt-3 text-2xl font-semibold text-white">{data.aiPhotos.length}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Receipts</p>
                <p className="mt-3 text-2xl font-semibold text-white">{data.receipts.length}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Expenses</p>
                <p className="mt-3 text-2xl font-semibold text-white">{data.expenses.laborEntries.length + data.expenses.utilityEntries.length + data.expenses.disposalEntries.length + data.expenses.livingEntries.length + data.expenses.miscEntries.length}</p>
              </div>
            </div>
          </div>
        )
      case 11: {
        const itemCount = (data.contents || []).filter((i) => i.includedInClaim !== false).length
        const totalValue = (data.contents || []).reduce((sum, i) => sum + Number(i.replacementCost || 0), 0)
        return (
          <div className="space-y-5">
            <h3 className="text-xl font-semibold text-white">Review your contents inventory</h3>
            {itemCount > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4 text-center">
                    <p className="text-2xl font-semibold text-white">{itemCount}</p>
                    <p className="mt-1 text-xs text-slate-400">Items found</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4 text-center">
                    <p className="text-2xl font-semibold text-white">{formatCurrency(totalValue)}</p>
                    <p className="mt-1 text-xs text-slate-400">Total value</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4 text-center">
                    <p className="text-2xl font-semibold text-white">{(data.contents || []).filter((i) => i.enrichment?.revised || i.enriched).length}</p>
                    <p className="mt-1 text-xs text-slate-400">Enriched</p>
                  </div>
                </div>
                <button className="button-secondary" onClick={() => { closeWizard(); setActiveTab('contents') }} type="button">Review in Contents tab</button>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-8 text-center">
                <p className="text-sm text-slate-400">No items yet. Use AI Builder to scan photos, or add items manually in the Contents tab.</p>
                <button className="button-primary mt-4" onClick={() => { closeWizard(); setActiveTab('ai-builder') }} type="button">Open AI Builder</button>
              </div>
            )}
          </div>
        )
      }
      case 12:
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-5">
              <h3 className="text-xl font-semibold text-white">Workspace ready</h3>
              <p className="mt-2 text-sm leading-7 text-slate-200">
                The core claim scaffolding is in place. Review the checklist below, then continue building your claim.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Claim type set', done: !!data.claimType },
                { label: 'Claim details filled', done: !!(data.dashboard.claimNumber || data.claim.claimNumber) },
                { label: 'Rooms added', done: (data.rooms || []).length > 0 },
                { label: 'Photos uploaded', done: (data.photoLibrary || []).length > 0 || (data.rooms || []).some((r) => (r.photos || []).length > 0) },
                { label: 'AI analysis started', done: (data.aiPhotos || []).length > 0 },
                { label: 'Contents inventory started', done: (data.contents || []).length > 0 },
                { label: 'Expenses tracked', done: getExpensesTotal(data.expenses) > 0 },
              ].map((item) => (
                <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-3" key={item.label}>
                  <span className={item.done ? 'text-emerald-400' : 'text-slate-600'}>{item.done ? '✅' : '○'}</span>
                  <span className={`text-sm ${item.done ? 'text-white' : 'text-slate-400'}`}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button className="button-primary" onClick={() => finish('contents')} type="button">
                Go to Contents
              </button>
              <button className="button-secondary" onClick={() => finish('maximizer')} type="button">
                Go to Maximizer
              </button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Compact header: step dots + title + skip — one line */}
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-[color:var(--border)] px-5 py-3">
        <div className="flex items-center gap-1.5">
          {steps.map((_, index) => {
            const stepNumber = index + 1
            return (
              <button
                key={stepNumber}
                onClick={() => { setWizardStep(stepNumber); contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                className={`h-2.5 rounded-full transition-all ${wizard.step === stepNumber ? 'w-6 bg-sky-400' : stepNumber < wizard.step ? 'w-2.5 bg-sky-400/40' : 'w-2.5 bg-slate-700'}`}
                title={`Step ${stepNumber}: ${steps[index]}`}
                type="button"
              />
            )
          })}
        </div>
        <h2 className="flex-1 text-sm font-semibold text-white">
          <span className="text-slate-500">Step {wizard.step}/{steps.length}</span>{' · '}{steps[wizard.step - 1]}
        </h2>
        <button className="text-xs text-slate-400 hover:text-white" onClick={closeWizard} type="button">
          Skip
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={(el) => { contentRef.current = el }} className="flex-1 overflow-y-auto p-5 sm:p-6">
          {renderStep()}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[color:var(--border)] bg-slate-900/50 px-5 py-3 backdrop-blur-md">
          <button className="button-secondary text-sm" disabled={wizard.step === 1} onClick={previousStep} type="button">
            Back
          </button>
          <div className="flex gap-3">
            <button className="button-secondary text-sm" onClick={closeWizard} type="button">
              Close
            </button>
            {wizard.step < steps.length ? (
              <button className="button-primary text-sm" onClick={nextStep} type="button">
                Next
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
