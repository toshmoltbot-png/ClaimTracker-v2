import { Modal } from '@/components/shared/Modal'
import { useUIStore } from '@/store/uiStore'

export function PrePrintModal() {
  const isOpen = useUIStore((state) => state.modals.prePrint === true)
  const closeModal = useUIStore((state) => state.closeModal)

  return (
    <Modal onClose={() => closeModal('prePrint')} open={isOpen} title="Pre-print review">
      <p className="text-sm text-slate-300">PDF quality controls will land here in the reporting phase.</p>
    </Modal>
  )
}
