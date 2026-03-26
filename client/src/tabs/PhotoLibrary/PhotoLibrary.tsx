import { useMemo, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { buildPhotoLibraryEntries, type PhotoLibraryEntry } from '@/lib/claimWorkflow'
import { storeDataUrl } from '@/lib/firebase'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { FileItem } from '@/types/claim'
import { PhotoGrid } from '@/tabs/PhotoLibrary/PhotoGrid'
import { PhotoUploader } from '@/components/shared/PhotoUploader'

export function PhotoLibrary() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  const [filterRoomId, setFilterRoomId] = useState('all')
  const [previewing, setPreviewing] = useState<PhotoLibraryEntry | null>(null)
  const entries = useMemo(() => buildPhotoLibraryEntries(data), [data])
  const filtered = useMemo(
    () => (filterRoomId === 'all' ? entries : entries.filter((entry) => String(entry.roomId || '') === filterRoomId)),
    [entries, filterRoomId],
  )

  async function handleUpload(files: Array<{ file: File; previewUrl: string }>) {
    const stored = await Promise.all(
      files.map(async ({ file, previewUrl }) => {
        const uploaded = await storeDataUrl(previewUrl, { filename: file.name, folder: 'photo-library' })
        return {
          ...uploaded,
          id: crypto.randomUUID(),
          name: file.name,
          filename: file.name,
          size: file.size,
          type: file.type,
          dataUrl: previewUrl,
        } satisfies FileItem
      }),
    )
    updateData((current) => ({
      ...current,
      photoLibrary: [...stored, ...current.photoLibrary],
    }))
    pushToast(`${stored.length} photo${stored.length === 1 ? '' : 's'} added to Photo Library.`, 'success')
  }

  return (
    <div className="space-y-6">
      <section className="panel-elevated flex flex-col gap-4 px-6 py-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Photo Library</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">All claim photos in one grid</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Browse room photos, library uploads, and AI Builder inputs together. Filter by room, preview full size, and jump into linked AI results.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select className="field min-w-48" onChange={(event) => setFilterRoomId(event.target.value)} value={filterRoomId}>
            <option value="all">All rooms</option>
            {data.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name || 'Room'}
              </option>
            ))}
          </select>
          <button
            className="button-secondary"
            onClick={() => updateData((current) => ({ ...current, aiPhotos: current.aiPhotos.length ? current.aiPhotos : current.photoLibrary.map((photo) => ({ ...photo, status: 'pending', analysisMode: current.aiAnalysisMode, source: 'photo-library' })) }))}
            type="button"
          >
            Send to AI Builder
          </button>
        </div>
      </section>

      <section className="panel p-6">
        <PhotoUploader label="Upload to photo library" onFilesSelected={(files) => void handleUpload(files)} />
      </section>

      <section className="panel px-5 py-5">
        {filtered.length ? (
          <PhotoGrid
            onPreview={setPreviewing}
            onDelete={(photo) => {
              updateData((current) => {
                const photoId = String(photo.photo?.id || photo.id || '')
                if (photo.sourceType === 'library') {
                  return { ...current, photoLibrary: current.photoLibrary.filter((p) => String(p.id) !== photoId) }
                }
                if (photo.sourceType === 'room' && photo.roomId) {
                  return {
                    ...current,
                    rooms: current.rooms.map((room) =>
                      String(room.id) === String(photo.roomId)
                        ? { ...room, photos: (room.photos || []).filter((p) => String(p.id) !== photoId) }
                        : room,
                    ),
                  }
                }
                if (photo.sourceType === 'ai') {
                  return { ...current, aiPhotos: (current.aiPhotos || []).filter((p) => String(p.id) !== photoId) }
                }
                return current
              })
              pushToast('Photo deleted.', 'success')
            }}
            photos={filtered}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-10 text-center text-sm text-slate-400">
            No photos match the current filter.
          </div>
        )}
      </section>

      <Modal
        onClose={() => setPreviewing(null)}
        open={Boolean(previewing)}
        title={previewing?.name || 'Photo preview'}
        footer={
          previewing ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                {previewing.roomName || 'Unassigned'} · {previewing.analysisMode || 'No AI mode'}
              </div>
              <div className="flex gap-3">
                {previewing.aiResultId ? (
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setActiveTab('ai-builder')
                      window.location.hash = '#ai-builder'
                      setPreviewing(null)
                    }}
                    type="button"
                  >
                    Open AI Result
                  </button>
                ) : null}
                <button
                  className="button-secondary text-rose-400 hover:text-rose-300"
                  onClick={() => {
                    const photo = previewing
                    updateData((current) => {
                      const photoId = String(photo.photo?.id || photo.id || '')
                      if (photo.sourceType === 'library') {
                        return { ...current, photoLibrary: current.photoLibrary.filter((p) => String(p.id) !== photoId) }
                      }
                      if (photo.sourceType === 'room' && photo.roomId) {
                        return {
                          ...current,
                          rooms: current.rooms.map((room) =>
                            String(room.id) === String(photo.roomId)
                              ? { ...room, photos: (room.photos || []).filter((p) => String(p.id) !== photoId) }
                              : room,
                          ),
                        }
                      }
                      if (photo.sourceType === 'ai') {
                        return { ...current, aiPhotos: (current.aiPhotos || []).filter((p) => String(p.id) !== photoId) }
                      }
                      return current
                    })
                    pushToast('Photo deleted.', 'success')
                    setPreviewing(null)
                  }}
                  type="button"
                >
                  Delete
                </button>
                <button className="button-primary" onClick={() => setPreviewing(null)} type="button">
                  Close
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {previewing ? (
          <div className="space-y-4">
            <img alt={previewing.name} className="max-h-[60vh] w-full rounded-2xl border border-[color:var(--border)] object-contain" src={previewing.previewUrl} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Metadata</p>
                <p className="mt-2">Filename: {previewing.name}</p>
                <p className="mt-1">Room: {previewing.roomName || 'Unassigned'}</p>
                <p className="mt-1">Source: {previewing.sourceType}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">AI Link</p>
                <p className="mt-2">Mode: {previewing.analysisMode || 'Not assigned'}</p>
                <p className="mt-1">{previewing.aiResultId ? `Detected items: ${previewing.aiItemCount}` : 'No linked analysis result'}</p>
                <p className="mt-1">Uploaded: {previewing.uploadedAt || 'Unknown'}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
