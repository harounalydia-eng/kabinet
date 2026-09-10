import { Field } from './Field'

export const INTENTS = ['glossy makeup for acne-prone skin', 'humidity-proof curly hair', 'barrier-friendly winter routine', 'red lipstick looks for olive skin']

export interface DiscoverySearchProps {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  showIntents?: boolean
  className?: string
}

/** One field, natural language welcome. Intent chips show what KABINET search is meant to understand. */
export function DiscoverySearch({ value, onChange, autoFocus, showIntents = true, className }: DiscoverySearchProps) {
  return (
    <div className={`flex flex-col gap-sm ${className ?? ''}`}>
      <Field type="search" autoFocus={autoFocus} placeholder="Search looks, products, ingredients, routines…" value={value} onChange={(e) => onChange(e.target.value)} enterKeyHint="search" />
      {showIntents && !value && (
        <div className="no-scrollbar -mx-lg flex gap-[6px] overflow-x-auto px-lg lg:mx-0 lg:flex-wrap lg:px-0">
          {INTENTS.map((q) => (
            <button key={q} type="button" onClick={() => onChange(q)} className="inline-flex h-[32px] shrink-0 items-center rounded-full bg-surface px-[12px] type-body-sm text-muted-foreground transition-colors duration-(--motion-fast) hover:text-foreground">
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
