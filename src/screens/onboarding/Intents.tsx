import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { OnboardingShell, StepTitle, TextAction } from '../../components/onboarding/OnboardingShell'
import { INTENTS, useAccount, type Intent } from '../../lib/account'
import { ChoiceTile } from './Worlds'

/** Personalization, part two — one light question, skippable. */
export default function Intents() {
  const nav = useNavigate()
  const { account, update, advance } = useAccount()
  const [intents, setIntents] = useState<Intent[]>(account.intents)
  const [busy, setBusy] = useState(false)

  const toggle = (i: Intent) => setIntents((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))

  async function next(save: boolean) {
    setBusy(true)
    if (save) await update({ intents })
    await advance('shortcut')
    nav('/onboarding/shortcut')
  }

  return (
    <OnboardingShell
      back="/onboarding/worlds"
      footer={
        <>
          <Button variant="primary" disabled={busy} onClick={() => void next(true)}>Continue</Button>
          <TextAction onClick={() => void next(false)}>Skip</TextAction>
        </>
      }
    >
      <div className="flex flex-col gap-[28px]">
        <StepTitle title="What do you want KABINET to help with?" sub="Pick any. This shapes what you see first." />
        <div className="flex flex-col gap-[8px]">
          {INTENTS.map((i) => (
            <ChoiceTile key={i} label={i} selected={intents.includes(i)} onClick={() => toggle(i)} />
          ))}
        </div>
      </div>
    </OnboardingShell>
  )
}
