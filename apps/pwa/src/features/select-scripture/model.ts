import type { ScriptureRef } from '@/entities/scripture'

export type ScriptureRefPartial = Partial<ScriptureRef>

export function parseVerses(input: string): number[] {
  const parsed = input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
  return [...new Set(parsed)]
}
