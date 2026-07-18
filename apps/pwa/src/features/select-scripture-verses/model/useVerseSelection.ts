export function parseSelection(input: unknown, maxVerse: number): number[] {
  const raw = input === undefined ? [] : Array.isArray(input) ? input : [input]
  const nums = raw
    .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= maxVerse)
  return Array.from(new Set(nums)).sort((a, b) => a - b)
}

export function toggleVerse(selection: number[], verse: number): number[] {
  const set = new Set(selection)
  if (set.has(verse)) set.delete(verse)
  else set.add(verse)
  return Array.from(set).sort((a, b) => a - b)
}

export function formatSelectionLabel(selection: number[]): string {
  if (selection.length === 0) return ''
  if (selection.length <= 3) return selection.join(', ')
  return `${selection.slice(0, 3).join(', ')}（他${selection.length - 3}件）`
}
