import { Button } from './Button'
import { Sheet } from './Sheet'
import { useUI } from '../lib/ui'

/** Visual search entry point. Uses the existing image flow; does not pretend analysis happened. */
export function VisualSearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { openSave } = useUI()
  return (
    <Sheet open={open} onClose={onClose} label="Visual search">
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col gap-[6px]">
          <p className="m-0 type-eyebrow text-muted-foreground">Visual search</p>
          <h2 className="m-0 type-h2 text-foreground">Photograph a product or a look</h2>
        </div>
        <p className="m-0 type-body-sm text-muted-foreground">
          KABINET will identify products, read packaging and find visually similar inspiration once analysis is connected. Today the image is kept in your world so nothing is lost — it will be analysed when the intelligence layer is switched on.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            onClose()
            openSave()
          }}
        >
          Add an image to your world
        </Button>
      </div>
    </Sheet>
  )
}
