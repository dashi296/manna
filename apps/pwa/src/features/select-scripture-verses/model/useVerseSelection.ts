export function parseSelection(input: unknown, maxVerse: number = Infinity): number[] {
  const raw: unknown[] = input === undefined ? [] : Array.isArray(input) ? input : [input]
  const nums = raw
    .flatMap((v) => String(v).split(','))
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= maxVerse)
  return Array.from(new Set(nums)).sort((a, b) => a - b)
}

export function toggleVerse(selection: number[], verse: number): number[] {
  const set = new Set(selection)
  if (set.has(verse)) set.delete(verse)
  else set.add(verse)
  return Array.from(set).sort((a, b) => a - b)
}

export type SelectionMode = 'read' | 'select'

export function parseMode(input: unknown): SelectionMode {
  return input === 'select' ? 'select' : 'read'
}
