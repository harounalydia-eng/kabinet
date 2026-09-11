import { Outlet, useLocation } from 'react-router'
import { GlobalHeader } from './Toolbar'
import { FloatingNav } from './mobile/FloatingNav'
import { UtilityTop, utilityTitle } from './mobile/UtilityTop'
import { usePhone } from './mobile/usePhone'
import { SaveSheet } from './SaveSheet'
import { cx } from '../lib/cx'

const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document

/** Page frame for the app proper: canvas, desktop top bar, phone toolbar, the save sheet. (The launch splash and the route gate live in App.) */
export function Shell() {
  const { pathname, search } = useLocation()
  const phone = usePhone()
  const ownTop = phone && (pathname === '/' || pathname === '/saved' || pathname === '/explore' || pathname === '/home' || pathname === '/search')
  return (
    <div className="min-h-dvh bg-background">
      {phone ? !ownTop && <UtilityTop title={utilityTitle(pathname, search)} /> : <GlobalHeader />}
      <main className="app-content mx-auto w-full max-w-[1440px] px-(--mobile-page-gutter) pb-[calc(120px+env(safe-area-inset-bottom))] sm:px-lg lg:px-8 lg:pb-3xl">
        {/* Route changes cross-fade via the View Transitions API where available; otherwise a soft page fade. */}
        <div key={pathname} className={cx(!supportsViewTransitions && 'page-enter')}>
          <Outlet />
        </div>
      </main>
      <FloatingNav />
      <SaveSheet />
    </div>
  )
}
