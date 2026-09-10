import { Chip } from './Chip'
import { CATEGORIES, type Category } from '../lib/types'

export interface CategoryFilterProps<T extends string> {
  value: T
  onChange: (v: T) => void
  /** Leading options before the beauty worlds (e.g. All, For You, Trending). */
  leading?: Array<{ value: T; label: string }>
  /** Hide worlds with nothing in them. */
  counts?: Partial<Record<Category, number>>
  className?: string
}

/** Compact, horizontal, scrollable on phones. Quieter than the content it filters. */
export function CategoryFilter<T extends string>({ value, onChange, leading = [], counts, className }: CategoryFilterProps<T>) {
  return (
    <div className={`no-scrollbar -mx-(--mobile-page-gutter) flex gap-[6px] overflow-x-auto px-(--mobile-page-gutter) whitespace-nowrap sm:-mx-lg sm:px-lg lg:mx-0 lg:flex-wrap lg:px-0 ${className ?? ''}`}>
      {leading.map((l) => (
        <Chip key={l.value} selected={value === l.value} onClick={() => onChange(l.value)} className="h-[30px] px-[11px]">
          {l.label}
        </Chip>
      ))}
      {CATEGORIES.filter((c) => !counts || counts[c]).map((c) => (
        <Chip key={c} selected={value === c} onClick={() => onChange(c as T)} className="h-[30px] px-[11px]">
          {c}
        </Chip>
      ))}
    </div>
  )
}
