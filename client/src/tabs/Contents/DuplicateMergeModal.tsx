import { useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { formatCurrency, getItemTotalValue } from '@/lib/claimWorkflow'
import type { DuplicateGroup } from '@/lib/claimWorkflow'
import type { ContentItem as ContentItemType } from '@/types/claim'
import type { AIPhoto } from '@/types/claim'

function getItemPhotoUrl(item: ContentItemType, aiPhotos: AIPhoto[]): string | null {
  const ep = (item.evidencePhotos || [])[0]
  if (!ep?.photoId) return null
  const photo = aiPhotos.find((p) => String(p.id) === String(ep.photoId))
  if (photo?.isStack && photo.stackPhotos?.length) {
    const sp = photo.stackPhotos[0]
    return sp?.thumbUrl || sp?.url || sp?.dataUrl || null
  }
  return photo?.thumbUrl || photo?.url || photo?.dataUrl || null
}

interface DuplicateMergeModalProps {
  open: boolean
  groups: DuplicateGroup[]
  aiPhotos: AIPhoto[]
  onMerge: (keepId: string, removeIds: string[]) => void
  onDismissGroup: (groupIndex: number) => void
  onClose: () => void
}

export function DuplicateMergeModal({ open, groups, aiPhotos, onMerge, onDismissGroup, onClose }: DuplicateMergeModalProps) {
  const [keepSelections, setKeepSelections] = useState<Record<number, string>>({})

  if (!groups.length) return null

  return (
    <Modal
      onClose={onClose}
      open={open}
      title={`${groups.length} possible duplicate${groups.length === 1 ? '' : 's'} found`}
      footer={
        <div className="flex justify-end">
          <button className="button-secondary" onClick={onClose} type="button">Done</button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {groups.map((group, groupIdx) => {
          const keepId = keepSelections[groupIdx] || group.items[0]?.id
          const removeIds = group.items.filter((i) => i.id !== keepId).map((i) => i.id)

          return (
            <div key={groupIdx} className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                {Math.round(group.similarity * 100)}% match — {group.items.length} items
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const photoUrl = getItemPhotoUrl(item, aiPhotos)
                  const isKeep = item.id === keepId
                  return (
                    <button
                      key={item.id}
                      className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                        isKeep ? 'border-sky-400 bg-sky-400/10' : 'border-transparent bg-slate-900/50 hover:border-slate-600'
                      }`}
                      onClick={() => setKeepSelections((prev) => ({ ...prev, [groupIdx]: item.id }))}
                      type="button"
                    >
                      {photoUrl ? (
                        <img src={photoUrl} alt="" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-800 text-lg text-slate-500 flex-shrink-0">
                          {(item.itemName || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{item.itemName || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400">{item.room || 'No room'}</p>
                        <p className="text-sm font-semibold text-white mt-1">{formatCurrency(getItemTotalValue(item))}</p>
                        {isKeep && <p className="text-[10px] font-semibold text-sky-300 mt-1">KEEP THIS ONE</p>}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <button
                  className="button-primary flex-1 py-2 text-xs"
                  onClick={() => onMerge(keepId, removeIds)}
                  type="button"
                >
                  Merge — keep selected, remove {removeIds.length} duplicate{removeIds.length === 1 ? '' : 's'}
                </button>
                <button
                  className="button-secondary py-2 px-3 text-xs"
                  onClick={() => onDismissGroup(groupIdx)}
                  type="button"
                >
                  Not duplicates
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
