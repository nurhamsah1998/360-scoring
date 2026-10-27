import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLang } from '../i18n'
import { fmt, SERIES_COLOR, valueOf, type Report, type Series } from '../lib/report'

type Props = { report: Report; series: Series[] }

const W = 640
const H = 470
const CX = W / 2
const CY = H / 2
const R = 170
const MIN = 1 // ratings are 1–5, so the centre is 1
const MAX = 5

/**
 * Radar of skill scores per rater group, scale 0–5 with rings at 1…5.
 * Hover or focus a skill to see every group's value for it.
 */
export function RadarChart({ report, series }: Props) {
  const { t } = useTranslation()
  const lang = currentLang()
  const comps = report.competencies
  const n = comps.length
  const [active, setActive] = useState<number | null>(null)

  const angle = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / n
  const rad = (v: number) => (R * (v - MIN)) / (MAX - MIN)
  const pt = (i: number, v: number) => [CX + Math.cos(angle(i)) * rad(v), CY + Math.sin(angle(i)) * rad(v)] as const

  const ring = (v: number) => comps.map((_, i) => pt(i, v).join(',')).join(' ')

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[640px]" role="img"
        aria-label={t('report.bySkill')} onMouseLeave={() => setActive(null)}>
        {/* Grid: recessive rings and spokes */}
        {[2, 3, 4, 5].map((v) => (
          <polygon key={v} points={ring(v)} fill="none" stroke="var(--color-line)" strokeWidth={v === 5 ? 1.25 : 0.75} />
        ))}
        {comps.map((_, i) => {
          const [x, y] = pt(i, MAX)
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--color-line)" strokeWidth={0.75} />
        })}
        {[1, 3, 5].map((v) => (
          <text key={v} x={CX + 5} y={CY - rad(v) + 4} fontSize={13} fill="var(--color-muted)">{v}</text>
        ))}

        {/* Series: 2px lines, faint fill, 2px surface ring around points */}
        {series.map((s) => {
          const pts = comps
            .map((c, i) => { const v = valueOf(c, s); return v == null ? null : pt(i, v) })
            .filter((p): p is readonly [number, number] => !!p)
          if (pts.length < 2) return null
          const dash = s === 'others' ? '5 4' : undefined
          return (
            <g key={s}>
              <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={s === 'others' ? 'none' : SERIES_COLOR[s]} fillOpacity={0.05}
                stroke={SERIES_COLOR[s]} strokeWidth={2} strokeDasharray={dash} strokeLinejoin="round" />
              {pts.map(([x, y], k) => (
                <circle key={k} cx={x} cy={y} r={4} fill={SERIES_COLOR[s]} stroke="var(--color-card)" strokeWidth={2} />
              ))}
            </g>
          )
        })}

        {/* Axis labels double as hover / focus targets */}
        {comps.map((c, i) => {
          const [x, y] = pt(i, MAX + 0.42)
          const cos = Math.cos(angle(i))
          const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
          return (
            <g key={c.key} tabIndex={0} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              className="cursor-default outline-none" role="button" aria-label={c.name}>
              <line x1={CX} y1={CY} x2={pt(i, MAX)[0]} y2={pt(i, MAX)[1]} stroke="transparent" strokeWidth={24} />
              <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={17}
                fontWeight={active === i ? 700 : 600} fill={active === i ? 'var(--color-ink)' : 'var(--color-muted)'}>
                {c.name}
              </text>
            </g>
          )
        })}
      </svg>

      {active != null && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-[0_12px_30px_-12px_rgba(23,32,46,0.35)]" role="status">
          <p className="font-bold">{comps[active].name}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {series.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5" style={{ background: SERIES_COLOR[s] }} aria-hidden />
                <span className="text-muted">{t(`report.groups.${s}`)}</span>
                <span className="ml-auto pl-4 font-semibold">{fmt(valueOf(comps[active], s), lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  )
}
