import { useMemo, useState } from 'react'
import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBook, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { createSupabaseServer } from '@/shared/lib/auth'
import { EmptyState, PageHeader, ScriptureText } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'
import { ComposeMenu } from '@/widgets/compose-menu'
import {
  SelectionModeHeader,
  VerseRow,
  parseSelection,
  toggleVerse,
  type SelectionMode,
} from '@/features/select-scripture-verses'
import {
  parseViewMode,
  parseSelectedUser,
  type VerseViewMode,
} from '@/features/select-verse-view'
import { getCircleUserIds } from '@/entities/user'
import type { AvatarStackItem } from '@/shared/ui'

type VerseText = { verse: number; text_html: string }
type Book = NonNullable<ReturnType<typeof getBook>>
type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>
type ChapterRef = { collection: string; book: string; chapter: number }

async function queryCurrentUserId(supabase: SupabaseServer) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function queryUserAndCircle(supabase: SupabaseServer, view: VerseViewMode) {
  const userId = await queryCurrentUserId(supabase)
  const circle =
    view === 'who' && userId !== null
      ? await getCircleUserIds(supabase, userId)
      : null
  return { userId, circle }
}

async function queryVerseTexts(supabase: SupabaseServer, { collection, book, chapter }: ChapterRef, verses?: number[]) {
  let query = supabase
    .from('scripture_verses')
    .select('verse, text_html')
    .eq('collection_id', collection)
    .eq('book_id', book)
    .eq('chapter', chapter)
    .order('verse', { ascending: true })
  if (verses?.length) {
    query = query.in('verse', verses)
  }
  const { data } = await query
  return (data ?? []) as VerseText[]
}

const fetchVerseData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef & { verses: number[] }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, verses } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const [{ data: posts }, verseTexts, userId] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .overlaps('scripture_verses', verses)
        .order('created_at', { ascending: false }),
      queryVerseTexts(serverSupabase, ctx.data, verses),
      queryCurrentUserId(serverSupabase),
    ])
    return { posts: (posts ?? []) as PostWithUser[], verseTexts, userId }
  })

const fetchChapterData = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: ChapterRef & { view: VerseViewMode; user: string | undefined }) => data,
  )
  .handler(async (ctx) => {
    const { collection, book, chapter, view, user } = ctx.data
    const serverSupabase = await createSupabaseServer()

    const [
      { data: posts },
      { data: versePostsData },
      verseTexts,
      { userId, circle },
    ] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .is('scripture_verses', null)
        .order('created_at', { ascending: false }),
      serverSupabase
        .from('posts')
        .select('user_id, scripture_verses, created_at')
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .not('scripture_verses', 'is', null),
      queryVerseTexts(serverSupabase, ctx.data),
      queryUserAndCircle(serverSupabase, view),
    ])

    const versePosts = versePostsData ?? []

    const countByVerse: Record<number, number> = {}
    versePosts.forEach((p) => {
      ;(p.scripture_verses as number[] | null)?.forEach((v) => {
        countByVerse[v] = (countByVerse[v] ?? 0) + 1
      })
    })

    let chapterCommenters: AvatarStackItem[] = []
    let selectedUser: AvatarStackItem | null = null
    let selectedUserPosts: PostWithUser[] = []
    let versesWithSelectedUser: number[] = []

    if (circle) {
      const userLookup = new Map(
        circle.users.map((u) => [
          u.id,
          {
            userId: u.id,
            name: u.display_name ?? '匿名ユーザー',
            avatarUrl: u.avatar_url,
          } as AvatarStackItem,
        ]),
      )

      const latestByUser = new Map<string, string>()
      for (const p of versePosts) {
        const uid = p.user_id as string
        if (!userLookup.has(uid)) continue
        const prev = latestByUser.get(uid) ?? ''
        const cur = p.created_at ?? ''
        if (cur > prev) latestByUser.set(uid, cur)
      }
      chapterCommenters = [...latestByUser.entries()]
        .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
        .map(([uid]) => userLookup.get(uid)!)

      const validUser = user && latestByUser.has(user) ? user : null
      if (validUser) {
        selectedUser = userLookup.get(validUser)!
        const versesSet = new Set<number>()
        for (const p of versePosts) {
          if ((p.user_id as string) !== validUser) continue
          ;((p.scripture_verses as number[] | null) ?? []).forEach((v) =>
            versesSet.add(v),
          )
        }
        versesWithSelectedUser = [...versesSet].sort((a, b) => a - b)

        const { data: userPosts } = await serverSupabase
          .from('posts')
          .select(POST_SELECT)
          .eq('scripture_collection', collection)
          .eq('scripture_book', book)
          .eq('scripture_chapter', chapter)
          .eq('user_id', validUser)
          .not('scripture_verses', 'is', null)
          .order('created_at', { ascending: false })
        selectedUserPosts = (userPosts ?? []) as PostWithUser[]
      }
    }

    return {
      posts: (posts ?? []) as PostWithUser[],
      countByVerse,
      verseTexts,
      userId,
      view: circle ? ('who' as const) : ('count' as const),
      chapterCommenters,
      selectedUser,
      selectedUserPosts,
      versesWithSelectedUser,
    }
  })

type ChapterSearch = {
  verses?: number[]
  select?: number[]
  mode?: SelectionMode
  view?: 'who'
  user?: string
}

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined ? parseSelection(search.verses) : undefined,
    select: search.select !== undefined ? parseSelection(search.select) : undefined,
    mode: search.mode === 'select' ? 'select' : undefined,
    view: search.view === 'who' ? 'who' : undefined,
    user: parseSelectedUser(search.user),
  }),
  loaderDeps: ({ search }) => ({
    verses: search.verses,
    view: search.view,
    user: search.user,
  }),
  loader: async ({ params, deps }) => {
    const book = getBook(params.collection, params.book)
    if (!book) throw notFound()
    if (!/^\d+$/.test(params.chapter)) throw notFound()
    const chapterNum = parseInt(params.chapter, 10)
    if (chapterNum < 1 || chapterNum > book.chapters) throw notFound()

    const base = { collection: params.collection, book: params.book, chapter: chapterNum }

    if (deps.verses?.length) {
      const verseCount = book.verses[chapterNum - 1]
      if (deps.verses.some((v) => v < 1 || v > verseCount)) throw notFound()
      const { posts, verseTexts, userId } = await fetchVerseData({ data: { ...base, verses: deps.verses } })
      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: deps.verses,
        posts, countByVerse: {} as Record<number, number>, verseTexts, userId,
        view: 'count' as const,
        chapterCommenters: [] as AvatarStackItem[],
        selectedUser: null as AvatarStackItem | null,
        selectedUserPosts: [] as PostWithUser[],
        versesWithSelectedUser: [] as number[],
      }
    }

    const view = parseViewMode(deps.view)
    const data = await fetchChapterData({
      data: { ...base, view, user: deps.user },
    })

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [] as number[],
      ...data,
    }
  },
  component: ChapterPage,
})

function ComposeButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="accent" size="pill" onClick={onClick}>
      {label}
    </Button>
  )
}

function ChapterPage() {
  const data = Route.useLoaderData()
  if (data.mode === 'verse') {
    return <VerseView
      book={data.book}
      chapter={data.chapter}
      collection={data.collection}
      verses={data.verses}
      posts={data.posts}
      verseTexts={data.verseTexts}
      canCompose={Boolean(data.userId)}
    />
  }
  return <ChapterView
    book={data.book}
    chapter={data.chapter}
    collection={data.collection}
    posts={data.posts}
    countByVerse={data.countByVerse}
    verseTexts={data.verseTexts}
    canCompose={Boolean(data.userId)}
    view={data.view}
    chapterCommenters={data.chapterCommenters}
    selectedUser={data.selectedUser}
    selectedUserPosts={data.selectedUserPosts}
    versesWithSelectedUser={data.versesWithSelectedUser}
  />
}

type VerseViewProps = {
  book: Book
  chapter: number
  collection: string
  verses: number[]
  posts: PostWithUser[]
  verseTexts: VerseText[]
  canCompose: boolean
}

function VerseView({ book, chapter, collection, verses, posts, verseTexts, canCompose }: VerseViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const scriptureLabel = getScriptureLabel({ collection, book: book.id, chapter, verses })
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter, verses })

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }

  return (
    <div>
      <PageHeader
        title={`📖 ${scriptureLabel}`}
        backTo="/scriptures/$collection/$book/$chapter"
        backLabel={`第${chapter}章`}
        action={canCompose ? <ComposeButton onClick={() => setSheetOpen(true)} label="投稿する" /> : undefined}
      />
      <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
          style={{ color: 'var(--lagoon-deep)' }}
        >
          公式サイトで読む →
        </a>
        <span className="text-xs ml-3" style={{ color: 'var(--sea-ink-soft)' }}>新着順</span>
      </div>
      {verseTexts.length > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          {verseTexts.map((vt) => (
            <ScriptureText key={vt.verse} verse={vt.verse} textHtml={vt.text_html} />
          ))}
        </div>
      )}
      {posts.length === 0 ? (
        <EmptyState>この節への投稿はまだありません</EmptyState>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      {canCompose && (
        <PostComposerSheet
          open={sheetOpen}
          onOpenChange={onSheetOpenChange}
          initialScripture={{ collection, book: book.id, chapter, verses }}
        />
      )}
    </div>
  )
}

type ChapterViewProps = {
  book: Book
  chapter: number
  collection: string
  posts: PostWithUser[]
  countByVerse: Record<number, number>
  verseTexts: VerseText[]
  canCompose: boolean
  view: VerseViewMode
  chapterCommenters: AvatarStackItem[]
  selectedUser: AvatarStackItem | null
  selectedUserPosts: PostWithUser[]
  versesWithSelectedUser: number[]
}

function ChapterView({ book, chapter, collection, posts, countByVerse, verseTexts, canCompose }: ChapterViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composerVerses, setComposerVerses] = useState<number[] | undefined>()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  const maxVerse = book.verses[chapter - 1]

  const verseTextMap = useMemo(
    () => new Map(verseTexts.map((vt) => [vt.verse, vt])),
    [verseTexts],
  )
  const verseNumbers = Array.from({ length: maxVerse }, (_, i) => i + 1)
  const selection = useMemo(
    () => parseSelection(search.select, maxVerse),
    [search.select, maxVerse],
  )
  const mode: SelectionMode = canCompose && search.mode === 'select' ? 'select' : 'read'

  const patchSearch = (patch: Partial<ChapterSearch>, replace = true) => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({ ...prev, ...patch }),
      replace,
    })
  }

  const setSelection = (next: number[]) =>
    patchSearch({ select: next.length ? next : undefined })
  const enterSelectMode = () => patchSearch({ mode: 'select' }, false)
  const exitSelectMode = () => patchSearch({ mode: undefined, select: undefined })

  const openComposerForChapter = () => {
    setComposerVerses(undefined)
    setSheetOpen(true)
  }
  const openComposerForSelection = () => {
    setComposerVerses(selection)
    setSheetOpen(true)
  }

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }

  const onComposerClosed = () => {
    if (mode === 'select') exitSelectMode()
  }

  const chapterHeader = (
    <PageHeader
      title={`${book.name} 第${chapter}章`}
      backTo="/scriptures/$collection/$book"
      backLabel={book.name}
      action={
        <div className="flex items-center gap-3">
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--lagoon-deep)' }}
          >
            本文
          </a>
          {canCompose && (
            <ComposeMenu
              onSelectChapter={openComposerForChapter}
              onSelectVerses={enterSelectMode}
            />
          )}
        </div>
      }
    />
  )

  const selectionHeader = (
    <SelectionModeHeader
      count={selection.length}
      onCancel={exitSelectMode}
      onSubmit={openComposerForSelection}
    />
  )

  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
      {posts.length > 0 && (
        <div className="border-b" style={{ borderColor: 'var(--line)' }}>
          <p className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
            この章への投稿
          </p>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      <div className="p-4 pb-24">
        <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {verseNumbers.map((verse) => {
            const count = countByVerse[verse] ?? 0
            const vt = verseTextMap.get(verse)
            const isSelected = mode === 'select' && selection.includes(verse)
            return (
              <li
                key={verse}
                className="border-b last:border-b-0"
                style={{ borderColor: 'var(--line)' }}
              >
                <VerseRow
                  collection={collection}
                  book={book.id}
                  chapter={chapter}
                  verse={verse}
                  textHtml={vt?.text_html}
                  count={count}
                  mode={mode}
                  selected={isSelected}
                  onSelect={(v) => setSelection(toggleVerse(selection, v))}
                />
              </li>
            )
          })}
        </ul>
      </div>
      {canCompose && (
        <PostComposerSheet
          open={sheetOpen}
          onOpenChange={onSheetOpenChange}
          onClosed={onComposerClosed}
          initialScripture={{
            collection,
            book: book.id,
            chapter,
            verses: composerVerses,
          }}
        />
      )}
    </div>
  )
}
