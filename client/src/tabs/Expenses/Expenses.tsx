import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  formatCurrency,
  getExpenseCategoryBreakdown,
  getExpenseEntriesByCategory,
  getExpensesTotal,
  removeExpenseEntry,
  updateExpenseBuffer,
  upsertExpenseEntry,
} from '@/lib/claimWorkflow'
import { fmtUSDate } from '@/lib/dates'
import { useClaimStore } from '@/store/claimStore'
import type { ExpenseEntry } from '@/types/claim'
import { ExpenseModal } from '@/tabs/Expenses/ExpenseModal'
import { UtilityEstimator } from '@/tabs/Expenses/UtilityEstimator'
import { WeatherCard } from '@/tabs/Expenses/WeatherCard'

function ExpenseCard({ entry, onEdit, onDelete }: { entry: ExpenseEntry; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-slate-950/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sky-300">{entry.category || 'Expense'}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{entry.description || entry.vendor || 'Untitled expense'}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {[fmtUSDate(entry.dateStart || entry.date), entry.dateEnd ? `to ${fmtUSDate(entry.dateEnd)}` : '', entry.vendor ? `Vendor: ${entry.vendor}` : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-white">{formatCurrency(Number(entry.amount || 0))}</p>
          <div className="mt-3 flex gap-2">
            <button className="button-secondary" onClick={onEdit} type="button">
              Edit
            </button>
            <button className="button-secondary" onClick={onDelete} type="button">
              Delete
            </button>
          </div>
        </div>
      </div>
      {entry.justification ? (
        <p className="mt-3 text-sm text-slate-300">
          <span className="font-medium text-slate-200">Justification:</span> {entry.justification}
        </p>
      ) : null}
      {(entry.lineItems || []).length ? (
        <div className="mt-4 space-y-2">
          {(entry.lineItems || []).map((line) => (
            <div className="flex items-center justify-between text-sm text-slate-300" key={line.id || `${line.description}-${line.amount}`}>
              <span>{line.description || 'Line item'}</span>
              <span>{formatCurrency(Number(line.amount || 0))}</span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function Expenses() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const entries = useMemo(() => getExpenseEntriesByCategory(data.expenses), [data.expenses])
  const breakdown = useMemo(() => getExpenseCategoryBreakdown(data.expenses), [data.expenses])
  const total = useMemo(() => getExpensesTotal(data.expenses), [data.expenses])
  const bufferAmount = useMemo(() => Number((total * 0.1).toFixed(2)), [total])
  const finalTotal = data.expenses.bufferEnabled ? total + bufferAmount : total

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel-elevated px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Additional Living Expenses</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Expense tracking and ALE support</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Track lodging, food, transportation, utilities, disposal, and related claim expenses in the existing Firestore expense buckets.
              </p>
            </div>
            <button
              className="button-primary"
              onClick={() => {
                setEditingExpense(null)
                setModalOpen(true)
              }}
              type="button"
            >
              Add Expense
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Documented</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(total)}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Buffer</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(data.expenses.bufferEnabled ? bufferAmount : 0)}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total With Buffer</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(finalTotal)}</p>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-slate-950/30 px-4 py-3">
            <input
              checked={Boolean(data.expenses.bufferEnabled)}
              onChange={(event) =>
                updateData((current) => ({
                  ...current,
                  expenses: updateExpenseBuffer(current.expenses, event.target.checked),
                }))
              }
              type="checkbox"
            />
            <span className="text-sm text-slate-200">Apply 10% buffer for price volatility and rounding</span>
          </label>
        </div>

        <div className="panel px-6 py-6">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Category Breakdown</p>
          <div className="mt-4 space-y-3">
            {Object.entries(breakdown).length ? Object.entries(breakdown).sort((a, b) => b[1] - a[1]).map(([label, amount]) => (
              <div className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-slate-950/35 px-4 py-3" key={label}>
                <span className="text-sm text-slate-200">{label}</span>
                <span className="text-sm font-semibold text-white">{formatCurrency(amount)}</span>
              </div>
            )) : <p className="text-sm text-slate-400">No expense categories logged yet.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <WeatherCard
            address={data.dashboard.insuredAddress || data.claim.propertyAddress}
            dateOfLoss={data.dashboard.dateOfLoss || data.claim.dateOfLoss}
            utilityDateRanges={data.expenses.utilityEntries.map((entry) => ({
              start: entry.dateStart,
              end: entry.dateEnd,
              label: `${entry.utilityType || 'Utility'} · ${fmtUSDate(entry.dateStart)} to ${fmtUSDate(entry.dateEnd)}`,
            }))}
          />
          <UtilityEstimator />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Expense Log</h3>
            <p className="text-sm text-slate-400">{entries.length} entry{entries.length === 1 ? '' : 'ies'}</p>
          </div>
          {entries.length ? entries.map((entry) => (
            <ExpenseCard
              entry={entry}
              key={entry.id}
              onDelete={() =>
                updateData((current) => ({
                  ...current,
                  expenses: removeExpenseEntry(current.expenses, entry),
                }))
              }
              onEdit={() => {
                setEditingExpense(entry)
                setModalOpen(true)
              }}
            />
          )) : <EmptyState body="Add the first ALE or supporting expense to start the category breakdown and reimbursement total." title="No Expenses Yet" />}
        </div>
      </section>

      <ExpenseModal
        expense={editingExpense}
        onClose={() => {
          setModalOpen(false)
          setEditingExpense(null)
        }}
        onSave={(expense) => {
          updateData((current) => ({
            ...current,
            expenses: upsertExpenseEntry(current.expenses, expense),
          }))
          setModalOpen(false)
          setEditingExpense(null)
        }}
        open={modalOpen}
      />
    </div>
  )
}
