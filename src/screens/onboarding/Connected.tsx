import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { ImageView } from '../../components/ImageView'
import { OnboardingShell, StepTitle, TextAction } from '../../components/onboarding/OnboardingShell'
import { HowToSave } from '../../components/ShortcutFlow'
import { useAccount } from '../../lib/account'
import { PLATFORM_LABEL } from '../../lib/social/platform'
import { useStore } from '../../lib/store'

/** After the first save landed: the proof, three lines, and the door to Home. */
export default function Connected() {
  const nav = useNavigate()
  const { state } = useLocation() as { state: { saveId?: string } | null }
  const [params] = useSearchParams()
  const replay = params.get('replay') === '1'
  const { advance, complete } = useAccount()
  const { saves } = useStore()

  useEffect(() => {
    void advance('connected')
  }, [advance])

  const save = useMemo(() => (state?.saveId ? saves.find((s) => s.id === state.saveId) : undefined) ?? [...saves].filter((s) => s.social).sort((a, b) => b.createdAt - a.createdAt)[0], [saves, state])

  async function done() {
    await complete()
    nav('/home', { replace: true })
  }

  return (
    <OnboardingShell
      footer={
        save ? (
          <Button variant="primary" onClick={() => void done()}>Go to my Kabinet</Button>
        ) : (
          <>
            <Button variant="primary" onClick={() => nav(`/onboarding/connect${replay ? '?replay=1' : ''}`)}>Try your first save</Button>
            <TextAction onClick={() => void done()}>Go to my Kabinet</TextAction>
          </>
        )
      }
    >
      <div className="flex flex-col gap-[28px]">
        <StepTitle title="You’re connected." sub={save ? 'Your first save is in. From now on it takes three taps.' : 'Your Shortcut knows this Kabinet.'} />

        {save && (
          <div className="flex items-center gap-[14px] rounded-tile-sm bg-surface p-[10px] pr-[16px]">
            <div className="w-[96px] shrink-0 overflow-hidden rounded-content">
              <ImageView image={save.image} />
            </div>
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className="type-eyebrow text-accent-text">Saved ✓</span>
              <span className="line-clamp-2 type-body font-medium text-foreground">{save.title ?? (save.social ? PLATFORM_LABEL[save.social.platform] : 'Saved')}</span>
              {save.social?.creatorName && <span className="type-meta text-muted-foreground">{save.social.creatorName}</span>}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-[14px]">
          <p className="m-0 type-eyebrow text-muted-foreground">To save something</p>
          <HowToSave />
          <p className="m-0 type-body-sm text-muted-foreground">Saved content appears in Recently saved.</p>
        </div>
      </div>
    </OnboardingShell>
  )
}
