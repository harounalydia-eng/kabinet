import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from '../lib/cx'

export interface HeaderProps {
  eyebrow?: string
  title: string
  sub?: string
  /** Route for the “←” affordance the file uses on nested screens. */
  back?: string
  onBack?: () => void
  right?: ReactNode
  className?: string
}

/** Page introduction — orients, never the hero. Eyebrow 12 semibold · title 28 (24 on tablets; on phones the title lives in the utility bar, so it is visually hidden here) · 8px between · 20px to what follows. */
export function Header({ eyebrow, title, sub, back, onBack, right, className }: HeaderProps) {
  const hasBack = back || onBack
  return (
    <header className={cx('flex flex-col gap-[4px] pt-[4px] pb-[14px] sm:pb-[20px] lg:pt-[8px]', className)}>
      {hasBack && (
        <div className="mb-[2px] max-sm:hidden">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Back" className="type-h2 font-normal text-foreground">←</button>
          ) : (
            <Link to={back!} aria-label="Back" className="type-h2 font-normal text-foreground">←</Link>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-md">
        <div className="flex min-w-0 flex-col gap-[8px]">
          {eyebrow && <p className="m-0 text-[12px] leading-[1.25] font-semibold tracking-[0.06em] uppercase text-muted-foreground">{eyebrow}</p>}
          <h1 className="m-0 type-title text-foreground max-md:text-[24px] max-sm:sr-only">{title}</h1>
          {sub && <p className="m-0 -mt-[2px] max-w-[440px] type-body-sm text-muted-foreground">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}
