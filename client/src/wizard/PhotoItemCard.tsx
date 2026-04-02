import { useState } from 'react'

interface PhotoItemCardProps {
  cardId: string
  photos: Array<{ src: string; name: string }>
  defaultRoom: string
  roomOptions: Array<{ id: string; name: string }>
  onAdd: (cardId: string, name: string, room: string, value: string, category: string) => void
}

const CATEGORIES = [
  'Electronics', 'Furniture', 'Appliances', 'Clothing', 'Sports Equipment',
  'Tools', 'Kitchen', 'Bedding/Linens', 'Personal Items', 'Health/Medical',
  'Toys/Games', 'Other',
]

export function PhotoItemCard({ cardId, photos, defaultRoom, roomOptions, onAdd }: PhotoItemCardProps) {
  const [name, setName] = useState('')
  const [room, setRoom] = useState(defaultRoom)
  const [value, setValue] = useState('')
  const [category, setCategory] = useState('')
  const [added, setAdded] = useState(false)

  function handleAdd() {
    onAdd(cardId, name, room, value, category)
    setAdded(true)
  }

  if (added) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-950/20 px-5 py-4">
        {photos[0]?.src && (
          <img src={photos[0].src} alt={name || 'Item'} className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-300">✓ {name || 'Item'} added</p>
          <p className="text-xs text-slate-400">{room}{category ? ` · ${category}` : ''}</p>
        </div>
        <button
          className="text-xs text-slate-500 hover:text-slate-300"
          onClick={() => setAdded(false)}
          type="button"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-slate-950/30 p-4">
      <div className="flex gap-4">
        {/* Photo thumbnail(s) */}
        <div className="flex-shrink-0">
          {photos.length === 1 ? (
            <img
              src={photos[0].src}
              alt={photos[0].name}
              className="h-28 w-28 rounded-xl object-cover sm:h-36 sm:w-36"
            />
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {photos.slice(0, 4).map((p, i) => (
                <img
                  key={i}
                  src={p.src}
                  alt={p.name}
                  className="h-14 w-14 rounded-lg object-cover sm:h-[70px] sm:w-[70px]"
                />
              ))}
              {photos.length > 4 && (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-400 sm:h-[70px] sm:w-[70px]">
                  +{photos.length - 4}
                </div>
              )}
            </div>
          )}
          {photos.length > 1 && (
            <p className="mt-1 text-center text-[10px] text-slate-500">{photos.length} photos grouped</p>
          )}
        </div>

        {/* Form fields */}
        <div className="flex-1 space-y-3">
          <div>
            <label className="text-xs text-slate-400">What is this item? *</label>
            <input
              className="field mt-1 w-full"
              placeholder="e.g. Samsung 55&quot; TV, leather couch, KitchenAid mixer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleAdd() }}
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-slate-400">Room</label>
              <select className="field mt-1 w-full" value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="">Select room</option>
                {roomOptions.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Estimated value ($)</label>
              <input
                className="field mt-1 w-full"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleAdd() }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Category</label>
              <select className="field mt-1 w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button
            className="button-primary text-sm"
            onClick={handleAdd}
            disabled={!name.trim()}
            type="button"
          >
            ✓ Add to Claim
          </button>
        </div>
      </div>
    </div>
  )
}
