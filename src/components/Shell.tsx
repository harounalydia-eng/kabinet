import { Outlet, useLocation } from 'react-router'
import { GlobalHeader } from './Toolbar'
import { FloatingNav } from './mobile/FloatingNav'
import { UtilityTop, utilityTitle } from './mobile/UtilityTop'
import { usePhone } from './mobile/usePhone'
import { SaveSheet } from './SaveSheet'
import { Splash, useSplash } from './Splash'
import { useStore } from '../lib/store'
import { useInboxSync } from '../lib/social/useInboxSync'
import { cx } from '../lib/cx'

const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document

/** Page frame: canvas, desktop top bar, phone toolbar, the save sheet, the launch splash. */
export function Shell() {
  const { pathname, search } = useLocation()
  const { ready } = useStore()
  const phase = useSplash(ready)
  const phone = usePhone()
  useInboxSync()
  const ownTop = phone && (pathname === '/' || pathname === '/saved' || pathname === '/explore' || pathname === '/home' || pathname === '/search')
  return (
    <div className="min-h-dvh bg-background" data-phase={phase}>
      {phone ? !ownTop && <UtilityTop title={utilityTitle(pathname, search)} /> : <GlobalHeader />}
      <main className="app-content mx-auto w-full max-w-[1440px] px-(--mobile-page-gutter) pb-[calc(120px+env(safe-area-inset-bottom))] sm:px-lg lg:px-8 lg:pb-3xl" aria-busy={!ready}>
        {ready && (
          // Route changes cross-fade via the View Transitions API where available; otherwise a soft page fade.
          <div key={pathname} className={cx(!supportsViewTransitions && 'page-enter')}>
            <Outlet />
          </div>
        )}
      </main>
      <FloatingNav />
      <SaveSheet />
      <Splash phase={phase} />
    </div>
  )
}
