import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createFileRoute,
  notFound,
  useRouter,
  type HistoryState,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getBook, getCollection, buildScriptureUrl, getChapterLabel, getScriptureLabel } from '@/entities/scripture'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { createSupabaseServer } from '@/shared/lib/auth'
import { supabase } from '@/shared/lib/supabase'
import { ComposePostButton, EmptyState, PageHeader, ScriptureText } from '@/shared/ui'
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
  buildVerseCommentIndex,
  ChapterCommentersRow,
  VerseCommentGutter,
  useSelectedUserId,
  useSelectedUserStore,
} from '@/features/select-verse-view'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import { getCircleUserIds } from '@/entities/user'
import type { AvatarStackItem } from '@/shared/ui'
import { useBookmarkStore } from '@/entities/bookmark'
import { BookmarkButton } from '@/features/toggle-bookmark'
import { useBilingualEnabled } from '@/entities/bilingual-display'
import { BilingualToggleButton } from '@/features/toggle-bilingual'
import { PRIMARY_LANGUAGE, SECONDARY_LANGUAGE } from '@/shared/config/scriptureLanguage'

type VerseTextRow = { verse: number; text_html: string }
type Book = NonNullable<ReturnType<typeof getBook>>
type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>
// queryScriptureVerseTexts は SSR の serverSupabase とブラウザの supabase の両方から
// 呼ばれる。両者は構造的に同じ型（@supabase/ssr の SupabaseClient<Database>）なので
// SupabaseServer をそのまま別名として使う。
type SupabaseClientLike = SupabaseServer
type ChapterRef = { collection: string; book: string; chapter: number }

async function queryCurrentUserId(supabase: SupabaseServer) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function queryUserAndCircle(supabase: SupabaseServer) {
  const userId = await queryCurrentUserId(supabase)
  const circle =
    userId !== null ? await getCircleUserIds(supabase, userId) : null
  return { userId, circle }
}

// SSR ローダー（PRIMARY_LANGUAGE、serverSupabase）とクライアント側の第2言語取得
// （SECONDARY_LANGUAGE、ブラウザの supabase）の両方から呼ぶ共通クエリ。
// エラーを空配列として握りつぶすと、
// SSR では章表示が「0件」に見え、クライアントでは React Query が「取得成功」とみなして
// staleTime: Infinity のキャッシュに乗ってしまう（通信復旧後も再取得されない）ため、
// 必ず throw して呼び出し側にエラーとして伝える。
export async function queryScriptureVerseTexts(
  client: SupabaseClientLike,
  { collection, book, chapter }: ChapterRef,
  language: string,
  verses?: number[],
  signal?: AbortSignal,
): Promise<VerseTextRow[]> {
  let query = client
    .from('scripture_verses')
    .select('verse, text_html')
    .eq('collection_id', collection)
    .eq('book_id', book)
    .eq('chapter', chapter)
    .eq('language', language)
    .order('verse', { ascending: true })
  if (verses?.length) {
    query = query.in('verse', verses)
  }
  if (signal) {
    query = query.abortSignal(signal)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as VerseTextRow[]
}

function useSecondaryVerseTexts(
  loc: ChapterRef,
  verses: number[] | undefined,
  enabled: boolean,
): Map<number, string> {
  // useQuery の data は常に現在の queryKey に対応する値のみを返すため、章が
  // 切り替わった瞬間に前章のデータへ自動的に戻ることはない（queryKey が変わると
  // data は一旦 undefined に戻る）。staleTime: Infinity で ON/OFF の切り替えや
  // 同じ章への再訪問での再取得も避ける。TanStack Query はクエリキーを構造的に
  // 比較するため、verses 配列はそのまま渡せば良い（手動の文字列化は不要）。
  const { data } = useQuery({
    queryKey: ['scripture-verse-secondary-text', loc.collection, loc.book, loc.chapter, verses ?? []],
    queryFn: ({ signal }) => queryScriptureVerseTexts(supabase, loc, SECONDARY_LANGUAGE, verses, signal),
    enabled,
    staleTime: Infinity,
  })

  return useMemo(
    () => (enabled ? new Map((data ?? []).map((r) => [r.verse, r.text_html])) : new Map()),
    [enabled, data],
  )
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
      queryScriptureVerseTexts(serverSupabase, ctx.data, PRIMARY_LANGUAGE, verses),
      queryCurrentUserId(serverSupabase),
    ])
    return { posts: (posts ?? []) as PostWithUser[], verseTexts, userId }
  })

const fetchChapterData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter } = ctx.data
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
      queryScriptureVerseTexts(serverSupabase, ctx.data, PRIMARY_LANGUAGE),
      queryUserAndCircle(serverSupabase),
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
      chapterCommenters,
      circlePosts,
    }
  })

type ChapterSearch = {
  verses?: number[]
  select?: number[]
  mode?: SelectionMode
  // 開いているコメントシートの節。戻る操作で閉じられるよう URL に載せる
  comment?: number
}

// PostComposerSheet と同じく、履歴エントリ自身に由来を持たせて back の可否を決める。
// HistoryState は空インターフェースなので、宣言のマージで項目を足す
declare module '@tanstack/react-router' {
  interface HistoryState {
    mannaVerseSheet?: true
  }
}

type VerseSheetHistoryState = { mannaVerseSheet?: true }
const VERSE_SHEET_MARKER: VerseSheetHistoryState = { mannaVerseSheet: true }

// Number() に素通しすると '0x10' が16節、true が1節として通ってしまう。
// パスの章番号と同じく10進数字だけを受け取る
function parseCommentVerse(input: unknown): number | undefined {
  if (typeof input === 'number') {
    return Number.isInteger(input) && input > 0 ? input : undefined
  }
  if (typeof input !== 'string' || !/^\d+$/.test(input)) return undefined
  const verse = Number(input)
  return verse > 0 ? verse : undefined
}

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined ? parseSelection(search.verses) : undefined,
    select: search.select !== undefined ? parseSelection(search.select) : undefined,
    mode: search.mode === 'select' ? 'select' : undefined,
    comment: parseCommentVerse(search.comment),
  }),
  loaderDeps: ({ search }) => ({
    verses: search.verses,
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
        chapterCommenters: [] as AvatarStackItem[],
        circlePosts: [] as PostWithUser[],
      }
    }

    const data = await fetchChapterData({ data: base })

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [] as number[],
      ...data,
    }
  },
  component: ChapterPage,
})

function ChapterPage() {
  const data = Route.useLoaderData()
  const setReadingPosition = useBookmarkStore((s) => s.setReadingPosition)

  useEffect(() => {
    setReadingPosition({ collection: data.collection, book: data.book.id, chapter: data.chapter })
  }, [data.collection, data.book.id, data.chapter, setReadingPosition])

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
  verseTexts: VerseTextRow[]
  canCompose: boolean
}

function VerseView({ book, chapter, collection, verses, posts, verseTexts, canCompose }: VerseViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const loc = { collection, book: book.id, chapter }
  const scriptureLabel = getScriptureLabel({ ...loc, verses }, book)
  const officialUrl = buildScriptureUrl({ ...loc, verses }, book)
  const bilingual = useBilingualEnabled()
  const secondaryTexts = useSecondaryVerseTexts(loc, verses, bilingual)

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }

  return (
    <div>
      <PageHeader
        title={scriptureLabel}
        backTo="/scriptures/$collection/$book/$chapter"
        backLabel={getChapterLabel(book, chapter)}
        action={
          <div className="flex items-center gap-2">
            {canCompose && (
              <ComposePostButton
                label="投稿する"
                className="hidden lg:inline-flex"
                onClick={() => setSheetOpen(true)}
                aria-haspopup="dialog"
              />
            )}
            <BilingualToggleButton />
            <BookmarkButton loc={loc} />
          </div>
        }
      />
      {canCompose && (
        <ComposePostButton
          layout="fab"
          label="投稿する"
          className="lg:hidden"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
        />
      )}
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
            <ScriptureText
              key={vt.verse}
              verse={vt.verse}
              textHtml={vt.text_html}
              textHtmlSecondary={secondaryTexts.get(vt.verse)}
              secondaryLang={SECONDARY_LANGUAGE}
              showNumber={!book.isFrontMatter}
            />
          ))}
        </div>
      )}
      {posts.length === 0 ? (
        <EmptyState>この節への投稿はまだありません</EmptyState>
      ) : (
        <div className="pb-[var(--fab-clearance)]">
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
          lockScripture
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
  verseTexts: VerseTextRow[]
  canCompose: boolean
  chapterCommenters: AvatarStackItem[]
  circlePosts: PostWithUser[]
}

function ChapterView({
  book, chapter, collection, posts, verseTexts, canCompose,
  chapterCommenters, circlePosts,
}: ChapterViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composerVerses, setComposerVerses] = useState<number[] | undefined>()
  // 塗りの持ち主は印とシートで分ける。ひとつの状態を両者で書くと、シートの開閉に
  // 伴うフォーカスの出入りで飛ぶ印の focus / blur に負けて、開いた直後に消えたり
  // 閉じた後に残ったりする
  const [gutterHighlight, setGutterHighlight] = useState<number[] | null>(null)
  const [sheetHighlight, setSheetHighlight] = useState<number[] | null>(null)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const maxVerse = book.verses[chapter - 1]
  const loc = { collection, book: book.id, chapter }
  const bilingual = useBilingualEnabled()
  const secondaryTexts = useSecondaryVerseTexts(loc, undefined, bilingual)

  const storedUserId = useSelectedUserId()
  const selectUser = useSelectedUserStore((s) => s.select)
  const clearUser = useSelectedUserStore((s) => s.clear)
  const selectedUser =
    chapterCommenters.find((c) => c.userId === storedUserId) ?? null
  // ユーザー未選択なら身内全員分を出す。選択は絞り込みであってゲートではない
  const visiblePosts = useMemo(
    () =>
      selectedUser
        ? circlePosts.filter((p) => p.user_id === selectedUser.userId)
        : circlePosts,
    [circlePosts, selectedUser],
  )
  // 身内全員分。シートの中身と、ガターの幅を取るかの判定に使う
  const allCommentIndex = useMemo(
    () => buildVerseCommentIndex(maxVerse, circlePosts),
    [maxVerse, circlePosts],
  )
  // 節の横の印は絞り込みに従う
  const commentIndex = useMemo(
    () =>
      selectedUser ? buildVerseCommentIndex(maxVerse, visiblePosts) : allCommentIndex,
    [selectedUser, maxVerse, visiblePosts, allCommentIndex],
  )
  // シートの中身は絞り込みを無視する。共有された ?comment= を開いた側が別のユーザーで
  // 絞り込んでいると、送った側が見せたいコメントが無言で開かなくなるため
  const sheetIndex = allCommentIndex

  const verseTextMap = useMemo(
    () => new Map(verseTexts.map((vt) => [vt.verse, vt.text_html])),
    [verseTexts],
  )
  const verseNumbers = Array.from({ length: maxVerse }, (_, i) => i + 1)
  const selection = useMemo(
    () => parseSelection(search.select, maxVerse),
    [search.select, maxVerse],
  )
  const mode: SelectionMode = canCompose && search.mode === 'select' ? 'select' : 'read'

  // インデックスは章の範囲外の節を持たないので、コメントの有無だけを見れば足りる
  const requestedComment = search.comment
  const commentVerseForScroll =
    mode !== 'select' &&
    requestedComment !== undefined &&
    (sheetIndex.get(requestedComment)?.covered.length ?? 0) > 0
      ? requestedComment
      : undefined
  // シートが開いている間はシート側だけが塗りを決める。カードに触れていないときは
  // シートに出ている全コメントが指す節をまとめて塗る。ホバーの無いタッチでは、
  // これがコメントの指す範囲を知る唯一の手段になる
  const highlightedVerses = useMemo(() => {
    if (commentVerseForScroll === undefined) {
      return gutterHighlight ? new Set(gutterHighlight) : null
    }
    if (sheetHighlight) return new Set(sheetHighlight)
    const covered = sheetIndex.get(commentVerseForScroll)?.covered ?? []
    const verses = covered.flatMap((p) => p.scripture_verses ?? [])
    return new Set(verses.length ? verses : [commentVerseForScroll])
  }, [commentVerseForScroll, sheetHighlight, gutterHighlight, sheetIndex])

  const scrolledVerse = useRef<number | undefined>(undefined)
  const isMounted = useRef(false)
  // 併記表示の英文はクライアント側で後から届き、全節の高さが増える。secondaryTexts を
  // 依存に含めて、届いた後にもう一度位置を合わせ直す（含めないと 300px 以上ずれる）
  useEffect(() => {
    if (commentVerseForScroll === undefined) {
      scrolledVerse.current = undefined
      return
    }
    const target = document.querySelector(`li[data-verse="${commentVerseForScroll}"]`)
    if (!target) return

    // 印を押して別の節に移ったときだけスムーズに動かす（視差効果を減らす設定なら
    // それも行わない）。直リンクで開いた初回の位置決めと、
    // 英文が届いた後の再調整は即時にする。どちらも動く様子に意味がないうえ、'smooth' は
    // 開始時点の座標を目標に据えるため、移動中に高さが変わるとずれた位置で止まる
    const isNewSelection = scrolledVerse.current !== commentVerseForScroll
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior =
      !reduceMotion && isMounted.current && isNewSelection ? 'smooth' : 'auto'
    scrolledVerse.current = commentVerseForScroll

    target.scrollIntoView({ behavior, block: 'start' })
  }, [commentVerseForScroll, secondaryTexts])

  // 上のスクロール effect より後に置く。effect は宣言順に走るため、マウント時の
  // 1回目（= 直リンクでの位置決め）では isMounted がまだ false になる
  useEffect(() => {
    isMounted.current = true
  }, [])

  const patchSearch = (
    patch: Partial<ChapterSearch>,
    replace = true,
    state?: (prev: HistoryState) => HistoryState,
  ) => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({ ...prev, ...patch }),
      replace,
      // 同じ章に留まる検索パラメータの更新なので、既定の「先頭へ戻す」は邪魔になる。
      // これがないと下の方の節を選ぶたびに最上部へ飛ばされる
      resetScroll: false,
      ...(state ? { state } : {}),
    })
  }

  const setSelection = (next: number[]) =>
    patchSearch({ select: next.length ? next : undefined })
  // mode=select と同じく push する。戻る操作でシートを閉じられるようにするため。
  // ただしシートは非モーダルなので、開いたまま別の印を押せる。そのたびに push すると
  // 閉じる操作が前の節のシートに戻ってしまうため、開いている間は差し替える。
  // マーカーも足さない（直リンクで開いたエントリに付けると、閉じたときに章から離脱する）
  const openVerseSheet = (verse: number) => {
    const alreadyOpen = commentVerseForScroll !== undefined
    patchSearch({ comment: verse }, alreadyOpen, (prev) =>
      alreadyOpen ? prev : { ...prev, ...VERSE_SHEET_MARKER },
    )
  }
  const closeVerseSheet = () => {
    // 自分が push したエントリのときだけ戻す。replace で消すと同じ章 URL が
    // 履歴に2件残り、戻るを押しても画面が変わらなくなる。
    // canGoBack だけで判定すると、?comment= の直リンクを閉じたときに前のページへ
    // 離脱してしまう（そのエントリはシートを開いたものではない）。
    // 印を判別する状態を ref に持つとブラウザ履歴と同期せず、進む操作やリロードの
    // 後に取り違えるため、履歴エントリ自身に持たせる
    const pushedByUs = (window.history.state as VerseSheetHistoryState | null)
      ?.mannaVerseSheet
    if (pushedByUs && router.history.canGoBack()) router.history.back()
    else patchSearch({ comment: undefined })
  }
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

  const showCommenters = canCompose && mode !== 'select'
  // 投稿の有無ではなく、印が出るかで判定する。範囲外の節だけを持つ投稿があると、
  // 印ゼロのまま本文が狭くなる。絞り込み後ではなく全員分で見るのは、絞り込みの
  // 切り替えで幅を揺らさないため
  const hasAnchorInChapter = useMemo(
    () => [...allCommentIndex.values()].some((entry) => entry.anchored.length > 0),
    [allCommentIndex],
  )
  const showGutter = mode !== 'select' && hasAnchorInChapter

  const composeMenuProps = {
    onSelectChapter: openComposerForChapter,
    onSelectVerses: enterSelectMode,
  }

  const headerAction = (
    <div className="flex items-center gap-2">
      {canCompose && <ComposeMenu {...composeMenuProps} className="hidden lg:inline-flex" />}
      <BilingualToggleButton />
      <BookmarkButton loc={loc} />
    </div>
  )

  const composeFab =
    canCompose && mode !== 'select' ? (
      <ComposeMenu {...composeMenuProps} layout="fab" className="lg:hidden" />
    ) : null

  const collectionName = book.isFrontMatter ? getCollection(collection)?.name : undefined

  const chapterHeader = (
    <>
      <PageHeader
        title={getChapterLabel(book, chapter)}
        backTo={book.isFrontMatter ? '/scriptures/$collection' : '/scriptures/$collection/$book'}
        backLabel={collectionName ?? book.name}
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
    <div className="p-4 pb-[var(--fab-clearance)]">
      <ul>
        {verseNumbers.map((verse, i) => {
          const textHtml = verseTextMap.get(verse)
          const isSelected = mode === 'select' && selection.includes(verse)
          const entry = commentIndex.get(verse)
          const isLast = i === verseNumbers.length - 1
          return (
            <li
              key={verse}
              data-verse={verse}
              // sticky ヘッダーの下に潜り込まないよう、スクロール先に余白を取る
              className={`flex items-stretch scroll-mt-16 ${isLast ? '' : 'border-b'}`}
              style={{ borderColor: 'var(--line)' }}
            >
              <div className="flex-1 min-w-0">
                <VerseRow
                  collection={collection}
                  book={book.id}
                  chapter={chapter}
                  verse={verse}
                  textHtml={textHtml}
                  textHtmlSecondary={secondaryTexts.get(verse)}
                  secondaryLang={SECONDARY_LANGUAGE}
                  mode={mode}
                  selected={isSelected}
                  onSelect={(v) => setSelection(toggleVerse(selection, v))}
                  highlighted={highlightedVerses?.has(verse) ?? false}
                  showNumber={!book.isFrontMatter}
                />
              </div>
              {showGutter && (
                <VerseCommentGutter
                  verse={verse}
                  entry={
                    entry && {
                      anchoredCount: entry.anchored.length,
                      commenters: entry.commenters,
                      highlightVerses: entry.highlightVerses,
                    }
                  }
                  onOpen={openVerseSheet}
                  onHighlight={setGutterHighlight}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  const activeVerseSheet =
    commentVerseForScroll !== undefined ? (
      <VerseCommentSheet
        open
        verse={commentVerseForScroll}
        posts={sheetIndex.get(commentVerseForScroll)?.covered ?? []}
        onOpenChange={(open) => {
          if (!open) closeVerseSheet()
        }}
        onHighlight={setSheetHighlight}
      />
    ) : null

  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
      {composeFab}
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
          lockScripture
        />
      )}
      {activeVerseSheet}
    </div>
  )
}
