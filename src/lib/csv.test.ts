import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('quotes commas, quotes and new lines', () => {
    expect(
      toCsv(['Name', 'Note'], [['Rao, Asha', 'Said "call me"\nlater']]),
    ).toBe('Name,Note\r\n"Rao, Asha","Said ""call me""\nlater"')
  })
  it('leaves empty values blank', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('A,B\r\n,')
  })
  it('neutralises spreadsheet formulas', () => {
    expect(toCsv(['A'], [['=HYPERLINK("x")'], ['+91 98290'], ['@sum']])).toBe(
      'A\r\n"\'=HYPERLINK(""x"")"\r\n\'+91 98290\r\n\'@sum',
    )
  })
  it('keeps numbers as numbers', () => {
    expect(toCsv(['Budget'], [[4500000]])).toBe('Budget\r\n4500000')
  })
})
