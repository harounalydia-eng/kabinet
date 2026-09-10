import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from '../lib/cx'

interface Base {
  label?: string
  on?: 'canvas' | 'surface'
  className?: string
}
export type InputFieldProps = Base & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { multiline?: false }
export type TextFieldProps = Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & { multiline: true }

const FIELD = 'w-full rounded-tile-sm px-[16px] py-[14px] type-body text-foreground outline-none placeholder:text-muted-foreground transition-shadow duration-(--motion-fast) focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset'

/** Figma: boxed field on the surface tint, no border, eyebrow label above. */
export function Field(props: InputFieldProps | TextFieldProps) {
  const { label, on = 'canvas', className } = props
  const autoId = useId()
  const id = props.id ?? autoId
  const fill = on === 'canvas' ? 'bg-surface' : 'bg-background'
  return (
    <div className={cx('flex w-full flex-col gap-xs', className)}>
      {label && (
        <label htmlFor={id} className="type-eyebrow text-muted-foreground">
          {label}
        </label>
      )}
      {props.multiline ? (
        (() => {
          const { label: _l, on: _o, className: _c, multiline: _m, ...rest } = props
          return <textarea id={id} rows={3} className={cx(FIELD, fill, 'resize-none')} {...rest} />
        })()
      ) : (
        (() => {
          const { label: _l, on: _o, className: _c, multiline: _m, ...rest } = props
          return <input id={id} className={cx(FIELD, fill, 'h-[52px]')} {...rest} />
        })()
      )}
    </div>
  )
}
