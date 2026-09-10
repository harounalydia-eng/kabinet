import { useEffect, useRef, useState, type ReactNode } from 'react'

/** lg breakpoint (64rem) — the popover belongs to the desktop header, the sheet to phones. */
function useIsDesktop(): boolean {
  const [is, setIs] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 64rem)').matches : true))
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 64rem)')
    const on = () => setIs(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return is
}
import { Link } from 'react-router'
import { Chip } from './Chip'
import { Sheet } from './Sheet'
import { cx } from '../lib/cx'
import { useProfile } from '../lib/profile'
import { useStore } from '../lib/store'
import { useTheme, type ThemePreference } from '../lib/theme'
import { useUI, type Density } from '../lib/ui'

/** User avatar: warm circle with the user's initial. Not a brand mark. */
export function Avatar({ size = 34 }: { size?: number }) {
  const { profile } = useProfile()
  const initial = profile.name.trim().charAt(0).toUpperCase()
  return (
    <span aria-hidden="true" className="flex items-center justify-center rounded-full bg-muted type-body-sm font-medium text-foreground" style={{ width: size, height: size }}>
      {initial}
    </span>
  )
}

/** Theme: Light · Dark · System. Applies immediately via the root ThemeProvider. */
export function ThemeSelector({ on = 'surface' }: { on?: 'surface' | 'canvas' }) {
  const { preference, setPreference } = useTheme()
  const opts: Array<[ThemePreference, string]> = [
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['system', 'System'],
  ]
  return (
    <div className="flex gap-[4px]">
      {opts.map(([v, l]) => (
        <Chip key={v} on={on} selected={preference === v} onClick={() => setPreference(v)} className="h-[30px] px-[12px]">
          {l}
        </Chip>
      ))}
    </div>
  )
}

/** Grid size: Large · Medium · Dense. Persisted on this device. */
export function GridDensitySelector({ on = 'surface' }: { on?: 'surface' | 'canvas' }) {
  const { density, setDensity } = useUI()
  const opts: Array<[Density, string]> = [
    ['large', 'Large'],
    ['medium', 'Medium'],
    ['dense', 'Dense'],
  ]
  return (
    <div className="flex gap-[4px]">
      {opts.map(([v, l]) => (
        <Chip key={v} on={on} selected={density === v} onClick={() => setDensity(v)} className="h-[30px] px-[12px]">
          {l}
        </Chip>
      ))}
    </div>
  )
}

function Row({ to, label, right, onClick }: { to: string; label: string; right?: ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center justify-between rounded-[10px] px-[10px] py-[9px] type-body-sm text-foreground transition-colors duration-(--motion-fast) hover:bg-background">
      <span>{label}</span>
      <span className="type-meta text-muted-foreground">{right}</span>
    </Link>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <p className="m-0 px-[10px] pb-[4px] type-eyebrow text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

/** The menu body — shared by the desktop popover and the phone sheet. */
export function ProfileMenuContent({ onNavigate, on = 'surface' }: { onNavigate: () => void; on?: 'surface' | 'canvas' }) {
  const { profile } = useProfile()
  const { saves, collections, owned, routines } = useStore()
  return (
    <div className="flex flex-col gap-md">
      <Link to="/profile" onClick={onNavigate} className="flex items-center justify-between rounded-[10px] px-[10px] py-[8px] transition-colors duration-(--motion-fast) hover:bg-background">
        <div className="flex flex-col">
          <span className="type-h3 text-foreground">{profile.name || 'Your beauty profile'}</span>
          <span className="type-meta text-muted-foreground">View beauty profile →</span>
        </div>
        <Avatar size={36} />
      </Link>

      <Group title="My Kabinet">
        <Row to="/kabinet" label="My products" right={owned.length} onClick={onNavigate} />
        <Row to="/saved" label="Saved" right={saves.length} onClick={onNavigate} />
        <Row to="/collections" label="Collections" right={collections.length} onClick={onNavigate} />
        <Row to="/routines" label="Routines" right={routines.length} onClick={onNavigate} />
      </Group>

      <hr className="m-0 border-0 border-t border-border" />

      <Group title="Beauty profile">
        <Row to="/profile" label="Your interests" right="→" onClick={onNavigate} />
        <Row to="/profile" label="Your goals" right="→" onClick={onNavigate} />
      </Group>

      <hr className="m-0 border-0 border-t border-border" />

      <Row to="/settings" label="Settings" onClick={onNavigate} />

      <hr className="m-0 border-0 border-t border-border" />

      <div className="flex flex-col gap-sm px-[10px]">
        <div className="flex items-center justify-between gap-md">
          <span className="type-eyebrow text-muted-foreground">Theme</span>
          <ThemeSelector on={on} />
        </div>
        <div className="flex items-center justify-between gap-md">
          <span className="type-eyebrow text-muted-foreground">Grid size</span>
          <GridDensitySelector on={on} />
        </div>
      </div>
    </div>
  )
}

/** Avatar control. Floating menu on desktop, account sheet on phones. */
export function ProfileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const desktop = useIsDesktop()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((v) => !v)}
        className={cx('flex items-center justify-center rounded-full transition-shadow duration-(--motion-fast)', open && 'ring-1 ring-foreground')}
      >
        <Avatar size={34} />
      </button>

      {desktop ? (
        open && (
          <div role="menu" className="absolute top-[42px] right-0 z-50 w-[380px] rounded-[16px] bg-surface-elevated p-[10px] shadow-toolbar ring-1 ring-border">
            <ProfileMenuContent onNavigate={() => setOpen(false)} />
          </div>
        )
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)} label="Account">
          <ProfileMenuContent on="surface" onNavigate={() => setOpen(false)} />
        </Sheet>
      )}
    </div>
  )
}
