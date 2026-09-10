import { ContextualSearch } from './ContextualSearch'
import { KabinetLogo } from './KabinetLogo'
import { ProfileMenu } from './ProfileMenu'
import { SectionMenu } from './SectionMenu'
import { useUI } from '../lib/ui'

/* Breakpoints follow the Tailwind tokens already in use: sm 640 · lg 1024. */

/**
 * One header, three intentional layouts, all flex — no absolute positioning.
 *   desktop ≥1024: K · current section ⌄ · search · add · avatar   (64px)
 *   tablet 640–1023: K · current section ⌄ · search · avatar      (60px)
 *   phone <640:      K · ───────────────────────────── · avatar   (56px, bottom bar navigates)
 * The K is always the first flex child, the avatar always the last.
 */
export function GlobalHeader() {
  const { openSave } = useUI()
  return (
    <header className="app-nav sticky top-0 z-40 flex h-[56px] items-center justify-between gap-md bg-background px-lg sm:h-[60px] lg:h-[64px] lg:gap-lg lg:px-8">
      {/* Left: brand, then context */}
      <div className="flex min-w-0 shrink-0 items-center gap-md">
        {/* One K, sized by breakpoint: 24 on phones and tablets, 28 on desktop */}
        <KabinetLogo to="/" markClassName="h-[24px] lg:h-[28px]" />
        <SectionMenu className="hidden sm:block" />
      </div>

      {/* Centre: search — tablet and up. Phones reach Search from the bottom bar. */}
      <ContextualSearch className="hidden min-w-0 flex-1 sm:flex sm:max-w-[360px] lg:max-w-[480px]" />

      {/* Right: utilities, then avatar */}
      <div className="flex shrink-0 items-center gap-[6px]">
        <button
          type="button"
          onClick={() => openSave()}
          aria-label="Add to your world"
          title="Add to your world"
          className="hidden h-[34px] w-[34px] items-center justify-center rounded-full bg-surface text-foreground transition-transform duration-(--motion-fast) ease-soft active:scale-[0.96] lg:flex"
        >
          <span aria-hidden="true" className="-mt-[1px] text-[20px] leading-none font-normal">+</span>
        </button>
        <ProfileMenu />
      </div>
    </header>
  )
}
