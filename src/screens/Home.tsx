import { useMemo } from 'react'
import { Link } from 'react-router'
import { DiscoveryGrid } from '../components/DiscoveryGrid'
import { ImageView } from '../components/ImageView'
import { RoutineCard } from '../components/RoutineCard'
import { fromSave } from '../lib/feed'
import { useProfile } from '../lib/profile'
import { useFeed, useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import { ProfileMenu } from '../components/ProfileMenu'
import { KabinetLogo } from '../components/KabinetLogo'

function Row({ eyebrow, to, more }: { eyebrow: string; to: string; more: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <p className="m-0 type-eyebrow text-muted-foreground">{eyebrow}</p>
      <Link to={to} className="type-meta text-muted-foreground">{more} →</Link>
    </div>
  )
}

/**
 * Home. On desktop it is the full "Your world" grid. On phones it is a compact
 * personal library: what you saved most recently, your routines, your shelf —
 * the content itself is the interface.
 */
export default function Home() {
  return <MobileHome />
}

function MobileHome() {
  const feed = useFeed()
  const { routines, owned, collections } = useStore()
  const { profile } = useProfile()
  const { openSave } = useUI()
  const recent = useMemo(() => feed.slice(0, 8).map(fromSave), [feed])
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  if (feed.length === 0 && routines.length === 0 && owned.length === 0) {
    return (
      <div className="flex flex-col gap-md">
        <div className="-mx-(--mobile-page-gutter) flex h-[52px] items-center justify-between px-(--mobile-page-gutter)">
          <KabinetLogo size={24} to="/" />
          <ProfileMenu />
        </div>
        <p className="m-0 type-eyebrow text-muted-foreground">Your Kabinet</p>
        <h1 className="m-0 type-title max-md:text-[24px] text-foreground">Save it here. Use it later.</h1>
        <p className="m-0 type-body-sm text-muted-foreground">Paste a TikTok, Instagram or YouTube link, add photos, or start from Explore.</p>
        <button type="button" onClick={() => openSave()} className="inline-flex h-[38px] w-fit items-center rounded-full bg-primary px-[16px] type-body-sm font-medium text-primary-foreground">Add to KABINET</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="-mx-(--mobile-page-gutter) flex h-[52px] items-center justify-between px-(--mobile-page-gutter)">
        <KabinetLogo size={24} to="/" />
        <ProfileMenu />
      </div>
      <h1 className="m-0 -mt-[8px] type-title max-md:text-[24px] text-foreground">
        {greeting}{profile.name ? `, ${profile.name.split(' ')[0]}.` : '.'}
      </h1>

      {recent.length > 0 && (
        <section className="flex flex-col gap-sm">
          <Row eyebrow={`Recently saved · ${feed.length}`} to="/saved" more="See all" />
          <DiscoveryGrid items={recent} revealKey="home" />
        </section>
      )}

      <section className="flex flex-col gap-sm">
        <Row eyebrow={`Your routines · ${routines.length}`} to="/routines" more={routines.length ? 'See all' : 'New'} />
        {routines.length === 0 ? (
          <p className="m-0 type-body-sm text-muted-foreground">Open a saved tutorial and tap Turn into routine.</p>
        ) : (
          <div className="no-scrollbar -mx-(--mobile-page-gutter) flex gap-[6px] overflow-x-auto px-(--mobile-page-gutter)">
            {[...routines].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6).map((r) => (
              <div key={r.id} className="w-[150px] shrink-0">
                <RoutineCard routine={r} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-sm">
        <Row eyebrow={`Collections · ${collections.length}`} to="/collections" more="See all" />
        {collections.length === 0 ? (
          <p className="m-0 type-body-sm text-muted-foreground">Group what you save into worlds.</p>
        ) : (
          <div className="no-scrollbar -mx-(--mobile-page-gutter) flex gap-[6px] overflow-x-auto px-(--mobile-page-gutter)">
            {collections.slice(0, 8).map((c) => {
              const cover = feed.find((s) => s.collectionId === c.id)
              return (
                <Link key={c.id} to={`/collections/${c.id}`} className="flex w-[120px] shrink-0 flex-col gap-[6px]">
                  <div className="aspect-[4/5] overflow-hidden rounded-[6px] bg-muted">{cover && <ImageView fill image={cover.image} />}</div>
                  <span className="truncate type-meta text-foreground">{c.title}</span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-sm">
        <Row eyebrow={`My Kabinet · ${owned.length}`} to="/kabinet" more={owned.length ? 'See all' : 'Add'} />
        {owned.length === 0 ? (
          <p className="m-0 type-body-sm text-muted-foreground">Add the products you own, from any product page or the shelf.</p>
        ) : (
          <div className="no-scrollbar -mx-(--mobile-page-gutter) flex gap-[6px] overflow-x-auto px-(--mobile-page-gutter)">
            {owned.slice(0, 8).map((o) => (
              <Link key={o.id} to="/kabinet" className="flex w-[104px] shrink-0 flex-col gap-[6px]">
                <div className="aspect-[3/4] overflow-hidden rounded-content bg-muted">{o.image && <ImageView fill image={o.image} />}</div>
                <span className="truncate type-meta text-foreground">{o.productName}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
