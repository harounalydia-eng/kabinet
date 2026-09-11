import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Header } from '../components/Header'
import { SaveToKabinet } from '../components/SaveToKabinet'
import { GridDensitySelector, ThemeSelector } from '../components/ProfileMenu'
import { useAuth } from '../lib/auth'
import { idb } from '../lib/db'
import { blobToDataUrl, dataUrlToBlob } from '../lib/images'
import { useStore, type NewSave } from '../lib/store'
import type { Collection, Save } from '../lib/types'

type ExportImage = Save['image'] | { kind: 'data'; dataUrl: string; w: number; h: number }
interface ExportFile {
  kabinet: 1
  collections: Collection[]
  saves: Array<Omit<Save, 'image'> & { image: ExportImage }>
}

function Action({ label, onClick, tone = 'ink' }: { label: string; onClick: () => void; tone?: 'ink' | 'secondary' }) {
  return (
    <button type="button" onClick={onClick} className={`w-fit py-[6px] type-body font-medium ${tone === 'secondary' ? 'text-muted-foreground' : 'text-foreground'}`}>
      {label}
    </button>
  )
}

/** Account and device settings. Nothing about skin, hair or goals lives here — that is the Beauty Profile. */
export default function Settings() {
  const { saves, collections, addSaves, addCollection, removeSeed, restoreSeed, resetAll } = useStore()
  const { user, available, signOut } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const hasSeed = saves.some((s) => s.seed) || collections.some((c) => c.seed)

  async function exportAll() {
    setStatus('Preparing export…')
    const out: ExportFile = { kabinet: 1, collections, saves: [] }
    for (const s of saves) {
      if (s.image.kind === 'blob') {
        const blob = await idb.get<Blob>('blobs', s.image.id)
        if (!blob) continue
        out.saves.push({ ...s, image: { kind: 'data', dataUrl: await blobToDataUrl(blob), w: s.image.w, h: s.image.h } })
      } else out.saves.push(s)
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `kabinet-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus(null)
  }

  async function importFile(file: File) {
    setStatus('Importing…')
    try {
      const data = JSON.parse(await file.text()) as ExportFile
      if (data.kabinet !== 1) throw new Error('Not a KABINET export.')
      const idMap = new Map<string, string>()
      for (const c of data.collections ?? []) {
        const created = await addCollection(c.title, c.description)
        idMap.set(c.id, created.id)
      }
      const inputs: NewSave[] = []
      for (const s of data.saves ?? []) {
        const image: NewSave['image'] = s.image.kind === 'data' ? { kind: 'blob-pending', blob: await dataUrlToBlob(s.image.dataUrl), w: s.image.w, h: s.image.h } : s.image
        inputs.push({ ...s, category: s.category, collectionId: s.collectionId ? idMap.get(s.collectionId) ?? null : null, note: s.note ?? '', image })
      }
      await addSaves(inputs)
      setStatus(`Imported ${inputs.length} saves.`)
    } catch (e) {
      setStatus((e as Error).message)
    }
  }

  return (
    <>
      <div className="hidden sm:block">
        <Header eyebrow="Account" title="Settings" sub="Device, appearance and data. Your beauty profile lives in its own place." />
      </div>
      <div className="flex flex-col gap-xl lg:max-w-[560px]">
        <section className="flex flex-col gap-sm">
          <p className="m-0 type-eyebrow text-muted-foreground">Appearance</p>
          <div className="flex items-center justify-between gap-md">
            <span className="type-body text-foreground">Theme</span>
            <ThemeSelector on="canvas" />
          </div>
        </section>

        <section className="flex flex-col gap-sm">
          <p className="m-0 type-eyebrow text-muted-foreground">Discovery</p>
          <div className="flex items-center justify-between gap-md">
            <span className="type-body text-foreground">Grid size</span>
            <GridDensitySelector on="canvas" />
          </div>
        </section>

        <section className="flex flex-col gap-2xs">
          <p className="m-0 mb-xs type-eyebrow text-muted-foreground">Account</p>
          {available && user ? (
            <>
              <p className="m-0 type-body text-foreground">{user.email ?? 'Signed in'}</p>
              <p className="m-0 type-body-sm text-muted-foreground">Your choices and your Shortcut connection follow this account. Saves stay on this device for now.</p>
              <Link to="/onboarding/shortcut?replay=1" className="w-fit py-[6px] type-body font-medium text-foreground">See the introduction again</Link>
              <Action label="Sign out" tone="secondary" onClick={() => void signOut()} />
            </>
          ) : (
            <p className="m-0 type-body-sm text-muted-foreground">Accounts are not switched on in this build. Everything is kept on this device.</p>
          )}
        </section>

        <SaveToKabinet />

        <section className="flex flex-col gap-2xs">
          <p className="m-0 mb-xs type-eyebrow text-muted-foreground">Your data</p>
          <Action label="Export everything" onClick={() => void exportAll()} />
          <Action label="Import an export" onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }} />
          {hasSeed ? <Action label="Remove demo content" tone="secondary" onClick={() => void removeSeed()} /> : <Action label="Restore demo content" tone="secondary" onClick={() => void restoreSeed()} />}
          {!confirmReset ? (
            <Action label="Reset everything" tone="secondary" onClick={() => setConfirmReset(true)} />
          ) : (
            <div className="flex items-center gap-lg py-[6px]">
              <span className="type-body-sm text-muted-foreground">This deletes every save on this device.</span>
              <button type="button" onClick={() => void resetAll().then(() => setConfirmReset(false))} className="type-body font-medium text-accent-text">Reset</button>
              <button type="button" onClick={() => setConfirmReset(false)} className="type-body font-medium text-foreground">Keep</button>
            </div>
          )}
          {status && <p className="m-0 pt-xs type-body-sm text-muted-foreground">{status}</p>}
        </section>
      </div>
    </>
  )
}
