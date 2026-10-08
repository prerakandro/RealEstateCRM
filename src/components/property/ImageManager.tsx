import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import {
  deletePropertyImage,
  getPublicImageUrl,
  reorderImages,
  setPrimaryImage,
  uploadPropertyImage,
} from '@/services/storage'
import type { PropertyImage } from '@/types/domain'

interface ImageManagerProps {
  propertyId: string
  title: string
  images: PropertyImage[]
  busy: boolean
  perform: (work: () => Promise<unknown>) => Promise<void>
}

/** Upload, remove, choose the cover image and drag to set gallery order. */
export function ImageManager({
  propertyId,
  title,
  images,
  busy,
  perform,
}: ImageManagerProps) {
  // Local order so a drop shows immediately; the refresh after saving
  // replaces it with the server order.
  const [order, setOrder] = useState<{ key: string; ids: string[] } | null>(
    null,
  )
  const serverKey = images.map((image) => image.id).join(',')
  const ids = order?.key === serverKey ? order.ids : images.map((x) => x.id)
  const byId = new Map(images.map((image) => [image.id, image]))
  const sorted = ids
    .map((id) => byId.get(id))
    .filter((x): x is PropertyImage => Boolean(x))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id)),
    )
    setOrder({ key: serverKey, ids: next })
    void perform(() => reorderImages(propertyId, next))
  }
  return (
    <section className="image-manager">
      <h2>Property images</h2>
      <p>
        Upload JPEG, PNG or WebP images up to 5MB. Drag to change the gallery
        order; the cover image is shown on cards and search results.
      </p>
      <input
        type="file"
        aria-label="Upload images"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          void perform(async () => {
            for (const file of files)
              await uploadPropertyImage(propertyId, file)
          })
          e.currentTarget.value = ''
        }}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="image-list">
            {sorted.map((image, index) => (
              <SortableImage
                key={image.id}
                image={image}
                position={index + 1}
                title={title}
                onPrimary={() =>
                  perform(() => setPrimaryImage(propertyId, image.id))
                }
                onRemove={() => {
                  if (window.confirm('Remove this image?'))
                    void perform(() => deletePropertyImage(image))
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!images.length && <p>No images yet.</p>}
    </section>
  )
}

function SortableImage({
  image,
  position,
  title,
  onPrimary,
  onRemove,
}: {
  image: PropertyImage
  position: number
  title: string
  onPrimary: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: image.id })
  return (
    <div
      ref={setNodeRef}
      className="sortable-image"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag to reorder image ${position}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <img
        src={getPublicImageUrl(image.storage_path) || ''}
        alt={image.alt_text || title}
      />
      <span>
        {position}. {image.is_primary ? 'Cover image' : ''}
      </span>
      {!image.is_primary && (
        <button type="button" onClick={onPrimary}>
          Make cover
        </button>
      )}
      <button type="button" onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}
