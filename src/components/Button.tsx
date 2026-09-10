import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../lib/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  on?: 'canvas' | 'surface'
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'text-foreground',
  ghost: 'text-muted-foreground',
  accent: 'bg-accent text-accent-foreground',
}

/** Figma: 345×54 pill. One primary per view. */
export function Button({ variant = 'primary', on = 'canvas', className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'flex h-[54px] w-full items-center justify-center rounded-full px-lg type-body font-semibold whitespace-nowrap',
        'transition-[transform,opacity,background-color] duration-(--motion-fast) ease-soft active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100',
        VARIANT[variant],
        variant === 'secondary' && (on === 'canvas' ? 'bg-surface' : 'bg-background'),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
