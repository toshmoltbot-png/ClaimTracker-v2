import type { Room } from '@/types/claim'

interface RoomCardProps {
  room: Room
  onEdit: () => void
  onDelete: () => void
}

export function RoomCard({ room, onEdit, onDelete }: RoomCardProps) {
  return (
    <article className="panel px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{room.name || 'Untitled room'}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {room.length || room.width ? `${room.length || 0} ft x ${room.width || 0} ft` : 'Dimensions not entered'}
          </p>
        </div>
        <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-200">
          {(room.photos || []).length} photo{(room.photos || []).length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Square feet</p>
          <p className="mt-2 text-xl font-semibold text-white">{room.sqft || '0'}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Notes</p>
          <p className="mt-2 line-clamp-3 text-sm text-slate-300">{room.notes || 'No notes yet.'}</p>
        </div>
      </div>
      {(room.photos || []).length ? (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(room.photos || []).slice(0, 4).map((photo) => (
            <img
              alt={photo.name || room.name || 'Room photo'}
              className="aspect-square rounded-xl object-cover"
              key={String(photo.id || photo.url || photo.path)}
              src={photo.url || photo.dataUrl || photo.data || ''}
            />
          ))}
        </div>
      ) : null}
      <div className="mt-5 flex gap-3">
        <button className="button-secondary" onClick={onEdit} type="button">
          Edit
        </button>
        <button className="button-secondary" onClick={onDelete} type="button">
          Delete
        </button>
      </div>
    </article>
  )
}
