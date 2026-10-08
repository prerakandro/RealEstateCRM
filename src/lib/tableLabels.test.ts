import { describe, expect, it } from 'vitest'
import { labelTableCells } from './tableLabels'

describe('labelTableCells', () => {
  it('labels each cell with its column header', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <table>
        <thead><tr><th><input type="checkbox"></th><th>Lead</th><th>Stage</th><th></th></tr></thead>
        <tbody><tr><td>x</td><td>Villa</td><td>New</td><td>Edit</td></tr></tbody>
      </table>`
    labelTableCells(root)
    const labels = [...root.querySelectorAll('td')].map((td) =>
      td.getAttribute('data-label'),
    )
    expect(labels).toEqual(['', 'Lead', 'Stage', ''])
  })
})
