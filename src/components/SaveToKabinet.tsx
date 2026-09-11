import { useState } from 'react'
import { Link } from 'react-router'
import { HowToSave } from './ShortcutFlow'
import { cx } from '../lib/cx'
import { formatCountdown, relativeTime, shortcutInstallUrl, usePairing, useTokens } from '../lib/shortcut'
import { importEnabled, requestInboxSync, revokeAllTokens } from '../lib/social/inbox'

function Action({ label, onClick, tone = 'ink', href }: { label: string; onClick?: () => void; tone?: 'ink' | 'secondary'; href?: string }) {
  const cls = cx('w-fit py-[6px] type-body font-medium', tone === 'secondary' ? 'text-muted-foreground' : 'text-foreground')
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{label}</a>
  return <button type="button" onClick={onClick} className={cls}>{label}</button>
}

/**
 * Settings → Save to KABINET. Status is only what the server can vouch for: a connection exists,
 * and when it last saved. Installation on the phone itself cannot be known, so it is never claimed.
 */
export function SaveToKabinet() {
  const enabled = importEnabled()
  const { active, lastUsed, loading, reload } = useTokens()
  const [showCode, setShowCode] = useState(false)
  const [showHow, setShowHow] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [checked, setChecked] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const { pairing, remaining, expired, connected, error, refresh } = usePairing(enabled && showCode)

  if (!enabled) {
    return (
      <section className="flex flex-col gap-2xs">
        <p className="m-0 mb-xs type-eyebrow text-muted-foreground">Save to KABINET</p>
        <p className="m-0 type-body-sm text-muted-foreground">Saving from other apps needs the server connection, which is not switched on in this build.</p>
      </section>
    )
  }

  const state = loading ? 'Checking…' : active.length === 0 ? 'Not connected' : lastUsed ? `Connected · last save ${relativeTime(lastUsed)}` : 'Connected · nothing saved yet'

  return (
    <section className="flex flex-col gap-sm">
      <p className="m-0 type-eyebrow text-muted-foreground">Save to KABINET</p>
      <div className="flex items-center justify-between gap-md">
        <span className="type-body text-foreground">iPhone Shortcut</span>
        <span className={cx('type-meta', active.length ? 'text-foreground' : 'text-muted-foreground')}>{state}</span>
      </div>
      <p className="m-0 type-body-sm text-muted-foreground">Share a TikTok, Reel or YouTube video to Save to KABINET and it lands in Recently saved.</p>

      <div className="flex flex-col gap-2xs">
        <Action label={active.length ? 'Reinstall Shortcut' : 'Install Shortcut'} href={shortcutInstallUrl()} />
        <Action label={showCode ? 'Hide my code' : active.length ? 'Connect another iPhone' : 'Show my code'} onClick={() => setShowCode((v) => !v)} />
        {showCode && (
          <div className={cx('my-[6px] flex flex-col gap-[6px] rounded-tile-sm px-[18px] py-[14px]', connected ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground')}>
            {connected ? (
              <span className="type-body font-medium">Connected. The Shortcut is ready.</span>
            ) : pairing && !expired ? (
              <>
                <span className="text-[26px] leading-none font-semibold tracking-[0.22em] tabular-nums">{pairing.code}</span>
                <span className="type-meta text-muted-foreground">Enter it when the Shortcut asks · expires in {formatCountdown(remaining)}</span>
              </>
            ) : (
              <div className="flex items-center justify-between gap-md">
                <span className="type-body-sm text-muted-foreground">{error ?? (pairing ? 'This code expired.' : 'Getting your code…')}</span>
                {(error || expired) && <button type="button" onClick={() => void refresh()} className="type-body-sm font-medium text-foreground">New code</button>}
              </div>
            )}
          </div>
        )}
        <Action label={showHow ? 'Hide instructions' : 'How to save from apps'} onClick={() => setShowHow((v) => !v)} />
        {showHow && (
          <div className="my-[6px] flex flex-col gap-[10px] rounded-tile-sm bg-surface px-[18px] py-[14px]">
            <HowToSave />
            <p className="m-0 type-body-sm text-muted-foreground">The first time, the Shortcut asks for your code from this page. <Link to="/onboarding/shortcut?replay=1" className="font-medium text-foreground">See the introduction again</Link>.</p>
          </div>
        )}
        <Action label={checked ? 'Checking…' : 'Check for new saves'} tone="secondary" onClick={() => { requestInboxSync(); setChecked(true); setTimeout(() => setChecked(false), 2000) }} />
        {active.length > 0 &&
          (!confirmDisconnect ? (
            <Action label="Disconnect Shortcut" tone="secondary" onClick={() => setConfirmDisconnect(true)} />
          ) : (
            <div className="flex flex-wrap items-center gap-lg py-[6px]">
              <span className="type-body-sm text-muted-foreground">The Shortcut on your phone stops working until you connect it again.</span>
              <button
                type="button"
                onClick={() => void revokeAllTokens().then(() => { setConfirmDisconnect(false); setStatus('Disconnected.'); void reload() }).catch((e: Error) => setStatus(e.message))}
                className="type-body font-medium text-accent-text"
              >
                Disconnect
              </button>
              <button type="button" onClick={() => setConfirmDisconnect(false)} className="type-body font-medium text-foreground">Keep</button>
            </div>
          ))}
        {status && <p className="m-0 pt-xs type-body-sm text-muted-foreground">{status}</p>}
      </div>
    </section>
  )
}
