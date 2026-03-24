import { PhotoUploader } from '@/components/shared/PhotoUploader'
import { PlaceholderTab } from '@/tabs/shared'

export function PhotoLibrary() {
  return (
    <div className="space-y-6">
      <PlaceholderTab summary="Photo ingest, classification, and media persistence will expand from this drop zone." title="Photo Library" />
      <section className="panel p-6">
        <PhotoUploader />
      </section>
    </div>
  )
}
