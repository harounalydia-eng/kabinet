import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from './Button'
import { CollectionCover } from './CollectionCover'
import { Field } from './Field'
import { Sheet } from './Sheet'
import { useFeed, useStore } from '../lib/store'
import type { Collection } from '../lib/types'

export const UNSORTED: Collection = { id: 'unsorted', createdAt: 0, title: 'Unsorted', description: 'Saved, not yet placed.' }

/** Your aspirational worlds. Image-led covers, sharp edges, real counts. */
export function CollectionGrid({ spacious = false }: { spacious?: boolean }) {
  const feed = useFeed()
  const { collections, addCollection } = useStore()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    if (params.get('new') === '1') {
      setCreating(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const unsorted = feed.filter((s) => s.collectionId === null)
  const sorted = [...collections].sort((a, b) => b.createdAt - a.createdAt)

  async function create() {
    if (!title.trim()) return
    await addCollection(title, desc)
    setCreating(false)
    setTitle('')
    setDesc('')
  }

  return (
    <>
      <div className={spacious ? 'grid grid-cols-2 gap-x-[10px] gap-y-xl md:grid-cols-3 md:gap-x-md xl:grid-cols-4' : 'grid grid-cols-2 gap-x-[6px] gap-y-lg md:grid-cols-3 md:gap-x-[10px] xl:grid-cols-5'}>
        <button type="button" onClick={() => setCreating(true)} className="group flex flex-col gap-sm text-left">
          <div className="flex aspect-[4/5] items-center justify-center rounded-content bg-surface transition-colors duration-(--motion-fast) group-hover:bg-muted md:aspect-square">
            <span className="type-body-sm font-medium text-foreground">+ New collection</span>
          </div>
          <div className="flex flex-col gap-[2px] px-[2px]">
            <p className="m-0 type-h3 text-foreground">New collection</p>
            <p className="m-0 type-meta text-muted-foreground">Name a world</p>
          </div>
        </button>
        {sorted.map((c) => (
          <CollectionCover key={c.id} collection={c} saves={feed.filter((s) => s.collectionId === c.id)} />
        ))}
        {unsorted.length > 0 && <CollectionCover collection={UNSORTED} saves={unsorted} />}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} label="New collection">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">Collections</p>
            <h2 className="m-0 type-h2 text-foreground">Name a world</h2>
          </div>
          <Field label="Title" on="surface" placeholder="e.g. Summer skin, Wash day, Products to try" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} />
          <Field label="Description (optional)" on="surface" placeholder="One line on what belongs here." value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} />
          <Button variant="primary" disabled={!title.trim()} onClick={() => void create()}>
            Create
          </Button>
        </div>
      </Sheet>
    </>
  )
}
