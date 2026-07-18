import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MarkdownRenderer, TabBar } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'
import type { Visibility } from '@/entities/post'
import { VisibilitySelector } from '@/features/choose-visibility'
import { ScriptureSelector, type ScriptureRefPartial } from '@/features/select-scripture'

const LEGACY_DRAFT_KEY = 'manna:post-draft'
const DRAFT_KEY_PREFIX = 'manna:post-draft:'

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

function scriptureDraftKey(scripture: ScriptureRefPartial): string {
  if (!scripture.collection) return `${DRAFT_KEY_PREFIX}none`
  const verses = scripture.verses?.slice().sort((a, b) => a - b).join(',') ?? ''
  return `${DRAFT_KEY_PREFIX}${scripture.collection}:${scripture.book ?? ''}:${scripture.chapter ?? ''}:${verses}`
}

function loadDraft(key: string): Draft {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { content: '', visibility: 'public', scripture: {} }
}

type Props = {
  initialScripture?: ScriptureRefPartial
  mode?: 'page' | 'sheet'
  onSuccess?: () => void
}

export function PostEditor({ initialScripture, mode = 'page', onSuccess }: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [scripture, setScripture] = useState<ScriptureRefPartial>({})
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const draftLoaded = useRef(false)

  useEffect(() => {
    const key = mode === 'page' ? LEGACY_DRAFT_KEY : scriptureDraftKey(initialScripture ?? {})
    const draft = loadDraft(key)
    setContent(draft.content)
    setVisibility(draft.visibility)
    setScripture(initialScripture?.collection ? initialScripture : draft.scripture)
    draftLoaded.current = true
  }, [])

  useEffect(() => {
    if (!draftLoaded.current) return
    const key = mode === 'page' ? LEGACY_DRAFT_KEY : scriptureDraftKey(scripture)
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({ content, visibility, scripture }))
    }, 500)
    return () => clearTimeout(timer)
  }, [content, visibility, scripture, mode])

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    setErrorMessage(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      setErrorMessage('投稿するにはログインが必要です。')
      return
    }

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
      setErrorMessage('投稿に失敗しました。もう一度お試しください。')
      return
    }

    localStorage.removeItem(mode === 'page' ? LEGACY_DRAFT_KEY : scriptureDraftKey(scripture))
    if (onSuccess) {
      onSuccess()
    } else {
      navigate({ to: '/' })
    }
  }

  const rootClass = mode === 'sheet' ? 'flex flex-col gap-4' : 'flex flex-col gap-4 p-4'

  return (
    <div className={rootClass}>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

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
