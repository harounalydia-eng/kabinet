import { useMemo } from 'react'
import { DiscoveryGrid } from '../../components/DiscoveryGrid'
import { DiscoveryTop } from '../../components/mobile/DiscoveryTop'
import { CATALOG } from '../../lib/catalog'
import { fromLook, fromSave } from '../../lib/feed'
import { useFeed, useStore } from '../../lib/store'
import type { Category } from '../../lib/types'

/** Phone For You: the K, two tabs, then imagery. Looks you have not saved first, leaning to the worlds you save most, then your own saves. */
export default function ForYou() {
  const feed = useFeed()
  const { saves } = useStore()
  const items = useMemo(() => {
    const interest: Partial<Record<Category, number>> = {}
    for (const s of saves) interest[s.category] = (interest[s.category] ?? 0) + 1
    const savedLooks = new Set(saves.map((s) => s.lookId).filter(Boolean))
    const fresh = CATALOG.filter((l) => !savedLooks.has(l.id)).sort((a, b) => (interest[b.category] ?? 0) - (interest[a.category] ?? 0) || Number(b.trending ?? false) - Number(a.trending ?? false))
    return [...fresh.map((l) => fromLook(l, saves)), ...feed.map(fromSave)]
  }, [saves, feed])
  return (
    <>
      <DiscoveryTop />
      <div className="pt-[8px]">
        <DiscoveryGrid items={items} revealKey="foryou" />
      </div>
    </>
  )
}
