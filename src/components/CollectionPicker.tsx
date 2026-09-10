import { useState, type KeyboardEvent } from 'react'
import { Field } from './Field'
import { Sheet } from './Sheet'
import { cx } from '../lib/cx'
import { useStore } from '../lib/store'

export interface CollectionPickerProps {
  open: boolean
  onClose: () => void
  /** Currently selected collection, if the item is already saved. */
  current?: string | null
  /** Called with the chosen collection id (null = your world, unsorted). */
  onPick: (collectionId: string | null) => void | Promise<void>
  /** Optional destructive row for an item already in the world. */
  onRemove?: () => void | Promise<void>
  title?: string
}

/** Save · Move · Create — one sheet. */
export function CollectionPicker({ open, onClose, current, onPick, onRemove, title = 'Save to' }: CollectionPickerProps) {
  const { collections, saves, addCollection } = useStore()
  const [creating, setCreating] = useState<string | null>(null)
  const count = (id: string) => saves.filter((s) => s.collectionId === id).length

  async function pick(id: string | null) {
    await onPick(id)
    onClose()
  }
  async function create() {
    const t = (creating ?? '').trim()
    if (!t) return
    const c = await addCollection(t)
    setCreating(null)
    await pick(c.id)
  }

  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-[6px]">
          <p className="m-0 type-eyebrow text-muted-foreground">Collections</p>
          <h2 className="m-0 type-h2 text-foreground">{title}</h2>
        </div>
        <div className="flex flex-col">
          <Row label="Your world" sub="Unsorted" selected={current === null} onClick={() => void pick(null)} />
          {collections.map((c) => (
            <Row key={c.id} label={c.title} sub={`${count(c.id)} saved`} selected={current === c.id} onClick={() => void pick(c.id)} />
          ))}
        </div>
        {creating === null ? (
          <button type="button" onClick={() => setCreating('')} className="w-fit type-body-sm font-medium text-foreground">+ New collection</button>
        ) : (
          <div className="flex items-center gap-sm">
            <Field on="surface" placeholder="Collection name" value={creating} autoFocus onChange={(e) => setCreating(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && void create()} />
            <button type="button" onClick={() => void create()} className="shrink-0 type-body-sm font-medium text-foreground">Create</button>
          </div>
        )}
        {onRemove && (
          <button type="button" onClick={() => void Promise.resolve(onRemove()).then(onClose)} className="w-fit type-body-sm text-muted-foreground">Remove from your world</button>
        )}
      </div>
    </Sheet>
  )
}

function Row({ label, sub, selected, onClick }: { label: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex items-baseline justify-between rounded-tile-sm px-sm py-[10px] text-left transition-colors duration-(--motion-fast)', selected ? 'bg-background' : 'hover:bg-background')}>
      <span className={cx('type-body', selected ? 'font-medium text-foreground' : 'text-foreground')}>{label}</span>
      <span className="type-meta text-muted-foreground">{selected ? 'Saved here' : sub}</span>
    </button>
  )
}
