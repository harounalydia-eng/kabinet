import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { CollectionGrid } from '../components/CollectionGrid'
import { Field } from '../components/Field'
import { ImageView } from '../components/ImageView'
import { Sheet } from '../components/Sheet'
import { fromSave } from '../lib/feed'
import { GOAL_SUGGESTIONS, useProfile } from '../lib/profile'
import { useFeed, useStore } from '../lib/store'
import { CATEGORIES, type Category } from '../lib/types'
import { useUI } from '../lib/ui'

/** A dossier section: eyebrow, optional trailing link, thin divider above. */
function Section({ title, children, cta }: { title: string; children: ReactNode; cta?: { label: string; to?: string; onClick?: () => void } }) {
  const ctaClass = 'shrink-0 type-body-sm font-medium text-foreground'
  return (
    <section className="flex flex-col gap-sm border-t border-border py-lg">
      <div className="flex items-baseline justify-between gap-md">
        <h2 className="m-0 type-eyebrow text-muted-foreground">{title}</h2>
        {cta && (cta.to ? <Link to={cta.to} className={ctaClass}>{cta.label} →</Link> : <button type="button" onClick={cta.onClick} className={ctaClass}>{cta.label} →</button>)}
      </div>
      {children}
    </section>
  )
}

/** Small, quiet tag — user-declared facts, not controls. */
function Tag({ children }: { children: ReactNode }) {
  return <li className="inline-flex h-[28px] items-center rounded-full bg-surface px-[10px] type-meta text-foreground">{children}</li>
}

function Empty({ line, action, to, onClick }: { line: string; action: string; to?: string; onClick?: () => void }) {
  const cls = 'w-fit type-body-sm font-medium text-foreground'
  return (
    <div className="flex flex-col gap-[6px]">
      <p className="m-0 type-body-sm text-muted-foreground">{line}</p>
      {to ? <Link to={to} className={cls}>{action} →</Link> : <button type="button" onClick={onClick} className={cls}>{action} →</button>}
    </div>
  )
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Beauty Profile — a private dossier: who you are in beauty, what you're into, what you're working
 * toward, what you own, what you do, what you've saved. Everything shown is user-entered or counted
 * from real data. No analysis, no scanning, no social mechanics.
 */
export default function Profile() {
  const { profile, update } = useProfile()
  const { owned, routines } = useStore()
  const feed = useFeed()
  const { openSave } = useUI()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'collections' ? 'collections' : 'profile'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [goal, setGoal] = useState('')

  const counts = [
    owned.length > 0 && plural(owned.length, 'product', 'products'),
    feed.length > 0 && `${feed.length} saved`,
    routines.length > 0 && plural(routines.length, 'routine', 'routines'),
  ].filter(Boolean) as string[]
  const recent = feed.slice(0, 8).map(fromSave)
  const recentRoutines = [...routines].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)

  function openEdit() {
    setDraft(profile)
    setGoal('')
    setEditing(true)
  }
  function addGoal(g: string) {
    const t = g.trim()
    if (!t || draft.goals.includes(t)) return
    setDraft({ ...draft, goals: [...draft.goals, t] })
    setGoal('')
  }

  return (
    <div className="mx-auto w-full lg:max-w-[880px]">
      <header className="flex flex-col gap-md pt-[14px] pb-md lg:flex-row lg:items-end lg:justify-between lg:pt-[10px]">
        <div className="flex items-start gap-md">
          <span aria-hidden="true" className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-muted type-h2 text-foreground">
            {profile.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="flex flex-col gap-[4px]">
            <p className="m-0 type-eyebrow text-muted-foreground">Beauty profile</p>
            <h1 className="m-0 type-title text-foreground max-md:text-[24px]">{profile.name || 'Your beauty profile'}</h1>
            {profile.username && <p className="m-0 type-meta text-muted-foreground">@{profile.username}</p>}
            <p className="m-0 max-w-[400px] type-body-sm text-muted-foreground">Your beauty world, all in one place.</p>
            {counts.length > 0 && <p className="m-0 mt-[2px] type-meta text-foreground">{counts.join(' · ')}</p>}
          </div>
        </div>
        <button type="button" onClick={openEdit} className="inline-flex h-[36px] w-fit items-center rounded-full bg-surface px-[14px] type-body-sm font-medium text-foreground">
          Edit profile
        </button>
      </header>

      <div className="mb-md flex w-fit gap-[4px] rounded-full bg-surface p-[3px]">
        {(['profile', 'collections'] as const).map((t) => (
          <Chip key={t} selected={tab === t} onClick={() => setParams(t === 'profile' ? {} : { tab: t }, { replace: true })} className="h-[30px] px-[14px]">
            {t === 'profile' ? 'Beauty profile' : 'Collections'}
          </Chip>
        ))}
      </div>

      {tab === 'collections' ? (
        <CollectionGrid spacious />
      ) : (
        <div className="flex flex-col">
          <Section title="Your interests" cta={profile.interests.length ? { label: 'Edit interests', onClick: openEdit } : undefined}>
            {profile.interests.length === 0 ? (
              <Empty line="Choose what you're into." action="Choose interests" onClick={openEdit} />
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-[6px] p-0">
                {profile.interests.map((i) => <Tag key={i}>{i}</Tag>)}
              </ul>
            )}
          </Section>

          <Section title="Your goals" cta={profile.goals.length ? { label: 'Manage goals', onClick: openEdit } : undefined}>
            {profile.goals.length === 0 ? (
              <Empty line="No goals yet." action="Add what you want to work on" onClick={openEdit} />
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-[6px] p-0">
                {profile.goals.map((g) => <Tag key={g}>{g}</Tag>)}
              </ul>
            )}
          </Section>

          <Section title="Your Kabinet" cta={owned.length ? { label: 'View all', to: '/kabinet' } : undefined}>
            {owned.length === 0 ? (
              <Empty line="Nothing on your shelf yet." action="Add a product" to="/kabinet?add=1" />
            ) : (
              <div className="flex flex-col gap-sm">
                <div className="no-scrollbar -mx-(--mobile-page-gutter) flex gap-[6px] overflow-x-auto px-(--mobile-page-gutter) sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-[10px] sm:overflow-visible sm:px-0 lg:grid-cols-6">
                  {owned.slice(0, 6).map((o, i) => (
                    <Link key={o.id} to="/kabinet" className={i >= 4 ? 'hidden w-[104px] shrink-0 flex-col gap-[6px] sm:w-auto lg:flex' : 'flex w-[104px] shrink-0 flex-col gap-[6px] sm:w-auto'}>
                      <div className="aspect-[3/4] overflow-hidden rounded-content bg-muted">{o.image && <ImageView fill image={o.image} />}</div>
                      <span className="truncate type-meta text-foreground">{o.productName}</span>
                    </Link>
                  ))}
                </div>
                <p className="m-0 type-meta text-muted-foreground">{plural(owned.length, 'product', 'products')}</p>
              </div>
            )}
          </Section>

          <Section title="Your routines" cta={routines.length ? { label: 'View all', to: '/routines' } : undefined}>
            {routines.length === 0 ? (
              <div className="flex flex-col gap-[6px]">
                <p className="m-0 type-body text-foreground">No routines yet.</p>
                <p className="m-0 type-body-sm text-muted-foreground">Save a beauty tutorial and turn it into a routine.</p>
                <button type="button" onClick={() => openSave()} className="w-fit type-body-sm font-medium text-foreground">Import tutorial →</button>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0 sm:grid sm:grid-cols-2 sm:gap-x-lg">
                {recentRoutines.map((r) => (
                  <li key={r.id}>
                    <Link to={`/routines/${r.id}`} viewTransition className="flex items-center gap-sm py-[8px]">
                      <div className="h-[72px] w-[58px] shrink-0 overflow-hidden rounded-content bg-muted">
                        {r.sourceThumbnail && <ImageView fill image={r.sourceThumbnail} />}
                      </div>
                      <div className="flex min-w-0 flex-col gap-[3px]">
                        <p className="m-0 truncate type-h3 text-foreground">{r.title || 'Untitled routine'}</p>
                        <p className="m-0 type-eyebrow text-muted-foreground">{r.category} · {plural(r.steps.length, 'step', 'steps')}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recently saved" cta={feed.length ? { label: 'View all', to: '/saved' } : undefined}>
            {recent.length === 0 ? (
              <Empty line="Nothing saved yet." action="Explore" to="/explore" />
            ) : (
              <div className="grid grid-cols-4 gap-[6px] sm:gap-[10px] lg:grid-cols-8">
                {recent.map((it) => (
                  <Link key={it.id} to={it.href} viewTransition className="aspect-[4/5] overflow-hidden rounded-content bg-muted">
                    <ImageView fill image={it.image} />
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} label="Edit beauty profile">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">Beauty profile</p>
            <h2 className="m-0 type-h2 text-foreground">Edit</h2>
          </div>
          <Field label="Name" on="surface" placeholder="How KABINET should address you" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Field label="Username (optional)" on="surface" placeholder="handle" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value.replace(/[^a-z0-9_.]/gi, '').toLowerCase() })} />
          <div className="flex flex-col gap-sm">
            <p className="m-0 type-eyebrow text-muted-foreground">Your interests</p>
            <div className="flex flex-wrap gap-xs">
              {CATEGORIES.map((c) => (
                <Chip key={c} on="surface" selected={draft.interests.includes(c)} onClick={() => setDraft({ ...draft, interests: draft.interests.includes(c) ? draft.interests.filter((x) => x !== c) : [...draft.interests, c as Category] })}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-sm">
            <p className="m-0 type-eyebrow text-muted-foreground">Your goals</p>
            {draft.goals.length > 0 && (
              <div className="flex flex-wrap gap-xs">
                {draft.goals.map((g) => (
                  <button key={g} type="button" onClick={() => setDraft({ ...draft, goals: draft.goals.filter((x) => x !== g) })} className="inline-flex h-[32px] items-center gap-[6px] rounded-full bg-primary px-[12px] type-body-sm text-primary-foreground" aria-label={`Remove ${g}`}>
                    {g} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-xs">
              {GOAL_SUGGESTIONS.filter((g) => !draft.goals.includes(g)).map((g) => (
                <Chip key={g} on="surface" onClick={() => addGoal(g)} className="h-[32px] px-[12px]">
                  + {g}
                </Chip>
              ))}
            </div>
            <div className="flex items-center gap-sm">
              <Field on="surface" placeholder="Or write your own" value={goal} onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGoal(goal)} />
              <button type="button" onClick={() => addGoal(goal)} className="shrink-0 type-body-sm font-medium text-foreground">Add</button>
            </div>
          </div>
          <Button variant="primary" onClick={() => { update(draft); setEditing(false) }}>Save profile</Button>
        </div>
      </Sheet>
    </div>
  )
}
