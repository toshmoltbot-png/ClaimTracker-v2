import { useMemo, useState } from 'react'
import { compressImageToDataUrl, readFileAsDataUrl } from '@/lib/utils'

interface PhotoUploaderProps {
  label?: string
  multiple?: boolean
  accept?: string
  onFilesSelected?: (files: Array<{ file: File; previewUrl: string }>) => void
}

export function PhotoUploader({ label = 'Upload photos', multiple = true, accept = 'image/*', onFilesSelected }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [previews, setPreviews] = useState<{ url: string; isImage: boolean }[]>([])

  const hint = useMemo(() => (multiple ? 'Drag files here or click to browse.' : 'Drag a file here or click to browse.'), [multiple])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const files = Array.from(fileList)
    const next = await Promise.all(
      files.map(async (file) => {
        const isImage = file.type.startsWith('image/')
        let previewUrl = ''
        try {
          previewUrl = isImage ? await compressImageToDataUrl(file) : await readFileAsDataUrl(file)
        } catch {
          previewUrl = '' // Handle failed compress/read silently
        }
        return { file, previewUrl, isImage }
      }),
    )
    setPreviews(next.map((item) => ({ url: item.previewUrl, isImage: item.isImage })))
    // Pass back files exactly as requested
    onFilesSelected?.(next.map((item) => ({ file: item.file, previewUrl: item.previewUrl })))
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
      <input accept={accept} className="hidden" multiple={multiple} onChange={(event) => void handleFiles(event.target.files)} type="file" />
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-400">{hint}</p>
      </div>
      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview, idx) => (
            preview.isImage && preview.url ? (
              <img alt="Upload preview" className="aspect-square rounded-xl object-cover border border-[color:var(--border)]" key={`${preview.url}-${idx}`} src={preview.url} />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-[color:var(--border)] bg-slate-900" key={`doc-${idx}`}>
                <span className="text-xs font-semibold text-slate-400">PDF / Doc</span>
              </div>
            )
          ))}
        </div>
      ) : null}
    </label>
  )
}
