/**
 * Copies each column header onto its cells as data-label, so the phone layout
 * (App.css, max-width 760px) can show tables as stacked cards with a label
 * beside every value. Runs over every table under `root`.
 */
export function labelTableCells(root: ParentNode): void {
  for (const table of root.querySelectorAll('table')) {
    const headers = [...table.querySelectorAll('thead th')].map(
      (th) => th.textContent?.trim() ?? '',
    )
    for (const row of table.querySelectorAll('tbody tr')) {
      ;[...row.children].forEach((cell, index) => {
        const label = headers[index] ?? ''
        if (cell.getAttribute('data-label') !== label)
          cell.setAttribute('data-label', label)
      })
    }
  }
}

/** Keeps labels current as React re-renders; returns a cleanup function. */
export function watchTableLabels(root: HTMLElement): () => void {
  let frame = 0
  const run = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => labelTableCells(root))
  }
  labelTableCells(root)
  const observer = new MutationObserver(run)
  observer.observe(root, { childList: true, subtree: true })
  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
  }
}
