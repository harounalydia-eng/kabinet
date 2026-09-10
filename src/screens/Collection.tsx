import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '../components/Button'
import { Empty } from '../components/Empty'
import { Field } from '../components/Field'
import { Header } from '../components/Header'
import { DiscoveryGrid } from '../components/DiscoveryGrid'
import { fromSave } from '../lib/feed'
import { Sheet } from '../components/Sheet'
import { useFeed, useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import { UNSORTED } from './Collections'

export default function Collection() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const feed = useFeed()
  const { collections, updateCollection, removeCollection } = useStore()
  const { openSave } = useUI()
  const isUnsorted = id === 'unsorted'
  const col = isUnsorted ? UNSORTED : collections.find((c) => c.id === id)
  const saves = feed.filter((s) => (isUnsorted ? s.collectionId === null : s.collectionId === id))

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!editing || !col) return
    setTitle(col.title)
    setDesc(col.description ?? '')
    setConfirm(false)
  }, [editing, col])

  if (!col) return <Navigate to="/collections" replace />

  async function save() {
    if (!title.trim()) return
    await updateCollection(col!.id, { title: title.trim(), description: desc.trim() || undefined })
    setEditing(false)
  }
  async function remove() {
    await removeCollection(col!.id)
    nav('/collections', { replace: true })
  }

  return (
    <>
      <Header
        back="/collections"
        eyebrow={`Collection · ${saves.length} ${saves.length === 1 ? 'save' : 'saves'}`}
        title={col.title}
        sub={col.description}
        right={
          <div className="mt-[6px] flex shrink-0 items-center gap-md">
            <button type="button" onClick={() => openSave({ collectionId: isUnsorted ? null : col.id })} className="hidden type-body-sm font-medium text-foreground lg:block">
              + Save here
            </button>
            {!isUnsorted && (
              <button type="button" onClick={() => setEditing(true)} className="type-body-sm font-medium text-muted-foreground">
                Edit
              </button>
            )}
          </div>
        }
      />
      {saves.length > 0 ? (
        <DiscoveryGrid items={saves.map(fromSave)} revealKey={col.id} />
      ) : (
        <Empty title="Nothing here yet." body="Save into this collection and it becomes a moodboard." action="Save here" onAction={() => openSave({ collectionId: col.id })} />
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} label="Edit collection">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">Collection</p>
            <h2 className="m-0 type-h2 text-foreground">Edit</h2>
          </div>
          <Field label="Title" on="surface" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
          <Field label="Description" on="surface" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
          <Button variant="primary" disabled={!title.trim()} onClick={() => void save()}>
            Done
          </Button>
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto w-fit type-body-sm text-muted-foreground">
              Delete collection
            </button>
          ) : (
            <div className="flex items-center justify-center gap-lg">
              <span className="type-body-sm text-muted-foreground">Its saves stay in your world.</span>
              <button type="button" onClick={() => void remove()} className="type-body-sm font-medium text-accent-text">
                Delete
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="type-body-sm font-medium text-foreground">
                Keep
              </button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  )
}
