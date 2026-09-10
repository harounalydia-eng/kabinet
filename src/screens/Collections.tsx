import { CollectionGrid } from '../components/CollectionGrid'
import { Header } from '../components/Header'
import { useStore } from '../lib/store'

export { UNSORTED } from '../components/CollectionGrid'

export default function Collections() {
  const { collections } = useStore()
  return (
    <>
      <Header eyebrow={`${collections.length} ${collections.length === 1 ? 'collection' : 'collections'}`} title="Collections" sub="What you aspire to." />
      <CollectionGrid />
    </>
  )
}
