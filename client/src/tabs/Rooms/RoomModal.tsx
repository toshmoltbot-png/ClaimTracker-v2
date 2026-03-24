import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { PhotoUploader } from '@/components/shared/PhotoUploader'
import { calcRoomSqft, ROOM_NAME_PRESETS, updateRoomDimensions } from '@/lib/claimWorkflow'
import { storeDataUrl } from '@/lib/firebase'
import type { FileItem, Room } from '@/types/claim'

interface RoomModalProps {
  open: boolean
  room: Room | null
  onClose: () => void
  onSave: (room: Room) => void
}

function createDraftRoom(room: Room | null): Room {
  return updateRoomDimensions(
    room || {
      id: crypto.randomUUID(),
      name: '',
      dimensions: '',
      length: '',
      width: '',
      sqft: '',
      notes: '',
      photos: [],
    },
  )
}

export function RoomModal({ open, room, onClose, onSave }: RoomModalProps) {
  const [draft, setDraft] = useState<Room>(createDraftRoom(room))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setDraft(createDraftRoom(room))
  }, [room, open])

  async function handleSave() {
    setIsSaving(true)
    try {
      onSave(updateRoomDimensions(draft))
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" disabled={isSaving} onClick={() => void handleSave()} type="button">
            {isSaving ? 'Saving…' : 'Save Room'}
          </button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={room ? 'Edit Room' : 'Add Room'}
    >
      <div className="space-y-5">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Room preset</span>
          <select className="field" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name || ''}>
            <option value="">Select preset</option>
            {ROOM_NAME_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Room name</span>
          <input className="field" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name || ''} />
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Length (ft)</span>
            <input
              className="field"
              min="0"
              onChange={(event) =>
                setDraft((current) =>
                  updateRoomDimensions({
                    ...current,
                    length: event.target.value,
                    sqft: calcRoomSqft(event.target.value, current.width),
                  }),
                )
              }
              step="0.01"
              type="number"
              value={draft.length || ''}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Width (ft)</span>
            <input
              className="field"
              min="0"
              onChange={(event) =>
                setDraft((current) =>
                  updateRoomDimensions({
                    ...current,
                    width: event.target.value,
                    sqft: calcRoomSqft(current.length, event.target.value),
                  }),
                )
              }
              step="0.01"
              type="number"
              value={draft.width || ''}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Sq ft</span>
            <input className="field" readOnly value={draft.sqft || ''} />
          </label>
        </div>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Notes</span>
          <textarea className="field min-h-28" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} value={draft.notes || ''} />
        </label>
        <PhotoUploader
          label="Room photos"
          onFilesSelected={(files) => {
            void (async () => {
              const storedPhotos = await Promise.all(
                files.map(async (file) => {
                  const stored = await storeDataUrl(file.previewUrl, { filename: file.file.name, folder: 'rooms' })
                  return {
                    ...stored,
                    id: crypto.randomUUID(),
                    name: file.file.name,
                    size: file.file.size,
                    type: file.file.type,
                  } satisfies FileItem
                }),
              )
              setDraft((current) => ({ ...current, photos: [...(current.photos || []), ...storedPhotos] }))
            })()
          }}
        />
        {(draft.photos || []).length ? (
          <div className="grid grid-cols-3 gap-3">
            {(draft.photos || []).map((photo) => (
              <div className="relative" key={String(photo.id || photo.url || photo.path)}>
                <img alt={photo.name || 'Room photo'} className="aspect-square rounded-xl object-cover" src={photo.url || photo.dataUrl || photo.data || ''} />
                <button
                  className="absolute right-2 top-2 rounded-full bg-slate-950/80 px-2 py-1 text-xs font-semibold text-white"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      photos: (current.photos || []).filter((entry) => String(entry.id) !== String(photo.id)),
                    }))
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
