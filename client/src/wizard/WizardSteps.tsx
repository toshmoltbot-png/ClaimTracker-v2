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
  upsertExpenseEntry,
  updateRoomDimensions,
} from '@/lib/claimWorkflow'
import { compressImageToDataUrl, readFileAsDataUrl } from '@/lib/utils'
import { storeDataUrl } from '@/lib/firebase'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { AnalysisMode, ExpenseEntry, FileItem, Receipt, Room } from '@/types/claim'
import { FloorPlanCanvas } from '@/tabs/FloorPlan/FloorPlanCanvas'
import { WeatherCard } from '@/tabs/Expenses/WeatherCard'

const steps = [
  'Claim Type',
  'Claim Info',
  'Rooms',
  'Photos',
  'Pre-Screen',
  'Floor Plan',
  'Receipts',
  'Expenses',
  'AI Launch',
  'Completion',
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
  const [tipDismissed, setTipDismissed] = useState(false)
  const [preScreenModes, setPreScreenModes] = useState<Record<string, AnalysisMode>>({})

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
    updateData((current) => ({
      ...current,
      rooms: [...current.rooms, updateRoomDimensions({ ...roomDraft, id: crypto.randomUUID() })],
    }))
    setRoomDraft(buildRoomDraft())
  }

  async function uploadRoomPhotos(files: Array<{ file: File; previewUrl: string }>) {
    if (!photoRoomId) {
      pushToast('Select a room first.', 'warning')
      return
    }
    const room = data.rooms.find((entry) => String(entry.id) === photoRoomId)
    if (!room) return
    const stored = await Promise.all(
      files.map(async ({ file, previewUrl }) => {
        const uploaded = await storeDataUrl(previewUrl, { filename: file.name, folder: 'rooms' })
        return {
          ...uploaded,
          id: crypto.randomUUID(),
          name: file.name,
          filename: file.name,
          size: file.size,
          type: file.type,
          dataUrl: previewUrl,
          roomId: room.id,
        } satisfies FileItem
      }),
    )
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
    const receipts = await Promise.all(
      files.map(async ({ file, previewUrl }) => {
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
        return receipt
      }),
    )
    updateData((current) => syncClaimReceipts({ ...current, receipts: [...receipts, ...current.receipts] }))
    pushToast(`${receipts.length} receipt${receipts.length === 1 ? '' : 's'} added.`, 'success')
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
                  className={`w-full rounded-2xl border px-4 py-4 text-left ${data.claimType === option.value ? 'border-sky-400/50 bg-sky-400/10 text-white' : 'border-[color:var(--border)] bg-slate-950/35 text-slate-300'}`}
                  key={option.value}
                  onClick={() => updateData((current) => ({ ...current, claimType: option.value, claim: { ...current.claim, incidentType: option.value } }))}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )
      case 2:
        return (
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
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-200">Insurer</span>
              <input className="field" onChange={(event) => updateData((current) => ({ ...current, claim: { ...current.claim, insurer: event.target.value }, dashboard: { ...current.dashboard, insurerName: event.target.value } }))} value={data.claim.insurer || data.dashboard.insurerName || ''} />
            </label>
          </div>
        )
      case 3:
        return (
          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <div className="space-y-4 rounded-3xl border border-[color:var(--border)] bg-slate-950/35 p-5">
              <h3 className="text-lg font-semibold text-white">Add a room</h3>
              <input className="field" onChange={(event) => setRoomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Kitchen, Hallway, Basement..." value={roomDraft.name || ''} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="field" min="0" onChange={(event) => setRoomDraft((current) => updateRoomDimensions({ ...current, length: event.target.value }))} placeholder="Length (ft)" type="number" value={roomDraft.length || ''} />
                <input className="field" min="0" onChange={(event) => setRoomDraft((current) => updateRoomDimensions({ ...current, width: event.target.value }))} placeholder="Width (ft)" type="number" value={roomDraft.width || ''} />
              </div>
              <textarea className="field min-h-24" onChange={(event) => setRoomDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" value={roomDraft.notes || ''} />
              <button className="button-primary w-full" onClick={addRoom} type="button">
                Add Room
              </button>
            </div>
            <div className="space-y-3">
              {data.rooms.length ? data.rooms.map((room) => (
                <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4" key={room.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{room.name || 'Room'}</p>
                      <p className="mt-1 text-sm text-slate-400">{room.dimensions || 'No dimensions yet'} · {(room.photos || []).length} photos</p>
                    </div>
                    <button className="button-secondary" onClick={() => updateData((current) => ({ ...current, rooms: current.rooms.filter((entry) => entry.id !== room.id) }))} type="button">
                      Remove
                    </button>
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-10 text-center text-sm text-slate-400">No rooms added yet.</div>}
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <select className="field max-w-72" onChange={(event) => setPhotoRoomId(event.target.value)} value={photoRoomId}>
                <option value="">Select room</option>
                {data.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name || 'Room'}
                  </option>
                ))}
              </select>
            </div>
            <PhotoUploader label="Upload room photos" onFilesSelected={(files) => void uploadRoomPhotos(files)} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.rooms.map((room) => (
                <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4" key={room.id}>
                  <p className="font-semibold text-white">{room.name || 'Room'}</p>
                  <p className="mt-1 text-sm text-slate-400">{(room.photos || []).length} photo{(room.photos || []).length === 1 ? '' : 's'}</p>
                </div>
              ))}
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Quick pre-screen</h3>
                <p className="mt-2 text-sm text-slate-300">Review the photos we found and assign an AI mode before launching AI Builder.</p>
              </div>
              <button className="button-primary" onClick={applyPreScreen} type="button">
                Apply to AI Builder
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photoEntries.length ? photoEntries.map((entry) => {
                const mode = preScreenModes[entry.id] || (entry.roomId ? 'ROOM_VIEW' : 'ITEM_VIEW')
                return (
                  <button
                    className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-slate-950/35 text-left"
                    key={entry.id}
                    onClick={() => setPreScreenModes((current) => ({ ...current, [entry.id]: cycleMode(mode) }))}
                    type="button"
                  >
                    <img alt={entry.name} className="aspect-video w-full object-cover" src={entry.previewUrl} />
                    <div className="space-y-2 px-4 py-4">
                      <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
                      <p className="text-xs text-slate-400">{entry.roomName || 'Unassigned'}</p>
                      <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100">{mode}</span>
                    </div>
                  </button>
                )
              }) : <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-10 text-center text-sm text-slate-400">Upload room photos first.</div>}
            </div>
          </div>
        )
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
            <PhotoUploader label="Upload receipts" onFilesSelected={(files) => void uploadReceipts(files)} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.receipts.length ? data.receipts.map((receipt) => (
                <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4" key={String(receipt.id)}>
                  <p className="truncate font-semibold text-white">{receipt.fileName || receipt.name || 'Receipt'}</p>
                  <p className="mt-1 text-sm text-slate-400">{receipt.purchaseDate || receipt.date || 'No date yet'}</p>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-10 text-center text-sm text-slate-400">No receipts uploaded yet.</div>}
            </div>
          </div>
        )
      case 8:
        return (
          <div className="space-y-6">
            <WeatherCard address={data.dashboard.insuredAddress || data.claim.propertyAddress || ''} dateOfLoss={data.dashboard.dateOfLoss || data.claim.dateOfLoss || ''} utilityDateRanges={utilityRanges} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <button className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-4 text-left text-sky-50" onClick={() => quickAddExpense('Cleanup Labor', 'Initial cleanup labor', 150)} type="button">Cleanup labor</button>
              <button className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-4 text-left text-amber-50" onClick={() => quickAddExpense('Utilities', 'Utility increase estimate', 35)} type="button">Utility increase</button>
              <button className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-4 text-left text-rose-50" onClick={() => quickAddExpense('Disposal', 'Disposal / haul-off', 125)} type="button">Disposal</button>
              <button className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-4 text-left text-emerald-50" onClick={() => quickAddExpense('Lodging', 'Temporary living expense', 180)} type="button">Living expense</button>
            </div>
          </div>
        )
      case 9:
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
      case 10:
        return (
          <div className="space-y-5">
            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-5">
              <h3 className="text-xl font-semibold text-white">Workspace ready</h3>
              <p className="mt-2 text-sm leading-7 text-slate-200">
                The core claim scaffolding is in place. Continue in Contents if you want to work the inventory now, or open Maximizer for strategy guidance.
              </p>
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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

        <div ref={(el) => { contentRef.current = el }} className="flex-1 p-5 sm:p-6">
          {renderStep()}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[color:var(--border)] px-5 py-3">
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
