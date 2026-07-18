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

type RefSelectProps = {
  items: { value: string; label: string }[]
  value: string | null
  placeholder: string
  disabled?: boolean
  onSelect: (v: string) => void
}

// Base UI Select は items を渡すと trigger に生値ではなくラベルを表示する
function RefSelect({ items, value, placeholder, disabled, onSelect }: RefSelectProps) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v: string | null) => { if (v) onSelect(v) }}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map(({ value: v, label }) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ScriptureSelector({ value, onChange }: Props) {
  const collections = getAllCollections()
  const selectedCollection = value.collection ? getCollection(value.collection) : undefined
  const selectedBook =
    value.collection && value.book ? getBook(value.collection, value.book) : undefined

  const collectionItems = collections.map((c) => ({ value: c.id, label: c.name }))
  const bookItems = (selectedCollection?.books ?? []).map((b) => ({ value: b.id, label: b.name }))
  const chapterItems = selectedBook
    ? Array.from({ length: selectedBook.chapters }, (_, i) => ({
        value: (i + 1).toString(),
        label: `第${i + 1}章`,
      }))
    : []

  const versesText = value.verses?.join(', ') ?? ''
  const [versesInput, setVersesInput] = useState(versesText)
  useEffect(() => {
    setVersesInput(versesText)
  }, [versesText])

  return (
    <div className="space-y-3">
      <RefSelect
        items={collectionItems}
        value={value.collection ?? null}
        placeholder="聖典集を選択"
        onSelect={(v) => onChange({ collection: v })}
      />

      <RefSelect
        items={bookItems}
        value={value.book ?? null}
        placeholder="書籍を選択"
        disabled={!selectedCollection}
        onSelect={(v) =>
          onChange({ ...value, book: v, chapter: undefined, verses: undefined })
        }
      />

      <RefSelect
        items={chapterItems}
        value={value.chapter?.toString() ?? null}
        placeholder="章を選択"
        disabled={!selectedBook}
        onSelect={(v) =>
          onChange({ ...value, chapter: parseInt(v, 10), verses: undefined })
        }
      />

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
