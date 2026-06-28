import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MarkdownRenderer } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'
import { VisibilitySelector } from '@/features/choose-visibility'
import { ScriptureSelector, type ScriptureRefPartial } from '@/features/select-scripture'

const DRAFT_KEY = 'manna:post-draft'

type Draft = {
  content: string
  visibility: string
  scripture: ScriptureRefPartial
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { content: '', visibility: 'public', scripture: {} }
}

type Visibility = 'public' | 'followers' | 'family' | 'private'

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

  useEffect(() => {
    const draft = loadDraft()
    setContent(draft.content)
    setVisibility(draft.visibility as Visibility)
    setScripture(initialScripture?.collection ? initialScripture : draft.scripture)
  }, [])

  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ content, visibility, scripture }))
  }, [content, visibility, scripture])

  useEffect(() => {
    saveDraft()
  }, [saveDraft])

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
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <button
          type="button"
          onClick={() => setTab('edit')}
          className="px-3 py-2 text-sm font-medium border-b-2 transition-colors"
          style={{
            borderColor: tab === 'edit' ? 'var(--lagoon-deep)' : 'transparent',
            color: tab === 'edit' ? 'var(--lagoon-deep)' : 'var(--sea-ink-soft)',
          }}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className="px-3 py-2 text-sm font-medium border-b-2 transition-colors"
          style={{
            borderColor: tab === 'preview' ? 'var(--lagoon-deep)' : 'transparent',
            color: tab === 'preview' ? 'var(--lagoon-deep)' : 'var(--sea-ink-soft)',
          }}
        >
          プレビュー
        </button>
      </div>

      {tab === 'edit' ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="聖典を読んで感じたことを書いてみましょう..."
          className="w-full min-h-[200px] rounded-md border p-3 text-sm resize-y focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--line)',
            background: 'var(--surface)',
            color: 'var(--sea-ink)',
          }}
        />
      ) : (
        <div
          className="min-h-[200px] rounded-md border p-3"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          {content ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
              プレビューする内容がありません
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--sea-ink-soft)' }}>
            聖典参照（任意）
          </p>
          <ScriptureSelector value={scripture} onChange={setScripture} />
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--sea-ink-soft)' }}>
            公開範囲
          </p>
          <VisibilitySelector value={visibility} onChange={(v) => setVisibility(v as Visibility)} />
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
