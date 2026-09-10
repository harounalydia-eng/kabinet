import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { KabinetLogo } from '../KabinetLogo'
import { cx } from '../../lib/cx'

/** Phone discovery top row: K on the left, two lightweight centred tabs, nothing heavy. */
export function DiscoveryTop({ right }: { right?: ReactNode }) {
  const { pathname } = useLocation()
  const tabs = [
    { to: '/', label: 'For You' },
    { to: '/saved', label: 'Saved' },
  ]
  return (
    // Three equal-width columns keep the tabs centred on the container regardless of the K's width.
    <div className="sticky top-0 z-30 -mx-(--mobile-page-gutter) grid h-[52px] grid-cols-[1fr_auto_1fr] items-center bg-background/92 px-(--mobile-page-gutter) backdrop-blur-[2px]">
      <KabinetLogo size={24} to="/home" className="justify-self-start" />
      <nav aria-label="Discovery" className="flex items-center justify-center gap-[22px]">
        {tabs.map((t) => {
          const on = pathname === t.to
          return (
            <Link key={t.to} to={t.to} aria-current={on ? 'page' : undefined} className={cx('text-[16px] leading-none transition-colors duration-(--motion-fast)', on ? 'font-semibold text-foreground' : 'font-medium text-nav-muted')}>
              {t.label}
            </Link>
          )
        })}
      </nav>
      <div className="flex justify-self-end">{right}</div>
    </div>
  )
}

/** Explore-style scrolling text tabs with an underline on the active one. */
export function TextTabs<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; className?: string }) {
  return (
    <div className={cx('no-scrollbar -mx-(--mobile-page-gutter) flex flex-nowrap gap-[24px] overflow-x-auto px-(--mobile-page-gutter) whitespace-nowrap', className)} role="tablist">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)} className={cx('relative shrink-0 py-[10px] text-[16px] leading-none transition-colors duration-(--motion-fast)', on ? 'font-semibold text-foreground' : 'font-medium text-nav-muted')}>
            {o.label}
            {on && <span aria-hidden="true" className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-foreground" />}
          </button>
        )
      })}
    </div>
  )
}
