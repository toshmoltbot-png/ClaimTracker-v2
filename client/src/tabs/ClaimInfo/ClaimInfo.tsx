import { useEffect } from 'react'
import { CLAIM_TYPE_OPTIONS, populateDashboardFields } from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { PolicyDocUploader } from '@/tabs/ClaimInfo/PolicyDocUploader'

type FieldKey =
  | 'claimNumber'
  | 'policyNumber'
  | 'dateOfLoss'
  | 'insuredName'
  | 'insuredAddress'
  | 'insurerName'
  | 'adjusterName'
  | 'adjusterEmail'

const claimFieldMap: Partial<Record<FieldKey, 'claimNumber' | 'policyNumber' | 'dateOfLoss' | 'propertyAddress' | 'insurer'>> = {
  claimNumber: 'claimNumber',
  policyNumber: 'policyNumber',
  dateOfLoss: 'dateOfLoss',
  insuredAddress: 'propertyAddress',
  insurerName: 'insurer',
}

export function ClaimInfo() {
  const data = useClaimStore((state) => state.data)
  const updateData = useClaimStore((state) => state.updateData)

  useEffect(() => {
    updateData((current) => populateDashboardFields(current))
  }, [updateData])

  function updateField(field: FieldKey, value: string) {
    updateData((current) => {
      const next = {
        ...current,
        dashboard: {
          ...current.dashboard,
          [field]: value,
        },
      }

      const mappedClaimField = claimFieldMap[field]
      if (mappedClaimField) {
        next.claim = {
          ...current.claim,
          [mappedClaimField]: value,
        }
      }
      return populateDashboardFields(next)
    })
  }

  return (
    <div className="space-y-6">
      <section className="panel-elevated px-6 py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Claim Info</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Carrier, insured, and adjuster details</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">Every field auto-saves through the shared claim store. These values also feed the dashboard summary and downstream reporting.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Claim number</span>
            <input className="field" onChange={(event) => updateField('claimNumber', event.target.value)} value={data.dashboard.claimNumber} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Policy number</span>
            <input className="field" onChange={(event) => updateField('policyNumber', event.target.value)} value={data.dashboard.policyNumber} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Date of loss</span>
            <input className="field" onChange={(event) => updateField('dateOfLoss', event.target.value)} type="date" value={data.dashboard.dateOfLoss} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Claim type</span>
            <select
              className="field"
              onChange={(event) =>
                updateData((current) => populateDashboardFields({ ...current, claimType: event.target.value, claim: { ...current.claim, incidentType: event.target.value } }))
              }
              value={data.claimType}
            >
              {CLAIM_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Insured name</span>
            <input className="field" onChange={(event) => updateField('insuredName', event.target.value)} value={data.dashboard.insuredName} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-200">Property address</span>
            <input className="field" onChange={(event) => updateField('insuredAddress', event.target.value)} value={data.dashboard.insuredAddress} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Insurance company</span>
            <input className="field" onChange={(event) => updateField('insurerName', event.target.value)} value={data.dashboard.insurerName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Adjuster name</span>
            <input className="field" onChange={(event) => updateField('adjusterName', event.target.value)} value={data.dashboard.adjusterName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Adjuster email</span>
            <input className="field" type="email" onChange={(event) => updateField('adjusterEmail', event.target.value)} value={data.dashboard.adjusterEmail} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Adjuster phone</span>
            <input className="field" type="tel" onChange={(event) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, adjusterPhone: event.target.value } }))} value={data.dashboard.adjusterPhone || ''} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Date reported</span>
            <input className="field" type="date" onChange={(event) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, dateReported: event.target.value } }))} value={data.dashboard.dateReported || ''} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Deductible</span>
            <input className="field" onChange={(event) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, deductible: event.target.value } }))} placeholder="$1,000" value={data.dashboard.deductible || ''} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Coverage type</span>
            <select className="field" onChange={(event) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, coverageType: event.target.value } }))} value={data.dashboard.coverageType || ''}>
              <option value="">Select...</option>
              <option value="HO-3">HO-3 (Special Form)</option>
              <option value="HO-5">HO-5 (Comprehensive)</option>
              <option value="HO-4">HO-4 (Renters)</option>
              <option value="HO-6">HO-6 (Condo)</option>
              <option value="DP-3">DP-3 (Dwelling)</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Water backup limit</span>
            <input className="field" onChange={(event) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, waterBackupLimit: event.target.value } }))} placeholder="$10,000" value={data.dashboard.waterBackupLimit || ''} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Claim status</span>
            <select className="field" onChange={(event) => updateData((c) => ({ ...c, dashboard: { ...c.dashboard, claimStatus: event.target.value } }))} value={data.dashboard.claimStatus || ''}>
              <option value="">Select...</option>
              <option value="Open">Open</option>
              <option value="Estimate Received">Estimate Received</option>
              <option value="Partial Payment">Partial Payment</option>
              <option value="Closed">Closed</option>
              <option value="Disputed">Disputed</option>
            </select>
          </label>
        </div>
      </section>

      <PolicyDocUploader />
    </div>
  )
}
