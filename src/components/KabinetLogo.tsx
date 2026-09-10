import { Link } from 'react-router'
import { cx } from '../lib/cx'

/**
 * The KABINET brand mark: the geometric K alone, traced from the supplied
 * artwork (stem + two arms, sharp endpoints, original proportions 74:132).
 * Transparent, fill="currentColor" — it inherits the theme foreground, or the
 * oxblood token with variant="accent". Never a container, never decorated.
 */
export const K_VIEWBOX = '0 0 74 132'
export const K_PATH = 'M0 0 H10 V132 H0 Z M8 49 L60 10 L63 10 L68 16 L68 18 L15 59 L8 59 Z M8 59 L15 59 L74 106 L74 108 L69 114 L67 114 L8 69 Z'

export type LogoVariant = 'default' | 'accent'
const PRESET = { sm: 20, md: 28, lg: 48 } as const

export interface KabinetLogoProps {
  /** Height in px, or a preset. Width follows the K's own proportions. */
  size?: number | keyof typeof PRESET
  /** Size the mark with CSS instead (e.g. "h-[24px] lg:h-[28px]") — one element, responsive. */
  markClassName?: string
  variant?: LogoVariant
  /** Show the KABINET wordmark beside the icon (icon then reads as decorative). */
  wordmark?: boolean
  /** Make it a link (e.g. "/"); gets the "KABINET home" label. */
  to?: string
  className?: string
}

export function KabinetMark({ size, variant = 'default', className, decorative = false }: { size?: number; variant?: LogoVariant; className?: string; decorative?: boolean }) {
  // With a numeric size the attributes fix the box; otherwise CSS (a height class) sizes it and the viewBox keeps the ratio.
  const h = size
  const w = size ? Math.round((size * 74) / 132 * 100) / 100 : undefined
  return (
    <svg
      viewBox={K_VIEWBOX}
      width={w}
      height={h}
      style={size ? undefined : { width: 'auto' }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'KABINET'}
      className={cx('kabinet-logo block shrink-0', variant === 'accent' ? 'text-accent' : 'text-foreground', className)}
    >
      <path fill="currentColor" d={K_PATH} />
    </svg>
  )
}

export function KabinetLogo({ size = 'md', variant = 'default', wordmark = false, to, className, markClassName }: KabinetLogoProps) {
  const px = markClassName ? undefined : typeof size === 'number' ? size : PRESET[size]
  const decorative = Boolean(to) || wordmark
  const body = wordmark ? (
    <span className="flex items-center gap-[8px]">
      <KabinetMark size={px} variant={variant} className={markClassName} decorative />
      <span className={cx('type-wordmark', variant === 'accent' ? 'text-accent-text' : 'text-foreground')}>KABINET</span>
    </span>
  ) : (
    <KabinetMark size={px} variant={variant} className={markClassName} decorative={decorative} />
  )
  if (to) {
    return (
      <Link to={to} aria-label="KABINET home" className={cx('inline-flex items-center', className)}>
        {body}
      </Link>
    )
  }
  return <span className={cx('inline-flex items-center', className)}>{body}</span>
}
