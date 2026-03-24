import { useState } from 'react'

interface PhotoDropZoneProps {
  onFilesSelected: (files: File[]) => void
}

export function PhotoDropZone({ onFilesSelected }: PhotoDropZoneProps) {
  const [dragging, setDragging] = useState(false)

  function handleFileList(fileList: FileList | null) {
    if (!fileList) return
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    onFilesSelected(files)
  }

  return (
    <label
      className={`panel flex cursor-pointer flex-col gap-4 border border-dashed px-6 py-7 transition ${
        dragging ? 'border-sky-300 bg-sky-400/10' : 'border-[color:var(--border)] bg-slate-950/30'
      }`}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        handleFileList(event.dataTransfer.files)
      }}
    >
      <input className="hidden" multiple onChange={(event) => handleFileList(event.target.files)} type="file" />
      <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Upload Photos</p>
      <div>
        <h3 className="text-xl font-semibold text-white">Drop room or item photos here</h3>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
          Supports drag-and-drop or click-to-upload. Images are compressed before they are sent to the AI pipeline.
        </p>
      </div>
    </label>
  )
}
