import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from './Button'
import { Chip } from './Chip'
import { Field } from './Field'
import { ImageView } from './ImageView'
import { Sheet } from './Sheet'
import { cx } from '../lib/cx'
import { fileToStored, probeUrl, videoMeta } from '../lib/images'
import { useStore, type NewSaveImage } from '../lib/store'
import { CATEGORIES, type Category, type ImageRef, type Save } from '../lib/types'
import { useUI } from '../lib/ui'
import { detectPlatform, PLATFORM_LABEL } from '../lib/social/platform'
import { adapterFor } from '../lib/social/adapters'
import { ackInbox, importEnabled, inboxRowToSave, postImport } from '../lib/social/inbox'
import { guessCategory } from '../lib/routines/textExtract'

interface Picked {
  image: NewSaveImage
  source?: Save['source']
  /** Object URL for previewing a not-yet-stored upload. */
  preview?: string
  /** Imported social video — normalised metadata to persist. */
  social?: Save['social']
  title?: string
  /** Server inbox row behind a pasted link — acknowledged on save, released on cancel. */
  inboxId?: string
}

function previewRef(p: Picked): ImageRef {
  if (p.image.kind === 'blob-pending') return { kind: 'url', url: p.preview ?? '', w: p.image.w, h: p.image.h }
  if (p.image.kind === 'video-pending') return { kind: 'tone', tone: '#383833', tone2: '#2A2A26', label: 'Video', w: p.image.w, h: p.image.h }
  return p.image
}

const looksLikeUrl = (t: string) => /^https?:\/\/\S+$/i.test(t.trim())

/**
 * The save flow. Step one: get a picture in (upload, link, paste, drop).
 * Step two — the brief's structure: preview · Save to KABINET · Category ·
 * Collection · Optional note · SAVE.
 */
export function SaveSheet() {
  const { saveOpen, savePrefill, closeSave, markSettled } = useUI()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { saves, collections, addSaves, addCollection } = useStore()
  const [picked, setPicked] = useState<Picked[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [newCol, setNewCol] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pickedRef = useRef<Picked[]>([])
  pickedRef.current = picked

  // Closing without saving releases any server inbox rows behind pasted links, so they do not sync in later.
  useEffect(() => {
    if (saveOpen) return
    const ids = pickedRef.current.map((p) => p.inboxId).filter((x): x is string => Boolean(x))
    if (ids.length) void ackInbox(ids, 'failed', 'cancelled in app').catch(() => undefined)
  }, [saveOpen])

  useEffect(() => {
    if (!saveOpen) return
    setPicked((prev) => {
      for (const p of prev) if (p.preview) URL.revokeObjectURL(p.preview)
      return []
    })
    setCategory(null)
    setCollectionId(savePrefill.collectionId ?? null)
    setNote('')
    setUrl('')
    setNewCol(null)
    setError(null)
    setBusy(false)
  }, [saveOpen, savePrefill])

  async function addFiles(files: Iterable<File>) {
    setBusy(true)
    setError(null)
    const out: Picked[] = []
    for (const f of files) {
      try {
        if (f.type.startsWith('video/')) {
          const { w, h, duration } = await videoMeta(f)
          out.push({ image: { kind: 'video-pending', blob: f, w, h, duration } })
          continue
        }
        if (!f.type.startsWith('image/')) continue
        const { blob, w, h } = await fileToStored(f)
        out.push({ image: { kind: 'blob-pending', blob, w, h }, preview: URL.createObjectURL(blob) })
      } catch (e) {
        setError((e as Error).message)
      }
    }
    if (out.length) setPicked((p) => [...p, ...out])
    else if (!error) setError('No images found in that selection.')
    setBusy(false)
  }

  /**
   * A TikTok / Instagram / YouTube link imports as VIDEO content. Web paste goes through
   * the same server pipeline as the phone Shortcut when it is configured; the browser
   * adapters are the offline fallback. No AI, no transcription, no product identification here.
   */
  async function importSocial(raw: string) {
    const link = detectPlatform(raw)
    if (!link) return false
    setBusy(true)
    setError(null)
    if (importEnabled()) {
      try {
        const { item, duplicate } = await postImport(raw, 'web-paste')
        const already = saves.find((s) => s.social?.canonicalUrl === item.canonical_url || s.source?.url === item.canonical_url)
        if (duplicate && already) {
          setError(`Already saved${already.title ? `: ${already.title}` : ''}.`)
          setUrl('')
          return true
        }
        const n = inboxRowToSave(item)
        setPicked((p) => [...p, { image: n.image, source: n.source, title: n.title, social: n.social, inboxId: item.status === 'pending' ? item.id : undefined }])
        if (!category) setCategory(n.category)
        if (!item.thumbnail_url && item.access_note) setError(item.access_note)
        setUrl('')
        return true
      } catch (e) {
        setError((e as Error).message)
        return true
      } finally {
        setBusy(false)
      }
    }
    try {
      const c = await adapterFor(link.platform).fetchMetadata(link)
      const image: NewSaveImage = c.thumbnailUrl
        ? { kind: 'url', url: c.thumbnailUrl, w: c.thumbnailWidth ?? (link.vertical ? 720 : 1280), h: c.thumbnailHeight ?? (link.vertical ? 1280 : 720) }
        : { kind: 'tone', tone: '#383833', tone2: '#2A2A26', label: PLATFORM_LABEL[link.platform], w: link.vertical ? 720 : 1280, h: link.vertical ? 1280 : 720 }
      setPicked((p) => [
        ...p,
        {
          image,
          source: { url: c.sourceUrl, title: c.title ?? undefined },
          title: c.title ?? undefined,
          social: { platform: c.platform, contentType: 'video', sourceId: c.sourceId, sourceUrl: raw.trim(), canonicalUrl: c.sourceUrl, creatorName: c.creatorName, creatorUrl: c.creatorUrl, embedUrl: c.embedUrl, posterUrl: c.thumbnailUrl, vertical: c.vertical, caption: c.caption, description: c.description, transcript: c.transcript, availableText: c.availableText, accessNote: c.access.note },
        },
      ])
      const guess = guessCategory(c.availableText)
      if (guess) setCategory(guess)
      if (!c.access.metadata && c.access.note) setError(c.access.note)
      setUrl('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
    return true
  }

  async function addUrl(raw = url) {
    const u = raw.trim()
    if (!looksLikeUrl(u)) {
      setError('Paste a full link, starting with https://')
      return
    }
    if (await importSocial(u)) return
    setBusy(true)
    setError(null)
    try {
      const { w, h } = await probeUrl(u)
      setPicked((p) => [...p, { image: { kind: 'url', url: u, w, h }, source: { url: u } }])
      setUrl('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files ?? [])
    if (files.length) {
      e.preventDefault()
      void addFiles(files)
      return
    }
    const text = e.clipboardData.getData('text')
    if (looksLikeUrl(text) && picked.length === 0) {
      e.preventDefault()
      void addUrl(text)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) return void addFiles(files)
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text')
    if (looksLikeUrl(uri)) void addUrl(uri)
  }

  async function createCollection() {
    const title = (newCol ?? '').trim()
    if (!title) return
    const c = await addCollection(title)
    setCollectionId(c.id)
    setNewCol(null)
  }

  async function submit() {
    if (!category || picked.length === 0 || busy) return
    setBusy(true)
    try {
      const created = await addSaves(picked.map((p) => ({ category, collectionId, note, source: p.source, image: p.image, title: p.title, social: p.social })))
      const inboxIds = picked.map((p) => p.inboxId).filter((x): x is string => Boolean(x))
      setPicked((p) => p.map((x) => ({ ...x, inboxId: undefined })))
      void ackInbox(inboxIds, 'imported').catch(() => undefined)
      markSettled(created.map((c) => c.id))
      closeSave()
      // Land where the new save is visible so it settles into the feed.
      const home = collectionId && pathname === `/collections/${collectionId}` ? pathname : '/'
      if (pathname !== home) nav(home, { viewTransition: true })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const first = picked[0]
  const previewWidth = first ? `min(100%, ${Math.round(220 * (first.image.w / first.image.h))}px)` : undefined

  return (
    <Sheet open={saveOpen} onClose={closeSave} label="Save to KABINET">
      <div
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx('flex flex-col gap-lg rounded-tile transition-colors duration-(--motion-standard)', dragging && 'bg-background')}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(Array.from(e.target.files))
            e.target.value = ''
          }}
        />

        {!first ? (
          <>
            <div className="flex flex-col gap-[6px]">
              <p className="m-0 type-eyebrow text-muted-foreground">Add to KABINET</p>
              <h2 className="m-0 type-h2 text-foreground">Save it here. Use it later.</h2>
            </div>
            <div className="flex flex-col gap-xs">
              <Field
                label="Paste a link"
                on="surface"
                inputMode="url"
                placeholder="TikTok, Instagram, YouTube, or an image"
                value={url}
                disabled={busy}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && void addUrl()}
              />
              <p className="m-0 type-meta text-muted-foreground">Supported: TikTok · Instagram · YouTube</p>
              {url.trim() && (
                <button type="button" onClick={() => void addUrl()} disabled={busy} className="w-fit type-body-sm font-medium text-foreground">
                  {busy ? 'Importing…' : detectPlatform(url) ? `Import from ${PLATFORM_LABEL[detectPlatform(url)!.platform]} →` : 'Add link →'}
                </button>
              )}
            </div>
            <div className="flex flex-col border-t border-border">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-baseline justify-between border-b border-border py-[12px] text-left disabled:opacity-40">
                <span className="type-body text-foreground">Upload photos or videos</span>
                <span className="type-meta text-muted-foreground">Camera roll</span>
              </button>
              <button type="button" onClick={() => { closeSave(); nav('/kabinet?add=1') }} className="flex items-baseline justify-between border-b border-border py-[12px] text-left">
                <span className="type-body text-foreground">Add a product</span>
                <span className="type-meta text-muted-foreground">My Kabinet</span>
              </button>
              <button type="button" onClick={() => { closeSave(); nav('/collections?new=1') }} className="flex items-baseline justify-between border-b border-border py-[12px] text-left">
                <span className="type-body text-foreground">New collection</span>
                <span className="type-meta text-muted-foreground">Organize</span>
              </button>
            </div>
            <p className="m-0 hidden type-meta text-muted-foreground lg:block">You can also drop files here.</p>
          </>
        ) : (
          <>
            <div className="flex items-end gap-md">
              <div className="overflow-hidden rounded-content" style={{ width: previewWidth }}>
                <ImageView image={previewRef(first)} priority showLabel />
              </div>
              <div className="flex min-w-0 flex-col gap-2xs pb-[4px]">
                {first.social && <span className="type-eyebrow text-muted-foreground">{PLATFORM_LABEL[first.social.platform]}{first.social.creatorName && ` · ${first.social.creatorName}`}</span>}
                {first.title && <span className="line-clamp-2 type-body-sm text-foreground">{first.title}</span>}
                {picked.length > 1 && <span className="type-meta text-muted-foreground">+{picked.length - 1} more</span>}
                <button type="button" onClick={() => setPicked([])} className="type-body-sm font-medium text-muted-foreground">
                  Change
                </button>
              </div>
            </div>

            <h2 className="m-0 type-h2 text-foreground">Save to KABINET</h2>

            <div className="flex flex-col gap-sm">
              <p className="m-0 type-eyebrow text-muted-foreground">Category</p>
              <div className="flex flex-wrap gap-xs">
                {CATEGORIES.map((c) => (
                  <Chip key={c} on="surface" selected={category === c} onClick={() => setCategory(c)}>
                    {c}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-sm">
              <p className="m-0 type-eyebrow text-muted-foreground">Collection</p>
              <div className="flex flex-wrap gap-xs">
                {collections.map((c) => (
                  <Chip key={c.id} on="surface" selected={collectionId === c.id} onClick={() => setCollectionId(collectionId === c.id ? null : c.id)}>
                    {c.title}
                  </Chip>
                ))}
                <Chip on="surface" selected={newCol !== null} onClick={() => setNewCol(newCol === null ? '' : null)}>
                  + New
                </Chip>
              </div>
              {newCol !== null && (
                <div className="flex items-center gap-sm">
                  <Field
                    on="surface"
                    placeholder="Collection name"
                    value={newCol}
                    autoFocus
                    onChange={(e) => setNewCol(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && void createCollection()}
                  />
                  <button type="button" onClick={() => void createCollection()} className="shrink-0 type-body-sm font-medium text-foreground">
                    Create
                  </button>
                </div>
              )}
              {collections.length === 0 && newCol === null && <p className="m-0 type-meta text-muted-foreground">Choose collection — or leave it unsorted.</p>}
            </div>

            <Field multiline label="Optional note" on="surface" placeholder="Why this one?" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

            <Button variant="primary" onClick={() => void submit()} disabled={!category || busy}>
              {busy ? 'Saving…' : picked.length > 1 ? `Save ${picked.length}` : 'Save'}
            </Button>
            {busy && (
              <div aria-hidden="true" className="-mt-md h-[2px] w-full overflow-hidden rounded-full bg-muted">
                <div className="indeterminate h-full w-1/3 rounded-full bg-muted-foreground/60" />
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="m-0 type-body-sm text-accent-text">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}
