import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { idb } from './db'
import { forgetBlobUrl } from './images'
import { seedCollections, seedSaves } from './seed'
import { OWNED_SEED } from './catalog'
import type { Category, Collection, ImageRef, Look, OwnedProduct, Product, Routine, Save } from './types'

const SEED_FLAG = 'kabinet-inspo:seeded'

export type NewSaveImage = ImageRef | { kind: 'blob-pending'; blob: Blob; w: number; h: number } | { kind: 'video-pending'; blob: Blob; w: number; h: number; duration?: number }

export interface NewSave extends Partial<Pick<Save, 'title' | 'description' | 'subcategory' | 'tags' | 'products' | 'steps' | 'lookId' | 'productId' | 'social'>> {
  category: Category
  collectionId: string | null
  note: string
  source?: Save['source']
  image: NewSaveImage
}

/** Legacy saves carried a "Product" category; products now live inside beauty worlds. */
function migrate(s: Save): Save {
  const cat = s.category as string
  if (cat === 'Product') return { ...s, category: 'Skin' }
  return s
}

interface Store {
  ready: boolean
  saves: Save[]
  collections: Collection[]
  owned: OwnedProduct[]
  /** Copy an Explore look into the user's world. Returns the existing save if it is already there. */
  saveLook: (look: Look, collectionId: string | null) => Promise<Save>
  /** Save a product into the world. Returns the existing save if it is already there. */
  saveProduct: (product: Product, collectionId: string | null) => Promise<Save>
  addOwned: (p: Omit<OwnedProduct, 'id'>) => Promise<OwnedProduct>
  removeOwned: (id: string) => Promise<void>
  routines: Routine[]
  putRoutine: (r: Routine) => Promise<void>
  removeRoutine: (id: string) => Promise<void>
  addSaves: (inputs: NewSave[]) => Promise<Save[]>
  updateSave: (id: string, patch: Partial<Omit<Save, 'id'>>) => Promise<void>
  removeSave: (id: string) => Promise<void>
  addCollection: (title: string, description?: string) => Promise<Collection>
  updateCollection: (id: string, patch: Partial<Omit<Collection, 'id'>>) => Promise<void>
  removeCollection: (id: string) => Promise<void>
  removeSeed: () => Promise<void>
  restoreSeed: () => Promise<void>
  resetAll: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [saves, setSaves] = useState<Save[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [owned, setOwned] = useState<OwnedProduct[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])

  useEffect(() => {
    let on = true
    ;(async () => {
      try {
        let [s, c, o, r] = await Promise.all([idb.getAll<Save>('saves'), idb.getAll<Collection>('collections'), idb.getAll<OwnedProduct>('owned'), idb.getAll<Routine>('routines')])
        if (s.length === 0 && c.length === 0 && localStorage.getItem(SEED_FLAG) !== 'done') {
          const now = Date.now()
          s = seedSaves(now)
          c = seedCollections(now)
          await Promise.all([...s.map((x) => idb.put('saves', x.id, x)), ...c.map((x) => idb.put('collections', x.id, x))])
          localStorage.setItem(SEED_FLAG, 'done')
        }
        if (o.length === 0 && OWNED_SEED.length > 0 && localStorage.getItem(SEED_FLAG + ':owned') !== 'done') {
          o = OWNED_SEED
          await Promise.all(o.map((x) => idb.put('owned', x.id, x)))
          localStorage.setItem(SEED_FLAG + ':owned', 'done')
        }
        s = s.map(migrate)
        if (!on) return
        setSaves(s)
        setCollections(c)
        setOwned(o)
        setRoutines(r)
      } catch (e) {
        console.error('[KABINET] store load failed', e)
      } finally {
        if (on) setReady(true)
      }
    })()
    return () => {
      on = false
    }
  }, [])

  const addSaves = useCallback(async (inputs: NewSave[]) => {
    const created: Save[] = []
    const base = Date.now()
    for (const [i, input] of inputs.entries()) {
      let image: ImageRef
      if (input.image.kind === 'blob-pending') {
        const id = uid()
        await idb.put('blobs', id, input.image.blob)
        image = { kind: 'blob', id, w: input.image.w, h: input.image.h }
      } else if (input.image.kind === 'video-pending') {
        const id = uid()
        await idb.put('blobs', id, input.image.blob)
        image = { kind: 'video', id, w: input.image.w, h: input.image.h, duration: input.image.duration }
      } else {
        image = input.image
      }
      const save: Save = {
        id: uid(),
        // Keep multi-uploads in picked order at the top of the feed.
        createdAt: base - i,
        category: input.category,
        collectionId: input.collectionId,
        note: input.note.trim(),
        source: input.source,
        image,
        title: input.title,
        description: input.description,
        subcategory: input.subcategory,
        tags: input.tags,
        products: input.products,
        steps: input.steps,
        lookId: input.lookId,
        productId: input.productId,
        social: input.social,
      }
      await idb.put('saves', save.id, save)
      created.push(save)
    }
    setSaves((prev) => [...created, ...prev])
    return created
  }, [])

  const saveLook = useCallback(
    async (look: Look, collectionId: string | null) => {
      const existing = saves.find((s) => s.lookId === look.id)
      if (existing) {
        if (existing.collectionId !== collectionId) {
          const next = { ...existing, collectionId }
          setSaves((prev) => prev.map((s) => (s.id === existing.id ? next : s)))
          await idb.put('saves', next.id, next)
          return next
        }
        return existing
      }
      const [created] = await addSaves([
        { category: look.category, collectionId, note: '', image: look.image, title: look.title, description: look.description, subcategory: look.subcategory, tags: look.tags, products: look.products, steps: look.steps, lookId: look.id },
      ])
      return created
    },
    [saves, addSaves],
  )

  const saveProduct = useCallback(
    async (product: Product, collectionId: string | null) => {
      const existing = saves.find((s) => s.productId === product.id)
      if (existing) {
        if (existing.collectionId !== collectionId) {
          const next = { ...existing, collectionId }
          setSaves((prev) => prev.map((s) => (s.id === existing.id ? next : s)))
          await idb.put('saves', next.id, next)
          return next
        }
        return existing
      }
      const [created] = await addSaves([
        {
          category: product.category ?? 'Skin',
          collectionId,
          note: '',
          image: product.image ?? { kind: 'tone', tone: '#EBE5DB', tone2: '#DCD3C4', w: 600, h: 800 },
          title: `${product.brand} · ${product.productName}`,
          subcategory: product.productType,
          products: [product],
          productId: product.id,
        },
      ])
      return created
    },
    [saves, addSaves],
  )

  const addOwned = useCallback(async (p: Omit<OwnedProduct, 'id'>) => {
    const o: OwnedProduct = { ...p, id: uid() }
    await idb.put('owned', o.id, o)
    setOwned((prev) => [o, ...prev])
    return o
  }, [])

  const removeOwned = useCallback(async (id: string) => {
    setOwned((prev) => prev.filter((o) => o.id !== id))
    await idb.del('owned', id)
  }, [])

  const putRoutine = useCallback(async (r: Routine) => {
    setRoutines((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev]))
    await idb.put('routines', r.id, r)
  }, [])

  const removeRoutine = useCallback(async (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id))
    await idb.del('routines', id)
  }, [])

  const updateSave = useCallback(async (id: string, patch: Partial<Omit<Save, 'id'>>) => {
    let next: Save | undefined
    setSaves((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        next = { ...s, ...patch, id }
        return next
      }),
    )
    if (next) await idb.put('saves', id, next)
  }, [])

  const removeSave = useCallback(async (id: string) => {
    const victim = saves.find((s) => s.id === id)
    setSaves((prev) => prev.filter((s) => s.id !== id))
    await idb.del('saves', id)
    if (victim && (victim.image.kind === 'blob' || victim.image.kind === 'video')) {
      await idb.del('blobs', victim.image.id)
      forgetBlobUrl(victim.image.id)
    }
  }, [saves])

  const addCollection = useCallback(async (title: string, description?: string) => {
    const c: Collection = { id: uid(), createdAt: Date.now(), title: title.trim(), description: description?.trim() || undefined }
    await idb.put('collections', c.id, c)
    setCollections((prev) => [c, ...prev])
    return c
  }, [])

  const updateCollection = useCallback(async (id: string, patch: Partial<Omit<Collection, 'id'>>) => {
    let next: Collection | undefined
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        next = { ...c, ...patch, id }
        return next
      }),
    )
    if (next) await idb.put('collections', id, next)
  }, [])

  const removeCollection = useCallback(async (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id))
    await idb.del('collections', id)
    const orphans = saves.filter((s) => s.collectionId === id)
    setSaves((prev) => prev.map((s) => (s.collectionId === id ? { ...s, collectionId: null } : s)))
    await Promise.all(orphans.map((s) => idb.put('saves', s.id, { ...s, collectionId: null })))
  }, [saves])

  const removeSeed = useCallback(async () => {
    const ss = saves.filter((s) => s.seed)
    const cs = collections.filter((c) => c.seed)
    const os = owned.filter((o) => o.seed)
    setSaves((prev) => prev.filter((s) => !s.seed))
    setCollections((prev) => prev.filter((c) => !c.seed))
    setOwned((prev) => prev.filter((o) => !o.seed))
    await Promise.all([...ss.map((s) => idb.del('saves', s.id)), ...cs.map((c) => idb.del('collections', c.id)), ...os.map((o) => idb.del('owned', o.id))])
    localStorage.setItem(SEED_FLAG, 'done')
    localStorage.setItem(SEED_FLAG + ':owned', 'done')
  }, [saves, collections, owned])

  const restoreSeed = useCallback(async () => {
    const now = Date.now()
    const s = seedSaves(now)
    const c = seedCollections(now)
    await Promise.all([...s.map((x) => idb.put('saves', x.id, x)), ...c.map((x) => idb.put('collections', x.id, x)), ...OWNED_SEED.map((x) => idb.put('owned', x.id, x))])
    setSaves((prev) => [...prev.filter((x) => !x.seed), ...s])
    setCollections((prev) => [...prev.filter((x) => !x.seed), ...c])
    setOwned((prev) => [...prev.filter((x) => !x.seed), ...OWNED_SEED])
  }, [])

  const resetAll = useCallback(async () => {
    for (const s of saves) if (s.image.kind === 'blob' || s.image.kind === 'video') forgetBlobUrl(s.image.id)
    setSaves([])
    setCollections([])
    setOwned([])
    setRoutines([])
    await Promise.all([idb.clear('saves'), idb.clear('collections'), idb.clear('blobs'), idb.clear('owned'), idb.clear('routines')])
    localStorage.setItem(SEED_FLAG, 'done')
    localStorage.setItem(SEED_FLAG + ':owned', 'done')
  }, [saves])

  const value = useMemo<Store>(
    () => ({ ready, saves, collections, owned, routines, putRoutine, removeRoutine, saveLook, saveProduct, addOwned, removeOwned, addSaves, updateSave, removeSave, addCollection, updateCollection, removeCollection, removeSeed, restoreSeed, resetAll }),
    [ready, saves, collections, owned, routines, putRoutine, removeRoutine, saveLook, saveProduct, addOwned, removeOwned, addSaves, updateSave, removeSave, addCollection, updateCollection, removeCollection, removeSeed, restoreSeed, resetAll],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

/** Saves newest first. */
export function useFeed(): Save[] {
  const { saves } = useStore()
  return useMemo(() => [...saves].sort((a, b) => b.createdAt - a.createdAt), [saves])
}
