import { useRef, useState } from 'react'
import { computePolicyDocInsights, classifyPolicyDoc, getPolicyDocTypeLabel } from '@/lib/claimWorkflow'
import { uploadFile } from '@/lib/firebase'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { PolicyDoc } from '@/types/claim'

export function PolicyDocUploader() {
  const policyDocs = useClaimStore((state) => state.data.policyDocs)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setIsUploading(true)
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const stored = await uploadFile(file, 'policy-docs')
          const docType = classifyPolicyDoc(file.name)
          return {
            ...stored,
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            size: file.size,
            docType,
            documentType: docType,
            uploadedAt: new Date().toISOString(),
          } satisfies PolicyDoc
        }),
      )

      updateData((current) => {
        const nextDocs = [...current.policyDocs, ...uploaded]
        return {
          ...current,
          policyDocs: nextDocs,
          policyInsights: { ...current.policyInsights, ...computePolicyDocInsights(nextDocs) },
          onboarding: {
            ...current.onboarding,
            wizardPolicyUploaded: nextDocs.length > 0,
            wizardPolicyFilename: uploaded[0]?.name || current.onboarding.wizardPolicyFilename,
          },
        }
      })
      pushToast('Policy documents uploaded.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Policy document upload failed.', 'error')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="panel px-6 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Policy Documents</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Declarations, policy forms, endorsements</h3>
          <p className="mt-2 text-sm leading-7 text-slate-400">Upload PDF or image files. New uploads are auto-classified and saved to Firebase Storage.</p>
        </div>
        <button className="button-primary" onClick={() => inputRef.current?.click()} type="button">
          {isUploading ? 'Uploading…' : 'Upload Documents'}
        </button>
      </div>

      <input
        accept="application/pdf,image/*"
        className="hidden"
        multiple
        onChange={(event) => void handleFiles(event.target.files)}
        ref={inputRef}
        type="file"
      />

      <div className="mt-5 space-y-3">
        {policyDocs.length ? (
          policyDocs.map((doc) => (
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-4" key={String(doc.id || doc.path || doc.name)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{doc.name || 'Untitled document'}</p>
                  <p className="mt-1 text-sm text-slate-400">{getPolicyDocTypeLabel(doc.docType || doc.documentType)}</p>
                </div>
                <div className="flex gap-2">
                  {doc.url ? (
                    <button className="button-secondary" onClick={() => window.open(doc.url || '', '_blank', 'noopener,noreferrer')} type="button">
                      View
                    </button>
                  ) : null}
                  <button
                    className="button-secondary"
                    onClick={() => {
                      updateData((current) => {
                        const nextDocs = current.policyDocs.filter((entry) => String(entry.id) !== String(doc.id))
                        return {
                          ...current,
                          policyDocs: nextDocs,
                          policyInsights: { ...current.policyInsights, ...computePolicyDocInsights(nextDocs) },
                        }
                      })
                      pushToast('Policy document removed.', 'info')
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-8 text-center text-sm text-slate-400">
            No policy documents uploaded yet.
          </div>
        )}
      </div>
    </section>
  )
}
