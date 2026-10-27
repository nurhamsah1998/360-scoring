import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Dial'
import { LanguageSwitch } from './LanguageSwitch'

export function AuthLayout({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link to="/" aria-label="360 Scoring home"><Logo /></Link>
        <LanguageSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px] rounded-3xl border bg-card p-6 sm:p-8">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {intro && <p className="mt-2 text-muted">{intro}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
