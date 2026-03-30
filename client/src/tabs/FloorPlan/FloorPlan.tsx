import { useMemo } from 'react'
import {
  buildFloorPlanRooms,
  computeFloorPlanScale,
  computeFloorPlanUnionSqft,
  ensureFloorPlanSettings,
  toggleFloorPlanSnap,
  updateFloorPlanVisibility,
} from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { FloorPlanCanvas } from '@/tabs/FloorPlan/FloorPlanCanvas'

export function FloorPlan() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const floorPlan = ensureFloorPlanSettings(data.floorPlan)
  const scale = useMemo(() => floorPlan.scale || computeFloorPlanScale(960, 560, data.rooms), [data.rooms, floorPlan.scale])
  const layouts = useMemo(() => buildFloorPlanRooms(960, 560, data.rooms, { ...floorPlan, scale }), [data.rooms, floorPlan, scale])

  const unionSqft = useMemo(() => {
    return computeFloorPlanUnionSqft(layouts, scale)
  }, [layouts, scale])

  if (!data.rooms.length) {
    return (
      <section className="panel px-6 py-12 text-center text-sm text-slate-400">
        Add at least one room in the Rooms tab to unlock the floor plan.
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="panel-elevated flex flex-col gap-4 px-6 py-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Floor Plan</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Spatial claim layout</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
            Drag rooms into place, keep the layout snapped to the grid when useful, and track the union square footage of the affected footprint.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
            <input
              checked={floorPlan.snapEnabled ?? true}
              onChange={(event) => updateData((current) => toggleFloorPlanSnap(current, event.target.checked))}
              type="checkbox"
            />
            Snap to grid
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
            <input
              checked={floorPlan.showConnections ?? true}
              onChange={(event) => updateData((current) => ({ ...current, floorPlan: { ...ensureFloorPlanSettings(current.floorPlan), showConnections: event.target.checked } }))}
              type="checkbox"
            />
            Connection lines
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
            <input
              checked={floorPlan.showLabels ?? true}
              onChange={(event) => updateData((current) => ({ ...current, floorPlan: { ...ensureFloorPlanSettings(current.floorPlan), showLabels: event.target.checked } }))}
              type="checkbox"
            />
            Room labels
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
            <input
              checked={floorPlan.showDimensions ?? true}
              onChange={(event) => updateData((current) => ({ ...current, floorPlan: { ...ensureFloorPlanSettings(current.floorPlan), showDimensions: event.target.checked } }))}
              type="checkbox"
            />
            Dimension labels
          </label>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr,320px]">
        <FloorPlanCanvas />

        <section className="panel px-5 py-5">
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Scale</p>
            <p className="mt-2 text-lg font-semibold text-white">1 square = 1 ft ({scale}px)</p>
            <p className="mt-2 text-sm text-slate-300">Union affected area: {unionSqft ? `${unionSqft} sq ft` : 'Position rooms to calculate.'}</p>
          </div>

          <div className="mt-5 space-y-3">
            {data.rooms.map((room) => (
              <label className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-slate-950/45 px-4 py-3" key={room.id}>
                <div>
                  <p className="text-sm font-semibold text-white">{room.name || 'Room'}</p>
                  <p className="mt-1 text-xs text-slate-400">{room.dimensions || `${room.length || 0} x ${room.width || 0}`}</p>
                </div>
                <input
                  checked={room.floorPlanVisible !== false}
                  onChange={(event) => updateData((current) => updateFloorPlanVisibility(current, room.id, event.target.checked))}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
