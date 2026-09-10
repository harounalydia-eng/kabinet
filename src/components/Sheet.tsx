import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'

export interface SheetProps {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}

const EXIT_MS = 220

/**
 * Bottom sheet on phones, centred panel on desktop. Elevated surface, 28px
 * hero radius, 240ms slide driven by CSS keyframes (no rAF dependency).
 */
export function Sheet({ open, onClose, label, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    setClosing(true)
    const t = setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mounted, onClose])

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-lg" data-closing={closing || undefined}>
      <div onClick={onClose} aria-hidden="true" className="sheet-backdrop absolute inset-0 bg-overlay" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cx(
          'sheet-panel relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-hero bg-surface-elevated px-lg pt-sm',
          'pb-[calc(24px+env(safe-area-inset-bottom))] lg:max-w-[520px] lg:rounded-hero lg:p-[32px]',
        )}
      >
        <div aria-hidden="true" className="mx-auto mb-lg h-[4px] w-[36px] shrink-0 rounded-full bg-muted-foreground/40 lg:hidden" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
