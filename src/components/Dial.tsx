import clsx from 'clsx'

/**
 * The 360 Scoring mark: a feedback ring (the full circle of reviewers) with a check
 * mark (the assessment) whose long stroke breaks out of the ring (growth after it).
 */
const RING = 'M 43.6 21.4 A 22 22 0 1 1 6.7 31.3'
const CHECK = 'M 6.7 31.3 L 25 44 L 57 5.1'

const TONES = {
  color: { ring: 'var(--color-brand)', check: 'var(--color-manager)' },
  light: { ring: '#FFFFFF', check: '#3FD1B0' },
  mono: { ring: 'currentColor', check: 'currentColor' },
} as const

type MarkProps = {
  size?: number
  tone?: keyof typeof TONES
  animate?: boolean
  className?: string
}

export function Mark({ size = 32, tone = 'color', animate = false, className }: MarkProps) {
  const c = TONES[tone]
  const draw = (delay: number, dur: number) =>
    animate
      ? ({ strokeDasharray: 1, strokeDashoffset: 1, ['--len' as string]: 1, animation: `draw-arc ${dur}ms cubic-bezier(.2,.7,.2,1) ${delay}ms forwards` } as React.CSSProperties)
      : undefined
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden className={clsx('shrink-0', className)}>
      <path d={RING} stroke={c.ring} pathLength={1} style={draw(100, 800)} />
      <path d={CHECK} stroke={c.check} pathLength={1} style={draw(650, 650)} />
    </svg>
  )
}

/** Kept for older imports: the mark at the size the ring used to be drawn. */
export function Dial({ size = 32, animate = false, className }: { size?: number; stroke?: number; gap?: number; animate?: boolean; className?: string }) {
  return <Mark size={size} animate={animate} className={className} />
}

export function Logo({ className, tone = 'color' }: { className?: string; tone?: keyof typeof TONES }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 font-extrabold tracking-tight', className)}>
      <Mark size={28} tone={tone} />
      <span className="text-[17px]">360 Scoring</span>
    </span>
  )
}
