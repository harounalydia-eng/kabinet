import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { cx } from '../../lib/cx'

/**
 * The frame for everything before Home: welcome, account, the introduction.
 * One quiet column on the canvas — no header, no navigation, nothing to explore yet.
 * Phone first (393), centred and unchanged on larger screens.
 */
export function OnboardingShell({ back, children, footer, align = 'top', className }: { back?: string | (() => void); children: ReactNode; footer?: ReactNode; align?: 'top' | 'center'; className?: string }) {
  const nav = useNavigate()
  return (
    <div className="flex min-h-dvh flex-col bg-background px-[24px] pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(20px+env(safe-area-inset-bottom))] text-foreground">
      <div className={cx('mx-auto flex w-full max-w-[393px] flex-1 flex-col', className)}>
        <div className="flex h-[44px] shrink-0 items-center">
          {back && (
            <button
              type="button"
              onClick={() => (typeof back === 'function' ? back() : nav(back))}
              aria-label="Back"
              className="-ml-[10px] flex h-[40px] w-[40px] items-center justify-center rounded-full text-foreground"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" /></svg>
            </button>
          )}
        </div>
        <div className={cx('flex flex-1 flex-col', align === 'center' ? 'justify-center' : 'pt-[16px]')}>{children}</div>
        {footer && <div className="flex shrink-0 flex-col gap-[10px] pt-[28px]">{footer}</div>}
      </div>
    </div>
  )
}

/** Heading + supporting copy, the same rhythm on every step. */
export function StepTitle({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <h1 className="m-0 type-title text-foreground" style={{ textWrap: 'balance' }}>{title}</h1>
      {sub && <p className="m-0 max-w-[34ch] type-body text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** A quiet text action under the primary button. */
export function TextAction({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('mx-auto flex h-[44px] items-center justify-center px-[16px] type-body font-medium text-muted-foreground', className)}>
      {children}
    </button>
  )
}
