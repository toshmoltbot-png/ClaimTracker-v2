import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { getContractorFindings, normalizeContractorDraft, uploadAndAnalyzeContractorReport } from '@/lib/claimWorkflow'
import { fmtUSDate } from '@/lib/dates'
import { upsertById } from '@/lib/utils'
import { useClaimStore } from '@/store/claimStore'
import type { Contractor } from '@/types/claim'
import { ContractorModal } from '@/tabs/Contractors/ContractorModal'

export function Contractors() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  const reports = useMemo(() => [...data.contractorReports].sort((left, right) => new Date(right.uploadedAt || 0).getTime() - new Date(left.uploadedAt || 0).getTime()), [data.contractorReports])

  async function handleReportUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const report = await uploadAndAnalyzeContractorReport(file)

      updateData((current) => {
        const contractorName = report.companyName || file.name.replace(/\.[^.]+$/, '')
        const nextContractors = contractorName
          ? upsertById(
              current.contractors,
              normalizeContractorDraft({
                id: crypto.randomUUID(),
                name: contractorName,
                company: contractorName,
                contact: report.contactName || '',
                trade: report.trade || '',
                notes: report.workDescription || '',
              }),
            )
          : current.contractors

        return {
          ...current,
          contractors: nextContractors,
          contractorReports: upsertById(current.contractorReports, report),
          timeline: report.serviceStartDate
            ? upsertById(current.timeline || [], {
                id: crypto.randomUUID(),
                date: report.serviceStartDate,
                title: `${contractorName} visit`,
                event: `${contractorName} visit`,
                description: report.workDescription || '',
                category: 'Repair',
              })
            : current.timeline || [],
        }
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Contractors</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Vendors, contacts, and report findings</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Keep the remediation and repair roster current, then upload contractor reports for structured findings through `/api/analyze-contractor-report`.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="button-secondary cursor-pointer">
              <input className="hidden" onChange={(event) => void handleReportUpload(event)} type="file" />
              {uploading ? 'Uploading…' : 'Upload Report'}
            </label>
            <button
              className="button-primary"
              onClick={() => {
                setEditingContractor(null)
                setModalOpen(true)
              }}
              type="button"
            >
              Add Contractor
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          {data.contractors.length ? data.contractors.map((contractor) => (
            <article className="rounded-2xl border border-[color:var(--border)] bg-slate-950/35 p-5" key={contractor.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{contractor.name || contractor.company || 'Unnamed contractor'}</h3>
                  <p className="mt-2 text-sm text-slate-400">{[contractor.trade, contractor.contact || contractor.contactName, contractor.phone].filter(Boolean).join(' · ')}</p>
                  {contractor.email ? <p className="mt-1 text-sm text-slate-400">{contractor.email}</p> : null}
                </div>
                <div className="flex gap-2">
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setEditingContractor(contractor)
                      setModalOpen(true)
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button-secondary text-rose-400 hover:text-rose-300"
                    onClick={() => updateData((current) => ({
                      ...current,
                      contractors: current.contractors.filter((c) => String(c.id) !== String(contractor.id)),
                    }))}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {contractor.notes ? <p className="mt-4 text-sm leading-7 text-slate-300">{contractor.notes}</p> : null}
            </article>
          )) : <EmptyState body="Add a contractor or upload a contractor report to build the vendor list." title="No Contractors Yet" />}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Report Findings</h3>
          {reports.length ? reports.map((report) => {
            const summary = getContractorFindings(report)
            return (
              <article className="rounded-2xl border border-[color:var(--border)] bg-slate-950/35 p-5" key={String(report.id || report.path || report.name)}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{report.companyName || report.name || 'Uploaded report'}</h4>
                    <p className="mt-2 text-sm text-slate-400">
                      {[fmtUSDate(report.serviceStartDate || report.uploadedAt), report.trade, report.totalAmount ? `${report.totalAmount.toFixed(2)}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {report.url ? (
                      <a className="button-secondary" href={report.url} rel="noreferrer" target="_blank">
                        Open File
                      </a>
                    ) : null}
                    <button
                      className="button-secondary text-rose-400 hover:text-rose-300"
                      onClick={() => updateData((current) => ({
                        ...current,
                        contractorReports: current.contractorReports.filter((r) => String(r.id) !== String(report.id)),
                      }))}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {summary.findings.length ? (
                  <div className="mt-4 space-y-2">
                    {summary.findings.map((finding) => (
                      <div className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-slate-200" key={finding}>
                        {finding}
                      </div>
                    ))}
                  </div>
                ) : null}
                {summary.recommendations.length ? (
                  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Recommendations</p>
                    <p className="mt-2 text-sm leading-7 text-emerald-50">{summary.recommendations.join(' ')}</p>
                  </div>
                ) : null}
              </article>
            )
          }) : <EmptyState body="Uploaded contractor reports will show structured findings here." title="No Reports Yet" />}
        </div>
      </section>

      <ContractorModal
        contractor={editingContractor}
        onClose={() => {
          setModalOpen(false)
          setEditingContractor(null)
        }}
        onSave={(contractor) => {
          updateData((current) => ({
            ...current,
            contractors: upsertById(current.contractors, contractor),
          }))
          setModalOpen(false)
          setEditingContractor(null)
        }}
        open={modalOpen}
      />
    </div>
  )
}
