import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatCurrency, getPaymentsTotal } from '@/lib/claimWorkflow'
import { fmtUSDate } from '@/lib/dates'
import { upsertById } from '@/lib/utils'
import { useClaimStore } from '@/store/claimStore'
import type { Payment } from '@/types/claim'
import { PaymentModal } from '@/tabs/Payments/PaymentModal'

export function Payments() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const payments = useMemo(() => [...data.payments].sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime()), [data.payments])
  const totalPaid = useMemo(() => getPaymentsTotal(data.payments), [data.payments])

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Payments</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Insurance payment tracking</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Record every advance, partial, final, and supplement payment to keep underpayment gaps visible.
            </p>
          </div>
          <button
            className="button-primary"
            onClick={() => {
              setEditingPayment(null)
              setModalOpen(true)
            }}
            type="button"
          >
            Add Payment
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Received</p>
          <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalPaid)}</p>
        </div>
      </section>

      <section className="space-y-4">
        {payments.length ? payments.map((payment) => (
          <article className="rounded-2xl border border-[color:var(--border)] bg-slate-950/35 p-5" key={payment.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sky-300">{payment.type || 'payment'}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{formatCurrency(Number(payment.amount || 0))}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {fmtUSDate(payment.date)} · {payment.payer || payment.from || 'Insurance'}
                </p>
                {payment.notes || payment.description ? <p className="mt-3 text-sm leading-7 text-slate-300">{payment.notes || payment.description}</p> : null}
              </div>
              <button
                className="button-secondary"
                onClick={() => {
                  setEditingPayment(payment)
                  setModalOpen(true)
                }}
                type="button"
              >
                Edit
              </button>
            </div>
          </article>
        )) : <EmptyState body="Log the first carrier payment to start the running total." title="No Payments Yet" />}
      </section>

      <PaymentModal
        onClose={() => {
          setModalOpen(false)
          setEditingPayment(null)
        }}
        onSave={(payment) => {
          updateData((current) => ({
            ...current,
            payments: upsertById(current.payments, payment),
          }))
          setModalOpen(false)
          setEditingPayment(null)
        }}
        open={modalOpen}
        payment={editingPayment}
      />
    </div>
  )
}
