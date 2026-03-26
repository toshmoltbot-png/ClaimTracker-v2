import { useRef, useState } from 'react'
import { formatCurrency, addReceiptItemsToInventory, getReceiptItems, normalizeReceiptPayload, syncClaimReceipts } from '@/lib/claimWorkflow'
import { compressImageToDataUrl, dataUrlToBase64, readFileAsDataUrl } from '@/lib/utils'
import { extractPolicyText } from '@/lib/policyParser'
import { apiClient } from '@/lib/api'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'
import type { Receipt } from '@/types/claim'
import { ReceiptModal } from '@/tabs/Receipts/ReceiptModal'

async function buildReceiptDataUrl(file: File) {
  if (file.type.startsWith('image/')) return compressImageToDataUrl(file)
  return readFileAsDataUrl(file)
}

export function Receipts() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const pushToast = useUIStore((state) => state.pushToast)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [uploading, setUploading] = useState(false)

  const receipts = data.receipts || []
  const receiptTotal = receipts.reduce((sum, receipt) => sum + Number(receipt.receiptTotal || 0), 0)
  const lineItemCount = receipts.reduce((sum, receipt) => sum + getReceiptItems(receipt).length, 0)

  async function handleFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        const text = isPdf ? await extractPolicyText(file) : undefined
        const dataUrl = await buildReceiptDataUrl(file)

        const payload = await apiClient.analyzeReceipt({
          imageBase64: isPdf ? undefined : dataUrlToBase64(dataUrl),
          receiptBase64: isPdf ? undefined : dataUrlToBase64(dataUrl),
          mimeType: file.type || 'application/octet-stream',
          text,
        })
        const receipt = normalizeReceiptPayload(payload, { name: file.name, type: file.type })
        receipt.dataUrl = dataUrl
        receipt.url = dataUrl
        updateData((current) => syncClaimReceipts({ ...current, receipts: [receipt, ...current.receipts] }))
      }
      pushToast('Receipt parsing complete.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Receipt upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Receipts</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Upload, parse, and review purchase receipts</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              {receipts.length} receipt{receipts.length === 1 ? '' : 's'} · {lineItemCount} line item{lineItemCount === 1 ? '' : 's'} · {formatCurrency(receiptTotal)}
            </p>
          </div>
          <button className="button-primary" onClick={() => inputRef.current?.click()} type="button">
            Upload Receipt
          </button>
        </div>
        <input
          accept="image/*,.pdf"
          className="hidden"
          multiple
          onChange={(event) => void handleFiles(Array.from(event.target.files || []))}
          ref={inputRef}
          type="file"
        />
      </section>

      <label
        className="panel flex cursor-pointer flex-col gap-3 border border-dashed border-[color:var(--border)] px-6 py-7"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void handleFiles(Array.from(event.dataTransfer.files || []))
        }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Drop Zone</p>
        <h3 className="text-xl font-semibold text-white">{uploading ? 'Parsing receipts…' : 'Drop receipt images or PDFs here'}</h3>
        <p className="text-sm text-slate-400">Each upload is sent to `/api/analyze-receipt`, then stored in the claim with editable line items.</p>
      </label>

      <section className="panel px-5 py-5">
        <div className="space-y-4">
          {receipts.length ? (
            receipts.map((receipt) => {
              const items = getReceiptItems(receipt)
              return (
                <div className="rounded-3xl border border-[color:var(--border)] bg-slate-950/35 px-5 py-5" key={String(receipt.id)}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{receipt.store || receipt.fileName || 'Receipt'}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {receipt.purchaseDate || receipt.date || 'No date'} · {items.length} line item{items.length === 1 ? '' : 's'} · {formatCurrency(Number(receipt.receiptTotal || 0))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="button-secondary"
                        onClick={() => {
                          updateData((current) => addReceiptItemsToInventory(current, String(receipt.id || '')))
                          pushToast('Receipt items added to inventory.', 'success')
                        }}
                        type="button"
                      >
                        Add to Inventory
                      </button>
                      <button className="button-secondary" onClick={() => setEditingReceipt(receipt)} type="button">
                        Edit
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() => updateData((current) => syncClaimReceipts({ ...current, receipts: current.receipts.filter((entry) => String(entry.id) !== String(receipt.id)) }))}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[0.75fr,1.25fr]">
                    {receipt.dataUrl ? <img alt={receipt.store || 'Receipt'} className="max-h-72 rounded-2xl border border-[color:var(--border)] object-contain" src={String(receipt.dataUrl)} /> : null}
                    <div className="space-y-3">
                      {items.length ? (
                        items.map((item, index) => (
                          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/50 px-4 py-3" key={`${item.name || item.description || 'item'}-${index}`}>
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium text-white">{item.name || item.description || 'Item'}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{item.category || 'other'}</p>
                              </div>
                              <p className="text-sm text-slate-200">{formatCurrency(Number(item.totalPrice || item.unitPrice || 0))}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">No line items extracted yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center text-sm text-slate-400">No receipts uploaded yet.</div>
          )}
        </div>
      </section>

      <ReceiptModal
        onClose={() => setEditingReceipt(null)}
        onSave={(receipt) => {
          updateData((current) => syncClaimReceipts({
            ...current,
            receipts: current.receipts.map((entry) => (String(entry.id) === String(receipt.id) ? receipt : entry)),
          }))
          setEditingReceipt(null)
          pushToast('Receipt updated.', 'success')
        }}
        open={Boolean(editingReceipt)}
        receipt={editingReceipt}
      />
    </div>
  )
}
