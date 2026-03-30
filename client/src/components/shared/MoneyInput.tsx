import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string
}

/**
 * Money input with `$` prefix and proper formatting (always shows cents).
 * Manages its own text while focused so partial decimals like "4." aren't
 * swallowed by parent Number() conversions.
 */
export function MoneyInput({ className = 'field', wrapperClassName = '', value, onChange, readOnly, onFocus, onBlur, min: _min, max: _max, step: _step, ...props }: MoneyInputProps) {
  void _min; void _max; void _step
  const [focused, setFocused] = useState(false)
  const [localText, setLocalText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const externalValue = value === undefined || value === null || value === '' ? '' : String(value)

  // Sync external value into local text only when NOT focused
  useEffect(() => {
    if (!focused) {
      if (externalValue === '') {
        setLocalText('')
      } else {
        const num = parseFloat(externalValue)
        setLocalText(isNaN(num) ? externalValue : num.toFixed(2))
      }
    }
  }, [externalValue, focused])

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    // Allow empty, digits, single decimal, partial like "4."
    if (raw !== '' && !/^-?\d*\.?\d*$/.test(raw)) return
    setLocalText(raw)
    if (onChange) onChange(event)
  }, [onChange])

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    // Show raw number (no trailing zeros) for easy editing
    if (externalValue !== '') {
      const num = parseFloat(externalValue)
      setLocalText(isNaN(num) ? externalValue : String(num))
    }
    onFocus?.(e)
  }, [externalValue, onFocus])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    // Format to 2 decimals
    if (localText !== '') {
      const num = parseFloat(localText)
      setLocalText(isNaN(num) ? localText : num.toFixed(2))
    }
    onBlur?.(e)
  }, [localText, onBlur])

  return (
    <div className={`relative ${wrapperClassName}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input
        ref={inputRef}
        {...props}
        className={`${className} pl-7`}
        inputMode="decimal"
        onChange={readOnly ? undefined : handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        readOnly={readOnly}
        type="text"
        value={localText}
      />
    </div>
  )
}
