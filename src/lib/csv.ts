export type CsvValue = string | number | boolean | null | undefined

/**
 * RFC 4180 CSV. Cells starting with = + - @ are prefixed with a quote so a
 * spreadsheet never runs them as formulas (CSV injection).
 */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const cell = (value: CsvValue) => {
    let text = value == null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

/** Saves CSV text as a file (with a BOM so Excel reads UTF-8 / ₹ correctly). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const csvDate = () => new Date().toISOString().slice(0, 10)
