export type VerseViewMode = 'count' | 'who'

export function parseViewMode(input: unknown): VerseViewMode {
  return input === 'who' ? 'who' : 'count'
}

export function serializeViewMode(mode: VerseViewMode): 'who' | undefined {
  return mode === 'who' ? 'who' : undefined
}
