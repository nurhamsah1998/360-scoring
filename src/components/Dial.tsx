import clsx from 'clsx'

/**
 * The 360° ring: four arcs, one per rater group.
 * Order (clockwise from top): manager, peer, direct report, self.
 */
const GROUPS = [
  { key: 'manager', color: 'var(--color-manager)' },
  { key: 'peer', color: 'var(--color-peer)' },
  { key: 'report', color: 'var(--color-report)' },
  { key: 'self', color: 'var(--color-self)' },
] as const

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }
  const [x1, y1] = toXY(startDeg)
  const [x2, y2] = toXY(endDeg)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

type DialProps = {
  size?: number
  stroke?: number
  gap?: number
  animate?: boolean
  className?: string
}

export function Dial({ size = 32, stroke, gap = 10, animate = false, className }: DialProps) {
  const sw = stroke ?? Math.max(3, size * 0.14)
  const r = (size - sw) / 2
  const c = size / 2
  const segLen = ((90 - gap) / 360) * 2 * Math.PI * r

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden className={clsx('shrink-0', className)}>
      {GROUPS.map((g, i) => (
        <path
          key={g.key}
          d={arc(c, c, r, i * 90 + gap / 2, (i + 1) * 90 - gap / 2)}
          stroke={g.color}
          strokeWidth={sw}
          strokeLinecap="round"
          style={
            animate
              ? ({
                  '--len': segLen,
                  strokeDasharray: segLen,
                  strokeDashoffset: segLen,
                  animation: `draw-arc 700ms cubic-bezier(.2,.7,.2,1) ${150 + i * 140}ms forwards`,
                } as React.CSSProperties)
              : undefined
          }
        />
      ))}
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 font-extrabold tracking-tight', className)}>
      <Dial size={26} gap={14} />
      <span className="text-[17px]">360 Scoring</span>
    </span>
  )
}
