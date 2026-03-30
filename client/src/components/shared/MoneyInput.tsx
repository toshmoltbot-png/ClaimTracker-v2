import type { InputHTMLAttributes } from 'react'

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Extra classes on the outer wrapper */
  wrapperClassName?: string
}

/**
 * Number input with a `$` prefix baked in.
 * Drop-in replacement for `<input type="number" className="field" …/>`.
 */
export function MoneyInput({ className = 'field', wrapperClassName = '', ...props }: MoneyInputProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input {...props} className={`${className} pl-7`} type="number" />
    </div>
  )
}
