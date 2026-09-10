import { Link, useLocation } from 'react-router'
import { cx } from '../../lib/cx'
import { useUI } from '../../lib/ui'

/**
 * Phone navigation that floats over the content: a compact three-control pill
 * (Home · Explore · +) and a separate circular Search. The feed continues underneath.
 */
const common = { width: 22, height: 22, viewBox: '0 0 22 22', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const HomeIcon = () => <svg {...common}><path d="M4 10.5 11 4.5l7 6V18a.5.5 0 0 1-.5.5h-4.2V13H8.7v5.5H4.5A.5.5 0 0 1 4 18z" /></svg>
const ExploreIcon = () => <svg {...common}><circle cx="11" cy="11" r="7.5" /><path d="M3.5 11h15M11 3.5c2.4 2.2 2.4 12.8 0 15M11 3.5c-2.4 2.2-2.4 12.8 0 15" /></svg>
const SearchIcon = () => <svg {...common}><circle cx="10" cy="10" r="6" /><path d="m14.6 14.6 3.6 3.6" /></svg>
// Symmetric plus: both strokes cross at the exact centre of the 22×22 box, block display so no baseline offset.
const PlusIcon = () => <svg {...common} width={20} height={20} strokeWidth={1.7} className="block"><path d="M11 4.5v13M4.5 11h13" /></svg>

export function FloatingNav() {
  const { pathname } = useLocation()
  const { openSave } = useUI()
  const homeOn = pathname === '/home' || pathname.startsWith('/routines') || pathname.startsWith('/kabinet') || pathname.startsWith('/collections')
  const exploreOn = pathname === '/' || pathname === '/saved' || pathname.startsWith('/explore') || pathname.startsWith('/look/') || pathname.startsWith('/s/')
  const item = (on: boolean) => cx('flex h-[44px] w-[44px] items-center justify-center rounded-full transition-colors duration-(--motion-fast)', on ? 'text-foreground' : 'text-nav-muted')
  return (
    <nav aria-label="Primary" className="app-nav pointer-events-none fixed inset-x-0 z-40 flex items-end justify-center gap-[12px] sm:hidden" style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto flex h-[56px] items-center gap-[2px] rounded-full bg-surface/95 px-[8px] shadow-toolbar ring-1 ring-border/80 backdrop-blur-[3px]">
        <Link to="/home" aria-label="Home" aria-current={homeOn ? 'page' : undefined} className={item(homeOn)}><HomeIcon /></Link>
        <Link to="/explore" aria-label="Explore" aria-current={exploreOn ? 'page' : undefined} className={item(exploreOn)}><ExploreIcon /></Link>
        <button type="button" onClick={() => openSave()} aria-label="Add to KABINET" className="ml-[2px] grid h-[40px] w-[40px] place-items-center rounded-full bg-accent p-0 leading-none text-accent-foreground transition-transform duration-(--motion-fast) ease-soft active:scale-95">
          <PlusIcon />
        </button>
      </div>
      <Link to="/search" aria-label="Search" className="pointer-events-auto flex h-[56px] w-[56px] items-center justify-center rounded-full bg-surface/95 text-foreground shadow-toolbar ring-1 ring-border/80 backdrop-blur-[3px]">
        <SearchIcon />
      </Link>
    </nav>
  )
}
