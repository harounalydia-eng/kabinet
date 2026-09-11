import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { OnboardingShell, StepTitle, TextAction } from '../../components/onboarding/OnboardingShell'
import { ShortcutFlow } from '../../components/ShortcutFlow'
import { useAccount } from '../../lib/account'

/** Why the Shortcut matters — before a single technical word. */
export default function ShortcutIntro() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const replay = params.get('replay') === '1'
  const { advance, complete, onboarded } = useAccount()

  useEffect(() => {
    void advance('shortcut')
  }, [advance])

  async function skip() {
    if (!onboarded) await complete()
    nav('/home', { replace: true })
  }

  return (
    <OnboardingShell
      back={replay ? '/settings' : '/onboarding/intents'}
      footer={
        <>
          <Button variant="primary" onClick={() => nav(`/onboarding/connect${replay ? '?replay=1' : ''}`)}>Add KABINET Shortcut</Button>
          <TextAction onClick={() => void skip()}>{replay ? 'Back to my Kabinet' : 'Skip for now'}</TextAction>
        </>
      }
    >
      <div className="flex flex-col gap-[28px]">
        <StepTitle
          title={
            <>
              Save to KABINET
              <br />
              from anywhere.
            </>
          }
          sub={
            <>
              <span className="text-foreground">Found something you want to keep?</span>
              <br />
              Send TikToks, Reels, YouTube videos and links straight to your Kabinet without leaving the app you’re browsing.
            </>
          }
        />
        <ShortcutFlow className="max-w-[300px]" />
      </div>
    </OnboardingShell>
  )
}
