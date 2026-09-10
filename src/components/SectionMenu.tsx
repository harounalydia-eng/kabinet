import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { cx } from '../lib/cx'

/** Primary product areas. Account and personal settings live in the avatar menu, never here. */
export const SECTIONS = [
  { to: '/', label: 'For You' },
  { to: '/explore', label: 'Explore' },
  { to: '/collections', label: 'Collections' },
  { to: '/kabinet', label: 'My Kabinet' },
  { to: '/routines', label: 'Routines' },
  { to: '/shop', label: 'Shop' },
] as const

export type Section = (typeof SECTIONS)[number]

export function sectionFor(pathname: string): Section {
  if (pathname === '/' || pathname === '/saved' || pathname.startsWith('/s/') || pathname.startsWith('/search')) return SECTIONS[0]
  if (pathname.startsWith('/routines')) return SECTIONS[4]
  if (pathname.startsWith('/shop') || pathname.startsWith('/product/')) return SECTIONS[5]
  if (pathname.startsWith('/explore') || pathname.startsWith('/look/')) return SECTIONS[1]
  if (pathname.startsWith('/collections')) return SECTIONS[2]
  if (pathname.startsWith('/kabinet')) return SECTIONS[3]
  return SECTIONS[0]
}

/**
 * Primary navigation dropdown, anchored to the current-section trigger beside the K.
 * Quiet text rows in one soft container; the current section reads strong.
 * Click / outside / Escape close it; arrow keys, Home and End move focus; Enter selects.
 */
export function SectionMenu({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const current = sectionFor(pathname)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    // focus the current item so keyboard users land somewhere sensible
    const i = SECTIONS.findIndex((s) => s.to === current.to)
    itemRefs.current[i]?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, current.to])

  useEffect(() => setOpen(false), [pathname])

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[]
    const i = items.indexOf(document.activeElement as HTMLAnchorElement)
    const go = (n: number) => items[(n + items.length) % items.length]?.focus()
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        go(i + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        go(i - 1)
        break
      case 'Home':
        e.preventDefault()
        go(0)
        break
      case 'End':
        e.preventDefault()
        go(items.length - 1)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className={cx('relative', className)} onKeyDown={onMenuKey}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'flex h-[34px] items-center gap-[6px] rounded-full pr-[10px] pl-[10px] type-nav font-medium text-foreground transition-colors duration-(--motion-fast)',
          open ? 'bg-surface' : 'hover:bg-surface',
        )}
      >
        <span>{current.label}</span>
        <span aria-hidden="true" className="text-[11px] leading-none text-muted-foreground">{open ? '⌃' : '⌄'}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Primary navigation"
          className="absolute top-[calc(100%+6px)] left-0 z-50 w-[260px] rounded-[16px] border border-border bg-surface-elevated p-[8px] shadow-toolbar"
        >
          {SECTIONS.map((s, i) => {
            const on = s.to === current.to
            return (
              <Link
                key={s.to}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                to={s.to}
                role="menuitem"
                aria-current={on ? 'page' : undefined}
                tabIndex={on ? 0 : -1}
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  nav(s.to)
                }}
                className={cx(
                  'flex h-[44px] items-center rounded-[10px] px-[14px] type-nav transition-colors duration-(--motion-fast) outline-none',
                  'hover:bg-background focus-visible:bg-background',
                  on ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                )}
              >
                {s.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
