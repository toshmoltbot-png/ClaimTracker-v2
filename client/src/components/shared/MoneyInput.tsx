import { useCallback, useRef, useState, type InputHTMLAttributes } from 'react'

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string
}

/**
 * Money input with `$` prefix and proper formatting (always shows cents).
 * Uses text input + inputMode="decimal" so trailing zeros are preserved.
 * Formats to 2 decimal places on blur; raw editing while focused.
 */
export function MoneyInput({ className = 'field', wrapperClassName = '', value, onChange, readOnly, onFocus, onBlur, min: _min, max: _max, step: _step, ...props }: MoneyInputProps) {
  void _min; void _max; void _step
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const rawValue = value === undefined || value === null || value === '' ? '' : String(value)

  // When not focused, format with 2 decimal places
  const displayValue = (() => {
    if (focused) return rawValue
    if (rawValue === '') return ''
    const num = parseFloat(rawValue)
    if (isNaN(num)) return rawValue
    return num.toFixed(2)
  })()

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value
    // Allow empty, digits, single decimal point, and partial decimals like "4."
    if (input !== '' && !/^-?\d*\.?\d*$/.test(input)) return
    if (onChange) onChange(event)
  }, [onChange])

  return (
    <div className={`relative ${wrapperClassName}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input
        ref={inputRef}
        {...props}
        className={`${className} pl-7`}
        inputMode="decimal"
        onChange={readOnly ? undefined : handleChange}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        readOnly={readOnly}
        type="text"
        value={displayValue}
      />
    </div>
  )
}
