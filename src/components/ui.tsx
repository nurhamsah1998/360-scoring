import clsx from 'clsx'
import { Loader2, X } from 'lucide-react'
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
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
        variant === 'danger' && 'text-danger hover:bg-danger/8',
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

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }

export function SelectField({ label, hint, className, children, ...rest }: SelectFieldProps) {
  const id = useId()
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <select
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
        {...rest}
      >
        {children}
      </select>
      {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

const STATUS_STYLES = {
  active: 'bg-success/10 text-success',
  invited: 'bg-peer/12 text-[#8a5212]',
  inactive: 'bg-ink/8 text-muted',
  admin: 'bg-brand/10 text-brand',
  member: 'bg-ink/6 text-muted',
} as const

export function Badge({ kind, children }: { kind: keyof typeof STATUS_STYLES; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLES[kind])}>
      {children}
    </span>
  )
}

/** Modal built on the native <dialog> element (focus trap, Esc to close, backdrop). */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="m-auto w-[min(520px,calc(100vw-24px))] rounded-2xl border border-line bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(23,32,46,0.45)] backdrop:bg-ink/40"
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
            <button type="button" onClick={onClose} className="-m-1 rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function Spinner({ fullScreen }: { fullScreen?: boolean }) {
  const icon = <Loader2 className="size-6 animate-spin text-muted" aria-label="Loading" />
  return fullScreen ? <div className="grid min-h-dvh place-items-center">{icon}</div> : icon
}
