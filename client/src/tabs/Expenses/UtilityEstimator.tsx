import { useMemo, useState } from 'react'
import { calcExpenseDays, formatCurrency } from '@/lib/claimWorkflow'

const FUEL_DEFAULTS: Record<string, { unit: string; price: number }> = {
  Electric: { unit: 'kWh', price: 0.18 },
  'Natural Gas': { unit: 'therms', price: 0.5 },
  Propane: { unit: 'gallons', price: 3 },
  'Oil/Kerosene': { unit: 'gallons', price: 4.2 },
  'Wood Pellet': { unit: 'lbs', price: 0.15 },
}

export function UtilityEstimator() {
  const [mode, setMode] = useState<'bill' | 'fuel'>('bill')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dailyIncrease, setDailyIncrease] = useState(0)
  const [fuelType, setFuelType] = useState<keyof typeof FUEL_DEFAULTS>('Electric')
  const [fuelUsage, setFuelUsage] = useState(0)
  const [fuelPrice, setFuelPrice] = useState(FUEL_DEFAULTS.Electric.price)

  const totalDays = calcExpenseDays(startDate, endDate)
  const defaultUnit = FUEL_DEFAULTS[fuelType].unit
  const estimatedDaily = mode === 'fuel' ? fuelUsage * fuelPrice : dailyIncrease
  const total = useMemo(() => estimatedDaily * totalDays, [estimatedDaily, totalDays])

  return (
    <div className="panel px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Utility Estimator</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Displacement cost calculator</h3>
        </div>
        <button className="button-secondary" onClick={() => setMode((current) => current === 'bill' ? 'fuel' : 'bill')} type="button">
          {mode === 'bill' ? 'Fuel estimate mode' : 'Bill comparison mode'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Start date</span>
          <input className="field" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">End date</span>
          <input className="field" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </label>

        {mode === 'bill' ? (
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">Daily utility increase</span>
            <input className="field" min="0" onChange={(event) => setDailyIncrease(Number(event.target.value || 0))} step="0.01" type="number" value={dailyIncrease} />
          </label>
        ) : (
          <>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Fuel type</span>
              <select
                className="field"
                onChange={(event) => {
                  const nextType = event.target.value as keyof typeof FUEL_DEFAULTS
                  setFuelType(nextType)
                  setFuelPrice(FUEL_DEFAULTS[nextType].price)
                }}
                value={fuelType}
              >
                {Object.keys(FUEL_DEFAULTS).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Daily usage ({defaultUnit})</span>
              <input className="field" min="0" onChange={(event) => setFuelUsage(Number(event.target.value || 0))} step="0.01" type="number" value={fuelUsage} />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-slate-300">Price per {defaultUnit}</span>
              <input className="field" min="0" onChange={(event) => setFuelPrice(Number(event.target.value || 0))} step="0.01" type="number" value={fuelPrice} />
            </label>
          </>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-4 text-sm text-sky-50">
        <p>{totalDays} covered day{totalDays === 1 ? '' : 's'}</p>
        <p className="mt-1">Estimated daily cost: <span className="font-semibold">{formatCurrency(estimatedDaily)}</span></p>
        <p className="mt-1 text-lg font-semibold text-white">Estimated total: {formatCurrency(total)}</p>
      </div>
    </div>
  )
}
