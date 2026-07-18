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

import { parseVerses, type ScriptureRefPartial } from '../model'

type Props = {
  value: ScriptureRefPartial
  onChange: (ref: ScriptureRefPartial) => void
}

export function ScriptureSelector({ value, onChange }: Props) {
  const collections = getAllCollections()
  const selectedCollection = value.collection ? getCollection(value.collection) : undefined
  const selectedBook =
    value.collection && value.book ? getBook(value.collection, value.book) : undefined

  const versesText = value.verses?.join(', ') ?? ''
  const [versesInput, setVersesInput] = useState(versesText)
  useEffect(() => {
    setVersesInput(versesText)
  }, [versesText])

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
        onBlur={() => {
          const maxVerse = selectedBook && value.chapter
            ? selectedBook.verses[value.chapter - 1]
            : undefined
          const parsed = versesInput
            ? parseVerses(versesInput).filter((n) => !maxVerse || n <= maxVerse)
            : undefined
          onChange({ ...value, verses: parsed?.length ? parsed : undefined })
        }}
      />
    </div>
  )
}
