import { useNavigate } from 'react-router'

/** Phone utility header: back arrow, centred title. Not the discovery composition. */
export function UtilityTop({ title, onBack }: { title: string; onBack?: () => void }) {
  const nav = useNavigate()
  const back = onBack ?? (() => (window.history.length > 1 ? nav(-1) : nav('/', { viewTransition: true })))
  return (
    <div className="sticky top-0 z-30 flex h-[52px] items-center bg-background px-[8px] sm:hidden">
      <button type="button" onClick={back} aria-label="Back" className="flex h-[40px] w-[40px] items-center justify-center rounded-full text-foreground">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" /></svg>
      </button>
      <h1 className="m-0 flex-1 truncate text-center type-h3 text-foreground">{title}</h1>
      <span className="w-[40px]" aria-hidden="true" />
    </div>
  )
}

/** Centred title for the phone utility bar, derived from the route. */
export function utilityTitle(pathname: string, search: string): string {
  if (pathname === '/collections') return 'Collections'
  if (pathname.startsWith('/collections/')) return 'Collection'
  if (pathname === '/kabinet') return 'My Kabinet'
  if (pathname === '/shop') return 'Shop'
  if (pathname === '/routines') return 'Routines'
  if (pathname === '/routines/new') return 'New routine'
  if (pathname.endsWith('/edit')) return search.includes('review=1') ? 'Review routine' : 'Edit routine'
  if (pathname.endsWith('/start')) return 'Routine'
  if (pathname.startsWith('/routines/')) return 'Routine'
  if (pathname.startsWith('/s/')) return 'Saved'
  if (pathname.startsWith('/look/')) return 'Look'
  if (pathname.startsWith('/product/')) return 'Product'
  if (pathname === '/profile') return 'Profile'
  if (pathname === '/settings') return 'Settings'
  return 'KABINET'
}
