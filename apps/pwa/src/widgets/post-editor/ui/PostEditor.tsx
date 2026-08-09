import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MarkdownRenderer, TabBar } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'
import type { EditablePost, Visibility } from '@/entities/post'
import { getScriptureLabel } from '@/entities/scripture'
import { VisibilitySelector } from '@/features/choose-visibility'
import { ScriptureSelector, type ScriptureRefPartial } from '@/features/select-scripture'
import { useSingleFlight } from '@/shared/hooks/use-single-flight'

// 他の永続ストア（manna:bookmarks:v1 など）に揃えてバージョンを持たせる。
// 下書きの形は一度変わっており、次に変えたとき古い値を新しい型として
// 読んでしまわないよう、キーごと切り替えられるようにしておく
const DRAFT_KEY_ROOT = 'manna:post-draft'
const DRAFT_KEY_BASE = `${DRAFT_KEY_ROOT}:v2`
const DRAFT_KEY_PREFIX = `${DRAFT_KEY_BASE}:`

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

function draftKey(mode: 'page' | 'sheet', scripture: ScriptureRefPartial): string {
  return mode === 'page' ? DRAFT_KEY_BASE : scriptureDraftKey(scripture)
}

// 旧バージョンのキーは読まないので、残しておくと二度と回収されない
function dropOutdatedDrafts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DRAFT_KEY_ROOT) && !key.startsWith(DRAFT_KEY_BASE)) {
        localStorage.removeItem(key)
      }
    }
  } catch {}
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
  post?: EditablePost
  onSuccess?: () => void
}

export function PostEditor({ initialScripture, mode = 'page', post, onSuccess }: Props) {
  const isEditing = post !== undefined
  const navigate = useNavigate()
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  // 編集は props から導出できるのでレンダー時に初期化する。effect で入れると
  // 空のまま1フレーム描画され、その間だけ差分ありと判定されて更新ボタンが有効になる
  const [content, setContent] = useState(() => post?.content ?? '')
  const [visibility, setVisibility] = useState<Visibility>(() => post?.visibility ?? 'public')
  const [scripture, setScripture] = useState<ScriptureRefPartial>(() =>
    post ? (initialScripture ?? {}) : {},
  )
  const { pending: submitting, begin, end } = useSingleFlight()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const draftLoaded = useRef(false)

  // ドラフトはサーバーで読めずハイドレーションがずれるため、こちらは effect のまま
  useEffect(() => {
    if (post) return
    dropOutdatedDrafts()
    const key = draftKey(mode, initialScripture ?? {})
    const draft = loadDraft(key)
    setContent(draft.content)
    setVisibility(draft.visibility)
    setScripture(initialScripture?.collection ? initialScripture : draft.scripture)
    draftLoaded.current = true
  }, [])

  useEffect(() => {
    if (!draftLoaded.current) return
    const key = draftKey(mode, scripture)
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({ content, visibility, scripture }))
    }, 500)
    return () => clearTimeout(timer)
  }, [content, visibility, scripture, mode])

  const unchanged =
    post !== undefined && content === post.content && visibility === post.visibility

  const handleSubmit = async () => {
    if (!content.trim()) return
    // begin() は ref なので同じ tick の2発目をここで止められる
    if (!begin()) return
    setErrorMessage(null)

    if (post) {
      const { data, error } = await supabase
        .from('posts')
        .update({ content, visibility })
        .eq('id', post.id)
        .select('id')

      // RLS 違反はエラーではなく 0 行で返るため、行数でも判定する
      if (error || !data || data.length === 0) {
        end()
        setErrorMessage('更新に失敗しました。もう一度お試しください。')
        return
      }
      onSuccess?.()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      end()
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
      end()
      setErrorMessage('投稿に失敗しました。もう一度お試しください。')
      return
    }

    localStorage.removeItem(draftKey(mode, scripture))
    if (onSuccess) {
      onSuccess()
    } else {
      navigate({ to: '/' })
    }
  }

  const rootClass = mode === 'sheet' ? 'flex flex-col gap-4' : 'flex flex-col gap-4 p-4'

  const scriptureLabel =
    isEditing && initialScripture?.collection && initialScripture.book
      ? getScriptureLabel({
          collection: initialScripture.collection,
          book: initialScripture.book,
          chapter: initialScripture.chapter,
          verses: initialScripture.verses,
        })
      : null

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
          {isEditing ? (
            scriptureLabel && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)', color: 'var(--palm)' }}
              >
                <span aria-hidden="true">📖</span> {scriptureLabel}
              </span>
            )
          ) : (
            <>
              <p className="text-xs font-medium mb-2" style={softTextStyle}>
                聖典参照（任意）
              </p>
              <ScriptureSelector value={scripture} onChange={setScripture} />
            </>
          )}
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
        disabled={!content.trim() || submitting || unchanged}
        className="w-full"
      >
        {isEditing
          ? (submitting ? '更新中...' : '更新する')
          : (submitting ? '投稿中...' : '投稿する')}
      </Button>
    </div>
  )
}
