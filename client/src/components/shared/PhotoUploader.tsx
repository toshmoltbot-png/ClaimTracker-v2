import { useMemo, useState } from 'react'
import { compressImageToDataUrl } from '@/lib/utils'

interface PhotoUploaderProps {
  label?: string
  multiple?: boolean
  onFilesSelected?: (files: Array<{ file: File; previewUrl: string }>) => void
}

export function PhotoUploader({ label = 'Upload photos', multiple = true, onFilesSelected }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [previews, setPreviews] = useState<string[]>([])

  const hint = useMemo(() => (multiple ? 'Drag images here or click to select multiple files.' : 'Drag an image here or click to select a file.'), [multiple])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const files = Array.from(fileList)
    const next = await Promise.all(
      files.map(async (file) => ({
        file,
        previewUrl: await compressImageToDataUrl(file),
      })),
    )
    setPreviews(next.map((item) => item.previewUrl))
    onFilesSelected?.(next)
  }

  return (
    <label
      className={`flex cursor-pointer flex-col gap-4 rounded-2xl border border-dashed px-5 py-6 transition ${
        isDragging ? 'border-sky-400 bg-sky-400/10' : 'border-[color:var(--border)] bg-slate-950/30'
      }`}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        void handleFiles(event.dataTransfer.files)
      }}
    >
      <input className="hidden" multiple={multiple} onChange={(event) => void handleFiles(event.target.files)} type="file" />
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-400">{hint}</p>
      </div>
      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview) => (
            <img alt="Upload preview" className="aspect-square rounded-xl object-cover" key={preview} src={preview} />
          ))}
        </div>
      ) : null}
    </label>
  )
}
