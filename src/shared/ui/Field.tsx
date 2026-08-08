import { forwardRef, useId } from 'react'
import { cn } from '@/shared/lib/cn'

const control =
  'w-full rounded-lg border bg-ink-900/80 px-3.5 text-sm text-chalk placeholder:text-chalk-faint ' +
  'transition-colors duration-150 outline-none ' +
  'border-ink-600 focus:border-volt-400 disabled:opacity-50 disabled:cursor-not-allowed'

type FieldShellProps = {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode
}

/** Wraps a control with label/hint/error and wires up the a11y attributes,
 *  so no screen ever ships an input whose error is visual-only. */
export function Field({ label, hint, error, required, className, children }: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-chalk-dim"
        >
          {label}
          {required && <span className="ml-1 text-volt-400">*</span>}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger-500">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-chalk-faint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label?: string
  hint?: string
  error?: string
  className?: string
  inputClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, inputClassName, required, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, 'h-11', invalid && 'border-danger-500', inputClassName)}
          {...rest}
        />
      )}
    </Field>
  )
})

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  label?: string
  hint?: string
  error?: string
  className?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, required, children, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, 'h-11 appearance-none pr-9', invalid && 'border-danger-500')}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a7b8c9' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center',
          }}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  )
})

type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  label?: string
  hint?: string
  error?: string
  className?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, required, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, 'min-h-24 resize-y py-2.5', invalid && 'border-danger-500')}
          {...rest}
        />
      )}
    </Field>
  )
})
