export type VerseViewMode = 'count' | 'who'

export function parseViewMode(input: unknown): VerseViewMode {
  return input === 'who' ? 'who' : 'count'
}
