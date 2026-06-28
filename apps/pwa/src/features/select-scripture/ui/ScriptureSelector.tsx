import { useState, useEffect } from 'react'
import { getAllCollections, getCollection, getBook } from '@/entities/scripture'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Input } from '@/shared/ui/input'

export type ScriptureRefPartial = {
  collection?: string
  book?: string
  chapter?: number
  verses?: number[]
}

type Props = {
  value: ScriptureRefPartial
  onChange: (ref: ScriptureRefPartial) => void
}

export function parseVerses(input: string): number[] {
  const parsed = input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
  return [...new Set(parsed)]
}

export function ScriptureSelector({ value, onChange }: Props) {
  const collections = getAllCollections()
  const selectedCollection = value.collection ? getCollection(value.collection) : undefined
  const selectedBook =
    value.collection && value.book ? getBook(value.collection, value.book) : undefined

  const [versesInput, setVersesInput] = useState(value.verses?.join(', ') ?? '')
  useEffect(() => {
    setVersesInput(value.verses?.join(', ') ?? '')
  }, [value.verses?.join(',')])

  return (
    <div className="space-y-3">
      <Select
        value={value.collection ?? ''}
        onValueChange={(v) => onChange({ collection: v })}
      >
        <SelectTrigger>
          <SelectValue placeholder="聖典集を選択" />
        </SelectTrigger>
        <SelectContent>
          {collections.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.book ?? ''}
        onValueChange={(v) =>
          onChange({ ...value, book: v, chapter: undefined, verses: undefined })
        }
        disabled={!selectedCollection}
      >
        <SelectTrigger>
          <SelectValue placeholder="書籍を選択" />
        </SelectTrigger>
        <SelectContent>
          {selectedCollection?.books.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.chapter?.toString() ?? ''}
        onValueChange={(v) =>
          onChange({ ...value, chapter: parseInt(v, 10), verses: undefined })
        }
        disabled={!selectedBook}
      >
        <SelectTrigger>
          <SelectValue placeholder="章を選択" />
        </SelectTrigger>
        <SelectContent>
          {selectedBook &&
            Array.from({ length: selectedBook.chapters }, (_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                第{i + 1}章
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="節 (例: 7, 9)"
        disabled={!value.chapter}
        value={versesInput}
        onChange={(e) => setVersesInput(e.target.value)}
        onBlur={() =>
          onChange({
            ...value,
            verses: versesInput ? parseVerses(versesInput) : undefined,
          })
        }
      />
    </div>
  )
}
