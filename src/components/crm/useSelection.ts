import { useState } from 'react'

/**
 * Row selection for bulk actions. Selection is tied to the ids currently
 * shown, so changing page or filters drops rows that are no longer visible.
 */
export function useSelection(visibleIds: string[]) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const selected = visibleIds.filter((id) => picked.has(id))
  const allSelected =
    visibleIds.length > 0 && selected.length === visibleIds.length
  return {
    selected,
    allSelected,
    isSelected: (id: string) => picked.has(id),
    toggle: (id: string) =>
      setPicked((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    toggleAll: () => setPicked(allSelected ? new Set() : new Set(visibleIds)),
    clear: () => setPicked(new Set()),
  }
}
