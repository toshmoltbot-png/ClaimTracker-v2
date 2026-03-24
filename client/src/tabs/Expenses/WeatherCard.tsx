import { useEffect, useState } from 'react'

interface WeatherCardProps {
  address: string
  dateOfLoss: string
  utilityDateRanges: Array<{ start?: string; end?: string; label?: string }>
}

interface WeatherSummary {
  avg: number
  min: number
  max: number
}

async function geocode(address: string) {
  const query = encodeURIComponent(address)
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`)
  if (!response.ok) throw new Error('Unable to geocode address')
  const payload = await response.json() as { results?: Array<{ latitude: number; longitude: number }> }
  return payload.results?.[0] || null
}

async function fetchWeather(latitude: number, longitude: number, start: string, end: string): Promise<WeatherSummary | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: start,
    end_date: end,
    daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean',
    timezone: 'America/New_York',
    temperature_unit: 'fahrenheit',
  })
  const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`)
  if (!response.ok) throw new Error('Unable to fetch weather')
  const payload = await response.json() as {
    daily?: {
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
      temperature_2m_mean?: number[]
    }
  }
  const mean = payload.daily?.temperature_2m_mean || []
  const mins = payload.daily?.temperature_2m_min || []
  const maxes = payload.daily?.temperature_2m_max || []
  if (!mean.length) return null
  return {
    avg: Math.round(mean.reduce((sum, value) => sum + value, 0) / mean.length),
    min: Math.round(Math.min(...mins)),
    max: Math.round(Math.max(...maxes)),
  }
}

export function WeatherCard({ address, dateOfLoss, utilityDateRanges }: WeatherCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lossWeather, setLossWeather] = useState<WeatherSummary | null>(null)
  const [rangeWeather, setRangeWeather] = useState<Array<{ label: string; weather: WeatherSummary }>>([])

  useEffect(() => {
    if (!address || !dateOfLoss) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const coordinates = await geocode(address)
        if (!coordinates) throw new Error('No weather location found')
        const [loss, ...ranges] = await Promise.all([
          fetchWeather(coordinates.latitude, coordinates.longitude, dateOfLoss, dateOfLoss),
          ...utilityDateRanges
            .filter((entry) => entry.start && entry.end)
            .slice(0, 3)
            .map(async (entry) => ({
              label: entry.label || `${entry.start} - ${entry.end}`,
              weather: await fetchWeather(coordinates.latitude, coordinates.longitude, String(entry.start), String(entry.end)),
            })),
        ])
        if (cancelled) return
        setLossWeather(loss)
        setRangeWeather(ranges.filter((entry): entry is { label: string; weather: WeatherSummary } => Boolean(entry.weather)).map((entry) => ({ label: entry.label, weather: entry.weather as WeatherSummary })))
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Unable to load weather')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [address, dateOfLoss, utilityDateRanges])

  if (!address || !dateOfLoss) return null

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-amber-200">Weather Support</p>
          <h3 className="mt-2 text-base font-semibold text-white">ALE heating context</h3>
        </div>
        {loading ? <span className="text-xs text-amber-100">Loading…</span> : null}
      </div>
      {error ? <p className="mt-3 text-sm text-amber-100">{error}</p> : null}
      {lossWeather ? (
        <p className="mt-3 text-sm text-amber-50">
          Date of loss average temperature: <span className="font-semibold">{lossWeather.avg}°F</span>
          {lossWeather.avg < 45 ? ' - supports increased heating claims.' : '.'}
        </p>
      ) : null}
      {rangeWeather.length ? (
        <div className="mt-4 space-y-2">
          {rangeWeather.map((entry) => (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm" key={entry.label}>
              <span className="text-slate-200">{entry.label}</span>
              <span className="text-amber-100">
                Avg {entry.weather.avg}°F · {entry.weather.min}°F to {entry.weather.max}°F
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
