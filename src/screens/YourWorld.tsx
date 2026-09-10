import { useMemo, useState } from 'react'
import { CategoryFilter } from '../components/CategoryFilter'
import { DiscoveryGrid } from '../components/DiscoveryGrid'
import { Empty } from '../components/Empty'
import { Header } from '../components/Header'
import { fromSave } from '../lib/feed'
import { useFeed } from '../lib/store'
import type { Category } from '../lib/types'
import { useUI } from '../lib/ui'

/** Your world — everything saved, as one dense grid. */
export default function YourWorld() {
  const feed = useFeed()
  const { openSave } = useUI()
  const [cat, setCat] = useState<Category | 'All'>('All')
  const counts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {}
    for (const s of feed) c[s.category] = (c[s.category] ?? 0) + 1
    return c
  }, [feed])
  const items = useMemo(() => (cat === 'All' ? feed : feed.filter((s) => s.category === cat)).map(fromSave), [feed, cat])

  if (feed.length === 0) {
    return (
      <>
        <Header eyebrow="Your Kabinet" title="Your world" />
        <Empty title="Nothing saved yet." body="Paste a TikTok, Instagram or YouTube link, or add photos. This becomes yours." action="Add something" onAction={() => openSave()} />
      </>
    )
  }
  return (
    <>
      <Header eyebrow={`Your Kabinet · ${feed.length} saved`} title="Your world" />
      <CategoryFilter value={cat} onChange={setCat} leading={[{ value: 'All', label: 'All' }]} counts={counts} className="mb-[20px] sm:mb-[28px]" />
      <DiscoveryGrid items={items} revealKey={cat} />
    </>
  )
}
