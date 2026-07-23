import type { ScriptureRef } from '@/entities/scripture'

export type ScriptureRefPartial = Partial<ScriptureRef>

type SelectableBook = { chapters: number; name: string; isFrontMatter?: boolean }

export function buildChapterItems(book: SelectableBook): { value: string; label: string }[] {
  if (book.isFrontMatter) return [{ value: '1', label: book.name }]
  return Array.from({ length: book.chapters }, (_, i) => ({
    value: (i + 1).toString(),
    label: `第${i + 1}章`,
  }))
}

export function parseVerses(input: string): number[] {
  const parsed = input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
  return [...new Set(parsed)]
}
