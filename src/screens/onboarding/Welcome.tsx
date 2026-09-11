import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { KabinetMark } from '../../components/KabinetLogo'
import { OnboardingShell, TextAction } from '../../components/onboarding/OnboardingShell'
import { useAuth } from '../../lib/auth'

/**
 * First screen for a stranger, on the warm canvas — the lights are on.
 * The K, the name, one promise, one line. It waits under the dark entry and
 * enters only after the ivory has had a beat to breathe (see .welcome-in).
 */
export default function Welcome() {
  const nav = useNavigate()
  const { available } = useAuth()
  return (
    <OnboardingShell
      align="center"
      footer={
        <div className="welcome-in flex flex-col gap-[10px]">
          <Button variant="primary" onClick={() => nav(available ? '/create' : '/onboarding/worlds')}>Get started</Button>
          {available && <TextAction onClick={() => nav('/signin')}>I already have an account</TextAction>}
          {!available && <p className="m-0 pt-[6px] text-center type-meta text-muted-foreground">Accounts are not switched on in this build. Everything stays on this device.</p>}
        </div>
      }
    >
      <div className="welcome-in flex flex-col items-start gap-[28px] pb-[24px]">
        <div className="flex flex-col gap-[18px]">
          <KabinetMark size={56} decorative />
          <span className="type-wordmark text-foreground">KABINET</span>
        </div>
        <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-0.015em] text-foreground" style={{ textWrap: 'balance' }}>
          Know what works for you.
        </h1>
        <p className="m-0 max-w-[30ch] type-body text-muted-foreground">
          Your personal intelligence for skin, hair and the products you use.
        </p>
      </div>
    </OnboardingShell>
  )
}
