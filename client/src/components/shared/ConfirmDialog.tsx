import { Modal } from '@/components/shared/Modal'
import { useUIStore } from '@/store/uiStore'

export function ConfirmDialog() {
  const isOpen = useUIStore((state) => state.modals.confirm === true)
  const closeModal = useUIStore((state) => state.closeModal)

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <button className="button-secondary" onClick={() => closeModal('confirm')} type="button">
            Cancel
          </button>
          <button className="button-primary" onClick={() => closeModal('confirm')} type="button">
            Confirm
          </button>
        </div>
      }
      onClose={() => closeModal('confirm')}
      open={isOpen}
      title="Confirm action"
    >
      <p className="text-sm leading-7 text-slate-300">
        Destructive actions will plug into this shared dialog in later phases. The overflow cleanup and escape-key
        behavior are already centralized in the modal primitive.
      </p>
    </Modal>
  )
}
