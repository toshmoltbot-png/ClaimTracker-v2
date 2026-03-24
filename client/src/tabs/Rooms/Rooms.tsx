import { useMemo, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { updateRoomDimensions } from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { Room } from '@/types/claim'
import { RoomCard } from '@/tabs/Rooms/RoomCard'
import { RoomModal } from '@/tabs/Rooms/RoomModal'

export function Rooms() {
  const rooms = useClaimStore((state) => state.data.rooms)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null)

  const totalSqft = useMemo(() => rooms.reduce((sum, room) => sum + Number(room.sqft || 0), 0), [rooms])

  return (
    <div className="space-y-6">
      <section className="panel-elevated flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Rooms</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Affected room inventory</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            {rooms.length} room{rooms.length === 1 ? '' : 's'} documented · {totalSqft.toFixed(0)} total sq ft tracked
          </p>
        </div>
        <button
          className="button-primary"
          onClick={() => {
            setEditingRoom(null)
            setIsModalOpen(true)
          }}
          type="button"
        >
          Add Room
        </button>
      </section>

      {rooms.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              onDelete={() => setPendingDelete(room)}
              onEdit={() => {
                setEditingRoom(room)
                setIsModalOpen(true)
              }}
              room={room}
            />
          ))}
        </section>
      ) : (
        <section className="panel px-6 py-12 text-center text-sm text-slate-400">No rooms added yet. Start with the first affected area.</section>
      )}

      <RoomModal
        onClose={() => setIsModalOpen(false)}
        onSave={(room) => {
          updateData((current) => {
            const normalized = updateRoomDimensions(room)
            const index = current.rooms.findIndex((entry) => entry.id === normalized.id)
            const nextRooms = index >= 0 ? [...current.rooms.slice(0, index), normalized, ...current.rooms.slice(index + 1)] : [...current.rooms, normalized]
            return { ...current, rooms: nextRooms }
          })
          pushToast(editingRoom ? 'Room updated.' : 'Room added.', 'success')
        }}
        open={isModalOpen}
        room={editingRoom}
      />

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <button className="button-secondary" onClick={() => setPendingDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              onClick={() => {
                if (!pendingDelete) return
                updateData((current) => ({
                  ...current,
                  rooms: current.rooms.filter((room) => room.id !== pendingDelete.id),
                  contents: current.contents.map((item) =>
                    item.roomId === pendingDelete.id ? { ...item, roomId: null, room: '' } : item,
                  ),
                }))
                pushToast('Room deleted.', 'info')
                setPendingDelete(null)
              }}
              type="button"
            >
              Delete Room
            </button>
          </div>
        }
        onClose={() => setPendingDelete(null)}
        open={Boolean(pendingDelete)}
        title="Delete room"
      >
        <p className="text-sm leading-7 text-slate-300">
          Delete <span className="font-semibold text-white">{pendingDelete?.name || 'this room'}</span>? Items assigned to it will be left unassigned.
        </p>
      </Modal>
    </div>
  )
}
