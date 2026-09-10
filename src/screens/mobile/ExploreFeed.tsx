import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DiscoveryGrid } from '../../components/DiscoveryGrid'
import { KabinetLogo } from '../../components/KabinetLogo'
import { TextTabs } from '../../components/mobile/DiscoveryTop'
import { CATALOG } from '../../lib/catalog'
import { fromLook } from '../../lib/feed'
import { useStore } from '../../lib/store'
import { CATEGORIES, type Category } from '../../lib/types'

type Seg = 'all' | 'trending' | Category

/** Phone Explore: K + page name, then a separate scrolling filter row, then the masonry. Products live behind Shop. */
export default function ExploreFeed() {
  const { saves } = useStore()
  const [seg, setSeg] = useState<Seg>('all')
  const items = useMemo(() => {
    let list = CATALOG
    if (seg === 'trending') list = list.filter((l) => l.trending)
    else if (seg !== 'all') list = list.filter((l) => l.category === seg)
    return list.map((l) => fromLook(l, saves))
  }, [seg, saves])
  return (
    <>
      {/* Two levels, two rows: brand/page navigation, then the content filters. Never the same row. */}
      <div className="sticky top-0 z-30 -mx-(--mobile-page-gutter) bg-background/92 backdrop-blur-[2px]">
        <div className="flex h-[52px] items-center gap-[16px] px-(--mobile-page-gutter)">
          <KabinetLogo size={24} to="/home" className="shrink-0" />
          <span className="text-[16px] leading-none font-semibold text-foreground">Explore</span>
        </div>
        <TextTabs
          value={seg}
          onChange={setSeg}
          options={[{ value: 'all' as const, label: 'All' }, { value: 'trending' as const, label: 'Trending' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          className="mx-0"
        />
      </div>
      <div className="pt-[10px]">
        <DiscoveryGrid items={items} revealKey={seg} />
      </div>
      <div className="mt-lg flex justify-center">
        <Link to="/shop" className="type-body-sm text-muted-foreground">Products from these looks →</Link>
      </div>
    </>
  )
}
