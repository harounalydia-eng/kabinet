import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CollectionPicker } from './CollectionPicker'
import { InspirationCard } from './InspirationCard'
import type { FeedItem } from '../lib/feed'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'

export interface DiscoveryGridProps {
  items: FeedItem[]
  /** Change to re-run the soft reveal (filter or query changed). */
  revealKey?: string
  /** Show the hover save action. */
  savable?: boolean
}

/**
 * Editorial masonry: every item keeps its own proportions and drops into the
 * shortest column, so rows never line up. 2 columns on phones, up to 6 on wide desktops.
 */
export function DiscoveryGrid({ items, revealKey = '', savable = true }: DiscoveryGridProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const { updateSave, saveLook, removeSave } = useStore()
  const { markSettled, density } = useUI()
  const [picking, setPicking] = useState<FeedItem | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const base = width === 0 || width < 600 ? 2 : width < 900 ? 3 : width < 1200 ? 4 : width < 1700 ? 5 : 6
  const cols = density === 'large' ? Math.max(2, base - 1) : density === 'dense' ? base + (width < 600 ? 1 : 2) : base
  const gap = width < 600 ? (density === 'dense' ? 6 : 10) : density === 'dense' ? 6 : 10

  const columns = useMemo(() => {
    const heights = new Array<number>(cols).fill(0)
    const out: Array<Array<{ item: FeedItem; index: number }>> = Array.from({ length: cols }, () => [])
    items.forEach((item, index) => {
      let i = 0
      for (let j = 1; j < cols; j++) if (heights[j] < heights[i]) i = j
      out[i].push({ item, index })
      heights[i] += item.image.h / item.image.w
    })
    return out
  }, [items, cols])
  // density changes remount the columns so the reveal runs again
  const key = `${revealKey}:${density}`

  async function pick(collectionId: string | null) {
    if (!picking) return
    if (picking.save) await updateSave(picking.save.id, { collectionId })
    else if (picking.look) {
      const s = await saveLook(picking.look, collectionId)
      markSettled([s.id])
    }
  }

  return (
    <>
      <div ref={ref} className="flex w-full items-start" style={{ gap }}>
        {columns.map((col, i) => (
          <div key={`${key}:${i}`} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
            {col.map(({ item, index }) => (
              <InspirationCard key={item.id} item={item} index={index} onSave={savable ? setPicking : undefined} />
            ))}
          </div>
        ))}
      </div>
      <CollectionPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        current={picking?.save ? picking.save.collectionId : undefined}
        title={picking?.save ? 'Move to' : 'Save to'}
        onPick={pick}
        onRemove={picking?.save ? () => removeSave(picking.save!.id) : undefined}
      />
    </>
  )
}
