import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../lib/cx'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  /** The background the chip sits on; the unselected fill is one step off it. */
  on?: 'canvas' | 'surface'
}

/** Pill filter/choice. Selected = ink. No borders, as in the file. */
export function Chip({ selected = false, on = 'canvas', className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'inline-flex h-[36px] shrink-0 items-center rounded-full px-[14px] type-body-sm font-medium whitespace-nowrap transition-colors duration-(--motion-standard) ease-soft',
        selected ? 'bg-primary text-primary-foreground' : on === 'canvas' ? 'bg-surface text-foreground' : 'bg-background text-foreground',
        'disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
