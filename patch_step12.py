import os

filepath = '/Users/tosh/clawd/ClaimTracker-v2/client/src/wizard/WizardSteps.tsx'

with open(filepath, 'r') as f:
    content = f.read()

start_marker = '      case 12: {'
end_marker = '      case 13:'

start_idx = content.index(start_marker)
end_idx = content.index(end_marker)

new_case12 = """      case 12: {
        const items = (data.contents || []).filter((i) => i.includedInClaim !== false)
        const itemCount = items.length
        const totalValue = items.reduce((sum, i) => sum + Number(i.replacementCost || 0), 0)
        const roomOptions = data.rooms.map((r) => ({ id: String(r.id), name: r.name || 'Untitled' }))

        // Build photo cards: stacks (grouped) + ungrouped item photos
        const allAiPhotos = data.aiPhotos || []
        const stacks12 = allAiPhotos.filter((p) => p.isStack)
        const singles12 = allAiPhotos.filter((p) => !p.isStack)
        const photoCards: Array<{ id: string; photos: Array<{ src: string; name: string }>; roomName: string }> = []
        stacks12.forEach((stack) => {
          const thumbs = (stack.stackPhotos || []).map((sp) => ({
            src: String(sp.url || sp.thumbUrl || sp.dataUrl || ''),
            name: String(sp.name || sp.filename || 'Photo'),
          }))
          if (thumbs.length > 0) {
            photoCards.push({ id: String(stack.id), photos: thumbs, roomName: stack.roomName || '' })
          }
        })
        singles12.forEach((photo) => {
          const src = String(photo.url || photo.thumbUrl || photo.dataUrl || '')
          if (src) {
            photoCards.push({ id: String(photo.id), photos: [{ src, name: String(photo.name || photo.filename || 'Photo') }], roomName: photo.roomName || '' })
          }
        })

        // Track which photo cards already have a content item
        const claimedPhotoIds = new Set((data.contents || []).map((c) => (c as Record<string, unknown>).sourcePhotoId).filter(Boolean).map(String))
        const unclaimedCards = photoCards.filter((c) => !claimedPhotoIds.has(c.id))

        function addItemFromCard(cardId: string, name: string, room: string, value: string, category: string) {
          if (!name.trim()) { pushToast('Enter an item name.', 'warning'); return }
          const card = photoCards.find((c) => c.id === cardId)
          const newItem = {
            id: crypto.randomUUID(),
            itemName: name.trim(),
            room: room || roomOptions[0]?.name || 'Unknown',
            roomId: roomOptions.find((r) => r.name === room)?.id || roomOptions[0]?.id || null,
            location: room || roomOptions[0]?.name || 'Unknown',
            category: category || 'Other',
            quantity: 1,
            quantityUnit: 'each' as const,
            replacementCost: Number(value) || 0,
            unitPrice: Number(value) || 0,
            contaminated: data.claimType === 'category3_sewage',
            disposition: 'inspected',
            source: 'wizard-photo',
            status: 'draft',
            includedInClaim: true,
            sourcePhotoId: cardId,
            sourcePhotoName: card?.photos[0]?.name || '',
            evidencePhotos: card?.photos.map((p) => ({ photoId: cardId, photoName: p.name })) || [],
          }
          updateData((current) => ({ ...current, contents: [...current.contents, newItem] }))
          pushToast(`"${newItem.itemName}" added.`, 'success')
        }

        function addItem() {
          if (!itemDraft.name.trim()) { pushToast('Enter an item name.', 'warning'); return }
          const newItem = {
            id: crypto.randomUUID(),
            itemName: itemDraft.name.trim(),
            room: itemDraft.room || roomOptions[0]?.name || 'Unknown',
            roomId: roomOptions.find((r) => r.name === itemDraft.room)?.id || roomOptions[0]?.id || null,
            location: itemDraft.room || roomOptions[0]?.name || 'Unknown',
            category: itemDraft.category || 'Other',
            quantity: 1,
            quantityUnit: 'each' as const,
            replacementCost: Number(itemDraft.value) || 0,
            unitPrice: Number(itemDraft.value) || 0,
            contaminated: data.claimType === 'category3_sewage',
            disposition: 'inspected',
            source: 'manual',
            status: 'draft',
            includedInClaim: true,
          }
          updateData((current) => ({ ...current, contents: [...current.contents, newItem] }))
          setItemDraft({ name: '', room: itemDraft.room, value: '', category: '' })
          pushToast(`"${newItem.itemName}" added.`, 'success')
        }

        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-semibold text-white">Name your damaged items</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {unclaimedCards.length > 0
                  ? `We found ${unclaimedCards.length} photo${unclaimedCards.length === 1 ? '' : 's'} of damaged items. Name each one below — you can refine details later in the Contents tab.`
                  : photoCards.length > 0
                    ? 'All photos have been identified! Add more items manually below or continue.'
                    : 'Add each damaged item below. You can always edit details later in the Contents tab.'
                }
              </p>
            </div>

            {/* Photo cards */}
            {unclaimedCards.length > 0 && (
              <div className="space-y-4">
                {unclaimedCards.map((card) => {
                  const defaultRoom = card.roomName || roomOptions[0]?.name || ''
                  return (
                    <PhotoItemCard
                      key={card.id}
                      cardId={card.id}
                      photos={card.photos}
                      defaultRoom={defaultRoom}
                      roomOptions={roomOptions}
                      onAdd={addItemFromCard}
                    />
                  )
                })}
              </div>
            )}

            {/* Items already added */}
            {itemCount > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{itemCount} item{itemCount === 1 ? '' : 's'} added · {formatCurrency(totalValue)}</p>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 rounded-2xl border border-[color:var(--border)] bg-slate-950/30 p-3">
                  {items.map((item) => {
                    const photoId = (item as Record<string, unknown>).sourcePhotoId
                    const card = photoId ? photoCards.find((c) => c.id === String(photoId)) : null
                    return (
                      <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-2.5" key={item.id}>
                        {card && card.photos[0]?.src && (
                          <img src={card.photos[0].src} alt={item.itemName || 'Item'} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{item.itemName || 'Unnamed'}</p>
                          <p className="text-xs text-slate-500">{item.room || 'No room'}{item.category ? ` · ${item.category}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-200">{formatCurrency(Number(item.replacementCost || 0))}</span>
                          <button
                            className="text-xs text-rose-400 hover:text-rose-300"
                            onClick={() => updateData((current) => ({ ...current, contents: current.contents.filter((c) => c.id !== item.id) }))}
                            type="button"
                          >✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Manual add (for items without photos) */}
            <details className="group rounded-2xl border border-[color:var(--border)] bg-slate-950/30">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-slate-300 hover:text-white">
                + Add an item without a photo
              </summary>
              <div className="border-t border-[color:var(--border)] px-5 py-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">Item name *</label>
                    <input
                      className="field mt-1 w-full"
                      placeholder="e.g. Samsung TV, Nike shoes, desk lamp"
                      value={itemDraft.name}
                      onChange={(e) => setItemDraft((d) => ({ ...d, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Room</label>
                    <select className="field mt-1 w-full" value={itemDraft.room} onChange={(e) => setItemDraft((d) => ({ ...d, room: e.target.value }))}>
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
                      value={itemDraft.value}
                      onChange={(e) => setItemDraft((d) => ({ ...d, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Category</label>
                    <select className="field mt-1 w-full" value={itemDraft.category} onChange={(e) => setItemDraft((d) => ({ ...d, category: e.target.value }))}>
                      <option value="">Select category</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Appliances">Appliances</option>
                      <option value="Clothing">Clothing</option>
                      <option value="Sports Equipment">Sports Equipment</option>
                      <option value="Tools">Tools</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Bedding/Linens">Bedding/Linens</option>
                      <option value="Personal Items">Personal Items</option>
                      <option value="Health/Medical">Health/Medical</option>
                      <option value="Toys/Games">Toys/Games</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <button className="button-primary" onClick={addItem} type="button">
                  + Add Item
                </button>
              </div>
            </details>

            {itemCount === 0 && unclaimedCards.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-6 text-center">
                <p className="text-sm text-slate-500">No photos or items yet. Upload photos in an earlier step, or add items manually above.</p>
              </div>
            )}
          </div>
        )
      }
"""

new_content = content[:start_idx] + new_case12 + content[end_idx:]

with open(filepath, 'w') as f:
    f.write(new_content)

print("Done replacing case 12.")
