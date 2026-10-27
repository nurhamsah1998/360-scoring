import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { currentLang } from '../i18n'
import { supabase } from '../lib/supabase'

type Notification = {
  id: string
  org_id: string
  type: string
  payload: { cycle_id?: string; cycle?: string; reviewee?: string; peer?: string; status?: string }
  read_at: string | null
  created_at: string
}

function timeAgo(iso: string, lang: string) {
  const rtf = new Intl.RelativeTimeFormat(lang === 'id' ? 'id' : 'en', { numeric: 'auto' })
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12]]
  let v = s
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit)
    v /= size
  }
  return rtf.format(Math.round(v), 'year')
}

export function NotificationBell({ orgId }: { orgId: string }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const lang = currentLang()

  const { data } = useQuery({
    queryKey: ['notifications', session?.user.id],
    enabled: !!session,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications').select('id, org_id, type, payload, read_at, created_at')
        .order('created_at', { ascending: false }).limit(30)
      if (error) throw error
      return data as Notification[]
    },
  })
  const markRead = useMutation({
    mutationFn: async (ids: string[] | null) => {
      const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const list = (data ?? []).filter((n) => n.org_id === orgId)
  const unread = list.filter((n) => !n.read_at).length

  const text = (n: Notification) => {
    const p = { cycle: n.payload.cycle ?? '', reviewee: n.payload.reviewee ?? '', peer: n.payload.peer ?? '' }
    if (n.type === 'nomination_decided') return t(`notifications.nomination_decided_${n.payload.status === 'approved' ? 'approved' : 'rejected'}`, p)
    return t(`notifications.${n.type}`, p)
  }
  const go = (n: Notification) => {
    if (!n.read_at) markRead.mutate([n.id])
    setOpen(false)
    if (n.type === 'review_open') navigate('/app/reviews')
    else if (n.payload.cycle_id) navigate(`/app/cycles/${n.payload.cycle_id}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? t('notifications.unread', { count: unread }) : t('notifications.title')}
        title={t('notifications.title')}
        className="relative rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-line bg-card shadow-[0_24px_60px_-20px_rgba(23,32,46,0.45)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-bold">{t('notifications.title')}</h2>
            {unread > 0 && (
              <button type="button" onClick={() => markRead.mutate(null)} className="text-sm font-semibold text-brand hover:underline">
                {t('notifications.markAll')}
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">{t('notifications.empty')}</p>
          ) : (
            <ul className="max-h-[60dvh] overflow-y-auto">
              {list.map((n) => (
                <li key={n.id} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => go(n)} className={clsx('flex w-full gap-3 px-4 py-3 text-left hover:bg-ink/[0.03]', !n.read_at && 'bg-brand/[0.04]')}>
                    <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block text-[15px]', !n.read_at && 'font-semibold')}>{text(n)}</span>
                      <span className="block text-xs text-muted">{timeAgo(n.created_at, lang)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
