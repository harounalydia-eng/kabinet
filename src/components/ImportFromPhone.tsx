import { useState } from 'react'
import { getImportToken, importEndpoint, regenerateImportToken, requestInboxSync } from '../lib/social/inbox'

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
      className="shrink-0 type-body-sm font-medium text-foreground"
      aria-label={`Copy ${label}`}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

/** Settings → Import from iPhone: the endpoint and device token an iOS Shortcut needs to share links into KABINET. */
export function ImportFromPhone() {
  const endpoint = importEndpoint()
  const [token, setToken] = useState(() => (endpoint ? getImportToken() : ''))
  const [checked, setChecked] = useState(false)
  if (!endpoint) return null
  return (
    <section className="flex flex-col gap-sm">
      <p className="m-0 type-eyebrow text-muted-foreground">Import from iPhone</p>
      <p className="m-0 type-body-sm text-muted-foreground">Share a TikTok, Instagram or YouTube link from your phone and it lands in your saves. Set up a Shortcut once with these two values.</p>
      <div className="flex flex-col gap-[6px]">
        <div className="flex items-center justify-between gap-md">
          <span className="min-w-0 truncate type-meta text-foreground" title={endpoint}>{endpoint}</span>
          <Copy value={endpoint} label="endpoint" />
        </div>
        <div className="flex items-center justify-between gap-md">
          <span className="min-w-0 truncate font-mono type-meta text-foreground" title={token}>{token}</span>
          <Copy value={token} label="device token" />
        </div>
      </div>
      <ol className="m-0 flex list-decimal flex-col gap-[4px] pl-[18px] type-body-sm text-muted-foreground">
        <li>Shortcuts → New shortcut → Receive URLs from Share Sheet.</li>
        <li>Get Contents of URL: the endpoint above, method POST, header Authorization = Bearer + your token, JSON body url = Shortcut Input, source = ios-shortcut.</li>
        <li>Optional: Show Result to see the confirmation.</li>
        <li>Share any post to the Shortcut. It appears here the next time KABINET is open.</li>
      </ol>
      <div className="flex gap-md">
        <button type="button" onClick={() => { requestInboxSync(); setChecked(true); setTimeout(() => setChecked(false), 2000) }} className="type-body-sm font-medium text-foreground">
          {checked ? 'Checking…' : 'Check now'}
        </button>
        <button type="button" onClick={() => { if (confirm('Regenerate the token? The Shortcut on your phone will need the new one.')) setToken(regenerateImportToken()) }} className="type-body-sm text-muted-foreground">
          Regenerate token
        </button>
      </div>
    </section>
  )
}
