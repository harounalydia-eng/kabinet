import { useMemo, useState } from 'react'
import { DiscoveryGrid } from '../../components/DiscoveryGrid'
import { DiscoveryTop, TextTabs } from '../../components/mobile/DiscoveryTop'
import { fromSave } from '../../lib/feed'
import { useFeed } from '../../lib/store'
import { CATEGORIES, type Category } from '../../lib/types'
import { useUI } from '../../lib/ui'

/** Phone Saved: your world as pure imagery, worlds as light text tabs. */
export default function SavedFeed() {
  const feed = useFeed()
  const { openSave } = useUI()
  const [cat, setCat] = useState<Category | 'All'>('All')
  const present = useMemo(() => new Set(feed.map((s) => s.category)), [feed])
  const items = useMemo(() => (cat === 'All' ? feed : feed.filter((s) => s.category === cat)).map(fromSave), [feed, cat])
  return (
    <>
      <DiscoveryTop right={<span className="type-micro text-muted-foreground">{feed.length}</span>} />
      {feed.length === 0 ? (
        <div className="flex flex-col gap-sm pt-[24px]">
          <p className="m-0 type-body text-foreground">Nothing saved yet.</p>
          <p className="m-0 type-body-sm text-muted-foreground">Paste a TikTok, Instagram or YouTube link, or add photos.</p>
          <button type="button" onClick={() => openSave()} className="inline-flex h-[38px] w-fit items-center rounded-full bg-primary px-[16px] type-body-sm font-medium text-primary-foreground">Add to KABINET</button>
        </div>
      ) : (
        <>
          <TextTabs value={cat} onChange={setCat} options={[{ value: 'All' as const, label: 'All' }, ...CATEGORIES.filter((c) => present.has(c)).map((c) => ({ value: c, label: c }))]} className="mb-[8px]" />
          <DiscoveryGrid items={items} revealKey={cat} />
        </>
      )}
    </>
  )
}
