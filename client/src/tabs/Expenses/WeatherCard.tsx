import { useEffect, useState } from 'react'

interface WeatherCardProps {
  address: string
  dateOfLoss: string
  utilityDateRanges: Array<{ start?: string; end?: string; label?: string }>
  /** Called with a formatted weather summary string whenever data loads, so parents can persist it */
  onWeatherLoaded?: (summary: string) => void
}

interface WeatherSummary {
  avg: number
  min: number
  max: number
}

async function geocode(address: string) {
  // Open-Meteo geocoder only handles city/place names, not full street addresses.
  // Try progressively simpler queries: full → city/state/zip → city/state → zip
  const attempts = buildGeocodeCandidates(address)
  for (const query of attempts) {
    const encoded = encodeURIComponent(query)
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1&language=en&format=json`)
    if (!response.ok) continue
    const payload = await response.json() as { results?: Array<{ latitude: number; longitude: number }> }
    if (payload.results?.[0]) return payload.results[0]
  }
  return null
}

function buildGeocodeCandidates(address: string): string[] {
  const candidates: string[] = []
  // Try full address first (unlikely to work but costs nothing)
  candidates.push(address)
  // Extract city, state, zip from common formats like "287 Ashby Road, Ashburnham, MA 01430"
  const parts = address.split(',').map((s) => s.trim())
  if (parts.length >= 2) {
    // Skip first part (street), use rest (city, state zip)
    candidates.push(parts.slice(1).join(', '))
    // Just city name
    candidates.push(parts[1].trim())
  }
  // Try zip code if present
  const zipMatch = address.match(/\b(\d{5})\b/)
  if (zipMatch) candidates.push(zipMatch[1])
  return candidates.filter(Boolean)
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
  if (!response.ok) throw new Error('Could not retrieve weather data. Please try again later.')
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

export function WeatherCard({ address, dateOfLoss, utilityDateRanges, onWeatherLoaded }: WeatherCardProps) {
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
        if (!coordinates) throw new Error('Could not look up weather for your address. Check that your property address is entered correctly in Step 2.')
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
        const validRanges = ranges.filter((entry): entry is { label: string; weather: WeatherSummary } => Boolean(entry.weather)).map((entry) => ({ label: entry.label, weather: entry.weather as WeatherSummary }))
        setRangeWeather(validRanges)

        // Build a summary string for persistence
        if (onWeatherLoaded) {
          const parts: string[] = []
          if (loss) {
            parts.push(`Date of loss: avg ${loss.avg}°F (low ${loss.min}°F, high ${loss.max}°F)`)
          }
          for (const r of validRanges) {
            parts.push(`${r.label}: avg ${r.weather.avg}°F (low ${r.weather.min}°F, high ${r.weather.max}°F)`)
          }
          if (parts.length) onWeatherLoaded(parts.join('. ') + '.')
        }
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load weather data.')
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
          <p className="text-xs uppercase tracking-[0.24em] text-amber-200">Weather Data</p>
          <h3 className="mt-2 text-base font-semibold text-white">Temperature at the time of your loss</h3>
        </div>
        {loading ? <span className="text-xs text-amber-100">Loading…</span> : null}
      </div>
      {error ? <p className="mt-3 text-sm text-amber-100">{error}</p> : null}
      {lossWeather ? (
        <p className="mt-3 text-sm text-amber-50">
          Date of loss average temperature: <span className="font-semibold">{lossWeather.avg}°F</span>
          {lossWeather.avg < 45 ? ' — cold weather supports higher heating costs in your claim.' : '.'}
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
