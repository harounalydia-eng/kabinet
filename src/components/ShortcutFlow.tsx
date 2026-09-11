import { cx } from '../lib/cx'

const STEPS: Array<{ label: string; sub?: string; done?: boolean }> = [
  { label: 'TikTok · Instagram · YouTube', sub: 'Anything you want to keep' },
  { label: 'Share' },
  { label: 'Save to KABINET' },
  { label: 'Saved ✓', done: true },
]

/**
 * The four-beat picture of saving from another app. Content is sharp, controls are soft:
 * each beat is a soft surface cell; the last one is the oxblood confirmation.
 */
export function ShortcutFlow({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <ol className={cx('m-0 flex list-none flex-col items-stretch p-0', className)} aria-label="How saving works">
      {STEPS.map((s, i) => (
        <li key={s.label} className="flex flex-col items-center">
          {i > 0 && (
            <span aria-hidden="true" className={cx('flex flex-col items-center text-muted-foreground', compact ? 'h-[18px]' : 'h-[26px]')}>
              <span className="w-px flex-1 bg-border" />
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4" /></svg>
            </span>
          )}
          <div
            className={cx(
              'flex w-full flex-col items-center justify-center rounded-tile-sm text-center',
              compact ? 'min-h-[44px] px-[14px] py-[10px]' : 'min-h-[56px] px-[16px] py-[12px]',
              s.done ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground',
            )}
          >
            <span className={cx(compact ? 'type-body-sm' : 'type-body', 'font-semibold')}>{s.label}</span>
            {s.sub && !compact && <span className="type-meta text-muted-foreground">{s.sub}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The three-line reminder used after connecting and in Settings. */
export function HowToSave({ className }: { className?: string }) {
  const rows = ['Tap Share', 'Choose Save to KABINET', 'That’s it.']
  return (
    <ol className={cx('m-0 flex list-none flex-col gap-[10px] p-0', className)}>
      {rows.map((r, i) => (
        <li key={r} className="flex items-baseline gap-[14px]">
          <span className="w-[16px] shrink-0 type-meta tabular-nums text-muted-foreground">{i + 1}</span>
          <span className="type-body text-foreground">{r}</span>
        </li>
      ))}
    </ol>
  )
}
