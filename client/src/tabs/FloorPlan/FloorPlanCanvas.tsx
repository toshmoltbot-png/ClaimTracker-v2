import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
const MIN_ROOM_FT = 2 // minimum dimension in feet

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface EditState {
  roomId: string
  length: string
  width: string
  screenX: number
  screenY: number
}

interface ResizeState {
  roomId: string
  handle: ResizeHandle
  startX: number // pointer start in canvas coords
  startY: number
  origLength: number // original room dimensions in feet
  origWidth: number
  origCenterX: number // original center in canvas px
  origCenterY: number
}

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
}

export function FloorPlanCanvas() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const lengthRef = useRef<HTMLInputElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const floorPlan = ensureFloorPlanSettings(data.floorPlan)
  const scale = useMemo(() => computeFloorPlanScale(CANVAS_WIDTH, CANVAS_HEIGHT, data.rooms), [data.rooms])
  const layouts = useMemo(() => buildFloorPlanRooms(CANVAS_WIDTH, CANVAS_HEIGHT, data.rooms, { ...floorPlan, scale }), [data.rooms, floorPlan, scale])

  const maxZ = useMemo(() => Math.max(0, ...layouts.map((l) => l.zIndex)), [layouts])
  const minZ = useMemo(() => Math.min(0, ...layouts.map((l) => l.zIndex)), [layouts])

  useEffect(() => {
    if (editState && lengthRef.current) {
      lengthRef.current.focus()
      lengthRef.current.select()
    }
  }, [editState?.roomId])

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
  }, [layouts, scale])

  function updateRoom(roomId: string, patch: Record<string, unknown>) {
    updateData((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        String(room.id) === roomId ? { ...room, ...patch } : room,
      ),
    }))
  }

  function handleRotate(roomId: string) {
    const room = data.rooms.find((r) => String(r.id) === roomId)
    if (!room) return
    const current = Number(room.floorPlanRotation) || 0
    const next = (current + 90) % 360
    updateRoom(roomId, { floorPlanRotation: next })
  }

  function handleBringToFront(roomId: string) {
    updateRoom(roomId, { floorPlanZIndex: maxZ + 1 })
  }

  function handleSendToBack(roomId: string) {
    updateRoom(roomId, { floorPlanZIndex: minZ - 1 })
  }

  function handleDoubleClick(roomId: string, event: React.MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
    const room = data.rooms.find((r) => String(r.id) === roomId)
    if (!room) return
    const dims = getRoomDimensions(room)
    setEditState({
      roomId,
      length: dims.length.toFixed(1),
      width: dims.width.toFixed(1),
      screenX: event.clientX,
      screenY: event.clientY,
    })
  }

  const saveEdit = useCallback(() => {
    if (!editState) return
    const newLength = parseFloat(editState.length)
    const newWidth = parseFloat(editState.width)
    if (Number.isFinite(newLength) && newLength > 0 && Number.isFinite(newWidth) && newWidth > 0) {
      updateRoom(editState.roomId, {
        length: newLength,
        width: newWidth,
        sqft: Number((newLength * newWidth).toFixed(1)),
      })
    }
    setEditState(null)
  }, [editState])

  function cancelEdit() {
    setEditState(null)
  }

  function handleEditKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveEdit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit()
    }
  }

  // --- Resize handle logic ---
  function getCanvasCoords(event: React.PointerEvent): { cx: number; cy: number } {
    const stage = stageRef.current?.getBoundingClientRect()
    if (!stage) return { cx: 0, cy: 0 }
    return {
      cx: ((event.clientX - stage.left) / stage.width) * CANVAS_WIDTH,
      cy: ((event.clientY - stage.top) / stage.height) * CANVAS_HEIGHT,
    }
  }

  function handleResizeStart(roomId: string, handle: ResizeHandle, event: React.PointerEvent) {
    event.stopPropagation()
    event.preventDefault()
    const room = data.rooms.find((r) => String(r.id) === roomId)
    const layout = layouts.find((l) => l.roomId === roomId)
    if (!room || !layout) return
    const dims = getRoomDimensions(room)
    const { cx, cy } = getCanvasCoords(event)
    setResizeState({
      roomId,
      handle,
      startX: cx,
      startY: cy,
      origLength: dims.length,
      origWidth: dims.width,
      origCenterX: layout.centerX,
      origCenterY: layout.centerY,
    })
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  function handleResizeMove(event: React.PointerEvent) {
    if (!resizeState) return
    const { cx, cy } = getCanvasCoords(event)
    const dx = cx - resizeState.startX
    const dy = cy - resizeState.startY
    const dxFt = dx / scale
    const dyFt = dy / scale

    let newWidth = resizeState.origWidth
    let newLength = resizeState.origLength
    let newCenterX = resizeState.origCenterX
    let newCenterY = resizeState.origCenterY
    const h = resizeState.handle
    const isCorner = h === 'ne' || h === 'nw' || h === 'se' || h === 'sw'

    if (isCorner) {
      // Corner handles: proportional resize (maintain aspect ratio)
      const aspect = resizeState.origWidth / resizeState.origLength
      // Use the larger drag axis to drive the scale factor
      const rawDelta = Math.abs(dxFt) > Math.abs(dyFt) ? dxFt : dyFt
      // Determine sign: dragging "outward" from center = grow
      let sign = 1
      if (h === 'se') sign = (rawDelta >= 0 ? 1 : -1) * (Math.abs(dxFt) > Math.abs(dyFt) ? 1 : 1)
      if (h === 'sw') sign = Math.abs(dxFt) > Math.abs(dyFt) ? (dxFt <= 0 ? 1 : -1) : (dyFt >= 0 ? 1 : -1)
      if (h === 'ne') sign = Math.abs(dxFt) > Math.abs(dyFt) ? (dxFt >= 0 ? 1 : -1) : (dyFt <= 0 ? 1 : -1)
      if (h === 'nw') sign = Math.abs(dxFt) > Math.abs(dyFt) ? (dxFt <= 0 ? 1 : -1) : (dyFt <= 0 ? 1 : -1)

      const delta = Math.abs(rawDelta) * sign
      newLength = Math.max(MIN_ROOM_FT, resizeState.origLength + delta)
      newWidth = Math.max(MIN_ROOM_FT, newLength * aspect)
      // Recalculate length if width hit minimum
      if (newWidth <= MIN_ROOM_FT) {
        newWidth = MIN_ROOM_FT
        newLength = Math.max(MIN_ROOM_FT, newWidth / aspect)
      }

      // Shift center based on which corner is anchored (opposite corner stays put)
      const dw = (newWidth - resizeState.origWidth) * scale
      const dl = (newLength - resizeState.origLength) * scale
      if (h === 'se') { newCenterX += dw / 2; newCenterY += dl / 2 }
      if (h === 'sw') { newCenterX -= dw / 2; newCenterY += dl / 2 }
      if (h === 'ne') { newCenterX += dw / 2; newCenterY -= dl / 2 }
      if (h === 'nw') { newCenterX -= dw / 2; newCenterY -= dl / 2 }
    } else {
      // Edge handles: stretch in one direction only
      if (h === 'e') {
        newWidth = Math.max(MIN_ROOM_FT, resizeState.origWidth + dxFt)
        newCenterX = resizeState.origCenterX + (newWidth - resizeState.origWidth) * scale / 2
      }
      if (h === 'w') {
        newWidth = Math.max(MIN_ROOM_FT, resizeState.origWidth - dxFt)
        newCenterX = resizeState.origCenterX - (newWidth - resizeState.origWidth) * scale / 2
      }
      if (h === 's') {
        newLength = Math.max(MIN_ROOM_FT, resizeState.origLength + dyFt)
        newCenterY = resizeState.origCenterY + (newLength - resizeState.origLength) * scale / 2
      }
      if (h === 'n') {
        newLength = Math.max(MIN_ROOM_FT, resizeState.origLength - dyFt)
        newCenterY = resizeState.origCenterY - (newLength - resizeState.origLength) * scale / 2
      }
    }

    // Round to 0.1 ft
    newWidth = Math.round(newWidth * 10) / 10
    newLength = Math.round(newLength * 10) / 10

    updateData((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        String(room.id) === resizeState.roomId
          ? {
              ...room,
              width: newWidth,
              length: newLength,
              sqft: Number((newWidth * newLength).toFixed(1)),
              floorPlanX: Number((newCenterX / scale).toFixed(4)),
              floorPlanY: Number((newCenterY / scale).toFixed(4)),
            }
          : room,
      ),
    }))
  }

  function handleResizeEnd() {
    setResizeState(null)
  }

  // --- Room drag logic ---
  function handlePointerDown(roomId: string, event: React.PointerEvent<HTMLDivElement>) {
    if (editState?.roomId === roomId) return
    if (resizeState) return
    const layout = layouts.find((entry) => entry.roomId === roomId)
    if (!layout) return
    const stageRect = event.currentTarget.parentElement?.getBoundingClientRect()
    const roomRect = event.currentTarget.getBoundingClientRect()
    const xRatio = stageRect ? CANVAS_WIDTH / stageRect.width : 1
    const yRatio = stageRect ? CANVAS_HEIGHT / stageRect.height : 1
    setDraggingId(roomId)
    setSelectedId(roomId)
    setDragOffset({
      x: (event.clientX - roomRect.left) * xRatio,
      y: (event.clientY - roomRect.top) * yRatio,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (resizeState) {
      handleResizeMove(event)
      return
    }
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
    if (resizeState) handleResizeEnd()
  }

  function handleStageClick(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === 'CANVAS') {
      setSelectedId(null)
      if (editState) saveEdit()
    }
  }

  function renderResizeHandles(layout: { roomId: string; width: number; height: number }) {
    const size = 8
    const half = size / 2
    const handles: Array<{ handle: ResizeHandle; left: number; top: number }> = [
      { handle: 'nw', left: -half, top: -half },
      { handle: 'n', left: layout.width / 2 - half, top: -half },
      { handle: 'ne', left: layout.width - half, top: -half },
      { handle: 'e', left: layout.width - half, top: layout.height / 2 - half },
      { handle: 'se', left: layout.width - half, top: layout.height - half },
      { handle: 's', left: layout.width / 2 - half, top: layout.height - half },
      { handle: 'sw', left: -half, top: layout.height - half },
      { handle: 'w', left: -half, top: layout.height / 2 - half },
    ]
    return handles.map(({ handle, left, top }) => (
      <div
        key={handle}
        className="absolute z-[150] rounded-full bg-sky-400 border border-sky-200 shadow-md hover:bg-sky-300 transition-colors"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${size}px`,
          height: `${size}px`,
          cursor: HANDLE_CURSORS[handle],
        }}
        onPointerDown={(e) => handleResizeStart(layout.roomId, handle, e)}
      />
    ))
  }

  return (
    <section className="panel relative overflow-hidden px-4 py-4">
      <div
        ref={stageRef}
        className="relative mx-auto h-[560px] w-full max-w-[960px] touch-none overflow-hidden rounded-2xl border border-[color:var(--border)]"
        onPointerDown={handleStageClick}
        onPointerLeave={stopDragging}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
      >
        <canvas className="absolute inset-0 h-full w-full" height={CANVAS_HEIGHT} ref={canvasRef} width={CANVAS_WIDTH} />
        {layouts
          .filter((layout) => layout.visible)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((layout) => {
            const room = data.rooms.find((entry) => String(entry.id) === layout.roomId)
            const dims = room ? getRoomDimensions(room) : { length: 0, width: 0 }
            const isSelected = selectedId === layout.roomId
            const isEditing = editState?.roomId === layout.roomId
            const isResizing = resizeState?.roomId === layout.roomId
            return (
              <div
                className={`absolute select-none rounded-2xl border border-slate-950/80 shadow-[0_18px_40px_rgba(2,6,23,0.45)] transition-shadow ${
                  draggingId === layout.roomId ? 'ring-2 ring-sky-300/70' : ''
                } ${isSelected && !draggingId ? 'ring-2 ring-sky-400/90' : ''}`}
                key={layout.id}
                onDoubleClick={(event) => handleDoubleClick(layout.roomId, event)}
                onPointerDown={(event) => handlePointerDown(layout.roomId, event)}
                style={{
                  left: `${layout.x}px`,
                  top: `${layout.y}px`,
                  width: `${layout.width}px`,
                  height: `${layout.height}px`,
                  backgroundColor: `${layout.color}66`,
                  borderColor: layout.color,
                  zIndex: layout.zIndex + 100,
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

                {/* Resize handles — visible when selected */}
                {(isSelected || isResizing) && !isEditing && renderResizeHandles(layout)}

                {/* Room controls toolbar — vertical, right side (or left if near edge) */}
                {isSelected && !isEditing && !isResizing && (() => {
                  const toolbarW = 36
                  const placeRight = layout.x + layout.width + toolbarW + 8 < CANVAS_WIDTH
                  return (
                    <div
                      className={`absolute top-0 z-50 flex flex-col items-center gap-1 rounded-lg bg-slate-900/95 px-1.5 py-2 shadow-lg backdrop-blur-sm border border-slate-700/60 ${
                        placeRight ? 'left-full ml-1.5' : 'right-full mr-1.5'
                      }`}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        className="rounded p-1 text-sm text-sky-300 hover:bg-sky-500/20 transition-colors leading-none"
                        onClick={() => handleRotate(layout.roomId)}
                        title="Rotate 90°"
                      >
                        ↻
                      </button>
                      <button
                        className="rounded p-1 text-sm text-sky-300 hover:bg-sky-500/20 transition-colors leading-none"
                        onClick={() => handleBringToFront(layout.roomId)}
                        title="Bring to front"
                      >
                        ▲
                      </button>
                      <button
                        className="rounded p-1 text-sm text-sky-300 hover:bg-sky-500/20 transition-colors leading-none"
                        onClick={() => handleSendToBack(layout.roomId)}
                        title="Send to back"
                      >
                        ▼
                      </button>
                    </div>
                  )
                })()}

                {/* Dimension edit popover — visible on double-click */}
                {isEditing && (
                  <div
                    className="absolute -top-[5.5rem] left-1/2 z-[200] flex -translate-x-1/2 flex-col gap-2 rounded-xl bg-slate-900/98 px-4 py-3 shadow-2xl backdrop-blur-sm border border-slate-600/60"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-xs font-semibold text-slate-300 text-center">{layout.label} — Dimensions</div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 w-7">L</label>
                      <input
                        ref={lengthRef}
                        type="number"
                        step="0.1"
                        min="1"
                        value={editState!.length}
                        onChange={(e) => setEditState({ ...editState!, length: e.target.value })}
                        onKeyDown={handleEditKeyDown}
                        className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
                      />
                      <span className="text-xs text-slate-500">ft</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 w-7">W</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={editState!.width}
                        onChange={(e) => setEditState({ ...editState!, width: e.target.value })}
                        onKeyDown={handleEditKeyDown}
                        className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400/50"
                      />
                      <span className="text-xs text-slate-500">ft</span>
                    </div>
                    <div className="flex gap-1.5 justify-end">
                      <button
                        className="rounded-md px-3 py-1 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
                        onClick={saveEdit}
                      >
                        Save
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 text-center">Enter to save · Esc to cancel</div>
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </section>
  )
}
