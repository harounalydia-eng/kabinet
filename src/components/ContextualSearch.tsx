import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { VisualSearchSheet } from './VisualSearchSheet'
import { cx } from '../lib/cx'

export type SearchScope = 'saves' | 'explore' | 'collections' | 'kabinet' | 'routines' | 'shop'

export interface SearchContext {
  scope: SearchScope
  label: string
  placeholder: string
}

/** Where the user is decides what search means. */
export function useSearchContext(): SearchContext {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const scopeParam = params.get('scope') as SearchScope | null
  const of = (scope: SearchScope): SearchContext => {
    switch (scope) {
      case 'saves':
        return { scope, label: 'Your World', placeholder: 'Search your saves…' }
      case 'collections':
        return { scope, label: 'Collections', placeholder: 'Search your collections…' }
      case 'kabinet':
        return { scope, label: 'My Kabinet', placeholder: 'Search your products…' }
      case 'routines':
        return { scope, label: 'Routines', placeholder: 'Search your routines…' }
      case 'shop':
        return { scope, label: 'Shop', placeholder: 'Search products…' }
      default:
        return { scope: 'explore', label: 'Explore', placeholder: 'Search beauty, products, looks…' }
    }
  }
  if (pathname === '/search' && scopeParam) return of(scopeParam)
  if (pathname === '/' || pathname === '/saved' || pathname.startsWith('/s/')) return of('saves')
  if (pathname.startsWith('/collections')) return of('collections')
  if (pathname.startsWith('/kabinet')) return of('kabinet')
  if (pathname.startsWith('/routines')) return of('routines')
  if (pathname.startsWith('/shop') || pathname.startsWith('/product/')) return of('shop')
  if (pathname.startsWith('/profile')) return of('saves')
  return of('explore')
}
// (/shop, /look/*, /product/* all fall through to the Explore scope)

/**
 * One search surface: context chip · keyword input · visual search (image entry).
 * Keyword search filters real data. Natural-language ranking is token-based.
 */
export function ContextualSearch({ className, autoFocus = false, compact = false }: { className?: string; autoFocus?: boolean; compact?: boolean }) {
  const ctx = useSearchContext()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const onSearchPage = pathname === '/search'
  const [q, setQ] = useState(onSearchPage ? (params.get('q') ?? '') : '')
  const [visual, setVisual] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the field in step with the URL on the search page; clear it elsewhere.
  useEffect(() => {
    setQ(onSearchPage ? (params.get('q') ?? '') : '')
  }, [onSearchPage, params])

  function commit(value: string) {
    const next = new URLSearchParams()
    if (value.trim()) next.set('q', value.trim())
    next.set('scope', ctx.scope)
    if (onSearchPage) setParams(next, { replace: true })
    else nav(`/search?${next.toString()}`)
  }

  function onChange(value: string) {
    setQ(value)
    if (onSearchPage) commit(value)
  }

  return (
    <>
      <div
        role="search"
        className={cx(
          'flex items-center gap-[6px] rounded-full bg-surface pr-[6px] pl-[6px] transition-shadow duration-(--motion-fast) focus-within:ring-1 focus-within:ring-ring',
          compact ? 'h-[40px]' : 'h-[40px]',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="flex h-[28px] shrink-0 items-center gap-[6px] rounded-full bg-background px-[10px] type-meta font-medium text-foreground"
          aria-label={`Searching in ${ctx.label}`}
        >
          <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-accent" />
          <span className="max-w-[120px] truncate">{ctx.label}</span>
        </button>
        <input
          ref={inputRef}
          type="search"
          value={q}
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder={ctx.placeholder}
          aria-label={ctx.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && commit(q)}
          className="min-w-0 flex-1 bg-transparent type-body-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button type="button" onClick={() => setVisual(true)} aria-label="Visual search" title="Visual search" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--motion-fast) hover:bg-background hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <rect x="2" y="4" width="12" height="9" rx="1" />
            <circle cx="8" cy="8.5" r="2.4" />
            <path d="M6 4l1-1.5h2L10 4" />
          </svg>
        </button>
      </div>
      <VisualSearchSheet open={visual} onClose={() => setVisual(false)} />
    </>
  )
}
