import { Button } from './Button'

/** Figma hero-card language (28px radius, ink tint) for an empty state. */
export function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <section className="flex flex-col gap-lg rounded-hero bg-surface p-lg pt-[120px] md:max-w-[520px] md:pt-[160px]">
      <div className="flex flex-col gap-xs">
        <h2 className="m-0 type-h2 text-foreground">{title}</h2>
        <p className="m-0 type-body-sm text-muted-foreground">{body}</p>
      </div>
      {action && onAction && (
        <Button variant="primary" onClick={onAction} className="md:w-fit md:px-[28px]">
          {action}
        </Button>
      )}
    </section>
  )
}
