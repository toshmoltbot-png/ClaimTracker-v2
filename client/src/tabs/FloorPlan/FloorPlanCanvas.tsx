import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildFloorPlanRooms,
  computeFloorPlanScale,
  ensureFloorPlanSettings,
  getRoomDimensions,
  snapFloorPlanPoint,
} from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 560

export function FloorPlanCanvas() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const floorPlan = ensureFloorPlanSettings(data.floorPlan)
  const scale = useMemo(() => floorPlan.scale || computeFloorPlanScale(CANVAS_WIDTH, CANVAS_HEIGHT, data.rooms), [data.rooms, floorPlan.scale])
  const layouts = useMemo(() => buildFloorPlanRooms(CANVAS_WIDTH, CANVAS_HEIGHT, data.rooms, { ...floorPlan, scale }), [data.rooms, floorPlan, scale])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(15,23,42,0.78)'
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.strokeStyle = 'rgba(148,163,184,0.12)'
    context.lineWidth = 1
    for (let x = 0; x <= canvas.width; x += Math.max(8, scale)) {
      context.beginPath()
      context.moveTo(x + 0.5, 0)
      context.lineTo(x + 0.5, canvas.height)
      context.stroke()
    }
    for (let y = 0; y <= canvas.height; y += Math.max(8, scale)) {
      context.beginPath()
      context.moveTo(0, y + 0.5)
      context.lineTo(canvas.width, y + 0.5)
      context.stroke()
    }

    // Connection lines removed — they added visual noise without meaning
  }, [floorPlan.showConnections, layouts, scale])

  function handlePointerDown(roomId: string, event: React.PointerEvent<HTMLDivElement>) {
    const layout = layouts.find((entry) => entry.roomId === roomId)
    if (!layout) return
    const stageRect = event.currentTarget.parentElement?.getBoundingClientRect()
    const roomRect = event.currentTarget.getBoundingClientRect()
    const xRatio = stageRect ? CANVAS_WIDTH / stageRect.width : 1
    const yRatio = stageRect ? CANVAS_HEIGHT / stageRect.height : 1
    setDraggingId(roomId)
    setDragOffset({
      x: (event.clientX - roomRect.left) * xRatio,
      y: (event.clientY - roomRect.top) * yRatio,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingId) return
    const stage = event.currentTarget.getBoundingClientRect()
    const layout = layouts.find((entry) => entry.roomId === draggingId)
    if (!layout) return
    const xRatio = CANVAS_WIDTH / stage.width
    const yRatio = CANVAS_HEIGHT / stage.height
    const rawX = ((event.clientX - stage.left) * xRatio) - dragOffset.x
    const rawY = ((event.clientY - stage.top) * yRatio) - dragOffset.y
    const snapped = snapFloorPlanPoint(rawX, rawY, scale, floorPlan.snapEnabled !== false)
    const nextX = Math.min(Math.max(0, snapped.x), CANVAS_WIDTH - layout.width)
    const nextY = Math.min(Math.max(0, snapped.y), CANVAS_HEIGHT - layout.height)
    updateData((current) => ({
      ...current,
      floorPlan: { ...ensureFloorPlanSettings(current.floorPlan), scale },
      rooms: current.rooms.map((room) => (
        String(room.id) === draggingId
          ? {
              ...room,
              floorPlanX: Number(((nextX + layout.width / 2) / scale).toFixed(4)),
              floorPlanY: Number(((nextY + layout.height / 2) / scale).toFixed(4)),
            }
          : room
      )),
    }))
  }

  function stopDragging() {
    setDraggingId(null)
  }

  return (
    <section className="panel relative overflow-hidden px-4 py-4">
      <div
        className="relative mx-auto h-[560px] w-full max-w-[960px] touch-none overflow-hidden rounded-2xl border border-[color:var(--border)]"
        onPointerLeave={stopDragging}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
      >
        <canvas className="absolute inset-0 h-full w-full" height={CANVAS_HEIGHT} ref={canvasRef} width={CANVAS_WIDTH} />
        {layouts.map((layout) => {
          if (!layout.visible) return null
          const room = data.rooms.find((entry) => String(entry.id) === layout.roomId)
          const dims = room ? getRoomDimensions(room) : { length: 0, width: 0 }
          return (
            <div
              className={`absolute select-none rounded-2xl border border-slate-950/80 shadow-[0_18px_40px_rgba(2,6,23,0.45)] ${draggingId === layout.roomId ? 'ring-2 ring-sky-300/70' : ''}`}
              key={layout.id}
              onPointerDown={(event) => handlePointerDown(layout.roomId, event)}
              style={{
                left: `${layout.x}px`,
                top: `${layout.y}px`,
                width: `${layout.width}px`,
                height: `${layout.height}px`,
                backgroundColor: `${layout.color}66`,
                borderColor: layout.color,
              }}
            >
              <div className="flex h-full flex-col justify-between p-3">
                {floorPlan.showLabels !== false ? <div className="text-sm font-semibold text-white">{layout.label}</div> : <span />}
                {floorPlan.showDimensions !== false ? (
                  <div className="text-xs text-slate-100">
                    {dims.length.toFixed(1)} x {dims.width.toFixed(1)} ft
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
