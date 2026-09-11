import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { OnboardingShell, StepTitle, TextAction } from '../../components/onboarding/OnboardingShell'
import { useAuth } from '../../lib/auth'

const AppleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.9c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.8 2.3 1.1 0 1.6-.7 2.9-.7 1.4 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.2 1.2-2.4 1.2-2.5 0 0-2.3-.9-2.3-3.7zM14.2 6.3c.6-.7 1-1.7.9-2.8-.9 0-2 .6-2.6 1.4-.6.6-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3z" /></svg>
)
const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.1 3.5-8.7z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24z" /><path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" /><path fill="#EA4335" d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1C6.3 6.8 8.9 4.7 12 4.7z" /></svg>
)

/**
 * One screen for creating a Kabinet and for coming back: an email, then the code from the
 * inbox. Apple and Google only appear when the project has actually switched them on.
 */
export default function Auth({ mode }: { mode: 'create' | 'signin' }) {
  const { providers, sendCode, verifyCode, signInWith } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  async function onSend(e?: FormEvent) {
    e?.preventDefault()
    const addr = email.trim()
    if (!addr) return
    setBusy(true)
    setError(null)
    const err = await sendCode(addr)
    setBusy(false)
    if (err) return setError(err)
    setStage('code')
    setResendIn(30)
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await verifyCode(email.trim(), code.replace(/\s+/g, ''))
    setBusy(false)
    if (err) setError(err)
    // On success the session arrives and the route guard moves on.
  }

  async function onProvider(p: 'apple' | 'google') {
    setError(null)
    const err = await signInWith(p)
    if (err) setError(err)
  }

  const social = providers.apple || providers.google
  const create = mode === 'create'

  if (stage === 'code') {
    return (
      <OnboardingShell back={() => { setStage('email'); setCode(''); setError(null) }}>
        <form onSubmit={onVerify} className="flex flex-col gap-[28px]">
          <StepTitle title="Check your inbox." sub={<>We sent a 6-digit code to <span className="text-foreground">{email.trim()}</span>. If the email carries a link instead, tapping it also signs you in.</>} />
          <Field
            label="Code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 8))}
            className="[&_input]:tracking-[0.25em] [&_input]:tabular-nums"
          />
          {error && <p className="m-0 -mt-[12px] type-body-sm text-accent-text" role="alert">{error}</p>}
          <div className="flex flex-col gap-[10px]">
            <Button type="submit" variant="primary" disabled={busy || code.replace(/\s+/g, '').length < 6}>{busy ? 'Checking…' : 'Continue'}</Button>
            <TextAction onClick={() => void onSend()} className={resendIn > 0 ? 'pointer-events-none opacity-60' : undefined}>
              {resendIn > 0 ? `Send again in ${resendIn}s` : 'Send a new code'}
            </TextAction>
          </div>
        </form>
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell
      back="/welcome"
      footer={
        <p className="m-0 text-center type-body-sm text-muted-foreground">
          {create ? 'Already have a Kabinet? ' : 'New here? '}
          <Link to={create ? '/signin' : '/create'} className="font-medium text-foreground">{create ? 'Sign in' : 'Create your Kabinet'}</Link>
        </p>
      }
    >
      <div className="flex flex-col gap-[28px]">
        <StepTitle title={create ? 'Create your Kabinet' : 'Welcome back.'} sub={create ? 'Your email is all it takes. We send a code — nothing to remember.' : 'Enter the email you used. We send a code.'} />

        {social && (
          <div className="flex flex-col gap-[10px]">
            {providers.apple && (
              <Button variant="secondary" onClick={() => void onProvider('apple')} className="gap-[10px]"><AppleGlyph />Continue with Apple</Button>
            )}
            {providers.google && (
              <Button variant="secondary" onClick={() => void onProvider('google')} className="gap-[10px]"><GoogleGlyph />Continue with Google</Button>
            )}
            <div className="flex items-center gap-[12px] py-[6px]" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="type-meta text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <form onSubmit={onSend} className="flex flex-col gap-[16px]">
          <Field label="Email" type="email" inputMode="email" autoComplete="email" autoFocus={!social} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="m-0 type-body-sm text-accent-text" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Continue'}</Button>
        </form>
      </div>
    </OnboardingShell>
  )
}
