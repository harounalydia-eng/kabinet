import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { OnboardingShell, StepTitle } from '../../components/onboarding/OnboardingShell'
import { useAccount } from '../../lib/account'
import { cx } from '../../lib/cx'
import { useProfile } from '../../lib/profile'
import { CATEGORIES, type Category } from '../../lib/types'

/** Selectable tile — soft control, ink when chosen. */
export function ChoiceTile({ label, selected, onClick, className }: { label: string; selected: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'flex h-[56px] items-center justify-between rounded-tile-sm px-[18px] type-body font-medium transition-colors duration-(--motion-fast) ease-soft',
        selected ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground',
        className,
      )}
    >
      <span>{label}</span>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" /></svg>
      )}
    </button>
  )
}

/** Personalization, part one: which worlds this Kabinet is for. */
export default function Worlds() {
  const nav = useNavigate()
  const { account, update, advance } = useAccount()
  const { update: updateProfile } = useProfile()
  const [worlds, setWorlds] = useState<Category[]>(account.worlds)
  const [busy, setBusy] = useState(false)

  const toggle = (c: Category) => setWorlds((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  async function next() {
    setBusy(true)
    await update({ worlds })
    updateProfile({ interests: worlds }) // the Beauty Profile shows the same choice
    await advance('intents')
    nav('/onboarding/intents')
  }

  return (
    <OnboardingShell footer={<Button variant="primary" disabled={worlds.length === 0 || busy} onClick={() => void next()}>Continue</Button>}>
      <div className="flex flex-col gap-[28px]">
        <StepTitle title="What belongs in your Kabinet?" sub="Choose what you want to save and organize. You can change this anytime." />
        <div className="grid grid-cols-2 gap-[8px]">
          {CATEGORIES.map((c) => (
            <ChoiceTile key={c} label={c} selected={worlds.includes(c)} onClick={() => toggle(c)} />
          ))}
        </div>
      </div>
    </OnboardingShell>
  )
}
