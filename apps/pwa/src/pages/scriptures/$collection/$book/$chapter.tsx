import { useMemo, useState } from 'react'
import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBook, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
import { PostCard, POST_SELECT, CommenterBubble, type PostWithUser } from '@/entities/post'
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
  type VerseViewMode,
  ViewModeToggle,
  ChapterCommentersRow,
  serializeViewMode,
  useSelectedUserStore,
} from '@/features/select-verse-view'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import { useIsMobile } from '@/shared/hooks/use-mobile'
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
  .inputValidator((data: ChapterRef & { view: VerseViewMode }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, view } = ctx.data
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
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .not('scripture_verses', 'is', null)
        .order('created_at', { ascending: false }),
      queryVerseTexts(serverSupabase, ctx.data),
      queryUserAndCircle(serverSupabase, view),
    ])

    const versePosts = (versePostsData ?? []) as PostWithUser[]

    let chapterCommenters: AvatarStackItem[] = []
    let circlePosts: PostWithUser[] = []

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

      circlePosts = versePosts.filter((p) => userLookup.has(p.user_id))

      const latestByUser = new Map<string, string>()
      for (const p of circlePosts) {
        const prev = latestByUser.get(p.user_id) ?? ''
        const cur = p.created_at ?? ''
        if (cur > prev) latestByUser.set(p.user_id, cur)
      }
      chapterCommenters = [...latestByUser.entries()]
        .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
        .map(([uid]) => userLookup.get(uid)!)
    }

    return {
      posts: (posts ?? []) as PostWithUser[],
      verseTexts,
      userId,
      view: circle ? ('who' as const) : ('count' as const),
      chapterCommenters,
      circlePosts,
    }
  })

type ChapterSearch = {
  verses?: number[]
  select?: number[]
  mode?: SelectionMode
  view?: 'who'
}

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined ? parseSelection(search.verses) : undefined,
    select: search.select !== undefined ? parseSelection(search.select) : undefined,
    mode: search.mode === 'select' ? 'select' : undefined,
    view: search.view === 'who' ? 'who' : undefined,
  }),
  loaderDeps: ({ search }) => ({
    verses: search.verses,
    view: search.view,
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
        posts, verseTexts, userId,
        view: 'count' as const,
        chapterCommenters: [] as AvatarStackItem[],
        circlePosts: [] as PostWithUser[],
      }
    }

    const view = parseViewMode(deps.view)
    const data = await fetchChapterData({
      data: { ...base, view },
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
    verseTexts={data.verseTexts}
    canCompose={Boolean(data.userId)}
    view={data.view}
    chapterCommenters={data.chapterCommenters}
    circlePosts={data.circlePosts}
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
  verseTexts: VerseText[]
  canCompose: boolean
  view: VerseViewMode
  chapterCommenters: AvatarStackItem[]
  circlePosts: PostWithUser[]
}

function ChapterView({
  book, chapter, collection, posts, verseTexts, canCompose,
  view, chapterCommenters, circlePosts,
}: ChapterViewProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composerVerses, setComposerVerses] = useState<number[] | undefined>()
  const [openVerseSheet, setOpenVerseSheet] = useState<number | null>(null)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  const maxVerse = book.verses[chapter - 1]

  const storedUserId = useSelectedUserStore((s) => s.selectedUserId)
  const selectUserInStore = useSelectedUserStore((s) => s.select)
  const clearUserInStore = useSelectedUserStore((s) => s.clear)
  const commentersById = useMemo(
    () => new Map(chapterCommenters.map((c) => [c.userId, c])),
    [chapterCommenters],
  )
  const selectedUser =
    storedUserId && commentersById.has(storedUserId)
      ? commentersById.get(storedUserId)!
      : null
  const selectedUserPosts = useMemo(
    () =>
      selectedUser
        ? circlePosts.filter((p) => p.user_id === selectedUser.userId)
        : [],
    [circlePosts, selectedUser],
  )
  const versesWithMarker = useMemo(() => {
    const set = new Set<number>()
    for (const p of selectedUserPosts) {
      p.scripture_verses?.forEach((v) => set.add(v))
    }
    return set
  }, [selectedUserPosts])

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
  const setView = (next: VerseViewMode) => {
    patchSearch({ view: serializeViewMode(next) })
    if (next === 'count') clearUserInStore()
  }
  const selectUser = (userId: string) => selectUserInStore(userId)
  const clearUser = () => clearUserInStore()

  const postsByVerse = useMemo(() => {
    const map = new Map<number, PostWithUser[]>()
    for (const p of selectedUserPosts) {
      p.scripture_verses?.forEach((v) => {
        const arr = map.get(v) ?? []
        arr.push(p)
        map.set(v, arr)
      })
    }
    return map
  }, [selectedUserPosts])

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

  const showToggle = canCompose && mode !== 'select'
  const showCommenters = showToggle && view === 'who'
  const showBubbles = mode !== 'select' && !isMobile && selectedUser !== null
  const showMarkers = mode !== 'select' && isMobile && selectedUser !== null

  const headerAction = (
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
      {showToggle && <ViewModeToggle value={view} onChange={setView} />}
      {canCompose && (
        <ComposeMenu
          onSelectChapter={openComposerForChapter}
          onSelectVerses={enterSelectMode}
        />
      )}
    </div>
  )

  const chapterHeader = (
    <>
      <PageHeader
        title={`${book.name} 第${chapter}章`}
        backTo="/scriptures/$collection/$book"
        backLabel={book.name}
        action={headerAction}
      />
      {showCommenters && (
        <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
          <ChapterCommentersRow
            commenters={chapterCommenters}
            selectedUserId={selectedUser?.userId ?? null}
            onSelect={selectUser}
            onClear={clearUser}
          />
        </div>
      )}
    </>
  )

  const selectionHeader = (
    <SelectionModeHeader
      count={selection.length}
      onCancel={exitSelectMode}
      onSubmit={openComposerForSelection}
    />
  )

  const verseList = (
    <div className="p-4 pb-24">
      <ul
        className="overflow-hidden rounded-xl"
        style={{ border: '1px solid var(--line)' }}
      >
        {verseNumbers.map((verse) => {
          const vt = verseTextMap.get(verse)
          const isSelected = mode === 'select' && selection.includes(verse)
          const marker =
            showMarkers && versesWithMarker.has(verse) && selectedUser
              ? selectedUser
              : undefined
          const bubblePosts = showBubbles ? postsByVerse.get(verse) ?? [] : []
          return (
            <li
              key={verse}
              className="border-b last:border-b-0 lg:flex lg:items-start"
              style={{ borderColor: 'var(--line)' }}
            >
              <div className="lg:flex-1 lg:min-w-0">
                <VerseRow
                  collection={collection}
                  book={book.id}
                  chapter={chapter}
                  verse={verse}
                  textHtml={vt?.text_html}
                  mode={mode}
                  selected={isSelected}
                  onSelect={(v) => setSelection(toggleVerse(selection, v))}
                  commenterMarker={marker}
                  onMarkerClick={(v) => setOpenVerseSheet(v)}
                />
              </div>
              {bubblePosts.length > 0 && (
                <div className="hidden lg:flex lg:flex-col lg:gap-2 lg:w-72 lg:shrink-0 lg:p-3">
                  {bubblePosts.map((p) => (
                    <CommenterBubble key={p.id} post={p} />
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  const activeVerseSheet =
    mode !== 'select' && openVerseSheet !== null && selectedUser ? (
      <VerseCommentSheet
        open={openVerseSheet !== null}
        verse={openVerseSheet}
        selectedUserName={selectedUser.name}
        posts={postsByVerse.get(openVerseSheet) ?? []}
        onOpenChange={(open) => {
          if (!open) setOpenVerseSheet(null)
        }}
      />
    ) : null

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
      {verseList}
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
      {activeVerseSheet}
    </div>
  )
}
