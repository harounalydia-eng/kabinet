import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { OnboardingShell, StepTitle, TextAction } from '../../components/onboarding/OnboardingShell'
import { useAccount } from '../../lib/account'
import { useAuth } from '../../lib/auth'
import { cx } from '../../lib/cx'
import { EXAMPLE_TUTORIAL, formatCountdown, shortcutInstallIsFile, shortcutInstallUrl, usePairing } from '../../lib/shortcut'
import { importEnabled, requestInboxSync } from '../../lib/social/inbox'
import { useStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'

function Num({ n }: { n: number }) {
  return <span className="w-[20px] shrink-0 type-meta tabular-nums text-muted-foreground">{n}</span>
}

/**
 * Install, connect, try. The Shortcut is the same for everyone; the first time it runs it asks
 * for the code on this screen and exchanges it for a private token. "Connected" and "Saved"
 * appear only when the server has really seen them.
 */
export default function Connect() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const replay = params.get('replay') === '1'
  const { user } = useAuth()
  const { advance, complete, onboarded } = useAccount()
  const { saves } = useStore()
  const enabled = importEnabled()
  const { pairing, remaining, expired, connected, error, refresh } = usePairing(enabled)
  const mountedAt = useRef(Date.now())
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    void advance('connect')
  }, [advance])

  // The proof: a social save that arrived after this screen opened.
  const firstSave = useMemo(() => saves.find((s) => s.social && s.createdAt >= mountedAt.current - 2000), [saves])
  useEffect(() => {
    if (firstSave) nav(`/onboarding/connected${replay ? '?replay=1' : ''}`, { replace: true, state: { saveId: firstSave.id } })
  }, [firstSave, nav, replay])

  // A row landing in the inbox → pull it right away instead of waiting for the next focus.
  useEffect(() => {
    if (!supabase || !user) return
    const channel = supabase.channel(`inbox-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'import_inbox', filter: `user_id=eq.${user.id}` }, () => requestInboxSync())
    channel.subscribe()
    const poll = setInterval(() => requestInboxSync(), 6000)
    const t = setTimeout(() => setWaited(true), 20_000)
    return () => {
      clearInterval(poll)
      clearTimeout(t)
      void supabase!.removeChannel(channel)
    }
  }, [user])

  async function skip() {
    if (!onboarded) await complete()
    nav('/home', { replace: true })
  }

  if (!enabled) {
    return (
      <OnboardingShell back="/onboarding/shortcut" footer={<Button variant="primary" onClick={() => void skip()}>Go to my Kabinet</Button>}>
        <StepTitle title="Saving from other apps is not switched on in this build." sub="The Shortcut needs the server connection. Everything else in KABINET works on this device." />
      </OnboardingShell>
    )
  }

  const installUrl = shortcutInstallUrl()
  return (
    <OnboardingShell back={replay ? '/settings' : '/onboarding/shortcut'} footer={<TextAction onClick={() => void skip()}>{replay ? 'Back to my Kabinet' : 'Skip for now'}</TextAction>}>
      <div className="flex flex-col gap-[28px]">
        <StepTitle title="Add the Shortcut." sub="Three short steps. You only do this once." />

        <ol className="m-0 flex list-none flex-col gap-[22px] p-0">
          {/* 1 · Add */}
          <li className="flex flex-col gap-[12px]">
            <div className="flex items-baseline gap-[10px]">
              <Num n={1} />
              <span className="type-h3 text-foreground">Add it to Shortcuts</span>
            </div>
            <a href={installUrl} target={shortcutInstallIsFile() ? undefined : '_blank'} rel="noreferrer" className="flex h-[54px] w-full items-center justify-center rounded-full bg-primary px-lg type-body font-semibold text-primary-foreground transition-transform duration-(--motion-fast) ease-soft active:scale-[0.99]">
              Add KABINET Shortcut
            </a>
            <p className="m-0 pl-[30px] type-body-sm text-muted-foreground">
              {shortcutInstallIsFile() ? 'The Shortcut downloads. Open it and tap Add Shortcut, then come back here.' : 'Apple Shortcuts opens. Tap Add Shortcut, then come back here.'}
            </p>
          </li>

          {/* 2 · Code */}
          <li className="flex flex-col gap-[12px]">
            <div className="flex items-baseline gap-[10px]">
              <Num n={2} />
              <span className="type-h3 text-foreground">Your code</span>
            </div>
            <div className={cx('flex flex-col gap-[6px] rounded-tile-sm px-[18px] py-[16px]', connected ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground')}>
              {connected ? (
                <>
                  <span className="type-eyebrow opacity-80">Connected</span>
                  <span className="type-h3">Your Shortcut knows this Kabinet.</span>
                </>
              ) : pairing && !expired ? (
                <>
                  <span className="text-[30px] leading-none font-semibold tracking-[0.22em] tabular-nums" aria-label={`Code ${pairing.code.split('').join(' ')}`}>{pairing.code}</span>
                  <span className="type-meta text-muted-foreground">Expires in {formatCountdown(remaining)}</span>
                </>
              ) : (
                <div className="flex items-center justify-between gap-md">
                  <span className="type-body text-muted-foreground">{error ?? (pairing ? 'This code expired.' : 'Getting your code…')}</span>
                  {(error || expired) && <button type="button" onClick={() => void refresh()} className="type-body-sm font-medium text-foreground">New code</button>}
                </div>
              )}
            </div>
            {!connected && <p className="m-0 pl-[30px] type-body-sm text-muted-foreground">The first time you save something, the Shortcut asks for this code. Once.</p>}
          </li>

          {/* 3 · Try */}
          <li className="flex flex-col gap-[12px]">
            <div className="flex items-baseline gap-[10px]">
              <Num n={3} />
              <span className="type-h3 text-foreground">Try your first save</span>
            </div>
            <a href={EXAMPLE_TUTORIAL.url} target="_blank" rel="noreferrer" className="flex items-center gap-[14px] rounded-tile-sm bg-surface p-[10px] pr-[16px]">
              <img src={EXAMPLE_TUTORIAL.poster} alt="" width={96} height={72} className="aspect-[4/3] w-[96px] shrink-0 rounded-content object-cover" />
              <span className="flex min-w-0 flex-col gap-[2px]">
                <span className="truncate type-body font-medium text-foreground">{EXAMPLE_TUTORIAL.title}</span>
                <span className="type-meta text-muted-foreground">{EXAMPLE_TUTORIAL.creator} · YouTube</span>
                <span className="pt-[2px] type-meta font-medium text-foreground">Open in YouTube →</span>
              </span>
            </a>
            <p className="m-0 pl-[30px] type-body-sm text-muted-foreground">Tap Share → Save to KABINET. Any TikTok, Reel or video works too.</p>
            <div className="flex flex-col gap-[8px] pl-[30px]" aria-live="polite">
              <div className="relative h-px overflow-hidden bg-border" aria-hidden="true">
                <span className="indeterminate absolute inset-y-0 w-1/3 bg-foreground" />
              </div>
              <span className="type-meta text-muted-foreground">
                {connected ? 'Connected. Waiting for your first save…' : 'Waiting for your first save…'}
                {waited && !connected && ' Nothing yet — it appears here the moment it arrives.'}
              </span>
            </div>
          </li>
        </ol>
      </div>
    </OnboardingShell>
  )
}
