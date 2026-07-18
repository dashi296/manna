import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MarkdownRenderer, TabBar } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'
import type { Visibility } from '@/entities/post'
import { VisibilitySelector } from '@/features/choose-visibility'
import { ScriptureSelector, type ScriptureRefPartial } from '@/features/select-scripture'

const DRAFT_KEY = 'manna:post-draft'

const TABS = [
  { id: 'edit' as const, label: '編集' },
  { id: 'preview' as const, label: 'プレビュー' },
]

const containerStyle = { borderColor: 'var(--line)', background: 'var(--surface)' }
const textareaStyle = { ...containerStyle, color: 'var(--sea-ink)' }
const softTextStyle = { color: 'var(--sea-ink-soft)' }

type Draft = {
  content: string
  visibility: Visibility
  scripture: ScriptureRefPartial
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { content: '', visibility: 'public', scripture: {} }
}

type Props = {
  initialScripture?: ScriptureRefPartial
}

export function PostEditor({ initialScripture }: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [scripture, setScripture] = useState<ScriptureRefPartial>({})
  const [submitting, setSubmitting] = useState(false)
  const draftLoaded = useRef(false)

  useEffect(() => {
    const draft = loadDraft()
    setContent(draft.content)
    setVisibility(draft.visibility)
    setScripture(initialScripture?.collection ? initialScripture : draft.scripture)
    draftLoaded.current = true
  }, [])

  useEffect(() => {
    if (!draftLoaded.current) return
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ content, visibility, scripture }))
    }, 500)
    return () => clearTimeout(timer)
  }, [content, visibility, scripture])

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content,
      visibility,
      scripture_collection: scripture.collection ?? null,
      scripture_book: scripture.book ?? null,
      scripture_chapter: scripture.chapter ?? null,
      scripture_verses: scripture.verses ?? null,
    })

    if (error) {
      setSubmitting(false)
      return
    }

    localStorage.removeItem(DRAFT_KEY)
    navigate({ to: '/' })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'edit' ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="聖典を読んで感じたことを書いてみましょう..."
          className="w-full min-h-[200px] rounded-md border p-3 text-sm resize-y focus:outline-none focus:ring-2"
          style={textareaStyle}
        />
      ) : (
        <div
          className="min-h-[200px] rounded-md border p-3"
          style={containerStyle}
        >
          {content ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm" style={softTextStyle}>
              プレビューする内容がありません
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium mb-2" style={softTextStyle}>
            聖典参照（任意）
          </p>
          <ScriptureSelector value={scripture} onChange={setScripture} />
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={softTextStyle}>
            公開範囲
          </p>
          <VisibilitySelector value={visibility} onChange={setVisibility} />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!content.trim() || submitting}
        className="w-full"
      >
        {submitting ? '投稿中...' : '投稿する'}
      </Button>
    </div>
  )
}
