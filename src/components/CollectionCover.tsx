import { Link } from 'react-router'
import { ImageView } from './ImageView'
import type { Collection, Save } from '../lib/types'

/** A collection is its own saves: one large, two small. No folder icon, ever. */
export function CollectionCover({ collection, saves }: { collection: Collection; saves: Save[] }) {
  const imgs = saves.slice(0, 3)
  return (
    <Link to={`/collections/${collection.id}`} viewTransition className="group flex flex-col gap-sm">
      <div className="aspect-[4/5] overflow-hidden rounded-content bg-muted transition-transform duration-(--motion-fast) ease-soft active:scale-[0.985] md:aspect-square">
        {imgs.length >= 3 ? (
          <div className="grid h-full grid-cols-[3fr_2fr] grid-rows-2 gap-[2px]">
            <div className="row-span-2 overflow-hidden"><ImageView fill image={imgs[0].image} className="transition-transform duration-(--motion-standard) ease-soft group-hover:scale-[1.03]" /></div>
            <div className="overflow-hidden"><ImageView fill image={imgs[1].image} /></div>
            <div className="overflow-hidden"><ImageView fill image={imgs[2].image} /></div>
          </div>
        ) : imgs.length > 0 ? (
          <ImageView fill image={imgs[0].image} className="transition-transform duration-(--motion-standard) ease-soft group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="type-eyebrow text-muted-foreground">Nothing saved yet</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-[2px] px-[2px]">
        <p className="m-0 type-h3 text-foreground">{collection.title}</p>
        <p className="m-0 type-meta text-muted-foreground">{saves.length === 1 ? '1 save' : `${saves.length} saves`}</p>
      </div>
    </Link>
  )
}
