import { useMemo, useRef, useState } from 'react'
import { apiClient } from '@/lib/api'
import {
  analysisModeLabel,
  analyzePhotoVisionWithRetry,
  autoImportPhotosToAIBuilder,
  buildClaimSummary,
  createPhotoStack,
  mapPrescreenTypeToAnalysisMode,
  parseStrictAIResult,
  upsertDraftContentFromAI,
} from '@/lib/claimWorkflow'
import { compressImageToDataUrl, dataUrlToBase64 } from '@/lib/utils'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { AIPhoto, AIResultRecord, AnalysisMode } from '@/types/claim'
import { AnalysisProgress } from '@/tabs/AIBuilder/AnalysisProgress'
import { AnalysisResults } from '@/tabs/AIBuilder/AnalysisResults'
import { PhotoDropZone } from '@/tabs/AIBuilder/PhotoDropZone'
import { PhotoStack } from '@/tabs/AIBuilder/PhotoStack'

// createPhotoStack imported from @/lib/claimWorkflow

function pickPhotoPreview(photo: AIPhoto) {
  return String(photo.dataUrl || photo.url || photo.thumbUrl || photo.base64 || '')
}

export function AIBuilder() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [applyModeToAll, setApplyModeToAll] = useState(false)
  const [isRunningBatch, setIsRunningBatch] = useState(false)
  const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null)
  const [processedCount, setProcessedCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const photos = data.aiPhotos || []
  const resultsByPhotoId = useMemo(() => {
    const map = new Map<string, AIResultRecord>()
    ;(data.aiResults || []).forEach((result) => {
      map.set(String(result.photoId || ''), result)
    })
    return map
  }, [data.aiResults])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const targets = useMemo(
    () => photos.filter((photo) => photo.status !== 'complete' || photo.lastAnalyzedMode !== (photo.analysisMode || data.aiAnalysisMode)),
    [data.aiAnalysisMode, photos],
  )
  const completedCount = useMemo(() => photos.filter((photo) => photo.status === 'complete').length, [photos])
  const failedCount = useMemo(() => photos.filter((photo) => photo.status === 'failed').length, [photos])

  async function handleFilesSelected(files: File[]) {
    const nextPhotos = await Promise.all(
      files.map(async (file) => {
        const dataUrl = await compressImageToDataUrl(file)
        return {
          id: crypto.randomUUID(),
          name: file.name,
          filename: file.name,
          type: file.type || 'image/jpeg',
          mimeType: file.type || 'image/jpeg',
          size: file.size,
          dataUrl,
          imageBase64: dataUrlToBase64(dataUrl),
          url: dataUrl,
          uploadedAt: new Date().toISOString(),
          status: 'pending' as const,
          analysisMode: data.aiAnalysisMode,
          roomName: '',
          source: 'upload',
        }
      }),
    )

    updateData((current) => ({
      ...current,
      aiPhotos: [...current.aiPhotos, ...nextPhotos],
      aiNeedsUpdate: true,
    }))
    pushToast(`${nextPhotos.length} photo${nextPhotos.length === 1 ? '' : 's'} added to AI Builder.`, 'success')
  }

  function patchPhotos(transform: (photosToPatch: AIPhoto[]) => AIPhoto[]) {
    updateData((current) => ({
      ...current,
      aiPhotos: transform(current.aiPhotos),
    }))
  }

  function setGlobalMode(mode: AnalysisMode) {
    updateData((current) => ({
      ...current,
      aiAnalysisMode: mode,
      aiNeedsUpdate: true,
      aiPhotos: applyModeToAll
        ? current.aiPhotos.map((photo) => ({
            ...photo,
            analysisMode: mode,
            status: photo.status === 'complete' ? 'pending' : photo.status,
          }))
        : current.aiPhotos,
    }))
  }

  function setPhotoMode(photoId: string, mode: AnalysisMode) {
    patchPhotos((current) => current.map((photo) => (
      String(photo.id) === photoId
        ? { ...photo, analysisMode: mode, status: photo.status === 'complete' ? 'pending' : photo.status }
        : photo
    )))
    updateData((current) => ({ ...current, aiNeedsUpdate: true }))
  }

  function toggleSelect(photoId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...new Set([...current, photoId])] : current.filter((id) => id !== photoId)))
  }

  function createStackFromSelection() {
    const selectedPhotos = photos.filter((photo) => !photo.isStack && selectedSet.has(String(photo.id)))
    if (selectedPhotos.length < 2) {
      pushToast('Select at least two photos to create a stack.', 'warning')
      return
    }
    const stack = createPhotoStack(selectedPhotos, data.aiAnalysisMode)
    updateData((current) => ({
      ...current,
      aiPhotos: [stack, ...current.aiPhotos.filter((photo) => !selectedSet.has(String(photo.id)))],
      aiNeedsUpdate: true,
    }))
    setSelectedIds([])
    pushToast('Photo stack created.', 'success')
  }

  function unstackPhoto(stackId: string) {
    updateData((current) => {
      const nextPhotos: AIPhoto[] = []
      current.aiPhotos.forEach((photo) => {
        if (String(photo.id) !== stackId) {
          nextPhotos.push(photo)
          return
        }
        if (photo.isStack && Array.isArray(photo.stackPhotos)) {
          photo.stackPhotos.forEach((entry) => {
            nextPhotos.push({ ...entry, status: entry.status || 'pending' })
          })
        }
      })
      return { ...current, aiPhotos: nextPhotos, aiNeedsUpdate: true }
    })
    setSelectedIds((current) => current.filter((id) => id !== stackId))
    pushToast('Stack expanded back into individual photos.', 'info')
  }

  async function runPreScreen() {
    if (!photos.length) {
      pushToast('Upload photos before running pre-screen.', 'warning')
      return
    }

    try {
      const response = await apiClient.preScreenPhotos({
        photos: photos.map((photo) => ({
          id: String(photo.id || ''),
          name: photo.name || photo.filename || 'Photo',
          mimeType: photo.mimeType || photo.type || 'image/jpeg',
          imageBase64: photo.imageBase64 || photo.base64 || dataUrlToBase64(String(photo.dataUrl || photo.url || '')),
          type: photo.analysisMode ? analysisModeLabel(photo.analysisMode) : analysisModeLabel(data.aiAnalysisMode),
        })),
      })

      const results = Array.isArray(response.results) ? response.results : []
      const suggestedStacks = Array.isArray(response.suggestedStacks) ? response.suggestedStacks : []

      updateData((current) => {
        let nextPhotos = current.aiPhotos.map((photo) => {
          const match = results.find((result) => String((result as { id?: string }).id || '') === String(photo.id || ''))
          if (!match) return photo
          return {
            ...photo,
            analysisMode: mapPrescreenTypeToAnalysisMode((match as { type?: string }).type),
            status: photo.status === 'complete' ? 'pending' : photo.status,
          }
        })

        const usedIds = new Set<string>()
        suggestedStacks.forEach((stackIds) => {
          const members = nextPhotos.filter((photo) => !photo.isStack && stackIds.includes(String(photo.id || '')))
          if (members.length < 2) return
          members.forEach((photo) => usedIds.add(String(photo.id || '')))
          nextPhotos = [createPhotoStack(members, current.aiAnalysisMode), ...nextPhotos.filter((photo) => !usedIds.has(String(photo.id || '')))]
        })

        return { ...current, aiPhotos: nextPhotos, aiNeedsUpdate: true }
      })
      pushToast('Pre-screen recommendations applied.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Pre-screen failed.', 'error')
    }
  }

  async function analyzeOne(photoId: string) {
    const photo = useClaimStore.getState().data.aiPhotos.find((entry) => String(entry.id) === photoId)
    if (!photo) return

    const controller = new AbortController()
    abortRef.current = controller
    setCurrentPhotoId(photoId)

    updateData((current) => ({
      ...current,
      aiPhotos: current.aiPhotos.map((entry) => (
        String(entry.id) === photoId ? { ...entry, status: 'analyzing', notes: '' } : entry
      )),
    }))

    try {
      const payload = await analyzePhotoVisionWithRetry(useClaimStore.getState().data, photo, { signal: controller.signal, fastMode: true })
      const parsed = parseStrictAIResult(payload)
      updateData((current) => {
        const resultId = crypto.randomUUID()
        const nextResults = [
          ...current.aiResults.filter((result) => String(result.photoId || '') !== photoId),
          {
            id: resultId,
            photoId: photo.id,
            createdAt: new Date().toISOString(),
            ...parsed,
          },
        ]
        const { contents, followUpTasks } = upsertDraftContentFromAI(current, photo, parsed)
        return {
          ...current,
          aiResults: nextResults,
          contents,
          followUpTasks,
          aiNeedsUpdate: false,
          aiPhotos: current.aiPhotos.map((entry) => (
            String(entry.id) === photoId
              ? {
                  ...entry,
                  status: 'complete',
                  aiResultId: resultId,
                  notes: '',
                  errorLabel: null,
                  failedRequestId: null,
                  lastAnalyzedAt: new Date().toISOString(),
                  lastAnalyzedMode: entry.analysisMode || current.aiAnalysisMode,
                }
              : entry
          )),
        }
      })
      pushToast(`Analysis complete for ${photo.name || 'photo'}.`, 'success')
    } catch (error) {
      updateData((current) => ({
        ...current,
        aiPhotos: current.aiPhotos.map((entry) => (
          String(entry.id) === photoId
            ? { ...entry, status: 'failed', notes: error instanceof Error ? error.message : 'Analysis failed.' }
            : entry
        )),
      }))
      pushToast(error instanceof Error ? error.message : 'Analysis failed.', 'error')
    } finally {
      abortRef.current = null
      setCurrentPhotoId(null)
    }
  }

  async function analyzeAll() {
    if (!targets.length) {
      pushToast('No pending or outdated photos need analysis.', 'info')
      return
    }

    setIsRunningBatch(true)
    setProcessedCount(0)
    for (const photo of targets) {
      if (abortRef.current?.signal.aborted) break
      await analyzeOne(String(photo.id || ''))
      setProcessedCount((count) => count + 1)
    }
    setIsRunningBatch(false)
  }

  function stopAnalysis() {
    abortRef.current?.abort()
    abortRef.current = null
    setIsRunningBatch(false)
    setCurrentPhotoId(null)
    pushToast('Analysis canceled.', 'info')
  }

  function addPhotoItemsToContents(photoId: string) {
    const photo = data.aiPhotos.find((entry) => String(entry.id) === photoId)
    const result = resultsByPhotoId.get(photoId)
    if (!photo || !result) return
    updateData((current) => {
      const { contents, followUpTasks } = upsertDraftContentFromAI(current, photo, result)
      return { ...current, contents, followUpTasks }
    })
    setActiveTab('contents')
    window.location.hash = '#contents'
    pushToast('Draft items sent to Contents.', 'success')
  }

  const batchProgress = photos.length ? Math.round((completedCount / photos.length) * 100) : 0

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">AI Builder</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Photo analysis, draft items, and stack review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              Upload damage photos, assign an analysis mode per image, batch-run AI, and review the draft items that flow into Contents.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="button-secondary" onClick={() => updateData((current) => ({ ...current, aiPhotos: autoImportPhotosToAIBuilder(current), aiNeedsUpdate: true }))} type="button">
              Import Photo Library
            </button>
            <button className="button-secondary" onClick={runPreScreen} type="button">
              Pre-Screen Photos
            </button>
            <button className="button-secondary" disabled={selectedIds.length < 2} onClick={createStackFromSelection} type="button">
              Create Stack
            </button>
            <button className="button-primary" disabled={isRunningBatch || !targets.length} onClick={() => void analyzeAll()} type="button">
              Analyze All
            </button>
          </div>
        </div>
      </section>

      {data.aiNeedsUpdate ? (
        <section className="panel border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          AI needs update. One or more photos were added or changed since the last run.
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <PhotoDropZone onFilesSelected={(files) => void handleFilesSelected(files)} />

          <section className="panel px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <select className="field max-w-52" onChange={(event) => setGlobalMode(event.target.value as AnalysisMode)} value={data.aiAnalysisMode}>
                  <option value="ITEM_VIEW">Item View</option>
                  <option value="ROOM_VIEW">Room View</option>
                  <option value="FOCUSED_VIEW">Focused View</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input checked={applyModeToAll} onChange={(event) => setApplyModeToAll(event.target.checked)} type="checkbox" />
                  Apply mode to all current photos
                </label>
              </div>
              <p className="text-sm text-slate-400">
                {photos.length} photo{photos.length === 1 ? '' : 's'} · {completedCount} complete · {failedCount} failed
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {photos.length ? (
                photos.map((photo) => (
                  <div className="space-y-3" key={String(photo.id)}>
                    <PhotoStack
                      expanded={!photo.collapsed}
                      onAnalyze={() => void analyzeOne(String(photo.id || ''))}
                      onDelete={() => {
                        updateData((current) => ({
                          ...current,
                          aiPhotos: current.aiPhotos.filter((entry) => String(entry.id) !== String(photo.id)),
                          aiResults: current.aiResults.filter((result) => String(result.photoId) !== String(photo.id)),
                          aiNeedsUpdate: true,
                        }))
                      }}
                      onModeChange={(mode) => setPhotoMode(String(photo.id || ''), mode)}
                      onRetry={() => void analyzeOne(String(photo.id || ''))}
                      onToggleExpand={() => patchPhotos((current) => current.map((entry) => (
                        String(entry.id) === String(photo.id) ? { ...entry, collapsed: !entry.collapsed } : entry
                      )))}
                      onToggleSelect={(checked) => toggleSelect(String(photo.id || ''), checked)}
                      onUnstack={photo.isStack ? () => unstackPhoto(String(photo.id || '')) : undefined}
                      previewSrc={pickPhotoPreview(photo)}
                      resultCount={(resultsByPhotoId.get(String(photo.id || ''))?.detectedItems || []).length}
                      selected={selectedSet.has(String(photo.id || ''))}
                      stackPhotos={photo.stackPhotos || []}
                      status={photo.status || 'pending'}
                      title={String(photo.name || photo.filename || 'Photo')}
                      roomName={String(photo.roomName || 'Unassigned')}
                      mode={photo.analysisMode || data.aiAnalysisMode}
                      note={photo.notes}
                    />
                    <AnalysisResults
                      items={resultsByPhotoId.get(String(photo.id || ''))?.detectedItems || []}
                      onAddToContents={() => addPhotoItemsToContents(String(photo.id || ''))}
                      sceneSummary={resultsByPhotoId.get(String(photo.id || ''))?.sceneSummary}
                    />
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-8 text-center text-sm text-slate-400">
                  No AI Builder photos yet. Upload images here or import them from Photo Library.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <AnalysisProgress
            currentLabel={photos.find((photo) => String(photo.id) === currentPhotoId)?.name || null}
            onStop={stopAnalysis}
            photoStatuses={photos.map((photo) => ({
              id: String(photo.id || ''),
              label: String(photo.name || photo.filename || 'Photo'),
              status: photo.status || 'pending',
            }))}
            running={isRunningBatch || Boolean(currentPhotoId)}
            value={batchProgress}
          />

          <section className="panel px-5 py-5">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Claim Context</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(buildClaimSummary(data)).map(([key, value]) => (
                <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3" key={key}>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{key}</p>
                  <p className="mt-2 text-sm text-slate-200">{Array.isArray(value) ? value.join(', ') || 'None' : String(value || '—')}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Analysis mode defaults to {analysisModeLabel(data.aiAnalysisMode)}. Category 3 sewage claims force contamination-aware drafting.
            </p>
            {isRunningBatch ? (
              <p className="mt-3 text-sm text-slate-300">
                Processing {processedCount} of {targets.length} queued photo{targets.length === 1 ? '' : 's'}.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
