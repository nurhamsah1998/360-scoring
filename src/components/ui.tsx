import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-hover',
        variant === 'outline' && 'border border-line bg-card text-ink hover:border-ink/40',
        variant === 'ghost' && 'text-ink hover:bg-ink/5',
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, className, ...rest }, ref) {
  const id = useId()
  const hintId = hint || error ? `${id}-hint` : undefined
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={hintId}
        className={clsx(
          'rounded-lg border bg-card px-3 py-2.5 text-[15px] outline-none transition-colors placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      />
      {(error || hint) && (
        <p id={hintId} className={clsx('text-sm', error ? 'text-danger' : 'text-muted')}>{error ?? hint}</p>
      )}
    </div>
  )
})

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'success' | 'info'; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={clsx(
        'rounded-lg border-l-4 px-3.5 py-3 text-sm',
        tone === 'danger' && 'border-danger bg-danger/8 text-danger',
        tone === 'success' && 'border-success bg-success/8 text-success',
        tone === 'info' && 'border-brand bg-brand/6 text-ink',
      )}
    >
      {children}
    </div>
  )
}

export function Spinner({ fullScreen }: { fullScreen?: boolean }) {
  const icon = <Loader2 className="size-6 animate-spin text-muted" aria-label="Loading" />
  return fullScreen ? <div className="grid min-h-dvh place-items-center">{icon}</div> : icon
}
