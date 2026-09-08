import { describe, expect, it } from 'vitest'
import { pageNumbers, slugify } from './utils'

describe('slugify', () => {
  it('creates a stable URL slug', () => {
    expect(slugify('  Bright & Spacious Home!  ')).toBe('bright-spacious-home')
  })
})

describe('pageNumbers', () => {
  it('keeps the current page visible for longer result sets', () => {
    expect(pageNumbers(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
  })
})
