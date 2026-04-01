import { useMemo, useState } from 'react'
import {
  autoImportPhotosToAIBuilder,
  buildClaimSummary,
  createPhotoStack,
} from '@/lib/claimWorkflow'
import { compressImageToDataUrl, dataUrlToBase64 } from '@/lib/utils'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { AIPhoto, AnalysisMode } from '@/types/claim'
import { PhotoDropZone } from '@/tabs/AIBuilder/PhotoDropZone'
import { PhotoStack } from '@/tabs/AIBuilder/PhotoStack'

function pickPhotoPreview(photo: AIPhoto) {
  return String(photo.dataUrl || photo.url || photo.thumbUrl || photo.base64 || '')
}

export function AIBuilder() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const photos = data.aiPhotos || []
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

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
    }))
    pushToast(`${nextPhotos.length} photo${nextPhotos.length === 1 ? '' : 's'} added.`, 'success')
  }

  function patchPhotos(transform: (photosToPatch: AIPhoto[]) => AIPhoto[]) {
    updateData((current) => ({
      ...current,
      aiPhotos: transform(current.aiPhotos),
    }))
  }

  function setPhotoMode(photoId: string, mode: AnalysisMode) {
    patchPhotos((current) => current.map((photo) => (
      String(photo.id) === photoId ? { ...photo, analysisMode: mode } : photo
    )))
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
      return { ...current, aiPhotos: nextPhotos }
    })
    setSelectedIds((current) => current.filter((id) => id !== stackId))
    pushToast('Stack expanded back into individual photos.', 'info')
  }

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Photo Manager</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Photo stacking and organization</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              Upload damage photos, group multiple angles of the same item into stacks, then add item details manually in Contents.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="button-secondary" onClick={() => updateData((current) => ({ ...current, aiPhotos: autoImportPhotosToAIBuilder(current) }))} type="button">
              Import Photo Library
            </button>
            <button className="button-secondary" disabled={selectedIds.length < 2} onClick={createStackFromSelection} type="button">
              Create Stack
            </button>
            <button className="button-primary" onClick={() => { setActiveTab('contents'); window.location.hash = '#contents' }} type="button">
              Add Items in Contents →
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <PhotoDropZone onFilesSelected={(files) => void handleFilesSelected(files)} />

          <section className="panel px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-400">
                {photos.length} photo{photos.length === 1 ? '' : 's'} · {photos.filter(p => p.isStack).length} stack{photos.filter(p => p.isStack).length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {photos.length ? (
                photos.map((photo) => (
                  <div className="space-y-3" key={String(photo.id)}>
                    <PhotoStack
                      expanded={!photo.collapsed}
                      onDelete={() => {
                        updateData((current) => ({
                          ...current,
                          aiPhotos: current.aiPhotos.filter((entry) => String(entry.id) !== String(photo.id)),
                        }))
                      }}
                      onModeChange={(mode) => setPhotoMode(String(photo.id || ''), mode)}
                      onToggleExpand={() => patchPhotos((current) => current.map((entry) => (
                        String(entry.id) === String(photo.id) ? { ...entry, collapsed: !entry.collapsed } : entry
                      )))}
                      onToggleSelect={(checked) => toggleSelect(String(photo.id || ''), checked)}
                      onUnstack={photo.isStack ? () => unstackPhoto(String(photo.id || '')) : undefined}
                      previewSrc={pickPhotoPreview(photo)}
                      resultCount={0}
                      selected={selectedSet.has(String(photo.id || ''))}
                      stackPhotos={photo.stackPhotos || []}
                      status={photo.status || 'pending'}
                      title={String(photo.name || photo.filename || 'Photo')}
                      roomName={String(photo.roomName || 'Unassigned')}
                      mode={photo.analysisMode || data.aiAnalysisMode}
                      note={photo.notes}
                    />
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-8 text-center text-sm text-slate-400">
                  No photos yet. Upload images here or import them from Photo Library.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
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
              Group photos of the same item into stacks, then add item details manually in the Contents tab.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
